(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var header = document.getElementById('siteHeader');
  var toggle = document.getElementById('navToggle');
  var nav = document.getElementById('siteNav');
  var progressBar = document.querySelector('#scrollProgress span');

  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    nav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        nav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* Staggered 3D reveals (bottom → top) */
  function armReveals(root) {
    var nodes = (root || document).querySelectorAll('[data-reveal]');
    var groups = {};

    nodes.forEach(function (el) {
      var parent = el.closest('section') || el.parentElement || document.body;
      var key = parent.id || parent.className || 'root';
      if (!groups[key]) groups[key] = [];
      groups[key].push(el);
    });

    Object.keys(groups).forEach(function (key) {
      groups[key].forEach(function (el, i) {
        el.style.setProperty('--reveal-delay', (i * 110) + 'ms');
      });
    });

    if (reduceMotion) {
      nodes.forEach(function (el) { el.classList.add('is-in'); });
      document.querySelectorAll('[data-reveal-child]').forEach(function (el) {
        el.classList.add('is-in');
      });
      return;
    }

    if (!('IntersectionObserver' in window)) {
      nodes.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');

        if (entry.target.classList.contains('gallery')) {
          entry.target.querySelectorAll('[data-reveal-child]').forEach(function (child, i) {
            child.style.setProperty('--reveal-delay', (120 + i * 90) + 'ms');
            child.classList.add('is-in');
          });
        }

        io.unobserve(entry.target);
      });
    }, { threshold: 0.14, rootMargin: '0px 0px -10% 0px' });

    nodes.forEach(function (el) { io.observe(el); });
  }

  armReveals(document);

  var panels = Array.prototype.slice.call(document.querySelectorAll('[data-story-panel]'));
  var storyCopy = document.querySelector('.story__copy');
  var storyTitle = document.querySelector('[data-story-title]');
  var storyText = document.querySelector('[data-story-text]');
  var storyIndex = document.querySelector('[data-story-index]');
  var storyImgs = Array.prototype.slice.call(document.querySelectorAll('[data-story-img]'));
  var activeStory = -1;

  function setStory(i) {
    if (!panels.length || !storyTitle || i === activeStory) return;
    activeStory = i;
    var panel = panels[i];
    if (!panel) return;

    if (storyCopy) storyCopy.classList.add('is-swap');
    window.setTimeout(function () {
      storyTitle.textContent = panel.getAttribute('data-title') || '';
      storyText.textContent = panel.getAttribute('data-text') || '';
      if (storyIndex) storyIndex.textContent = panel.getAttribute('data-index') || '';
      if (storyCopy) storyCopy.classList.remove('is-swap');
    }, reduceMotion ? 0 : 160);

    var imgIdx = parseInt(panel.getAttribute('data-img') || String(i), 10);
    storyImgs.forEach(function (img, slot) {
      img.classList.toggle('is-active', slot === imgIdx);
    });
  }

  var cartas = document.querySelectorAll('.carta');
  cartas.forEach(function (card) {
    card.addEventListener('pointermove', function (e) {
      if (reduceMotion || window.matchMedia('(max-width: 960px)').matches) return;
      if (!card.classList.contains('is-in')) return;
      var rect = card.getBoundingClientRect();
      var x = (e.clientX - rect.left) / rect.width;
      var y = (e.clientY - rect.top) / rect.height;
      var rx = (0.5 - y) * 12;
      var ry = (x - 0.5) * 16;
      card.style.transform = 'rotateX(' + rx + 'deg) rotateY(' + ry + 'deg) translateY(-4px)';
    });
    card.addEventListener('pointerleave', function () {
      if (!card.classList.contains('is-in')) return;
      card.style.transform = '';
    });
  });

  var ticking = false;
  var heroRoot = document.querySelector('[data-parallax-root]');
  var heroLayers = heroRoot ? heroRoot.querySelectorAll('[data-depth]') : [];
  var storySection = document.querySelector('.story');

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }

  function update() {
    ticking = false;
    var y = window.scrollY || window.pageYOffset;
    var docH = document.documentElement.scrollHeight - window.innerHeight;
    var p = docH > 0 ? y / docH : 0;

    if (header) header.classList.toggle('is-scrolled', y > 36);
    if (progressBar) progressBar.style.width = (p * 100).toFixed(2) + '%';

    if (!reduceMotion && heroLayers.length) {
      heroLayers.forEach(function (layer) {
        var depth = parseFloat(layer.getAttribute('data-depth') || '0.2');
        var shift = Math.min(y, window.innerHeight) * depth;
        layer.style.transform = 'translate3d(0,' + shift.toFixed(1) + 'px,0)';
      });
    }

    if (storySection && panels.length) {
      var rect = storySection.getBoundingClientRect();
      var total = storySection.offsetHeight - window.innerHeight;
      var scrolled = Math.min(Math.max(-rect.top, 0), Math.max(total, 1));
      var storyP = scrolled / Math.max(total, 1);
      var idx = Math.min(panels.length - 1, Math.floor(storyP * panels.length));
      setStory(idx);
    }
  }

  if (window.matchMedia('(max-width: 960px)').matches && storyImgs.length) {
    setStory(0);
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  update();

  document.querySelectorAll('.hero [data-reveal]').forEach(function (el, i) {
    el.style.setProperty('--reveal-delay', (i * 90) + 'ms');
    window.setTimeout(function () { el.classList.add('is-in'); }, 80 + i * 90);
  });
})();
