document.addEventListener('DOMContentLoaded', function () {
  const form = {
    name: document.getElementById('sg-name'),
    productUrl: document.getElementById('sg-url'),
    image: document.getElementById('sg-image'),
    price: document.getElementById('sg-price'),
    currency: document.getElementById('sg-currency'),
    availability: document.getElementById('sg-availability'),
    description: document.getElementById('sg-description'),
    brand: document.getElementById('sg-brand'),
    sku: document.getElementById('sg-sku'),
    mpn: document.getElementById('sg-mpn'),
    gtin: document.getElementById('sg-gtin'),
    condition: document.getElementById('sg-condition'),
    priceValidUntil: document.getElementById('sg-price-valid-until'),
  };

  if (!form.name) return; // not on this page

  const readinessList = document.getElementById('sgReadinessList');
  const readinessCount = document.getElementById('sgReadinessCount');
  const readinessFill = document.getElementById('sgReadinessFill');
  const outputCode = document.getElementById('sgOutputCode');
  const copyBtn = document.getElementById('sgCopyBtn');
  const fillNote = document.getElementById('sgFillNote');
  const platformInstructions = document.getElementById('sgPlatformInstructions');
  const platformTabs = document.querySelectorAll('.platform-tab');

  let currentPlatform = 'generic';

  // ─── Helpers ──────────────────────────────────────────────────
  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function syntaxHighlight(json) {
    return json
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(
        /("(\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
        function (match) {
          let cls = 'json-number';
          if (/^"/.test(match)) {
            cls = /:$/.test(match) ? 'json-key' : 'json-string';
          } else if (/true|false/.test(match)) {
            cls = 'json-boolean';
          } else if (/null/.test(match)) {
            cls = 'json-null';
          }
          return `<span class="${cls}">${match}</span>`;
        }
      );
  }

  function isValidUrl(value) {
    return /^https?:\/\/.+/i.test((value || '').trim());
  }

  function isValidPrice(value) {
    const v = (value || '').trim();
    return v !== '' && !isNaN(Number(v)) && Number(v) >= 0;
  }

  function gtinKey(digits) {
    if (digits.length === 8) return 'gtin8';
    if (digits.length === 12) return 'gtin12';
    if (digits.length === 14) return 'gtin14';
    return 'gtin13';
  }

  // ─── Schema building ──────────────────────────────────────────
  function buildSchema(v) {
    const schema = {
      '@context': 'https://schema.org/',
      '@type': 'Product',
    };
    if (v.name) schema.name = v.name;
    if (v.image) schema.image = [v.image];
    if (v.description) schema.description = v.description;
    if (v.sku) schema.sku = v.sku;
    if (v.mpn) schema.mpn = v.mpn;
    if (v.brand) schema.brand = { '@type': 'Brand', name: v.brand };
    if (v.gtin) {
      const digits = v.gtin.replace(/\D/g, '');
      if (digits) schema[gtinKey(digits)] = v.gtin;
    }

    const offers = { '@type': 'Offer' };
    if (v.productUrl) offers.url = v.productUrl;
    if (v.currency) offers.priceCurrency = v.currency;
    if (v.price) offers.price = v.price;
    if (v.priceValidUntil) offers.priceValidUntil = v.priceValidUntil;
    if (v.condition) offers.itemCondition = `https://schema.org/${v.condition}`;
    if (v.availability) offers.availability = `https://schema.org/${v.availability}`;
    schema.offers = offers;

    return schema;
  }

  // ─── Platform export templates ─────────────────────────────────
  // These are drop-in snippets using platform template variables, not the
  // form's test data — they pull real data automatically for every product.
  function buildShopifySnippet() {
    return `{% comment %} Save as snippets/product-schema.liquid, then add {% render 'product-schema' %} to your product template {% endcomment %}
<script type="application/ld+json">
{
  "@context": "https://schema.org/",
  "@type": "Product",
  "name": {{ product.title | json }},
  "image": [{{ product.featured_image | image_url: width: 1200 | json }}],
  "description": {{ product.description | strip_html | json }},
  "sku": {{ product.selected_or_first_available_variant.sku | json }},
  "brand": { "@type": "Brand", "name": {{ product.vendor | json }} },
  "offers": {
    "@type": "Offer",
    "url": {{ shop.url | append: product.url | json }},
    "priceCurrency": {{ cart.currency.iso_code | json }},
    "price": {{ product.selected_or_first_available_variant.price | money_without_currency | json }},
    "availability": "https://schema.org/{% if product.selected_or_first_available_variant.available %}InStock{% else %}OutOfStock{% endif %}"
  }
}
</script>`;
  }

  function buildWooCommerceSnippet() {
    return `<?php
// Add to your active theme's functions.php
add_action( 'woocommerce_single_product_summary', 'commerceai_product_schema', 5 );
function commerceai_product_schema() {
    global $product;
    if ( ! is_product() || ! $product ) return;

    $schema = [
        '@context'    => 'https://schema.org/',
        '@type'       => 'Product',
        'name'        => get_the_title(),
        'image'       => [ get_the_post_thumbnail_url( get_the_ID(), 'full' ) ],
        'description' => wp_strip_all_tags( $product->get_short_description() ?: $product->get_description() ),
        'sku'         => $product->get_sku(),
        'offers'      => [
            '@type'         => 'Offer',
            'url'           => get_permalink(),
            'priceCurrency' => get_woocommerce_currency(),
            'price'         => $product->get_price(),
            'availability'  => $product->is_in_stock() ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
        ],
    ];
    echo '<script type="application/ld+json">' . wp_json_encode( $schema ) . '</script>';
}`;
  }

  // ─── Readiness checklist ──────────────────────────────────────
  function getChecks(v) {
    const urlOk = isValidUrl(v.productUrl);
    const imageOk = isValidUrl(v.image);
    const priceOk = isValidPrice(v.price);

    return [
      {
        title: 'Product name',
        desc: 'Required by Google for a valid Product listing.',
        status: v.name.trim() ? 'pass' : 'skip',
        msg: v.name.trim() ? 'Looks good.' : 'Not filled in yet.',
      },
      {
        title: 'Product URL',
        desc: 'Canonical link to the product page.',
        status: urlOk ? 'pass' : v.productUrl.trim() ? 'warn' : 'skip',
        msg: urlOk ? 'Looks good.' : v.productUrl.trim() ? 'Must start with http:// or https://' : 'Not filled in yet.',
      },
      {
        title: 'Image URL',
        desc: 'At least one product image is required.',
        status: imageOk ? 'pass' : v.image.trim() ? 'warn' : 'skip',
        msg: imageOk ? 'Looks good.' : v.image.trim() ? 'Must start with http:// or https://' : 'Not filled in yet.',
      },
      {
        title: 'Price',
        desc: 'Numeric value, no currency symbol.',
        status: priceOk ? 'pass' : v.price.trim() ? 'warn' : 'skip',
        msg: priceOk ? 'Looks good.' : v.price.trim() ? 'Enter a valid non-negative number.' : 'Not filled in yet.',
      },
      {
        title: 'Currency',
        desc: 'ISO 4217 currency code.',
        status: v.currency.trim().length === 3 ? 'pass' : 'skip',
        msg: v.currency.trim().length === 3 ? 'Looks good.' : 'Not set.',
      },
      {
        title: 'Availability',
        desc: 'Stock status shown to shoppers and AI agents.',
        status: v.availability.trim() ? 'pass' : 'skip',
        msg: v.availability.trim() ? 'Looks good.' : 'Not set.',
      },
    ];
  }

  function cardClass(status) {
    if (status === 'pass') return 'check-pass';
    if (status === 'warn') return 'check-warn';
    return 'check-skip';
  }

  function statusIcon(status) {
    if (status === 'pass') return '✅';
    if (status === 'warn') return '⚠️';
    return '⏳';
  }

  function renderReadiness(checks) {
    readinessList.innerHTML = '';
    checks.forEach(function (c) {
      const card = document.createElement('div');
      card.className = `check-card ${cardClass(c.status)}`;
      card.innerHTML = `
        <div class="check-header">
          <span class="check-icon">${statusIcon(c.status)}</span>
          <div class="check-title-group">
            <div class="check-title">${escapeHtml(c.title)}</div>
            <div class="check-desc">${escapeHtml(c.desc)}</div>
          </div>
        </div>
        <div class="check-result-msg">${escapeHtml(c.msg)}</div>
      `;
      readinessList.appendChild(card);
    });

    const passCount = checks.filter(function (c) { return c.status === 'pass'; }).length;
    readinessCount.textContent = `${passCount} of ${checks.length} required fields ready`;
    readinessFill.style.width = `${(passCount / checks.length) * 100}%`;
    return passCount === checks.length;
  }

  // ─── Render loop ──────────────────────────────────────────────
  function render() {
    const v = {
      name: form.name.value,
      productUrl: form.productUrl.value,
      image: form.image.value,
      price: form.price.value,
      currency: form.currency.value,
      availability: form.availability.value,
      description: form.description.value,
      brand: form.brand.value,
      sku: form.sku.value,
      mpn: form.mpn.value,
      gtin: form.gtin.value,
      condition: form.condition.value,
      priceValidUntil: form.priceValidUntil.value,
    };

    const allReady = renderReadiness(getChecks(v));

    if (currentPlatform === 'shopify') {
      const snippet = buildShopifySnippet();
      outputCode.textContent = snippet;
      outputCode.dataset.fullOutput = snippet;
      copyBtn.disabled = false;
      fillNote.style.display = 'none';
      platformInstructions.innerHTML = '<strong>Where this goes:</strong> Shopify Admin → Online Store → Themes → Edit code → create <code>snippets/product-schema.liquid</code> with this content, then add <code>{% render \'product-schema\' %}</code> inside <code>sections/main-product.liquid</code>.';
      return;
    }

    if (currentPlatform === 'woocommerce') {
      const snippet = buildWooCommerceSnippet();
      outputCode.textContent = snippet;
      outputCode.dataset.fullOutput = snippet;
      copyBtn.disabled = false;
      fillNote.style.display = 'none';
      platformInstructions.innerHTML = '<strong>Where this goes:</strong> WordPress Admin → Appearance → Theme File Editor → your active theme\'s <code>functions.php</code>. Paste at the end of the file. If Yoast SEO or Rank Math already outputs Product schema, disable one to avoid duplicate schema blocks.';
      return;
    }

    // Generic (default)
    const schema = buildSchema(v);
    const jsonString = JSON.stringify(schema, null, 2);
    const scriptTag = `<script type="application/ld+json">\n${jsonString}\n</script>`;

    outputCode.innerHTML = syntaxHighlight(jsonString);
    outputCode.dataset.fullOutput = scriptTag;

    copyBtn.disabled = !allReady;
    fillNote.style.display = allReady ? 'none' : 'block';
    platformInstructions.innerHTML = '';
  }

  platformTabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      platformTabs.forEach(function (t) { t.classList.remove('active'); });
      tab.classList.add('active');
      currentPlatform = tab.dataset.platform;
      render();
    });
  });

  Object.keys(form).forEach(function (key) {
    if (form[key]) form[key].addEventListener('input', render);
  });

  // ─── Copy to clipboard ────────────────────────────────────────
  copyBtn.addEventListener('click', function () {
    const text = outputCode.dataset.fullOutput || '';
    const done = function () {
      copyBtn.classList.add('copied');
      copyBtn.textContent = 'Copied';
      setTimeout(function () {
        copyBtn.classList.remove('copied');
        copyBtn.textContent = 'Copy code';
      }, 1800);
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(function () {
        fallbackCopy(text, done);
      });
    } else {
      fallbackCopy(text, done);
    }
  });

  function fallbackCopy(text, done) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); done(); } catch (e) { /* no-op */ }
    document.body.removeChild(ta);
  }

  render();
});
