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

  var pageFlip = null;
  var loadToken = 0;
  var currentKey = 'cafeteria';
  var builtNarrow = null;
  var PAPER = '#fdfbf2';
  var LOAD_TIMEOUT_MS = 22000;

  function setWorker() {
    if (!window.pdfjsLib) return;
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  function isNarrowScreen() {
    return stage.clientWidth < 760;
  }

  function menuKeyFromUrl() {
    var q = (new URLSearchParams(window.location.search).get('carta') || '').toLowerCase();
    if (q.indexOf('rest') === 0 || q === 'resto') return 'restaurante';
    return 'cafeteria';
  }

  function setTabs(key) {
    tabs.forEach(function (tab) {
      tab.classList.toggle('is-active', tab.getAttribute('data-menu') === key);
    });
    pdfLink.href = MENUS[key].file;
    errorPdfLink.href = MENUS[key].file;
    var url = new URL(window.location.href);
    url.searchParams.set('carta', key);
    window.history.replaceState(null, '', url.toString());
  }

  function setLoaderMsg(msg) {
    if (loaderText) loaderText.textContent = msg;
  }

  function showError() {
    loader.hidden = true;
    bookWrap.hidden = true;
    controls.hidden = true;
    bookError.hidden = false;
  }

  function waitForLibs(timeoutMs) {
    return new Promise(function (resolve, reject) {
      var start = Date.now();
      (function tick() {
        if (window.pdfjsLib && window.St && window.St.PageFlip) {
          setWorker();
          resolve();
          return;
        }
        if (Date.now() - start > timeoutMs) {
          reject(new Error('libs'));
          return;
        }
        setTimeout(tick, 80);
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

  /* Landscape menu pages are split into two book pages.
     Wide screens: exact halves. Phones: overlapping halves so columns stay readable. */
  function renderPdfToImages(file, token, overlap) {
    return window.pdfjsLib.getDocument({ url: file, withCredentials: false }).promise.then(function (pdf) {
      var pages = [];
      var split = false;
      var dpr = Math.min(window.devicePixelRatio || 1, 1.25);
      var baseTarget = Math.round(640 * dpr);

      function renderPage(n) {
        if (token !== loadToken) return Promise.reject(new Error('cancelled'));
        setLoaderMsg('Preparando página ' + n + ' de ' + pdf.numPages + '…');
        return pdf.getPage(n).then(function (page) {
          var base = page.getViewport({ scale: 1 });
          if (n === 1) split = base.height / base.width < 1.05;
          var targetW = (split ? 2 : 1) * Math.min(960, Math.max(560, baseTarget));
          var viewport = page.getViewport({ scale: targetW / base.width });
          var canvas = document.createElement('canvas');
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
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
            images: pages.map(function (c) { return c.toDataURL('image/jpeg', 0.78); }),
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
            images.push(half.toDataURL('image/jpeg', 0.78));
          });
        });

        return {
          images: images,
          ratio: pages[0].height / Math.floor(pages[0].width * frac)
        };
      });
    });
  }

  function bookSize(ratio) {
    var stageW = stage.clientWidth - 16;
    var stageH = stage.clientHeight - 16;
    var narrow = isNarrowScreen();
    var maxW = Math.min(
      560,
      Math.floor(stageH / ratio),
      narrow ? stageW : Math.floor(stageW / 2)
    );
    var minW = Math.min(240, maxW);
    var baseW = Math.max(minW, Math.min(maxW, Math.floor(stageW * 0.92)));
    return {
      width: baseW,
      height: Math.floor(baseW * ratio),
      minWidth: minW,
      maxWidth: maxW,
      minHeight: Math.floor(minW * ratio),
      maxHeight: Math.floor(maxW * ratio)
    };
  }

  function updatePageInfo() {
    if (!pageFlip) return;
    pageInfo.textContent = (pageFlip.getCurrentPageIndex() + 1) + ' / ' + pageFlip.getPageCount();
  }

  function destroyBook() {
    if (pageFlip) {
      try { pageFlip.destroy(); } catch (e) { /* noop */ }
      pageFlip = null;
    }
    var old = document.getElementById('book');
    var fresh = document.createElement('div');
    fresh.id = 'book';
    old.parentNode.replaceChild(fresh, old);
    return fresh;
  }

  function loadMenu(key) {
    var token = ++loadToken;
    currentKey = key;
    builtNarrow = isNarrowScreen();
    setTabs(key);
    loader.hidden = false;
    bookWrap.hidden = true;
    controls.hidden = true;
    bookError.hidden = true;
    setLoaderMsg('Preparando la carta…');

    waitForLibs(8000)
      .then(function () {
        if (token !== loadToken) return null;
        return withTimeout(renderPdfToImages(MENUS[key].file, token, builtNarrow), LOAD_TIMEOUT_MS);
      })
      .then(function (result) {
        if (!result || token !== loadToken) return;
        setLoaderMsg('Armando el libro…');
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

        loader.hidden = true;
        bookWrap.hidden = false;
        controls.hidden = false;
        updatePageInfo();
      })
      .catch(function (err) {
        if (token !== loadToken || (err && err.message === 'cancelled')) return;
        showError();
      });
  }

  function flip(dir) {
    if (!pageFlip) return;
    if (dir > 0) pageFlip.flipNext();
    else pageFlip.flipPrev();
  }

  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      var key = tab.getAttribute('data-menu');
      if (!tab.classList.contains('is-active')) loadMenu(key);
    });
  });

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
    if (Math.abs(dy) > 60 && Math.abs(dy) > Math.abs(dx) * 1.5) {
      flip(dy < 0 ? 1 : -1);
    }
  }, { passive: true });

  var resizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      if (builtNarrow !== null && builtNarrow !== isNarrowScreen()) {
        loadMenu(currentKey);
      }
    }, 350);
  });

  document.getElementById('cartaBack').addEventListener('click', function (e) {
    if (window.history.length > 1 && document.referrer) {
      e.preventDefault();
      window.history.back();
    }
  });

  loadMenu(menuKeyFromUrl());
})();
