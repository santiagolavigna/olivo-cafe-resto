(function () {
  'use strict';

  var VERSION = '20260728d';
  var PDFS = {
    cafeteria: '../assets/menu-cafeteria.pdf',
    restaurante: '../assets/menu-restaurante.pdf'
  };

  /* Fallback if manifest fetch fails (GitHub Pages / offline cache issues) */
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

  var rail = document.getElementById('rail');
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
  var manifest = null;

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

  function currentIndex() {
    if (!pages.length) return 0;
    var w = rail.clientWidth || 1;
    return Math.max(0, Math.min(pages.length - 1, Math.round(rail.scrollLeft / w)));
  }

  function updateChrome() {
    var i = currentIndex();
    var total = Math.max(pages.length, 1);
    pageLabel.textContent = pages.length ? (i + 1) + ' / ' + total : '—';
    prevBtn.disabled = !pages.length || i <= 0;
    nextBtn.disabled = !pages.length || i >= pages.length - 1;
    if (dockHint) {
      dockHint.textContent = window.matchMedia('(min-width: 900px)').matches
        ? 'Flechas o deslizá'
        : 'Deslizá para pasar';
    }
  }

  function goTo(i, smooth) {
    if (!pages.length) return;
    i = Math.max(0, Math.min(pages.length - 1, i));
    rail.scrollTo({
      left: i * rail.clientWidth,
      behavior: smooth === false ? 'auto' : 'smooth'
    });
    window.setTimeout(updateChrome, smooth === false ? 0 : 280);
  }

  function buildRail(entries) {
    bookError.hidden = true;
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

    goTo(0, false);
    updateChrome();
  }

  function showMenu(key) {
    currentKey = key;
    setTabs(key);

    var entries = normalizeEntries(
      (manifest && manifest[key]) || FALLBACK[key] || []
    );

    if (!entries.length) {
      pageLabel.textContent = '—';
      bookError.hidden = false;
      rail.innerHTML = '';
      pages = [];
      return;
    }

    buildRail(entries);
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

  prevBtn.addEventListener('click', function () { goTo(currentIndex() - 1); });
  nextBtn.addEventListener('click', function () { goTo(currentIndex() + 1); });

  rail.addEventListener('scroll', function () {
    window.clearTimeout(rail._t);
    rail._t = window.setTimeout(updateChrome, 50);
  }, { passive: true });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight' || e.key === 'PageDown') goTo(currentIndex() + 1);
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') goTo(currentIndex() - 1);
  });

  window.addEventListener('resize', function () {
    goTo(currentIndex(), false);
  });

  document.getElementById('backBtn').addEventListener('click', function (e) {
    if (window.history.length > 1 && document.referrer) {
      e.preventDefault();
      window.history.back();
    }
  });

  /* Boot immediately with fallback pages — never wait on CDN or preload */
  showMenu(keyFromUrl());

  loadManifest()
    .then(function (data) {
      manifest = data;
      showMenu(currentKey);
    })
    .catch(function () {
      /* FALLBACK already shown — keep it */
      if (!pages.length) bookError.hidden = false;
    });
})();
