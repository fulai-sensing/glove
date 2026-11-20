# FULAI Tactile Glove Documentation

Open `index.html` directly in a browser, or publish this directory on any static web server. No package installation or build step is needed. Stylesheets, scripts, images, and Word documents use relative paths. Calibration JSON files and the complete calibration ZIP download from `https://oss.fulai.studio/fulai_sensing_glove/` and require an internet connection.

## Files

- `index.html` — complete English content, with the two product overviews and all 17 manual chapters and two appendices.
- `css/styles.css` — responsive layouts and print styles.
- `js/app.js` — chapter navigation, local full-text search, image preview, clipboard actions, checklist, and print options.
- `js/i18n.js` — browser-language detection, manual language selection, and local preference storage.
- `js/zh.js` — Chinese translations for the English HTML and interactive messages.
- `img/` — deduplicated, losslessly converted source illustrations and a local favicon.
- `downloads/` — source Word documents, Chinese product overviews, and the Chinese V1.1.6 manual. Keep these documents for the existing download links.
- `data/calibration-files.json` — small calibration catalog: OSS base URL, full ZIP URL, original filenames, versions, hand labels, and sizes. Keep this file for future catalog updates.
- `downloads/calibration/` and `downloads/calibration.zip` — legacy local copies retained as backups; the website and default generator no longer use them. They are optional and can be excluded from deployment.

Chapter 7.1 and Source documents both include a calibration picker with filename / Glove ID search, select visible results, clear selection, individual JSON links, and the complete ZIP bundle. The two pickers share selections while navigating or changing language. On HTTP(S), individual links and a single selection fetch the original JSON from OSS and save a Blob with its original filename (cross-origin links cannot rely on the HTML download attribute). Multiple selected files are fetched from OSS and compressed into one ZIP with the locally bundled JSZip 3.10.1 (`js/vendor/`, MIT license included). Selecting every file uses the OSS ZIP directly. No file content is uploaded, and no request falls back to local calibration files. On `file://`, the online OSS links remain available but multi-select controls are hidden. A failed single-file fetch offers a direct OSS link to open and save the original file.

Run `python docs/scripts/sync-calibration-downloads.py` to regenerate both static pickers from the catalog without reading local calibration files or generating a ZIP. To refresh metadata from a complete directory of original JSON files, use `python docs/scripts/sync-calibration-downloads.py --source "C:/path/to/calibration"`. To also prepare a full ZIP for OSS upload, add `--zip-output "C:/path/to/calibration.zip"`. The script reads version/hand labels from the JSON metadata, preserves file bytes when packaging, and does not upload files. Upload the individual JSON files and refreshed ZIP to OSS separately. Uploading new objects alone does not change the website's catalog.

OSS must permit reads for these objects. Configure CORS to allow GET from each actual documentation origin (scheme + hostname + optional port; no page path), and HEAD if used for verification. Browsers cannot read JSON for single-file saves or selected ZIP creation without CORS even when direct links download successfully. Direct ZIP downloads work independently of CORS. Optional `Content-Disposition: attachment` on OSS objects also makes direct/no-JavaScript links download. The app does not require credentials or upload permissions.

The full document remains readable without JavaScript. When JavaScript is enabled, navigation displays one chapter at a time. Chapter and figure links use URL fragments and support browser Back and Forward. Search runs entirely in the browser and does not upload content. Checklist state is saved locally when browser storage is available.

## Content scope

The product overviews are dated 24 October 2026 and describe software V1.1.3. Capacitive hardware is V1.0; piezoresistive hardware is V3.2. The detailed FULAI manual is dated 4 November 2026 and covers software V1.1.6 with glove hardware V3.0–V3.4.

Source differences are explained in the model comparison and source notes. They include recording duration, CSV organization, interface language, and exported shear units. The capacitive overview contains inconsistent fingertip spatial resolution values; both are retained and explicitly identified. Capacitive hardware V1.0 compatibility with the detailed manual is not assumed.

The HTML is the editable content source. Update `index.html` for content changes; search indexes its rendered text automatically. Keep existing IDs when possible to preserve direct links.

The language selector offers only 中文 and English. Without a saved manual selection, the browser's first preferred language determines the selected value: `zh` and its regional variants select Simplified Chinese; English and unsupported languages select English. Browser language changes are followed until the user makes a manual selection. Manual selections persist in local storage when available. Legacy `auto` preferences and unknown stored values use browser detection, without adding an option to the selector. Missing Chinese translations fall back to the original English. Update the English-to-Chinese dictionary in `js/zh.js` when changing content. In Chinese mode, manual figures use the Chinese screenshots from the supplied V1.1.6 manual and the user manual download points to the Chinese DOCX. Code samples, protocol fields, and source documents without a Chinese counterpart retain their original content. Without JavaScript, the complete English guide remains available.

The sensing-region and workflow illustrations in both product overviews also switch to Chinese, including their enlarged previews. The workflow images retain each model's original data rate (240 Hz for capacitive and 100 Hz for piezoresistive). Rebuild these localized WebP assets with `python docs/scripts/localize-overview-images.py` on Windows with Pillow and Microsoft YaHei installed; the script replaces only text areas in the original images.

For browser regression checks, make Playwright available to Node and run `node --test docs/tests/language.test.cjs`. Set `PLAYWRIGHT_CHANNEL=msedge` or `chrome` to use an installed browser instead of Playwright's bundled Chromium. This is only needed for development; the site has no runtime dependencies.
