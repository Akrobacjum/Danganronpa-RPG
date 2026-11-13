# Branches and tags on the remote, for the owner (E59 C5, M10; Q-E59-9, Q-E59-10)

Read on 13.11.2026 against `origin/main` at 421f2395 (1.2.109): `git ls-remote --heads --tags origin`, every head
fetched (41 heads, `main` among them; each local copy equal to the remote's) and tested with
`git merge-base --is-ancestor <head> origin/main`; "ahead" and "behind" are `git rev-list --count`. Nothing here was
deleted: deleting a branch or a tag on GitHub is the owner's (Q-E59-9). Whether a line is still worked on is the
coordinator's to say; this file says only where each head stands.

Every branch but `main` and `lines-board` carries the work lines' common prefix; it is left off below.

## Tags

110 tags: `v0.3.0`, `v1.0.0`, `v1.0.1`, `v1.1.0`, and 106 of `v1.2.x`, the newest `v1.2.105` to `v1.2.109`. (The E59
plan's M10 counted 113: `git ls-remote --tags` prints three more lines, the peeled `^{}` entries of annotated tags.)
Q-E59-10's default: keep all.

## Branches wholly in main (ancestors of it): 10

Each could go without losing a commit.

| Branch | Last commit |
| --- | --- |
| `gate-1.2.70` | 2026-10-08 |
| `e09-1.2.71` | 2026-10-10 |
| `e75-1.2.72` | 2026-10-10 |
| `fervent-sagan-gme4vt-b` | 2026-10-30 |
| `hotfix-1.2.102` | 2026-11-09 |
| `e73` | 2026-11-12 |
| `e76-106` | 2026-11-12 |
| `e92` | 2026-11-12 |
| `fervent-sagan-gme4vt` | 2026-11-12 |
| `gaps-65` | 2026-11-12 |

The E59 plan's M10 called three of them (`gate-1.2.70`, `e09-1.2.71`, `e75-1.2.72`) stale with
histories more than 1000 commits apart from main; read here, each is an ancestor of main - merged, and old.

## Branches with commits main does not have: 30

| Branch | Last commit | Ahead of main | Behind main |
| --- | --- | ---: | ---: |
| `dh-212b` | 2026-11-12 | 14 | 0 |
| `e102-prep` | 2026-11-13 | 1 | 0 |
| `e57-prep` | 2026-11-13 | 3 | 0 |
| `e59-c5a` | 2026-11-13 | 3 | 0 |
| `e59-c5b` | 2026-11-13 | 3 | 0 |
| `e59-prep` | 2026-11-12 | 1 | 0 |
| `e62-c3` | 2026-11-12 | 6 | 0 |
| `live-pack` | 2026-11-13 | 6 | 0 |
| `project-token-icon` | 2026-11-13 | 2 | 0 |
| `perf-open-b` | 2026-11-12 | 6 | 1 |
| `dh-212` | 2026-11-12 | 3 | 90 |
| `e100` | 2026-11-12 | 21 | 90 |
| `e101` | 2026-11-12 | 11 | 90 |
| `e101b` | 2026-11-13 | 71 | 90 |
| `e64-inv` | 2026-11-12 | 11 | 90 |
| `e64` | 2026-11-12 | 61 | 90 |
| `e72` | 2026-11-12 | 72 | 90 |
| `e93` | 2026-11-12 | 58 | 90 |
| `e97-98` | 2026-11-12 | 7 | 90 |
| `gaps-108` | 2026-11-12 | 9 | 90 |
| `gaps-61` | 2026-11-12 | 6 | 90 |
| `perf-open` | 2026-11-12 | 4 | 90 |
| `prep-54` | 2026-11-12 | 8 | 90 |
| `e61-62` | 2026-11-12 | 1 | 114 |
| `texts-e71` | 2026-11-13 | 31 | 142 |
| `e97-fix` | 2026-11-12 | 1 | 147 |
| `gaps-a` | 2026-11-12 | 9 | 150 |
| `audit-130` | 2026-11-12 | 3 | 242 |
| `plan-130` | 2026-11-12 | 10 | 242 |
| `lines-board` | 2026-11-09 | 111 | 1208 |

`lines-board` is the one far from main: 111 commits of its own on a history 1208 commits behind, and not a work
line's name. The rest are today's lines, most of them on the 1.2.108 base (90 behind) or on main itself (0 behind).
