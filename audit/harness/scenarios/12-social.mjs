/** L3: private rolls between clients, inventory limits, movement/search. */
export const layers = ["ci"];

const MOD = "danganronpa-rpg";
export async function run({ gm, p1, p2, check, phase, settle, repoUrl }) {
    const ids = await gm.eval(`return {
        aiko: game.actors.getName("Aiko Hoshino").id, botan: game.actors.getName("Botan Kage").id };`);

    // --- forced private rolls: is the setting on, and does a player's roll stay off p2? ---
    phase("private rolls", { flow: "private-rolls" });
    // This was check(name, true): it printed the value and could not fail. settings.mjs
    // registers the setting with `default: true`, no module code writes it, and nothing in
    // this scenario does before this line, so the read is the default a new world starts with.
    const forced = await gm.eval(`return game.settings.get("${MOD}", "forcePrivateRolls");`);
    check("forcePrivateRolls is on until a GM turns it off", forced === true, `= ${forced}`);

    await gm.eval(`await game.settings.set("${MOD}", "forcePrivateRolls", true); return true;`);
    await settle(200);

    /*
     * p1 (Aiko) rolls; what does p2's browser hold of it?
     *
     * This used to count Aiko's rolls in p2's `game.messages` and pass on zero -
     * which it always was, because the harness never delivered a whisper to anybody
     * off its list. Foundry delivers every message to every browser (lib/shim.mjs,
     * REALISM RULES), so p2 now holds the roll, and the question is the one Foundry
     * itself answers: is it whispered past p2, so that p2's chat log will not draw
     * it? `isContentVisible` is Foundry's rule, and private-rolls.mjs hides a card
     * by it at render time.
     *
     * NOT "the content is a stub": a roll is not a secret.mjs card. The README says
     * so outright ("Privacy": rolls are whispered, so other players never see them,
     * but like every chat message they reach every browser) - the dice stay in the
     * document on every client, a curtain and not a wall. What p2's console can read
     * is printed below, so that nobody mistakes this check for more than it is.
     */
    /* DICE SO NICE WITH "HIDE 3D DICE ON SECRET ROLLS" OFF (E06 C6, 27.09.2026; audit S02-40).
       Each client's model of Dice So Nice (client-entry.mjs, "DICE SO NICE'S DECISION") animates
       a roll wherever the setting is off, readable or not, unless the module's
       `diceSoNiceMessagePreProcess` says no - which it does where the roll cannot be read.
       A STATISTIC FROM THE SHEET, DRAWN BY THE GM (E08+E28 C13, 04.10.2026; the plan's 3.4; the
       owner's note of 27.09). Aiko's roll is p1's statistic from her sheet, which the GM draws and
       writes (roll-draw.mjs): Dice So Nice's own decision is off for the GM's message on every
       browser - it would throw it in the GM's colours - and the dice are played as p1's: on p1
       from the draw's answer, on the GM by the relay (private-rolls.mjs `relayDrawnDice`), on p2
       not at all. Each model keeps every `showForRoll` with the user whose dice it throws
       (`__dsnShown`), and what it would animate itself (`__dsnAnimated`). */
    const DSN_OFF = `globalThis.__dsnHideSecret = false; globalThis.__dsnAnimated = []; globalThis.__dsnShown = []; return true;`;
    for (const c of [gm, p1, p2]) await c.eval(DSN_OFF);
    const rollRes = await p1.eval(`
        const actor = game.actors.get("${ids.aiko}");
        globalThis.__forceRoll = { hope: 7, fear: 4 };
        const before = game.messages.contents.length;
        const cfg = await actor.rollTrait("agility", {});
        const mine = game.messages.contents.length - before;
        return { mine, id: cfg?.message?.id ?? null, total: cfg?.message?.rolls?.[0]?.total ?? null };
    `, { timeout: 60000 });
    await settle(400);
    const onP2 = await p2.eval(`
        const m = game.messages.get("${rollRes.id}");
        if (!m) return { held: false };
        return { held: true, isRoll: m.isRoll, whisper: m.whisper, visible: m.visible, contentVisible: m.isContentVisible,
                 readable: (m._source.content ?? "").replace(/<[^>]+>/g, " ").replace(/\\s+/g, " ").trim().slice(0, 80) };
    `);
    check("p1 made a roll", (rollRes.mine ?? 0) >= 1 && Boolean(rollRes.id), JSON.stringify(rollRes));
    // Without this the next check could pass by never having been handed the document.
    check("p2's browser holds Aiko's roll, as every Foundry client does", onP2.held === true, JSON.stringify(onP2));
    check("PRIVACY: Aiko's roll is whispered past p2, so p2's chat log does not show it",
        onP2.held === true && onP2.whisper.length > 0 && !onP2.whisper.includes(p2.userId) && onP2.contentVisible === false,
        JSON.stringify(onP2));

    /* A BARE ROLL ON A BROWSER WHERE CONST.DICE_ROLL_MODES THROWS (E33 C11, 07.10.2026; audit S02-68, the
       plan's V7). Aiko's statistic above is drawn and written by the GM; this one is thrown on p1's own
       browser (`new Roll().toMessage()`, no module road), so private-rolls.mjs's hook runs there. Until
       1.2.69 it wrote the whisper and `flags.core.rollMode: CONST.DICE_ROLL_MODES.PRIVATE` in one write, and
       a browser where reading the constant throws - Foundry 14 deprecates it, 16 drops it, as the audit reads
       v14 - created the roll public. p1 puts a throwing getter in the constant's place for the one roll, puts
       the harness's back, and counts the reads: none now, and the roll reaches the GMs and p1 alone. */
    const bareRoll = await p1.eval(`
        const had = Object.getOwnPropertyDescriptor(CONST, "DICE_ROLL_MODES");
        let reads = 0;
        Object.defineProperty(CONST, "DICE_ROLL_MODES", { configurable: true, get() { reads++; throw new Error("12-social: CONST.DICE_ROLL_MODES is gone"); } });
        try {
            const before = game.messages.contents.length;
            const message = await new Roll("1d20").toMessage({ speaker: ChatMessage.getSpeaker({ actor: game.actors.get("${ids.aiko}") }) });
            return { id: message?.id ?? null, made: game.messages.contents.length - before, reads, whisper: message?.whisper ?? null,
                     blind: message?.blind ?? null, rollMode: message?._source?.flags?.core?.rollMode ?? null };
        } finally {
            if (had) Object.defineProperty(CONST, "DICE_ROLL_MODES", had); else delete CONST.DICE_ROLL_MODES;
        }
    `, { timeout: 30000 });
    await settle(400);
    const bareOnP2 = await p2.eval(`
        const m = game.messages.get("${bareRoll.id}");
        return m ? { held: true, whisper: m.whisper, contentVisible: m.isContentVisible } : { held: false };
    `);
    check("PRIVACY: a bare roll Aiko throws on a browser where CONST.DICE_ROLL_MODES throws still reaches the GMs and her alone, never reads the constant, and p2 cannot read it (S02-68)",
        bareRoll.made === 1 && bareRoll.reads === 0 && Array.isArray(bareRoll.whisper) && bareRoll.whisper.includes(gm.userId) && bareRoll.whisper.includes(p1.userId)
            && !bareRoll.whisper.includes(p2.userId) && bareRoll.blind === false && bareRoll.rollMode === null && bareOnP2.held === true && bareOnP2.contentVisible === false,
        JSON.stringify({ bareRoll, bareOnP2 }), { flow: "private-rolls" });
    // The bare roll is this check's alone: deleted so that no later count of the log holds it.
    await gm.eval(`await game.messages.get("${bareRoll.id}")?.delete(); return true;`);

    /* THE GM'S PUBLIC ROLL (E33 C12, 07.10.2026; audit S02-72; the owner's Q2 (a)). With rolls forced private a
       GM had no public roll at all - a bare `/r` on the GM went to the GMs. `game.drpg.publicRoll` posts the roll
       on the GM's browser with the module's flag `publicRoll`, and private-rolls.mjs leaves a GM's flagged message
       as it arrived. Read on three browsers: the GM's message (no whisper, not blind, the flag, a total), p1 and
       p2 each holding it readable with the same total; then p1's own call, refused (null, nothing made). After
       that p1's bare roll carrying the flag by hand: whispered past p2 as any player's roll, no public roll on the
       GM, and named `forged` there once (a row of the sheet audit, one line to the GMs). */
    const pub = await gm.eval(`
        if (typeof game.drpg.publicRoll !== "function") return { absent: true };
        const before = game.messages.contents.length;
        const m = await game.drpg.publicRoll("1d6", { flavor: "12-social C12" });
        return { id: m?.id ?? null, made: game.messages.contents.length - before, whisper: m?.whisper ?? null, blind: m?.blind ?? null,
                 flag: m?.getFlag("${MOD}", "publicRoll") ?? null, author: m?.author?.id ?? null, total: m?.rolls?.[0]?.total ?? null };
    `, { timeout: 30000 });
    await settle(400);
    const readPub = `const m = game.messages.get("${pub.id}"); return m ? { held: true, contentVisible: m.isContentVisible, total: m.rolls?.[0]?.total ?? null } : { held: false };`;
    const pubOnP1 = await p1.eval(readPub), pubOnP2 = await p2.eval(readPub);
    const p1Call = await p1.eval(`
        if (typeof game.drpg.publicRoll !== "function") return { absent: true };
        const before = game.messages.contents.length;
        const r = await game.drpg.publicRoll("1d6");
        return { result: r === null ? null : (r?.id ?? "?"), made: game.messages.contents.length - before };
    `, { timeout: 30000 });
    check("a GM's public roll (game.drpg.publicRoll) is read by p1 and p2 with forcePrivateRolls on, and p1's own call makes nothing (S02-72)",
        pub.made === 1 && Array.isArray(pub.whisper) && pub.whisper.length === 0 && pub.blind === false && pub.flag === true && pub.author === gm.userId
            && Number.isInteger(pub.total) && pub.total >= 1 && pub.total <= 6
            && pubOnP1.held === true && pubOnP1.contentVisible === true && pubOnP1.total === pub.total
            && pubOnP2.held === true && pubOnP2.contentVisible === true && pubOnP2.total === pub.total
            && p1Call.result === null && p1Call.made === 0,
        JSON.stringify({ pub, pubOnP1, pubOnP2, p1Call }), { flow: "private-rolls" });
    const forgedPub = await p1.eval(`
        const before = game.messages.contents.length;
        const message = await new Roll("1d6").toMessage({ speaker: ChatMessage.getSpeaker({ actor: game.actors.get("${ids.aiko}") }), flags: { "${MOD}": { publicRoll: true } } });
        return { id: message?.id ?? null, made: game.messages.contents.length - before, whisper: message?.whisper ?? null, blind: message?.blind ?? null };
    `, { timeout: 30000 });
    await settle(400);
    const forgedOnP2 = await p2.eval(`const m = game.messages.get("${forgedPub.id}"); return m ? { held: true, whisper: m.whisper, contentVisible: m.isContentVisible } : { held: false };`);
    const forgedOnGm = await gm.eval(`
        const { sheetWriteStore } = await import("${repoUrl}/scripts/gm-stores.mjs");
        const { cardFlag } = await import("${repoUrl}/scripts/secret.mjs");
        const { isPublicRoll, forgedFlagsOf } = await import("${repoUrl}/scripts/private-rolls.mjs");
        const until = async (test, ms = 4000) => { const end = Date.now() + ms; while (!test() && Date.now() < end) await new Promise(r => setTimeout(r, 100)); return test(); };
        const told = () => game.messages.contents.filter(m => cardFlag(m, "forgedCard") === "${forgedPub.id}").length;
        await until(() => told() >= 1);
        const m = game.messages.get("${forgedPub.id}");
        const rows = Object.values(sheetWriteStore.entries() ?? {}).filter(row => row?.verdict === "forged" && (row.messageId === "${forgedPub.id}" || (row.messages ?? []).includes("${forgedPub.id}")));
        return { held: Boolean(m), isPublic: m && typeof isPublicRoll === "function" ? isPublicRoll(m) : "absent", forged: m ? forgedFlagsOf(m) : null, rows: rows.length, told: told() };
    `, { timeout: 30000 });
    check("PRIVACY: a roll p1 throws with the publicRoll flag by hand is whispered past p2 as any player's, is no public roll, and the GM names it forged once (S02-72)",
        forgedPub.made === 1 && Array.isArray(forgedPub.whisper) && forgedPub.whisper.includes(gm.userId) && forgedPub.whisper.includes(p1.userId) && !forgedPub.whisper.includes(p2.userId)
            && forgedPub.blind === false && forgedOnP2.held === true && forgedOnP2.contentVisible === false
            && forgedOnGm.held === true && forgedOnGm.isPublic === false && JSON.stringify(forgedOnGm.forged) === JSON.stringify([`flags.${MOD}.publicRoll`])
            && forgedOnGm.rows === 1 && forgedOnGm.told === 1,
        JSON.stringify({ forgedPub, forgedOnP2, forgedOnGm }), { flow: "private-rolls" });
    // Both rolls are this block's alone: deleted, with the GMs' line naming the second, so that no later count of the log holds them.
    await gm.eval(`const { cardFlag } = await import("${repoUrl}/scripts/secret.mjs");
        for (const id of ["${pub.id}", "${forgedPub.id}"]) await game.messages.get(id)?.delete();
        for (const m of game.messages.contents.filter(m => cardFlag(m, "forgedCard") === "${forgedPub.id}")) await m.delete(); return true;`);
    console.log("[qa] what p2's console can still read of Aiko's private roll (documented, README 'Privacy'):", JSON.stringify(onP2.readable));
    const onP1 = await p1.eval(`const m = game.messages.get("${rollRes.id}");
        return m ? { contentVisible: m.isContentVisible, author: m.author?.id ?? null, drawn: m.getFlag("${MOD}", "drawn") === true,
            superseded: Boolean(m.getFlag("${MOD}", "supersededRoll")), speaker: m.speaker?.actor ?? null } : null;`);
    check("PRIVACY: Aiko's statistic from the sheet is drawn by the GM - the GM's message, naming nobody, keeping Daggerheart's card - and read on her browser alone of the players",
        onP1?.contentVisible === true && onP1.author === gm.userId && onP1.drawn && !onP1.superseded && onP1.speaker === null
            && onP2.contentVisible === false, JSON.stringify({ onP1, p2: onP2.contentVisible }));
    /* AFTER A RELOAD (E08+E28 fix r2-H7, 05.10.2026; the round-2 review's m7). Which drawn rolls a
       browser may read was memory alone, so a reload hid every sheet roll of Aiko's the GM had drawn
       from her own log. The harness cannot reload a client: p1's set is emptied and read back from
       its storage as a reload's `ready` does (private-rolls.mjs `refillReadable`), and her statistic
       is read again; that `ready` reads it back is read in the file served. Red at 17feea3's runtime: nothing to read it back with, nothing kept. */
    const reloaded = await p1.eval(`const P = await import("${repoUrl}/scripts/private-rolls.mjs");
        const read = typeof P.refillReadable === "function" ? P.refillReadable() : null;
        const kept = game.settings.settings.has("${MOD}.readableRolls") ? game.settings.get("${MOD}", "readableRolls") : {};
        const m = game.messages.get("${rollRes.id}");
        const wired = (await (await fetch("/modules/${MOD}/scripts/private-rolls.mjs")).text()).includes('Hooks.once("ready", refillReadable)');
        return { read, wired, kept: (kept?.[game.world.id + "." + game.user.id] ?? []).includes("${rollRes.id}"), readable: Boolean(m?.isContentVisible) };`);
    check("PRIVACY: after a reload Aiko still reads her statistic the GM drew - kept on her browser for this world and her user",
        Boolean(onP1?.drawn) && reloaded.read >= 1 && reloaded.wired && reloaded.kept && reloaded.readable, JSON.stringify(reloaded));
    const DSN_READ = `const shown = globalThis.__dsnShown.filter(c => !c.synchronize).map(c => [c.user, c.total]);
        const animated = globalThis.__dsnAnimated.includes("${rollRes.id}"); globalThis.__dsnHideSecret = true; return { shown, animated };`;
    const dice = { gm: await gm.eval(DSN_READ), p1: await p1.eval(DSN_READ), p2: await p2.eval(DSN_READ) };
    const asAiko = r => r.shown.length === 1 && r.shown[0][0] === p1.userId && r.shown[0][1] === rollRes.total;
    check("DICE: Aiko's drawn roll is thrown on her screen and the GM's as her dice, never as the GM's, and not on p2's - Dice So Nice's own decision animates it nowhere",
        Boolean(rollRes.id) && asAiko(dice.p1) && asAiko(dice.gm) && dice.p2.shown.length === 0 && [dice.gm, dice.p1, dice.p2].every(r => r.animated === false),
        JSON.stringify(dice));

    /* WITHOUT DICE SO NICE (E08+E28 C13; LIVE-E28-02 is the table's reading). p1 and p2 lose
       `game.dice3d` (put back after) and Aiko throws a second statistic. The GM's message is muted
       (dhRoll.mjs:151, as the harness's `toMessage` writes it), so the roller hears the dice from
       the draw's answer (roll-draw.mjs `playDice`) and reads the result on her own copy; p2 hears
       nothing and reads nothing. Every sound a browser plays is kept for the window (`__sounds`). */
    const NO_DSN = `globalThis.__dice3dAway = game.dice3d; delete game.dice3d; globalThis.__sounds = [];
        if (!globalThis.__soundsOn) {
            globalThis.__soundsOn = true;
            const H = foundry.audio.AudioHelper, play = H.play;
            H.play = function (data, ...rest) { globalThis.__sounds?.push(String(data?.src ?? "")); return play.call(this, data, ...rest); };
        }
        return true;`;
    for (const c of [p1, p2]) await c.eval(NO_DSN);
    const quiet = await p1.eval(`const cfg = await game.actors.get("${ids.aiko}").rollTrait("instinct", {});
        return { id: cfg?.message?.id ?? null, total: cfg?.message?.rolls?.[0]?.total ?? null };`, { timeout: 60000 });
    await settle(400);
    const QUIET_READ = `const m = game.messages.get(${JSON.stringify(quiet.id)});
        const out = { heard: globalThis.__sounds.filter(s => s === CONFIG.sounds.dice).length, readable: Boolean(m?.isContentVisible), total: m?.rolls?.[0]?.total ?? null };
        game.dice3d = globalThis.__dice3dAway; delete globalThis.__dice3dAway; globalThis.__sounds = null;
        return out;`;
    const heard = { p1: await p1.eval(QUIET_READ), p2: await p2.eval(QUIET_READ) };
    check("DICE: without Dice So Nice Aiko hears the dice of her drawn roll once and reads its result; p2 hears nothing and reads nothing",
        Boolean(quiet.id) && heard.p1.heard === 1 && heard.p1.readable && heard.p1.total === quiet.total && heard.p2.heard === 0 && !heard.p2.readable,
        JSON.stringify({ quiet, heard }));

    /* A ROLL'S CLAIM IS ITS OWN (E08+E28 C11, 04.10.2026; audit S02-45). The module claims the
       card of a roll it throws as the card is created, and until C11 it claimed the first roll
       card p1's browser created while its roll was in flight - so a statistic Aiko clicked on
       her sheet while a Work on Project window stood open lost its card, and the project's roll
       kept Daggerheart's. The window is held by Aiko's `rollTrait` standing in for it, the sheet
       roll thrown meanwhile, then the window let go; both cards read as the GM's browser holds
       them: the sheet's kept, the project's claimed and emptied. Since E08+E28 C13 the GM draws
       the sheet's roll too, and writes it naming nobody - its card kept, not hidden. The Work is
       paid for first, as the action pays before its roll: since fix r2-H1 the GM draws a roll
       only for an action whose payment it saw. */
    const twoRolls = await p1.eval(`
        const A = await import("${repoUrl}/scripts/action-rolls.mjs");
        const actor = game.actors.get("${ids.aiko}");
        const { spendAction, actionsLeft } = await import("${repoUrl}/scripts/actions.mjs");
        const { trustedWrite } = await import("${repoUrl}/scripts/resource-guard.mjs");
        if (actionsLeft(actor) < 1) await trustedWrite(actor, { "system.resources.actions.value": 1 }, { reason: "gmRuling" });
        await spendAction(actor, 1, { quiet: true });
        const thrown = actor.rollTrait;
        let held = false, letGo = null;
        const shut = new Promise(resolve => { letGo = resolve; });
        globalThis.__forceRoll = { hope: 9, fear: 4 };
        actor.rollTrait = async (dh, config) => { held = true; await shut; return thrown.call(actor, dh, config); };
        try {
            const pending = A.rollTrait(actor, "body", { remember: false, actionKey: "project", title: game.i18n.localize("DRPG.Roll.project") });
            const end = Date.now() + 6000;
            while (!held && Date.now() < end) await new Promise(r => setTimeout(r, 50));
            const sheet = held ? (await thrown.call(actor, "agility", {}))?.message?.id ?? null : null;
            letGo();
            const project = (await pending)?.raw?.message?.id ?? null;
            return { held, sheet, project };
        } finally { letGo(); delete actor.rollTrait; }
    `, { timeout: 60000 });
    await settle(400);
    const twoOnGm = await gm.eval(`
        const read = id => { const m = game.messages.get(id); return m ? { claimed: Boolean(m.getFlag("${MOD}", "supersededRoll")), drawn: m.getFlag("${MOD}", "drawn") === true, actor: m.speaker?.actor ?? null } : null; };
        return { sheet: read(${JSON.stringify(twoRolls.sheet)}), project: read(${JSON.stringify(twoRolls.project)}) };
    `);
    check("PRIVACY: a statistic Aiko throws off her sheet while a Work on Project window is open keeps its card, and the project's roll is the one claimed (S02-45)",
        twoRolls.held === true && twoOnGm.sheet?.claimed === false && twoOnGm.sheet.drawn && twoOnGm.sheet.actor === null
            && twoOnGm.project?.claimed === true && twoOnGm.project.actor === null,
        JSON.stringify({ twoRolls, twoOnGm }));

    /* WHO HEADS A DRAWN STATISTIC'S CARD (E08+E28 fix r2-H4, 05.10.2026; review S2-2; the owner's note of
       27.09: the card shows the roller's character to everyone allowed, and nobody is ever shown "the GM
       rolled"). The GM's message names no actor, so Daggerheart heads its card with its author, the GM;
       each browser that reads it draws the header again with Aiko (private-rolls.mjs `signAsRoller`). Cards
       are drawn by `renderHTML`, the harness's model of Daggerheart 2.10.5's header (client-entry.mjs), with
       Aiko given a portrait of her own for the phase. p1 draws her card the moment the GM's message arrives,
       as her log does while the draw is still out (her open claim), and again after the answer; the GM and
       p2 after it. Then with rolls not forced private every browser reads the card, and p2 learns whose it
       is from the GM's `dice.show`, which asks p2's log to draw the card again (`__chatRedrawn`). */
    phase("a drawn statistic's header");
    const PORTRAIT = "icons/svg/skull.svg";
    await gm.eval(`const a = game.actors.get("${ids.aiko}"); globalThis.__headImg = a.img; await a.update({ img: "${PORTRAIT}" }); return true;`);
    await settle(200);
    const HEAD = `async m => {
        if (!m) return null;
        const li = await m.renderHTML();
        const text = s => li.querySelector(s)?.textContent.trim() ?? null;
        return { hidden: li.style.display === "none", portrait: li.querySelector(".message-header .portrait img")?.getAttribute("src") ?? null,
            heading: text(".message-header-main > h4"), line: text(".message-header .subtitle .name") };
    }`;
    const ROLL_HEADED = trait => `
        const head = ${HEAD};
        let first = null;
        const hook = Hooks.on("createChatMessage", m => { if (!first && m.getFlag("${MOD}", "drawn")) first = head(m); });
        try {
            const cfg = await game.actors.get("${ids.aiko}").rollTrait("${trait}", {});
            return { id: cfg?.message?.id ?? null, first: await first };
        } finally { Hooks.off("createChatMessage", hook); }`;
    const HEAD_OF = id => `return await (${HEAD})(game.messages.get(${JSON.stringify(id)}));`;
    const headed = await p1.eval(ROLL_HEADED("presence"), { timeout: 60000 });
    await settle(400);
    const heads = { p1: await p1.eval(HEAD_OF(headed.id)), gm: await gm.eval(HEAD_OF(headed.id)), p2: await p2.eval(HEAD_OF(headed.id)) };
    const aikos = h => h?.hidden === false && h.portrait === PORTRAIT && h.heading === "Aiko Hoshino" && h.line === "";
    check("PRIVACY: Aiko's drawn statistic is headed by Aiko on her screen - as it arrives and after - and on the GM's, never by the GM; p2 is drawn no card (S2-2)",
        Boolean(headed.id) && aikos(headed.first) && aikos(heads.p1) && aikos(heads.gm) && heads.p2?.hidden === true,
        JSON.stringify({ headed, heads }));
    await gm.eval(`await game.settings.set("${MOD}", "forcePrivateRolls", false); return true;`);
    await p2.eval(`globalThis.__chatRedrawn = []; return true;`);
    await settle(200);
    const open = await p1.eval(ROLL_HEADED("finesse"), { timeout: 60000 });
    await settle(400);
    const onP2Open = await p2.eval(`const h = await (${HEAD})(game.messages.get(${JSON.stringify(open.id)}));
        return { ...h, redrawn: (globalThis.__chatRedrawn ?? []).filter(id => id === ${JSON.stringify(open.id)}).length };`);
    await gm.eval(`await game.settings.set("${MOD}", "forcePrivateRolls", true);
        await game.actors.get("${ids.aiko}").update({ img: globalThis.__headImg }); return true;`);
    await settle(200);
    check("PRIVACY: with rolls not forced private p2 reads Aiko's drawn statistic headed by Aiko, as the GM's dice packet names her, and its log draws it again (S2-2)",
        Boolean(open.id) && aikos(onP2Open) && onP2Open.redrawn === 1, JSON.stringify({ open, onP2Open }));

    /* THE ROLLER'S COPY IS THE GM'S ROLL (E29 C10, 05.10.2026; the stage plan's 3.6; the owner's Q1 (a)). Aiko's window puts
       on a bonus the GMs do not hold - p1's own configuration hook adds 5 to her roll, as a bonus field would, and lists it
       among the roll's modifiers - and she throws a statistic from her sheet, which the GM draws (roll-draw.mjs `legalRollOf`)
       and her browser plays back (`rollerCopyOf`). Read on p1: what her browser holds of the roll (`config.roll`'s total and
       modifiers, the message's total); on the GM: the record's total, flat sums and flags, and the roller's line; on p1 and
       p2: whether the words of a card since the roll say that line. Until C10 her browser read the 5 in its modifiers and the
       GM counted it. */
    phase("a drawn roll's claim");
    const claimHad = { p1: await p1.eval(`return game.messages.contents.map(m => m.id);`), p2: await p2.eval(`return game.messages.contents.map(m => m.id);`) };
    const claimRoll = await p1.eval(`
        const actor = game.actors.get("${ids.aiko}");
        const force = globalThis.__forceRoll;
        globalThis.__forceRoll = { hope: 7, fear: 4 };
        const T = foundry.dice.terms;
        const hook = Hooks.on(game.system.id + ".postDualityRollConfiguration", (roll, config) => {
            roll.terms.push(new T.OperatorTerm({ operator: "+" }), new T.NumericTerm({ number: 5 }));
            config.roll = { ...(config.roll ?? {}), modifiers: [...(config.roll?.modifiers ?? []), { label: "C10 a window's bonus", value: 5 }] };
        });
        try {
            const cfg = await actor.rollTrait("instinct", {});
            return { id: cfg?.message?.id ?? null, total: cfg?.roll?.total ?? null, modifiers: (cfg?.roll?.modifiers ?? []).map(m => m?.value),
                message: cfg?.message?.rolls?.[0]?.total ?? null };
        } finally { Hooks.off(game.system.id + ".postDualityRollConfiguration", hook); globalThis.__forceRoll = force; }`, { timeout: 60000 });
    await settle(400);
    const claimOnGm = await gm.eval(`const D = await import("${repoUrl}/scripts/roll-draw.mjs");
        const row = D.drawnRecordOf(game.messages.get(${JSON.stringify(claimRoll.id)}));
        return row ? { total: row.total, claim: row.claim?.flat ?? null, scored: row.scored?.flat ?? null, flags: (row.flags ?? []).map(f => f.kind),
            told: typeof D.rollerLine === "function" ? D.rollerLine(row) : null,
            instinct: Number(game.actors.get("${ids.aiko}")?.system?.traits?.instinct?.value) || 0 } : null;`);
    const heardClaim = (client, had) => client.eval(`const { wordsOf } = await import("${repoUrl}/scripts/secret.mjs");
        const told = ${JSON.stringify(claimOnGm?.told ?? null)};
        if (!told) return null;
        for (const m of game.messages.contents.filter(m => !${JSON.stringify(had)}.includes(m.id))) {
            if (String(await wordsOf(m, 1500) ?? "").includes(foundry.utils.escapeHTML(told))) return true;
        }
        return false;`);
    const claimHeard = { p1: await heardClaim(p1, claimHad.p1), p2: await heardClaim(p2, claimHad.p2) };
    const v = claimOnGm?.instinct ?? null;
    check("ROLLS: Aiko's browser reads the roll the GM threw - a 5 her window put on and the GMs do not hold is not counted, not in her modifiers, and told to her alone",
        Boolean(claimRoll.id) && Boolean(claimOnGm) && claimRoll.total === 7 + 4 + v && claimRoll.message === claimRoll.total && claimOnGm.total === claimRoll.total
        && JSON.stringify(claimRoll.modifiers) === JSON.stringify([v]) && claimOnGm.claim === v + 5 && claimOnGm.scored === v
        && claimOnGm.flags.includes("modifier") && claimHeard.p1 === true && claimHeard.p2 === false,
        JSON.stringify({ claimRoll, claimOnGm, claimHeard }));

    // --- inventory carry limit (Gear = 2 shared slots) ---
    phase("inventory");
    const inv = await gm.eval(`
        const INV = await import("${repoUrl}/scripts/inventory.mjs");
        const actor = game.actors.get("${ids.botan}");
        for (const it of actor.items.contents.filter(i => i.name.startsWith("L3"))) await it.delete();
        const a = await INV.grantItem(actor, { name: "L3 knife", category: "crimeTool", tier: 1 });
        const b = await INV.grantItem(actor, { name: "L3 mop", category: "cleaningTool", tier: 1 });
        const c = await INV.grantItem(actor, { name: "L3 wrench", category: "tool", tier: 1 });
        const carried = actor.items.contents.filter(i => (i.getFlag("${MOD}","location") ?? "carried") === "carried" && i.name.startsWith("L3")).length;
        return { a: !!a, b: !!b, cWasBlocked: !c, carried,
                 notif: globalThis.__notifications.slice(-2).map(n => n.level+":"+n.msg) };
    `, { timeout: 60000 });
    check("INVENTORY: Gear limit of 2 is enforced (3rd blocked or stashed)", inv.carried <= 2, JSON.stringify(inv));

    // --- movement / search tokens per room ---
    phase("movement");
    const search = await gm.eval(`
        const st = await import("${repoUrl}/scripts/search-tokens.mjs");
        const M = await import("${repoUrl}/scripts/movement.mjs");
        const room = M.roomOfActor(game.actors.get("${ids.aiko}"));
        let tokens = null;
        try { tokens = game.drpg.searchTokens ? game.drpg.searchTokens(room) : null; } catch (e) { tokens = "err:"+e.message; }
        return { room, tokens, allRooms: game.drpg.allRooms() };
    `, { timeout: 60000 });
    check("MOVEMENT: player's room resolved + search tokens present", !!search.room, JSON.stringify(search).slice(0, 300));

    // --- anonymity audit (module's own) ---
    phase("anonymity");
    const anon = await gm.eval(`
        try { const r = game.drpg.auditAnonymity ? await game.drpg.auditAnonymity() : "no-fn"; return typeof r === "object" ? JSON.stringify(r).slice(0,300) : String(r); }
        catch (e) { return "threw:" + e.message; }
    `, { timeout: 60000 });
    check("ANONYMITY: self-audit runs", !String(anon).startsWith("threw"), String(anon));

    // --- a sheet that is not yours (E05 C15, S03-06) ---
    // p2 opens Aiko's sheet (p1's) with a Call armed on it. The harness registers no
    // Daggerheart sheet, so the module's two render hooks are called on a bare frame, in
    // Foundry's order (the class's own, then ActorSheetV2's): what they draw is what the
    // viewer gets. The redacted pips kept "1 of 2 actions ..." and "Free Move used" as
    // tooltips, and the stack beside them showed the armed Call. p1, the owner, draws the
    // same frame first, so the check is shown able to see a stack and a tooltip. Two
    // layers hold it, and each is read alone too, because either one hides the other's
    // absence: sheet.mjs draws a viewer none of the three (the class's hook alone), and
    // anonymity.mjs strips them from a frame another hand drew them on (ActorSheetV2's alone).
    phase("a sheet that is not yours");
    await gm.eval(`
        const a = game.actors.get("${ids.aiko}");
        globalThis.__c15Call = a.getFlag("${MOD}", "pendingCall") ?? null;
        await a.setFlag("${MOD}", "pendingCall", [{ kind: "hope", key: "experience", grants: "experience" }]);
        return true;`, { timeout: 60000 });
    await settle(600);
    const DRAWN = '<div class="drpg-actions-section"><div class="drpg-actions">'
        + '<span class="drpg-action-pip" data-tooltip="planted: 1 of 2" aria-label="planted: 1 of 2"></span>'
        + '<span class="drpg-free-move" data-tooltip="planted: Free Move used"></span></div>'
        + '<div class="drpg-pending-stack"><div class="drpg-pending-call" data-tooltip="planted: a Call"></div></div></div>';
    const drawSheet = (hooks, drawn = "") => `
        const a = game.actors.get("${ids.aiko}");
        const root = document.createElement("div");
        root.innerHTML = '<div class="character-header-sheet"><div class="character-row"><div class="resource-section"></div>${drawn}</div></div>';
        document.body.append(root);
        const app = { document: a, element: root };
        try {
            for (const hook of ${JSON.stringify(hooks)}) Hooks.callAll(hook, app, root, {}, { isFirstRender: true });
            return {
                owner: a.testUserPermission(game.user, "OWNER"),
                enforced: game.settings.get("${MOD}", "enforceAnonymity"),
                pips: root.querySelectorAll(".drpg-action-pip").length,
                tips: [...root.querySelectorAll(".drpg-action-pip, .drpg-free-move")]
                    .map(el => el.dataset.tooltip ?? el.getAttribute("aria-label")).filter(Boolean),
                calls: root.querySelectorAll(".drpg-pending-call, .drpg-pending-stack").length
            };
        } finally { root.remove(); }`;
    const BOTH = ["renderCharacterSheet", "renderActorSheetV2"];
    const own = await p1.eval(drawSheet(BOTH), { timeout: 60000 });
    const other = await p2.eval(drawSheet(BOTH), { timeout: 60000 });
    const sheetAlone = await p2.eval(drawSheet(["renderCharacterSheet"]), { timeout: 60000 });
    const redactAlone = await p2.eval(drawSheet(["renderActorSheetV2"], DRAWN), { timeout: 60000 });
    await gm.eval(`
        const a = game.actors.get("${ids.aiko}");
        if (globalThis.__c15Call) await a.setFlag("${MOD}", "pendingCall", globalThis.__c15Call);
        else await a.unsetFlag("${MOD}", "pendingCall");
        return true;`, { timeout: 60000 });
    const bare = r => r?.owner === false && r.pips > 0 && r.tips.length === 0 && r.calls === 0;
    check("SHEET: p1, Aiko's owner, sees the Call armed on their own sheet and the pips' tooltips",
        own?.owner === true && own.pips > 0 && own.calls > 0 && own.tips.length > 0, JSON.stringify(own));
    check("SHEET: p2 opening p1's sheet finds no tooltip text and no Call stack (S03-06)", bare(other), JSON.stringify(other));
    check("SHEET: each layer holds alone - the sheet draws p2 none, the redaction strips what another hand drew",
        bare(sheetAlone) && redactAlone?.enforced === true && bare(redactAlone), JSON.stringify({ sheetAlone, redactAlone }));

    // errors?
    for (const c of [gm, p1, p2]) {
        const errs = await c.eval(`return (globalThis.__errors ?? []).slice(0,5);`);
        check(`${c.who}: no uncaught errors (L3)`, (errs ?? []).length === 0, JSON.stringify(errs).slice(0,200));
    }
}
