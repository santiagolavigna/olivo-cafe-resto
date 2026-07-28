(function () {
  'use strict';

  var PDFS = {
    cafeteria: '../assets/menu-cafeteria.pdf',
    restaurante: '../assets/menu-restaurante.pdf'
  };

  var rail = document.getElementById('rail');
  var pageLabel = document.getElementById('pageLabel');
  var prevBtn = document.getElementById('prevBtn');
  var nextBtn = document.getElementById('nextBtn');
  var pdfBtn = document.getElementById('pdfBtn');
  var zoomHint = document.getElementById('zoomHint');
  var dockHint = document.getElementById('dockHint');
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.top__tab'));
  var pages = [];
  var currentKey = 'cafeteria';
  var manifest = null;

  function isDesktop() {
    return window.matchMedia('(min-width: 900px)').matches;
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

  function currentIndex() {
    if (!pages.length) return 0;
    if (isDesktop()) {
      var x = rail.scrollLeft;
      var w = rail.clientWidth || 1;
      return Math.max(0, Math.min(pages.length - 1, Math.round(x / w)));
    }
    var mid = rail.scrollTop + rail.clientHeight * 0.35;
    var best = 0;
    var bestDist = Infinity;
    pages.forEach(function (slide, i) {
      var dist = Math.abs(slide.offsetTop - mid + slide.offsetHeight * 0.2);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    return best;
  }

  function updateChrome() {
    var i = currentIndex();
    pageLabel.textContent = (i + 1) + ' / ' + Math.max(pages.length, 1);
    prevBtn.disabled = i <= 0;
    nextBtn.disabled = i >= pages.length - 1;
    if (dockHint) {
      dockHint.textContent = isDesktop() ? 'Flechas o deslizá' : 'Deslizá hacia abajo';
    }
  }

  function goTo(i, smooth) {
    if (!pages.length) return;
    i = Math.max(0, Math.min(pages.length - 1, i));
    var behavior = smooth === false ? 'auto' : 'smooth';
    if (isDesktop()) {
      rail.scrollTo({ left: i * rail.clientWidth, top: 0, behavior: behavior });
    } else {
      rail.scrollTo({ top: pages[i].offsetTop, left: 0, behavior: behavior });
    }
    window.setTimeout(updateChrome, smooth === false ? 0 : 280);
  }

  function buildRail(entries) {
    rail.innerHTML = '';
    pages = [];

    entries.forEach(function (entry, n) {
      var slide = document.createElement('article');
      var orient = entry.orientation || 'portrait';
      slide.className = 'page is-' + orient;
      slide.setAttribute('aria-label', 'Página ' + (n + 1));

      var img = document.createElement('img');
      img.src = entry.src + (entry.src.indexOf('?') >= 0 ? '&' : '?') + 'v=20260728a';
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

      if (n > 0 && n < 3) {
        var pre = new Image();
        pre.src = img.src;
      }
    });

    goTo(0, false);
    updateChrome();

    if (!isDesktop()) {
      zoomHint.classList.add('is-visible');
      window.setTimeout(function () { zoomHint.classList.remove('is-visible'); }, 2600);
    } else {
      zoomHint.classList.remove('is-visible');
    }
  }

  function showMenu(key) {
    currentKey = key;
    setTabs(key);
    var urls = normalizeEntries((manifest && manifest[key]) || []);
    if (!urls.length) {
      pageLabel.textContent = '—';
      rail.innerHTML = '';
      return;
    }
    buildRail(urls);
  }

  function loadManifest() {
    return fetch('./pages/manifest.json?v=20260728a', { cache: 'no-cache' })
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
    rail._t = window.setTimeout(updateChrome, 60);
  }, { passive: true });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === 'ArrowDown') {
      goTo(currentIndex() + 1);
    }
    if (e.key === 'ArrowLeft' || e.key === 'PageUp' || e.key === 'ArrowUp') {
      goTo(currentIndex() - 1);
    }
  });

  window.addEventListener('resize', function () {
    goTo(currentIndex(), false);
    updateChrome();
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
      rail.innerHTML = '<p style="margin:auto;padding:2rem;text-align:center">No pudimos cargar la carta. <a href="' + PDFS.cafeteria + '" style="color:#d4c97a">Abrir PDF</a></p>';
    });
})();
