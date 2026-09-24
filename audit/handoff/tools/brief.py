"""Print one stage's brief from the plan (goal, why, risk, verify, doneWhen, decisions, issues).

    python3 audit/handoff/tools/brief.py E31 [--no-members] [--plan "docs/Audyt Stained Update.html"]

The plan is the HTML artifact on main; its data is the JSON in <script type="application/json" id="data">.
When the file is not in the checkout, it is read from origin/main with `git show`.
"""
import json, re, subprocess, sys
args = sys.argv[1:]
plan = "docs/Audyt Stained Update.html"
if "--plan" in args:
    i = args.index("--plan"); plan = args[i + 1]; del args[i:i + 2]
members = "--no-members" not in args
sid = [a for a in args if not a.startswith("--")][0]
try:
    html = open(plan, encoding="utf-8").read()
except FileNotFoundError:
    html = subprocess.run(["git", "show", f"origin/main:{plan}"], capture_output=True, text=True, encoding="utf-8", check=True).stdout
m = re.search(r'<script type="application/json" id="data">(.*?)</script>', html, re.S)
d = json.loads(m.group(1))
issues = {it["key"]: it for ar in d["areas"] for it in ar["issues"]}
s = {x["id"]: x for x in d["plan"]["stages"]}[sid]
out = [f"# {sid} {s['name']}\n"]
for k in ["goal", "why", "risk", "verify", "doneWhen"]:
    out.append(f"## {k}\n{s[k]}\n")
out.append(f"asks: {s.get('asks')}  decisions: {s.get('decisions')}\n")
for dk in s.get("decisions", []):
    out.append(f"- {dk}: {d['answers'].get(dk)}")
for iid in s.get("issues", []):
    it = issues.get(iid)
    if not it:
        out.append(f"\n### {iid} (NOT FOUND)\n"); continue
    out.append(f"\n### {iid} [{it['severity']}] {it['title']}\nstatus={it.get('status')} stage={it.get('stage')}\nwhere: {it.get('where')}\n\nPROBLEM: {it['problem']}\n\nFIX: {it['fix']}\n")
    if it.get("decisionNote"): out.append(f"DECISION NOTE: {it['decisionNote']}\n")
    if members:
        for mm in it.get("members", []):
            f = d["findings"].get(mm)
            out.append(f"  - member {mm}: " + (json.dumps(f, ensure_ascii=False)[:2500] if f else "(no finding record)"))
sys.stdout.reconfigure(encoding="utf-8")
print("\n".join(out))
