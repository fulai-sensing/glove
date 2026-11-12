# FULAI Tactile Glove Documentation

Open `index.html` directly in a browser, or publish this entire directory on any static web server. No package installation or build step is needed. Every stylesheet, script, image, and document uses a relative path, including when the site is hosted in a subdirectory.

## Files

- `index.html` — complete English content, with the two product overviews and all 17 manual chapters and two appendices.
- `css/styles.css` — responsive layouts and print styles.
- `js/app.js` — chapter navigation, local full-text search, image preview, clipboard actions, checklist, and print options.
- `js/i18n.js` — browser-language detection, manual language selection, and local preference storage.
- `js/zh.js` — Chinese translations for the English HTML and interactive messages.
- `img/` — deduplicated, losslessly converted source illustrations and a local favicon.
- `downloads/` — unchanged original Word documents for reference.

The full document remains readable without JavaScript. When JavaScript is enabled, navigation displays one chapter at a time. Chapter and figure links use URL fragments and support browser Back and Forward. Search runs entirely in the browser and does not upload content. Checklist state is saved locally when browser storage is available.

## Content scope

The product overviews are dated 24 October 2026 and describe software V1.1.3. Capacitive hardware is V1.0; piezoresistive hardware is V3.2. The detailed FULAI manual is dated 4 November 2026 and covers software V1.1.6 with glove hardware V3.0–V3.4.

Source differences are explained in the model comparison and source notes. They include recording duration, CSV organization, interface language, and exported shear units. The capacitive overview contains inconsistent fingertip spatial resolution values; both are retained and explicitly identified. Capacitive hardware V1.0 compatibility with the detailed manual is not assumed.

The HTML is the editable content source. Update `index.html` for content changes; search indexes its rendered text automatically. Keep existing IDs when possible to preserve direct links.

The language selector offers only 中文 and English. Without a saved manual selection, the browser's first preferred language determines the selected value: `zh` and its regional variants select Simplified Chinese; English and unsupported languages select English. Browser language changes are followed until the user makes a manual selection. Manual selections persist in local storage when available. Legacy `auto` preferences and unknown stored values use browser detection, without adding an option to the selector. Missing Chinese translations fall back to the original English. Update the English-to-Chinese dictionary in `js/zh.js` when changing content. Code samples, protocol fields, source images, and downloadable originals retain their original content. Without JavaScript, the complete English guide remains available.

For browser regression checks, make Playwright available to Node and run `node --test docs/tests/language.test.cjs`. Set `PLAYWRIGHT_CHANNEL=msedge` or `chrome` to use an installed browser instead of Playwright's bundled Chromium. This is only needed for development; the site has no runtime dependencies.
