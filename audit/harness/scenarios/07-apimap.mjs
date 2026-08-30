export async function run({ gm, check }) {
    await gm.eval(`
        const fs = await import("node:fs");
        fs.writeFileSync("/tmp/drpg-api-keys.json", JSON.stringify(Object.keys(game.drpg).sort()));
        return true;
    `);
    check("api keys dumped", true, "");
}
