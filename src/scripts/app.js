/**
 * UCP Compliance Checker — Frontend Application Logic
 * Handles URL input, API calls, result rendering, and UI animations.
 */

import { runChecks } from './checks.js';

(function () {
  'use strict';

  // ─── DOM References ────────────────────────────────────────────────
  const scanForm = document.getElementById('scanForm');
  const urlInput = document.getElementById('urlInput');
  const scanBtn = scanForm.querySelector('.scan-button');

  const loadingSection = document.getElementById('loadingSection');
  const resultsSection = document.getElementById('resultsSection');
  const errorSection = document.getElementById('errorSection');

  // Loading steps
  const steps = [
    document.getElementById('step1'),
    document.getElementById('step2'),
    document.getElementById('step3'),
    document.getElementById('step4')
  ];
  const stepLines = loadingSection.querySelectorAll('.step-line');

  // Score elements (SVG circle r=80, circumference = 2πr ≈ 502.65)
  const gaugeFill = document.getElementById('gaugeFill');
  const scoreValue = document.getElementById('scoreValue');
  const statusBadge = document.getElementById('statusBadge');
  const scannedUrlDisplay = document.getElementById('scannedUrlDisplay');
  const CIRCUMFERENCE = 2 * Math.PI * 80; // ~502.65

  // Stats
  const statPass = document.getElementById('statPass');
  const statWarn = document.getElementById('statWarn');
  const statFail = document.getElementById('statFail');

  // Checks grid
  const checksGrid = document.getElementById('checksGrid');

  // Raw JSON
  const toggleJsonBtn = document.getElementById('toggleJsonBtn');
  const rawJsonContainer = document.getElementById('rawJsonContainer');
  const rawJson = document.getElementById('rawJson');

  // Error
  const errorTitle = document.getElementById('errorTitle');
  const errorMessage = document.getElementById('errorMessage');
  const tryAgainBtn = document.getElementById('tryAgainBtn');

  // ─── Constants ─────────────────────────────────────────────────────
  const API_ENDPOINT = '/api/check';

  // ─── State ─────────────────────────────────────────────────────────
  let lastUrl = '';

  // ─── URL Helpers ───────────────────────────────────────────────────
  function normalizeUrl(input) {
    let url = input.trim();
    url = url.replace(/^https?:\/\//, '');
    url = url.replace(/\/.*$/, '');
    return url;
  }

  function isValidDomain(domain) {
    const domainRegex = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
    return domainRegex.test(domain);
  }

  // ─── Section Visibility ────────────────────────────────────────────
  function showSection(section) {
    [loadingSection, resultsSection, errorSection].forEach(s => {
      if (s) s.hidden = true;
    });
    if (section) {
      section.hidden = false;
      setTimeout(() => {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }

  // ─── Loading Steps ─────────────────────────────────────────────────
  function resetLoadingSteps() {
    steps.forEach(s => {
      if (s) {
        s.classList.remove('active', 'done');
      }
    });
    stepLines.forEach(l => l.classList.remove('done'));
  }

  function advanceLoadingStep(index) {
    steps.forEach((step, i) => {
      if (!step) return;
      if (i < index) {
        step.classList.remove('active');
        step.classList.add('done');
      } else if (i === index) {
        step.classList.add('active');
        step.classList.remove('done');
      } else {
        step.classList.remove('active', 'done');
      }
    });
    // Activate step lines for completed steps
    stepLines.forEach((line, i) => {
      if (i < index) {
        line.classList.add('done');
      } else {
        line.classList.remove('done');
      }
    });
  }

  // ─── API Call ──────────────────────────────────────────────────────
  async function checkStore(domain) {
    const url = `${API_ENDPOINT}?url=${encodeURIComponent(domain)}`;
    const response = await fetch(url);
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Server error: ${response.status}`);
    }
    return response.json();
  }

  // ─── Score Rendering ───────────────────────────────────────────────
  function animateScore(score) {
    const offset = CIRCUMFERENCE - (score / 100) * CIRCUMFERENCE;

    // Set initial state
    gaugeFill.style.strokeDasharray = `${CIRCUMFERENCE}`;
    gaugeFill.style.strokeDashoffset = `${CIRCUMFERENCE}`;

    // Determine color
    let color;
    if (score >= 80) color = 'var(--accent-green)';
    else if (score >= 50) color = 'var(--accent-amber)';
    else color = 'var(--accent-red)';

    gaugeFill.style.stroke = color;

    // Animate after brief delay to trigger transition
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        gaugeFill.style.strokeDashoffset = `${offset}`;
      });
    });

    // Count up animation
    animateCounter(scoreValue, 0, Math.round(score), 1200);
  }

  function animateCounter(element, start, end, duration) {
    const startTime = performance.now();
    function update(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      const current = Math.round(start + (end - start) * eased);
      element.textContent = current;
      if (progress < 1) {
        requestAnimationFrame(update);
      }
    }
    requestAnimationFrame(update);
  }

  function setStatusBadge(status) {
    statusBadge.className = 'status-badge';
    switch (status) {
      case 'compliant':
        statusBadge.textContent = '✅ COMPLIANT';
        statusBadge.classList.add('status-compliant');
        break;
      case 'partial':
        statusBadge.textContent = '⚠️ PARTIAL';
        statusBadge.classList.add('status-partial');
        break;
      default:
        statusBadge.textContent = '❌ NON-COMPLIANT';
        statusBadge.classList.add('status-non-compliant');
    }
  }

  // ─── Check Card Rendering ─────────────────────────────────────────
  function getStatusIcon(status) {
    switch (status) {
      case 'pass': return '<span class="check-icon text-green">✓</span>';
      case 'warn': return '<span class="check-icon text-amber">⚠</span>';
      case 'fail': return '<span class="check-icon text-red">✕</span>';
      case 'skip': return '<span class="check-icon text-muted">—</span>';
      default: return '';
    }
  }

  function getSeverityClass(label) {
    switch (label) {
      case 'Critical': return 'severity-critical';
      case 'Major': return 'severity-major';
      case 'Minor': return 'severity-minor';
      case 'Recommended': return 'severity-recommended';
      default: return '';
    }
  }

  function getCheckCardClass(status) {
    switch (status) {
      case 'pass': return 'check-pass';
      case 'warn': return 'check-warn';
      case 'fail': return 'check-fail';
      case 'skip': return 'check-skip';
      default: return '';
    }
  }

  function renderCheckCard(result, index) {
    const card = document.createElement('div');
    const status = result.resultStatus;
    card.className = `check-card ${getCheckCardClass(status)}`;
    card.style.animationDelay = `${index * 60}ms`;

    card.innerHTML = `
      <div class="check-header">
        ${getStatusIcon(status)}
        <div class="check-title-group">
          <div class="check-title">${escapeHtml(result.name)}</div>
          <div class="check-desc">${escapeHtml(result.description)}</div>
        </div>
        <span class="severity-badge ${getSeverityClass(result.severity.label)}">${result.severity.label}</span>
      </div>
      <div class="check-result-msg">${escapeHtml(result.resultMessage)}</div>
      <div class="check-detail">${escapeHtml(result.resultDetail || '')}</div>
    `;

    return card;
  }

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ─── Raw JSON Rendering ────────────────────────────────────────────
  function renderRawJson(data) {
    if (!data) {
      rawJson.textContent = 'No data received';
      return;
    }
    try {
      const formatted = JSON.stringify(data, null, 2);
      rawJson.innerHTML = syntaxHighlight(formatted);
    } catch (e) {
      rawJson.textContent = String(data);
    }
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

  // ─── Results Rendering ─────────────────────────────────────────────
  function renderResults(apiResponse) {
    // Run checks from checks.js
    const report = runChecks(apiResponse);

    // Score gauge
    animateScore(report.score);
    setStatusBadge(report.status);
    scannedUrlDisplay.textContent = apiResponse.url || lastUrl;

    // Stats
    statPass.textContent = report.passed;
    statWarn.textContent = report.warnings;
    statFail.textContent = report.failed;

    // Check cards
    checksGrid.innerHTML = '';
    report.results.forEach((result, index) => {
      checksGrid.appendChild(renderCheckCard(result, index));
    });

    // Raw JSON
    renderRawJson(apiResponse.data);

    showSection(resultsSection);
  }

  // ─── Error Rendering ───────────────────────────────────────────────
  function renderError(error) {
    errorTitle.textContent = 'Scan Failed';
    errorMessage.textContent = error.message || 'An unexpected error occurred. Please try again.';
    showSection(errorSection);
  }

  // ─── Main Scan Flow ────────────────────────────────────────────────
  async function performScan(domain) {
    lastUrl = domain;

    // Reset & show loading
    resetLoadingSteps();
    showSection(loadingSection);
    scanBtn.disabled = true;
    scanBtn.classList.add('scanning');

    try {
      // Step 1: Connecting
      advanceLoadingStep(0);
      await delay(400);

      // Step 2: Fetching
      advanceLoadingStep(1);
      const apiResponse = await checkStore(domain);

      // Step 3: Analyzing
      advanceLoadingStep(2);
      await delay(600);

      // Step 4: Done
      advanceLoadingStep(3);
      await delay(300);

      // Render results
      renderResults(apiResponse);
    } catch (error) {
      renderError(error);
    } finally {
      scanBtn.disabled = false;
      scanBtn.classList.remove('scanning');
    }
  }

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ─── Event Listeners ──────────────────────────────────────────────
  scanForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const domain = normalizeUrl(urlInput.value);

    if (!domain) {
      urlInput.focus();
      shakeInput();
      return;
    }

    if (!isValidDomain(domain)) {
      shakeInput();
      showNotification('Please enter a valid domain name (e.g., store.example.com)', 'error');
      return;
    }

    performScan(domain);
  });

  function shakeInput() {
    const wrapper = urlInput.parentElement;
    wrapper.classList.add('shake');
    setTimeout(() => wrapper.classList.remove('shake'), 600);
  }

  // Retry button
  if (tryAgainBtn) {
    tryAgainBtn.addEventListener('click', () => {
      if (lastUrl) {
        performScan(lastUrl);
      } else {
        showSection(null);
        urlInput.focus();
      }
    });
  }

  // Raw JSON toggle
  if (toggleJsonBtn) {
    toggleJsonBtn.addEventListener('click', () => {
      const isHidden = rawJsonContainer.hidden;
      rawJsonContainer.hidden = !isHidden;
      toggleJsonBtn.classList.toggle('open', isHidden);
      toggleJsonBtn.querySelector('span').textContent =
        isHidden ? 'Hide Raw UCP Profile' : 'View Raw UCP Profile';
    });
  }

  // ─── Notification Toast ────────────────────────────────────────────
  function showNotification(message, type = 'info') {
    const existing = document.querySelector('.notification-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `notification-toast notification-${type}`;
    toast.innerHTML = `
      <span>${escapeHtml(message)}</span>
      <button class="notification-close" aria-label="Close">&times;</button>
    `;
    document.body.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('visible'));

    const close = () => {
      toast.classList.remove('visible');
      setTimeout(() => toast.remove(), 300);
    };
    toast.querySelector('.notification-close').addEventListener('click', close);
    setTimeout(close, 4000);
  }

})();
