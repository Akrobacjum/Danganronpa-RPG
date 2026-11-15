# E111: a draft paragraph for the trust model (D2)

The trust model's rule file (trust-model.md, in the repository's rules folder) is not this line's to edit. The
paragraph below is a draft for whoever edits it; it would stand after "Layer two", before "What stays open", with its
last sentence in "What stays open".

---

**The case's copy on the server (E111, 1.2.115).** Since 1.2.115 the case - every GM store with `backup: true`, the
file Back up saves - has a copy outside the GMs' browsers: a file in the world's folder on the Foundry server,
`worlds/<world>/drpg-case/case-<32 hex>.json`, uploaded by a GM's browser through Foundry's FilePicker (case-copy.mjs).
It is not in world data: no setting, flag, chat card or log line holds the file or its name, so nothing Foundry sends to
a player's browser carries it (scenario 34 A3 scans a player's world settings, localStorage, chat messages, flags and
every packet sent to it for the name and the planner's fields and values). It is not encrypted. What keeps it from a
player is Foundry's: listing the folder asks FILES_BROWSE and uploading asks FILES_UPLOAD (the harness's stand-in judges
both, scenario 34 A2; on v14, LIVE-E111-02), and enforced.mjs's row `playerFiles` keeps both off the Player and Trusted
Player roles; and the name, 128 random bits, cannot be guessed. The module writes no copy while that row is off, or
while the permissions in force give either permission to a Player, a Trusted Player or a player's own account
(`filesRefusal`; R7345; scenario 34 B1-B2), and tells the GMs why. A write never comes from a browser whose stores have
not heard the other GMs, and never before it has listed and merged every copy in the folder (`copyRefusal`,
`writeServerCopy`; R7346; scenario 34 D1-D2). What stays open: Foundry's server hands a file of the data folder to
anybody who asks its exact path, logged in or not (assumed, LIVE-E111-02), so a name that leaks - pasted into a chat,
shown on a shared screen, read off a GM's console - gives the whole case to whoever holds it; and a GM who gives a
player FILES_BROWSE while no GM is connected is caught only at the next GM's write or load.

---

Sources for each claim: case-copy.mjs (header, `filesRefusal`, `filesPrivate`, `copyRefusal`, `writeServerCopy`,
`readServerCopies`, `newCopyName`), enforced.mjs (`ENFORCED` row `playerFiles`, `permissionsInForce`), R7345-R7348 in
scripts/tests-tier1.mjs, audit/harness/scenarios/34-case-seal.mjs (A2, A3, B1, B2, D1, D2), cluster.mjs case "files"
for the harness's permission gate, and audit/AUDIT-1.2.42.md 9.2 rows 549-551.
