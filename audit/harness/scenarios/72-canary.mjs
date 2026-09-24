/**
 * 72-canary: what a player's browser holds of the GM's secrets and of another
 * player's plans (E30, 24.09.2026; audit S17-07; lib/canary.mjs).
 *
 * The canary's self-test first, so an absence below means something: each surface
 * is shown being read, and a leak planted on purpose comes back as a hit. Then one
 * marker in each secret field the module writes from the GM's side or a killer's -
 * the Key Remnant plan, a trace's note and subject, a Truth Bullet's GM note, a
 * secret project and an indirect murder's condition, a player's pre-session note,
 * a Direct Murder parked in an Eclipse, a hidden token - and one scan of every
 * player's browser once the table is at rest. A marker found where it may not be
 * is a hit: one known-leaks.json describes is that leak, reproduced, and red until
 * its stage; any other fails this run.
 *
 * E43 extends this to the season (the identity needles of lib/canary.mjs's path).
 */
export const layers = ["ci"];

const MOD = "danganronpa-rpg";

export async function run({ gm, p1, p2, p3, check, phase, settle, canary, repoUrl, IDS }) {
    phase("selftest");
    await canary.selfTest();

    phase("plant");
    /* The GM's plan for the Key Remnants (investigation.mjs, setKeyPlan). */
    const kp = { name: canary.marker("keyplan.name"), text: canary.marker("keyplan.text"),
        analysis: canary.marker("keyplan.analysis"), note: canary.marker("keyplan.note") };
    await gm.eval(`await game.drpg.setKeyPlan({ chapter: 1, entries: [{ name: "${kp.name}", text: "${kp.text}", analysis: "${kp.analysis}", note: "${kp.note}" }] });
        return true;`);

    /* A trace, not an incident's: hidden, and its note and subject for the GM's ledger only. */
    const trace = { note: canary.marker("remnant.note"), subject: canary.marker("remnant.subject") };
    const traceId = await gm.eval(`const t = await game.drpg.placeRemnant({ room: "Gym", type: "prep", visibility: "obvious",
            note: "${trace.note}", subject: "${trace.subject}" });
        return t?.id ?? null;`, { timeout: 60000 });
    check("gm: a trace is placed, its token on the GM's scene", Boolean(traceId), String(traceId));

    /* A Truth Bullet on Aiko (p1's): the bullet is hers to read, its GM note is not. */
    const bulletNote = canary.marker("bullet.note");
    const bullet = await gm.eval(`const item = await game.drpg.createTruthBullet(game.actors.get("${IDS.aiko}"), { name: "A torn ticket", playerText: "Half a cinema ticket.", gmNote: "${bulletNote}" });
        return item?.uuid ?? null;`, { timeout: 60000 });
    check("gm: a Truth Bullet is made on Aiko's sheet", Boolean(bullet), String(bullet));

    /* A secret project that is an indirect murder: the killer's (p3's) and the GM's. */
    const project = { name: canary.marker("project.name", { allowed: ["gm", "p3"] }),
        condition: canary.marker("project.condition", { allowed: ["gm", "p3"] }) };
    const made = await gm.eval(`const p = await game.drpg.createProject({ name: "${project.name}", indirectMurder: true, secret: true,
            killerId: "${IDS.chie}", condition: "${project.condition}" });
        return p?.id ?? null;`, { timeout: 60000 });
    check("gm: a secret indirect-murder project is made for Chie", Boolean(made), String(made));

    /* p3's own pre-session note (pre-session-note.mjs), which is for the GMs. */
    const note = canary.marker("note.player", { allowed: ["gm", "p3"] });
    await p3.eval(`const { saveNote } = await import("${repoUrl}/scripts/pre-session-note.mjs");
        await saveNote(game.user.id, "${note}");
        return true;`);

    /* A Direct Murder parked during an Eclipse, by the killer's player (eclipse.mjs). */
    const park = canary.marker("park.note", { allowed: ["gm", "p3"] });
    const eclipse = await gm.eval(`await game.drpg.startEclipse(); return game.drpg.isEclipse();`, { timeout: 60000 });
    check("gm: an Eclipse is open", eclipse === true, String(eclipse));
    await p3.eval(`const { parkDirectMurder } = await import("${repoUrl}/scripts/eclipse.mjs");
        await parkDirectMurder({ killerId: "${IDS.chie}", room: "Gym", note: "${park}" });
        return true;`, { timeout: 60000 });
    await settle(1000);
    const parked = await gm.eval(`return game.settings.get("${MOD}", "pendingMurders")?.["${IDS.chie}"] ? true : false;`);
    check("gm: Chie's Direct Murder is parked, waiting for the GM", parked === true, String(parked));

    /* A token the GM hid. */
    const hidden = canary.marker("token.hidden");
    await gm.eval(`const scene = game.scenes.active ?? canvas.scene;
        const [t] = await scene.createEmbeddedDocuments("Token", [{ name: "${hidden}", hidden: true, x: 3000, y: 2500 }]);
        return t?.id ?? null;`);

    phase("rest");
    await settle(1500);
    await canary.scan({ phase: "rest" });

    /* An unfound trace is a token, and a token reaches every browser (S17-64): not a
       marker in a field, so it is asked of the scene itself. */
    const holders = [];
    for (const p of [p1, p2, p3]) {
        if (await p.eval(`return Boolean((game.scenes.active ?? canvas.scene)?.tokens.get("${traceId ?? "none"}"));`)) holders.push(p.who);
    }
    check("an unfound trace's token reaches no player's browser", holders.length === 0,
        holders.length ? `trace token ${traceId} on ${holders.join(", ")}` : "", { knownLeak: "S17-64", measured: Boolean(traceId) });
}
