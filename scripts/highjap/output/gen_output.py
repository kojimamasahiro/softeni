#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Generate highjap gen_player.py-style output.json for a category.
Singles: names fully from the PDF draw (surname/given split by glyph gap).
Doubles: surnames from the PDF draw; given names + originalTeam merged from the
         gosen participant roster (TSV: prefecture<TAB>official_school<TAB>p1<TAB>p2),
         where p1/p2 are "surname<space>given".
"""
import pdfplumber, json, sys, re
from extract import extract_singles, extract_doubles

def serialize(items):
    out = '[\n'
    for i,it in enumerate(items):
        if i>0: out += ',\n'
        out += json.dumps(it, ensure_ascii=False, separators=(',',':'))
    out += '\n]'
    return out

def gen_singles(pdf_path, page_idx):
    with pdfplumber.open(pdf_path) as pdf:
        left,right = extract_singles(pdf.pages[page_idx])
    entries = left + right          # natural draw order 1..N
    items=[]
    for idx,r in enumerate(entries,1):
        last,first,team,pref = r['lastName'],r['firstName'],r['team'],r['prefecture']
        info={'lastName':last,'firstName':first,'team':team,'originalTeam':None,
              'prefecture':pref,'playerId':None,'tempId':f'{last}_{first}_{team}'}
        items.append({'id':idx,'name':f'{last}{first}（{team}）',
                      'information':[info],'category':'singles'})
    return items

def norm_pref(p):
    return re.sub(r'[都府県]$','',p)

def load_roster_rows(tsv_path):
    """returns list of rows: {pref, school, players:[(surname,given),...]}"""
    rows=[]
    if not tsv_path: return rows
    for line in open(tsv_path, encoding='utf-8'):
        line=line.rstrip('\n')
        if not line.strip() or line.startswith('#'): continue
        cols=line.split('\t')
        if len(cols)<4: continue
        pref,school=cols[0].strip(),cols[1].strip()
        players=[]
        for p in cols[2:4]:
            parts=re.split(r'\s+',p.strip())
            if len(parts)>=2: players.append((parts[0],''.join(parts[1:])))
            elif p.strip():   players.append((p.strip(),''))
        rows.append({'pref':pref,'school':school,'players':players,'used':False})
    return rows

def match_row(rows, pref, team, surnames):
    """find roster row in same prefecture whose surname multiset matches the pair."""
    np=norm_pref(pref); want=sorted(surnames)
    cands=[r for r in rows if norm_pref(r['pref'])==np and
           sorted(s for s,_ in r['players'])==want]
    # prefer an unused row; among ties prefer school containing team's chars
    unused=[r for r in cands if not r['used']]
    pool=unused or cands
    if not pool: return None
    def score(r):
        return sum(1 for ch in team if ch in r['school'])
    pool.sort(key=score, reverse=True)
    return pool[0]

def gen_doubles(pdf_path, page_idx, tsv_path):
    with pdfplumber.open(pdf_path) as pdf:
        left,right = extract_doubles(pdf.pages[page_idx])
    entries = left + right
    rows = load_roster_rows(tsv_path)
    items=[]; unmatched=[]
    for idx,r in enumerate(entries,1):
        team,pref=r['team'],r['prefecture']
        row=match_row(rows, pref, team, r['surnames'])
        info_list=[]
        if row:
            row['used']=True
            # map each PDF surname to a given name from the row (positional within dups)
            avail=list(row['players'])
            for last in r['surnames']:
                first=''; sch=row['school']
                for j,(s,g) in enumerate(avail):
                    if s==last:
                        first=g; avail.pop(j); break
                if not first: unmatched.append((idx,pref,team,last))
                info_list.append({'lastName':last,'firstName':first,'team':team,
                                  'originalTeam':sch,'prefecture':pref,'playerId':None,
                                  'tempId':f'{last}_{first}_{team}'})
        else:
            np=norm_pref(pref)
            for last in r['surnames']:
                first=''; sch=None
                for rr in rows:
                    if norm_pref(rr['pref'])==np:
                        for s,g in rr['players']:
                            if s==last:
                                first=g; sch=rr['school']; break
                    if first: break
                if not first: unmatched.append((idx,pref,team,last))
                info_list.append({'lastName':last,'firstName':first,'team':team,
                                  'originalTeam':sch,'prefecture':pref,'playerId':None,
                                  'tempId':f'{last}_{first}_{team}'})
        items.append({'id':idx,'name':'・'.join(r['surnames'])+f'（{team}）',
                      'information':info_list,'category':'doubles'})
    return items, unmatched

if __name__=='__main__':
    mode=sys.argv[1]
    if mode=='singles':
        items=gen_singles(sys.argv[2], int(sys.argv[3]))
        open(sys.argv[4],'w',encoding='utf-8').write(serialize(items))
        print('wrote',sys.argv[4],'items',len(items))
    else:
        tsv=sys.argv[5] if len(sys.argv)>5 else None
        items,unm=gen_doubles(sys.argv[2], int(sys.argv[3]), tsv)
        open(sys.argv[4],'w',encoding='utf-8').write(serialize(items))
        print('wrote',sys.argv[4],'items',len(items),'unmatched',len(unm))
        for u in unm: print('  UNMATCHED',u)
