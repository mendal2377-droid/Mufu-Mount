import fs from 'node:fs/promises';
import path from 'node:path';
// Existing reviewed snapshots survive upstream errors and rate limits.
const directory='research/nanjing';await fs.mkdir(directory,{recursive:true});
async function save(name,url){
  const target=path.join(directory,name);try{await fs.access(target);console.log('Retained',name);return;}catch{}
  const response=await fetch(url,{signal:AbortSignal.timeout(60000)});
  if(!response.ok)throw Error(`${name}: HTTP ${response.status}. Retry later; respect rate limits.`);
  await fs.writeFile(target,JSON.stringify(await response.json()));console.log('Saved',name);
}
const query=`[out:json][timeout:60];(
 nwr(31.20,118.35,32.65,119.20)[name~"^(玄武湖|莫愁湖|石臼湖|固城湖|金牛湖|紫金山|牛首山|栖霞山|汤山|游子山|幕府山|老门东|夫子庙|南京夫子庙|中山陵|明孝陵|鸡鸣寺|中华门|阅江楼|紫峰大厦|南京长江大桥|南京长江三桥|南京长江四桥|高淳老街|南京眼|总统府)$"];
 way(31.7,118.35,32.45,119.20)[waterway=river][name~"长江|秦淮河"];
);out tags center geom;`;
await save('osm-source.json','https://overpass-api.de/api/interpreter?data='+encodeURIComponent(query));
for(const id of [4293790,11308636,14305804,18018554,18231223,18303735,2131524])
  await save(`osm-relation-${id}.json`,`https://api.openstreetmap.org/api/0.6/relation/${id}/full.json`);
await save('third-bridge.json','https://www.wikidata.org/wiki/Special:EntityData/Q3540210.json');
