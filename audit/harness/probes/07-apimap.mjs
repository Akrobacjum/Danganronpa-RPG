/** The game.drpg key list, sorted: what the api hands a booted client. */
export const layers = ["probe"];

export async function run({ gm, note }) {
    // Returned rather than written to /tmp from inside the GM's client: the cluster
    // keeps it as this probe's evidence, in results/probes/07-apimap.json.
    const keys = await gm.eval(`return Object.keys(game.drpg).sort();`);
    note("game.drpg keys", `${keys.length}; the list is under evidence.keys in this probe's results file`);
    return { keys };
}
