/** Replicate the two stubborn suite scenarios standalone, step by step. */
export async function run({ gm, check, settle }) {
    // A) equipment loop - exactly like the suite
    const equip = await gm.eval(`
        const INV = await import("file:///home/user/Danganronpa-RPG/scripts/inventory.mjs");
        const { EQUIPPABLE } = await import("file:///home/user/Danganronpa-RPG/scripts/config.mjs");
        const { studentActors } = await import("file:///home/user/Danganronpa-RPG/scripts/monokuma.mjs");
        const actor = studentActors()[0];
        const out = { actor: actor?.name, made: [], failedAt: null, notif: [] };
        const n0 = globalThis.__notifications.length;
        for (const category of EQUIPPABLE) {
            const item = await INV.grantItem(actor, { name: "SUITE " + category, category, tier: 1 });
            if (!item) { out.failedAt = category; break; }
            out.made.push(category);
        }
        out.notif = globalThis.__notifications.slice(n0).map(n => n.level + ":" + n.msg);
        for (const it of actor.items.contents.filter(i => i.name.startsWith("SUITE "))) await it.delete();
        return out;
    `, { timeout: 60000 });
    check("standalone: equipment loop all categories", equip.failedAt === null, JSON.stringify(equip).slice(0, 700));

    // B) objection music - exactly like the suite
    const obj = await gm.eval(`
        const floor = await import("file:///home/user/Danganronpa-RPG/scripts/trial-floor.mjs");
        const { SETTINGS, getSetting, setSetting } = await import("file:///home/user/Danganronpa-RPG/scripts/settings.mjs");
        const { setClock } = await import("file:///home/user/Danganronpa-RPG/scripts/clock.mjs");
        await game.settings.set("danganronpa-rpg", SETTINGS.musicEnabled, true);
        const playlist = await Playlist.create({
            name: "Probe objection fixture",
            sounds: [{ name: "S1", path: "sounds/lock.wav" }, { name: "S2", path: "sounds/notify.wav" }]
        });
        await setSetting(SETTINGS.musicMap, { "trial.objection": playlist.id });
        const cast = game.actors.filter(a => a.type === "character").slice(0, 3);
        const n0 = globalThis.__notifications.length;
        await setClock({ phase: "classTrial" });
        await floor.startFloor();
        await new Promise(r => setTimeout(r, 300));
        await floor.openObjection(cast[0].id, cast[1].id);
        await new Promise(r => setTimeout(r, 500));
        const playing = playlist.sounds.contents.filter(s => s.playing).map(s => s.name);
        return { playing, notif: globalThis.__notifications.slice(n0).map(n => n.level + ":" + n.msg).slice(0, 6) };
    `, { timeout: 60000 });
    check("standalone: objection starts a track", (obj.playing ?? []).length > 0, JSON.stringify(obj).slice(0, 700));
    await settle(200);
}
