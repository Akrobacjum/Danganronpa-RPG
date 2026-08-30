export async function run({ gm, check }) {
    const out = await gm.eval(`
        const p = await Playlist.create({ name: "PS", sounds: [{ name: "A", path: "x.wav" }] });
        const s = p.sounds.contents[0];
        const r = await p.playSound(s);
        return { hasSound: !!s, updRet: r?._doc ?? typeof r, playing: p.sounds.contents[0].playing,
                 raw: p._source.sounds?.[0]?.playing, same: p === game.playlists.get(p.id) };
    `);
    check("playSound micro", true, JSON.stringify(out));
}
