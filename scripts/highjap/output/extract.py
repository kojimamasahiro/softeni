#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import pdfplumber, re, sys, json, unicodedata
from collections import defaultdict

PAREN_OPEN = '(（'
PAREN_CLOSE = ')）'
SEP = '：:'

# variant-glyph / character normalization (PDF font quirks -> standard kanji)
CHARMAP = {'𫝆𫝆':'今','𫝆':'今','𫞏𫞏':'萩','𫞏':'萩'}
# radical-block codepoints NFKC leaves unchanged -> map explicitly
RADICAL_EXTRA = {'⻑':'長','⻄':'西','⻘':'青','⻫':'斉','⻤':'鬼'}
# traditional forms produced by NFKC -> Japanese shinjitai used in repo
SHINJITAI = {'黑':'黒','戶':'戸','栁':'柳'}
def norm_char(s):
    # Convert Kangxi/CJK radical-block codepoints (used as glyph substitutes in
    # some PDFs) back to their standard unified ideographs. Compat ideographs
    # like 髙 﨑 are intentionally preserved.
    out=[]
    for c in s:
        o=ord(c)
        if 0x2E80 <= o <= 0x2FDF:
            c = unicodedata.normalize('NFKC', c)
        out.append(c)
    s=''.join(out)
    for k,v in {**RADICAL_EXTRA, **SHINJITAI, **CHARMAP}.items():
        s = s.replace(k,v)
    return s

def norm_team(t):
    # team-name normalization to match repository convention
    t = t.replace('付属','附').replace('附属','附')
    return t

def is_cjk(ch):
    if not ch: return False
    for c in ch:
        o = ord(c)
        if (0x3040 <= o <= 0x30ff) or (0x3400 <= o <= 0x9fff) or (0xf900 <= o <= 0xfaff) \
           or (0x20000 <= o <= 0x3ffff) or c in '々〆〤ヶ':
            return True
    return False

def cluster_lines(chars, tol=3.0):
    chars = sorted(chars, key=lambda c: c['top'])
    lines = []
    cur = []
    cur_top = None
    for c in chars:
        if cur_top is None or abs(c['top']-cur_top) <= tol:
            cur.append(c);
            cur_top = c['top'] if cur_top is None else (cur_top)
        else:
            lines.append(cur); cur=[c]; cur_top=c['top']
    if cur: lines.append(cur)
    return lines

def split_name_by_gap(name_chars):
    # name_chars: list of (text,x0,x1) sorted by x0
    if len(name_chars) <= 1:
        return name_chars[0][0] if name_chars else '', ''
    # gaps between consecutive chars
    gaps = []
    for i in range(1,len(name_chars)):
        gaps.append((name_chars[i][1]-name_chars[i-1][2], i))
    maxgap, idx = max(gaps, key=lambda g: g[0])
    surname = ''.join(c[0] for c in name_chars[:idx])
    given = ''.join(c[0] for c in name_chars[idx:])
    return surname, given

def parse_side(side_chars):
    # side_chars list of dicts sorted by x0
    side_chars = sorted(side_chars, key=lambda c: c['x0'])
    # find first paren open
    open_idx = None
    for i,c in enumerate(side_chars):
        if c['text'] in PAREN_OPEN:
            open_idx = i; break
    if open_idx is None:
        return None
    # name chars: CJK chars before open paren (normalize variant glyphs first)
    name_chars = [(norm_char(c['text']), c['x0'], c['x1']) for c in side_chars[:open_idx] if is_cjk(norm_char(c['text']))]
    if not name_chars:
        return None
    # inside paren until close
    close_idx = None
    for i in range(open_idx+1, len(side_chars)):
        if side_chars[i]['text'] in PAREN_CLOSE:
            close_idx = i; break
    if close_idx is None:
        close_idx = len(side_chars)
    inside = ''.join(c['text'] for c in side_chars[open_idx+1:close_idx])
    # split pref:team
    m = re.split('[：:]', inside)
    if len(m) < 2:
        return None
    pref = m[0].strip()
    team = m[1].strip()
    surname, given = split_name_by_gap(name_chars)
    team = norm_team(norm_char(team)); pref = norm_char(pref)
    return {'lastName':surname,'firstName':given,'team':team,'prefecture':pref,
            'x0':name_chars[0][1], 'top': side_chars[0]['top']}

def parse_side_doubles(side_chars):
    side_chars = sorted(side_chars, key=lambda c: c['x0'])
    open_idx = None
    for i,c in enumerate(side_chars):
        if c['text'] in PAREN_OPEN:
            open_idx = i; break
    if open_idx is None:
        return None
    # name text: CJK + nakaguro before paren
    name_txt = ''.join(norm_char(c['text']) for c in side_chars[:open_idx]
                       if is_cjk(norm_char(c['text'])) or c['text'] in '・･')
    name_txt = name_txt.replace('･','・')
    surnames = [s for s in name_txt.split('・') if s]
    if len(surnames) < 2:
        return None
    close_idx = None
    for i in range(open_idx+1, len(side_chars)):
        if side_chars[i]['text'] in PAREN_CLOSE:
            close_idx = i; break
    if close_idx is None:
        close_idx = len(side_chars)
    inside = ''.join(c['text'] for c in side_chars[open_idx+1:close_idx])
    m = re.split('[：:]', inside)
    if len(m) < 2:
        return None
    pref = norm_char(m[0].strip()); team = norm_team(norm_char(m[1].strip()))
    return {'surnames':surnames[:2],'team':team,'prefecture':pref,
            'x0':side_chars[0]['x0'],'top':side_chars[0]['top']}

def extract_doubles(page, center=300):
    chars = [c for c in page.chars if c['text'].strip()]
    lines = cluster_lines(chars)
    left=[]; right=[]
    for ln in lines:
        txt=''.join(c['text'] for c in ln)
        if not any(s in txt for s in SEP): continue
        if '・' not in txt and '･' not in txt: continue
        lc=[c for c in ln if c['x0']<center]
        rc=[c for c in ln if c['x0']>=center]
        pl=parse_side_doubles(lc); pr=parse_side_doubles(rc)
        if pl: left.append(pl)
        if pr: right.append(pr)
    left.sort(key=lambda r:r['top'])
    right.sort(key=lambda r:r['top'])
    return left, right

def extract_singles(page, center=290):
    chars = [c for c in page.chars if c['text'].strip()]
    lines = cluster_lines(chars)
    left=[]; right=[]
    for ln in lines:
        # must contain a sep and a paren to be a player line
        txt=''.join(c['text'] for c in ln)
        if not any(s in txt for s in SEP): continue
        lc=[c for c in ln if c['x0']<center]
        rc=[c for c in ln if c['x0']>=center]
        pl=parse_side(lc); pr=parse_side(rc)
        if pl: left.append(pl)
        if pr: right.append(pr)
    left.sort(key=lambda r:r['top'])
    right.sort(key=lambda r:r['top'])
    return left, right

if __name__=='__main__':
    path=sys.argv[1]; page_idx=int(sys.argv[2])
    with pdfplumber.open(path) as pdf:
        pg=pdf.pages[page_idx]
        left,right=extract_singles(pg)
    print('LEFT',len(left),'RIGHT',len(right))
    for i,r in enumerate(left):
        print('L%02d'%(i+1), r['lastName'],r['firstName'],r['team'],r['prefecture'])
    for i,r in enumerate(right):
        print('R%02d'%(i+33), r['lastName'],r['firstName'],r['team'],r['prefecture'])
