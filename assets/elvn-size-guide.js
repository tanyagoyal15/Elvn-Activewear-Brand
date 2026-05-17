(function() {

  /* ── Size data (inches) ── */
  var BOTTOMS = [
    { size: 'XS', waist: [24, 26], hip: [32, 34] },
    { size: 'S',  waist: [26, 28], hip: [34, 36] },
    { size: 'M',  waist: [28, 30], hip: [36, 38] },
    { size: 'L',  waist: [30, 33], hip: [38, 40] },
    { size: 'XL', waist: [33, 36], hip: [40, 42] },
  ];
  var TOPS = [
    { size: 'XS', overbust: [30, 32], underbust: [26, 28] },
    { size: 'S',  overbust: [32, 34], underbust: [28, 30] },
    { size: 'M',  overbust: [34, 36], underbust: [30, 32] },
    { size: 'L',  overbust: [36, 38], underbust: [32, 34] },
    { size: 'XL', overbust: [38, 40], underbust: [34, 36] },
  ];

  function buildProductSizes() {
    var el = root();
    var raw = el ? (el.dataset.availableSizes || '') : '';
    var bottoms = isBottoms();
    var base = bottoms ? BOTTOMS : TOPS;
    var key1 = bottoms ? 'waist' : 'overbust';
    var key2 = bottoms ? 'hip'   : 'underbust';

    if (!raw) return base;

    var result = [];
    raw.split(',').forEach(function(psize) {
      psize = psize.trim();
      if (!psize) return;
      var parts = psize.split('/').map(function(p) { return p.trim().toUpperCase(); });
      var entries = [];
      for (var pi = 0; pi < parts.length; pi++) {
        for (var bi = 0; bi < base.length; bi++) {
          if (base[bi].size === parts[pi]) { entries.push(base[bi]); break; }
        }
      }
      if (!entries.length) return;
      var entry = { size: psize };
      entry[key1] = [
        Math.min.apply(null, entries.map(function(e) { return e[key1][0]; })),
        Math.max.apply(null, entries.map(function(e) { return e[key1][1]; }))
      ];
      entry[key2] = [
        Math.min.apply(null, entries.map(function(e) { return e[key2][0]; })),
        Math.max.apply(null, entries.map(function(e) { return e[key2][1]; }))
      ];
      result.push(entry);
    });

    return result.length ? result : base;
  }

  /* ── Persistent state (survives DOM replacement) ── */
  var finderUnit = 'in';

  /* ── Always fetch a live reference ── */
  function root() { return document.querySelector('.elvn-sg'); }
  function isBottoms() { var el = root(); return el ? el.dataset.isBottoms === 'true' : false; }

  /* ── Tab activation ── */
  function activateTab(sg, target) {
    sg.querySelectorAll('.elvn-sg__tab').forEach(function(t) {
      var active = t.dataset.tab === target;
      t.classList.toggle('is-active', active);
      t.setAttribute('aria-selected', String(active));
    });
    sg.querySelectorAll('.elvn-sg__panel').forEach(function(p) {
      p.classList.toggle('is-active', p.dataset.panel === target);
    });
  }

  /* ── Unit label update ── */
  function updateUnitLabels(sg) {
    var label = finderUnit === 'cm' ? '(cm)' : '(inches)';
    ['elvn-sg-waist-unit','elvn-sg-hips-unit','elvn-sg-overbust-unit','elvn-sg-underbust-unit'].forEach(function(id) {
      var el = sg.querySelector('#' + id);
      if (el) el.textContent = label;
    });
    /* Toggle height input format */
    var imp = sg.querySelector('.elvn-sg__height-imperial');
    var met = sg.querySelector('.elvn-sg__height-metric');
    if (imp) imp.style.display = finderUnit === 'cm' ? 'none' : '';
    if (met) met.style.display = finderUnit === 'cm' ? ''     : 'none';
  }

  /* ── Read height from inputs → always returns cm (or null) ── */
  function getHeightCm(sg) {
    if (finderUnit === 'cm') {
      var cmEl = sg.querySelector('#elvn-sg-height-cm');
      var v = cmEl && cmEl.value ? parseFloat(cmEl.value) : null;
      return (v && v > 0) ? v : null;
    }
    var ftEl  = sg.querySelector('#elvn-sg-height-ft');
    var inEl  = sg.querySelector('#elvn-sg-height-in-part');
    var ft    = ftEl && ftEl.value !== '' ? parseFloat(ftEl.value) : null;
    var inch  = inEl && inEl.value !== '' ? parseFloat(inEl.value) : 0;
    if (ft === null) return null;
    return (ft * 30.48) + (inch * 2.54);
  }

  /* ── Show form / hide result ── */
  function showForm(sg) {
    var form = sg.querySelector('.elvn-sg__finder-form');
    var res  = sg.querySelector('#elvn-sg-result');
    var err  = sg.querySelector('#elvn-sg-error');
    if (form) form.style.display = '';
    if (res)  res.classList.remove('is-visible');
    if (err)  err.style.display = 'none';
  }

  /* ── Reset everything when modal reopens ── */
  function resetState(sg) {
    showForm(sg);
    finderUnit = 'in';
    sg.querySelectorAll('.elvn-sg__unit-btn[data-finder-unit]').forEach(function(b) {
      b.classList.toggle('is-active', b.dataset.finderUnit === 'in');
    });
    updateUnitLabels(sg);
    sg.querySelectorAll('.elvn-sg__unit-btn[data-unit]').forEach(function(b) {
      b.classList.toggle('is-active', b.dataset.unit === 'in');
    });
    sg.querySelectorAll('td[data-in]').forEach(function(td) { td.textContent = td.dataset.in; });
    /* Clear height inputs */
    ['elvn-sg-height-ft','elvn-sg-height-in-part','elvn-sg-height-cm'].forEach(function(id) {
      var el = sg.querySelector('#' + id); if (el) el.value = '';
    });
    /* Hide length note — commented out, enable if needed
    var ln = sg.querySelector('#elvn-sg-length-note');
    if (ln) ln.style.display = 'none';
    */
    activateTab(sg, 'finder');
  }

  /* ── Conversion ── */
  function toInches(val) { return finderUnit === 'cm' ? val / 2.54 : val; }

  /* ── Recommendation logic ── */
  function recommend(m1, m2, fitPref) {
    var bottoms = isBottoms();
    var data = buildProductSizes();
    var key1 = bottoms ? 'waist' : 'overbust';
    var key2 = bottoms ? 'hip'   : 'underbust';

    if (m1 < data[0][key1][0])             return { size: data[0].size,             confidence: 'good', border: null, edge: 'under' };
    if (m1 > data[data.length-1][key1][1]) return { size: data[data.length-1].size, confidence: 'good', border: null, edge: 'over' };

    var matchIdx = -1;
    for (var i = 0; i < data.length; i++) {
      if (m1 >= data[i][key1][0] && m1 <= data[i][key1][1]) { matchIdx = i; break; }
    }

    if (matchIdx >= 0) {
      var rec = data[matchIdx].size, confidence = 'strong', border = null;
      var atUpperBound = (data[matchIdx][key1][1] - m1) <= 1;

      if (atUpperBound && matchIdx < data.length - 1) {
        var lo = data[matchIdx].size, hi = data[matchIdx + 1].size;
        confidence = 'good';
        rec = fitPref === 'relaxed' ? hi : lo;
        border = { lower: lo, upper: hi };
      }

      if (m2 && m2 > 0) {
        var r2 = data[matchIdx][key2];
        if (r2 && (m2 > r2[1] + 1 || m2 < r2[0] - 1)) {
          confidence = 'good';
        }
      }

      return { size: rec, confidence: confidence, border: border };
    }

    for (var j = 0; j < data.length - 1; j++) {
      if (m1 > data[j][key1][1] && m1 < data[j+1][key1][0]) {
        var blo = data[j].size, bhi = data[j+1].size;
        var boundaryRec = fitPref === 'relaxed' ? bhi : blo;
        return { size: boundaryRec, confidence: 'good', border: { lower: blo, upper: bhi } };
      }
    }
    return { size: data[0].size, confidence: 'good', border: null };
  }

  /* ── Show result panel ── */
  function showResult(sg, result, m1Raw, m2Raw, fitPref, heightCm) {
    var bottoms = isBottoms();
    var displaySize = result.size.indexOf('/') !== -1 ? result.size.replace('/', ' / ') : result.size;

    var resultValueEl = sg.querySelector('#elvn-sg-result-value');
    resultValueEl.textContent = displaySize;
    resultValueEl.dataset.rawSize = result.size;
    sg.querySelector('#elvn-sg-confidence-fill').style.width = result.confidence === 'strong' ? '90%' : '60%';
    sg.querySelector('#elvn-sg-confidence-label').textContent = result.confidence === 'strong' ? 'Strong match' : 'Good match';

    var unitStr = finderUnit === 'cm' ? 'cm' : '"';
    var noteText = 'Based on your ' + (bottoms ? 'waist' : 'overbust') + ' (' + m1Raw + unitStr + ')';
    if (m2Raw) noteText += ' and ' + (bottoms ? 'hips' : 'underbust') + ' (' + m2Raw + unitStr + ')';
    sg.querySelector('#elvn-sg-result-note').textContent = noteText + '.';

    /* Length note — commented out, enable if needed
    var lengthNoteEl = sg.querySelector('#elvn-sg-length-note');
    if (lengthNoteEl) {
      var hc = result.heightCat;
      if (bottoms && hc === 'petite') {
        lengthNoteEl.textContent = 'At your height, full-length leggings may sit slightly above the ankle — a relaxed or cropped style will fit perfectly.';
        lengthNoteEl.style.display = 'block';
      } else if (bottoms && hc === 'tall') {
        lengthNoteEl.textContent = 'At your height, leggings will fit at full ankle length in this size.';
        lengthNoteEl.style.display = 'block';
      } else {
        lengthNoteEl.style.display = 'none';
      }
    }
    */

    var betEl = sg.querySelector('#elvn-sg-between-note');
    var betData = buildProductSizes();
    var betIdx = -1;
    for (var bi = 0; bi < betData.length; bi++) { if (betData[bi].size === result.size) { betIdx = bi; break; } }
    var isLast = betIdx === betData.length - 1;
    if (result.edge === 'under') {
      betEl.innerHTML = '<strong>' + result.size + '</strong> is the smallest size in this product, we recommend going with ' + result.size + '.';
    } else if (result.edge === 'over' || isLast) {
      betEl.innerHTML = '<strong>' + result.size + '</strong> is the largest size in this product, we recommend going with ' + result.size + '.';
    } else if (result.border) {
      betEl.innerHTML = 'Your measurements sit between <strong>' + result.border.lower + '</strong> and <strong>' + result.border.upper + '</strong>.<br>' +
        'For a compressive fit → stay with <strong>' + result.border.lower + '</strong><br>' +
        'For more comfort → go with <strong>' + result.border.upper + '</strong>';
    } else {
      var nxt = betData[betIdx + 1].size;
      betEl.innerHTML = 'For a compressive fit → stay with <strong>' + result.size + '</strong><br>' +
        'For more comfort → go with <strong>' + nxt + '</strong>';
    }
    betEl.classList.add('is-visible');

    sg.querySelector('#elvn-sg-select-btn').textContent = 'Select ' + displaySize + ' & continue';
    sg.querySelector('.elvn-sg__finder-form').style.display = 'none';
    sg.querySelector('#elvn-sg-result').classList.add('is-visible');

    /* ── GA4 tracking ── */
    if (typeof gtag === 'function') {
      var trackData = {
        product_id:       (root() ? (root().dataset.productId || '') : ''),
        product_name:     (root() ? (root().dataset.productName || '') : ''),
        product_type:     bottoms ? 'bottoms' : 'tops',
        recommended_size: displaySize,
        confidence:       result.confidence,
        fit_preference:   fitPref,
        unit:             finderUnit
      };
      trackData.height_cm = heightCm ? Math.round(heightCm) : null;
      if (bottoms) {
        trackData.waist = m1Raw || null;
        trackData.hips  = m2Raw || null;
      } else {
        trackData.bust      = m1Raw || null;
        trackData.underbust = m2Raw || null;
      }
      gtag('event', 'size_recommendation', trackData);
    }
  }

  /* ── Pre-select size on product page ── */
  function preselectOnPage(size) {
    var input = document.querySelector('input.opt-btn[value="' + size + '"]');
    if (input) { input.checked = true; input.dispatchEvent(new Event('change', { bubbles: true })); }
  }

  /* ── Document-level click delegation (works even after DOM replacement) ── */
  document.addEventListener('click', function(e) {
    var sg = root();
    if (!sg) return;

    /* Tab buttons */
    var tab = e.target.closest('.elvn-sg__tab');
    if (tab && sg.contains(tab)) { activateTab(sg, tab.dataset.tab); return; }

    /* Cross-tab links */
    var gotoBtn = e.target.closest('[data-goto-tab]');
    if (gotoBtn && sg.contains(gotoBtn)) { activateTab(sg, gotoBtn.dataset.gotoTab); return; }

    /* Unit toggle — chart */
    var unitBtn = e.target.closest('.elvn-sg__unit-btn[data-unit]');
    if (unitBtn && sg.contains(unitBtn)) {
      sg.querySelectorAll('.elvn-sg__unit-btn[data-unit]').forEach(function(b) { b.classList.remove('is-active'); });
      unitBtn.classList.add('is-active');
      var unit = unitBtn.dataset.unit;
      sg.querySelectorAll('td[data-in]').forEach(function(td) { td.textContent = unit === 'cm' ? td.dataset.cm : td.dataset.in; });
      return;
    }

    /* Unit toggle — finder */
    var funitBtn = e.target.closest('.elvn-sg__unit-btn[data-finder-unit]');
    if (funitBtn && sg.contains(funitBtn)) {
      finderUnit = funitBtn.dataset.finderUnit;
      sg.querySelectorAll('.elvn-sg__unit-btn[data-finder-unit]').forEach(function(b) { b.classList.remove('is-active'); });
      funitBtn.classList.add('is-active');
      updateUnitLabels(sg);
      return;
    }

    /* Find My Size button */
    if (e.target.closest('#elvn-sg-find-btn') && sg.contains(e.target)) {
      var bottoms = isBottoms();
      var errEl = sg.querySelector('#elvn-sg-error');
      errEl.style.display = 'none';
      var m1 = null, m2 = null;
      if (bottoms) {
        var wEl = sg.querySelector('#elvn-sg-waist'), hEl = sg.querySelector('#elvn-sg-hips');
        m1 = wEl && wEl.value ? parseFloat(wEl.value) : null;
        m2 = hEl && hEl.value ? parseFloat(hEl.value) : null;
      } else {
        var oEl = sg.querySelector('#elvn-sg-overbust'), uEl = sg.querySelector('#elvn-sg-underbust');
        m1 = oEl && oEl.value ? parseFloat(oEl.value) : null;
        m2 = uEl && uEl.value ? parseFloat(uEl.value) : null;
      }
      if (!m1 || (!bottoms && !m2)) {
        errEl.style.display = 'block';
        errEl.textContent = (!bottoms && !m2 && m1) ? 'Please enter your underbust measurement.' : 'Please enter your measurements above.';
        return;
      }
      var fitPref = (sg.querySelector('input[name="elvn-fit"]:checked') || {}).value || 'standard';
      var heightCm = getHeightCm(sg);
      if (!heightCm) {
        errEl.style.display = 'block';
        errEl.textContent = 'Please enter your height.';
        return;
      }
      showResult(sg, recommend(toInches(m1), m2 ? toInches(m2) : null, fitPref), m1, m2, fitPref, heightCm);
      return;
    }

    /* Select & continue */
    if (e.target.closest('#elvn-sg-select-btn') && sg.contains(e.target)) {
      var rawSize = sg.querySelector('#elvn-sg-result-value').dataset.rawSize || sg.querySelector('#elvn-sg-result-value').textContent.trim();
      preselectOnPage(rawSize);
      var modal = sg.closest('modal-dialog');
      if (modal) { var cb = modal.querySelector('.js-close-modal'); if (cb) cb.click(); else modal.removeAttribute('open'); }
      return;
    }

    /* Measure again */
    if (e.target.closest('#elvn-sg-remeasure') && sg.contains(e.target)) { showForm(sg); return; }
  });

  /* ── Watch for any modal-dialog gaining 'open' anywhere on the page ── */
  new MutationObserver(function(mutations) {
    for (var i = 0; i < mutations.length; i++) {
      var m = mutations[i];
      if (m.attributeName === 'open' && m.target.tagName.toLowerCase() === 'modal-dialog' && m.target.hasAttribute('open')) {
        var sg = root();
        if (sg && m.target.contains(sg)) { resetState(sg); break; }
      }
    }
  }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['open'] });

})();
