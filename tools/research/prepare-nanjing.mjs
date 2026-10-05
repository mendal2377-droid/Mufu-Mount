import fs from 'node:fs';
const base='research/nanjing/';
const source=JSON.parse(fs.readFileSync(base+'osm-source.json'));
const elements=new Map(source.elements.map(e=>[`${e.type}/${e.id}`,e]));
const rings={};
const tolerance=.0006;
function simplify(points){
  if(points.length<4)return points;
  const out=[points[0]];for(let i=1;i<points.length-1;i++){
    if(Math.hypot(points[i][0]-out.at(-1)[0],points[i][1]-out.at(-1)[1])>tolerance)out.push(points[i]);
  }out.push(points.at(-1));return out;
}
function assemble(segments){
  const pending=segments.filter(p=>p.length>1).map(p=>p.slice()),result=[];
  const same=(a,b)=>Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1])<1e-7;
  while(pending.length){let line=pending.pop(),changed=true;
    while(changed&&!same(line[0],line.at(-1))){changed=false;
      for(let i=0;i<pending.length;i++){let p=pending[i];
        if(same(line.at(-1),p.at(-1)))p=p.slice().reverse();
        if(same(line.at(-1),p[0])){line.push(...p.slice(1));pending.splice(i,1);changed=true;break;}
        if(same(line[0],p[0]))p=p.slice().reverse();
        if(same(line[0],p.at(-1))){line.unshift(...p.slice(0,-1));pending.splice(i,1);changed=true;break;}
      }
    }if(same(line[0],line.at(-1)))result.push(simplify(line));
  }return result;
}
for(const id of [4293790,11308636,14305804,18018554,18231223,18303735,2131524]){
  const j=JSON.parse(fs.readFileSync(base+`osm-relation-${id}.json`));
  const nodes=new Map(j.elements.filter(e=>e.type==='node').map(e=>[e.id,[e.lon,e.lat]]));
  const ways=new Map(j.elements.filter(e=>e.type==='way').map(e=>[e.id,e.nodes.map(n=>nodes.get(n)).filter(Boolean)]));
  const rel=j.elements.find(e=>e.type==='relation'&&e.id===id);
  rings[id]={outer:assemble(rel.members.filter(m=>m.role==='outer').map(m=>ways.get(m.ref)||[])),
    inner:assemble(rel.members.filter(m=>m.role==='inner').map(m=>ways.get(m.ref)||[]))};
  const coords=rings[id].outer.flat();
  elements.set(`relation/${id}`,{...rel,coords});
}
function center(key){const e=elements.get(key);if(!e)throw Error(key);
  const g=e.coords||e.geometry?.filter(Boolean).map(p=>[p.lon,p.lat]);
  return g?.length?[(Math.min(...g.map(p=>p[0]))+Math.max(...g.map(p=>p[0])))/2,
    (Math.min(...g.map(p=>p[1]))+Math.max(...g.map(p=>p[1])))/2]:[e.lon,e.lat];
}
const specs=[
 ['mufu','幕府山','Mufu mountain','mount','way/62344629'],
 ['bridge','长江大桥','Yangtze bridge','truss','way/756599299'],
 ['yuejiang','阅江楼','Yuejiang tower','tower','way/461035531'],
 ['xuanwu','玄武湖','Xuanwu lake','lake',null,[118.79319,32.07363]],
 ['jiming','鸡鸣寺','Jiming temple','pagoda','way/319055520'],
 ['zifeng','紫峰大厦','Zifeng tower','skyline','way/140809508'],
 ['zijin','紫金山','Purple mountain','mount','way/63058368'],
 ['zhongshan','中山陵','Zhongshan mausoleum','mausoleum','relation/18303735'],
 ['xiaoling','明孝陵','Ming Xiaoling','tomb','way/380923041'],
 ['palace','总统府','Presidential palace','palace','way/62353727'],
 ['qinhuai','夫子庙 · 秦淮','Qinhuai old town','oldtown','way/1531638749'],
 ['zhonghua','中华门 · 城墙','Zhonghua gate','wall','relation/11308636'],
 ['mendong','老门东','Laomendong','oldtown',null,[118.7832,32.0170]],
 ['mochou','莫愁湖','Mochou lake','lake','relation/18231223'],
 ['eye','南京眼','Nanjing eye','eye','node/3281370485'],
 ['third','大胜关长江大桥','Third Yangtze bridge','cable',null,[118.64138888888888,31.97]],
 ['niushou','牛首山','Niushou mountain','domes','relation/4293790'],
 ['qixia','栖霞山','Qixia mountain','temple','way/89925772'],
 ['tangshan','汤山','Tangshan springs','springs','node/7492111322'],
 ['gaochun','高淳老街','Gaochun old street','oldtown','node/1836262442'],
];
const landmarks=specs.map(([id,zh,name,kind,key,coord])=>({id,zh,name,kind,coord:coord||center(key),
  source:key?`https://www.openstreetmap.org/${key}`:id==='third'?'https://www.wikidata.org/wiki/Q3540210':
    id==='mendong'?'https://dfz.nanjing.gov.cn/gzdt/202411/t20241101_4998828.html':'https://mapcarta.com/16226832',
  placement:['gaochun','tangshan'].includes(id)?'approximate vicinity of named transit stop':key?'OSM feature center':id==='mendong'?'inferred within official district description':id==='third'?'Wikidata coordinate':'public map coordinate',
  region:id==='gaochun'?'south':['qixia','tangshan'].includes(id)?'east':'core'}));
const rivers=source.elements.filter(e=>e.type==='way'&&e.tags.waterway==='river'&&!e.tags.tunnel)
  .map(e=>({name:e.tags.name,osm:e.id,points:simplify(e.geometry.filter(Boolean).map(p=>[p.lon,p.lat]))}));
const lakes=[['mochou',18231223],['shijiu',14305804],['gucheng',18018554]].map(([id,ref])=>({id,source:`https://www.openstreetmap.org/relation/${ref}`,...rings[ref]}));
// The Xuanwu API refuses its full geometry. Keep this shape explicitly inferred,
// rather than claiming the hand-sketched shoreline is downloaded map geometry.
lakes.push({id:'xuanwu',source:'https://mapcarta.com/16226832',inferred:true,
  outer:[[[118.775,32.070],[118.777,32.084],[118.790,32.096],[118.809,32.090],[118.813,32.077],[118.801,32.066],[118.782,32.064],[118.775,32.070]]],
  inner:[[[118.784,32.075],[118.789,32.082],[118.795,32.080],[118.792,32.073],[118.784,32.075]],
    [[118.800,32.078],[118.805,32.082],[118.807,32.078],[118.804,32.073],[118.800,32.078]]]});
const data={version:1,retrieved:'2026-10-05',license:'ODbL-1.0',licenseUrl:'https://opendatacommons.org/licenses/odbl/1-0/',
  attribution:'© OpenStreetMap contributors; supplementary coordinates: Wikidata (CC0) and referenced public map',
  origin:[118.78,32.04],scale:.065,landmarks,rivers,lakes,boundary:rings[2131524].outer,
  note:'Simplified scenic atlas. Geographic anchors are public-map positions; terrain, buildings, roads, routes and some shorelines are artistic approximations. Mufu detail scene remains a separate non-surveyed model.'};
fs.writeFileSync('public/city/nanjing.json',JSON.stringify(data));
console.log({landmarks:landmarks.length,rivers:rivers.length,lakes:lakes.length,boundaryRings:data.boundary.length,bytes:fs.statSync('public/city/nanjing.json').size});
console.log(landmarks.map(p=>({id:p.id,coord:p.coord})));
