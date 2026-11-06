# FULAI Tactile Glove Documentation

Open `index.html` directly in a browser, or publish this entire directory on any static web server. No package installation or build step is needed. Every stylesheet, script, image, and document uses a relative path, including when the site is hosted in a subdirectory.

## Files

- `index.html` — complete English content, with the two product overviews and all 17 manual chapters and two appendices.
- `css/styles.css` — responsive layouts and print styles.
- `js/app.js` — chapter navigation, local full-text search, image preview, clipboard actions, checklist, and print options.
- `img/` — deduplicated, losslessly converted source illustrations and a local favicon.
- `downloads/` — unchanged original Word documents for reference.

The full document remains readable without JavaScript. When JavaScript is enabled, navigation displays one chapter at a time. Chapter and figure links use URL fragments and support browser Back and Forward. Search runs entirely in the browser and does not upload content. Checklist state is saved locally when browser storage is available.

## Content scope

The product overviews are dated 24 October 2026 and describe software V1.1.3. Capacitive hardware is V1.0; piezoresistive hardware is V3.2. The detailed FULAI manual is dated 4 November 2026 and covers software V1.1.6 with glove hardware V3.0–V3.4.

Source differences are explained in the model comparison and source notes. They include recording duration, CSV organization, interface language, and exported shear units. The capacitive overview contains inconsistent fingertip spatial resolution values; both are retained and explicitly identified. Capacitive hardware V1.0 compatibility with the detailed manual is not assumed.

The HTML is the editable content source. Update `index.html` for content changes; search indexes its rendered text automatically. Keep existing IDs when possible to preserve direct links.
