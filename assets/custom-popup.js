

(function () {
  'use strict';

  const overlay = document.getElementById('custom-popup-overlay');
  const closeBtn = document.getElementById('custom-popup-close');
  const imageEl = document.getElementById('custom-popup-image');
  const titleEl = document.getElementById('custom-popup-title');
  const priceEl = document.getElementById('custom-popup-price');
  const descriptionEl = document.getElementById('custom-popup-description');
  const colorWrap = document.getElementById('custom-popup-color-wrap');
  const colorOptionsEl = document.getElementById('custom-popup-color-options');
  const sizeWrap = document.getElementById('custom-popup-size-wrap');
  const sizeSelect = document.getElementById('custom-popup-size-select');
  const addToCartBtn = document.getElementById('custom-popup-add-to-cart');
  const messageEl = document.getElementById('custom-popup-message');

  // ---- State for the currently open product ----
  let currentProduct = null;
  let selectedOptions = {}; 

  const BUNDLE_TRIGGER_OPTIONS = { color: 'black', size: 'medium' };
  const BUNDLE_PRODUCT_HANDLE = 'soft-winter-jacket';
  let bundleProductVariantId = null;


  fetch(`/products/${BUNDLE_PRODUCT_HANDLE}.js`)
    .then((res) => (res.ok ? res.json() : null))
    .then((product) => {
      if (product && product.variants && product.variants.length) {
        bundleProductVariantId = product.variants[0].id;
      }
    })
    .catch(() => {
      console.warn('Could not preload bundle product:', BUNDLE_PRODUCT_HANDLE);
    });


  document.addEventListener('click', function (event) {
    const trigger = event.target.closest('[data-popup-trigger]');
    if (!trigger) return;

    const handle = trigger.dataset.productHandle;
    if (!handle) return;

    openPopupForProduct(handle);
  });

  function openPopupForProduct(handle) {
    resetMessage();
    setLoadingState(true);
    overlay.hidden = false;
    document.body.style.overflow = 'hidden'; 

    fetch(`/products/${handle}.js`)
      .then((res) => {
        if (!res.ok) throw new Error('Product not found');
        return res.json();
      })
      .then((product) => {
        currentProduct = product;
        selectedOptions = {};
        renderProduct(product);
      })
      .catch(() => {
        showMessage('Could not load this product. Please try again.', 'error');
      })
      .finally(() => {
        setLoadingState(false);
      });
  }

  function setLoadingState(isLoading) {
    overlay.classList.toggle('is-loading', isLoading);
  }

  function renderProduct(product) {
    imageEl.src = product.featured_image || (product.images[0] || '');
    imageEl.alt = product.title;
    titleEl.textContent = product.title;
    priceEl.textContent = formatMoney(product.price);
    descriptionEl.innerHTML = product.description || '';

    renderOptions(product);
    updateAddToCartState();
  }

  function renderOptions(product) {
    colorOptionsEl.innerHTML = '';
    sizeSelect.innerHTML = '<option value="">Choose your size</option>';


    const colorOption = product.options_with_values.find((opt) =>
      opt.name.toLowerCase() === 'color'
    );
    const sizeOption = product.options_with_values.find((opt) =>
      opt.name.toLowerCase() === 'size'
    );


    colorWrap.hidden = !colorOption;
    sizeWrap.hidden = !sizeOption;

    if (colorOption) {
      colorOption.values.forEach((value) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'custom-popup__swatch';
        btn.textContent = value;
        btn.dataset.optionName = colorOption.name;
        btn.dataset.optionValue = value;
        btn.addEventListener('click', onOptionSelect);
        colorOptionsEl.appendChild(btn);
      });
    }

    if (sizeOption) {
      sizeOption.values.forEach((value) => {
        const opt = document.createElement('option');
        opt.value = value;
        opt.textContent = value;
        sizeSelect.appendChild(opt);
      });
      sizeSelect.onchange = function () {
        selectedOptions[sizeOption.name] = sizeSelect.value;
        refreshAvailability();
        updateAddToCartState();
      };
    }

    refreshAvailability();
  }

  function onOptionSelect(event) {
    const btn = event.currentTarget;
    const name = btn.dataset.optionName;
    const value = btn.dataset.optionValue;

    selectedOptions[name] = value;

    // Update the .is-selected class across all swatch buttons for this option
    colorOptionsEl.querySelectorAll('.custom-popup__swatch').forEach((el) => {
      el.classList.toggle('is-selected', el.dataset.optionValue === value);
    });

    refreshAvailability();
    updateAddToCartState();
  }


  function findMatchingVariant() {
    if (!currentProduct) return undefined;

    return currentProduct.variants.find((variant) => {
      return currentProduct.options.every((optionName, index) => {
        const key = `option${index + 1}`;
        // If this option hasn't been selected yet, don't filter on it
        if (!selectedOptions[optionName]) return true;
        return variant[key] === selectedOptions[optionName];
      });
    });
  }

  function refreshAvailability() {
    if (!currentProduct) return;

    colorOptionsEl.querySelectorAll('.custom-popup__swatch').forEach((btn) => {
      const name = btn.dataset.optionName;
      const value = btn.dataset.optionValue;

      const testOptions = Object.assign({}, selectedOptions, {
        [name]: value,
      });

      const stillPossible = currentProduct.variants.some((variant) => {
        return currentProduct.options.every((optionName, index) => {
          const key = `option${index + 1}`;
          const wanted = testOptions[optionName];
          if (!wanted) return true;
          return variant[key] === wanted;
        });
      });

      btn.disabled = !stillPossible;
    });
  }

  function updateAddToCartState() {
    const variant = findMatchingVariant();
    const allOptionsSelected = currentProduct.options.every(
      (name) => !!selectedOptions[name]
    );

    const isAvailable = variant && variant.available;
    addToCartBtn.disabled = !(allOptionsSelected && isAvailable);

    if (allOptionsSelected && variant && !variant.available) {
      showMessage('This combination is sold out.', 'error');
    } else {
      resetMessage();
    }
  }

  addToCartBtn.addEventListener('click', function () {
    const variant = findMatchingVariant();
    if (!variant || !variant.available) return;

    addToCartBtn.disabled = true;
    resetMessage();

    const items = [{ id: variant.id, quantity: 1 }];

    const isTriggerCombo =
      matchesOptionValue(variant, 'color', BUNDLE_TRIGGER_OPTIONS.color) &&
      matchesOptionValue(variant, 'size', BUNDLE_TRIGGER_OPTIONS.size);

    if (isTriggerCombo && bundleProductVariantId) {
      items.push({ id: bundleProductVariantId, quantity: 1 });
    }

    fetch('/cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Add to cart failed');
        return res.json();
      })
      .then(() => {
        const successMsg = isTriggerCombo && bundleProductVariantId
          ? 'Added to cart! We also added a free Soft Winter Jacket.'
          : 'Added to cart!';
        showMessage(successMsg, 'success');
        document.dispatchEvent(new CustomEvent('cart:updated'));
      })
      .catch(() => {
        showMessage('Something went wrong. Please try again.', 'error');
      })
      .finally(() => {
        addToCartBtn.disabled = false;
      });
  });

  function matchesOptionValue(variant, optionNameLower, expectedValueLower) {
    const optionIndex = currentProduct.options.findIndex(
      (name) => name.toLowerCase() === optionNameLower
    );
    if (optionIndex === -1) return false;

    const key = `option${optionIndex + 1}`;
    const actualValue = variant[key];
    return (
      typeof actualValue === 'string' &&
      actualValue.toLowerCase() === expectedValueLower
    );
  }

  closeBtn.addEventListener('click', closePopup);
  overlay.addEventListener('click', function (event) {
    if (event.target === overlay) closePopup(); 
  });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && !overlay.hidden) closePopup();
  });

  function closePopup() {
    overlay.hidden = true;
    document.body.style.overflow = '';
    currentProduct = null;
    selectedOptions = {};
  }

  function showMessage(text, type) {
    messageEl.textContent = text;
    messageEl.className = 'custom-popup__message' + (type ? ` is-${type}` : '');
  }

  function resetMessage() {
    messageEl.textContent = '';
    messageEl.className = 'custom-popup__message';
  }

  function formatMoney(cents) {
    const amount = (cents / 100).toFixed(2).replace('.', ',');
    return `${amount}€`;
  }
})();