/** Probe: precise causes of remaining suite failures. */
export async function run({ gm, check }) {
    const rooms = await gm.eval(`
        const M = await import("file:///home/user/Danganronpa-RPG/scripts/movement.mjs");
        const scene = game.scenes.find(s => s.active);
        const toks = scene.tokens.contents.map(t => ({ name: t.name, room: M.roomOfToken(t) }));
        return { allRooms: M.allRooms(scene), toks };
    `);
    check("probe: rooms", true, JSON.stringify(rooms));

    const grant = await gm.eval(`
        const INV = await import("file:///home/user/Danganronpa-RPG/scripts/inventory.mjs");
        const actor = game.actors.getName("Aiko Hoshino");
        try {
            const item = await INV.grantItem(actor, { name: "PROBE tool", category: "tool", tier: 1 });
            return { ok: !!item, item: item ? { id: item.id, name: item.name, flags: item.flags } : null,
                     notif: globalThis.__notifications.slice(-3) };
        } catch (err) { return { threw: err.stack?.slice(0, 600) }; }
    `);
    check("probe: grantItem tool", true, JSON.stringify(grant).slice(0, 900));

    const music = await gm.eval(`
        const MU = await import("file:///home/user/Danganronpa-RPG/scripts/music.mjs");
        return { states: Object.keys(MU.MUSIC_STATES ?? {}), map: MU.musicMap?.() ?? null,
                 playlists: game.playlists.contents.map(p => p.name) };
    `);
    check("probe: music", true, JSON.stringify(music).slice(0, 900));

    const secretDispatch = await gm.eval(`
        const src = await fetch("/modules/danganronpa-rpg/scripts/secret.mjs").then(r => r.text());
        const at = src.indexOf("dispatchEvent");
        return src.slice(Math.max(0, at - 300), at + 200);
    `);
    check("probe: secret dispatchEvent context", true, JSON.stringify(secretDispatch));
}
