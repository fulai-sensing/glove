/* Anonymous, read-only OSS ListObjectsV2 client. No keys or signing credentials. */
(() => {
  'use strict';
  function parsePage(xml, prefix, endpoint) {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const root = doc.documentElement;
    if (doc.querySelector('parsererror') || root.localName !== 'ListBucketResult') throw new Error('Invalid OSS listing');
    const child = (node, name) => [...node.children].find(item => item.localName === name)?.textContent || '';
    const encoded = child(root, 'EncodingType') === 'url';
    const decode = value => encoded ? decodeURIComponent(value) : value;
    const files = [];
    for (const node of [...root.children].filter(item => item.localName === 'Contents')) {
      const key = decode(child(node, 'Key'));
      if (!key.startsWith(prefix) || !/\.json$/i.test(key)) continue;
      const name = key.slice(prefix.length);
      // Preserve subdirectories while excluding path traversal and unsafe ZIP entries.
      if (!name || /[\\\u0000-\u001f\u007f]/.test(name) || name.split('/').some(part => !part || part === '.' || part === '..')) continue;
      const sizeText = child(node, 'Size');
      const size = Number(sizeText);
      if (!/^\d+$/.test(sizeText) || !Number.isSafeInteger(size) || size < 0) throw new Error('Invalid OSS object size');
      const url = new URL('/' + key.split('/').map(encodeURIComponent).join('/'), endpoint).href;
      files.push({ name, size, url, etag: child(node, 'ETag'), modified: child(node, 'LastModified') });
    }
    const truncated = child(root, 'IsTruncated');
    if (!['true', 'false'].includes(truncated)) throw new Error('Invalid OSS pagination');
    const token = decode(child(root, 'NextContinuationToken'));
    if (truncated === 'true' && !token) throw new Error('Missing OSS continuation token');
    return { files, token: truncated === 'true' ? token : '' };
  }
  async function list({ endpoint, prefix }) {
    const base = new URL(endpoint);
    if (base.protocol !== 'https:' || !prefix || !prefix.endsWith('/')) throw new Error('Invalid OSS configuration');
    const files = new Map();
    const seenTokens = new Set();
    let token = '';
    do {
      const url = new URL(base);
      url.search = '';
      url.searchParams.set('list-type', '2');
      url.searchParams.set('prefix', prefix);
      url.searchParams.set('encoding-type', 'url');
      url.searchParams.set('max-keys', '1000');
      if (token) url.searchParams.set('continuation-token', token);
      const response = await fetch(url, { mode: 'cors', credentials: 'omit', cache: 'no-store', signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error(`OSS listing HTTP ${response.status}`);
      const page = parsePage(await response.text(), prefix, base);
      page.files.forEach(file => files.set(file.name, file));
      token = page.token;
      if (token && seenTokens.has(token)) throw new Error('Repeated OSS continuation token');
      if (token) seenTokens.add(token);
    } while (token);
    return [...files.values()].sort((a, b) => a.name.replace(/[-_]/g, '').localeCompare(b.name.replace(/[-_]/g, ''), 'en', { numeric: true }));
  }
  window.FulaiCalibrationCatalog = { list };
})();
