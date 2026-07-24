var APP_DATA = {
  "scenes": [
    {
      "id": "0-fixsys",
      "name": "Salón",
      "levels": [
        {
          "tileSize": 256,
          "size": 256,
          "fallbackOnly": true
        },
        {
          "tileSize": 512,
          "size": 512
        },
        {
          "tileSize": 512,
          "size": 1024
        },
        {
          "tileSize": 512,
          "size": 2048
        }
      ],
      "faceSize": 1472,
      "initialViewParameters": {
        "pitch": 0,
        "yaw": 0,
        "fov": 1.5707963267948966
      },
      "linkHotspots": [
        {
          "yaw": 2.674095307839913,
          "pitch": 0.031836717750415744,
          "rotation": 0,
          "target": "2-calle-maipu",
          "icon": "icons/tree1.png"
        }
      ],
      "infoHotspots": [],
      "productHotspots": [
        {
          "yaw": -0.15,
          "pitch": -0.06,
          "rotation": 0,
          "icon": "icons/breakfast-menu.png",
          "catalogId": "cafeteria",
          "label": "Cafetería"
        },
        {
          "yaw": 0.45,
          "pitch": -0.08,
          "rotation": 0,
          "icon": "icons/kitchen-menu.png",
          "catalogId": "restaurante",
          "label": "Restaurante"
        }
      ]
    },
    {
      "id": "1-ingreso",
      "name": "Ingreso",
      "levels": [
        {
          "tileSize": 256,
          "size": 256,
          "fallbackOnly": true
        },
        {
          "tileSize": 512,
          "size": 512
        },
        {
          "tileSize": 512,
          "size": 1024
        },
        {
          "tileSize": 512,
          "size": 2048
        }
      ],
      "faceSize": 1472,
      "initialViewParameters": {
        "pitch": 0,
        "yaw": 0,
        "fov": 1.5707963267948966
      },
      "linkHotspots": [
        {
          "yaw": 0.16934705746449552,
          "pitch": -0.008755061099304129,
          "rotation": 0,
          "target": "0-fixsys",
          "icon": "icons/welcome.png"
        }
      ],
      "infoHotspots": [],
      "productHotspots": []
    },
    {
      "id": "2-calle-maipu",
      "name": "Exterior",
      "levels": [
        {
          "tileSize": 256,
          "size": 256,
          "fallbackOnly": true
        },
        {
          "tileSize": 512,
          "size": 512
        },
        {
          "tileSize": 512,
          "size": 1024
        },
        {
          "tileSize": 512,
          "size": 2048
        }
      ],
      "faceSize": 1472,
      "initialViewParameters": {
        "pitch": 0,
        "yaw": 0,
        "fov": 1.5707963267948966
      },
      "linkHotspots": [
        {
          "yaw": 0.15637485545708785,
          "pitch": -0.01535318539370678,
          "rotation": 0,
          "target": "1-ingreso",
          "icon": "icons/door.png"
        }
      ],
      "infoHotspots": [],
      "productHotspots": []
    }
  ],
  "name": "Olivo Café Resto",
  "settings": {
    "mouseViewMode": "drag",
    "autorotateEnabled": 0,
    "fullscreenButton": true,
    "autoFullscreen": true,
    "productCatalogLive": true,
    "viewControlButtons": false
  },
  "debug": false
};
