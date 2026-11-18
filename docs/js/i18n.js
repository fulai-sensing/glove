/* Local translations work on file:// as well as static hosting. */
(() => {
  'use strict';
  const key = 'fulai-documentation-language';
  const languages = ['zh', 'en'];
  const normalize = text => text.replace(/\s+/g, ' ').trim();
  // Automatic detection is the initial behavior, not a selectable option.
  // Legacy "auto" preferences and unknown values use the browser default.
  let mode = 'auto';
  try {
    const saved = localStorage.getItem(key);
    if (languages.includes(saved)) mode = saved;
  } catch { /* Language switching also works when storage is unavailable. */ }

  function resolveLanguage() {
    if (mode !== 'auto') return mode;
    const preferred = navigator.languages?.[0] || navigator.language || 'en';
    return /^zh(?:-|$)/i.test(preferred) ? 'zh' : 'en';
  }

  let language = resolveLanguage();
  function t(english, values = {}) {
    const source = normalize(english);
    const translated = language === 'zh' && Object.hasOwn(window.FULAI_ZH || {}, source) ? window.FULAI_ZH[source] : undefined;
    return (translated || english).replace(/\{(\w+)\}/g, (match, name) => values[name] ?? match);
  }

  // Retain original nodes and strings so toggling never destroys controls,
  // event listeners, anchor IDs, code samples, or checklist state.
  const texts = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (!normalize(node.data) || node.parentElement.closest('script,style,pre,code,kbd,noscript,[data-no-translate]')) continue;
    texts.push({ node, english: node.data });
  }
  const attributes = [];
  document.querySelectorAll('[title],[alt],[aria-label],[placeholder],[data-title],meta[name="description"]').forEach(node => {
    if (node.closest('[data-no-translate]')) return;
    ['title', 'alt', 'aria-label', 'placeholder', 'data-title', ...(node.matches('meta') ? ['content'] : [])].forEach(name => {
      if (node.hasAttribute(name)) attributes.push({ node, name, english: node.getAttribute(name) });
    });
  });
  const localizedImages = [...document.querySelectorAll('.image-link[data-zh-src]')];
  const localizedDownloads = [...document.querySelectorAll('[data-zh-href]')];
  function applyLocalizedAssets() {
    localizedImages.forEach(link => {
      const image = link.querySelector('img');
      if (!link.dataset.enHref) link.dataset.enHref = link.getAttribute('href') || '';
      if (image && !image.dataset.enSrc) {
        image.dataset.enSrc = image.getAttribute('src') || '';
        image.dataset.enWidth = image.getAttribute('width') || '';
        image.dataset.enHeight = image.getAttribute('height') || '';
      }
      const source = language === 'zh' ? link.dataset.zhSrc : link.dataset.enHref;
      link.setAttribute('href', source);
      if (image) {
        image.setAttribute('src', language === 'zh' ? link.dataset.zhSrc : image.dataset.enSrc);
        if (language === 'zh') {
          image.removeAttribute('width');
          image.removeAttribute('height');
        } else {
          if (image.dataset.enWidth) image.setAttribute('width', image.dataset.enWidth);
          if (image.dataset.enHeight) image.setAttribute('height', image.dataset.enHeight);
        }
      }
    });
    localizedDownloads.forEach(link => {
      if (!link.dataset.enHref) link.dataset.enHref = link.getAttribute('href') || '';
      if (!link.dataset.enDownload && link.hasAttribute('download')) link.dataset.enDownload = link.getAttribute('download');
      const href = language === 'zh' ? link.dataset.zhHref : link.dataset.enHref;
      link.setAttribute('href', href);
      if (link.dataset.enDownload) link.setAttribute('download', language === 'zh' && link.dataset.zhDownload ? link.dataset.zhDownload : link.dataset.enDownload);
    });
  }
  const selector = document.getElementById('language-mode');
  function apply() {
    language = resolveLanguage();
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
    texts.forEach(({ node, english }) => {
      node.data = language === 'en' ? english : english.replace(/\S(?:[\s\S]*\S)?/, text => t(normalize(text)));
    });
    attributes.forEach(({ node, name, english }) => node.setAttribute(name, t(english)));
    applyLocalizedAssets();
    selector.value = language;
  }
  window.FulaiI18n = { t, get language() { return language; }, get mode() { return mode; } };
  selector.addEventListener('change', () => {
    if (!languages.includes(selector.value)) return;
    mode = selector.value;
    try { localStorage.setItem(key, mode); } catch { /* storage optional */ }
    apply();
    window.dispatchEvent(new Event('fulai-languagechange'));
  });
  window.addEventListener('languagechange', () => {
    if (mode !== 'auto') return;
    apply();
    window.dispatchEvent(new Event('fulai-languagechange'));
  });
  apply();
  document.getElementById('language-control').hidden = false;
})();
