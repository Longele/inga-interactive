#!/usr/bin/env python3
"""Generate the museum page and offline cache version from the public site files."""
import argparse
import hashlib
import json
from pathlib import Path
import re

root = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--check', action='store_true', help='Check generated files without changing them')
args = parser.parse_args()
source = (root / 'index.html').read_bytes()
marker = b'<style>html,body{margin:0;background:#0d1315}</style>'
assert source.count(marker) == 1, 'Museum insertion marker is missing or ambiguous'
museum = source.replace(marker, b'<script>window.INGA_MUSEE=true;</script>\n' + marker)
worker = (root / 'sw.js').read_text()
# Runtime extensions and the release identifier are part of the same atomic offline edition.
paths = json.loads(re.search(r'const FILES=(\[.*?\]);', worker).group(1))
paths = sorted(set(paths) | {p.name for p in root.glob('*.css')} |
               {p.name for p in root.glob('*.js') if p.name != 'sw.js'} |
               {p.relative_to(root).as_posix() for p in (root / 'voix').glob('*.mp3')} |
               ({'VERSION'} if (root / 'VERSION').exists() else set()))
worker = re.sub(r'const FILES=\[.*?\];', 'const FILES=' + json.dumps(paths, ensure_ascii=False) + ';', worker)
digest = hashlib.sha256()
for name in sorted(set(paths)):
    data = source if name in ('./', 'index.html') else museum if name == 'musee.html' else (root / name).read_bytes()
    digest.update(name.encode() + b'\0' + data)
# Include worker logic itself, except the generated version, so policy changes also invalidate the cache.
normalized = re.sub(r"const CACHE_VERSION='[^']*';", "const CACHE_VERSION='';", worker)
digest.update(normalized.encode())
worker = re.sub(r"const CACHE_VERSION='[^']*';", f"const CACHE_VERSION='{digest.hexdigest()[:16]}';", worker)
outputs = {'musee.html': museum, 'sw.js': worker.encode()}
stale = [name for name, data in outputs.items() if (root / name).read_bytes() != data]
if args.check:
    if stale:
        parser.exit(1, 'Run python3 scripts/sync_site.py to refresh: ' + ', '.join(stale) + '\n')
    print('Museum page and offline version are current.')
else:
    for name in stale:
        (root / name).write_bytes(outputs[name])
    print('Updated: ' + (', '.join(stale) or 'no changes'))
