/* Run with: node --test docs/tests/language.test.cjs (Playwright required). */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const url = pathToFileURL(path.resolve(__dirname, '../index.html')).href;
const storageKey = 'fulai-documentation-language';
const calibrationManifest = require('./fixtures/calibration-files.json');
// Small independent fixtures: these tests do not need the legacy local originals.
const calibrationFixtures = new Map(calibrationManifest.files.map(file => [file.name,
  Buffer.from(JSON.stringify({ glove_version: file.version, hand: file.hand, fixture: file.name, values: [1, 2, 3] }))
]));
let calibrationZipFixture;
const xmlEscape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&apos;'}[char]));
function listingXml(files, token = '') {
  return `<ListBucketResult><EncodingType>url</EncodingType>${files.map(file => `<Contents><Key>${xmlEscape(encodeURIComponent('fulai_sensing_glove/calibration/' + file.name))}</Key><Size>${file.size || 1}</Size><ETag>${xmlEscape(file.etag || 'original')}</ETag><LastModified>2026-11-20T00:00:00Z</LastModified></Contents>`).join('')}<IsTruncated>${Boolean(token)}</IsTruncated>${token ? `<NextContinuationToken>${xmlEscape(encodeURIComponent(token))}</NextContinuationToken>` : ''}</ListBucketResult>`;
}
async function waitForCatalog(page) {
  await page.waitForFunction(() => document.querySelector('#sources [data-calibration-bundle]').disabled === false);
}
let browser;
let server;
let hostedUrl;

before(async () => {
  const zip = new (require('jszip'))();
  for (const [name, bytes] of calibrationFixtures) zip.file('calibration/' + name, bytes);
  calibrationZipFixture = await zip.generateAsync({ type: 'nodebuffer' });
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
  const fs = require('node:fs/promises');
  const root = path.resolve(__dirname, '..');
  server = require('node:http').createServer(async (request, response) => {
    if (request.url.startsWith('/downloads/calibration')) { response.writeHead(410).end('Calibration files are on OSS'); return; }
    const file = path.resolve(root, '.' + decodeURIComponent(new URL(request.url, 'http://localhost').pathname));
    if (!file.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
    try {
      const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
      response.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
      response.end(await fs.readFile(file));
    } catch { response.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  hostedUrl = `http://127.0.0.1:${server.address().port}/index.html`;
});
after(async () => {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
});

async function open(t, locale, setup) {
  const context = await browser.newContext({ locale, reducedMotion: 'reduce' });
  t.after(() => context.close());
  if (setup) await context.addInitScript(setup);
  await context.route('https://oss.fulai.studio/fulai_sensing_glove/**', async route => {
    const requested = route.request().url();
    if (requested === calibrationManifest.bundleUrl) {
      await route.fulfill({ status: 200, contentType: 'application/zip', body: calibrationZipFixture });
      return;
    }
    const name = decodeURIComponent(requested.slice(calibrationManifest.baseUrl.length));
    const bytes = requested.startsWith(calibrationManifest.baseUrl) && calibrationFixtures.get(name);
    await route.fulfill({ status: bytes ? 200 : 404, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: bytes || 'missing' });
  });
  await context.route('https://oss.fulai.studio/?**', route => route.fulfill({
    status: 200, contentType: 'application/xml', headers: { 'Access-Control-Allow-Origin': '*' },
    body: listingXml([...calibrationFixtures].map(([name, bytes]) => ({ name, size: bytes.length })))
  }));
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const localCalibrationRequests = [];
  page.on('request', request => {
    if (/\/downloads\/calibration(?:\/|\.zip)/.test(request.url())) localCalibrationRequests.push(request.url());
  });
  t.after(() => assert.deepEqual(errors, [], 'No browser script errors'));
  t.after(() => assert.deepEqual(localCalibrationRequests, [], 'No local calibration requests'));
  await page.goto(url);
  return page;
}

for (const [locale, expected] of [['zh-CN', 'zh-CN'], ['zh-TW', 'zh-CN'], ['zh-HK', 'zh-CN'], ['en-US', 'en'], ['fr-FR', 'en'], ['ja-JP', 'en']]) {
  test(`Defaults to browser language with English fallback: ${locale}`, async t => {
    const page = await open(t, locale);
    assert.equal(await page.locator('html').getAttribute('lang'), expected);
    assert.equal(await page.locator('#language-mode').inputValue(), expected === 'en' ? 'en' : 'zh');
    assert.deepEqual(await page.locator('#language-mode option').allTextContents(), ['中文', 'English']);
    assert.equal(await page.locator('#hero-title').textContent(), expected === 'en' ? 'Tactile GloveDocumentation' : '触觉手套文档');
  });
}

test('Manual choices persist and override the browser default', async t => {
  const page = await open(t, 'fr-FR');
  for (const [mode, lang] of [['zh', 'zh-CN'], ['en', 'en']]) {
    await page.selectOption('#language-mode', mode);
    assert.equal(await page.locator('html').getAttribute('lang'), lang);
    assert.equal(await page.evaluate(key => localStorage.getItem(key), storageKey), mode);
    await page.reload();
    assert.equal(await page.locator('#language-mode').inputValue(), mode);
    assert.equal(await page.locator('html').getAttribute('lang'), lang);
  }
});

test('Invalid preferences, unsupported primary language, and missing translations use English', async t => {
  const page = await open(t, 'zh-CN', () => {
    localStorage.setItem('fulai-documentation-language', 'invalid');
    Object.defineProperty(navigator, 'languages', { get: () => ['fr-FR', 'zh-CN'] });
  });
  assert.equal(await page.locator('#language-mode').inputValue(), 'en');
  assert.equal(await page.locator('html').getAttribute('lang'), 'en');
  await page.selectOption('#language-mode', 'zh');
  assert.equal(await page.evaluate(() => FulaiI18n.t('Untranslated English')), 'Untranslated English');
  assert.equal(await page.evaluate(() => FulaiI18n.t('constructor')), 'constructor');
});

test('The default follows browser changes until a manual choice is made', async t => {
  const page = await open(t, 'en-US');
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'languages', { configurable: true, get: () => ['zh-Hans-CN'] });
    window.dispatchEvent(new Event('languagechange'));
  });
  assert.equal(await page.locator('html').getAttribute('lang'), 'zh-CN');
  assert.equal(await page.locator('#language-mode').inputValue(), 'zh');
  await page.selectOption('#language-mode', 'en');
  await page.evaluate(() => window.dispatchEvent(new Event('languagechange')));
  assert.equal(await page.locator('html').getAttribute('lang'), 'en');
  assert.equal(await page.locator('#language-mode').inputValue(), 'en');
});

test('A saved legacy auto preference selects the actual browser language', async t => {
  const page = await open(t, 'zh-CN', () => {
    localStorage.setItem('fulai-documentation-language', 'auto');
  });
  assert.equal(await page.locator('html').getAttribute('lang'), 'zh-CN');
  assert.equal(await page.locator('#language-mode').inputValue(), 'zh');
  assert.equal(await page.locator('#language-mode option[value="auto"]').count(), 0);
});

test('Language switching remains usable when browser storage is blocked', async t => {
  const page = await open(t, 'zh-CN', () => {
    Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } });
  });
  assert.equal(await page.locator('html').getAttribute('lang'), 'zh-CN');
  await page.selectOption('#language-mode', 'en');
  assert.equal(await page.locator('html').getAttribute('lang'), 'en');
  await page.selectOption('#language-mode', 'zh');
  assert.equal(await page.locator('html').getAttribute('lang'), 'zh-CN');
});

test('Switching updates navigation and search while preserving route, code, and checklist', async t => {
  const page = await open(t, 'en-US');
  const originalCode = await page.locator('pre code').allTextContents();
  await page.goto(url + '#checklist');
  await page.locator('[data-check]').first().check();
  const hash = new URL(page.url()).hash;
  await page.selectOption('#language-mode', 'zh');
  assert.equal(new URL(page.url()).hash, hash);
  assert.equal(await page.locator('[data-check]').first().isChecked(), true);
  assert.match(await page.locator('#checklist-count').textContent(), /已完成 1 \/ 10 项/);
  assert.equal(await page.locator('#breadcrumb-title').textContent(), '录制前检查清单');
  assert.match(await page.title(), /录制前检查清单/);
  assert.match(await page.locator('#page-navigation').textContent(), /上一章/);
  assert.deepEqual(await page.locator('pre code').allTextContents(), originalCode);
  await page.locator('#search-trigger').click();
  await page.locator('#search-input').fill('标定');
  await page.waitForFunction(() => document.querySelector('#search-status').textContent.includes('找到'));
  const result = page.locator('.search-result').first();
  assert.match(await result.textContent(), /标定/);
  await result.click();
  const resultHash = new URL(page.url()).hash;
  await page.selectOption('#language-mode', 'en');
  assert.equal(new URL(page.url()).hash, resultHash);
  assert.equal(await page.locator('.doc-page.active').getAttribute('id'), 'calibration');
  assert.match(await page.locator('#toc-links').textContent(), /Importing Force Calibration/);
  await page.reload();
  assert.equal(new URL(page.url()).hash, resultHash);
  assert.equal(await page.locator('.doc-page.active').getAttribute('id'), 'calibration');
  assert.equal(await page.locator('[data-check]').first().isChecked(), true);
});

test('Chinese search includes short passages and is refreshed when the browser language changes', async t => {
  const page = await open(t, 'zh-CN');
  await page.locator('#search-trigger').click();
  await page.locator('#search-input').fill('每个采样一行');
  await page.waitForFunction(() => document.querySelector('#search-results').textContent.includes('每个采样一行'));
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US'] });
    window.dispatchEvent(new Event('languagechange'));
  });
  assert.equal(await page.locator('#search-status').textContent(), 'No matching passages');
  await page.locator('#search-input').fill('sample');
  await page.waitForFunction(() => document.querySelector('#search-status').textContent.includes('matching passages') && document.querySelectorAll('.search-result').length > 0);
});

test('Language control fits narrow mobile screens and remains keyboard accessible', async t => {
  const page = await open(t, 'en-US');
  for (const width of [320, 375, 768, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    for (const mode of ['en', 'zh']) {
      await page.selectOption('#language-mode', mode);
      assert.equal(await page.locator('#language-mode').isVisible(), true);
      const bounds = await page.locator('#language-mode').boundingBox();
      assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width, `Selector fits ${width}px (${mode})`);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `No page overflow at ${width}px (${mode})`);
      assert.ok(await page.evaluate(() => document.querySelector('.topbar').scrollWidth <= innerWidth), `No header overflow at ${width}px (${mode})`);
    }
  }
  await page.locator('#language-mode').focus();
  assert.equal(await page.locator('#language-mode').evaluate(node => node === document.activeElement), true);
});

test('Calibration selection survives language changes and downloads only selected original files', async t => {
  const fs = require('node:fs/promises');
  const page = await open(t, 'zh-CN');
  await page.goto(hostedUrl + '#section-7-1');
  await waitForCatalog(page);
  const files = page.locator('#calibration [data-calibration-file]');
  const downloadButton = page.locator('#download-selected-calibration');
  const selectAll = page.locator('#calibration-select-all');
  assert.equal(await downloadButton.isDisabled(), true);
  await files.nth(0).check();
  await files.nth(2).check();
  assert.equal(await selectAll.evaluate(node => node.indeterminate), true);
  assert.equal(await downloadButton.textContent(), '下载所选（2）');
  await page.selectOption('#language-mode', 'en');
  assert.equal(await downloadButton.textContent(), 'Download selected (2)');
  assert.equal(await files.nth(0).isChecked(), true);
  assert.equal(await files.nth(1).isChecked(), false);
  assert.equal(await files.nth(2).isChecked(), true);
  const selectedNames = await files.evaluateAll(inputs => inputs.filter(input => input.checked).map(input => input.dataset.calibrationFile));
  const downloadEvent = page.waitForEvent('download');
  await downloadButton.click();
  const download = await downloadEvent;
  assert.equal(download.suggestedFilename(), 'FULAI_Glove_Calibration_Selected.zip');
  assert.equal(await download.failure(), null);
  const zip = await require('jszip').loadAsync(await fs.readFile(await download.path()), { checkCRC32: true });
  assert.deepEqual(Object.values(zip.files).filter(entry => !entry.dir).map(entry => entry.name), selectedNames.map(name => 'calibration/' + name));
  for (const name of selectedNames) {
    const original = calibrationFixtures.get(name);
    assert.deepEqual(await zip.file('calibration/' + name).async('nodebuffer'), original, 'ZIP contents match original bytes');
  }
  await selectAll.check();
  assert.equal(await page.locator('#calibration [data-calibration-file]:checked').count(), 37);
  assert.equal(await selectAll.evaluate(node => node.indeterminate), false);
  await selectAll.uncheck();
  assert.equal(await downloadButton.isDisabled(), true);
});

test('Calibration download card fits mobile screens in both languages', async t => {
  const page = await open(t, 'zh-CN');
  await page.goto(hostedUrl + '#section-7-1');
  await waitForCatalog(page);
  for (const width of [320, 375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const mode of ['en', 'zh']) {
      await page.selectOption('#language-mode', mode);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `No page overflow at ${width}px (${mode})`);
      for (const selector of ['.calibration-downloads', '#download-selected-calibration', '.calibration-file a']) {
        const bounds = await page.locator(selector).first().boundingBox();
        assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width, `${selector} fits ${width}px (${mode})`);
      }
    }
  }
});

test('Local HTML explains that the live catalog requires the website', async t => {
  const page = await open(t, 'zh-CN');
  await page.goto(url + '#section-7-1');
  assert.equal(await page.locator('#download-selected-calibration').isVisible(), false);
  assert.match(await page.locator('#calibration [data-calibration-offline-hint]').textContent(), /网页版/);
  assert.equal(await page.locator('#calibration [data-calibration-bundle]').isVisible(), false);
});

test('Source documents supports search, shared selection, single JSON and selected ZIP downloads', async t => {
  const fs = require('node:fs/promises');
  const page = await open(t, 'zh-CN');
  await page.goto(hostedUrl + '#source-calibration-download-title');
  await waitForCatalog(page);
  const picker = page.locator('#sources .calibration-downloads');
  assert.equal(await picker.locator('[data-calibration-file]').count(), 37);
  const search = picker.locator('input[type="search"]');
  await search.fill('G-26091801');
  assert.equal(await picker.locator('.calibration-file:visible').count(), 2, 'Search accepts hyphens for underscore filenames');
  const left = picker.locator('[data-calibration-file="G_26091801_Left.json"]');
  await left.check();
  const downloadEvent = page.waitForEvent('download');
  await picker.locator('[data-calibration-download]').click();
  const download = await downloadEvent;
  assert.equal(download.suggestedFilename(), 'G_26091801_Left.json');
  assert.equal(await download.failure(), null);
  assert.deepEqual(await fs.readFile(await download.path()), calibrationFixtures.get('G_26091801_Left.json'));
  await picker.locator('[data-calibration-select-all]').check();
  await page.evaluate(() => { location.hash = '#section-7-1'; });
  await page.waitForFunction(() => document.querySelector('#calibration').classList.contains('active'));
  assert.equal(await page.locator('#calibration [data-calibration-file]:checked').count(), 2);
  await page.selectOption('#language-mode', 'en');
  await page.evaluate(() => { location.hash = '#source-calibration-download-title'; });
  await page.waitForFunction(() => document.querySelector('#sources').classList.contains('active'));
  assert.equal(await picker.locator('[data-calibration-download]').textContent(), 'Download selected (2)');
  const zipEvent = page.waitForEvent('download');
  await picker.locator('[data-calibration-download]').click();
  const zipped = await zipEvent;
  const zip = await require('jszip').loadAsync(await fs.readFile(await zipped.path()), { checkCRC32: true });
  assert.deepEqual(Object.keys(zip.files).filter(name => name.endsWith('.json')).sort(), ['calibration/G_26091801_Left.json', 'calibration/G_26091801_Right.json']);
  for (const name of ['G_26091801_Left.json', 'G_26091801_Right.json']) {
    assert.deepEqual(await zip.file('calibration/' + name).async('nodebuffer'), calibrationFixtures.get(name));
  }
  await search.fill('no-such-glove');
  assert.equal(await picker.locator('.calibration-empty').isVisible(), true);
  assert.equal(await picker.locator('[data-calibration-select-all]').isDisabled(), true);
  assert.equal(await picker.locator('[data-calibration-download]').isEnabled(), true, 'Hidden selections remain available');
  await picker.locator('[data-calibration-clear]').click();
  assert.equal(await picker.locator('[data-calibration-download]').isDisabled(), true);
  assert.equal(await page.locator('[data-calibration-file]:checked').count(), 0);
  await search.fill('');
  await picker.locator('[data-calibration-select-all]').check();
  const allEvent = page.waitForEvent('download');
  await picker.locator('[data-calibration-download]').click();
  const all = await allEvent;
  assert.equal(all.suggestedFilename(), 'FULAI_Glove_Calibration_Selected.zip');
  const allZip = await require('jszip').loadAsync(await fs.readFile(await all.path()));
  assert.equal(Object.keys(allZip.files).filter(name => name.endsWith('.json')).length, 37);
});

test('Failed selected downloads preserve selection and allow retry without a partial ZIP', async t => {
  const page = await open(t, 'zh-CN');
  await page.goto(hostedUrl + '#source-calibration-download-title');
  await waitForCatalog(page);
  const picker = page.locator('#sources .calibration-downloads');
  await picker.locator('[data-calibration-file]').nth(0).check();
  await picker.locator('[data-calibration-file]').nth(1).check();
  const names = await picker.locator('[data-calibration-file]:checked').evaluateAll(inputs => inputs.map(input => input.dataset.calibrationFile));
  await page.route(calibrationManifest.baseUrl + names[1], route => route.fulfill({ status: 404, headers: { 'Access-Control-Allow-Origin': '*' }, body: 'missing' }));
  const downloads = [];
  page.on('download', item => downloads.push(item));
  await picker.locator('[data-calibration-download]').click();
  await page.waitForFunction(() => document.querySelector('#sources [data-calibration-status]').textContent.includes('失败'));
  assert.equal(downloads.length, 0);
  assert.equal(await picker.locator('[data-calibration-file]:checked').count(), 2);
  assert.equal(await picker.locator('[data-calibration-download]').isEnabled(), true);
  await page.unroute(calibrationManifest.baseUrl + names[1]);
  const retryEvent = page.waitForEvent('download');
  await picker.locator('[data-calibration-download]').click();
  assert.equal(await (await retryEvent).failure(), null);
});

test('Individual row downloads save the OSS JSON with its original filename', async t => {
  const fs = require('node:fs/promises');
  const page = await open(t, 'zh-CN');
  await page.goto(hostedUrl + '#source-calibration-download-title');
  await waitForCatalog(page);
  const link = page.locator('#sources .calibration-file a').first();
  const name = await link.getAttribute('download');
  assert.equal(await link.getAttribute('href'), calibrationManifest.baseUrl + name);
  const event = page.waitForEvent('download');
  await link.click();
  const download = await event;
  assert.equal(download.suggestedFilename(), name);
  assert.deepEqual(await fs.readFile(await download.path()), calibrationFixtures.get(name));
  assert.equal(new URL(page.url()).hash, '#source-calibration-download-title');
});

test('Blocked OSS reads show a direct save link and allow retry', async t => {
  const page = await open(t, 'zh-CN');
  await page.goto(hostedUrl + '#source-calibration-download-title');
  await waitForCatalog(page);
  const picker = page.locator('#sources .calibration-downloads');
  const link = picker.locator('.calibration-file a').first();
  const source = await link.getAttribute('href');
  await page.route(source, route => route.abort('accessdenied'));
  await link.click();
  await page.waitForFunction(() => document.querySelector('#sources [data-calibration-status]').textContent.includes('失败'));
  const direct = picker.locator('[data-calibration-direct]');
  assert.equal(await direct.isVisible(), true);
  assert.equal(await direct.getAttribute('href'), source);
  await page.unroute(source);
  const event = page.waitForEvent('download');
  await link.click();
  assert.equal(await (await event).failure(), null);
});

test('OSS uploads, replacements and deletions update both pickers and the complete ZIP', async t => {
  const page = await open(t, 'zh-CN');
  let files = [{ name: 'new_Left.json', etag: 'v1' }, { name: 'removed_Right.json' }, { name: 'unchanged_Left.json' }];
  await page.route('https://oss.fulai.studio/?**', route => route.fulfill({ contentType: 'application/xml', body: listingXml(files) }));
  const bytes = Buffer.from('{"newUpload":true,"values":[4,5,6]}');
  const objectRequests = [];
  await page.route('https://oss.fulai.studio/fulai_sensing_glove/**', route => {
    objectRequests.push(route.request().url());
    return route.fulfill({ contentType: 'application/json', body: bytes });
  });
  await page.goto(hostedUrl + '#source-calibration-download-title');
  await waitForCatalog(page);
  const picker = page.locator('#sources .calibration-downloads');
  await picker.locator('[data-calibration-select-all]').check();
  files = [{ name: 'new_Left.json', etag: 'v2' }, { name: 'unchanged_Left.json' }, { name: '批次 2/new_Right.json' }];
  await picker.locator('[data-calibration-refresh]').click();
  await waitForCatalog(page);
  for (const section of ['#sources', '#calibration']) {
    assert.deepEqual((await page.locator(section + ' [data-calibration-file]').evaluateAll(nodes => nodes.map(node => node.dataset.calibrationFile))).sort(), files.map(file => file.name).sort());
    assert.deepEqual(await page.locator(section + ' [data-calibration-file]:checked').evaluateAll(nodes => nodes.map(node => node.dataset.calibrationFile)), ['unchanged_Left.json']);
  }
  const event = page.waitForEvent('download');
  await picker.locator('[data-calibration-bundle]').click();
  const download = await event;
  assert.equal(download.suggestedFilename(), 'FULAI_Glove_Calibration_Files.zip');
  const zip = await require('jszip').loadAsync(await require('node:fs/promises').readFile(await download.path()));
  assert.deepEqual(Object.values(zip.files).filter(file => !file.dir).map(file => file.name).sort(), files.map(file => 'calibration/' + file.name).sort());
  for (const file of files) assert.deepEqual(await zip.file('calibration/' + file.name).async('nodebuffer'), bytes);
  assert.equal(objectRequests.length, 3);
  assert.ok(objectRequests.every(request => !request.endsWith('.zip')), 'Never requests the historical ZIP');
});

test('OSS pagination decodes tokens and paths and excludes unrelated or unsafe objects', async t => {
  const page = await open(t, 'en-US');
  const token = 'page+2/% value';
  const requests = [];
  await page.route('https://oss.fulai.studio/?**', route => {
    const request = new URL(route.request().url());
    requests.push(request);
    const body = request.searchParams.has('continuation-token')
      ? listingXml([{ name: '子目录/a & b+%.json' }, { name: 'a_Left.json' }])
      : listingXml([{ name: 'a_Left.json' }, { name: '../unsafe.json' }, { name: 'a\\unsafe.json' }, { name: 'readme.txt' }, { name: 'outside.json' }], token).replace(encodeURIComponent('fulai_sensing_glove/calibration/outside.json'), encodeURIComponent('private/outside.json'));
    return route.fulfill({ contentType: 'application/xml', body });
  });
  await page.goto(hostedUrl + '#source-calibration-download-title');
  await waitForCatalog(page);
  assert.equal(requests.length, 2);
  assert.equal(requests[1].searchParams.get('continuation-token'), token);
  assert.ok(requests.every(request => request.searchParams.get('prefix') === 'fulai_sensing_glove/calibration/'));
  assert.deepEqual(await page.locator('#sources [data-calibration-file]').evaluateAll(nodes => nodes.map(node => node.dataset.calibrationFile)), ['a_Left.json', '子目录/a & b+%.json']);
  const link = page.locator('#sources .calibration-file a').last();
  assert.equal(decodeURIComponent(new URL(await link.getAttribute('href')).pathname), '/fulai_sensing_glove/calibration/子目录/a & b+%.json');
});

test('Denied or interrupted listings stay unusable until a complete refresh succeeds', async t => {
  const page = await open(t, 'en-US');
  let mode = 'denied';
  await page.route('https://oss.fulai.studio/?**', route => {
    const second = new URL(route.request().url()).searchParams.has('continuation-token');
    if (mode === 'denied' || (mode === 'partial' && second)) return route.fulfill({ status: 403, body: 'AccessDenied' });
    return route.fulfill({ contentType: 'application/xml', body: listingXml([{ name: mode === 'partial' ? 'incomplete.json' : 'complete.json' }], mode === 'partial' ? 'next' : '') });
  });
  await page.goto(hostedUrl + '#source-calibration-download-title');
  const picker = page.locator('#sources .calibration-downloads');
  await page.waitForFunction(() => document.querySelector('#sources [data-calibration-catalog-status]').textContent.includes('Could not load'));
  assert.equal(await picker.locator('[data-calibration-bundle]').isDisabled(), true);
  assert.equal(await picker.locator('[data-calibration-file]').count(), 0);
  mode = 'complete';
  await picker.locator('[data-calibration-refresh]').click();
  await waitForCatalog(page);
  await picker.locator('[data-calibration-file]').check();
  mode = 'partial';
  await picker.locator('[data-calibration-refresh]').click();
  await page.waitForFunction(() => document.querySelector('#sources [data-calibration-catalog-status]').textContent.includes('previous list'));
  assert.equal(await picker.locator('[data-calibration-file]').getAttribute('data-calibration-file'), 'complete.json');
  assert.equal(await picker.locator('[data-calibration-download]').isDisabled(), true);
  assert.equal(await picker.locator('[data-calibration-bundle]').isDisabled(), true);
  mode = 'complete';
  await picker.locator('[data-calibration-refresh]').click();
  await waitForCatalog(page);
  assert.equal(await picker.locator('[data-calibration-file]').isChecked(), true);
});

test('An empty OSS directory has a clear empty state and no download actions', async t => {
  const page = await open(t, 'en-US');
  await page.route('https://oss.fulai.studio/?**', route => route.fulfill({ contentType: 'application/xml', body: listingXml([]) }));
  await page.goto(hostedUrl + '#source-calibration-download-title');
  await page.waitForFunction(() => document.querySelector('#sources [data-calibration-catalog-status]').textContent.includes('No calibration files'));
  assert.equal(await page.locator('#sources [data-calibration-bundle]').isDisabled(), true);
  assert.equal(await page.locator('#sources [data-calibration-select-all]').isDisabled(), true);
});

test('Repeated pagination tokens fail without publishing a partial catalog', async t => {
  const page = await open(t, 'en-US');
  let calls = 0;
  await page.route('https://oss.fulai.studio/?**', route => {
    calls++;
    return route.fulfill({ contentType: 'application/xml', body: listingXml([{ name: 'partial.json' }], 'repeated') });
  });
  await page.goto(hostedUrl + '#source-calibration-download-title');
  await page.waitForFunction(() => document.querySelector('#sources [data-calibration-catalog-status]').textContent.includes('Could not load'));
  assert.equal(calls, 2);
  assert.equal(await page.locator('[data-calibration-file]').count(), 0);
});

test('Visible download pages refresh automatically after sixty seconds', async t => {
  const page = await open(t, 'en-US');
  await page.clock.install();
  let files = [{ name: 'first.json' }];
  await page.route('https://oss.fulai.studio/?**', route => route.fulfill({ contentType: 'application/xml', body: listingXml(files) }));
  await page.goto(hostedUrl + '#source-calibration-download-title');
  await waitForCatalog(page);
  files.push({ name: 'uploaded-later.json' });
  await page.clock.fastForward(60000);
  await page.waitForFunction(() => document.querySelectorAll('#sources [data-calibration-file]').length === 2);
  assert.equal(await page.locator('#calibration [data-calibration-file]').count(), 2);
});

test('The generator works without local calibration originals or a local ZIP', async t => {
  const fs = require('node:fs/promises');
  const os = require('node:os');
  const { execFileSync } = require('node:child_process');
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'fulai-oss-generator-'));
  t.after(async () => {
    assert.equal(path.dirname(tempRoot), path.resolve(os.tmpdir()));
    assert.ok(path.basename(tempRoot).startsWith('fulai-oss-generator-'));
    await fs.rm(tempRoot, { recursive: true });
  });
  await fs.mkdir(path.join(tempRoot, 'scripts'));
  await fs.mkdir(path.join(tempRoot, 'data'));
  for (const file of ['index.html', 'scripts/sync-calibration-downloads.py', 'data/calibration-files.json']) {
    await fs.copyFile(path.resolve(__dirname, '..', file), path.join(tempRoot, file));
  }
  execFileSync(process.env.PYTHON || 'python', [path.join(tempRoot, 'scripts/sync-calibration-downloads.py')]);
  const generated = await fs.readFile(path.join(tempRoot, 'index.html'), 'utf8');
  assert.equal((generated.match(/data-oss-prefix="fulai_sensing_glove\/calibration\/"/g) || []).length, 2);
  assert.ok(!generated.includes('G-26102804-Left.json'));
  assert.ok(!generated.includes('href="downloads/calibration'));
  assert.equal((await fs.readdir(tempRoot)).includes('downloads'), false);
});
