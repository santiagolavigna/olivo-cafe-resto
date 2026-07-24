/*
 * Copyright 2016 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

(function() {
  var Marzipano = window.Marzipano;
  var bowser = window.bowser;
  var screenfull = window.screenfull;
  var data = window.APP_DATA;
  var newAPP_DATA = JSON.parse(JSON.stringify(data));

  // Grab elements from DOM.
  var panoElement = document.querySelector('#pano');
  var sceneNameElement = document.querySelector('#titleBar .sceneName');
  var navBrandElement = document.querySelector('#titleBar .nav-brand');
  var sceneListElement = document.querySelector('#sceneList');
  var sceneElements = document.querySelectorAll('#sceneList .scene[data-id]');
  var sceneListToggleElement = document.querySelector('#sceneListToggle');
  var fullscreenToggleElement = document.querySelector('#fullscreenToggle');
  var siteBackBtnElement = document.querySelector('#siteBackBtn');

  function resolveSiteHomeUrl() {
    if (data && data.settings && typeof data.settings.siteUrl === 'string' && data.settings.siteUrl.trim()) {
      return data.settings.siteUrl.trim();
    }
    var path = window.location.pathname || '/';
    if (/\/vr\/?$/i.test(path)) {
      var home = path.replace(/\/vr\/?$/i, '/');
      return home || '/';
    }
    return '../';
  }

  function updateFullscreenToggleState() {
    if (!fullscreenToggleElement || !screenfull.enabled) return;
    if (screenfull.isFullscreen) {
      fullscreenToggleElement.classList.add('enabled');
    } else {
      fullscreenToggleElement.classList.remove('enabled');
    }
  }

  function tryEnterFullscreen() {
    if (!screenfull.enabled || !data.settings.autoFullscreen) return;
    if (screenfull.isFullscreen) return;
    screenfull.request(document.documentElement).then(updateFullscreenToggleState).catch(function() {});
  }

  function bindAutoFullscreen() {
    if (!data.settings.autoFullscreen) return;
    tryEnterFullscreen();
    var enterOnGesture = function() {
      tryEnterFullscreen();
    };
    document.addEventListener('pointerdown', enterOnGesture, { once: true, passive: true });
    document.addEventListener('touchstart', enterOnGesture, { once: true, passive: true });
  }

  if (siteBackBtnElement) {
    siteBackBtnElement.setAttribute('href', resolveSiteHomeUrl());
  }

  function resolveProjectName() {
    if (data && typeof data.projectName === 'string' && data.projectName.trim()) {
      return data.projectName.trim();
    }
    if (typeof document.title === 'string' && document.title.trim()) {
      return document.title.trim();
    }
    return '';
  }

  function updateProjectBrand() {
    if (!navBrandElement) return;
    var projectName = resolveProjectName();
    if (!projectName) return;
    navBrandElement.textContent = projectName;
  }

  // Detect desktop or mobile mode.
  if (window.matchMedia) {
    var setMode = function() {
      if (mql.matches) {
        document.body.classList.remove('desktop');
        document.body.classList.add('mobile');
      } else {
        document.body.classList.remove('mobile');
        document.body.classList.add('desktop');
      }
    };
    var mql = matchMedia("(max-width: 500px), (max-height: 500px)");
    setMode();
    mql.addListener(setMode);
  } else {
    document.body.classList.add('desktop');
  }

  // Detect whether we are on a touch device.
  document.body.classList.add('no-touch');
  window.addEventListener('touchstart', function() {
    document.body.classList.remove('no-touch');
    document.body.classList.add('touch');
  });

  // Use tooltip fallback mode on IE < 11.
  if (bowser.msie && parseFloat(bowser.version) < 11) {
    document.body.classList.add('tooltip-fallback');
  }

  if (data.settings.viewControlButtons) {
    document.body.classList.add('view-control-buttons');
  } else {
    document.body.classList.remove('view-control-buttons');
    var dock = document.querySelector('.view-controls-dock');
    if (dock) {
      dock.style.display = 'none';
    }
  }

  updateProjectBrand();

  // Viewer options.
  var viewerOpts = {
    controls: {
      mouseViewMode: data.settings.mouseViewMode
    }
  };

  // Initialize viewer.
  var viewer = new Marzipano.Viewer(panoElement, viewerOpts);
  window.MARS2_VIEWER = viewer;

  function supportsWebp() {
    try {
      var canvas = document.createElement("canvas");
      return canvas.toDataURL("image/webp").indexOf("data:image/webp") === 0;
    } catch (e) {
      return false;
    }
  }

  function detectTileExt(callback) {
    // mars1pano2: exported ZIP tiles are always .jpg (see tool zip generator).
    callback("jpg");
  }

  var scenes = [];
  var auxiliaryHotspotsByScene = {};

  function setAuxiliaryHotspotsVisible(sceneId, visible) {
    var list = auxiliaryHotspotsByScene[sceneId] || [];
    for (var i = 0; i < list.length; i++) {
      if (visible) {
        list[i].classList.remove('info-hotspot-hidden');
      } else {
        list[i].classList.add('info-hotspot-hidden');
      }
    }
  }

  if(APP_DATA.debug) {

    (function() {
      // Crear botón flotante
      var downloadBtn = document.createElement('button');
      downloadBtn.innerHTML = '📥 data-new.js';
      downloadBtn.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 9999;
        padding: 15px 25px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        border-radius: 10px;
        font-size: 16px;
        font-weight: bold;
        cursor: pointer;
        box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        gap: 8px;
      `;
      
      downloadBtn.onmouseover = function() { 
        this.style.transform = 'translateY(-2px) scale(1.05)';
        this.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.6)';
      };
      
      downloadBtn.onmouseout = function() { 
        this.style.transform = 'translateY(0) scale(1)';
        this.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.4)';
      };
      
      downloadBtn.onclick = function() {
        newAPP_DATA.debug = false;
        var jsonString = JSON.stringify(newAPP_DATA, null, 2);
        
        var fileContent = `var APP_DATA = ${jsonString};`;
        
        var blob = new Blob([fileContent], { type: 'application/javascript' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'data.js';
        a.click();
        URL.revokeObjectURL(url);
        
        console.log('✅ data.js descargado exitosamente');
        
        var message = document.createElement('div');
        message.innerHTML = '✅ data.js descargado!';
        message.style.cssText = `
          position: fixed;
          bottom: 80px;
          right: 20px;
          z-index: 10000;
          padding: 12px 20px;
          background: #4CAF50;
          color: white;
          border-radius: 8px;
          font-size: 14px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
          animation: slideIn 0.3s ease, fadeOut 0.5s ease 2s;
        `;
        document.body.appendChild(message);
        
        setTimeout(() => {
          document.body.removeChild(message);
        }, 2800);
        
        var style = document.createElement('style');
        style.innerHTML = `
          @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
          @keyframes fadeOut {
            from { opacity: 1; }
            to { opacity: 0; }
          }
        `;
        document.head.appendChild(style);
      };
      
      document.body.appendChild(downloadBtn);
    })();


    document.addEventListener('keydown', function(e) {      
      const view = viewer.view();
      if (!view) return; 
      const p = view.parameters();
      
      if(e.key === 'p' || e.key === 'P') {
          console.log(`  "targetView": {
          "yaw": ${p.yaw},
          "pitch": ${p.pitch},
          "fov": ${p.fov}
        }`);
      }

      if (e.key === 'v' || e.key === 'V') {
        var lastHotspot = localStorage.getItem('lastHotspot');
        if (!lastHotspot) {
          console.error('❌ No hay hotspot guardado en localStorage. Haz clic en un hotspot primero.');
          return;
        }
        
        var hotspotData = JSON.parse(lastHotspot);
        var found = false;
        var updatedHotspot = null;
    
        console.log("📍 ---HOTSPOT ACTUAL:");
        console.log(lastHotspot);
        console.log("\n🎯 ---PARÁMETROS DE LA VISTA ACTUAL:");
        console.log(`  "targetView": {
        "yaw": ${p.yaw},
        "pitch": ${p.pitch},
        "fov": ${p.fov}
      }`);
    
        for (var i = 0; i < newAPP_DATA.scenes.length; i++) {
          var scene = newAPP_DATA.scenes[i];
          
          if (scene.linkHotspots && scene.linkHotspots.length > 0) {
            for (var j = 0; j < scene.linkHotspots.length; j++) {
              var hotspot = scene.linkHotspots[j];
              
              var yawMatch = Math.abs(hotspot.yaw - hotspotData.yaw) < 0.001;
              var pitchMatch = Math.abs(hotspot.pitch - hotspotData.pitch) < 0.001;
              var rotationMatch = Math.abs(hotspot.rotation - hotspotData.rotation) < 0.001;
              var targetMatch = hotspot.target === hotspotData.target;
              var iconMatch = hotspot.icon === hotspotData.icon || (!hotspot.icon && !hotspotData.icon);
    
              if (yawMatch && pitchMatch && rotationMatch && targetMatch && iconMatch) {
                found = true;
                
                var targetView = {
                  yaw: p.yaw,
                  pitch: p.pitch,
                  fov: p.fov
                };
                newAPP_DATA.scenes[i].linkHotspots[j].targetView = targetView;
                updatedHotspot = true;
                
                console.log('\n✅ Hotspot encontrado y actualizado:');
                alert('✅ Hotspot encontrado y actualizado en APP_DATA. Revisa la consola para más detalles.');
              
                break;
              }
            }
            
            if (found) break;
          }
        }
    
        if (!found) {
          console.warn('\n⚠️ Hotspot no encontrado en APP_DATA');
          console.log('   Verifica que los valores coincidan exactamente');
          console.log('   Último hotspot guardado:', hotspotData);
        }
      }
    });
  }

  function buildScenes(tileExt) {
    scenes = data.scenes.map(function(data) {
      var urlPrefix = "tiles";
      var source = Marzipano.ImageUrlSource.fromString(
        urlPrefix + "/" + data.id + "/{z}/{f}/{y}/{x}." + tileExt,
        { cubeMapPreviewUrl: urlPrefix + "/" + data.id + "/preview." + tileExt });
    var geometry = new Marzipano.CubeGeometry(data.levels);

    var limiter = function(viewParams) {
      var minFov = 100 * Math.PI / 180;
      var maxFov = 110 * Math.PI / 180;
      viewParams.fov = Math.max(minFov, Math.min(maxFov, viewParams.fov));

      var minPitch = -0.5;
      var maxPitch = 0.5;
      viewParams.pitch = Math.max(minPitch, Math.min(maxPitch, viewParams.pitch));

      return viewParams;
    };
    var view = new Marzipano.RectilinearView(data.initialViewParameters, limiter);

    var scene = viewer.createScene({
      source: source,
      geometry: geometry,
      view: view,
      pinFirstLevel: true
    });

    // Create link hotspots.
    data.linkHotspots.forEach(function(hotspot) {
      var element = createLinkHotspotElement(hotspot, tileExt);
      scene.hotspotContainer().createHotspot(element, { yaw: hotspot.yaw, pitch: hotspot.pitch });
    });

    // Create info hotspots.
    data.infoHotspots.forEach(function(hotspot) {
      var element;
      if (hotspot.type === 'whatsapp') {
        element = createWhatsAppHotspotElement(hotspot);
      } else {
        element = createInfoHotspotElement(hotspot, data.id);
      }
      scene.hotspotContainer().createHotspot(element, { yaw: hotspot.yaw, pitch: hotspot.pitch });
      if (hotspot.auxiliary) {
        if (!auxiliaryHotspotsByScene[data.id]) {
          auxiliaryHotspotsByScene[data.id] = [];
        }
        auxiliaryHotspotsByScene[data.id].push(element);
      }
    });

    // Create product catalog hotspots.
    (data.productHotspots || []).forEach(function(hotspot) {
      var element = createProductHotspotElement(hotspot, data.id);
      scene.hotspotContainer().createHotspot(element, { yaw: hotspot.yaw, pitch: hotspot.pitch });
    });

      return {
        data: data,
        scene: scene,
        view: view
      };
    });
  }

  // Set up fullscreen mode, if supported.
  if (screenfull.enabled && data.settings.fullscreenButton) {
    document.body.classList.add('fullscreen-enabled');
    fullscreenToggleElement.addEventListener('click', function() {
      screenfull.toggle();
    });
    screenfull.on('change', updateFullscreenToggleState);
  } else {
    document.body.classList.add('fullscreen-disabled');
  }

  // Set handler for scene list toggle.
  sceneListToggleElement.addEventListener('click', toggleSceneList);

  // Start with the scene list open on desktop (unless immersive auto-fullscreen).
  if (!document.body.classList.contains('mobile') && !data.settings.autoFullscreen) {
    showSceneList();
  } else if (data.settings.autoFullscreen) {
    hideSceneList();
  }

  // Set handler for scene switch.
  scenes.forEach(function(scene) {
    var el = document.querySelector('#sceneList .scene[data-id="' + scene.data.id + '"]');
    el.addEventListener('click', function() {
      switchScene(scene);
      // On mobile, hide scene list after selecting a scene.
      if (document.body.classList.contains('mobile')) {
        hideSceneList();
      }
    });
  });

  // DOM elements for view controls.
  var viewUpElement = document.querySelector('#viewUp');
  var viewDownElement = document.querySelector('#viewDown');
  var viewLeftElement = document.querySelector('#viewLeft');
  var viewRightElement = document.querySelector('#viewRight');
  var viewInElement = document.querySelector('#viewIn');
  var viewOutElement = document.querySelector('#viewOut');

  // Dynamic parameters for controls.
  var velocity = 0.7;
  var friction = 3;

  // Associate view controls with elements.
  var controls = viewer.controls();
  controls.registerMethod('upElement',    new Marzipano.ElementPressControlMethod(viewUpElement,     'y', -velocity, friction), true);
  controls.registerMethod('downElement',  new Marzipano.ElementPressControlMethod(viewDownElement,   'y',  velocity, friction), true);
  controls.registerMethod('leftElement',  new Marzipano.ElementPressControlMethod(viewLeftElement,   'x', -velocity, friction), true);
  controls.registerMethod('rightElement', new Marzipano.ElementPressControlMethod(viewRightElement,  'x',  velocity, friction), true);
  controls.registerMethod('inElement',    new Marzipano.ElementPressControlMethod(viewInElement,  'zoom', -velocity, friction), true);
  controls.registerMethod('outElement',   new Marzipano.ElementPressControlMethod(viewOutElement, 'zoom',  velocity, friction), true);

  function sanitize(s) {
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;');
  }

  var prefetched = {};
  function markPrefetched(id, level) {
    prefetched[id] = prefetched[id] || {};
    prefetched[id][level] = true;
  }
  function isPrefetched(id, level) {
    return prefetched[id] && prefetched[id][level];
  }

  function prefetchSceneTiles(sceneData, tileExt) {
    var levels = sceneData.levels || [];
    if (!levels.length) return;
    var levelIndex = levels.length - 1;
    var level = levels[levelIndex];
    if (!level || !level.size || !level.tileSize) return;
    if (isPrefetched(sceneData.id, levelIndex)) return;
    var tilesPerSide = Math.ceil(level.size / level.tileSize);
    var faces = ["f", "b", "u", "d", "l", "r"];
    for (var f = 0; f < faces.length; f++) {
      for (var y = 0; y < tilesPerSide; y++) {
        for (var x = 0; x < tilesPerSide; x++) {
          var img = new Image();
          img.decoding = "async";
          img.src = "tiles/" + sceneData.id + "/" + levelIndex + "/" + faces[f] + "/" + y + "/" + x + "." + tileExt;
        }
      }
    }
    markPrefetched(sceneData.id, levelIndex);
  }

  function prefetchLinkedScenes(sceneData, tileExt) {
    var links = (sceneData.linkHotspots || []).map(function(h) { return h.target; });
    links.forEach(function(targetId) {
      var targetScene = scenes.find(function(s) { return s.data.id === targetId; });
      if (!targetScene) return;
      setTimeout(function() {
        prefetchSceneTiles(targetScene.data, tileExt);
      }, 400);
    });
  }

  var SCENE_TRANSITION_MS = 700;

  function normalizeYawNearCurrent(targetView, currentParams) {
    if (!targetView || !currentParams || typeof currentParams.yaw !== 'number') {
      return targetView;
    }
    var y = targetView.yaw;
    var cur = currentParams.yaw;
    var pi2 = Math.PI * 2;
    while (y - cur > Math.PI) y -= pi2;
    while (y - cur < -Math.PI) y += pi2;
    return {
      yaw: y,
      pitch: targetView.pitch,
      fov: targetView.fov
    };
  }

  function switchScene(scene, tileExt, targetView) {
    viewer.stopMovement();
    viewer.setIdleMovement(Infinity);
    var params = targetView || scene.data.initialViewParameters;
    if (targetView && viewer.view()) {
      params = normalizeYawNearCurrent(targetView, viewer.view().parameters());
    }
    scene.scene.switchTo({ transitionDuration: SCENE_TRANSITION_MS });
    scene.view.setParameters(params, { transitionDuration: SCENE_TRANSITION_MS });
    updateSceneName(scene);
    updateSceneList(scene);
    prefetchSceneTiles(scene.data, tileExt);
    prefetchLinkedScenes(scene.data, tileExt);
  }

  function updateSceneName(scene) {
    sceneNameElement.innerHTML = sanitize(scene.data.name);
  }

  function updateSceneList(scene) {
    for (var i = 0; i < sceneElements.length; i++) {
      var el = sceneElements[i];
      if (el.getAttribute('data-id') === scene.data.id) {
        el.classList.add('current');
      } else {
        el.classList.remove('current');
      }
    }
  }

  function showSceneList() {
    sceneListElement.classList.add('enabled');
    sceneListToggleElement.classList.add('enabled');
  }

  function hideSceneList() {
    sceneListElement.classList.remove('enabled');
    sceneListToggleElement.classList.remove('enabled');
  }

  function toggleSceneList() {
    sceneListElement.classList.toggle('enabled');
    sceneListToggleElement.classList.toggle('enabled');
  }

  function createLinkHotspotElement(hotspot, tileExt) {

    // Create wrapper element to hold icon and tooltip.
    var wrapper = document.createElement('div');
    wrapper.classList.add('hotspot');
    wrapper.classList.add('link-hotspot');

    // Create image element.
    var icon = document.createElement('img');
    icon.src = hotspot.icon || 'img/link.png';
    icon.classList.add('link-hotspot-icon');

    // Set rotation for animated icon (keeps animation in sync).
    icon.style.setProperty('--hotspot-rotation', hotspot.rotation + 'rad');

    // Add click event handler.
    wrapper.addEventListener('click', function() {
    var targetScene = findSceneById(hotspot.target);
      if (targetScene) {
        if(APP_DATA.debug) {
          console.log(hotspot.yaw);
          console.log(hotspot.pitch);
          console.log(hotspot.rotation);
          console.log(hotspot.target);
          console.log(hotspot.icon);

          var lastHotspot = {
            yaw: hotspot.yaw,
            pitch: hotspot.pitch,
            rotation: hotspot.rotation,
            target: hotspot.target,
            icon: hotspot.icon || '',
            targetView: hotspot.targetView || null,
            timestamp: Date.now()
          };

          localStorage.setItem('lastHotspot', JSON.stringify(lastHotspot));
        }
        switchScene(targetScene, tileExt, hotspot.targetView || null);
      }
    });

    // Prevent touch and scroll events from reaching the parent element.
    // This prevents the view control logic from interfering with the hotspot.
    stopTouchAndScrollEventPropagation(wrapper);

    // Create tooltip element.
    var tooltip = document.createElement('div');
    tooltip.classList.add('hotspot-tooltip');
    tooltip.classList.add('link-hotspot-tooltip');
    tooltip.innerHTML = findSceneDataById(hotspot.target).name;

    wrapper.appendChild(icon);
    wrapper.appendChild(tooltip);

    return wrapper;
  }

  function createInfoHotspotElement(hotspot, sceneId) {

    // Create wrapper element to hold icon and tooltip.
    var wrapper = document.createElement('div');
    wrapper.classList.add('hotspot');
    wrapper.classList.add('info-hotspot');

    // Create hotspot/tooltip header.
    var header = document.createElement('div');
    header.classList.add('info-hotspot-header');

    // Create image element.
    var iconWrapper = document.createElement('div');
    iconWrapper.classList.add('info-hotspot-icon-wrapper');
    var icon = document.createElement('img');
    icon.src = hotspot.icon || 'img/info.png';
    icon.classList.add('info-hotspot-icon');
    icon.alt = hotspot.title || '';
    iconWrapper.appendChild(icon);

    // Create title element.
    var titleWrapper = document.createElement('div');
    titleWrapper.classList.add('info-hotspot-title-wrapper');
    var title = document.createElement('div');
    title.classList.add('info-hotspot-title');
    title.innerHTML = hotspot.title;
    titleWrapper.appendChild(title);

    // Create close element.
    var closeWrapper = document.createElement('div');
    closeWrapper.classList.add('info-hotspot-close-wrapper');
    var closeIcon = document.createElement('img');
    closeIcon.src = 'img/close.png';
    closeIcon.classList.add('info-hotspot-close-icon');
    closeWrapper.appendChild(closeIcon);

    // Construct header element.
    header.appendChild(iconWrapper);
    header.appendChild(titleWrapper);
    header.appendChild(closeWrapper);

    // Create text element.
    var text = document.createElement('div');
    text.classList.add('info-hotspot-text');
    text.innerHTML = hotspot.text;

    // Place header and text into wrapper element.
    wrapper.appendChild(header);
    wrapper.appendChild(text);

    // Create a modal for the hotspot content to appear on mobile mode.
    var modal = document.createElement('div');
    modal.innerHTML = wrapper.innerHTML;
    modal.classList.add('info-hotspot-modal');
    document.body.appendChild(modal);

    var toggle = function() {
      var opening = !wrapper.classList.contains('visible');
      wrapper.classList.toggle('visible');
      modal.classList.toggle('visible');
      if (hotspot.type === 'welcome' && sceneId) {
        setAuxiliaryHotspotsVisible(sceneId, !opening);
      }
    };

    // Show content when hotspot is clicked.
    wrapper.querySelector('.info-hotspot-header').addEventListener('click', toggle);

    // Hide content when close icon is clicked.
    modal.querySelector('.info-hotspot-close-wrapper').addEventListener('click', toggle);

    // Prevent touch and scroll events from reaching the parent element.
    // This prevents the view control logic from interfering with the hotspot.
    stopTouchAndScrollEventPropagation(wrapper);

    return wrapper;
  }

  function createWhatsAppHotspotElement(hotspot) {
    var wrapper = document.createElement('div');
    wrapper.classList.add('hotspot');
    wrapper.classList.add('link-hotspot');
    wrapper.classList.add('whatsapp-hotspot');

    var icon = document.createElement('img');
    icon.src = hotspot.icon || 'icons/whatsapp.png';
    icon.classList.add('link-hotspot-icon');
    icon.alt = 'WhatsApp';

    var tooltip = document.createElement('div');
    tooltip.classList.add('hotspot-tooltip');
    tooltip.classList.add('link-hotspot-tooltip');
    tooltip.innerHTML = hotspot.title || 'WhatsApp';

    wrapper.addEventListener('click', function() {
      if (hotspot.url) {
        window.open(hotspot.url, '_blank', 'noopener,noreferrer');
      }
    });

    wrapper.appendChild(icon);
    wrapper.appendChild(tooltip);
    stopTouchAndScrollEventPropagation(wrapper);

    return wrapper;
  }

  function createProductHotspotElement(hotspot, sceneId) {
    var wrapper = document.createElement('div');
    wrapper.classList.add('hotspot');
    wrapper.classList.add('product-hotspot');
    wrapper.classList.add('link-hotspot');

    var icon = document.createElement('img');
    icon.src = hotspot.icon || 'img/shop.png';
    icon.classList.add('link-hotspot-icon');
    icon.classList.add('product-hotspot-icon');
    icon.alt = hotspot.label || 'Menú';
    if (typeof hotspot.rotation === 'number') {
      icon.style.setProperty('--hotspot-rotation', hotspot.rotation + 'rad');
    }

    var tooltip = document.createElement('div');
    tooltip.classList.add('hotspot-tooltip');
    tooltip.classList.add('link-hotspot-tooltip');
    tooltip.innerHTML = hotspot.label || 'Menú';

    wrapper.appendChild(icon);
    wrapper.appendChild(tooltip);

    function openCatalog(e) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      var open = window.MARS2_TOUR && window.MARS2_TOUR.openProductCatalog;
      if (open) {
        open(hotspot.catalogId || '', sceneId || '');
      }
    }

    wrapper.style.cursor = 'pointer';
    wrapper.addEventListener('click', openCatalog);
    wrapper.addEventListener('touchend', function(e) {
      openCatalog(e);
    }, { passive: false });

    stopTouchAndScrollEventPropagation(wrapper);

    return wrapper;
  }

  // Prevent touch and scroll events from reaching the parent element.
  function stopTouchAndScrollEventPropagation(element, eventList) {
    var eventList = [ 'touchstart', 'touchmove', 'touchend', 'touchcancel',
                      'wheel', 'mousewheel' ];
    for (var i = 0; i < eventList.length; i++) {
      element.addEventListener(eventList[i], function(event) {
        event.stopPropagation();
      });
    }
  }

  function findSceneById(id) {
    for (var i = 0; i < scenes.length; i++) {
      if (scenes[i].data.id === id) {
        return scenes[i];
      }
    }
    return null;
  }

  function findSceneDataById(id) {
    for (var i = 0; i < data.scenes.length; i++) {
      if (data.scenes[i].id === id) {
        return data.scenes[i];
      }
    }
    return null;
  }

  // Build scenes after we know the tile format.
  detectTileExt(function(tileExt) {
    if (window.location.protocol === 'file:') {
      console.error(
        '[mars1pano2] Black panorama? Do not open index.html with file://. ' +
        'Copy app-files to htdocs and use http://localhost/your-tour/index.html'
      );
    }
    buildScenes(tileExt);
    // Display the initial scene.
    switchScene(scenes[0], tileExt);
    bindAutoFullscreen();
    // Set handler for scene switch.
    scenes.forEach(function(scene) {
      var el = document.querySelector('#sceneList .scene[data-id="' + scene.data.id + '"]');
      el.addEventListener('click', function() {
        switchScene(scene, tileExt);
        // On mobile, hide scene list after selecting a scene.
        if (document.body.classList.contains('mobile')) {
          hideSceneList();
        }
      });
    });
  });

})();
