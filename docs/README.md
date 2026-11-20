# FULAI Tactile Glove Documentation

Open `index.html` directly in a browser, or publish this directory on any static web server. No package installation or build step is needed. Stylesheets, scripts, images, and Word documents use relative paths. The live calibration catalog and JSON downloads require the hosted website and an internet connection. ZIP downloads are generated in the browser from the current OSS files.

## Files

- `index.html` — complete English content, with the two product overviews and all 17 manual chapters and two appendices.
- `css/styles.css` — responsive layouts and print styles.
- `js/app.js` — chapter navigation, local full-text search, image preview, clipboard actions, checklist, and print options.
- `js/i18n.js` — browser-language detection, manual language selection, and local preference storage.
- `js/zh.js` — Chinese translations for the English HTML and interactive messages.
- `img/` — deduplicated, losslessly converted source illustrations and a local favicon.
- `downloads/` — source Word documents, Chinese product overviews, and the Chinese V1.1.6 manual. Keep these documents for the existing download links.
- `data/calibration-files.json` — OSS listing endpoint and prefix only. There is no maintained list of filenames.
- `js/calibration-catalog.js` — read-only ListObjectsV2 client, including pagination, URL decoding and prefix validation.
- `downloads/calibration/` and `downloads/calibration.zip` — legacy backups; not used by the website, generator, or browser tests.

Chapter 7.1 and Source documents load their file lists directly from OSS. New uploads, replacements and deletions appear on page load, manual refresh, entry to the download chapters, return to a visible browser tab, or the 60-second refresh while either chapter is visible. Only JSON objects under `fulai_sensing_glove/calibration/` are included, including subdirectories. Files are sorted by name. Both pickers share selection and search independently. Deleted or replaced objects lose their old selection.

Single-file downloads preserve the original bytes and filename. Multiple-file and Download all actions fetch the currently listed JSON files and build a ZIP in the browser. The old uploaded ZIP is never used, so new files cannot be omitted due to an outdated bundle. No calibration data is uploaded by the website. A failed list refresh is explicitly shown and disables downloading from the previous listing until refreshed successfully. A failed file request aborts packaging instead of returning a partial archive. The version is not inferred from filenames or parent folders; rows show the hand inferred from the filename and the listed file size. A hand that cannot be inferred is labeled Calibration file.

Public visitors need `oss:ListObjects` restricted to the configured prefix and `oss:GetObject` for that directory, including future files, plus GET CORS access from the actual website origins. No access keys belong in the browser. The code does not modify OSS policy or upload objects. CDN configurations must forward listing query parameters and avoid cached listings; same-name object overwrites may also require CDN cache invalidation.

After the one-time configuration and site deployment, uploading JSON files to OSS is the entire publication workflow. No manifest editing, ZIP upload, generator run or Git commit is needed for file changes. `python docs/scripts/sync-calibration-downloads.py` only regenerates the two empty picker shells if their presentation or endpoint/prefix changes. It does not read original files, build a ZIP, or access the network. Local HTML and no-JavaScript views explain that the live catalog requires the website and JavaScript.

Browser tests use small independent fixtures in `tests/fixtures/` and mocked OSS listings; those fixtures are not a production file list. Live permissions must be verified separately.

The full document remains readable without JavaScript. When JavaScript is enabled, navigation displays one chapter at a time. Chapter and figure links use URL fragments and support browser Back and Forward. Search runs entirely in the browser and does not upload content. Checklist state is saved locally when browser storage is available.

## Content scope

The product overviews are dated 24 October 2026 and describe software V1.1.3. Capacitive hardware is V1.0; piezoresistive hardware is V3.2. The detailed FULAI manual is dated 4 November 2026 and covers software V1.1.6 with glove hardware V3.0–V3.4.

Source differences are explained in the model comparison and source notes. They include recording duration, CSV organization, interface language, and exported shear units. The capacitive overview contains inconsistent fingertip spatial resolution values; both are retained and explicitly identified. Capacitive hardware V1.0 compatibility with the detailed manual is not assumed.

The HTML is the editable content source. Update `index.html` for content changes; search indexes its rendered text automatically. Keep existing IDs when possible to preserve direct links.

The language selector offers only 中文 and English. Without a saved manual selection, the browser's first preferred language determines the selected value: `zh` and its regional variants select Simplified Chinese; English and unsupported languages select English. Browser language changes are followed until the user makes a manual selection. Manual selections persist in local storage when available. Legacy `auto` preferences and unknown stored values use browser detection, without adding an option to the selector. Missing Chinese translations fall back to the original English. Update the English-to-Chinese dictionary in `js/zh.js` when changing content. In Chinese mode, manual figures use the Chinese screenshots from the supplied V1.1.6 manual and the user manual download points to the Chinese DOCX. Code samples, protocol fields, and source documents without a Chinese counterpart retain their original content. Without JavaScript, the complete English guide remains available.

The sensing-region and workflow illustrations in both product overviews also switch to Chinese, including their enlarged previews. The workflow images retain each model's original data rate (240 Hz for capacitive and 100 Hz for piezoresistive). Rebuild these localized WebP assets with `python docs/scripts/localize-overview-images.py` on Windows with Pillow and Microsoft YaHei installed; the script replaces only text areas in the original images.

For browser regression checks, make Playwright available to Node and run `node --test docs/tests/language.test.cjs`. Set `PLAYWRIGHT_CHANNEL=msedge` or `chrome` to use an installed browser instead of Playwright's bundled Chromium. This is only needed for development; the site has no runtime dependencies.
