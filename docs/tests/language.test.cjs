/* Run with: node --test docs/tests/language.test.cjs (Playwright required). */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const url = pathToFileURL(path.resolve(__dirname, '../index.html')).href;
const storageKey = 'fulai-documentation-language';
let browser;

before(async () => {
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
});
after(async () => { await browser?.close(); });

async function open(t, locale, setup) {
  const context = await browser.newContext({ locale, reducedMotion: 'reduce' });
  t.after(() => context.close());
  if (setup) await context.addInitScript(setup);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  t.after(() => assert.deepEqual(errors, [], 'No browser script errors'));
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
