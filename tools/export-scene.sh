#!/bin/sh
# Rebuild a Blender landmark and export it for the web: ./tools/export-scene.sh zhongshan [--render]
set -e
id=${1:-zhongshan}; shift || true
B=${BLENDER_EXE:-/d/soft/blender/blender.exe}
flag=--no-render; [ "$1" = "--render" ] && flag=
"$B" -b --factory-startup --python blender/build_$id.py -- $flag 2>&1 | grep -E "BUILD|RENDERED|Error|Traceback|line "
"$B" -b art-src/$id.blend --python blender/export_web.py -- $id 2>&1 | grep -E "EXPORTED|Error|Traceback|line "
npx gltf-transform optimize public/scenes/$id/static.raw.glb public/scenes/$id/static.glb \
  --compress meshopt --texture-compress false --simplify false --palette false 2>&1 | tail -1
