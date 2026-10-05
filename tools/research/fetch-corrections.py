import json,pathlib,urllib.request
root=pathlib.Path('research/nanjing')
opener=urllib.request.build_opener(urllib.request.ProxyHandler({'https':'http://127.0.0.1:7890'}))
for name,url in [
 ('osm-relation-2138994.json','https://api.openstreetmap.org/api/0.6/relation/2138994/full.json'),
 ('osm-relation-2538928.json','https://api.openstreetmap.org/api/0.6/relation/2538928/full.json'),
 ('osm-eye-map.json','https://api.openstreetmap.org/api/0.6/map.json?bbox=118.690,31.991,118.705,32.003')]:
 target=root/name
 if target.exists():
  print('Retained',name);continue
 req=urllib.request.Request(url,headers={'User-Agent':'Mufu-Nanjing-illustrated-atlas/1.0'})
 with opener.open(req,timeout=60) as response: data=json.load(response)
 if not data.get('elements'):raise RuntimeError('No geometry returned')
 target.write_text(json.dumps(data,ensure_ascii=False),encoding='utf-8')
 print('Saved',name,'elements',len(data['elements']))
