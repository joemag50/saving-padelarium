#!/usr/bin/env bash
# Builds one friend's sprites from art/characters/<id>.json:
#   1. Blender renders every animation frame (art/blender/build_character.py).
#   2. Frames are packed into one strip per animation in public/assets/characters/<id>/.
#   3. Animated GIF previews land in art/preview/ (look at them with Quick Look: space bar).
#
# Usage: art/build.sh <id> [--only=<animation>]
# Needs Blender (brew install --cask blender) and ImageMagick (brew install imagemagick).
set -euo pipefail

id="${1:?usage: art/build.sh <id> [--only=<animation>]}"
shift
root="$(cd "$(dirname "$0")/.." && pwd)"
config="$root/art/characters/$id.json"
blender="${BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}"
source_blend="$root/art/source/$(python3 -c "import json,sys; print(json.load(open(sys.argv[1]))['source'])" "$config")"
frames_dir="$root/art/.render/$id"
out_dir="$root/public/assets/characters/$id"
preview_dir="$root/art/preview"

mkdir -p "$frames_dir" "$out_dir" "$preview_dir"
"$blender" -b --disable-autoexec "$source_blend" -P "$root/art/blender/build_character.py" -- "$config" "$frames_dir" "$@" \
  | grep -E "Error:|Traceback|DONE" || true
cp "$frames_dir/manifest.json" "$root/art/characters/$id.frames.json"

for anim in $(python3 -c "import json,sys; print(' '.join(json.load(open(sys.argv[1]))['animations']))" "$frames_dir/manifest.json"); do
  frames=("$frames_dir/$id-$anim"-[0-9][0-9].png)
  magick "${frames[@]}" +append -strip -define png:compression-level=9 "$out_dir/$anim.png"
  magick -delay 8 -dispose background "${frames[@]}" -delay 40 "${frames[${#frames[@]}-1]}" \
    -background '#2a3550' -alpha remove -loop 0 "$preview_dir/$id-$anim.gif"
done
# Costumed characters: the mask on its own, tossed when they go down in later levels.
if [ -f "$frames_dir/$id-mask.png" ]; then
  magick "$frames_dir/$id-mask.png" -trim +repage -strip "$out_dir/mask.png"
fi
echo "✓ $id → $out_dir"
