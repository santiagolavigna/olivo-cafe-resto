(function () {
  'use strict';

  var VERSION = '20260728f';
  var PDFS = {
    cafeteria: '../assets/menu-cafeteria.pdf',
    restaurante: '../assets/menu-restaurante.pdf'
  };
  var FALLBACK = {
    cafeteria: [
      { src: './pages/cafeteria/01.jpg', orientation: 'landscape' },
      { src: './pages/cafeteria/02.jpg', orientation: 'landscape' },
      { src: './pages/cafeteria/03.jpg', orientation: 'landscape' }
    ],
    restaurante: [
      { src: './pages/restaurante/01.jpg', orientation: 'portrait' },
      { src: './pages/restaurante/02.jpg', orientation: 'portrait' },
      { src: './pages/restaurante/03.jpg', orientation: 'portrait' },
      { src: './pages/restaurante/04.jpg', orientation: 'portrait' },
      { src: './pages/restaurante/05.jpg', orientation: 'portrait' },
      { src: './pages/restaurante/06.jpg', orientation: 'portrait' },
      { src: './pages/restaurante/07.jpg', orientation: 'portrait' },
      { src: './pages/restaurante/08.jpg', orientation: 'portrait' },
      { src: './pages/restaurante/09.jpg', orientation: 'portrait' },
      { src: './pages/restaurante/10.jpg', orientation: 'portrait' },
      { src: './pages/restaurante/11.jpg', orientation: 'portrait' }
    ]
  };

  var viewer = document.getElementById('viewer');
  var rail = document.getElementById('rail');
  var bookWrap = document.getElementById('bookWrap');
  var bookError = document.getElementById('bookError');
  var errorPdf = document.getElementById('errorPdf');
  var pageLabel = document.getElementById('pageLabel');
  var prevBtn = document.getElementById('prevBtn');
  var nextBtn = document.getElementById('nextBtn');
  var pdfBtn = document.getElementById('pdfBtn');
  var dockHint = document.getElementById('dockHint');
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.top__tab'));

  var pages = [];
  var currentKey = 'cafeteria';
  var currentEntries = [];
  var manifest = null;
  var pageFlip = null;
  var flipMode = false;
  var flipReady = false;
  var loadToken = 0;
  var flipLibPromise = null;

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
    if (errorPdf) errorPdf.href = PDFS[key];
    setUrl(key);
  }

  function normalizeEntries(list) {
    if (!list || !list.length) return [];
    return list.map(function (item) {
      if (typeof item === 'string') {
        return { src: item, orientation: 'portrait' };
      }
      return {
        src: item.src,
        orientation: item.orientation || 'portrait',
        w: item.w,
        h: item.h
      };
    });
  }

  function imageUrl(src) {
    return src + (src.indexOf('?') >= 0 ? '&' : '?') + 'v=' + VERSION;
  }

  function pageRatio(entries) {
    var first = entries[0];
    if (first && first.w && first.h) return first.h / first.w;
    if (first && first.orientation === 'landscape') return 0.707;
    return 1.414;
  }

  function bookSize(ratio) {
    var stageW = Math.max(viewer.clientWidth - 8, 240);
    var stageH = Math.max(viewer.clientHeight - 8, 280);
    var safeRatio = ratio > 0.2 && isFinite(ratio) ? ratio : 1.414;
    var narrow = isNarrow();

    if (narrow) {
      var w = Math.max(200, Math.floor(stageW * 0.94));
      var h = Math.floor(w * safeRatio);
      if (h > stageH * 0.98) {
        h = Math.floor(stageH * 0.98);
        w = Math.floor(h / safeRatio);
      }
      return { width: w, height: Math.max(220, h) };
    }

    var maxSpreadW = stageW * 0.98;
    var maxPageH = stageH * 0.98;
    var pageW = Math.min(maxSpreadW / 2, maxPageH / safeRatio);
    pageW = Math.max(220, Math.floor(pageW));
    return {
      width: pageW,
      height: Math.max(240, Math.floor(pageW * safeRatio))
    };
  }

  function blankPage(width, height) {
    var c = document.createElement('canvas');
    c.width = Math.max(2, width || 800);
    c.height = Math.max(2, height || 1100);
    var ctx = c.getContext('2d');
    ctx.fillStyle = '#f7f4ea';
    ctx.fillRect(0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.7);
  }

  function loadFlipLib() {
    if (hasFlipLib()) return Promise.resolve(true);
    if (flipLibPromise) return flipLibPromise;

    flipLibPromise = new Promise(function (resolve) {
      var done = false;
      var timer = window.setTimeout(function () {
        if (done) return;
        done = true;
        resolve(false);
      }, 4000);

      var s = document.createElement('script');
      s.src = './vendor/page-flip.browser.js?v=' + VERSION;
      s.async = true;
      s.onload = function () {
        if (done) return;
        done = true;
        window.clearTimeout(timer);
        resolve(hasFlipLib());
      };
      s.onerror = function () {
        if (done) return;
        done = true;
        window.clearTimeout(timer);
        resolve(false);
      };
      document.head.appendChild(s);
    });

    return flipLibPromise;
  }

  function railIndex() {
    if (!pages.length) return 0;
    var w = rail.clientWidth || 1;
    return Math.max(0, Math.min(pages.length - 1, Math.round(rail.scrollLeft / w)));
  }

  function updateChrome() {
    var i = 0;
    var total = 1;

    if (flipMode && pageFlip) {
      try {
        i = pageFlip.getCurrentPageIndex();
        total = pageFlip.getPageCount() || 1;
      } catch (e) { /* noop */ }
    } else {
      i = railIndex();
      total = Math.max(pages.length, 1);
    }

    pageLabel.textContent = (pages.length || flipMode) ? (i + 1) + ' / ' + total : '—';
    prevBtn.disabled = i <= 0;
    nextBtn.disabled = i >= total - 1;

    if (dockHint) {
      if (flipMode) {
        dockHint.textContent = isNarrow()
          ? 'Deslizá para pasar página'
          : 'Arrastrá la esquina o flechas';
      } else {
        dockHint.textContent = 'Deslizá para pasar';
      }
    }
  }

  function goRail(i, smooth) {
    if (!pages.length) return;
    i = Math.max(0, Math.min(pages.length - 1, i));
    rail.scrollTo({
      left: i * rail.clientWidth,
      behavior: smooth === false ? 'auto' : 'smooth'
    });
    window.setTimeout(updateChrome, smooth === false ? 0 : 280);
  }

  function destroyFlip() {
    if (pageFlip) {
      try { pageFlip.destroy(); } catch (e) { /* noop */ }
      pageFlip = null;
    }
    var old = document.getElementById('book');
    var fresh = document.createElement('div');
    fresh.id = 'book';
    if (old && old.parentNode) old.parentNode.replaceChild(fresh, old);
    else bookWrap.appendChild(fresh);
    flipMode = false;
  }

  function showRail() {
    destroyFlip();
    bookWrap.hidden = true;
    rail.hidden = false;
    bookError.hidden = true;
    flipMode = false;
  }

  function showFlip() {
    rail.hidden = true;
    bookWrap.hidden = false;
    bookError.hidden = true;
    flipMode = true;
  }

  function buildRail(entries) {
    showRail();
    rail.innerHTML = '';
    pages = [];

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
      pages.push(slide);
    });

    goRail(0, false);
    updateChrome();
  }

  function mountFlip(entries, startPage) {
    if (!hasFlipLib()) return false;

    try {
      destroyFlip();
      var ratio = pageRatio(entries);
      var size = bookSize(ratio);
      var images = entries.map(function (e) { return imageUrl(e.src); });
      if (images.length % 2 === 1) {
        images.push(blankPage(800, Math.round(800 * ratio)));
      }

      /* Mount while visible — PageFlip breaks if parent is display:none */
      bookWrap.hidden = false;
      rail.hidden = true;

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

      if (startPage > 0) {
        try { pageFlip.turnToPage(Math.min(startPage, images.length - 1)); } catch (e) { /* noop */ }
      }

      showFlip();
      updateChrome();
      return true;
    } catch (e) {
      destroyFlip();
      buildRail(entries);
      return false;
    }
  }

  function tryUpgradeToFlip(token) {
    if (token !== loadToken) return;
    if (!currentEntries.length) return;

    loadFlipLib().then(function (ok) {
      if (!ok || token !== loadToken) return;
      flipReady = true;
      var idx = flipMode && pageFlip ? pageFlip.getCurrentPageIndex() : railIndex();
      mountFlip(currentEntries, idx);
    });
  }

  function showMenu(key) {
    var token = ++loadToken;
    currentKey = key;
    setTabs(key);
    bookError.hidden = true;

    var entries = normalizeEntries(
      (manifest && manifest[key]) || FALLBACK[key] || []
    );
    currentEntries = entries;

    if (!entries.length) {
      pageLabel.textContent = '—';
      bookError.hidden = false;
      rail.innerHTML = '';
      pages = [];
      destroyFlip();
      return;
    }

    /* Always show pages instantly via carousel — never block on flip lib */
    buildRail(entries);

    /* Upgrade to book effect in background (local vendor, no CDN) */
    window.requestAnimationFrame(function () {
      tryUpgradeToFlip(token);
    });
  }

  function flip(dir) {
    if (flipMode && pageFlip) {
      try {
        if (dir > 0) pageFlip.flipNext('bottom');
        else pageFlip.flipPrev('bottom');
      } catch (e) { /* noop */ }
      return;
    }
    goRail(railIndex() + dir);
  }

  function loadManifest() {
    return fetch('./pages/manifest.json?v=' + VERSION, { cache: 'no-cache' })
      .then(function (r) {
        if (!r.ok) throw new Error('manifest');
        return r.json();
      });
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
    if (flipMode) return;
    window.clearTimeout(rail._t);
    rail._t = window.setTimeout(updateChrome, 50);
  }, { passive: true });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight' || e.key === 'PageDown') flip(1);
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') flip(-1);
  });

  var resizeTimer;
  window.addEventListener('resize', function () {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(function () {
      if (!currentEntries.length) return;
      if (flipMode && pageFlip && hasFlipLib()) {
        var idx = pageFlip.getCurrentPageIndex();
        mountFlip(currentEntries, idx);
      } else {
        goRail(railIndex(), false);
      }
      updateChrome();
    }, 180);
  });

  document.getElementById('backBtn').addEventListener('click', function (e) {
    if (window.history.length > 1 && document.referrer) {
      e.preventDefault();
      window.history.back();
    }
  });

  showMenu(keyFromUrl());

  loadManifest()
    .then(function (data) {
      manifest = data;
      showMenu(currentKey);
    })
    .catch(function () {
      if (!pages.length && !flipMode) bookError.hidden = false;
    });
})();
