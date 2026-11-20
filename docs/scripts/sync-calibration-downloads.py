"""Render OSS download links from metadata; optionally import originals and build a ZIP for upload."""
from pathlib import Path
import argparse
import html
import json
import re
import zipfile
from urllib.parse import quote

DOCS = Path(__file__).resolve().parents[1]
MANIFEST = DOCS / 'data' / 'calibration-files.json'


def icon(paths):
    return f'<svg class="icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{paths}</svg>'


def picker(catalog, prefix):
    files = catalog['files']
    download_icon = icon('<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />')
    file_icon = icon('<path d="M5 3h9l5 5v13H5zM14 3v6h5M8 13h8M8 17h6" />')
    search_icon = icon('<circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5" />')
    rows = []
    for file in files:
        hand = {'left': 'Left hand', 'right': 'Right hand'}[file['hand']]
        name = html.escape(file['name'], quote=True)
        url = html.escape(catalog['baseUrl'].rstrip('/') + '/' + quote(file['name']), quote=True)
        version = html.escape(file['version'])
        size = file['size']
        size_label = f'{size / 1048576:.2f} MB' if size >= 1048576 else f'{size / 1024:.0f} KB'
        rows.append(f'''              <div class="calibration-file">
                <label><input type="checkbox" data-calibration-file="{name}" hidden>
                  <span><strong data-no-translate>{name}</strong><small><span>{hand}</span> · <span data-no-translate>{version} · {size_label}</span></small></span>
                </label>
                <a href="{url}" target="_blank" rel="noopener" download="{name}">{download_icon}<span class="sr-only">Download</span><span class="sr-only" data-no-translate> {name}</span></a>
              </div>''')
    return f'''          <!-- calibration-picker:{prefix}:start -->
          <section class="calibration-downloads" aria-labelledby="{prefix}-download-title">
            <div class="calibration-download-heading">
              <span class="card-icon">{file_icon}</span>
              <div class="calibration-heading-copy">
                <h3 id="{prefix}-download-title">Download calibration files</h3>
                <p>Select files that match your Glove ID and hand, then import each file into the software.</p>
                <span class="calibration-version"><span data-no-translate>JSON · {len(files)}</span> <span>files</span></span>
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
            <div class="calibration-file-list" role="region" aria-label="Available calibration files" tabindex="0">
{chr(10).join(rows)}
            </div>
            <p class="calibration-empty" hidden>No matching calibration files. Try another Glove ID.</p>
            <div class="calibration-download-actions">
              <button type="button" class="button primary" id="download-selected-{prefix}" data-calibration-download data-no-translate hidden disabled></button>
              <a class="button secondary" data-calibration-bundle href="{html.escape(catalog['bundleUrl'], quote=True)}" target="_blank" rel="noopener" download="FULAI_Glove_Calibration_Files.zip">{download_icon}<span>Download all (ZIP)</span></a>
              <button type="button" class="calibration-clear" data-calibration-clear hidden>Clear selection</button>
            </div>
            <p class="calibration-download-hint" data-calibration-online-hint hidden>One file downloads as JSON; multiple files download together as a ZIP. Selections are shared between this chapter and Source documents.</p>
            <p class="calibration-download-hint" data-calibration-offline-hint hidden>Downloads require an internet connection. Open the website to select multiple files, or open individual files and save them.</p>
            <p class="calibration-download-hint calibration-download-status" role="status" data-calibration-status data-no-translate></p>
            <a class="calibration-download-hint" data-calibration-direct target="_blank" rel="noopener" hidden>Open the original file to save it</a>
          </section>
          <!-- calibration-picker:{prefix}:end -->'''


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, help='Optional folder of original JSON files to refresh metadata')
    parser.add_argument('--zip-output', type=Path, help='Optional ZIP to build for OSS upload (requires --source)')
    args = parser.parse_args()
    if args.zip_output and not args.source:
        parser.error('--zip-output requires --source')
    catalog = json.loads(MANIFEST.read_text(encoding='utf-8'))
    if args.source:
        files = sorted(args.source.glob('*.json'), key=lambda p: (re.sub(r'[-_]', '', p.name).lower(), p.name))
        if not files:
            raise ValueError('No calibration files found in --source')
        catalog['files'] = []
        for file in files:
            data = json.loads(file.read_text(encoding='utf-8-sig'))
            catalog['files'].append({'name': file.name, 'hand': data['hand'].lower(), 'version': data['glove_version'], 'size': file.stat().st_size})
    if not catalog['files'] or len({file['name'] for file in catalog['files']}) != len(catalog['files']):
        raise ValueError('The manifest must contain unique files')
    index = DOCS / 'index.html'
    content = index.read_text(encoding='utf-8')
    for prefix in ['calibration', 'source-calibration']:
        pattern = rf'          <!-- calibration-picker:{prefix}:start -->.*?<!-- calibration-picker:{prefix}:end -->'
        content, count = re.subn(pattern, lambda _: picker(catalog, prefix), content, flags=re.S)
        if count != 1:
            raise ValueError(f'Expected one picker marker for {prefix}, found {count}')
    index.write_text(content, encoding='utf-8')
    if args.source:
        MANIFEST.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    if args.zip_output:
        with zipfile.ZipFile(args.zip_output, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
            for file in files:
                entry = zipfile.ZipInfo('calibration/' + file.name, date_time=(2026, 1, 1, 0, 0, 0))
                entry.compress_type = zipfile.ZIP_DEFLATED
                archive.writestr(entry, file.read_bytes())
    print(f"Updated both OSS download pickers: {len(catalog['files'])} files")


if __name__ == '__main__':
    main()
