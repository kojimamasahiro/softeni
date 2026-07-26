# 同姓同名の別人を検出して data/players/homonyms.json を生成する。
#
# 検出器は3つ（いずれか1つでも成立すれば「別人確定」として登録する）。
#   D: 同一年に「非隣接の学校段階」(小↔高/小↔大/中↔大/高↔成 等＝物理的に不可能)が共存する。
#   E: 出生年の許容レンジが交差しない（2026-07-26 追加）。generationId と categoryId の age 部から
#      1観測ごとに出生年レンジを引き、全観測の積集合が空なら別人。D が「同一年」しか見ないため
#      取りこぼしていた (a)年をまたぐ矛盾 (b)cat() が None を返す大会 (c)overNN のマスターズ区分
#      を拾う。レンジは**わざと広め**に取る（広い＝矛盾しにくい＝過小検出側）。
#   F: 同一大会・同一年に異なる都道府県で出現する（2026-07-26 追加）。1人が同じ大会で2県を
#      代表することは不可能。世代が同じで E に掛からない同姓同名を捕まえる唯一の信号。
#      所属校名は略称ゆれがあるため**県のみ**で判定する（学連/高体連等は県ではないので除外）。
#
# 限界: **同世代かつ同一都道府県**の同姓同名は D/E/F すべて信号が無く原理的に検出できない。
#       よって出力は常に下限。実測と根拠は docs/raw/2026-07-26-homonym-measurement.md。
#
# 各人へはチームで割当（同一チーム/共通相棒/段階進行で同一人物に寄せ、衝突は別人）。
# 中間段階の所属が曖昧な等は needsReview=true。使い方: python3 scripts/build-player-homonyms.py
import json,glob,collections
def cat(tid):
    if tid.startswith('primaryschool') or tid=='zennihon-primaryschool':return '小'
    if 'secondaryschool' in tid:return '中'
    if tid.startswith('highschool'):return '高'
    if tid.startswith('zennihon-university'):return '大'
    if tid in('zennihon-workers','zennihon-business-group','zennihon-club','zennihon-senior'):return '成'
    return None
ORD={'小':0,'中':1,'高':2,'大':3,'成':4}
REAL={'北海道','東京都','大阪府','京都府'}|{k+'県' for k in '青森 岩手 宮城 秋田 山形 福島 茨城 栃木 群馬 埼玉 千葉 神奈川 新潟 富山 石川 福井 山梨 長野 岐阜 静岡 愛知 三重 滋賀 兵庫 奈良 和歌山 鳥取 島根 岡山 広島 山口 徳島 香川 愛媛 高知 福岡 佐賀 長崎 熊本 大分 宮崎 鹿児島 沖縄'.split()}
GEN={}
for _f in('index.json','local_index.json'):
    try:
        for t in json.load(open('data/tournaments/'+_f)):
            if t.get('tournamentId'):GEN[t['tournamentId']]=t.get('generationId')
    except Exception:pass
def band(gen,age,y):
    """1観測が示す出生年の許容レンジ [lo,hi]。広め=保守的（過小検出側）に取る。"""
    if age and age.startswith('over') and age[4:].isdigit():
        n=int(age[4:]);return (y-n-30,y-n)
    if gen=='highschool':return (y-19,y-14)
    if gen=='university':return (y-25,y-17)
    if gen=='junior':
        if any(c.isdigit() for c in (age or '')) and 'grade' in (age or ''):return (y-14,y-5)
        if age=='u14':return (y-16,y-10)
        if age=='u17':return (y-19,y-13)
        if age=='u20':return (y-22,y-15)
        return (y-17,y-10)
    return (y-60,y-14)
files=[f for f in glob.glob('data/tournaments/details/**/*.json',recursive=True) if '/temp/' not in f]
app=collections.defaultdict(list)
for f in files:
    rel=f.split('details/')[1];tid=rel.split('/')[0]
    try:year=int(rel.split('/')[1])
    except:year=None
    stg=cat(tid)
    seg=rel.split('/')[-1][:-5].split('-')
    age=seg[-2] if len(seg)>=3 else None
    try:d=json.load(open(f))
    except:continue
    if not isinstance(d,dict):continue
    p2={p['id']:(p.get('lastName'),p.get('firstName')) for p in d.get('participants',[]) if p.get('lastName')}
    partner=collections.defaultdict(set)
    for e in d.get('entries',[]):
        ids=[i for i in e.get('playerIds',[]) if i in p2]
        if len(ids)==2:partner[ids[0]].add(p2[ids[1]]);partner[ids[1]].add(p2[ids[0]])
    for p in d.get('participants',[]):
        nm=(p.get('lastName'),p.get('firstName'))
        if not nm[0]:continue
        bd=band(GEN.get(tid),age,year) if (year and age) else None
        app[nm].append(dict(year=year,stage=stg,team=p.get('team'),tid=tid,
                            pref=p.get('prefecture') if p.get('prefecture') in REAL else None,
                            band=bd,partners=frozenset(partner.get(p['id'],set()))))
def nonadj(aps):          # 検出器D
    byy=collections.defaultdict(set)
    for a in aps:
        if a['year'] and a['stage'] in ORD:byy[a['year']].add(a['stage'])
    return any(len(v)>1 and (max(ORD[s] for s in v)-min(ORD[s] for s in v))>=2 for v in byy.values())
def bandconf(aps):        # 検出器E
    lo,hi=-9999,9999
    for a in aps:
        if a['band']:lo=max(lo,a['band'][0]);hi=min(hi,a['band'][1])
    return lo>hi
def prefconf(aps):        # 検出器F
    byev=collections.defaultdict(set)
    for a in aps:
        if a['pref'] and a['year']:byev[(a['tid'],a['year'])].add(a['pref'])
    return any(len(v)>1 for v in byev.values())
hard=[];noname=[]
for nm in app:
    fired=[n for n,fn in (('D',nonadj),('E',bandconf),('F',prefconf)) if fn(app[nm])]
    if not fired:continue
    # 名が未分割（firstName が空）のレコードは「姓だけの一致」であり同姓同名の根拠にならない。
    # 下流の identity.ts も nameKey(lastName, firstName) で照合するため無意味。データ側の
    # 名前分割の不備（例: 地区大会 PDF 取り込みの needsReview 案件）として別枠で報告する。
    if not nm[1]:noname.append(nm[0]);continue
    hard.append((nm,fired))
out=[]
for nm,fired in hard:
    aps=app[nm]
    teams=collections.defaultdict(lambda:{'stages':set(),'years':set(),'partners':set()})
    tystage=collections.defaultdict(lambda:collections.defaultdict(set))
    tband={}          # team -> [lo,hi]（E 用）
    typref=collections.defaultdict(dict)  # team -> {(tid,year): pref}（F 用）
    for a in aps:
        t=a['team'] or '(不明)'
        if a['stage']:teams[t]['stages'].add(a['stage'])
        if a['year']:teams[t]['years'].add(a['year'])
        teams[t]['partners']|=set(a['partners'])
        if a['team'] and a['year'] and a['stage']:tystage[a['team']][a['year']].add(a['stage'])
        if a['band']:
            cur=tband.get(t)
            tband[t]=[max(cur[0],a['band'][0]),min(cur[1],a['band'][1])] if cur else list(a['band'])
        if a['pref'] and a['year']:typref[t][(a['tid'],a['year'])]=a['pref']
    tlist=list(teams)
    def conf(t1,t2): # 別人が確定する衝突（D/E/F のいずれか）
        for y in set(tystage[t1])&set(tystage[t2]):                       # D
            ss=tystage[t1][y]|tystage[t2][y]
            if len(ss)>1 and (max(ORD[s] for s in ss)-min(ORD[s] for s in ss))>=2:return True
        b1,b2=tband.get(t1),tband.get(t2)                                  # E
        if b1 and b2 and (max(b1[0],b2[0])>min(b1[1],b2[1])):return True
        for ev in set(typref[t1])&set(typref[t2]):                         # F
            if typref[t1][ev]!=typref[t2][ev]:return True
        return False
    # 相棒/段階近接でmerge（衝突しない範囲）
    par={t:t for t in tlist}
    def fnd(x):
        while par[x]!=x:par[x]=par[par[x]];x=par[x]
        return x
    for i in range(len(tlist)):
        for j in range(i+1,len(tlist)):
            a,b=tlist[i],tlist[j]
            if (teams[a]['partners']&teams[b]['partners']) and not conf(a,b):par[fnd(a)]=fnd(b)
    comps=collections.defaultdict(list)
    for t in tlist:comps[fnd(t)].append(t)
    # コンポーネントを貪欲に人へ（衝突しなければ同一人物に寄せる＝最小人数）
    persons=[]
    for comp in sorted(comps.values(),key=lambda c:-sum(len(teams[t]['years']) for t in c)):
        placed=False
        for grp in persons:
            if not any(conf(t1,t2) for t1 in comp for t2 in grp):grp.extend(comp);placed=True;break
        if not placed:persons.append(list(comp))
    pj=[]
    for grp in persons:
        st=set();ys=set()
        for t in grp:st|=teams[t]['stages'];ys|=teams[t]['years']
        pj.append({'teams':sorted(grp),'stages':sorted(st,key=lambda x:ORD.get(x,9)),'years':[min(ys),max(ys)] if ys else None})
    # 中間段階の所属が曖昧/人数>2/1人が3チーム以上 → 要確認
    # さらに、別人確定なのに1人にまとまってしまった場合も要確認（チーム単位の衝突では割れなかった）
    needs=len(pj)>2 or any(len(p['teams'])>=3 for p in pj) or len(pj)<2
    out.append({'lastName':nm[0],'firstName':nm[1],'detectors':fired,'persons':pj,'needsReview':needs})
out.sort(key=lambda o:(o['needsReview'],o['lastName'] or '',o['firstName'] or ''))
json.dump(out,open('data/players/homonyms.json','w'),ensure_ascii=False,indent=2)
byd=collections.Counter(d for o in out for d in o['detectors'])
print('別人登録:',len(out),'名 / 明快',sum(1 for o in out if not o['needsReview']),'/ 要確認',sum(1 for o in out if o['needsReview']))
print('検出器別(重複あり):',dict(byd))
if noname:
    print(f'※ 名(firstName)が未分割のため除外: {len(noname)}件 →', '/'.join(sorted(set(noname))))
    print('   これは同姓同名ではなくデータ側の名前分割の不備。取り込み元を確認すること。')
for o in out:
    print(('OK   ' if not o['needsReview'] else '⚠確認 ')+o['lastName']+o['firstName']+f"  {len(o['persons'])}人  [{''.join(o['detectors'])}]")
    for i,p in enumerate(o['persons'],1):print(f"      {''.join(p['stages'])} {p['years']} {p['teams']}")
