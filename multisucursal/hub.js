(function () {
  'use strict';

  document.querySelectorAll('.hub-hero [data-reveal]').forEach(function (el, i) {
    el.style.setProperty('--reveal-delay', (i * 90) + 'ms');
    window.setTimeout(function () { el.classList.add('is-in'); }, 80 + i * 90);
  });

  var cities = document.querySelectorAll('.hub-city');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || window.matchMedia('(max-width: 960px)').matches) return;

  cities.forEach(function (card) {
    card.addEventListener('pointermove', function (e) {
      if (!card.classList.contains('is-in')) return;
      var rect = card.getBoundingClientRect();
      var x = (e.clientX - rect.left) / rect.width;
      var y = (e.clientY - rect.top) / rect.height;
      var rx = (0.5 - y) * 8;
      var ry = (x - 0.5) * 10;
      card.style.transform = 'translateY(-10px) rotateX(' + rx + 'deg) rotateY(' + ry + 'deg)';
    });
    card.addEventListener('pointerleave', function () {
      card.style.transform = '';
    });
  });
})();
