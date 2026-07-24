(function () {
  var STYLE_ID = 'mars2-overlay-styles';

  var OVERLAY_CSS =
    '#intro-overlay{position:fixed;inset:0;width:100%;height:100%;z-index:12000;' +
    'box-sizing:border-box;background:rgba(8,8,10,.6);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);cursor:pointer}' +
    '#intro-overlay.hidden{display:none!important;opacity:0!important;visibility:hidden!important;pointer-events:none!important}' +
    '.intro-overlay-middle{position:fixed;left:50%;top:50%;z-index:12002;transform:translate(-50%,-50%);' +
    'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;' +
    'width:min(92vw,360px);text-align:center;pointer-events:none}' +
    '.intro-overlay-brand{position:fixed;left:50%;top:62%;transform:translate(-50%,-50%);z-index:12002;text-align:center;' +
    'font:500 15px/1.25 "Plus Jakarta Sans",Helvetica,Arial,sans-serif;' +
    'letter-spacing:.04em;color:rgba(255,255,255,.55);text-decoration:none;pointer-events:auto;white-space:nowrap}' +
    '.intro-overlay-brand:hover{color:rgba(255,255,255,.85)}' +
    '.img360-pulse{display:flex;align-items:center;justify-content:center;line-height:0}' +
    '.img360-pulse-inner{transform-origin:center center;animation:introBreath 2.4s ease-in-out infinite}' +
    '.img360{display:block;width:min(160px,40vw);height:auto;filter:drop-shadow(0 0 18px rgba(255,255,255,.2))}' +
    '#intro-overlay .arrow-slot{position:fixed;z-index:12001;display:flex;align-items:center;justify-content:center;' +
    'width:40px;height:40px;pointer-events:none}' +
    '#intro-overlay .arrow-slot .arrow{width:100%;height:100%;fill:rgba(255,255,255,.9);filter:drop-shadow(0 2px 8px rgba(0,0,0,.35))}' +
    '#intro-overlay .arrow-slot.arrow-up{left:50%;top:8%;transform:translate(-50%,0)}' +
    '#intro-overlay .arrow-slot.arrow-down{left:50%;bottom:8%;top:auto;transform:translate(-50%,0)}' +
    '#intro-overlay .arrow-slot.arrow-left{left:6%;top:50%;transform:translate(0,-50%)}' +
    '#intro-overlay .arrow-slot.arrow-right{right:6%;left:auto;top:50%;transform:translate(0,-50%)}' +
    '@keyframes introBreath{0%,100%{transform:scale(1);opacity:.9}50%{transform:scale(1.09);opacity:.68}}';

  if (!document.getElementById(STYLE_ID)) {
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = OVERLAY_CSS;
    document.head.appendChild(style);
  }

  var overlayHTML =
    '<div id="intro-overlay" role="dialog" aria-modal="true" aria-label="Tour 360. Toca para explorar.">' +
      '<div class="intro-overlay-middle" style="display:flex;flex-direction:column;align-items:center;gap:18px;">' +
        '<div class="img360-pulse">' +
          '<div class="img360-pulse-inner">' +
            '<svg class="img360" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" viewBox="0 0 204 192" ' +
              'style="display:block;width:min(160px,40vw);height:auto;">' +
              '<g transform="translate(0,192) scale(0.1,-0.1)" fill="#fff" stroke="none">' +
                '<path d="M995 1699 c-51 -15 -124 -95 -166 -184 -48 -101 -57 -135 -35 -135 9 0 16 6 16 13 0 29 80 175 116 210 53 53 102 66 155 41 38 -17 119 -102 119 -125 0 -5 -11 -9 -25 -9 -14 0 -25 -3 -25 -7 0 -5 23 -33 50 -63 l49 -55 18 21 c10 12 33 40 51 63 l34 41 -31 0 c-27 0 -36 8 -65 53 -79 121 -162 165 -261 136z"/>' +
                '<path d="M1440 1360 c-41 -41 -10 -110 49 -110 32 0 71 39 71 71 0 29 -36 59 -70 59 -17 0 -39 -9 -50 -20z m78 -42 c2 -19 -2 -28 -18 -33 -37 -12 -64 27 -38 53 21 21 53 10 56 -20z"/>' +
                '<path d="M678 1328 c-29 -10 -34 -23 -19 -47 8 -12 14 -12 40 -1 38 15 78 6 86 -21 9 -28 -11 -48 -56 -55 -33 -6 -39 -10 -39 -30 0 -21 5 -24 35 -24 60 0 96 -57 59 -94 -18 -18 -76 -21 -106 -5 -23 12 -40 -3 -35 -31 4 -22 75 -42 121 -34 87 14 126 108 73 170 -23 26 -23 28 -5 46 28 28 24 84 -8 113 -21 19 -37 25 -73 24 -25 0 -58 -5 -73 -11z"/>' +
                '<path d="M1002 1319 c-26 -13 -55 -39 -70 -62 -23 -35 -27 -51 -27 -118 0 -90 18 -125 78 -148 47 -18 82 -8 125 35 33 33 34 37 30 89 -3 34 -12 62 -23 75 -24 26 -72 39 -109 29 -42 -12 -44 -4 -6 31 19 18 48 33 71 36 33 6 39 10 39 30 0 20 -5 24 -32 24 -18 0 -52 -10 -76 -21z m62 -155 c49 -48 7 -138 -55 -119 -68 22 -55 135 16 135 13 0 31 -7 39 -16z"/>' +
                '<path d="M1212 1312 c-38 -36 -56 -99 -49 -178 8 -110 69 -169 148 -145 58 17 83 60 88 149 4 96 -4 135 -38 171 -24 26 -37 31 -74 31 -35 0 -51 -6 -75 -28z m95 -30 c33 -21 45 -145 19 -207 -12 -27 -21 -35 -40 -35 -41 0 -60 41 -60 125 0 99 33 147 81 117z"/>' +
                '<path d="M520 1046 c-93 -28 -132 -48 -159 -82 -69 -87 76 -153 444 -201 l60 -8 3 -37 3 -38 59 48 c32 26 58 52 57 58 -1 7 -27 32 -57 57 l-55 46 -3 -31 -3 -31 -86 7 c-215 16 -369 73 -348 128 8 19 62 47 121 62 31 8 50 18 52 29 4 20 6 21 -86 -7z"/>' +
                '<path d="M1426 1051 c-4 -6 5 -13 21 -17 100 -21 167 -60 161 -92 -4 -25 -102 -69 -190 -87 -43 -8 -145 -20 -228 -27 l-150 -12 0 -33 0 -33 88 6 c122 8 298 31 368 49 90 23 183 72 195 102 18 48 -36 98 -136 128 -75 23 -122 29 -129 16z"/>' +
                '<path d="M1264 713 c-65 -200 -137 -288 -235 -288 -38 0 -55 6 -86 31 -47 38 -96 117 -124 201 -12 38 -26 63 -35 63 -18 0 -12 -30 28 -125 78 -188 200 -265 325 -204 50 24 89 69 133 150 28 54 70 161 70 181 0 4 -16 8 -35 8 -25 0 -37 -5 -41 -17z"/>' +
              '</g>' +
            '</svg>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<a class="intro-overlay-brand" href="https://www.nuvola.services" target="_blank" rel="noopener noreferrer">www.nuvola.services</a>' +
      '<span class="arrow-slot arrow-up" style="position:fixed;left:50%;top:8%;transform:translateX(-50%);">' +
        '<svg class="arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 L5 9 H9 V22 H15 V9 H19 Z"/></svg></span>' +
      '<span class="arrow-slot arrow-down" style="position:fixed;left:50%;bottom:8%;top:auto;transform:translateX(-50%);">' +
        '<svg class="arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22 L19 15 H15 V2 H9 V15 H5 Z"/></svg></span>' +
      '<span class="arrow-slot arrow-left" style="position:fixed;left:6%;top:50%;transform:translateY(-50%);">' +
        '<svg class="arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12 L9 5 V9 H22 V15 H9 V19 Z"/></svg></span>' +
      '<span class="arrow-slot arrow-right" style="position:fixed;right:6%;left:auto;top:50%;transform:translateY(-50%);">' +
        '<svg class="arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M22 12 L15 19 V15 H2 V9 H15 V5 Z"/></svg></span>' +
    '</div>';

  document.body.insertAdjacentHTML('beforeend', overlayHTML);

  var overlay = document.getElementById('intro-overlay');
  var dismissed = false;

  function hideIntro() {
    if (dismissed || !overlay) return;
    dismissed = true;
    overlay.classList.add('hidden');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.style.cssText = 'display:none!important;';
    if (window.MARS2_TOUR && typeof window.MARS2_TOUR.tryAutoEnterVR === 'function') {
      window.MARS2_TOUR.tryAutoEnterVR();
    }
  }

  if (overlay) {
    overlay.addEventListener('click', hideIntro);
    overlay.addEventListener('touchend', hideIntro);
  }

  document.addEventListener('mousedown', hideIntro, { once: true });
  document.addEventListener('touchstart', hideIntro, { once: true, passive: true });
  document.addEventListener('wheel', hideIntro, { once: true, passive: true });
  document.addEventListener('keydown', hideIntro, { once: true });

  window.setTimeout(hideIntro, 10000);
})();
