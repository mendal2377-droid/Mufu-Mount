"""Representative metro and bus lines for Tiny Nanjing, from OpenStreetMap route relations.

    python -P tools/research/transit-prep.py

Reads research/core/data/osm-core-transit.json (Overpass: route=subway|bus relations in the core
bbox, `out geom`) and research/core/data/osm-core.json (station and bus-stop nodes with names), and
writes public/scenes/core/transit.json in the world's Blender frame (x east, y north, metres from
Xinjiekou). research/transit/FACTS.md says why these lines and where each number comes from.
"""
import heapq
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'research' / 'core' / 'data'
OUT = ROOT / 'public' / 'scenes' / 'core' / 'transit.json'
ORIGIN = (32.0418, 118.7838)
X0, X1, Y0, Y1 = -5286, 7851, -1550, 12855       # the core map (tools/research/area-prep.py), east over Purple Mountain
M_LAT = 111320.0
M_LON = 111320.0 * math.cos(math.radians(ORIGIN[0]))

# The chosen lines (research/transit/FACTS.md): (route, ref, direction's first stop, English name).
LINES = [
    ('subway', '1', '八卦洲大桥南', 'Metro Line 1', 'Under Zhongshan Road: Nanjing Station, Xuanwumen, Gulou, Xinjiekou'),
    ('subway', '2', '鱼嘴', 'Metro Line 2', 'East to west under Zhongshan East Road: Ming Palace, Daxinggong, Xinjiekou'),
    ('subway', '3', '林场', 'Metro Line 3', 'Nanjing Station to Jiming Temple and Daxinggong: meets Lines 1, 4 and 2'),
    ('subway', '4', '龙江', 'Metro Line 4', 'Gulou, Yunnan Road, Jiming Temple'),
    ('bus', '1', None, 'Bus 1', 'Along Zhongshan Road: Xinjiekou, Gulou'),
    ('bus', '25', None, 'Bus 25', 'Along Zhongshan Road: Xinjiekou, Gulou'),
    # The city's axis: Zhongshan Wharf on the Yangtze along Zhongshan North Road, Zhongshan Road and
    # Zhongshan East Road to the Sun Yat-sen Mausoleum, the road built in 1928-29 for Sun Yat-sen's
    # funeral procession. Now the whole route, the wharf to the Mausoleum car park (the owner's ask).
    ('bus', '34', None, 'Bus 34', 'Zhongshan Wharf along the Zhongshan Road axis, through Zhongshan Gate, to the Sun Yat-sen Mausoleum'),
]
STOP_NEAR = {'subway': 120.0, 'bus': 40.0}
# Lines stop at the Yangtze: the map reaches over the river by Mufu Mountain, but Line 3's
# Liuzhou East Road (柳洲东路) is in Pukou, across it.
SOUTH_BANK = 12200
# Station names in pinyin, as Nanjing Metro's own signs give them (OSM has name:en for few).
PINYIN = {
    '迈皋桥': 'Maigaoqiao', '红山动物园': 'Hongshan Zoo', '南京站': 'Nanjing Railway Station', '新模范马路': 'Xinmofan Malu',
    '玄武门': 'Xuanwumen', '鼓楼': 'Gulou', '珠江路': 'Zhujiang Lu', '新街口': 'Xinjiekou', '张府园': 'Zhangfuyuan',
    '集庆门大街': 'Jiqingmen Dajie', '云锦路': 'Yunjin Lu', '莫愁湖': 'Mochou Hu', '汉中门': 'Hanzhongmen', '上海路': 'Shanghai Lu',
    '大行宫': 'Daxinggong', '西安门': "Xi'anmen", '上元门': 'Shangyuanmen', '五塘广场': 'Wutang Guangchang', '小市': 'Xiaoshi',
    '南京林业大学·新庄': 'Nanjing Forestry University · Xinzhuang', '鸡鸣寺': 'Jimingsi', '浮桥': 'Fuqiao', '常府街': 'Changfujie',
    '龙江': 'Longjiang', '草场门·南艺·二师': 'Caochangmen', '云南路': 'Yunnan Lu', '九华山': 'Jiuhuashan',
    '岗子村': 'Gangzicun', '燕子矶': 'Yanziji', '吉祥庵': "Jixiang'an", '晓庄': 'Xiaozhuang', '明故宫': 'Minggugong',
    # Bus stops: English where the place has one (gates, parks, hospitals), else pinyin.
    '三牌楼': 'Sanpailou', '中央路·鼓楼': 'Zhongyang Lu · Gulou', '中山东路·逸仙桥（毗卢寺）': 'Zhongshan East Rd · Yixian Bridge',
    '中山码头': 'Zhongshan Wharf', '中山路·珠江路北': 'Zhongshan Rd · Zhujiang Rd North', '中山路·珠江路南': 'Zhongshan Rd · Zhujiang Rd South',
    '中山门': 'Zhongshan Gate', '南医大二附东院': 'Nanjing Medical University Hospital 2', '大方巷': 'Dafangxiang',
    '大行宫东': 'Daxinggong East', '大行宫西': 'Daxinggong West', '山西路': 'Shanxi Lu', '新街口东': 'Xinjiekou East',
    '新街口东站': 'Xinjiekou East', '新街口北站': 'Xinjiekou North', '明故宫东': 'Ming Palace East', '明故宫西': 'Ming Palace West',
    '玄武湖公园': 'Xuanwu Lake Park', '玄武门地铁站南': 'Xuanwumen Station South', '珠江路': 'Zhujiang Lu', '珠江路南站': 'Zhujiang Lu South',
    '珠江路南站;赛百味': 'Zhujiang Lu South', '萨家湾': 'Sajiawan', '虹桥': 'Hongqiao', '西流湾公园': 'Xiliuwan Park',
    '长江路': 'Changjiang Lu', '鼓楼北站': 'Gulou North', '鼓楼医院': 'Gulou Hospital',
    # East over Purple Mountain (the map widened on 3 Nov 2026).
    '苜蓿园': 'Muxuyuan', '钟灵街': 'Zhonglingjie', '蒋王庙': 'Jiangwangmiao', '王家湾': 'Wangjiawan',
    '卫桥': 'Weiqiao', '卫岗': 'Weigang', '下马坊': 'Xiamafang', '博爱园': "Bo'ai Garden",
    '中山陵停车场': 'Sun Yat-sen Mausoleum Car Park', '上行观光车起点站': 'Scenic Shuttle (Uphill) Start',
}
STREETS = {'trunk', 'trunk_link', 'primary', 'primary_link', 'secondary', 'secondary_link', 'tertiary', 'tertiary_link', 'residential', 'unclassified'}
FEATURES = json.loads((ROOT / 'research' / 'core' / 'data' / 'features.json').read_text(encoding='utf-8'))


def xy(lat, lon):
    return ((lon - ORIGIN[1]) * M_LON, (lat - ORIGIN[0]) * M_LAT)


def stitch(ways):
    """Member ways in relation order, each turned to continue from the last."""
    line = []
    for pts in ways:
        if not pts:
            continue
        if not line:
            line = list(pts)
            continue
        ends = [(math.dist(line[-1], pts[0]), False, False), (math.dist(line[-1], pts[-1]), True, False),
                (math.dist(line[0], pts[0]), False, True), (math.dist(line[0], pts[-1]), True, True)]
        _, rev, front = min(ends)
        if len(line) == len(ways[0]) and front:      # the first way may itself have run backwards
            line.reverse()
            front = False
        seg = list(reversed(pts)) if rev else list(pts)
        line += seg[1:] if math.dist(line[-1], seg[0]) < 1 else seg
    return line


def route_through_stops(rel):
    """The relation's line as a path through its stops in order, over a graph of its member ways:
    bus relations list ways for both directions out of order, so chaining them jumped kilometres."""
    graph = {}
    rel_nodes = set()
    for m in rel['members']:
        if m['type'] != 'way' or m['role'] not in ('', 'forward', 'backward'):
            continue
        g = [xy(q['lat'], q['lon']) for q in m.get('geometry', [])]
        for a, b in zip(g, g[1:]):
            ka, kb = (round(a[0], 1), round(a[1], 1)), (round(b[0], 1), round(b[1], 1))
            d = math.dist(a, b)
            graph.setdefault(ka, {})[kb] = d
            graph.setdefault(kb, {})[ka] = d
            rel_nodes.update((ka, kb))
    # The city's own streets fill the gaps where the relation is incomplete, at a cost: the bus
    # keeps to its mapped ways where they exist.
    if rel['tags'].get('route') == 'bus':
        for w in FEATURES['ways']:
            if w.get('kind') not in STREETS:
                continue
            for a, b in zip(w['pts'], w['pts'][1:]):
                ka, kb = (round(a[0], 1), round(a[1], 1)), (round(b[0], 1), round(b[1], 1))
                d = math.dist(a, b) * 1.6
                graph.setdefault(ka, {}).setdefault(kb, d)
                graph.setdefault(kb, {}).setdefault(ka, d)
        # Join the relation's nodes to the nearest street node within 15 m.
        street = [k for k in graph if len(graph[k]) and k not in rel_nodes]
        for k in rel_nodes:
            near = min(street, key=lambda q: (q[0] - k[0]) ** 2 + (q[1] - k[1]) ** 2, default=None)
            if near and math.dist(near, k) < 15:
                graph[k][near] = graph[near][k] = math.dist(near, k)
    keys = list(graph)
    # Stops, or where a relation has no stop-role nodes (Bus 34), every stop node it lists in route
    # order: its platforms, and the four at the Mausoleum end mapped with no role at all (Weigang,
    # Xiamafang, Bo'ai Garden and the Mausoleum car park), twins within 30 m kept once.
    stops = [xy(m['lat'], m['lon']) for m in rel['members'] if m['type'] == 'node' and m['role'].startswith('stop') and 'lat' in m]
    if not stops:
        for m in rel['members']:
            if m['type'] == 'node' and 'lat' in m and (m['role'] == '' or m['role'].startswith('platform')):
                q = xy(m['lat'], m['lon'])
                if not stops or math.dist(stops[-1], q) > 30:
                    stops.append(q)
    # Only those on this map.
    stops = [q for q in stops if X0 < q[0] < X1 and Y0 < q[1] < Y1] or stops

    def snap(p):
        return min(keys, key=lambda k: (k[0] - p[0]) ** 2 + (k[1] - p[1]) ** 2)

    def path(a, b):
        dist, prev, heap = {a: 0.0}, {}, [(0.0, a)]
        while heap:
            d, u = heapq.heappop(heap)
            if u == b:
                break
            if d > dist[u]:
                continue
            for v, w in graph[u].items():
                if d + w < dist.get(v, 1e18):
                    dist[v], prev[v] = d + w, u
                    heapq.heappush(heap, (d + w, v))
        if b not in dist:
            print(f'  no path {a} -> {b}: straight line', flush=True)
            return [a, b]
        out = [b]
        while out[-1] != a:
            out.append(prev[out[-1]])
        return out[::-1]
    nodes = [snap(q) for q in stops]
    line = [nodes[0]]
    for a, b in zip(nodes, nodes[1:]):
        if a != b:
            line += path(a, b)[1:]
    return line


def clip(line):
    """The longest run inside the map (plus a margin), so a ride never leaves the city."""
    best, run = [], []
    for p in line:
        if X0 - 200 < p[0] < X1 + 200 and Y0 - 200 < p[1] < min(Y1 + 200, SOUTH_BANK):
            run.append(p)
        else:
            best, run = max(best, run, key=len), []
    return max(best, run, key=len)


def project(line, p):
    """(distance along the line, distance off it) of point p."""
    best, s = (1e18, 0.0), 0.0
    for a, b in zip(line, line[1:]):
        L = math.dist(a, b) or 1e-9
        t = max(0.0, min(1.0, ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / L / L))
        q = (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)
        d = math.dist(p, q)
        if d < best[0]:
            best = (d, s + L * t)
        s += L
    return best[1], best[0]


def thin(line, step=6.0):
    out = [line[0]]
    for p in line[1:]:
        if math.dist(out[-1], p) >= step:
            out.append(p)
    if out[-1] != line[-1]:
        out.append(line[-1])
    return out


def main():
    rels = json.loads((DATA / 'osm-core-transit.json').read_text(encoding='utf-8'))['elements']
    osm = json.loads((DATA / 'osm-core.json').read_text(encoding='utf-8'))
    nodes = [e for e in (osm['elements'] if 'elements' in osm else osm) if e['type'] == 'node' and e.get('tags')]
    # Stop nodes fetched per line where the city's bands lack them (Bus 34's platforms along
    # Zhongshan North Road: osm-core-bus34.json, Overpass `relation(17555541);node(r);out;`).
    for extra in sorted(DATA.glob('osm-core-bus*.json')):
        nodes += [e for e in json.loads(extra.read_text(encoding='utf-8'))['elements'] if e['type'] == 'node' and e.get('tags')]
    stations = [n for n in nodes if n['tags'].get('railway') == 'station' and n['tags'].get('station') == 'subway'
                or n['tags'].get('public_transport') == 'station' and n['tags'].get('subway') == 'yes']
    # Bus stops: highway=bus_stop, or the platforms OSM's newer scheme maps instead (Bus 34 along
    # Zhongshan North Road).
    bus_stops = [n for n in nodes if n['tags'].get('highway') == 'bus_stop'
                 or n['tags'].get('public_transport') == 'platform' and n['tags'].get('bus') == 'yes']
    viaducts = [e for e in (osm['elements'] if 'elements' in osm else osm) if e['type'] == 'way' and e.get('geometry')
                and e.get('tags', {}).get('railway') == 'subway' and e['tags'].get('bridge')]
    # Road tunnels (the city build leaves them out): a bus route through one runs underground.
    road_tunnels = [[xy(g['lat'], g['lon']) for g in e['geometry']] for e in (osm['elements'] if 'elements' in osm else osm)
                    if e['type'] == 'way' and e.get('geometry') and e.get('tags', {}).get('highway') and e['tags'].get('tunnel') in ('yes', 'building_passage')
                    and e['tags'].get('highway') not in ('footway', 'path', 'steps', 'cycleway')]
    out = []
    for route, ref, start, name_en, about in LINES:
        rel = next((r for r in rels if r['tags'].get('route') == route and r['tags'].get('ref') == ref
                    and (start is None or r['tags'].get('from') == start)), None)
        if rel is None:
            raise SystemExit(f'no relation for {route} {ref}')
        line = thin(clip(route_through_stops(rel)))
        if route == 'subway':
            # A single reach of 1.5 km+ is the tunnel under the Yangtze (Line 3 to Pukou): the line on
            # this map is the longest part without one.
            parts, cur = [], [line[0]]
            for a, b in zip(line, line[1:]):
                if math.dist(a, b) > 1500:
                    parts.append(cur); cur = []
                cur.append(b)
            parts.append(cur)
            line = max(parts, key=lambda q: sum(math.dist(a, b) for a, b in zip(q, q[1:])))
        length = sum(math.dist(a, b) for a, b in zip(line, line[1:]))
        stops, seen = [], set()
        for n in stations if route == 'subway' else bus_stops:
            p = xy(n['lat'], n['lon'])
            s, off = project(line, p)
            label = n['tags'].get('name', '')
            if off < STOP_NEAR[route] and label and label not in seen and 0 < s < length:
                seen.add(label)
                stops.append({'name': label, 'en': PINYIN.get(label) or n['tags'].get('name:en', ''), 's': round(s, 1),
                              'at': [round(p[0], 1), round(p[1], 1)], 'osm': n['id']})
        stops.sort(key=lambda q: q['s'])
        if route == 'bus' and len(stops) >= 2 and ref != '34':   # Bus 34 runs its whole length on the map
            # Buses run between their first and last stop here, out and back: beyond them the
            # relations reach outside the city's streets (a stretch north of Xiaoshi crossed blocks).
            a_s, b_s = max(0.0, stops[0]['s'] - 120), min(length, stops[-1]['s'] + 120)
            cut, run = [], 0.0
            for p0, p1 in zip(line, line[1:]):
                seg = math.dist(p0, p1)
                if run + seg >= a_s and run <= b_s:
                    t0, t1 = max(0.0, (a_s - run) / seg) if seg else 0.0, min(1.0, (b_s - run) / seg) if seg else 1.0
                    q0 = (p0[0] + (p1[0] - p0[0]) * t0, p0[1] + (p1[1] - p0[1]) * t0)
                    q1 = (p0[0] + (p1[0] - p0[0]) * t1, p0[1] + (p1[1] - p0[1]) * t1)
                    if not cut:
                        cut.append(q0)
                    cut.append(q1)
                run += seg
            line = thin(cut, 2.0)
            length = sum(math.dist(a, b) for a, b in zip(line, line[1:]))
            for q in stops:
                q['s'] = round(project(line, (q['at'][0], q['at'][1]))[0], 1)
        # Where the line runs on a viaduct (OSM subway ways with bridge=yes and this line's name):
        # Line 1 north of Nanjing Station. Ranges of distance along the line, joined when close.
        elevated = []
        if route == 'subway':
            for e in viaducts:
                if f'{ref}号线' not in e['tags'].get('name', ''):
                    continue
                ss = [project(line, xy(g['lat'], g['lon'])) for g in e['geometry']]
                ss = [q for q, off in ss if off < 30]
                if ss:
                    elevated.append([min(ss), max(ss)])
            elevated.sort()
            joined = []
            for a, b in elevated:
                if joined and a - joined[-1][1] < 150:
                    joined[-1][1] = max(joined[-1][1], b)
                else:
                    joined.append([a, b])
            elevated = [[round(a), round(b)] for a, b in joined if b - a > 60]
        tunnel = []
        if route == 'bus':
            # Points of the route within 10 m of a road tunnel and 40 m+ inside it, as ranges along the line.
            cum, ss = [0.0], []
            for a, b in zip(line, line[1:]):
                cum.append(cum[-1] + math.dist(a, b))
            for t in road_tunnels:
                for q in t:
                    s_, off = project(line, q)
                    if off < 10:
                        ss.append(s_)
            ss.sort()
            for v in ss:
                if tunnel and v - tunnel[-1][1] < 60:
                    tunnel[-1][1] = v
                else:
                    tunnel.append([v, v])
            tunnel = [[round(a), round(b)] for a, b in tunnel if b - a > 40]
        gaps = max(math.dist(a, b) for a, b in zip(line, line[1:]))
        out.append({'id': f'{route}-{ref}', 'kind': 'metro' if route == 'subway' else 'bus', 'ref': ref,
                    'name': rel['tags'].get('name', ''), 'en': name_en, 'about': about,
                    'colour': rel['tags'].get('colour') if route == 'subway' else None,
                    'osm': rel['id'], 'length': round(length), 'elevated': elevated if route == 'subway' else [], 'tunnel': tunnel, 'pts': [[round(x, 1), round(y, 1)] for x, y in line], 'stops': stops})
        print(f"{name_en:13} {rel['id']:>9} {length / 1000:5.1f} km  {len(line):4} pts  max gap {gaps:5.0f} m  "
              f"{len(stops):2} stops: {' · '.join(q['name'] for q in stops)}" + (f"  elevated {elevated}" if route == 'subway' and elevated else '')
              + (f"  tunnels {tunnel}" if tunnel else ''))
    OUT.write_text(json.dumps({'source': 'OpenStreetMap route relations and stop nodes (ODbL)', 'lines': out},
                              ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print('wrote', OUT.relative_to(ROOT), f'{OUT.stat().st_size // 1024} KB')


main()
