# Raw findings of the repeated audit (1.2.118)

Written by the readers of the audit of main at b5a29e73 (1.2.118), 20.11.2026, as `audit/findings-1.2.42/` was for
the audit of 1.2.42. English, one JSON file a reader. The report that reads them is `audit/AUDIT-1.2.42.md`, part I
(sections 10-18, Polish); its section 11 is the method and the vocabulary (statuses, severities, confidence, the five
classes of evidence).

A file here is a reading, not a verdict: every finding in the report went through a second reader whose task was to
refute it (section 11.2, U1), and what did not survive is marked so in the report, not removed here.

| Files | What |
| --- | --- |
| `old-*.json` | the items of the three earlier audits (1.1.88, 1.2.13, 1.2.42) settled against today's code |
| `live-readings-*.json` | every recorded reading on a real Foundry or at a real table, taken from the papers |
| `live-items-NN.json` | the live-check list (AUDIT 9.2), item by item |
| `domain-*.json` | the static re-read of every non-test script, by group of files |
| `controls-*.json` | the controls pass: label, handler, effect, audience |
| `probe-*.json` | the evidence of the harness probes 42 and 43, as run for this audit |

No reader ran the harness: one base run was made centrally, and the probes ran one at a time.
