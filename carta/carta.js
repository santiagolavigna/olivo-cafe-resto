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
    setUrl(key);
  }

  function currentIndex() {
    if (!pages.length) return 0;
    var x = rail.scrollLeft;
    var w = rail.clientWidth || 1;
    return Math.max(0, Math.min(pages.length - 1, Math.round(x / w)));
  }

  function updateChrome() {
    var i = currentIndex();
    pageLabel.textContent = (i + 1) + ' / ' + Math.max(pages.length, 1);
    prevBtn.disabled = i <= 0;
    nextBtn.disabled = i >= pages.length - 1;
  }

  function goTo(i, smooth) {
    if (!pages.length) return;
    i = Math.max(0, Math.min(pages.length - 1, i));
    rail.scrollTo({ left: i * rail.clientWidth, behavior: smooth === false ? 'auto' : 'smooth' });
    window.setTimeout(updateChrome, smooth === false ? 0 : 280);
  }

  function buildRail(urls) {
    rail.innerHTML = '';
    pages = [];
    urls.forEach(function (src, n) {
      var slide = document.createElement('article');
      slide.className = 'page';
      slide.setAttribute('aria-label', 'Página ' + (n + 1));
      var img = document.createElement('img');
      img.src = src;
      img.alt = 'Carta Olivo · página ' + (n + 1);
      img.decoding = 'async';
      img.loading = n === 0 ? 'eager' : 'lazy';
      img.draggable = false;
      slide.appendChild(img);
      rail.appendChild(slide);
      pages.push(slide);

      // preload next two
      if (n > 0 && n < 3) {
        var pre = new Image();
        pre.src = src;
      }
    });
    goTo(0, false);
    updateChrome();
  }

  function showMenu(key) {
    currentKey = key;
    setTabs(key);
    var urls = (manifest && manifest[key]) || [];
    if (!urls.length) {
      pageLabel.textContent = '—';
      rail.innerHTML = '';
      return;
    }
    buildRail(urls);
  }

  function loadManifest() {
    return fetch('./pages/manifest.json?v=20260727f', { cache: 'no-cache' })
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
