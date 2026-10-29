#!/usr/bin/env python3
# The owner's README exception (option B, 16.10, and A10 Q3 / A11 Q2, 18.10): besides the version line, a commit may
# add one sentence and its <!-- leak:<id> --> marker to the known-leaks paragraph for each entry it adds to
# audit/harness/known-leaks.json. This checks exactly that and nothing wider. Run from the repository: readme-leaks-ok.py <commit>
# Exit 0 = the README change is within the exception; 1 = it is not (the reason on stderr).
import json, re, subprocess, sys

c = sys.argv[1]
def show(rev, path):
    r = subprocess.run(["git", "show", f"{rev}:{path}"], capture_output=True, text=True)
    return r.stdout if r.returncode == 0 else None
def no(why):
    print("readme-leaks-ok: " + why, file=sys.stderr); sys.exit(1)

old, new = show(c + "^", "README.md"), show(c, "README.md")
if old is None or new is None: no("README.md missing on one side")
MARK = re.compile(r"<!-- leak:([A-Za-z0-9_.-]+) -->")
def split(text):
    # the version line goes; the paragraph (blank-line block) holding the leak markers is cut out
    lines = [l for l in text.split("\n") if "They describe version" not in l]
    blocks, cur = [], []
    for l in lines:
        if l.strip() == "":
            blocks.append(cur); cur = []
        else: cur.append(l)
    blocks.append(cur)
    idx = [i for i, b in enumerate(blocks) if any(MARK.search(l) for l in b)]
    if len(idx) != 1: no(f"want one paragraph with leak markers, found {len(idx)}")
    i = idx[0]
    para = " ".join(blocks[i])
    rest = blocks[:i] + [["<PARA>"]] + blocks[i + 1:]
    return para, rest
po, ro = split(old)
pn, rn = split(new)
if ro != rn: no("README changed outside the known-leaks paragraph and the version line")
mo, mn = MARK.findall(po), MARK.findall(pn)
if len(set(mn)) != len(mn): no("a leak marker is doubled")
gone = [m for m in mo if m not in mn]
if gone: no("markers removed: " + ", ".join(gone))
added = [m for m in mn if m not in mo]
def ids(rev):
    t = show(rev, "audit/harness/known-leaks.json")
    return {e["id"]: e for e in json.loads(t)["leaks"]} if t else {}
jo, jn = ids(c + "^"), ids(c)
newids = [i for i in jn if i not in jo]
for m in added:
    if m not in newids: no(f"marker {m} has no new known-leaks.json entry in this commit")
    if jn[m].get("readme") != f"leak:{m}": no(f"entry {m} does not name readme leak:{m}")
# the old text must stay, in order: the new paragraph minus the added sentences reads as the old one
wo, wn = po.split(), pn.split()
grow = len(wn) - len(wo)
if grow < 0: no("the paragraph lost words")
if grow > 45 * len(added): no(f"the paragraph grew {grow} words for {len(added)} new markers (at most 45 each)")
it = iter(wn)
if not all(w in it for w in wo): no("the paragraph's old words are not all kept, in order")
print(f"readme-leaks-ok: {c}: {len(added)} marker(s) added ({', '.join(added) or 'none'}), +{grow} words")
