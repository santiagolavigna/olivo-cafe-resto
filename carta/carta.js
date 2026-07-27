(function () {
  'use strict';

  var MENUS = {
    cafeteria: { label: 'Cafetería', file: '../assets/menu-cafeteria.pdf' },
    restaurante: { label: 'Restaurante', file: '../assets/menu-restaurante.pdf' }
  };

  var stage = document.getElementById('stage');
  var bookWrap = document.getElementById('bookWrap');
  var loader = document.getElementById('loader');
  var loaderText = document.querySelector('#loader p');
  var controls = document.getElementById('controls');
  var pageInfo = document.getElementById('pageInfo');
  var bookError = document.getElementById('bookError');
  var pdfLink = document.getElementById('pdfLink');
  var errorPdfLink = document.getElementById('errorPdfLink');
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.carta-tab'));
  var retryBtn = document.getElementById('retryBtn');

  var pageFlip = null;
  var simpleMode = false;
  var simpleIndex = 0;
  var simpleImages = [];
  var loadToken = 0;
  var loading = false;
  var currentKey = 'cafeteria';
  var builtNarrow = null;
  var watchdog = null;
  var PAPER = '#fdfbf2';
  var LOAD_TIMEOUT_MS = 16000;
  var cache = {};

  function configurePdf() {
    if (!window.pdfjsLib) return;
    try { window.pdfjsLib.GlobalWorkerOptions.workerSrc = ''; } catch (e) { /* noop */ }
  }

  function isNarrowScreen() {
    return stage.clientWidth < 760;
  }

  function menuKeyFromUrl() {
    var q = (new URLSearchParams(window.location.search).get('carta') || '').toLowerCase();
    if (q.indexOf('rest') === 0 || q === 'resto') return 'restaurante';
    return 'cafeteria';
  }

  function cacheKey(key, overlap) {
    return key + ':' + (overlap ? 'n' : 'w');
  }

  function setTabs(key) {
    tabs.forEach(function (tab) {
      tab.classList.toggle('is-active', tab.getAttribute('data-menu') === key);
    });
    pdfLink.href = MENUS[key].file;
    errorPdfLink.href = MENUS[key].file;
    try {
      var url = new URL(window.location.href);
      url.searchParams.set('carta', key);
      window.history.replaceState(null, '', url.toString());
    } catch (e) { /* noop */ }
  }

  function setLoaderMsg(msg) {
    if (loaderText) loaderText.textContent = msg;
  }

  function clearWatchdog() {
    if (watchdog) {
      clearTimeout(watchdog);
      watchdog = null;
    }
  }

  function showError() {
    clearWatchdog();
    loading = false;
    loader.hidden = true;
    bookWrap.hidden = true;
    bookWrap.classList.remove('is-mounting');
    controls.hidden = true;
    bookError.hidden = false;
  }

  function showBook() {
    clearWatchdog();
    loading = false;
    loader.hidden = true;
    bookError.hidden = true;
    bookWrap.hidden = false;
    bookWrap.classList.remove('is-mounting');
    controls.hidden = false;
  }

  function waitForLibs(timeoutMs) {
    return new Promise(function (resolve, reject) {
      var start = Date.now();
      (function tick() {
        if (window.pdfjsLib && window.St && window.St.PageFlip) {
          configurePdf();
          resolve();
          return;
        }
        if (Date.now() - start > timeoutMs) {
          reject(new Error('libs'));
          return;
        }
        setTimeout(tick, 60);
      })();
    });
  }

  function withTimeout(promise, ms) {
    return new Promise(function (resolve, reject) {
      var done = false;
      var timer = setTimeout(function () {
        if (done) return;
        done = true;
        reject(new Error('timeout'));
      }, ms);
      promise.then(function (value) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(value);
      }, function (err) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  function waitLayout() {
    return new Promise(function (resolve) {
      requestAnimationFrame(function () {
        requestAnimationFrame(resolve);
      });
    });
  }

  function blankPageDataUrl(width, height) {
    var c = document.createElement('canvas');
    c.width = Math.max(2, width || 800);
    c.height = Math.max(2, height || 1100);
    var ctx = c.getContext('2d');
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.7);
  }

  function renderPdfToImages(file, token, overlap) {
    return window.pdfjsLib.getDocument({
      url: file,
      withCredentials: false,
      disableWorker: true,
      isEvalSupported: false,
      useSystemFonts: true
    }).promise.then(function (pdf) {
      var pages = [];
      var split = false;
      var dpr = Math.min(window.devicePixelRatio || 1, 1.1);
      var baseTarget = Math.round((overlap ? 500 : 620) * dpr);

      function renderPage(n) {
        if (token !== loadToken) return Promise.reject(new Error('cancelled'));
        setLoaderMsg('Preparando página ' + n + ' de ' + pdf.numPages + '…');
        return pdf.getPage(n).then(function (page) {
          var base = page.getViewport({ scale: 1 });
          if (n === 1) split = base.height / base.width < 1.05;
          var targetW = (split ? 2 : 1) * Math.min(860, Math.max(460, baseTarget));
          var viewport = page.getViewport({ scale: targetW / base.width });
          var canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.floor(viewport.width));
          canvas.height = Math.max(1, Math.floor(viewport.height));
          var ctx = canvas.getContext('2d', { alpha: false });
          ctx.fillStyle = PAPER;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          return page.render({ canvasContext: ctx, viewport: viewport }).promise.then(function () {
            pages.push(canvas);
          });
        });
      }

      var chain = Promise.resolve();
      for (var i = 1; i <= pdf.numPages; i++) {
        (function (n) { chain = chain.then(function () { return renderPage(n); }); })(i);
      }

      return chain.then(function () {
        if (!pages.length) throw new Error('empty');
        if (!split) {
          return {
            images: pages.map(function (c) { return c.toDataURL('image/jpeg', 0.72); }),
            ratio: pages[0].height / pages[0].width
          };
        }

        var frac = overlap ? 0.62 : 0.5;
        var images = [];
        pages.forEach(function (canvas) {
          var halfW = Math.floor(canvas.width * frac);
          [0, canvas.width - halfW].forEach(function (srcX) {
            var half = document.createElement('canvas');
            half.width = halfW;
            half.height = canvas.height;
            var hctx = half.getContext('2d', { alpha: false });
            hctx.drawImage(canvas, srcX, 0, halfW, canvas.height, 0, 0, halfW, canvas.height);
            images.push(half.toDataURL('image/jpeg', 0.72));
          });
        });

        return {
          images: images,
          ratio: pages[0].height / Math.max(1, Math.floor(pages[0].width * frac))
        };
      });
    });
  }

  function bookSize(ratio) {
    var safeRatio = ratio > 0.2 && isFinite(ratio) ? ratio : 1.414;
    var stageW = Math.max(stage.clientWidth - 16, 260);
    var stageH = Math.max(stage.clientHeight - 16, 320);
    var narrow = isNarrowScreen();
    var maxW = Math.min(
      520,
      Math.floor(stageH / safeRatio),
      narrow ? stageW : Math.floor(stageW / 2)
    );
    maxW = Math.max(180, maxW);
    var minW = Math.min(200, maxW);
    var baseW = Math.max(minW, Math.min(maxW, Math.floor(stageW * 0.9)));
    return {
      width: baseW,
      height: Math.max(240, Math.floor(baseW * safeRatio))
    };
  }

  function updatePageInfo() {
    if (simpleMode) {
      pageInfo.textContent = (simpleIndex + 1) + ' / ' + simpleImages.length;
      return;
    }
    if (!pageFlip) return;
    try {
      pageInfo.textContent = (pageFlip.getCurrentPageIndex() + 1) + ' / ' + pageFlip.getPageCount();
    } catch (e) { /* noop */ }
  }

  function destroyBook() {
    if (pageFlip) {
      try { pageFlip.destroy(); } catch (e) { /* noop */ }
      pageFlip = null;
    }
    simpleMode = false;
    simpleImages = [];
    simpleIndex = 0;
    var old = document.getElementById('book');
    var fresh = document.createElement('div');
    fresh.id = 'book';
    if (old && old.parentNode) old.parentNode.replaceChild(fresh, old);
    else bookWrap.appendChild(fresh);
    return fresh;
  }

  function mountSimple(images, ratio) {
    var el = destroyBook();
    simpleMode = true;
    simpleImages = images.slice();
    simpleIndex = 0;
    el.className = 'carta-simple';
    var size = bookSize(ratio);
    el.style.width = size.width + 'px';
    el.style.maxWidth = '100%';
    el.innerHTML = '<img alt="Página de la carta" draggable="false" />';
    var img = el.querySelector('img');
    img.src = simpleImages[0];
    showBook();
    updatePageInfo();
  }

  function mountFlip(images, ratio) {
    var el = destroyBook();
    var size = bookSize(ratio);
    var pages = images.slice();
    if (pages.length % 2 === 1) {
      pages.push(blankPageDataUrl(800, Math.round(800 * ratio)));
    }

    /* PageFlip se rompe si el contenedor está display:none.
       Lo mostramos invisible, montamos, y recién ahí revelamos. */
    bookWrap.hidden = false;
    bookWrap.classList.add('is-mounting');

    pageFlip = new window.St.PageFlip(el, {
      width: size.width,
      height: size.height,
      size: 'fixed',
      minWidth: size.width,
      maxWidth: size.width,
      minHeight: size.height,
      maxHeight: size.height,
      showCover: false,
      maxShadowOpacity: 0.4,
      flippingTime: 700,
      mobileScrollSupport: false,
      usePortrait: true,
      autoSize: false
    });
    pageFlip.loadFromImages(pages);
    pageFlip.on('flip', updatePageInfo);
    showBook();
    updatePageInfo();
  }

  function mountBook(result) {
    if (!result || !result.images || !result.images.length) {
      throw new Error('empty');
    }
    try {
      if (!window.St || !window.St.PageFlip) {
        mountSimple(result.images, result.ratio);
        return;
      }
      mountFlip(result.images, result.ratio);
    } catch (e) {
      mountSimple(result.images, result.ratio);
    }
  }

  function loadMenu(key, opts) {
    opts = opts || {};
    var token = ++loadToken;
    var overlap = isNarrowScreen();
    var keyId = cacheKey(key, overlap);
    currentKey = key;
    builtNarrow = overlap;
    loading = true;
    setTabs(key);
    loader.hidden = false;
    bookWrap.hidden = true;
    bookWrap.classList.remove('is-mounting');
    controls.hidden = true;
    bookError.hidden = true;
    setLoaderMsg('Preparando la carta…');

    clearWatchdog();
    watchdog = setTimeout(function () {
      if (token === loadToken && loading) showError();
    }, LOAD_TIMEOUT_MS + 3000);

    var work;
    if (cache[keyId] && !opts.force) {
      work = waitLayout().then(function () {
        if (token !== loadToken) return;
        setLoaderMsg('Armando el libro…');
        mountBook(cache[keyId]);
      });
    } else {
      work = waitForLibs(10000)
        .then(function () { return waitLayout(); })
        .then(function () {
          if (token !== loadToken) return null;
          return withTimeout(renderPdfToImages(MENUS[key].file, token, overlap), LOAD_TIMEOUT_MS);
        })
        .then(function (result) {
          if (token !== loadToken) return;
          if (!result) throw new Error('empty');
          cache[keyId] = result;
          setLoaderMsg('Armando el libro…');
          mountBook(result);
        });
    }

    work.catch(function (err) {
      if (token !== loadToken) return;
      if (err && err.message === 'cancelled') return;
      if (!opts.retried) {
        setLoaderMsg('Reintentando…');
        setTimeout(function () {
          if (token !== loadToken) return;
          loadMenu(key, { force: true, retried: true });
        }, 350);
        return;
      }
      showError();
    });
  }

  function flip(dir) {
    if (loading) return;
    if (simpleMode) {
      if (!simpleImages.length) return;
      simpleIndex = Math.max(0, Math.min(simpleImages.length - 1, simpleIndex + (dir > 0 ? 1 : -1)));
      var img = document.querySelector('#book img');
      if (img) img.src = simpleImages[simpleIndex];
      updatePageInfo();
      return;
    }
    if (!pageFlip) return;
    try {
      if (dir > 0) pageFlip.flipNext();
      else pageFlip.flipPrev();
    } catch (e) { /* noop */ }
  }

  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      var key = tab.getAttribute('data-menu');
      if (key === currentKey) {
        if (!bookError.hidden) loadMenu(key, { force: true });
        return;
      }
      loadMenu(key);
    });
  });

  if (retryBtn) {
    retryBtn.addEventListener('click', function () {
      loadMenu(currentKey, { force: true });
    });
  }

  document.getElementById('prevBtn').addEventListener('click', function () { flip(-1); });
  document.getElementById('nextBtn').addEventListener('click', function () { flip(1); });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown') flip(1);
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') flip(-1);
  });

  var lastWheel = 0;
  window.addEventListener('wheel', function (e) {
    var now = Date.now();
    if (now - lastWheel < 700 || Math.abs(e.deltaY) < 12) return;
    lastWheel = now;
    flip(e.deltaY > 0 ? 1 : -1);
  }, { passive: true });

  var touchStartX = 0, touchStartY = 0, touchTracking = false;
  stage.addEventListener('touchstart', function (e) {
    if (e.touches.length !== 1) { touchTracking = false; return; }
    touchTracking = true;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  stage.addEventListener('touchend', function (e) {
    if (!touchTracking) return;
    touchTracking = false;
    var dx = e.changedTouches[0].clientX - touchStartX;
    var dy = e.changedTouches[0].clientY - touchStartY;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.15) {
      flip(dx < 0 ? 1 : -1);
      return;
    }
    if (Math.abs(dy) > 60 && Math.abs(dy) > Math.abs(dx) * 1.5) {
      flip(dy < 0 ? 1 : -1);
    }
  }, { passive: true });

  var narrowQuery = window.matchMedia('(max-width: 759px)');
  function onBreakpointChange() {
    if (loading) return;
    if (builtNarrow === null) return;
    if (builtNarrow === isNarrowScreen()) return;
    loadMenu(currentKey);
  }
  if (narrowQuery.addEventListener) narrowQuery.addEventListener('change', onBreakpointChange);
  else if (narrowQuery.addListener) narrowQuery.addListener(onBreakpointChange);

  document.getElementById('cartaBack').addEventListener('click', function (e) {
    if (window.history.length > 1 && document.referrer) {
      e.preventDefault();
      window.history.back();
    }
  });

  loadMenu(menuKeyFromUrl());
})();
