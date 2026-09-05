# The pixel icon set of the Stained Glass theme, 24x24, one colour.
# ---------------------------------------------------------------------------
# The first 47 glyphs are the audit page's (docs/design/identity-audit-v13.html),
# kept verbatim in pixel-icons-base.json; the rest are built here from circles,
# rectangles, lines and polygons rasterised onto the grid, so a correction is one
# number. Run from the repository root:
#
#     python3 tools/pixel-icons.py
#
# It writes icons/pixel-sprite.svg (every glyph as <symbol id="px-NAME">),
# styles/pixel-icons.css (the Font Awesome names the module uses, masked to the
# glyphs under the theme) and refreshes the <symbol> block of the audit page.
import json, math, os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
N = 24
BASE = json.load(open(os.path.join(ROOT, 'tools', 'pixel-icons-base.json')))

# ---- raster helpers --------------------------------------------------------------
def path_to_px(d):
    px = set()
    for x, y, w, h in re.findall(r'M(\d+) (\d+)h(\d+)v(\d+)', d):
        for i in range(int(w)):
            for j in range(int(h)): px.add((int(x) + i, int(y) + j))
    return px
def px_to_path(px):
    out = []
    for y in range(N):
        x = 0
        while x < N:
            if (x, y) in px:
                x0 = x
                while x < N and (x, y) in px: x += 1
                out.append(f'M{x0} {y}h{x - x0}v1h-{x - x0}z')
            else: x += 1
    return ''.join(out)
def rect(px, x, y, w, h):
    for i in range(w):
        for j in range(h): px.add((x + i, y + j))
def disc(px, cx, cy, r):
    for x in range(N):
        for y in range(N):
            if (x + .5 - cx) ** 2 + (y + .5 - cy) ** 2 <= r * r: px.add((x, y))
def ring(px, cx, cy, r, w):
    a = set(); disc(a, cx, cy, r); b = set(); disc(b, cx, cy, r - w); px |= a - b
def line(px, x0, y0, x1, y1, w=2):
    n = max(1, int(math.hypot(x1 - x0, y1 - y0) * 2))
    for i in range(n + 1):
        t = i / n; cx = x0 + (x1 - x0) * t + .5; cy = y0 + (y1 - y0) * t + .5
        for x in range(N):
            for y in range(N):
                if abs(x + .5 - cx) < w / 2 + 1e-6 and abs(y + .5 - cy) < w / 2 + 1e-6: px.add((x, y))
def poly(px, pts):
    for y in range(N):
        yc = y + .5; xs = []
        for i in range(len(pts)):
            (xa, ya), (xb, yb) = pts[i], pts[(i + 1) % len(pts)]
            if (ya <= yc) != (yb <= yc): xs.append(xa + (yc - ya) * (xb - xa) / (yb - ya))
        xs.sort()
        for k in range(0, len(xs) - 1, 2):
            for x in range(N):
                if xs[k] <= x + .5 <= xs[k + 1]: px.add((x, y))
def erode(px):
    return {p for p in px if all((p[0] + dx, p[1] + dy) in px for dx in (-1, 0, 1) for dy in (-1, 0, 1))}
def outline(px, w=2):
    inner = px
    for _ in range(w): inner = erode(inner)
    return px - inner
def rotate(px, quarter):     # clockwise quarter turns
    for _ in range(quarter): px = {(N - 1 - y, x) for x, y in px}
    return px
def flipv(px): return {(x, N - 1 - y) for x, y in px}
def fliph(px): return {(N - 1 - x, y) for x, y in px}
def clip(px): return {(x, y) for x, y in px if 0 <= x < N and 0 <= y < N}

# ---- the new glyphs ----------------------------------------------------------------
ICONS = {}
def icon(name):
    def deco(fn):
        px = set(); r = fn(px); ICONS[name] = clip(r if r is not None else px); return fn
    return deco
def heart():
    return path_to_px(BASE['support'])

@icon('broom')            # tamper: sweep the traces
def _(px):
    line(px, 18, 2, 10, 11, 2.2)
    poly(px, [(4, 12), (14, 12), (18, 22), (1, 22)])
    for x in (6, 10, 14):
        for y in range(16, 22): px.discard((x, y))
@icon('brain')            # analyze, paranoia, Sanity
def _(px):
    disc(px, 8, 10, 6.5); disc(px, 16, 10, 6.5); rect(px, 4, 10, 16, 5); rect(px, 6, 15, 12, 3); rect(px, 11, 18, 3, 3)
    for y in range(4, 17): px.discard((12, y))
    for x, y in [(6, 7), (7, 7), (8, 7), (5, 11), (6, 11), (8, 13), (9, 13), (15, 6), (16, 6), (17, 6), (17, 10), (18, 10), (14, 13), (15, 13)]: px.discard((x, y))
@icon('cap')              # experience
def _(px):
    poly(px, [(12, 3), (23, 8), (12, 13), (1, 8)]); rect(px, 6, 11, 12, 4)
    for x in range(7, 17): px.discard((x, 13))
    rect(px, 21, 8, 2, 7); rect(px, 20, 15, 4, 3)
@icon('fist')             # determination
def _(px):
    for i, x in enumerate((6, 10, 14, 18)): rect(px, x, 5 + (i == 3), 3, 8)
    rect(px, 6, 12, 15, 7); rect(px, 3, 10, 3, 7); rect(px, 8, 19, 11, 2)
    for x in (9, 13, 17): px.discard((x, 12)); px.discard((x, 13))
    for y in range(10, 12): px.discard((6, y)) if False else None
@icon('loaded')           # Free Critical: a loaded die, one face pinned to 12
def _(px):
    rect(px, 3, 3, 18, 18); inner = set(); rect(inner, 5, 5, 14, 14); px -= inner
    rect(px, 3, 17, 18, 4)                       # the weight at the bottom
    rect(px, 10, 8, 4, 4)                        # the one pip that always shows
    for x, y in [(3, 3), (20, 3), (3, 20), (20, 20)]: px.discard((x, y))
@icon('barrier')          # obstacle
def _(px):
    rect(px, 2, 7, 20, 7)
    for k in range(-8, 24, 6):
        for j in range(7): px.discard((k + j, 7 + j)); px.discard((k + j + 1, 7 + j))
    rect(px, 4, 14, 3, 8); rect(px, 17, 14, 3, 8)
@icon('gift')             # for the game
def _(px):
    rect(px, 3, 10, 18, 11); inner = set(); rect(inner, 5, 12, 14, 7); px -= inner
    rect(px, 2, 6, 20, 4); rect(px, 11, 6, 2, 15); disc(px, 8.5, 3.5, 2.2); disc(px, 15.5, 3.5, 2.2)
@icon('heartcrack')       # this will hurt
def _(px):
    px |= heart()
    for x, y in [(12, 5), (12, 6), (11, 7), (11, 8), (12, 9), (13, 10), (13, 11), (12, 12), (11, 13), (11, 14), (12, 15), (12, 16), (13, 17), (13, 18)]: px.discard((x, y))
@icon('chain')            # chained
def _(px):
    ring(px, 8, 12, 5.5, 2.2); ring(px, 16, 12, 5.5, 2.2)
@icon('silence')          # silence
def _(px):
    rect(px, 2, 3, 20, 13); inner = set(); rect(inner, 4, 5, 16, 9); px -= inner
    poly(px, [(5, 15), (10, 15), (5, 21)])
    for x, y in [(2, 3), (21, 3), (2, 15), (21, 15)]: px.discard((x, y))
    cut = set(); line(cut, 2, 22, 21, 3, 2.4); px -= cut
    line(px, 3, 21, 20, 4, 1.4)
@icon('cub')              # fuel the cub: a paw
def _(px):
    disc(px, 12, 15.5, 5.2); disc(px, 5.5, 9, 2.6); disc(px, 9.5, 4.5, 2.6); disc(px, 14.5, 4.5, 2.6); disc(px, 18.5, 9, 2.6)
@icon('trend-up')         # favourite project
def _(px):
    line(px, 2, 19, 8, 11, 2.2); line(px, 8, 11, 12, 15, 2.2); line(px, 12, 15, 20, 5, 2.2)
    poly(px, [(21, 4), (21, 12), (14, 4)])
@icon('trend-down')       # game protection
def _(px):
    line(px, 2, 5, 8, 13, 2.2); line(px, 8, 13, 12, 9, 2.2); line(px, 12, 9, 20, 19, 2.2)
    poly(px, [(21, 20), (21, 12), (14, 20)])
@icon('wave')             # feed the overflow
def _(px):
    for row in (9, 16):
        pts = [(x, row + 2.5 * math.sin(x / 24 * math.pi * 2 * 1.5)) for x in range(-1, 26)]
        for i in range(len(pts) - 1): line(px, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 2.4)
@icon('horn')             # public announcement
def _(px):
    rect(px, 1, 9, 6, 6); poly(px, [(7, 9), (18, 3), (18, 21), (7, 15)]); rect(px, 3, 15, 3, 5)
    rect(px, 20, 8, 2, 8); rect(px, 22, 5, 1, 3); rect(px, 22, 16, 1, 3)
@icon('envelope')         # motive
def _(px):
    rect(px, 2, 5, 20, 14); inner = set(); rect(inner, 4, 7, 16, 10); px -= inner
    line(px, 3, 6, 12, 13, 2.2); line(px, 12, 13, 21, 6, 2.2)
@icon('pulse')            # players' status
def _(px):
    px |= heart()
    ecg = set()
    for a, b in [((1, 12), (7, 12)), ((7, 12), (9, 8)), ((9, 8), (12, 17)), ((12, 17), (14, 12)), ((14, 12), (23, 12))]: line(ecg, *a, *b, 1.6)
    px ^= ecg
@icon('checklist')        # projects list
def _(px):
    for y in (3, 10, 17):
        rect(px, 10, y + 1, 12, 3)
        for i, (dx, dy) in enumerate([(1, 3), (2, 4), (3, 5), (4, 4), (5, 3), (6, 2), (7, 1)]):
            rect(px, dx, y + dy, 1, 2)
@icon('scale')            # the case: balance
def _(px):
    rect(px, 11, 2, 2, 19); rect(px, 6, 21, 12, 2); rect(px, 3, 5, 18, 2)
    for cx in (4, 19):
        rect(px, cx, 7, 1, 6); rect(px, cx - 3, 13, 7, 2); rect(px, cx - 2, 15, 5, 1)
@icon('team')             # GM team
def _(px):
    disc(px, 9, 6.5, 3.5); poly(px, [(3, 19), (4, 12), (14, 12), (15, 19)])
    back = set(); disc(back, 17, 8.5, 3); poly(back, [(13, 19), (14, 13), (21, 13), (22, 19)])
    px |= back - {(x, y) for x in range(12, 16) for y in range(10, 20)}
    rect(px, 2, 19, 20, 2)
@icon('wand')             # the season
def _(px):
    line(px, 3, 21, 15, 9, 2.4)
    rect(px, 17, 3, 2, 9); rect(px, 13, 7, 10, 2)
    for x, y in [(15, 5), (20, 5), (15, 10), (20, 10)]: px.add((x, y))
    rect(px, 21, 13, 2, 2); rect(px, 10, 3, 2, 2)
@icon('lock')             # the vault's lock
def _(px):
    top = set(); ring(top, 12, 9, 5.5, 2.2); px |= {p for p in top if p[1] <= 10}
    rect(px, 4, 10, 16, 11); hole = set(); disc(hole, 12, 14.5, 1.8); rect(hole, 11, 15, 2, 4); px -= hole
    for x, y in [(4, 10), (19, 10), (4, 20), (19, 20)]: px.discard((x, y))
@icon('box')              # an item's box
def _(px):
    front = set(); rect(front, 3, 10, 12, 11); px |= outline(front, 2)
    top = set(); poly(top, [(3, 10), (9, 4), (21, 4), (15, 10)]); px |= outline(top, 2)
    side = set(); poly(side, [(15, 10), (21, 4), (21, 15), (15, 21)]); px |= outline(side, 2)
@icon('box-open')         # an opened item
def _(px):
    body = set(); rect(body, 4, 11, 16, 10); px |= outline(body, 2)
    line(px, 4, 12, 1, 5, 2.2); line(px, 19, 12, 22, 5, 2.2); rect(px, 9, 5, 6, 2); rect(px, 11, 3, 2, 3)
@icon('down')
def _(px): return rotate(path_to_px(BASE['right']), 1)
@icon('arrow-up')
def _(px): return rotate(path_to_px(BASE['move']), 3)
@icon('play')
def _(px): poly(px, [(6, 3), (20, 12), (6, 21)])
@icon('edit')             # pen to square
def _(px):
    sq = set(); rect(sq, 3, 6, 15, 15); px |= outline(sq, 2)
    px -= {(x, y) for x in range(11, 18) for y in range(6, 12)}
    line(px, 10, 14, 20, 4, 3.2); rect(px, 8, 14, 3, 3); px.discard((21, 3))
@icon('shield')           # shield halved
def _(px):
    sh = set(); poly(sh, [(12, 2), (21, 5), (20, 13), (12, 22), (4, 13), (3, 5)])
    px |= {p for p in sh if p[0] < 12} | {p for p in outline(sh, 2) if p[0] >= 12}
@icon('user-slash')       # the one who built it
def _(px):
    disc(px, 12, 7, 4); poly(px, [(4, 21), (5, 13), (19, 13), (20, 21)])
    cut = set(); line(cut, 2, 22, 21, 3, 2.4); px -= cut; line(px, 3, 21, 20, 4, 1.4)
@icon('eye-slash')
def _(px):
    px |= path_to_px(BASE['observe'])
    cut = set(); line(cut, 2, 22, 21, 3, 2.4); px -= cut; line(px, 3, 21, 20, 4, 1.4)
@icon('chat')             # comments, the messenger
def _(px):
    a = set(); rect(a, 2, 3, 14, 10); px |= outline(a, 2); poly(px, [(4, 12), (8, 12), (4, 16)])
    b = set(); rect(b, 9, 10, 13, 9); px |= b - {(x, y) for x in range(11, 20) for y in range(12, 17)}
    poly(px, [(17, 18), (21, 18), (21, 22)])
    px -= {(x, y) for x in range(9, 16) for y in range(10, 13) if (x, y) in a and (x, y) not in outline(a, 2)}
@icon('dot')
def _(px): disc(px, 12, 12, 4.2)
@icon('swap')
def _(px): return rotate(path_to_px(BASE['sort']), 1)
@icon('noon')             # the high sun
def _(px):
    disc(px, 12, 12, 5.2)
    for k in range(8):
        a = k * math.pi / 4; line(px, 12 + 7 * math.cos(a), 12 + 7 * math.sin(a), 12 + 10.5 * math.cos(a), 12 + 10.5 * math.sin(a), 2)
@icon('afternoon')        # the sun leaning on the horizon
def _(px):
    disc(px, 12, 16, 6.5)
    for k in range(5):
        a = math.pi + k * math.pi / 4; line(px, 12 + 8.5 * math.cos(a), 16 + 8.5 * math.sin(a), 12 + 11 * math.cos(a), 16 + 11 * math.sin(a), 2)
    px -= {(x, y) for x in range(N) for y in range(18, N)}; rect(px, 1, 19, 22, 2)
# ---- redrawn: the four the review found weak, plus the eclipse in one colour --------
@icon('eclipse')          # the black ball in front of the light: a ring, lit on one side
def _(px):
    ring(px, 12, 12, 9.5, 1.6); c = set(); disc(c, 12, 12, 9.5); d = set(); disc(d, 7, 12, 10); px |= c - d
@icon('trap')             # the jaws
def _(px):
    up = set(); ring(up, 12, 12, 10.5, 2.2); px |= {p for p in up if p[1] <= 9}
    lo = set(); ring(lo, 12, 12, 10.5, 2.2); px |= {p for p in lo if p[1] >= 14}
    for x in (5, 9, 13, 17): poly(px, [(x, 4.5 + (abs(x + 1 - 12) ** 2) / 26), (x + 2, 4.5 + (abs(x + 1 - 12) ** 2) / 26), (x + 1, 10.5)])
    for x in (7, 11, 15): poly(px, [(x, 19.5 - (abs(x + 1 - 12) ** 2) / 26), (x + 2, 19.5 - (abs(x + 1 - 12) ** 2) / 26), (x + 1, 13.5)])
    rect(px, 1, 10, 2, 4); rect(px, 21, 10, 2, 4)
@icon('lens')             # investigation: a glass over a clue
def _(px):
    ring(px, 14, 10, 7.5, 2.2); line(px, 8.5, 15.5, 3, 21, 3.2); disc(px, 14, 10, 2.2)
@icon('rest')             # a clearer bed
def _(px):
    rect(px, 2, 5, 2, 14); rect(px, 2, 11, 20, 5); rect(px, 5, 8, 6, 3); rect(px, 20, 14, 2, 5); rect(px, 2, 16, 20, 1)
@icon('analyze')          # the flask, liquid in it
def _(px):
    body = set(); poly(body, [(9, 8), (15, 8), (21, 20.5), (3, 20.5)]); px |= outline(body, 2)
    px |= {p for p in body if p[1] >= 15}; rect(px, 9, 2, 6, 2); rect(px, 10, 3, 4, 6)
    for x, y in [(11, 17), (14, 18), (9, 19)]: px.discard((x, y))

ALL = {k: path_to_px(v) for k, v in BASE.items()}
ALL.update(ICONS)
ORDER = list(BASE) + [k for k in ICONS if k not in BASE]

# ---- the module's Font Awesome names, mapped to glyphs --------------------------------
FA = {
    'magnifying-glass': 'search', 'eye': 'observe', 'brain': 'brain', 'hammer': 'hourglass', 'bed': 'rest',
    'ear-listen': 'listen', 'hand-sparkles': 'palm', 'broom': 'broom', 'skull': 'skull', 'skull-crossbones': 'skull',
    'shoe-prints': 'move', 'screwdriver-wrench': 'tamper', 'hands-holding-circle': 'support', 'graduation-cap': 'cap',
    'star': 'star', 'rotate-left': 'reroll', 'arrows-rotate': 'reroll', 'repeat': 'reroll', 'person-running': 'sprint',
    'bolt': 'dynamic', 'mug-hot': 'relief', 'hand-fist': 'fist', 'burst': 'loaded', 'road-barrier': 'barrier',
    'gift': 'gift', 'door-closed': 'door', 'door-open': 'door', 'heart-crack': 'heartcrack', 'link': 'chain',
    'comment-slash': 'silence', 'hand-holding-heart': 'cub', 'arrow-trend-down': 'trend-down', 'arrow-trend-up': 'trend-up',
    'water': 'wave', 'trash-can': 'trash', 'trash-arrow-up': 'trash', 'bullhorn': 'horn', 'envelope': 'envelope',
    'gavel': 'gavel', 'heart-pulse': 'pulse', 'list-check': 'checklist', 'volume-high': 'sound', 'scale-balanced': 'scale',
    'calendar-days': 'calendar', 'users-gear': 'team', 'table-list': 'table', 'wand-magic-sparkles': 'wand',
    'user-secret': 'mask', 'bug': 'bug', 'magnifying-glass-chart': 'lens', 'fingerprint': 'lens', 'flask': 'analyze',
    'lock': 'lock', 'box': 'box', 'box-open': 'box-open', 'heart': 'support', 'plus': 'plus', 'minus': 'minus',
    'chevron-left': 'left', 'chevron-right': 'right', 'chevron-down': 'down', 'down-long': 'down', 'arrow-up': 'arrow-up',
    'play': 'play', 'pen-to-square': 'edit', 'gear': 'gear', 'shield-halved': 'shield', 'user-slash': 'user-slash',
    'eye-slash': 'eye-slash', 'moon': 'moon', 'comments': 'chat', 'hand': 'palm', 'hand-holding': 'palm', 'circle': 'dot',
    'arrows-left-right': 'swap', 'khanda': 'murder', 'handshake': 'support', 'bell': 'bell', 'dice': 'dice', 'key': 'key',
    'xmark': 'close', 'check': 'check', 'sort': 'sort', 'hourglass': 'hourglass', 'sun': 'sun', 'note-sticky': 'note'
}
missing = [v for v in FA.values() if v not in ALL]
assert not missing, missing

def svg_symbol(name):
    return f'<symbol id="px-{name}" viewBox="0 0 24 24"><path fill="currentColor" d="{px_to_path(ALL[name])}"/></symbol>'
def data_uri(name):
    svg = f"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' shape-rendering='crispEdges'><path fill='%23000' d='{px_to_path(ALL[name])}'/></svg>"
    return 'url("data:image/svg+xml,' + svg.replace('<', '%3C').replace('>', '%3E').replace('#', '%23').replace('"', "'") + '")'

sprite = '<svg xmlns="http://www.w3.org/2000/svg" style="display:none">\n' + '\n'.join(svg_symbol(n) for n in ORDER) + '\n</svg>\n'
open(os.path.join(ROOT, 'icons', 'pixel-sprite.svg'), 'w').write(sprite)

css = ['/* Generated by tools/pixel-icons.py - do not edit by hand.',
       '   The pixel icon set of the Stained Glass theme: every Font Awesome glyph the module draws',
       '   inside its own elements is masked to a 24x24 pixel glyph in the current colour. Scoped to',
       '   the module\'s own containers (anything wearing a drpg- class), so Foundry\'s chrome keeps its',
       '   icons. The glyphs live in --drpg-px-NAME on the body; the sprite is icons/pixel-sprite.svg. */',
       'body.drpg-theme-stained-glass {']
for n in ORDER: css.append(f'    --drpg-px-{n}: {data_uri(n)};')
css.append('}')
sel = lambda fa: f'body.drpg-theme-stained-glass [class*="drpg-"] i.fa-{fa},\nbody.drpg-theme-stained-glass i.drpg-action-icon.fa-{fa},\nbody.drpg-theme-stained-glass [class*="drpg-"] .fa-{fa}:is(i, span)'
css.append(',\n'.join(sel(fa) for fa in FA) + ''' {
    display: inline-block;
    width: 1.15em;
    height: 1.15em;
    vertical-align: -0.2em;
    background-color: currentColor;
    -webkit-mask: var(--drpg-px-mask) center / contain no-repeat;
    mask: var(--drpg-px-mask) center / contain no-repeat;
    image-rendering: pixelated;
}
''' + ',\n'.join(sel(fa).replace(',\n', '::before,\n') + '::before' for fa in FA) + ' { content: none; }')
for fa, n in FA.items(): css.append(sel(fa).replace('\n', ' ') + f' {{ --drpg-px-mask: var(--drpg-px-{n}); }}')
open(os.path.join(ROOT, 'styles', 'pixel-icons.css'), 'w').write('\n'.join(css) + '\n')

# the audit page's symbol block
page = os.path.join(ROOT, 'docs', 'design', 'identity-audit-v13.html')
html = open(page, encoding='utf-8').read()
def repl(m): return svg_symbol(m.group(1))
# drop every glyph of ours that is not one of the page's originals, then add the current set once
html = re.sub(r'\n?<symbol id="px-(' + '|'.join(re.escape(k) for k in ORDER if k not in BASE) + r')"[^>]*>.*?</symbol>', '', html, flags=re.S)
html2, n = re.subn(r'<symbol id="px-([a-z0-9-]+)"[^>]*>\s*<path fill="currentColor" d="[^"]+"\s*/?>\s*</symbol>', repl, html)
last = html2.rfind('</symbol>') + len('</symbol>')
extra = ''.join('\n' + svg_symbol(k) for k in ORDER if k not in BASE)
html2 = html2[:last] + extra + html2[last:]
open(page, 'w', encoding='utf-8').write(html2)
print('glyphs', len(ORDER), 'replaced', n, 'new', len([k for k in ORDER if k not in BASE]), 'fa', len(FA))
