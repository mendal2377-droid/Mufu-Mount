#!/bin/sh
# One Overpass band of the Tiny Nanjing city (merged into research/core/data/osm-core.json by
# tools/research/merge-core-bands.py):
#   ./tools/research/fetch-core-band.sh mufu 32.116,118.726,32.160,118.824
set -e
name=$1; bb=$2
q="[out:json][timeout:300];(way[\"building\"]($bb);way[\"building:part\"]($bb);way[\"highway\"]($bb);way[\"railway\"]($bb);way[\"landuse\"]($bb);way[\"leisure\"]($bb);way[\"natural\"]($bb);way[\"waterway\"]($bb);way[\"water\"]($bb);way[\"amenity\"]($bb);way[\"historic\"]($bb);way[\"man_made\"]($bb);way[\"tourism\"]($bb);way[\"barrier\"]($bb);way[\"place\"]($bb);relation[\"type\"=\"multipolygon\"]($bb);relation[\"building\"]($bb);node[\"natural\"~\"tree|peak\"]($bb);node[\"railway\"=\"station\"]($bb);node[\"highway\"=\"bus_stop\"]($bb);node[\"public_transport\"]($bb);node[\"historic\"]($bb);node[\"tourism\"]($bb););out geom;"
out=research/core/data/osm-core-$name.json
for wait in 0 30 90 180; do
  sleep $wait
  curl -s -m 320 -A "Mufu-Mount-research/1.0 (personal project)" -o "$out" --data-urlencode "data=$q" https://overpass-api.de/api/interpreter
  head -c 1 "$out" | grep -q "{" && { echo "$name ok $(wc -c < "$out") bytes"; exit 0; }
done
echo "$name failed"; exit 1
