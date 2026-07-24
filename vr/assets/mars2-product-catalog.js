/**
 * mars1pano2 — Catálogo de productos (JSON hoy, API/BD mañana).
 */
(function(global) {
  'use strict';

  var cache = null;
  var cacheUrl = null;
  var escapeHandler = null;

  function catalogUrl() {
    var data = global.APP_DATA;
    if (data && data.settings && data.settings.productCatalogUrl) {
      return data.settings.productCatalogUrl;
    }
    return 'products-catalog.json';
  }

  function getEmbeddedCatalogs() {
    var data = global.APP_DATA;
    return (data && data.productCatalogs) ? data.productCatalogs : null;
  }

  function normalizeCatalog(raw) {
    if (!raw) return { title: 'Menú', subtitle: '', pdf: '', products: [] };
    return {
      title: raw.title || 'Menú',
      subtitle: raw.subtitle || '',
      pdf: raw.pdf || '',
      products: Array.isArray(raw.products) ? raw.products : []
    };
  }

  function loadAllCatalogs() {
    var embedded = getEmbeddedCatalogs();
    if (embedded) return Promise.resolve(embedded);

    var url = catalogUrl();
    if (cache && cacheUrl === url) return Promise.resolve(cache);

    return fetch(url).then(function(res) {
      if (!res.ok) throw new Error('Catalog not found: ' + url);
      return res.json();
    }).then(function(json) {
      cache = json;
      cacheUrl = url;
      return json;
    });
  }

  function resolveCatalogId(catalogId, sceneId) {
    if (catalogId && String(catalogId).trim()) return String(catalogId).trim();
    if (sceneId && String(sceneId).trim()) return String(sceneId).trim();
    return 'default';
  }

  function fetchProductCatalog(catalogId, sceneId) {
    var id = resolveCatalogId(catalogId, sceneId);
    return loadAllCatalogs().then(function(all) {
      if (all[id]) return normalizeCatalog(all[id]);
      if (id !== 'default' && all.default) return normalizeCatalog(all.default);
      return { title: 'Products', products: [] };
    }).catch(function(err) {
      console.warn('[mars1pano2] product catalog:', err);
      return { title: 'Products', products: [] };
    });
  }

  function detachEscapeHandler() {
    if (escapeHandler) {
      document.removeEventListener('keydown', escapeHandler);
      escapeHandler = null;
    }
  }

  function closeProductCatalogModal() {
    detachEscapeHandler();
    var nodes = document.querySelectorAll('.product-catalog-modal');
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].parentNode) nodes[i].parentNode.removeChild(nodes[i]);
    }
    document.body.classList.remove('product-catalog-open');
  }

  function productCountLabel(count) {
    if (count === 1) return '1 plato';
    return count + ' platos';
  }

  function createProductCard(product) {
    var card = document.createElement('article');
    card.className = 'product-catalog-card';

    if (product.image) {
      var img = document.createElement('img');
      img.className = 'product-catalog-image';
      img.src = product.image;
      img.alt = product.name || 'Plato';
      img.loading = 'lazy';
      img.decoding = 'async';
      card.appendChild(img);
    } else {
      var ph = document.createElement('div');
      ph.className = 'product-catalog-image-placeholder';
      ph.textContent = product.category ? product.category : 'Olivo';
      card.appendChild(ph);
    }

    var body = document.createElement('div');
    body.className = 'product-catalog-body';

    if (product.category) {
      var catEl = document.createElement('div');
      catEl.className = 'product-catalog-category';
      catEl.textContent = product.category;
      body.appendChild(catEl);
    }

    var nameEl = document.createElement('h3');
    nameEl.className = 'product-catalog-name';
    nameEl.textContent = product.name || 'Plato';
    body.appendChild(nameEl);

    if (product.description) {
      var descEl = document.createElement('p');
      descEl.className = 'product-catalog-description';
      descEl.textContent = product.description;
      body.appendChild(descEl);
    }

    if (product.price) {
      var priceEl = document.createElement('div');
      priceEl.className = 'product-catalog-price';
      priceEl.textContent = product.price;
      body.appendChild(priceEl);
    }

    card.appendChild(body);
    return card;
  }

  function isCatalogLive() {
    var data = global.APP_DATA;
    return !!(data && data.settings && data.settings.productCatalogLive);
  }

  function renderCatalogPlaceholderModal() {
    closeProductCatalogModal();

    var modal = document.createElement('div');
    modal.className = 'product-catalog-modal visible product-catalog-placeholder';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'product-catalog-title');

    modal.innerHTML =
      '<div class="product-catalog-backdrop" aria-hidden="true"></div>' +
      '<div class="product-catalog-panel">' +
        '<div class="product-catalog-header">' +
          '<div class="product-catalog-header-text">' +
            '<h2 class="product-catalog-title" id="product-catalog-title">Menú</h2>' +
            '<p class="product-catalog-subtitle">Próximamente</p>' +
          '</div>' +
          '<button type="button" class="product-catalog-close" aria-label="Cerrar">&times;</button>' +
        '</div>' +
        '<div class="product-catalog-grid">' +
          '<p class="product-catalog-empty product-catalog-loading-msg">Estamos cargando nuestro menú...</p>' +
        '</div>' +
      '</div>';

    document.body.appendChild(modal);
    document.body.classList.add('product-catalog-open');

    modal.querySelector('.product-catalog-close').addEventListener('click', closeProductCatalogModal);
    modal.querySelector('.product-catalog-backdrop').addEventListener('click', closeProductCatalogModal);

    escapeHandler = function(e) {
      if (e.key === 'Escape' || e.key === 'Esc') closeProductCatalogModal();
    };
    document.addEventListener('keydown', escapeHandler);
  }

  function renderProductCatalogModal(data) {
    closeProductCatalogModal();

    var products = data.products || [];
    var modal = document.createElement('div');
    modal.className = 'product-catalog-modal visible';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'product-catalog-title');

    var pdfBtn = data.pdf
      ? '<a class="product-catalog-pdf" href="' + data.pdf + '" target="_blank" rel="noopener noreferrer">Ver carta completa (PDF)</a>'
      : '';

    modal.innerHTML =
      '<div class="product-catalog-backdrop" aria-hidden="true"></div>' +
      '<div class="product-catalog-panel">' +
        '<div class="product-catalog-header">' +
          '<div class="product-catalog-header-text">' +
            '<h2 class="product-catalog-title" id="product-catalog-title"></h2>' +
            '<p class="product-catalog-subtitle"></p>' +
            pdfBtn +
          '</div>' +
          '<button type="button" class="product-catalog-close" aria-label="Cerrar">&times;</button>' +
        '</div>' +
        '<div class="product-catalog-grid"></div>' +
      '</div>';

    modal.querySelector('.product-catalog-title').textContent = data.title || 'Menú';
    var sub = data.subtitle || productCountLabel(products.length);
    modal.querySelector('.product-catalog-subtitle').textContent = sub;

    var grid = modal.querySelector('.product-catalog-grid');
    products.forEach(function(product) {
      grid.appendChild(createProductCard(product));
    });

    if (!products.length) {
      var empty = document.createElement('p');
      empty.className = 'product-catalog-empty';
      empty.textContent = 'No hay platos en este menú.';
      grid.appendChild(empty);
    }

    document.body.appendChild(modal);
    document.body.classList.add('product-catalog-open');

    modal.querySelector('.product-catalog-close').addEventListener('click', closeProductCatalogModal);
    modal.querySelector('.product-catalog-backdrop').addEventListener('click', closeProductCatalogModal);

    escapeHandler = function(e) {
      if (e.key === 'Escape' || e.key === 'Esc') closeProductCatalogModal();
    };
    document.addEventListener('keydown', escapeHandler);
  }

  function openProductCatalogModal(catalogId, sceneId) {
    if (!isCatalogLive()) {
      renderCatalogPlaceholderModal();
      return Promise.resolve();
    }
    return fetchProductCatalog(catalogId, sceneId).then(renderProductCatalogModal);
  }

  global.MARS2 = global.MARS2 || {};
  global.MARS2.fetchProductCatalog = fetchProductCatalog;
  global.MARS2.openProductCatalogModal = openProductCatalogModal;
  global.MARS2.closeProductCatalogModal = closeProductCatalogModal;

  global.MARS2_TOUR = global.MARS2_TOUR || {};
  global.MARS2_TOUR.openProductCatalog = openProductCatalogModal;
  global.MARS2_TOUR.fetchProductCatalog = fetchProductCatalog;
})(typeof window !== 'undefined' ? window : this);
