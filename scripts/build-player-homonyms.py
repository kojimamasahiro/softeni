# 同姓同名の別人を検出して data/players/homonyms.json を生成する。
# 根拠: 同一年に「非隣接の学校段階」(小↔高/小↔大/中↔大/高↔成 等＝物理的に不可能)が共存
#       する氏名を別人とみなす。隣接段階(中3→高1等の卒業境界)は同一人物として除外。
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
files=[f for f in glob.glob('data/tournaments/details/**/*.json',recursive=True) if '/temp/' not in f]
app=collections.defaultdict(list)
for f in files:
    rel=f.split('details/')[1];tid=rel.split('/')[0]
    try:year=int(rel.split('/')[1])
    except:year=None
    stg=cat(tid)
    try:d=json.load(open(f))
    except:continue
    p2={p['id']:(p.get('lastName'),p.get('firstName')) for p in d.get('participants',[]) if p.get('lastName')}
    partner=collections.defaultdict(set)
    for e in d.get('entries',[]):
        ids=[i for i in e.get('playerIds',[]) if i in p2]
        if len(ids)==2:partner[ids[0]].add(p2[ids[1]]);partner[ids[1]].add(p2[ids[0]])
    for p in d.get('participants',[]):
        nm=(p.get('lastName'),p.get('firstName'))
        if nm[0]:app[nm].append(dict(year=year,stage=stg,team=p.get('team'),partners=frozenset(partner.get(p['id'],set()))))
def nonadj(aps):
    byy=collections.defaultdict(set)
    for a in aps:
        if a['year'] and a['stage'] in ORD:byy[a['year']].add(a['stage'])
    return any(len(v)>1 and (max(ORD[s] for s in v)-min(ORD[s] for s in v))>=2 for v in byy.values())
hard=[nm for nm in app if nonadj(app[nm])]
out=[]
for nm in hard:
    aps=app[nm]
    teams=collections.defaultdict(lambda:{'stages':set(),'years':set(),'partners':set()})
    tystage=collections.defaultdict(lambda:collections.defaultdict(set))
    for a in aps:
        t=a['team'] or '(不明)'
        if a['stage']:teams[t]['stages'].add(a['stage'])
        if a['year']:teams[t]['years'].add(a['year'])
        teams[t]['partners']|=set(a['partners'])
        if a['team'] and a['year'] and a['stage']:tystage[a['team']][a['year']].add(a['stage'])
    tlist=list(teams)
    def conf(t1,t2): # 非隣接の同年衝突＝強制別人
        for y in set(tystage[t1])&set(tystage[t2]):
            ss=tystage[t1][y]|tystage[t2][y]
            if len(ss)>1 and (max(ORD[s] for s in ss)-min(ORD[s] for s in ss))>=2:return True
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
    needs=len(pj)>2 or any(len(p['teams'])>=3 for p in pj)
    out.append({'lastName':nm[0],'firstName':nm[1],'persons':pj,'needsReview':needs})
out.sort(key=lambda o:o['needsReview'])
json.dump(out,open('data/players/homonyms.json','w'),ensure_ascii=False,indent=2)
print('別人登録:',len(out),'名 / 明快',sum(1 for o in out if not o['needsReview']),'/ 要確認',sum(1 for o in out if o['needsReview']))
for o in out:
    print(('OK   ' if not o['needsReview'] else '⚠確認 ')+o['lastName']+o['firstName']+f"  {len(o['persons'])}人")
    for i,p in enumerate(o['persons'],1):print(f"      {''.join(p['stages'])} {p['years']} {p['teams']}")
