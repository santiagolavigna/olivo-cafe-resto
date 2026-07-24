/**
 * mars1pano2 — WebXR para tour exportado (Quest, emulador Chrome, Android).
 * Requiere window.MARS2_VIEWER (Marzipano.Viewer) en index.js
 */
(function(global) {
  'use strict';

  var xrSession = null;
  var xrRefSpace = null;
  var vrBtn = null;
  var headBase = null;
  var savedIdleMovement = null;
  var savedIdleDuration = null;
  var vrSupported = false;
  var autoEnterAttempted = false;

  function quatToYawPitch(q) {
    var x = q[0], y = q[1], z = q[2], w = q[3];
    var siny = 2 * (w * y + x * z);
    var cosy = 1 - 2 * (y * y + z * z);
    var yaw = Math.atan2(siny, cosy);
    var sinp = 2 * (w * x - y * z);
    var pitch = Math.abs(sinp) >= 1
      ? Math.sign(sinp) * (Math.PI / 2)
      : Math.asin(sinp);
    return { yaw: yaw, pitch: pitch };
  }

  function getViewer() {
    return global.MARS2_VIEWER || null;
  }

  function getSceneView() {
    var viewer = getViewer();
    if (!viewer || !viewer.scene()) return null;
    return viewer.scene().view();
  }

  function clampPitch(pitch) {
    var max = 0.48;
    return Math.max(-max, Math.min(max, pitch));
  }

  function applyHeadPose(orientation) {
    var view = getSceneView();
    if (!view || !headBase) return;

    var head = quatToYawPitch(orientation);
    view.setParameters({
      yaw: headBase.yaw + (head.yaw - headBase.headYaw),
      pitch: clampPitch(headBase.pitch + (head.pitch - headBase.headPitch)),
      fov: headBase.fov
    });
  }

  function onXRFrame(time, frame) {
    var session = frame.session;
    var pose = frame.getViewerPose(xrRefSpace);

    if (pose && pose.transform && pose.transform.orientation) {
      if (!headBase) {
        var view = getSceneView();
        if (view) {
          var p = view.parameters();
          var h = quatToYawPitch(pose.transform.orientation);
          headBase = {
            yaw: p.yaw,
            pitch: p.pitch,
            fov: p.fov,
            headYaw: h.yaw,
            headPitch: h.pitch
          };
        }
      } else {
        applyHeadPose(pose.transform.orientation);
      }
    }

    session.requestAnimationFrame(onXRFrame);
  }

  function pauseViewerDynamics() {
    var viewer = getViewer();
    if (!viewer) return;
    viewer.stopMovement();
    savedIdleMovement = viewer.movement();
    savedIdleDuration = null;
    viewer.setIdleMovement(Infinity);
  }

  function resumeViewerDynamics() {
    var viewer = getViewer();
    if (!viewer) return;
    viewer.stopMovement();
    if (savedIdleMovement) {
      viewer.setIdleMovement(3000, savedIdleMovement);
    }
    savedIdleMovement = null;
  }

  function exitVR() {
    if (xrSession) {
      xrSession.end();
    }
  }

  function onSessionEnd() {
    xrSession = null;
    xrRefSpace = null;
    headBase = null;
    document.body.classList.remove('mars2-in-vr');
    resumeViewerDynamics();
    if (vrBtn) {
      vrBtn.classList.remove('active');
      vrBtn.textContent = 'VR';
    }
  }

  function setupRenderState(session) {
    var canvas = document.querySelector('#pano canvas');
    if (!canvas) return Promise.resolve();

    var gl = canvas.getContext('webgl2', { xrCompatible: true })
      || canvas.getContext('webgl', { xrCompatible: true })
      || canvas.getContext('webgl2')
      || canvas.getContext('webgl');
    if (!gl || !gl.makeXRCompatible) return Promise.resolve();

    return gl.makeXRCompatible().then(function() {
      var layer = new XRWebGLLayer(session, gl);
      session.updateRenderState({ baseLayer: layer });
    }).catch(function(err) {
      console.warn('[mars1pano2] XRWebGLLayer no disponible:', err);
    });
  }

  function requestVrSession() {
    var options = {
      optionalFeatures: ['local-floor', 'local', 'dom-overlay'],
      domOverlay: { root: document.body }
    };

    return navigator.xr.requestSession('immersive-vr', options).catch(function() {
      return navigator.xr.requestSession('immersive-vr', {
        optionalFeatures: ['local-floor', 'local']
      });
    });
  }

  function isQuestBrowser() {
    var ua = navigator.userAgent || '';
    return /Quest|OculusBrowser|Oculus VR|Meta Quest|VR OS/i.test(ua);
  }

  function readAutoVrSetting() {
    var data = global.APP_DATA;
    if (data && data.settings && typeof data.settings.autoVREntry === 'boolean') {
      return data.settings.autoVREntry;
    }
    return null;
  }

  function shouldAutoEnterVr() {
    if (autoEnterAttempted || xrSession) return false;
    if (!vrSupported) return false;

    var forced = readAutoVrSetting();
    if (forced === true) return true;
    if (forced === false) return false;

    if (/\bautovr=1\b/i.test(location.search)) return true;
    return isQuestBrowser();
  }

  function tryAutoEnterVR() {
    if (!shouldAutoEnterVr()) return;
    autoEnterAttempted = true;
    enterVR({ silent: true });
  }

  function armAutoEnterOnNextGesture() {
    if (!shouldAutoEnterVr()) return;

    function onGesture() {
      document.removeEventListener('mousedown', onGesture, true);
      document.removeEventListener('touchstart', onGesture, true);
      tryAutoEnterVR();
    }

    document.addEventListener('mousedown', onGesture, true);
    document.addEventListener('touchstart', onGesture, true);
  }

  function enterVR(opts) {
    opts = opts || {};
    var silent = !!opts.silent;

    var viewer = getViewer();
    if (!viewer) {
      if (!silent) alert('Visor no inicializado.');
      return;
    }
    if (!navigator.xr || !navigator.xr.isSessionSupported) {
      if (!silent) alert('WebXR no está disponible. Usa Meta Quest Browser o Chrome con emulador WebXR.');
      return;
    }

    navigator.xr.isSessionSupported('immersive-vr').then(function(supported) {
      if (!supported) {
        if (!silent) alert('immersive-vr no soportado en este dispositivo.');
        return;
      }
      return requestVrSession();
    }).then(function(session) {
      if (!session) return;

      xrSession = session;
      headBase = null;
      pauseViewerDynamics();
      document.body.classList.add('mars2-in-vr');

      if (vrBtn) {
        vrBtn.classList.add('active');
        vrBtn.textContent = 'Salir VR';
      }

      session.addEventListener('end', onSessionEnd);

      return setupRenderState(session).then(function() {
        return session.requestReferenceSpace('local-floor').catch(function() {
          return session.requestReferenceSpace('local');
        });
      }).then(function(refSpace) {
        xrRefSpace = refSpace;
        session.requestAnimationFrame(onXRFrame);
      });
    }).catch(function(err) {
      console.error('[mars1pano2] VR:', err);
      onSessionEnd();
      if (!silent) {
        alert('No se pudo iniciar VR: ' + (err.message || err));
      }
    });
  }

  function toggleVR() {
    if (xrSession) {
      exitVR();
    } else {
      enterVR();
    }
  }

  function setVrAvailable(available) {
    vrSupported = !!available;
    if (available) {
      document.body.classList.remove('vr-disabled');
      document.body.classList.add('vr-enabled');
      if (isQuestBrowser()) {
        document.body.classList.add('mars2-quest-browser');
      }
      armAutoEnterOnNextGesture();
    } else {
      document.body.classList.remove('vr-enabled');
      document.body.classList.add('vr-disabled');
    }
  }

  function probeVrSupport(callback) {
    if (!navigator.xr || !navigator.xr.isSessionSupported) {
      callback(false);
      return;
    }
    navigator.xr.isSessionSupported('immersive-vr').then(function(supported) {
      callback(!!supported);
    }).catch(function() {
      callback(false);
    });
  }

  function createButton() {
    vrBtn = document.getElementById('mars2VrToggle');
    if (!vrBtn) {
      var tools = document.querySelector('.nav-tools');
      if (!tools) return;
      vrBtn = document.createElement('button');
      vrBtn.type = 'button';
      vrBtn.id = 'mars2VrToggle';
      vrBtn.className = 'nav-icon-btn mars2-vr-btn';
      vrBtn.setAttribute('aria-label', 'Modo VR');
      vrBtn.title = 'Modo VR (WebXR)';
      vrBtn.textContent = 'VR';
      tools.appendChild(vrBtn);
    }
    vrBtn.addEventListener('click', function(e) {
      e.preventDefault();
      toggleVR();
    });
  }

  function init() {
    document.body.classList.add('vr-disabled');
    createButton();
    probeVrSupport(setVrAvailable);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  global.MARS2_TOUR = global.MARS2_TOUR || {};
  global.MARS2_TOUR.enterVR = enterVR;
  global.MARS2_TOUR.exitVR = exitVR;
  global.MARS2_TOUR.tryAutoEnterVR = tryAutoEnterVR;
})(typeof window !== 'undefined' ? window : this);
