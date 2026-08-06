/**
 * Danganronpa RPG — the in-world handbook.
 * ---------------------------------------------------------------------------
 * Every feature this module adds is documented here, as a Journal the GM can
 * open at the table. Built from the live configuration, so the numbers in the
 * text are the numbers the code actually uses.
 *
 * Rebuild it after an update with: game.drpg.installHandbook({ overwrite: true })
 */

import { MODULE_ID, ACTIONS, ITEM_CATEGORIES, PROJECT_SCALE, STARTING, REST, HOPE_CALLS, DESPAIR_CALLS } from "./config.mjs";
import { ITEM_POOLS } from "./tables.mjs";
import { log } from "./utils.mjs";

const JOURNAL_NAME = "Danganronpa RPG — Handbook";

/**
 * Create (or refresh) the handbook journal.
 * @param {object} [options]
 * @param {boolean} [options.overwrite]  Replace an existing handbook.
 */
export async function installHandbook({ overwrite = false } = {}) {
    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }

    const existing = game.journal.getName(JOURNAL_NAME);
    if (existing && !overwrite) {
        existing.sheet.render(true);
        return existing;
    }
    if (existing && overwrite) await existing.delete();

    let folder = game.folders.find(f => f.type === "JournalEntry" && f.name === "Danganronpa RPG");
    if (!folder) {
        folder = await Folder.create({ name: "Danganronpa RPG", type: "JournalEntry", color: "#9d4edd" });
    }

    const journal = await JournalEntry.create({
        name: JOURNAL_NAME,
        folder: folder.id,
        ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE },
        pages: buildPages()
    });

    log("Handbook installed.");
    ui.notifications.info(game.i18n.localize("DRPG.Handbook.installed"));
    journal?.sheet.render(true);
    return journal;
}

function page(name, html) {
    return { name, type: "text", title: { show: true, level: 1 }, text: { content: html, format: 1 } };
}

function buildPages() {
    return [
        page("1 · Setting up a season", setupPage()),
        page("2 · Rooms and the map", roomsPage()),
        page("3 · The GM panel", panelPage()),
        page("4 · Actions", actionsPage()),
        page("5 · Items and where to add your own", itemsPage()),
        page("6 · Projects", projectsPage()),
        page("7 · Remnants and Truth Bullets", remnantsPage()),
        page("8 · Despair and dividing the students", despairPage()),
        page("9 · Hope Calls and Despair Calls", callsPage()),
        page("10 · Console reference", consolePage())
    ];
}

/* ==========================================================================
 * PAGES
 * ========================================================================== */

function setupPage() {
    return `
    <h2>Finding the GM panel</h2>
    <p>Almost every control in this module lives behind one button. Here is exactly where it is:</p>
    <ol>
        <li>Look at the <strong>left edge of the screen</strong>, at the vertical strip of icons — the
            scene controls, where you switch between tokens, walls, lighting and so on.</li>
        <li>Click the <strong>token icon</strong> at the top (a person's head and shoulders). That opens
            the token tools underneath it.</li>
        <li>In that list of tools you will find a <strong>clock face icon</strong>
            (<i class="fa-solid fa-clock"></i>). That is the <strong>GM panel</strong>. Only GMs see it.</li>
    </ol>
    <p>Throughout this handbook, "GM panel" always means that clock icon. Inside it, the
       <strong>More…</strong> button holds the setup jobs you do rarely.</p>

    <h2>Setting up a season, step by step</h2>
    <ol>
        <li><strong>Draw the rooms.</strong> In the same left-hand strip of icons, find the
            <strong>Regions</strong> layer. Draw a shape over each room and <strong>give it a name</strong>
            ("Library", "Kitchen", "Dormitory"). An unnamed region does not count as a room.
            <br><em>Why it matters:</em> the module works out which room someone is in from these shapes.
            Searching, resting, projects and movement costs all depend on them.
            <br>The guide suggests about <em>players × 1.5</em> rooms.</li>

        <li><strong>Say which rooms allow rest.</strong> GM panel → <em>More…</em> →
            <em>Choose which rooms allow rest</em>. Two tick boxes per room: Short Rest for common rooms,
            Long Rest for bedrooms. You do this once per scene.</li>

        <li><strong>Create the item tables.</strong> GM panel → <em>More…</em> → <em>Create item tables</em>.
            Until you click this, no item tables exist. See page 5.</li>

        <li><strong>Divide the students between GMs.</strong> Look at the <strong>top of the screen</strong>:
            there is a purple bar of skulls, one row per GM. On the right of it is a
            <strong>gear icon</strong>. Click it, then <em>Split evenly</em>. See page 8.</li>

        <li><strong>Set the clock.</strong> Below the Despair bar is the campaign HUD — campaign name,
            chapter, day, phase, time of day. Its <strong>gear icon</strong> edits all of it.</li>

        <li><strong>Prepare each character.</strong> Select the character's token, then press
            <strong>F12</strong> to open the browser console and paste:
            <br><code>game.drpg.initCharacter(canvas.tokens.controlled[0].actor)</code>
            <br>That sets HP ${STARTING.hp}, Stress ${STARTING.stress} and Hope ${STARTING.hope}.
            Then type their Ultimate in the field under their name on the sheet.</li>
    </ol>`;
}

function roomsPage() {
    return `
    <h2>Rooms are Scene Regions</h2>
    <p>Everything room-related reads from the Regions layer: which room a character is in, where
       they can search, which projects they can work on, and where they can rest.</p>
    <ol>
        <li>Open the scene, pick the <strong>Regions</strong> layer in the left toolbar.</li>
        <li>Draw a shape over the room and <strong>give it a name</strong> — "Library", "Kitchen",
            "Dormitory". Unnamed regions are ignored.</li>
        <li>Repeat per room. Overlapping regions are allowed but the first name wins.</li>
    </ol>
    <h3>Movement</h3>
    <p>Players just drag their token. Moving <em>inside</em> a room is free. Crossing into another room
       spends the free Move for that time of day; after that each crossing costs an action. Turn this
       off in module settings (<em>Crossing rooms costs a Move</em>) if you would rather do it by hand.</p>
    <h3>Rest rooms</h3>
    <p>GM panel → <em>More…</em> → <em>Choose which rooms allow rest</em>. Two tick boxes per room:
       Short Rest, and Long Rest (bedrooms). A room with neither offers no rest.</p>
    <p><em>No regions on the scene?</em> The dialog will say so — draw them first.</p>`;
}

function panelPage() {
    return `
    <h2>Where everything lives</h2>
    <p>Four places, and that is all:</p>
    <table>
        <thead><tr><th>Where to look</th><th>What it is</th><th>What it does</th></tr></thead>
        <tbody>
            <tr><td><strong>Left edge</strong> → token tools → <strong>clock icon</strong></td>
                <td>GM panel (GM only)</td>
                <td>Advance the time of day, edit the clock, and everything under <em>More…</em></td></tr>
            <tr><td><strong>Top centre of the screen</strong>, upper bar of purple skulls</td>
                <td>Despair</td>
                <td>One row per GM. Its gear divides the students between GMs.</td></tr>
            <tr><td><strong>Top centre</strong>, just below that</td>
                <td>Campaign HUD</td>
                <td>Campaign, chapter, day, phase, time of day. Arrows step the time of day; the gear edits everything.</td></tr>
            <tr><td><strong>Projects tray</strong> (the countdown tray)</td>
                <td>Projects</td>
                <td>Its gear creates projects and sets rooms and secrecy.</td></tr>
        </tbody>
    </table>
    <h3>GM panel → More…</h3>
    <ul>
        <li><strong>Refill everyone's actions</strong> — normally automatic when the time of day advances.</li>
        <li><strong>Restock search tokens</strong> — likewise.</li>
        <li><strong>Show search tokens</strong> — which rooms have been searched out.</li>
        <li><strong>Create item tables</strong> — see page 5.</li>
        <li><strong>Choose which rooms allow rest</strong> — see page 2.</li>
        <li><strong>List Remnants</strong> — every Remnant on the scene with who left it, doing what, and when.</li>
        <li><strong>Clear Faint Remnants</strong> — run at the end of a chapter. Removes Faint Remnants
            that are not reinforced, exactly as the guide requires.</li>
        <li><strong>Audit sheet anonymity</strong> — who can read whose character sheet.</li>
    </ul>

    <h3>What players can and cannot touch</h3>
    <p>Two module settings, both on by default (<em>Configure Settings → Module Settings →
       Danganronpa RPG</em>):</p>
    <ul>
        <li><strong>Players cannot edit Actions, Hope or traits.</strong> Those move through play — spend
            an action, take a rest, earn an advancement. HP and Stress stay editable, because players mark
            their own damage constantly.</li>
        <li><strong>Players only see who is in their room.</strong> Other characters' tokens are hidden
            unless they share a room region with you.</li>
    </ul>
    <p>Character sheets are private by design: each player owns only their own. Check it any time with
       <em>More… → Audit sheet anonymity</em>.</p>
    <h3>Advancing the time of day</h3>
    <p>The <strong>▶</strong> arrow on the HUD (or <em>Next time of day</em> in the panel) refills every
       character's actions and free Move, and restocks every room's search tokens. Five times of day make
       one day, and the day counter rolls over on its own.</p>
    <p>The <strong>◀</strong> arrow is a correction for a misclick: it steps the clock back and
       deliberately refills <em>nothing</em>.</p>`;
}

function actionsPage() {
    const rows = Object.entries(ACTIONS).map(([key, def]) => `
        <tr>
            <td><i class="fa-solid ${def.icon}"></i> <strong>${def.label}</strong></td>
            <td>${def.cost === 0 ? "free" : `${def.cost} action${def.cost > 1 ? "s" : ""}`}</td>
            <td>${def.callsGm ? "GM ruling" : "automatic"}</td>
            <td>${def.hint ?? ""}</td>
        </tr>`).join("");

    return `
    <h2>Actions</h2>
    <p>Players find these as a grid at the top of the <strong>Features</strong> tab on their sheet.
       Clicking one opens a briefing explaining what it does, what it costs and where they are standing,
       before anything is spent.</p>
    <p>Each character has <strong>${STARTING.actions} actions per time of day</strong>, plus one free Move.
       A character with all HP marked drops to one action — the lost one shows as a red locked circle.</p>
    <table>
        <thead><tr><th>Action</th><th>Cost</th><th>Resolved by</th><th>What it does</th></tr></thead>
        <tbody>${rows}</tbody>
    </table>
    <h3>Which ones call you</h3>
    <p>Observe, Analyze, Listen and Direct Murder roll automatically and then whisper you the result,
       the player's question, and the relevant threshold table. Starting a new project does the same.
       Everything else resolves itself — that is the point.</p>
    <h3>Rest</h3>
    <p>One tile, two rests. Short: ${REST.short.actionCost} action, pick ${REST.short.picks}.
       Long: ${REST.long.actionCost} actions, pick ${REST.long.picks}, bedrooms only.
       The dialog shows whether the current room allows each.</p>`;
}

function itemsPage() {
    const tables = Object.entries(ITEM_POOLS).map(([cat, tiers]) => `
        <tr>
            <td><strong>${ITEM_CATEGORIES[cat]?.plural ?? cat}</strong><br>
                <small>limit ${ITEM_CATEGORIES[cat]?.limit ?? "none"}</small></td>
            ${[0, 1, 2, 3].map(t => `<td>${(tiers[t] ?? []).join("<br>") || "—"}</td>`).join("")}
        </tr>`).join("");

    return `
    <h2>Where the items live, and how to add your own</h2>

    <h3>First: create the tables</h3>
    <p>GM panel (the clock icon) → <strong>More…</strong> → <strong>Create item tables</strong>.
       <strong>Nothing exists until you click this.</strong> That is why you could not find them.</p>
    <p>It creates twelve RollTables — one per category and tier — inside a folder called
       <strong>Danganronpa RPG</strong>.</p>

    <h3>Where to find them afterwards</h3>
    <ol>
        <li>Look at the <strong>right-hand sidebar</strong> (where Chat, Actors, Items and so on live).</li>
        <li>Click the <strong>Rollable Tables</strong> tab — the icon is a small table grid
            (<i class="fa-solid fa-table-list"></i>).</li>
        <li>Open the <strong>Danganronpa RPG</strong> folder. You will see:
            <br><code>DRPG Usable Items — Tier 0</code>, <code>… Tier 1</code>, <code>… Tier 2</code>,
            <code>… Tier 3</code>, then the same for <code>Crime Tools</code> and
            <code>Cleaning Tools</code>.</li>
    </ol>

    <h3>Adding an item</h3>
    <ol>
        <li>Double-click the table for the right category and tier — for a Tier 2 murder weapon, that is
            <code>DRPG Crime Tools — Tier 2</code>.</li>
        <li>Click the <strong>+</strong> at the top of the results list.</li>
        <li>Type the item's name into the text field of the new row.</li>
        <li>Click <strong>Normalize Results</strong> (the balance-scales icon) so the number ranges cover
            the whole die evenly. <em>Skip this and your new item may never come up.</em></li>
    </ol>
    <p>Search reads your tables first, every time. The built-in list is only a fallback for when a table
       is missing. <strong>Re-running "Create item tables" never overwrites a table that already
       exists</strong>, so your edits are safe.</p>

    <h3>What about Daggerheart's own compendiums?</h3>
    <p>You will still see Daggerheart's Classes, Domains, Weapons, Armor and Adversaries in the
       <em>Compendium Packs</em> tab. <strong>This module ignores all of them</strong> — it never reads
       from them and never puts anything in them.</p>
    <p>You can leave them alone; they do no harm. If the clutter bothers you, you can hide them:</p>
    <ol>
        <li>Open the <strong>Compendium Packs</strong> tab in the right sidebar.</li>
        <li>Right-click a pack you do not want and choose <strong>Toggle Visibility</strong>, or open its
            settings and set ownership so players cannot see it.</li>
    </ol>
    <p><strong>Do not delete the system's packs.</strong> Deleting them can break Daggerheart on the next
       update, and this module gains nothing by it.</p>
    <h3>What ships by default</h3>
    <p>Only the examples the guide itself gives — it says explicitly that it "does not supply a list of
       items" and expects the GM to improvise.</p>
    <table>
        <thead><tr><th>Category</th><th>Tier 0</th><th>Tier 1</th><th>Tier 2</th><th>Tier 3</th></tr></thead>
        <tbody>${tables}</tbody>
    </table>
    <h3>Carry limits</h3>
    <p>Enforced automatically, including on drag-and-drop:
       ${Object.values(ITEM_CATEGORIES).map(c => `${c.plural} ${c.limit ?? "unlimited"}`).join(" · ")}.</p>`;
}

function projectsPage() {
    const scale = Object.values(PROJECT_SCALE)
        .map(s => `<tr><td>${s.label}</td><td>${s.progress} progress</td></tr>`).join("");

    return `
    <h2>Projects</h2>
    <p>A project is a Daggerheart <em>Countdown</em>, renamed throughout the interface to
       <strong>Projects</strong>. Everything lives in one window: the <strong>gear on the Projects
       tray</strong>.</p>
    <h3>Creating one</h3>
    <p>Gear → <strong>Create project</strong>. You set the name, the scale, the room it belongs to, and
       whether it is a secret indirect murder. Progression is set to <em>custom</em>, which means it only
       advances when a player uses <strong>Work on Project</strong> — never from attacks or rests.</p>
    <table><thead><tr><th>Scale</th><th>Target</th></tr></thead><tbody>${scale}</tbody></table>
    <h3>Rooms</h3>
    <p>A project tied to a room can only be worked on, or sabotaged, by someone standing in it. Leave the
       room blank for "anywhere".</p>
    <h3>Secret projects</h3>
    <p><strong>An indirect murder project is secret automatically.</strong> Only the killer and the GMs see
       it — a progress bar named "Prepare the poison" in everyone's sidebar would end the plot before it
       began.</p>
    <p>Gear → <strong>Share…</strong> lets someone else in, or revokes it. Players can bring in a
       co-conspirator themselves; the write is applied by the GM behind the scenes.</p>
    <h3>What an indirect murder costs the killer</h3>
    <ul>
        <li>If another player is in the room: a <strong>Shadow roll against 16</strong> to hide their intent
            before the project roll. Alone in the room instead grants <strong>+1 progress</strong>.</li>
        <li>Every project action also rolls <strong>Shadow to hide the traces</strong>, which decides how
            visible the Remnant it leaves is.</li>
    </ul>`;
}

function remnantsPage() {
    return `
    <h2>Remnants</h2>
    <p>Remnants are dropped as <strong>tokens on the map, where the character was standing</strong>. They are
       half-transparent, sorted <em>below</em> character tokens, and hidden from players until revealed.</p>
    <h3>What leaves one</h3>
    <ul>
        <li><strong>Search</strong> — when looking for crime or cleaning tools. Searching for usable items
            leaves nothing.</li>
        <li><strong>Sabotage</strong> — always, success or failure.</li>
        <li><strong>Work on Project</strong> — when the project is an indirect murder.</li>
    </ul>
    <p>The better the roll, the harder the trace is to find. Each token carries a note saying who left it
       and why — visible to you, not to players.</p>
    <h3>Revealing and removing</h3>
    <p>Select the token and un-hide it (or <code>game.drpg.revealRemnant(token.document)</code>).
       Reinforced Remnants refuse to be deleted, exactly as the guide requires.</p>
    <p>At the end of a chapter: <strong>GM panel → More… → Clear Faint Remnants</strong>.</p>
    <h3>Search tokens</h3>
    <p>Each room has ${STARTING.actions === 2 ? "three" : "three"} search tokens per time of day. They are
       spent before the roll, so a searched-out room cannot be probed by rolling anyway. They restock when
       the time of day advances.</p>`;
}

function despairPage() {
    const hope = Object.values(HOPE_CALLS)
        .map(c => `<tr><td>${c.label}</td><td>${c.cost}</td><td>${c.effect}</td></tr>`).join("");
    const despair = Object.values(DESPAIR_CALLS)
        .map(c => `<tr><td>${c.label}</td><td>${c.cost}</td><td>${c.effect}</td></tr>`).join("");

    return `
    <h2>Despair, one pool per Monokuma</h2>
    <p>Daggerheart has a single shared Fear pool; the guide wants one per GM, capped at
       ${STARTING.despairMax}. The bar at the top of the screen shows a row per <strong>full
       Gamemaster</strong> — Assistant GMs deliberately get no pool.</p>
    <h3>Dividing the students</h3>
    <p><strong>Gear on the Despair bar.</strong> One dropdown per student. <em>Split evenly</em> divides the
       roster; <em>— nobody —</em> keeps a student out of every pool, which is what you want for a
       Mastermind or a template actor.</p>
    <p>This matters because <strong>a roll that lands with Despair feeds that student's Monokuma</strong>,
       automatically.</p>
    <h3>Hope Calls</h3>
    <table><thead><tr><th>Call</th><th>Hope</th><th>Effect</th></tr></thead><tbody>${hope}</tbody></table>
    <h3>Despair Calls</h3>
    <table><thead><tr><th>Call</th><th>Despair</th><th>Effect</th></tr></thead><tbody>${despair}</tbody></table>
    <p>Spend one with <code>game.drpg.spendDespairCall(userId, "obstacle")</code>, or just click the pips
       down by hand. After a wrong vote the guide fills every pool:
       <code>game.drpg.fillAllDespair()</code>.</p>`;
}

/**
 * How the two spending menus behave now that they apply themselves. Written out
 * per Call, because "it is automated" is not an instruction — the table needs to
 * know which button they press and what will happen without them.
 */
function callsPage() {
    const row = ([key, c]) => `
        <tr>
            <td><strong>${c.label}</strong></td>
            <td>${c.cost}</td>
            <td>${effectOf(c)}</td>
        </tr>`;

    const hope = Object.entries(HOPE_CALLS).map(row).join("");
    const despair = Object.entries(DESPAIR_CALLS).map(row).join("");

    return `
    <h2>Where they are</h2>
    <p>A player opens their sheet and clicks <strong>Actions → Hope Calls</strong>. A Monokuma opens
       their own sheet and finds <strong>Despair Calls</strong> in the same place — a Monokuma has no
       action grid, because they have no action economy.</p>
    <p>Calls you cannot afford are greyed out. Clicking one you can afford asks what it is aimed at
       (a player, a project, a room, an item), shows the price, and only then charges you.</p>

    <h2>Nothing is left to the honour system</h2>
    <p>Every Call now carries out its own effect. There is no free-text box to explain what you meant,
       because the module does the thing rather than announcing an intention.</p>

    <h3>Calls that change a roll</h3>
    <p>Advantage, disadvantage, experiences and the free trait choice are <em>disabled</em> in the roll
       window at all times. A Call is the only thing that opens them — and when it does, it does not
       merely unlock the button, it <strong>presses it and locks it again</strong>. A player cannot
       decline a disadvantage a Monokuma paid for, and cannot forget to tick the advantage they bought.</p>
    <p>These last for <strong>one roll only</strong>. The moment the roll window is submitted the Call
       is spent, whether the roll came from an action or from clicking a trait on the sheet.</p>
    <p>The Hope cost block has been removed from the roll window entirely: spending Hope on an
       experience <em>is</em> the Experience Call, already paid for before the window opened.</p>

    <h3>Free Critical</h3>
    <p>The dice are still thrown — and both come up 12, for 24 and a guaranteed critical, visible in
       chat like any other roll. The guide calls it "no roll"; a roll that produces nothing to look at
       would leave the table with nothing to react to.</p>

    <h3>Reroll</h3>
    <p>This one looks backwards. It re-rolls the character's <strong>most recent roll and no other</strong>,
       rewrites that chat message in place, and reverses what the old result gave: Hope, Stress, and the
       Despair point that went to their Monokuma. If the roll was Work on Project, the progress it bought
       is taken back and the new roll's progress applied instead.</p>
    <p>What it cannot take back, it says so in the receipt: an item already drawn into an inventory, or a
       Remnant already on the map. Remove those yourself if the new result does not justify them.</p>

    <h3>Support</h3>
    <p>Aimed at another character in the same room. Flags live on the beneficiary's actor, which the buyer
       has no write access to, so the arming is routed through your client — you will see nothing, but the
       beneficiary is whispered what they have been given.</p>

    <h3>Public Announcement</h3>
    <p>Every student is teleported into the room you pick, at a random spot inside it. This is a
       teleport, not a walk: walls and doors do not apply, and nobody is charged a Move for it.</p>

    <h3>New Rule</h3>
    <p>Asks you to type the rule. It is then posted to chat, publicly, word for word.</p>

    <h2>Hope Calls</h2>
    <table><thead><tr><th>Call</th><th>Hope</th><th>What the module does</th></tr></thead>
    <tbody>${hope}</tbody></table>

    <h2>Despair Calls</h2>
    <table><thead><tr><th>Call</th><th>Despair</th><th>What the module does</th></tr></thead>
    <tbody>${despair}</tbody></table>

    <h2>If a Call ever does nothing</h2>
    <p>It will tell you. A Call that is paid for and whose effect fails now raises an error notification
       and prints the failure in its own receipt, instead of charging you and staying quiet.</p>`;
}

/** Plain-English description of what a Call's data actually makes happen. */
function effectOf(c) {
    const parts = [];
    if (c.grants === "advantage") parts.push("ticks and locks Advantage on the next roll");
    if (c.grants === "disadvantage") parts.push("ticks and locks Disadvantage on the next roll");
    if (c.grants === "experience") parts.push("ticks and locks every experience on the next roll");
    if (c.grants === "trait") parts.push("unlocks the trait picker for the next roll");
    if (c.grants === "critical") parts.push("forces the next roll to 12 + 12 = 24, a critical");
    if (c.reroll) parts.push("re-rolls the last roll and reverses what it gave");
    if (c.announces) parts.push("asks for the wording and posts it to chat");
    if (c.damage) {
        parts.push(`marks ${Object.entries(c.damage)
            .map(([r, n]) => `${n} ${r === "hitPoints" ? "HP" : "Stress"}`).join(" and ")}`);
    }
    if (c.progress) parts.push(`${c.progress > 0 ? "+" : ""}${c.progress} progress on a project`);
    if (c.wipesProgress) parts.push("empties a project's progress bar");
    if (c.sealsRoom) parts.push("seals a room until the clock advances");
    if (c.gathersEveryone) parts.push("teleports every student into one room");
    if (c.target === "item") parts.push("deletes the item from its owner's inventory");
    return parts.join("; ") || "—";
}

function consolePage() {
    return `
    <h2>Console reference</h2>
    <p>Everything sits on <code>game.drpg</code>. Press F12 to open the console.</p>
    <h3>Setting up</h3>
    <ul>
        <li><code>game.drpg.initCharacter(actor)</code> — starting HP/Stress/Hope</li>
        <li><code>game.drpg.installHandbook({ overwrite: true })</code> — rebuild this journal</li>
        <li><code>game.drpg.installTables()</code> — create the item RollTables</li>
        <li><code>game.drpg.autoAssign()</code> — split students between Monokumas</li>
    </ul>
    <h3>Running a session</h3>
    <ul>
        <li><code>game.drpg.advanceTimeOfDay()</code> · <code>game.drpg.rewindTimeOfDay()</code></li>
        <li><code>game.drpg.resetAllActions()</code></li>
        <li><code>game.drpg.getClock()</code> · <code>game.drpg.setClock({ chapter: 2 })</code></li>
        <li><code>game.drpg.performAction(actor, "search")</code> — run an action for someone</li>
    </ul>
    <h3>Investigation</h3>
    <ul>
        <li><code>game.drpg.dropRemnant(actor, { type: "key", visibility: "evident" })</code></li>
        <li><code>game.drpg.remnantsInRoom("Library")</code></li>
        <li><code>game.drpg.clearFaintRemnants()</code></li>
        <li><code>game.drpg.grantItem(actor, { name: "Axe", category: "crimeTool", tier: 2 })</code></li>
    </ul>
    <h3>When something looks wrong</h3>
    <ul>
        <li><code>game.drpg.diagnoseDice()</code> — why are the dice unskinned?</li>
        <li><code>game.drpg.diagnoseDespair()</code> — why is no Despair being awarded?</li>
        <li><code>game.drpg.auditAnonymity()</code> — who can read whose sheet?</li>
        <li><code>game.drpg.findDuplicateUltimates()</code> — two students with the same Ultimate</li>
    </ul>
    <p><em>Full surface:</em> <code>Object.keys(game.drpg).sort()</code></p>`;
}
