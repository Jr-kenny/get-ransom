#!/usr/bin/env bash
# Rasterize public/favicon.svg → JPEG favicon sizes via headless Chrome.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SVG="$ROOT/public/favicon.svg"
OUT="$(mktemp -d)"
HTML="$OUT/favicon.html"
PNG="$OUT/favicon-512.png"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

cat >"$HTML" <<EOF
<!doctype html>
<html><head><style>
html,body{margin:0;width:512px;height:512px;background:#050a14;overflow:hidden}
svg{width:512px;height:512px;display:block}
</style></head><body>
$(cat "$SVG" | sed 's/viewBox="0 0 64 64"/viewBox="0 0 64 64" width="512" height="512"/')
</body></html>
EOF

"$CHROME" --headless --disable-gpu --hide-scrollbars \
  --force-device-scale-factor=1 --window-size=512,512 \
  --screenshot="$PNG" "file://$HTML"

"$MIMO_PYTHON" - <<PY
from PIL import Image
from pathlib import Path
img = Image.open("$PNG").convert("RGB")
root = Path("$ROOT")
pairs = [
    (root / "public" / "favicon.jpg", 512, 94),
    (root / "public" / "favicon-256.jpg", 256, 94),
    (root / "public" / "apple-touch-icon.jpg", 180, 94),
    (root / "thumbnails" / "favicon-512.jpg", 512, 94),
]
for path, size, q in pairs:
    path.parent.mkdir(parents=True, exist_ok=True)
    out = img if size == 512 else img.resize((size, size), Image.Resampling.LANCZOS)
    out.save(path, "JPEG", quality=q, optimize=True, progressive=True)
    print(f"wrote {path} ({out.size[0]}x{out.size[1]})")
PY
