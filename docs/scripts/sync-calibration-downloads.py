"""Render the live OSS picker shells. File uploads do not require running this script."""
from pathlib import Path
import html
import json
import re

DOCS = Path(__file__).resolve().parents[1]
MANIFEST = DOCS / 'data' / 'calibration-files.json'


def icon(paths):
    return f'<svg class="icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{paths}</svg>'


def picker(catalog, prefix):
    download_icon = icon('<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />')
    file_icon = icon('<path d="M5 3h9l5 5v13H5zM14 3v6h5M8 13h8M8 17h6" />')
    search_icon = icon('<circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5" />')
    return f'''          <!-- calibration-picker:{prefix}:start -->
          <section class="calibration-downloads" data-oss-endpoint="{html.escape(catalog['endpoint'], quote=True)}" data-oss-prefix="{html.escape(catalog['prefix'], quote=True)}" aria-labelledby="{prefix}-download-title">
            <div class="calibration-download-heading">
              <span class="card-icon">{file_icon}</span>
              <div class="calibration-heading-copy">
                <h3 id="{prefix}-download-title">Download calibration files</h3>
                <p>Select files that match your Glove ID and hand, then import each file into the software.</p>
                <span class="calibration-version" data-calibration-summary data-no-translate></span>
              </div>
            </div>
            <div class="calibration-toolbar">
              <div class="calibration-search" hidden>
                <label class="sr-only" for="{prefix}-search">Find calibration files</label>
                {search_icon}
                <input id="{prefix}-search" type="search" placeholder="Search Glove ID or filename..." autocomplete="off">
              </div>
              <div class="calibration-selection-bar" hidden>
                <label><input id="{prefix}-select-all" data-calibration-select-all type="checkbox"><span>Select visible files</span></label>
                <span id="{prefix}-selection-count" role="status" data-calibration-count data-no-translate></span>
              </div>
            </div>
            <div class="calibration-catalog-toolbar">
              <span role="status" data-calibration-catalog-status data-no-translate></span>
              <button type="button" class="calibration-clear" data-calibration-refresh hidden>Refresh files</button>
            </div>
            <noscript><p class="calibration-download-hint">Enable JavaScript to load the latest calibration files from OSS.</p></noscript>
            <div class="calibration-file-list" role="region" aria-label="Available calibration files" tabindex="0" data-no-translate></div>
            <p class="calibration-empty" hidden>No matching calibration files. Try another Glove ID.</p>
            <div class="calibration-download-actions">
              <button type="button" class="button primary" id="download-selected-{prefix}" data-calibration-download data-no-translate hidden disabled></button>
              <button type="button" class="button secondary" data-calibration-bundle hidden disabled>{download_icon}<span>Download all (ZIP)</span></button>
              <button type="button" class="calibration-clear" data-calibration-clear hidden>Clear selection</button>
            </div>
            <p class="calibration-download-hint" data-calibration-online-hint hidden>One file downloads as JSON; multiple files download together as a ZIP. Selections are shared between this chapter and Source documents.</p>
            <p class="calibration-download-hint" data-calibration-offline-hint hidden>Open the website to load and download the latest calibration files.</p>
            <p class="calibration-download-hint calibration-download-status" role="status" data-calibration-status data-no-translate></p>
            <a class="calibration-download-hint" data-calibration-direct target="_blank" rel="noopener" hidden>Open the original file to save it</a>
          </section>
          <!-- calibration-picker:{prefix}:end -->'''


def main():
    catalog = json.loads(MANIFEST.read_text(encoding='utf-8'))
    index = DOCS / 'index.html'
    content = index.read_text(encoding='utf-8')
    for prefix in ['calibration', 'source-calibration']:
        pattern = rf'          <!-- calibration-picker:{prefix}:start -->.*?<!-- calibration-picker:{prefix}:end -->'
        content, count = re.subn(pattern, lambda _: picker(catalog, prefix), content, flags=re.S)
        if count != 1:
            raise ValueError(f'Expected one picker marker for {prefix}, found {count}')
    index.write_text(content, encoding='utf-8')
    print('Updated both live OSS picker shells')


if __name__ == '__main__':
    main()
