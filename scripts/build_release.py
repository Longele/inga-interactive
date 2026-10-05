#!/usr/bin/env python3
"""Build the public site and a reproducible, checksummed client delivery archive."""
import argparse
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path, PurePosixPath
import re
import shutil
import subprocess
import sys
from urllib.parse import unquote, urlsplit
import zipfile

ROOT = Path(__file__).resolve().parent.parent
ALLOWED_DIRS = {'fonts', 'icons', 'lib', 'voix', 'licenses'}
PUBLIC_EXTRA = {'.nojekyll', 'sw.js', 'LISEZMOI.html', 'VERSION', 'THIRD_PARTY_NOTICES.md'}


class LocalReferences(HTMLParser):
    def __init__(self):
        super().__init__()
        self.urls = []

    def handle_starttag(self, tag, attrs):
        for name, value in attrs:
            if value and name in ('src', 'href', 'poster'):
                self.urls.append(value)


def local_path(value, parent):
    parsed = urlsplit(value)
    if parsed.scheme or parsed.netloc or not parsed.path:
        return None
    path = unquote(parsed.path)
    if path.startswith('/'):
        raise ValueError(f'Root-relative resource is not portable to GitHub Pages: {value}')
    candidate = ROOT / parent / path
    resolved = candidate.resolve()
    if not resolved.is_relative_to(ROOT):
        raise ValueError(f'Resource escapes the repository: {value}')
    name = resolved.relative_to(ROOT).as_posix()
    if name == '.':
        return 'index.html'
    return name


def checked_file(name):
    relative = PurePosixPath(name)
    if relative.is_absolute() or '..' in relative.parts:
        raise ValueError(f'Invalid package path: {name}')
    if len(relative.parts) > 1 and relative.parts[0] not in ALLOWED_DIRS:
        raise ValueError(f'Non-public directory requested by the site: {name}')
    if len(relative.parts) == 1 and relative.suffix not in ('.html', '.js', '.css', '.webmanifest', '.json', '.txt') and name not in PUBLIC_EXTRA:
        raise ValueError(f'Non-public file requested by the site: {name}')
    path = ROOT / name
    if not path.is_file() or path.is_symlink() or not path.resolve().is_relative_to(ROOT):
        raise ValueError(f'Missing or unsafe public resource: {name}')
    return path


def public_files():
    worker = (ROOT / 'sw.js').read_text(encoding='utf-8')
    match = re.search(r'const FILES\s*=\s*(\[.*?\]);', worker, re.S)
    if not match:
        raise ValueError('The service worker public asset inventory is missing')
    pending = PUBLIC_EXTRA | {local_path(name, '') for name in json.loads(match[1])}
    pending |= {p.relative_to(ROOT).as_posix() for p in (ROOT / 'licenses').glob('*.txt')}
    pending.discard(None)
    inventory = {}
    while pending:
        name = min(pending)
        pending.remove(name)
        if name in inventory:
            continue
        path = checked_file(name)
        data = path.read_bytes()
        inventory[name] = data
        urls = []
        if path.suffix == '.html':
            parser = LocalReferences()
            parser.feed(data.decode('utf-8'))
            urls = parser.urls
        elif path.suffix == '.css':
            urls = re.findall(r'url\(\s*[\'"]?([^\s\)\'\"]+)', data.decode('utf-8'))
        elif path.suffix == '.webmanifest':
            manifest = json.loads(data)
            urls = [icon['src'] for icon in manifest.get('icons', [])]
            urls.append(manifest.get('start_url', './'))
        for url in urls:
            ref = local_path(url, PurePosixPath(name).parent)
            if ref:
                pending.add(ref)
    return dict(sorted(inventory.items()))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / 'dist')
    args = parser.parse_args()
    output = args.output.resolve()
    # Never clean arbitrary user directories or any parent of the source checkout.
    if output == ROOT or output in ROOT.parents or output == Path('/'):
        parser.error('Output must be a dedicated build directory, outside the source root itself')
    if output.exists() and any(output.iterdir()) and not (output / '.inga-build-output').is_file():
        parser.error('Refusing to replace a nonempty directory without an Inga build marker')
    subprocess.run([sys.executable, str(ROOT / 'scripts/sync_site.py'), '--check'], check=True)
    version = (ROOT / 'VERSION').read_text().strip()
    if not re.fullmatch(r'\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?', version):
        parser.error('VERSION must contain a semantic version, for example 1.0.0')
    site = public_files()
    delivery = {'site/' + name: data for name, data in site.items()}
    for name in ('Lancer_musee.bat', 'Ouvrir_Inga.bat'):
        delivery['site/' + name] = (ROOT / name).read_bytes()
    documents = sorted((ROOT / 'docs').glob('*.md'))
    if not documents:
        parser.error('Client delivery documentation is missing')
    for path in documents:
        delivery['documentation/' + path.name] = path.read_bytes()
    digest = lambda data: hashlib.sha256(data).hexdigest()
    manifest = {
        'product': 'Inga Interactive', 'version': version, 'format_version': 1,
        'public_files': {name: {'bytes': len(data), 'sha256': digest(data)} for name, data in site.items()},
        'delivery_files': {name: {'bytes': len(data), 'sha256': digest(data)} for name, data in sorted(delivery.items())},
    }
    manifest_data = (json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True) + '\n').encode()
    delivery['MANIFEST.json'] = manifest_data
    if output.exists():
        shutil.rmtree(output)
    (output / 'site').mkdir(parents=True)
    (output / '.inga-build-output').write_text('Generated by scripts/build_release.py\n')
    for name, data in site.items():
        path = output / 'site' / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
    archive = output / f'inga-interactive-{version}.zip'
    with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as bundle:
        for name, data in sorted(delivery.items()):
            info = zipfile.ZipInfo(f'inga-interactive-{version}/{name}', date_time=(2020, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            bundle.writestr(info, data)
    (output / 'MANIFEST.json').write_bytes(manifest_data)
    sums = [(archive.name, digest(archive.read_bytes())), ('MANIFEST.json', digest(manifest_data))]
    (output / 'SHA256SUMS').write_text(''.join(f'{sha}  {name}\n' for name, sha in sums))
    print(f'Built {len(site)} public files: {output / "site"}')
    print(f'Client package: {archive} ({archive.stat().st_size:,} bytes)')
    print(f'Checksums: {output / "SHA256SUMS"}')


if __name__ == '__main__':
    try:
        main()
    except (ValueError, OSError, subprocess.CalledProcessError) as error:
        sys.exit(f'Release build failed: {error}')
