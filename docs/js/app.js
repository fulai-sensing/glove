/* Offline documentation; calibration downloads use OSS and locally bundled JSZip. */
(() => {
  'use strict';
  const t = window.FulaiI18n.t;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const pages = $$('.doc-page');
  const pageMap = new Map(pages.map(page => [page.id, page]));
  const navigation = $$('.sidebar nav a[data-page]');
  const order = navigation.map(link => link.dataset.page);
  const workspace = $('.workspace');
  const sidebar = $('#sidebar');
  const menuToggle = $('#menu-toggle');
  const searchDialog = $('#search-dialog');
  const searchInput = $('#search-input');
  const searchResults = $('#search-results');
  const searchStatus = $('#search-status');
  const imageDialog = $('#image-dialog');
  const mobile = window.matchMedia('(max-width: 767px)');
  let activePage;
  let tocObserver;
  let toastTimer;
  let searchTimer;
  let selectedResult = -1;
  let searchLinks = [];

  const escape = value => String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
  const normalize = value => value.toLocaleLowerCase().replace(/\s+/g, ' ').trim();
  const plainText = node => node.textContent.replace(/\s+/g, ' ').trim();

  function notify(message) {
    const toast = $('#toast');
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add('visible');
    toastTimer = setTimeout(() => toast.classList.remove('visible'), 2400);
  }

  function setNavigation(open) {
    document.body.classList.toggle('nav-open', open);
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.setAttribute('aria-label', t(open ? 'Close navigation' : 'Open navigation'));
    sidebar.inert = mobile.matches && !open;
  }
  menuToggle.addEventListener('click', () => setNavigation(!document.body.classList.contains('nav-open')));
  $('#nav-scrim').addEventListener('click', () => { setNavigation(false); menuToggle.focus(); });
  mobile.addEventListener('change', () => setNavigation(false));
  setNavigation(false);

  function showDialog(dialog) {
    $$('dialog[open]').forEach(other => other.close());
    setNavigation(false);
    dialog.showModal();
    document.body.classList.add('dialog-open');
  }
  $$('dialog').forEach(dialog => {
    $$('[data-close-dialog]', dialog).forEach(button => button.addEventListener('click', () => dialog.close()));
    dialog.addEventListener('close', () => {
      if (!$('dialog[open]')) document.body.classList.remove('dialog-open');
    });
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const bounds = dialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
    });
  });

  function renderToc(page) {
    if (tocObserver) tocObserver.disconnect();
    const headings = $$('h2[id], h3[id]', page);
    $('#toc-links').innerHTML = headings.length
      ? headings.map(heading => `<a href="#${heading.id}" class="${heading.tagName === 'H3' ? 'subheading' : ''}">${escape(plainText(heading))}</a>`).join('')
      : `<a href="#${page.id}">${escape(page.dataset.title)}</a>`;
    if (!('IntersectionObserver' in window)) return;
    tocObserver = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting);
      if (!visible.length) return;
      const id = visible[0].target.id;
      $$('#toc-links a').forEach(link => link.classList.toggle('active', link.hash === '#' + id));
    }, { rootMargin: '-90px 0px -55% 0px', threshold: 0 });
    headings.forEach(heading => tocObserver.observe(heading));
  }

  function renderNeighbors(page) {
    const index = order.indexOf(page.id);
    const previous = pageMap.get(order[index - 1]);
    const next = pageMap.get(order[index + 1]);
    $('#page-navigation').innerHTML = page.id === 'overview' ? '' :
      (previous ? `<a class="previous" href="#${previous.id}"><span>${t('Previous')}</span>← ${escape(previous.dataset.title)}</a>` : '') +
      (next ? `<a class="next" href="#${next.id}"><span>${t('Next')}</span>${escape(next.dataset.title)} →</a>` : '');
  }

  function route(initial = false) {
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)) || 'overview'; }
    catch { id = 'overview'; }
    const target = document.getElementById(id);
    const page = target?.closest('.doc-page') || pageMap.get('overview');
    const changed = page !== activePage;
    pages.forEach(item => item.classList.toggle('active', item === page));
    activePage = page;
    document.documentElement.classList.add('js');
    workspace.classList.toggle('home-layout', page.id === 'overview');
    document.title = `${page.dataset.title} | ${t('FULAI Tactile Glove Documentation')}`;
    $('#breadcrumb-title').textContent = page.dataset.title;
    navigation.forEach(link => {
      if (link.dataset.page === page.id) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    setNavigation(false);
    if (changed) { renderToc(page); renderNeighbors(page); }
    if (target?.closest('details')) target.closest('details').open = true;
    if (target && target !== page && page.contains(target)) {
      requestAnimationFrame(() => {
        target.scrollIntoView({ block: 'start', behavior: 'instant' });
        if (!initial) {
          target.setAttribute('tabindex', '-1');
          target.focus({ preventScroll: true });
        }
      });
    } else {
      window.scrollTo({ top: 0, behavior: 'instant' });
      if (!initial) $('h1', page)?.focus({ preventScroll: true });
    }
  }
  window.addEventListener('hashchange', () => route());
  document.addEventListener('click', event => {
    const anchor = event.target.closest('a[href^="#"]');
    if (!anchor || anchor.hash !== location.hash || anchor.classList.contains('skip-link')) return;
    event.preventDefault();
    route();
  });
  // Make direct links to search results reproducible across reloads.
  const searchIndex = [];
  function rebuildSearchIndex() {
    searchIndex.length = 0;
    pages.forEach(page => {
      let heading = page.dataset.title;
      let sectionId = page.id;
      searchIndex.push({ page: page.id, id: page.id, title: page.dataset.title, heading: '', text: plainText($('.lead', page) || $('.hero-copy p', page) || $('p', page) || page).slice(0, 300), isTitle: true });
      $$('h2,h3,p,li,tbody tr,summary,pre code,figcaption,.checklist-item', page).forEach((node, index) => {
        if (node.closest('.article-footer,.home-footer,.code-bar')) return;
        if (node.matches('h2,h3')) {
          heading = plainText(node);
          if (!node.id) node.id = `${page.id}-heading-${index}`;
          sectionId = node.id;
        }
        const text = plainText(node);
        if (!text) return;
        if (!node.id) node.id = `${page.id}-text-${index}`;
        searchIndex.push({ page: page.id, id: node.id, title: page.dataset.title, heading: heading === page.dataset.title ? '' : heading, text, sectionId });
      });
    });
    searchIndex.forEach(entry => { entry.haystack = normalize(entry.title + ' ' + entry.heading + ' ' + entry.text); });
  }
  rebuildSearchIndex();

  function highlighted(text, tokens) {
    // Escape first; highlights are assembled from plain-text offsets, never user HTML.
    const lower = text.toLocaleLowerCase();
    const ranges = [];
    tokens.forEach(token => {
      let start = 0;
      while ((start = lower.indexOf(token, start)) !== -1) {
        ranges.push([start, start + token.length]);
        start += token.length;
      }
    });
    ranges.sort((a, b) => a[0] - b[0]);
    const merged = [];
    ranges.forEach(range => {
      const last = merged[merged.length - 1];
      if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
      else merged.push([...range]);
    });
    let result = '', end = 0;
    merged.forEach(([start, stop]) => {
      result += escape(text.slice(end, start)) + '<mark>' + escape(text.slice(start, stop)) + '</mark>';
      end = stop;
    });
    return result + escape(text.slice(end));
  }

  function selectResult(index) {
    if (!searchLinks.length) return;
    selectedResult = (index + searchLinks.length) % searchLinks.length;
    searchLinks.forEach((link, position) => link.classList.toggle('selected', position === selectedResult));
    searchLinks[selectedResult].scrollIntoView({ block: 'nearest' });
  }

  function renderSearch() {
    const query = normalize(searchInput.value).slice(0, 150);
    const tokens = query.split(' ').filter(Boolean);
    let results;
    if (!query) {
      results = ['quick-start', 'calibration', 'csv', 'tcp', 'troubleshooting'].map(id => searchIndex.find(entry => entry.id === id));
      searchStatus.textContent = t('Popular guides · Search all chapters, specifications, and data fields.');
    } else {
      results = searchIndex.filter(entry => tokens.every(token => entry.haystack.includes(token))).map(entry => {
        const title = normalize(entry.title);
        const heading = normalize(entry.heading);
        const score = tokens.reduce((sum, token) => sum + (title.includes(token) ? 8 : 0) + (heading.includes(token) ? 4 : 0) + (normalize(entry.text).includes(token) ? 2 : 0), 0) + (entry.isTitle ? 3 : 0);
        return { ...entry, score };
      }).sort((a, b) => b.score - a.score);
      const total = results.length;
      results = results.slice(0, 30);
      searchStatus.textContent = total ? t('{total} matching passages', { total }) + (total > 30 ? t(' · Showing the first 30') : '') : t('No matching passages');
    }
    searchResults.innerHTML = results.length ? results.map(entry => {
      const firstMatch = tokens.length ? Math.min(...tokens.map(token => normalize(entry.text).indexOf(token)).filter(index => index >= 0)) : 0;
      const start = Number.isFinite(firstMatch) ? Math.max(0, firstMatch - 70) : 0;
      const snippet = (start > 0 ? '…' : '') + entry.text.slice(start, start + 210) + (entry.text.length > start + 210 ? '…' : '');
      return `<a class="search-result" href="#${entry.id}"><small>${escape(entry.title)}</small><strong>${highlighted(entry.heading || entry.title, tokens)}</strong><p>${highlighted(snippet, tokens)}</p></a>`;
    }).join('') : `<div class="search-empty">${t('No results. Try “COM port”, “calibration”, “Elapsed Time”, or “TCP”.')}</div>`;
    searchLinks = $$('.search-result', searchResults);
    selectedResult = -1;
    searchLinks.forEach(link => link.addEventListener('click', () => {
      searchDialog.close();
      if (link.hash === location.hash) route();
    }));
    if (searchLinks.length) selectResult(0);
  }
  function openSearch() {
    showDialog(searchDialog);
    renderSearch();
    searchInput.focus();
    searchInput.select();
  }
  $('#search-trigger').addEventListener('click', openSearch);
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { searchTimer = null; renderSearch(); }, 100);
  });
  searchDialog.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      selectResult(selectedResult + (event.key === 'ArrowDown' ? 1 : -1));
    } else if (event.key === 'Enter' && event.target === searchInput) {
      event.preventDefault();
      if (searchTimer) { clearTimeout(searchTimer); searchTimer = null; renderSearch(); }
      searchLinks[Math.max(0, selectedResult)]?.click();
    }
  });
  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); openSearch(); }
    if (event.key === 'Escape' && $('dialog[open]')) {
      event.preventDefault();
      $('dialog[open]').close();
      return;
    }
    if (event.key === 'Escape' && document.body.classList.contains('nav-open')) { setNavigation(false); menuToggle.focus(); }
    if (event.key === 'Tab' && mobile.matches && document.body.classList.contains('nav-open')) {
      const links = $$('a[href],button', sidebar);
      if (event.shiftKey && (document.activeElement === links[0] || document.activeElement === menuToggle)) { event.preventDefault(); links.at(-1).focus(); }
      else if (!event.shiftKey && document.activeElement === links.at(-1)) { event.preventDefault(); menuToggle.focus(); }
    }
  });

  $$('.image-link').forEach(link => link.addEventListener('click', event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey) return;
    event.preventDefault();
    const source = $('img', link);
    $('#enlarged-image').src = source.getAttribute('src');
    $('#enlarged-image').alt = source.alt;
    $('#enlarged-image').dataset.figure = link.closest('figure')?.id || '';
    $('#image-dialog-caption').textContent = $('figcaption', link.closest('figure')).textContent;
    imageDialog.classList.remove('zoomed');
    showDialog(imageDialog);
  }));
  $('#enlarged-image').addEventListener('click', () => imageDialog.classList.toggle('zoomed'));

  $$('.copy-button').forEach(button => button.addEventListener('click', async () => {
    const text = $('code', button.closest('.code-block')).textContent;
    let copied = false;
    try { await navigator.clipboard.writeText(text); copied = true; } catch { /* file:// or restricted browser */ }
    if (!copied) {
      const input = document.createElement('textarea');
      input.value = text;
      input.style.cssText = 'position:fixed;top:0;left:-9999px';
      document.body.append(input);
      input.select();
      try { copied = document.execCommand('copy'); } catch { /* use visible code below */ }
      input.remove();
      button.focus({ preventScroll: true });
    }
    notify(t(copied ? 'Copied to clipboard' : 'Copy unavailable. Select and copy the code directly.'));
  }));

  const checkboxes = $$('[data-check]');
  const checklistKey = 'fulai-documentation-v116-checklist';
  try {
    const saved = JSON.parse(localStorage.getItem(checklistKey) || '[]');
    if (Array.isArray(saved)) checkboxes.forEach((checkbox, index) => { checkbox.checked = saved[index] === true; });
  } catch { /* The checklist remains functional without storage. */ }
  function updateChecklist(save = true) {
    const count = checkboxes.filter(checkbox => checkbox.checked).length;
    $('#checklist-count').textContent = t('{count} of {total} checked', { count, total: checkboxes.length }) + (count === checkboxes.length ? t(' · Complete') : '');
    $('#checklist-progress').value = count;
    if (save) {
      try { localStorage.setItem(checklistKey, JSON.stringify(checkboxes.map(checkbox => checkbox.checked))); } catch { /* storage optional */ }
    }
  }
  checkboxes.forEach(checkbox => checkbox.addEventListener('change', () => updateChecklist()));
  $('#reset-checklist').addEventListener('click', () => { checkboxes.forEach(checkbox => { checkbox.checked = false; }); updateChecklist(); notify(t('Checklist reset for a new session')); });
  updateChecklist(false);

  const calibrationPickers = $$('.calibration-downloads');
  const selectedCalibration = new Set();
  const calibrationCatalog = new Map($$('.calibration-file', calibrationPickers[0]).map(row => {
    const link = $('a[download]', row);
    return [link.download, link.getAttribute('href')];
  }));
  const calibrationBundle = $('[data-calibration-bundle]', calibrationPickers[0]).href;
  let downloadingCalibration = false;
  let calibrationStatus = '';
  let calibrationStatusValues = {};
  let calibrationDirectUrl = '';
  const canBatchDownload = location.protocol === 'http:' || location.protocol === 'https:';
  const normalizeCalibration = value => normalize(value).replace(/[-_\s]/g, '');
  function updateCalibrationSelection() {
    calibrationPickers.forEach(picker => {
      const query = normalizeCalibration($('input[type="search"]', picker).value);
      const rows = $$('.calibration-file', picker);
      rows.forEach(row => {
        const input = $('[data-calibration-file]', row);
        row.hidden = !normalizeCalibration(input.dataset.calibrationFile).includes(query);
        input.checked = selectedCalibration.has(input.dataset.calibrationFile);
        input.disabled = downloadingCalibration;
      });
      const visible = rows.filter(row => !row.hidden).map(row => $('[data-calibration-file]', row));
      const visibleCount = visible.filter(input => input.checked).length;
      const selectAll = $('[data-calibration-select-all]', picker);
      selectAll.checked = visible.length > 0 && visibleCount === visible.length;
      selectAll.indeterminate = visibleCount > 0 && visibleCount < visible.length;
      selectAll.disabled = downloadingCalibration || !visible.length;
      $('[data-calibration-count]', picker).textContent = t('{count} selected · {visible} / {total} shown', {
        count: selectedCalibration.size, visible: visible.length, total: calibrationCatalog.size
      });
      $('.calibration-empty', picker).hidden = visible.length > 0;
      const button = $('[data-calibration-download]', picker);
      button.disabled = selectedCalibration.size === 0 || downloadingCalibration;
      button.textContent = downloadingCalibration ? t('Preparing download…') : t('Download selected ({count})', { count: selectedCalibration.size });
      $('[data-calibration-clear]', picker).disabled = !selectedCalibration.size || downloadingCalibration;
      $('[data-calibration-status]', picker).textContent = calibrationStatus ? t(calibrationStatus, calibrationStatusValues) : '';
      const directLink = $('[data-calibration-direct]', picker);
      directLink.hidden = !calibrationDirectUrl;
      if (calibrationDirectUrl) directLink.href = calibrationDirectUrl;
      else directLink.removeAttribute('href');
    });
  }
  function setCalibrationStatus(message, values = {}) {
    calibrationStatus = message;
    calibrationStatusValues = values;
    updateCalibrationSelection();
  }
  function saveCalibration(url, name) {
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    if (new URL(url, location.href).origin !== location.origin && !url.startsWith('blob:')) {
      link.target = '_blank';
      link.rel = 'noopener';
    }
    document.body.append(link);
    link.click();
    link.remove();
  }
  function saveCalibrationBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    saveCalibration(url, name);
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  async function readCalibration(name) {
    const response = await fetch(calibrationCatalog.get(name), {
      mode: 'cors', credentials: 'omit', signal: AbortSignal.timeout(60000)
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${name}`);
    const bytes = await response.arrayBuffer();
    JSON.parse(new TextDecoder().decode(bytes).replace(/^\uFEFF/, ''));
    return bytes;
  }
  async function downloadCalibration(names = [...selectedCalibration]) {
    if (downloadingCalibration || !names.length || !canBatchDownload) return;
    downloadingCalibration = true;
    calibrationDirectUrl = '';
    setCalibrationStatus('Preparing {count} files…', { count: names.length });
    try {
      if (names.length === 1) {
        const bytes = await readCalibration(names[0]);
        saveCalibrationBlob(new Blob([bytes], { type: 'application/json' }), names[0]);
      } else if (names.length === calibrationCatalog.size) {
        saveCalibration(calibrationBundle, 'FULAI_Glove_Calibration_Files.zip');
      } else {
        const zip = new window.JSZip();
        // Limit memory/network pressure and fail the entire selection on any missing file.
        for (const [index, name] of names.entries()) {
          const bytes = await readCalibration(name);
          zip.file('calibration/' + name, bytes);
          setCalibrationStatus('Preparing files: {count} / {total}', { count: index + 1, total: names.length });
        }
        const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } }, metadata => {
          setCalibrationStatus('Creating ZIP: {percent}%', { percent: Math.round(metadata.percent) });
        });
        saveCalibrationBlob(blob, 'FULAI_Glove_Calibration_Selected.zip');
      }
      setCalibrationStatus('Download requests sent. Check your browser’s downloads.');
    } catch {
      if (names.length === 1) calibrationDirectUrl = calibrationCatalog.get(names[0]);
      setCalibrationStatus('Could not prepare the selected files. Check your connection, retry, or use Download all (ZIP).');
    } finally {
      downloadingCalibration = false;
      updateCalibrationSelection();
    }
  }
  calibrationPickers.forEach(picker => {
    $('.calibration-search', picker).hidden = false;
    $('.calibration-selection-bar', picker).hidden = !canBatchDownload;
    $('[data-calibration-download]', picker).hidden = !canBatchDownload;
    $('[data-calibration-clear]', picker).hidden = !canBatchDownload;
    $('[data-calibration-online-hint]', picker).hidden = !canBatchDownload;
    $('[data-calibration-offline-hint]', picker).hidden = canBatchDownload;
    $('input[type="search"]', picker).addEventListener('input', updateCalibrationSelection);
    $$('[data-calibration-file]', picker).forEach(input => {
      input.hidden = !canBatchDownload;
      input.addEventListener('change', () => {
        calibrationDirectUrl = '';
        if (input.checked) selectedCalibration.add(input.dataset.calibrationFile);
        else selectedCalibration.delete(input.dataset.calibrationFile);
        setCalibrationStatus('');
      });
    });
    $('[data-calibration-select-all]', picker).addEventListener('change', event => {
      calibrationDirectUrl = '';
      $$('.calibration-file:not([hidden]) [data-calibration-file]', picker).forEach(input => {
        if (event.target.checked) selectedCalibration.add(input.dataset.calibrationFile);
        else selectedCalibration.delete(input.dataset.calibrationFile);
      });
      setCalibrationStatus('');
    });
    $('[data-calibration-clear]', picker).addEventListener('click', () => {
      calibrationDirectUrl = '';
      selectedCalibration.clear();
      setCalibrationStatus('');
    });
    $('[data-calibration-download]', picker).addEventListener('click', () => downloadCalibration());
    $$('.calibration-file a[download]', picker).forEach(link => link.addEventListener('click', event => {
      if (!canBatchDownload || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      downloadCalibration([link.download]);
    }));
  });
  updateCalibrationSelection();

  let closedDetails = [];
  function preparePrint() {
    const scope = document.body.classList.contains('print-all') ? document : activePage;
    closedDetails = $$('details:not([open])', scope);
    closedDetails.forEach(details => { details.open = true; });
    $$('img', scope).forEach(img => { img.loading = 'eager'; });
  }
  function finishPrint() {
    closedDetails.forEach(details => { details.open = false; });
    closedDetails = [];
    document.body.classList.remove('print-all');
  }
  window.addEventListener('beforeprint', preparePrint);
  window.addEventListener('afterprint', finishPrint);
  $('#print-trigger').addEventListener('click', () => showDialog($('#print-dialog')));
  async function printGuide(all) {
    $('#print-dialog').close();
    document.body.classList.toggle('print-all', all);
    const images = $$('img', all ? document : activePage);
    images.forEach(img => { img.loading = 'eager'; });
    await Promise.allSettled(images.map(img => img.decode()));
    window.print();
  }
  $('#print-current').addEventListener('click', () => printGuide(false));
  $('#print-all').addEventListener('click', () => printGuide(true));

  window.addEventListener('fulai-languagechange', () => {
    document.title = `${activePage.dataset.title} | ${t('FULAI Tactile Glove Documentation')}`;
    $('#breadcrumb-title').textContent = activePage.dataset.title;
    renderToc(activePage);
    renderNeighbors(activePage);
    rebuildSearchIndex();
    updateChecklist(false);
    updateCalibrationSelection();
    setNavigation(document.body.classList.contains('nav-open'));
    if (searchDialog.open) renderSearch();
    const figureId = $('#enlarged-image').dataset.figure;
    const image = figureId ? $(`#${figureId} .image-link img`) : $$('.image-link img').find(item => item.getAttribute('src') === $('#enlarged-image').getAttribute('src'));
    if (imageDialog.open && image) {
      $('#enlarged-image').src = image.getAttribute('src');
      $('#enlarged-image').alt = image.alt;
      $('#image-dialog-caption').textContent = $('figcaption', image.closest('figure')).textContent;
    }
    $('#toast').classList.remove('visible');
  });
  route(true);
})();
