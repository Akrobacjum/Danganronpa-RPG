export async function run({ gm, check }) {
    const out = await gm.eval(`
        const floor = await import("file:///home/user/Danganronpa-RPG/scripts/trial-floor.mjs");
        const MU = await import("file:///home/user/Danganronpa-RPG/scripts/music.mjs");
        const { SETTINGS, setSetting } = await import("file:///home/user/Danganronpa-RPG/scripts/settings.mjs");
        const { setClock } = await import("file:///home/user/Danganronpa-RPG/scripts/clock.mjs");
        await game.settings.set("danganronpa-rpg", SETTINGS.musicEnabled, true);
        const playlist = await Playlist.create({
            name: "Probe objection fixture",
            sounds: [{ name: "S1", path: "sounds/lock.wav" }, { name: "S2", path: "sounds/notify.wav" }]
        });
        await setSetting(SETTINGS.musicMap, { "trial.objection": playlist.id });
        const cast = game.actors.filter(a => a.type === "character").slice(0, 3);
        await setClock({ phase: "classTrial" });
        const started = await floor.startFloor();
        await new Promise(r => setTimeout(r, 200));
        const opened = await floor.openObjection(cast[0].id, cast[1].id);
        await new Promise(r => setTimeout(r, 600));
        return {
            started: !!started, opened: !!opened,
            status: MU.musicStatus(),
            soundsPlaying: playlist.sounds.contents.map(s => ({ n: s.name, p: s.playing })),
            playlistPlaying: playlist.playing
        };
    `, { timeout: 60000 });
    check("music debug", true, JSON.stringify(out).slice(0, 1400));
}
