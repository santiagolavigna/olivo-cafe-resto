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
  var loadToken = 0;
  var loading = false;
  var currentKey = 'cafeteria';
  var builtNarrow = null;
  var watchdog = null;
  var PAPER = '#fdfbf2';
  var LOAD_TIMEOUT_MS = 18000;
  var cache = {};

  function configurePdf() {
    if (!window.pdfjsLib) return;
    /* Worker remoto falla a veces (CDN / mobile). Render en main thread. */
    try {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = '';
    } catch (e) { /* noop */ }
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
    controls.hidden = true;
    bookError.hidden = false;
  }

  function showBook() {
    clearWatchdog();
    loading = false;
    loader.hidden = true;
    bookError.hidden = true;
    bookWrap.hidden = false;
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
      var dpr = Math.min(window.devicePixelRatio || 1, 1.15);
      var baseTarget = Math.round((overlap ? 520 : 640) * dpr);

      function renderPage(n) {
        if (token !== loadToken) return Promise.reject(new Error('cancelled'));
        setLoaderMsg('Preparando página ' + n + ' de ' + pdf.numPages + '…');
        return pdf.getPage(n).then(function (page) {
          var base = page.getViewport({ scale: 1 });
          if (n === 1) split = base.height / base.width < 1.05;
          var targetW = (split ? 2 : 1) * Math.min(900, Math.max(480, baseTarget));
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
            images: pages.map(function (c) { return c.toDataURL('image/jpeg', 0.74); }),
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
            images.push(half.toDataURL('image/jpeg', 0.74));
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
      560,
      Math.floor(stageH / safeRatio),
      narrow ? stageW : Math.floor(stageW / 2)
    );
    maxW = Math.max(180, maxW);
    var minW = Math.min(220, maxW);
    var baseW = Math.max(minW, Math.min(maxW, Math.floor(stageW * 0.92)));
    return {
      width: baseW,
      height: Math.max(240, Math.floor(baseW * safeRatio)),
      minWidth: minW,
      maxWidth: maxW,
      minHeight: Math.floor(minW * safeRatio),
      maxHeight: Math.floor(maxW * safeRatio)
    };
  }

  function updatePageInfo() {
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
    var old = document.getElementById('book');
    if (!old || !old.parentNode) {
      var wrap = bookWrap || stage;
      var freshEmpty = document.createElement('div');
      freshEmpty.id = 'book';
      wrap.appendChild(freshEmpty);
      return freshEmpty;
    }
    var fresh = document.createElement('div');
    fresh.id = 'book';
    old.parentNode.replaceChild(fresh, old);
    return fresh;
  }

  function mountBook(result) {
    try {
      var el = destroyBook();
      var size = bookSize(result.ratio);
      pageFlip = new window.St.PageFlip(el, {
        width: size.width,
        height: size.height,
        size: 'stretch',
        minWidth: size.minWidth,
        maxWidth: size.maxWidth,
        minHeight: size.minHeight,
        maxHeight: size.maxHeight,
        showCover: false,
        maxShadowOpacity: 0.45,
        flippingTime: 750,
        mobileScrollSupport: false,
        usePortrait: true,
        autoSize: true
      });
      pageFlip.loadFromImages(result.images);
      pageFlip.on('flip', updatePageInfo);
      showBook();
      updatePageInfo();
    } catch (e) {
      throw e;
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
    controls.hidden = true;
    bookError.hidden = true;
    setLoaderMsg('Preparando la carta…');

    clearWatchdog();
    watchdog = setTimeout(function () {
      if (token === loadToken && loading) showError();
    }, LOAD_TIMEOUT_MS + 4000);

    var start = Promise.resolve();
    if (cache[keyId] && !opts.force) {
      start = waitLayout().then(function () {
        if (token !== loadToken) return null;
        setLoaderMsg('Armando el libro…');
        mountBook(cache[keyId]);
        return null;
      });
    } else {
      start = waitForLibs(10000)
        .then(function () { return waitLayout(); })
        .then(function () {
          if (token !== loadToken) return null;
          return withTimeout(renderPdfToImages(MENUS[key].file, token, overlap), LOAD_TIMEOUT_MS);
        })
        .then(function (result) {
          if (token !== loadToken) return null;
          if (!result) throw new Error('empty');
          cache[keyId] = result;
          setLoaderMsg('Armando el libro…');
          mountBook(result);
          return null;
        });
    }

    start.catch(function (err) {
      if (token !== loadToken) return;
      if (err && err.message === 'cancelled') return;
      if (!opts.retried) {
        setLoaderMsg('Reintentando…');
        setTimeout(function () {
          if (token !== loadToken) return;
          loadMenu(key, { force: true, retried: true });
        }, 400);
        return;
      }
      showError();
    });
  }

  function flip(dir) {
    if (!pageFlip || loading) return;
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

  /* Solo recargar al cruzar mobile/desktop, no en cada resize del browser chrome. */
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
