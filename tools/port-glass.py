# Port the design page's curtain renderer (docs/design/glass-recipe.js, the <script> of the
# identity audit) into the module (scripts/glass.mjs). Run from the repository root after every
# change to the recipe, so the page and the module stay one recipe: the geometry, the paint and
# the pulse are copied verbatim; the module's own lifecycle (everything from the
# '/* ---- lifecycle' marker in glass.mjs) is kept.
#
#     python3 tools/port-glass.py
import re
import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
S = os.path.join(ROOT, 'docs', 'design', 'glass-recipe.js')
T = os.path.join(ROOT, 'scripts', 'glass.mjs')
s = open(S, encoding='utf-8').read()
s = s.replace('<script>\n(function () {\n', '', 1)
cut = s.index('  function windowGlass(job) {')
core = s[:cut]
loop_start = core.index('  const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;')
loop_end = core.index('{ let last = 0; const loop = t =>')
loop_end = core.index('\n', loop_end) + 1
pulse_fn = core[loop_start:loop_end]
core = core[:loop_start] + core[loop_end:]
pulse_fn = pulse_fn.replace('for (const j of [...curtains, ...windows]) {\n      if (!j.pulse || !j.panes || !inView.has(j.el)) continue;', 'for (const j of [...curtains, ...windows]) {\n      if (!j.pulse || !j.panes || !j.el.isConnected) continue;')
pulse_fn = re.sub(r'  \{ let last = 0; const loop = .*\n', '', pulse_fn)
pulse_fn = pulse_fn.replace('  const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;\n', '')
def must(a, b):
    global core
    assert a in core, a[:80]
    core = core.replace(a, b)
must('    const boxes = LAYOUT(W, H).map(t => ({ ...t, el: host.querySelector(".stack .block." + t.cls) }));', '    const boxes = moduleLayout(W, H);')
must('''      for (const b of c.items) if (b.el) {
        b.el.style.transformOrigin = (px - b.el.offsetLeft) + "px " + (py - b.el.offsetTop) + "px";
        b.el.style.transform = Math.abs(phi) < 0.004 ? "" : "rotate(" + phi + "rad)";
      }''', '''      for (const b of c.items) if (b.el && b.r) for (const e of b.els) {
        const er = e.getBoundingClientRect();
        e.style.transformOrigin = (px - er.left) + "px " + (py - er.top) + "px";
        e.style.transform = Math.abs(phi) < 0.004 ? "" : "rotate(" + phi + "rad)";
      }''')
must('''      if (b.el && (b.el.offsetLeft < b.x - 0.5 || b.el.offsetTop < b.y - 0.5 || b.el.offsetLeft + b.el.offsetWidth > b.x + b.w + 0.5 || b.el.offsetTop + b.el.offsetHeight > b.y + b.h + 0.5)) fitFails++;''',
     '''      if (b.r && (b.r.x < b.x - 0.5 || b.r.y < b.y - 0.5 || b.r.x + b.r.w > b.x + b.w + 0.5 || b.r.y + b.r.h > b.y + b.h + 0.5)) fitFails++;''')
must('const el = job.el, host = el.parentElement, c = el.querySelector("canvas.sg");', 'const el = job.el, host = document, c = el.querySelector("canvas.sg");')
# the page's Foundry-tile mock becomes the real scene controls and sidebar tabs
must('''    for (const [sel, side] of [[".f-ctl", "left"], [".f-side", "right"]]) {''', '''    for (const [sel, side] of [["#scene-controls", "left"], ["#sidebar-tabs", "right"]]) {''')
a = core.index('  /* the layout the curtain is cut for:'); b = core.index('  function curtainShapes(host, W, H, rnd) {')
core = core[:a] + core[b:]
core = core.replace('(window.__panes = window.__panes || []).push({', 'CHECKS.push({')
assert 'inView' not in core and '.stack' not in core

header = open(T, encoding='utf-8').read()
h0 = header.index('/* ---- lifecycle')
head = header[:header.index('  /* ---- the glass ----')]
life = header[h0:]
open(T, 'w', encoding='utf-8').write(head + core + pulse_fn + '\n' + life)
print('ported', len(core))
