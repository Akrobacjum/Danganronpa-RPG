/**
 * What "an empty world" means to the seeder on v14 (E58 L1, 16.11.2026).
 * ---------------------------------------------------------------------------
 * seed-world.mjs refuses a world that holds anything but its GM, so a test
 * world and a table's world never get mixed. As first written (E30, with no
 * Foundry to read) it counted every document, and on the owner's sandbox it
 * refused the fresh world `drpg-qa-gate`: "3 Folder, 1 Scene, 5 ChatMessage,
 * 17 Setting". Every one of them was written on 15.11.2026 between 20:42:42
 * and 20:43:33 UTC, at the world's creation and its first GM login (each
 * document's `_stats.createdTime`, read 16.11.2026 on Foundry 14.370 with
 * Daggerheart 2.12.9, Dice So Nice, Isometric Perspective, LiveKit and this
 * module 1.2.116). A GM cannot log in to a v14 world before those exist, so the
 * rule refused every fresh world.
 *
 * This names those first-login documents narrowly, each by what was read, and
 * nothing else: any other document refuses, as before. World settings are not
 * counted (every package writes some at its first ready; a table's content is
 * documents, not settings). `FIRST_LOGIN_14_370` is the inventory read on the
 * sandbox; `selfCheck()` holds it accepted and each planted world refused, and
 * `node tools/check.mjs gatecode` runs it.
 */

/** Collections whose documents the rule reads one by one; any other non-empty collection refuses. */
const READ_ONE_BY_ONE = new Set(["User", "Folder", "Scene", "ChatMessage", "Setting"]);

/** The scene Foundry's new-world tour makes (id read on 14.370). */
const TOUR_SCENE = "NUEDEFAULTSCENE0";

/** What the tour's scene held (14.370): a tile and five lights over `nue/defaultscene/fvtt-background.webp`, nothing else. */
const TOUR_SCENE_EMPTY = ["tokens", "notes", "walls", "regions", "drawings", "sounds", "templates"];

/** The module's two first-login whispers on 14.370, each this content exactly. */
const MODULE_FIRST_NOTE = '<p class="notes" data-drpg-secret>-</p>';

/**
 * Read in the page as the world's GM (passed to `page.evaluate`, so it uses
 * nothing from this file). Raw readings only; the rule is applied in node.
 */
export function readInventory() {
    const embedded = s => Object.fromEntries(["tokens", "notes", "walls", "regions", "drawings", "sounds", "templates", "tiles", "lights"]
        .map(k => [k, s[k]?.size ?? 0]));
    return {
        userId: game.user.id,
        collections: Object.fromEntries([...game.collections.entries()].map(([name, c]) => [name, c.size])),
        users: game.users.map(u => ({ id: u.id, role: u.role })),
        folders: game.folders.map(f => ({ id: f.id, type: f.type })),
        scenes: game.scenes.map(s => ({ id: s.id, background: s.background?.src ?? null, embedded: embedded(s) })),
        messages: game.messages.map(m => ({ id: m.id, author: m.author?.id ?? null, whisper: [...(m.whisper ?? [])],
            actor: m.speaker?.actor ?? null, alias: m.speaker?.alias ?? null, flags: m.flags ?? {}, content: String(m.content ?? "") })),
    };
}

/** What in this inventory is not a first-login document, one line a kind; empty when the seeder may write. */
export function leftovers(inv) {
    if (!inv || typeof inv.collections !== "object" || !inv.collections || !Array.isArray(inv.users)
        || !Array.isArray(inv.folders) || !Array.isArray(inv.scenes) || !Array.isArray(inv.messages)) return ["the inventory could not be read"];
    const out = [];
    for (const [name, size] of Object.entries(inv.collections)) if (size > 0 && !READ_ONE_BY_ONE.has(name)) out.push(`${size} ${name}`);
    const role = new Map(inv.users.map(u => [u.id, Number(u.role)]));
    const isGM = id => (role.get(id) ?? 0) >= 3;
    const others = inv.users.filter(u => u.id !== inv.userId).length;
    if (others) out.push(`${others} User`);
    const folders = inv.folders.filter(f => f.type !== "Compendium").length;
    if (folders) out.push(`${folders} Folder`);
    const scenes = inv.scenes.filter(s => !(s.id === TOUR_SCENE && /^nue\//.test(String(s.background ?? ""))
        && TOUR_SCENE_EMPTY.every(k => (s.embedded?.[k] ?? 0) === 0))).length;
    if (scenes) out.push(`${scenes} Scene`);
    const firstLogin = m => {
        if (!isGM(m.author) || m.actor || !m.whisper.length || !m.whisper.every(isGM)) return false;
        if (Object.keys(m.flags).some(scope => scope !== "core" && scope !== "danganronpa-rpg")) return false;
        const drpg = m.flags["danganronpa-rpg"];
        if (drpg) return drpg.drpgMessage === true && drpg.secret === true && Object.keys(drpg).length === 2 && m.content.trim() === MODULE_FIRST_NOTE;
        if (m.flags.core?.nue === true) return m.alias === "Foundry Virtual Tabletop" && /^\s*<h3 class="nue">/.test(m.content);
        return m.alias === "Dice So Nice!" && /^\s*<div class="dice-so-nice">/.test(m.content);
    };
    const messages = inv.messages.filter(m => !firstLogin(m)).length;
    if (messages) out.push(`${messages} ChatMessage`);
    return out;
}

/** The inventory read on the owner's sandbox, 16.11.2026 (Foundry 14.370; contents cut to what the rule reads). */
const GM = "NlTKlEFf2ZXi2dtz";
export const FIRST_LOGIN_14_370 = Object.freeze({
    userId: GM,
    collections: { User: 1, Folder: 3, Actor: 0, Item: 0, Scene: 1, Combat: 0, JournalEntry: 0, Macro: 0, Playlist: 0,
        RollTable: 0, Cards: 0, ChatMessage: 5, Setting: 17, FogExploration: 0 },
    users: [{ id: GM, role: 4 }],
    folders: [{ id: "JLIX4no8PSv22sxt", type: "Compendium" }, { id: "5vockYYn2FnnQ57b", type: "Compendium" }, { id: "f3", type: "Compendium" }],
    scenes: [{ id: TOUR_SCENE, background: "nue/defaultscene/fvtt-background.webp",
        embedded: { tokens: 0, notes: 0, walls: 0, regions: 0, drawings: 0, sounds: 0, templates: 0, tiles: 1, lights: 5 } }],
    messages: [
        { id: "m1", author: GM, whisper: [GM], actor: null, alias: "Foundry Virtual Tabletop", flags: { core: { nue: true, canPopout: true } },
            content: '<h3 class="nue">Inviting Your Players</h3>\n      <p class="nue">When everything is set up ...</p>' },
        { id: "m2", author: GM, whisper: [GM], actor: null, alias: "Foundry Virtual Tabletop", flags: { core: { nue: true, canPopout: true } },
            content: '<h3 class="nue">Getting Started</h3>\n      <p class="nue">It looks like this is a new World. ...</p>' },
        { id: "m3", author: GM, whisper: [GM], actor: null, alias: "Dice So Nice!", flags: { core: { canPopout: true } },
            content: '<div class="dice-so-nice">\n                <h3 class="nue">Dice So Nice - Your 3D dice</h3> ...</div>' },
        { id: "m4", author: GM, whisper: [GM], actor: null, alias: null, flags: { "danganronpa-rpg": { drpgMessage: true, secret: true } }, content: MODULE_FIRST_NOTE },
        { id: "m5", author: GM, whisper: [GM], actor: null, alias: null, flags: { "danganronpa-rpg": { drpgMessage: true, secret: true } }, content: MODULE_FIRST_NOTE },
    ],
});

/** The measured world accepted, and each planted world - one document a table could have made - refused. */
export function selfCheck() {
    const base = () => structuredClone(FIRST_LOGIN_14_370);
    const edit = fn => { const inv = base(); fn(inv); return inv; };
    const tour = inv => inv.messages[1];
    /* Each planted world with the one line it must be refused with, so a case refused by another rule (a player
       added as a user, say) does not count as the rule it plants being held. A message's author or reader the world
       does not list reads as no GM, as a player would. */
    const planted = {
        "an actor": [edit(i => { i.collections.Actor = 1; }), "1 Actor"],
        "a journal entry": [edit(i => { i.collections.JournalEntry = 1; }), "1 JournalEntry"],
        "a collection the rule has never heard of": [edit(i => { i.collections.Adventure = 1; }), "1 Adventure"],
        "a second user": [edit(i => { i.collections.User = 2; i.users.push({ id: "P1", role: 1 }); }), "1 User"],
        "a folder of actors": [edit(i => { i.folders.push({ id: "f4", type: "Actor" }); }), "1 Folder"],
        "a token on the tour's scene": [edit(i => { i.scenes[0].embedded.tokens = 1; }), "1 Scene"],
        "a wall on the tour's scene": [edit(i => { i.scenes[0].embedded.walls = 1; }), "1 Scene"],
        "the tour's id on another background": [edit(i => { i.scenes[0].background = "worlds/x/academy.webp"; }), "1 Scene"],
        "another scene": [edit(i => { i.scenes.push({ id: "academy0000000000", background: "nue/x.webp", embedded: {} }); }), "1 Scene"],
        "a tour card a player wrote": [edit(i => { tour(i).author = "P1"; }), "1 ChatMessage"],
        "a tour card whispered to a player too": [edit(i => { tour(i).whisper.push("P1"); }), "1 ChatMessage"],
        "a tour card said to everyone": [edit(i => { tour(i).whisper = []; }), "1 ChatMessage"],
        "a tour card spoken by an actor": [edit(i => { tour(i).actor = "A1"; }), "1 ChatMessage"],
        "a nue card under another name": [edit(i => { tour(i).alias = "Someone"; }), "1 ChatMessage"],
        "a nue card without the tour's heading": [edit(i => { tour(i).content = "<p>Chie did it</p>"; }), "1 ChatMessage"],
        "a card with the system's flags": [edit(i => { tour(i).flags.daggerheart = { roll: 1 }; }), "1 ChatMessage"],
        "Dice So Nice's name on another card": [edit(i => { i.messages[2].content = "<p>Chie did it</p>"; }), "1 ChatMessage"],
        "the module's secret note with text": [edit(i => { i.messages[3].content = '<p class="notes" data-drpg-secret>Chie did it</p>'; }), "1 ChatMessage"],
        "the module's message with more flags": [edit(i => { i.messages[3].flags["danganronpa-rpg"].caseCard = true; }), "1 ChatMessage"],
        "the module's message not secret": [edit(i => { i.messages[3].flags["danganronpa-rpg"].secret = false; }), "1 ChatMessage"],
        "a plain GM message": [edit(i => { i.messages.push({ id: "m6", author: GM, whisper: [GM], actor: null, alias: "GM", flags: {}, content: "<p>notes</p>" }); }), "1 ChatMessage"],
        "an unreadable inventory": [{ userId: GM }, "the inventory could not be read"],
    };
    const missed = [];
    let refused = 0;
    for (const [name, [inv, line]] of Object.entries(planted)) {
        const got = leftovers(inv);
        if (got.length === 1 && got[0] === line) refused++;
        else missed.push(`${name}: ${got.length ? got.join(", ") : "accepted"}, not "${line}"`);
    }
    const control = leftovers(base());
    if (control.length) missed.push(`the 14.370 world refused: ${control.join(", ")}`);
    return { planted: Object.keys(planted).length, refused, controlOk: control.length === 0, missed };
}
