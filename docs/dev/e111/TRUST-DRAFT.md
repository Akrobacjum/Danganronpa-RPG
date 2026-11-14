# E111: a draft paragraph for the trust model (D2)

The trust model's rule file (trust-model.md, in the repository's rules folder) is not this line's to edit. The paragraph below is a draft for whoever edits it; it would
stand after "Layer two", before "What stays open", or as a sentence in "What stays open" and a paragraph of its own.

---

**The case's sealed copy (E111, 1.2.115).** Since 1.2.115 the world may hold the case - every GM store with
`backup: true`, the file Back up saves - as one world setting, `caseSealed`, which every browser holds, a player's
among them. It holds AES-GCM 256 ciphertext and what opens it (`format`, `version`, `kdf`, `iv`, `ciphertext`,
`writtenAt`, `writtenBy`, `worldId`, and nothing else: `world-secrets.mjs` `caseSealed: only`). The key is
PBKDF2-HMAC-SHA-256, 600 000 rounds, over a passphrase the GMs share and a random 16-byte salt; each write takes a fresh
12-byte IV; the format, version, world id and salt are the ciphertext's additional data (case-seal.mjs). A GM's browser
keeps the derived key (client setting `caseSealKey`), never the passphrase. Only a GM writes the copy: Foundry's
SETTINGS_MODIFY keeps world settings to the GMs (the harness's gate refuses a player's write, scenario 34 A4; on v14,
LIVE-E30-04), and the module's own writers refuse a player first (`sealRefusal` "notGm", `setCasePassphrase`). What a
player can do with the copy: read when it was written and by which GM, and its length, which moves in steps of 4 KiB
(the plaintext is padded and never compressed, so a player who writes text into the case - a pre-session note - learns
nothing from the length about what else it holds); see that a GM store changed (a write follows a change by 15 to 60
seconds); and copy the ciphertext and try passphrases against it offline, as fast as their own hardware allows, with
nobody told. That last is the copy's one real exposure: its strength is the passphrase's. The module refuses fewer
than 12 characters (Q-E111-1), and the GM handbook (14.8) asks for four or more unrelated words, used nowhere else.
What the copy does not change: a player's browser still holds no plaintext of the case (scenario 34 A3 scans a
player's world settings, localStorage and every packet sent to it for the fixture's fields and values), and a write
never comes from a browser that has not read the copy the world holds, nor from one whose stores have not heard the
other GMs (`sealRefusal` "unread", "notHydrated"; R7342; scenario 34 C1-C3).

---

Sources for each claim, for the reviewer: case-seal.mjs (header, `sealCase`, `sealRefusal`, `SEAL_PAD`,
`SEAL_QUIET_MS`, `SEAL_MOST_MS`, `SEAL_MIN_LENGTH`), world-secrets.mjs (`caseSealed`), R7340-R7344 in
scripts/tests-tier1.mjs, scenario audit/harness/scenarios/34-case-seal.mjs (A3, A4, C1-C3), OWASP's password storage
guidance's PBKDF2-HMAC-SHA256 figure (600 000), and cluster.mjs's `setting` case for the harness's permission gate.
