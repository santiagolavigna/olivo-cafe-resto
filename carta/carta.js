(function () {
  'use strict';

  var VERSION = '20260728c';
  var PDFS = {
    cafeteria: '../assets/menu-cafeteria.pdf',
    restaurante: '../assets/menu-restaurante.pdf'
  };
  var MOUNT_TIMEOUT_MS = 12000;
  var PRELOAD_TIMEOUT_MS = 8000;

  var viewer = document.getElementById('viewer');
  var bookWrap = document.getElementById('bookWrap');
  var loader = document.getElementById('loader');
  var loaderText = loader ? loader.querySelector('p') : null;
  var bookError = document.getElementById('bookError');
  var rail = document.getElementById('rail');
  var pageLabel = document.getElementById('pageLabel');
  var prevBtn = document.getElementById('prevBtn');
  var nextBtn = document.getElementById('nextBtn');
  var pdfBtn = document.getElementById('pdfBtn');
  var dockHint = document.getElementById('dockHint');
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.top__tab'));

  var pageFlip = null;
  var scrollMode = false;
  var scrollPages = [];
  var manifest = null;
  var currentKey = 'cafeteria';
  var builtNarrow = null;
  var loadToken = 0;
  var mountWatchdog = null;

  function isNarrow() {
    return viewer.clientWidth < 760;
  }

  function hasFlipLib() {
    return !!(window.St && window.St.PageFlip);
  }

  function keyFromUrl() {
    var q = (new URLSearchParams(window.location.search).get('carta') || '').toLowerCase();
    if (q.indexOf('rest') === 0 || q === 'resto') return 'restaurante';
    return 'cafeteria';
  }

  function setUrl(key) {
    try {
      var url = new URL(window.location.href);
      url.searchParams.set('carta', key);
      window.history.replaceState(null, '', url.toString());
    } catch (e) { /* noop */ }
  }

  function setTabs(key) {
    tabs.forEach(function (tab) {
      var on = tab.getAttribute('data-menu') === key;
      tab.classList.toggle('is-active', on);
      tab.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    pdfBtn.href = PDFS[key];
    setUrl(key);
  }

  function normalizeEntries(list) {
    if (!list || !list.length) return [];
    return list.map(function (item) {
      if (typeof item === 'string') {
        return { src: item, orientation: 'portrait' };
      }
      return item;
    });
  }

  function imageUrl(src) {
    return src + (src.indexOf('?') >= 0 ? '&' : '?') + 'v=' + VERSION;
  }

  function pageRatio(entries) {
    var first = entries[0];
    if (first && first.w && first.h) return first.h / first.w;
    return 1.414;
  }

  function bookSize(ratio) {
    var stageW = Math.max(viewer.clientWidth - 8, 240);
    var stageH = Math.max(viewer.clientHeight - 8, 280);
    var safeRatio = ratio > 0.2 && isFinite(ratio) ? ratio : 1.414;

    if (isNarrow()) {
      return {
        width: Math.max(200, Math.floor(stageW * 0.96)),
        height: Math.max(240, Math.floor(stageW * 0.96 * safeRatio))
      };
    }

    /* Desktop: ocupar casi todo el visor (spread = 2 páginas) */
    var maxSpreadW = stageW * 0.98;
    var maxPageH = stageH * 0.98;
    var pageW = Math.min(maxSpreadW / 2, maxPageH / safeRatio);
    pageW = Math.max(220, Math.floor(pageW));

    return {
      width: pageW,
      height: Math.max(240, Math.floor(pageW * safeRatio))
    };
  }

  function blankPageDataUrl(width, height) {
    var c = document.createElement('canvas');
    c.width = Math.max(2, width || 800);
    c.height = Math.max(2, height || 1100);
    var ctx = c.getContext('2d');
    ctx.fillStyle = '#f7f4ea';
    ctx.fillRect(0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.72);
  }

  function waitLayout() {
    return new Promise(function (resolve) {
      requestAnimationFrame(function () {
        requestAnimationFrame(resolve);
      });
    });
  }

  function withTimeout(promise, ms, label) {
    return new Promise(function (resolve, reject) {
      var done = false;
      var timer = window.setTimeout(function () {
        if (done) return;
        done = true;
        reject(new Error(label || 'timeout'));
      }, ms);
      promise.then(function (value) {
        if (done) return;
        done = true;
        window.clearTimeout(timer);
        resolve(value);
      }, function (err) {
        if (done) return;
        done = true;
        window.clearTimeout(timer);
        reject(err);
      });
    });
  }

  function preloadImages(urls) {
    return Promise.all(urls.map(function (url, index) {
      return withTimeout(new Promise(function (resolve, reject) {
        var img = new Image();
        img.decoding = 'async';
        img.onload = function () { resolve(url); };
        img.onerror = function () { reject(new Error('img-' + index)); };
        img.src = url;
      }), PRELOAD_TIMEOUT_MS, 'img-timeout-' + index);
    }));
  }

  function setLoaderMsg(msg) {
    if (loaderText) loaderText.textContent = msg;
  }

  function clearWatchdog() {
    if (mountWatchdog) {
      window.clearTimeout(mountWatchdog);
      mountWatchdog = null;
    }
  }

  function updateChrome() {
    var total = 1;
    var current = 0;

    if (scrollMode) {
      total = scrollPages.length || 1;
      current = scrollCurrentIndex();
    } else if (pageFlip) {
      try {
        total = pageFlip.getPageCount() || 1;
        current = pageFlip.getCurrentPageIndex();
      } catch (e) { /* noop */ }
    }

    pageLabel.textContent = (current + 1) + ' / ' + total;
    prevBtn.disabled = current <= 0;
    nextBtn.disabled = current >= total - 1;

    if (dockHint) {
      dockHint.textContent = scrollMode
        ? 'Deslizá horizontalmente'
        : (isNarrow() ? 'Deslizá para pasar página' : 'Arrastrá la esquina o flechas');
    }
  }

  function scrollCurrentIndex() {
    if (!scrollPages.length) return 0;
    var x = rail.scrollLeft;
    var w = rail.clientWidth || 1;
    return Math.max(0, Math.min(scrollPages.length - 1, Math.round(x / w)));
  }

  function scrollGoTo(i, smooth) {
    if (!scrollPages.length) return;
    i = Math.max(0, Math.min(scrollPages.length - 1, i));
    rail.scrollTo({
      left: i * rail.clientWidth,
      behavior: smooth === false ? 'auto' : 'smooth'
    });
    window.setTimeout(updateChrome, smooth === false ? 0 : 260);
  }

  function destroyBook() {
    if (pageFlip) {
      try { pageFlip.destroy(); } catch (e) { /* noop */ }
      pageFlip = null;
    }
    var old = document.getElementById('book');
    var fresh = document.createElement('div');
    fresh.id = 'book';
    if (old && old.parentNode) old.parentNode.replaceChild(fresh, old);
    else if (bookWrap) bookWrap.appendChild(fresh);
  }

  function hideAllViews() {
    loader.hidden = false;
    bookWrap.hidden = true;
    bookWrap.classList.remove('is-mounting');
    rail.hidden = true;
    rail.setAttribute('aria-hidden', 'true');
    bookError.hidden = true;
    scrollMode = false;
    scrollPages = [];
    rail.innerHTML = '';
  }

  function finishLoading() {
    clearWatchdog();
    loader.hidden = true;
  }

  function showFlipBook() {
    finishLoading();
    bookWrap.hidden = false;
    bookWrap.classList.remove('is-mounting');
    rail.hidden = true;
    rail.setAttribute('aria-hidden', 'true');
    bookError.hidden = true;
    scrollMode = false;
  }

  function showScrollBook() {
    finishLoading();
    bookWrap.hidden = true;
    rail.hidden = false;
    rail.removeAttribute('aria-hidden');
    bookError.hidden = true;
    scrollMode = true;
  }

  function showError() {
    finishLoading();
    bookWrap.hidden = true;
    rail.hidden = true;
    bookError.hidden = false;
    scrollMode = false;
  }

  function waitFlipInit(flip) {
    return new Promise(function (resolve) {
      var done = false;
      function finish() {
        if (done) return;
        done = true;
        resolve();
      }
      try {
        flip.on('init', finish);
      } catch (e) {
        finish();
        return;
      }
      window.setTimeout(finish, 1500);
    });
  }

  function mountFlipBook(entries, token) {
    return new Promise(function (resolve, reject) {
      try {
        destroyBook();
        var ratio = pageRatio(entries);
        var size = bookSize(ratio);
        var images = entries.map(function (e) { return imageUrl(e.src); });

        if (images.length % 2 === 1) {
          images.push(blankPageDataUrl(800, Math.round(800 * ratio)));
        }

        setLoaderMsg('Cargando páginas…');
        preloadImages(images.slice(0, Math.min(3, images.length)))
          .then(function () {
            if (token !== loadToken) throw new Error('cancelled');
            return preloadImages(images);
          })
          .then(function () {
            if (token !== loadToken) throw new Error('cancelled');
            setLoaderMsg('Armando el libro…');
            bookWrap.hidden = false;
            bookWrap.classList.add('is-mounting');

            var el = document.getElementById('book');
            pageFlip = new window.St.PageFlip(el, {
              width: size.width,
              height: size.height,
              size: 'fixed',
              minWidth: size.width,
              maxWidth: size.width,
              minHeight: size.height,
              maxHeight: size.height,
              showCover: false,
              maxShadowOpacity: 0.42,
              flippingTime: 650,
              mobileScrollSupport: false,
              usePortrait: true,
              swipeDistance: 24,
              useMouseEvents: true,
              autoSize: false
            });

            pageFlip.on('flip', updateChrome);
            pageFlip.loadFromImages(images);
            return waitFlipInit(pageFlip);
          })
          .then(function () {
            if (token !== loadToken) throw new Error('cancelled');
            showFlipBook();
            updateChrome();
            resolve();
          })
          .catch(reject);
      } catch (e) {
        reject(e);
      }
    });
  }

  function mountScrollBook(entries, token) {
    if (token !== undefined && token !== loadToken) {
      return Promise.reject(new Error('cancelled'));
    }
    destroyBook();
    rail.innerHTML = '';
    scrollPages = [];

    entries.forEach(function (entry, n) {
      var slide = document.createElement('article');
      slide.className = 'page is-' + (entry.orientation || 'portrait');
      slide.setAttribute('aria-label', 'Página ' + (n + 1));

      var img = document.createElement('img');
      img.src = imageUrl(entry.src);
      img.alt = 'Carta Olivo · página ' + (n + 1);
      img.decoding = 'async';
      img.loading = n === 0 ? 'eager' : 'lazy';
      img.draggable = false;
      if (entry.w && entry.h) {
        img.width = entry.w;
        img.height = entry.h;
      }

      slide.appendChild(img);
      rail.appendChild(slide);
      scrollPages.push(slide);
    });

    showScrollBook();
    scrollGoTo(0, false);
    updateChrome();
    return Promise.resolve();
  }

  function mountBook(entries, token) {
    builtNarrow = isNarrow();

    if (builtNarrow || !hasFlipLib()) {
      return mountScrollBook(entries, token);
    }

    return mountFlipBook(entries, token).catch(function (err) {
      if (err && err.message === 'cancelled') throw err;
      return mountScrollBook(entries, token);
    });
  }

  function showMenu(key) {
    var token = ++loadToken;
    currentKey = key;
    setTabs(key);
    hideAllViews();
    setLoaderMsg('Armando el libro…');

    clearWatchdog();
    mountWatchdog = window.setTimeout(function () {
      if (token !== loadToken) return;
      var fallbackEntries = normalizeEntries((manifest && manifest[key]) || []);
      if (!fallbackEntries.length) {
        showError();
        return;
      }
      mountScrollBook(fallbackEntries, token);
    }, MOUNT_TIMEOUT_MS);

    var entries = normalizeEntries((manifest && manifest[key]) || []);
    if (!entries.length) {
      pageLabel.textContent = '—';
      showError();
      return;
    }

    waitLayout().then(function () {
      if (token !== loadToken) return;
      return mountBook(entries, token);
    }).catch(function (err) {
      if (token !== loadToken || (err && err.message === 'cancelled')) return;
      return mountScrollBook(entries, token);
    }).finally(function () {
      if (token !== loadToken) return;
      finishLoading();
    });
  }

  function loadManifest() {
    return fetch('./pages/manifest.json?v=' + VERSION, { cache: 'no-cache' })
      .then(function (r) {
        if (!r.ok) throw new Error('manifest');
        return r.json();
      });
  }

  function flip(dir) {
    if (scrollMode) {
      scrollGoTo(scrollCurrentIndex() + dir);
      return;
    }
    if (!pageFlip) return;
    try {
      if (dir > 0) pageFlip.flipNext('bottom');
      else pageFlip.flipPrev('bottom');
    } catch (e) { /* noop */ }
  }

  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      var key = tab.getAttribute('data-menu');
      if (key !== currentKey) showMenu(key);
    });
  });

  prevBtn.addEventListener('click', function () { flip(-1); });
  nextBtn.addEventListener('click', function () { flip(1); });

  rail.addEventListener('scroll', function () {
    if (!scrollMode) return;
    window.clearTimeout(rail._t);
    rail._t = window.setTimeout(updateChrome, 60);
  }, { passive: true });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight' || e.key === 'PageDown') flip(1);
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') flip(-1);
  });

  var resizeTimer;
  window.addEventListener('resize', function () {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(function () {
      if (!manifest || !manifest[currentKey]) return;
      var narrowNow = isNarrow();
      if (narrowNow !== builtNarrow) {
        showMenu(currentKey);
        return;
      }
      if (scrollMode) {
        scrollGoTo(scrollCurrentIndex(), false);
        updateChrome();
        return;
      }
      if (pageFlip) {
        var idx = pageFlip.getCurrentPageIndex();
        var resizeToken = loadToken;
        mountFlipBook(normalizeEntries(manifest[currentKey]), resizeToken)
          .then(function () {
            if (resizeToken !== loadToken) return;
            if (pageFlip) pageFlip.turnToPage(idx);
            updateChrome();
          })
          .catch(function (err) {
            if (resizeToken !== loadToken || (err && err.message === 'cancelled')) return;
            mountScrollBook(normalizeEntries(manifest[currentKey]), resizeToken);
          });
      }
    }, 180);
  });

  document.getElementById('backBtn').addEventListener('click', function (e) {
    if (window.history.length > 1 && document.referrer) {
      e.preventDefault();
      window.history.back();
    }
  });

  loadManifest()
    .then(function (data) {
      manifest = data;
      showMenu(keyFromUrl());
    })
    .catch(function () {
      pageLabel.textContent = 'Error';
      showError();
    });
})();
