/**
 * Danganronpa RPG — static configuration.
 * ---------------------------------------------------------------------------
 * Single source of truth for every number, threshold and table that the
 * "Danganronpa RPG System — Full Guide" defines. Nothing in here touches
 * Foundry; it is plain data so the rest of the module (and macros) can read
 * the rules instead of hardcoding them.
 *
 * If a rule changes in the guide, change it HERE and nowhere else.
 *
 * WHO OWNS THE WORDING, AND WHY IT IS DIFFERENT FOR 1.2.0.
 *
 * The standing rule of this project is that the English handbook rules the
 * wording: the module is brought into line with the handbook, not the other way
 * round. For the Sweet & Sound update that rule is inverted, and it is written
 * down here so nobody spends an afternoon "correcting" this file back to an
 * older document. The handbooks — the short player and GM briefings and the
 * full guides — are being written AFTER 1.2.0, out of what is written here.
 *
 * The practical consequence: every `label`, `hint` and `effect` added in this
 * release is finished copy, not a working title to tidy up later. Tamper and
 * Steal, the four new Hope Calls and the new Motive, the Tools category and the
 * catalogue of sound events all go into the briefings in the words this file
 * gives them. "Tamper" in particular is a name coined during the 1.2.0 plan and
 * found in neither the guide nor Dawid's notes: it is the name now.
 */

export const MODULE_ID = "danganronpa-rpg";

/**
 * The version of this module, from the one place a version is written.
 *
 * There used to be a hand-written `BUILD` constant here as well, on the
 * reasoning that a hosted world's manifest records what the HOST installed
 * while the files underneath may already have been replaced — two different
 * questions, two stamps. The reasoning was sound and the practice was not: the
 * two numbers had to be kept in step by hand, they promptly stopped being, and
 * the GM panel spent a release telling people "v1.0.53 (manifest 1.1.0)" about
 * a module whose only real version was 1.1.0. A stamp nobody trusts answers
 * nothing. One number that cannot go stale beats two that need tending.
 *
 * The question the second stamp was meant to answer — "are the files on this
 * host the ones I uploaded?" — has a better tool in `fileSizes()`, which
 * answers it per file instead of guessing from a single constant.
 *
 * Called, not captured at import time: `game.modules` does not exist yet when
 * this file is first evaluated.
 */
export function moduleVersion() {
    return game.modules.get(MODULE_ID)?.version ?? "?";
}

/** Socket channel used for player -> GM requests (search tokens, reveals). */
export const SOCKET = `module.${MODULE_ID}`;

/**
 * Document flag keys, all stored under `flags["danganronpa-rpg"]`.
 * Never spell these out inline — a typo in a flag name fails silently.
 */
export const FLAGS = {
    /** Character: the student's Ultimate talent, shown under their name. */
    ultimate: "ultimate",
    /**
     * Character (a dead one): the trace left by people going through them.
     *
     * `{ sceneId, tokenId, taken: [name] }` — ONE remnant per body however many
     * things leave it, because you cannot count hands from a turned-out pocket,
     * and because three traces would mean three clean-up actions and nobody
     * would ever loot anything. The list grows; the trace does not.
     */
    lootTrace: "lootTrace",
    /**
     * Character: the id of the weapon this character actually swung.
     *
     * Written by the crisis roll, read by Stage 6's confiscation. It exists
     * because a character may hold only one thing at a time (E9): a killer
     * swings the knife and then picks up the gloves to clean, so "what is in
     * their hands when the stage closes" is the wrong question and would spare
     * the murder weapon every time.
     */
    swungWeapon: "swungWeapon",
    /**
     * Character: this student is dead.
     *
     * A flag rather than a hidden token. The body is often exactly what the
     * cast is standing around looking at, so it has to stay on the map — but
     * the dead do not occupy a room for the rules' purposes: they are not
     * witnesses, they cannot be handed things, and a murder must still be
     * possible in the room where one already happened.
     *
     * Shape: `{ chapter, day, timeOfDay }` — when, so the timeline can be
     * reconstructed at the trial.
     */
    deceased: "deceased",
    /**
     * Character: this dead student has joined the GM side as a Monocub.
     *
     * Guide, p. 16: "Po śmierci, gdy jego class trial się zakończy, gracz może
     * dołączyć do DMów jako Monocub." Opt-in, and only ever set on a character
     * `isDeceased` already flagged true — a Monocub is a specific way of being
     * dead, not a third state. The player keeps the same actor: no new sheet,
     * no ownership change, just a different action panel (see `monocub.mjs`).
     */
    monocub: "monocub",
    /**
     * Character: locked out of discussing this crime until this chapter ends.
     *
     * Guide, p. 17: a Monocub who stumbles onto an incident "otrzymuje zakaz
     * wypowiadania się na temat zbrodni do końca rozdziału". Which chapter is
     * recorded rather than just a boolean, so it lapses on its own the moment
     * the chapter counter moves — the same pattern Stage 3's Analyze lock uses.
     */
    silencedChapter: "silencedChapter",
    /** Character: how many DRPG advances they have taken. */
    advances: "advances",

    /**
     * Character: the trait and experience spread they started the season with.
     *
     * Stamped by `initCharacter`, read only by the season reset. An advance
     * writes `+delta` into traits and experiences and increments `advances`,
     * and nothing anywhere records what those numbers were before — so without
     * this, a reset can zero the counter or leave the bonuses, and either one
     * is a character whose sheet disagrees with itself.
     */
    sheetAtStart: "sheetAtStart",
    /** Character: has this character already taken their free Move this time of day? */
    freeMoveUsed: "freeMoveUsed",
    /**
     * Character: crossings and actions BOUGHT with Hope and not yet used.
     *
     * COUNTERS, NOT BOOLEANS, and not `pendingCall`. Sprint and Burst are the
     * first two Hope Calls that buy something lasting rather than something the
     * next roll consumes, and `pendingCall` holds exactly ONE armed Call — a
     * Sprint parked there would have quietly eaten a Support armed beside it.
     * These are a state of the time of day, not a modifier on a roll.
     *
     * Counters rather than flags so buying twice means having two. Both are
     * cleared by `resetActionsFor`, which is what makes "until the end of this
     * time of day" true without anything having to measure time: the same
     * reset that refills the action budget empties these.
     */
    freeMoveGrants: "freeMoveGrants",
    freeActionGrants: "freeActionGrants",
    /**
     * Character: when each kind of rest was last taken.
     * Shape: { short: "<day>:<timeOfDay>", long: <session number> }.
     *
     * Stored as the clock reading rather than as a counter that something has to
     * remember to clear: a short rest is spent while the stamp still matches the
     * current time of day, and expires by itself when the clock moves on. The
     * guide's "once per time of day" and "once per session" were declared in
     * REST and never enforced, so a long rest could be repeated until the
     * character ran out of actions.
     */
    restsTaken: "restsTaken",
    /**
     * Character: a Call that has been paid for and is waiting on the next roll.
     * Shape: { key, kind, grants, from }. Consumed by the roll dialog.
     */
    pendingCall: "pendingCall",
    /**
     * Character: what the last action rolled, so Reroll has something to undo.
     * Shape: { messageId, actionKey, trait, total, withFear, isCritical,
     * projectId, progress }. Overwritten by every action; only the newest one
     * can ever be taken back.
     */
    lastAction: "lastAction",
    /**
     * Character: this actor is a Monokuma, not a student.
     *
     * A flag rather than a separate actor type on purpose. A Monokuma still
     * wants the character sheet — a portrait, a name, traits for the rare roll
     * — and a custom type would mean reimplementing all of it and losing every
     * Daggerheart feature that keys off `type === "character"`. The flag flips
     * only what actually differs: no actions, no Hope, Despair Calls instead of
     * the action grid, and walls do not apply.
     */
    monokuma: "monokuma"
};

/**
 * Key of the custom Daggerheart resource that carries the action budget.
 * Registered into CONFIG.DH.RESOURCE.character.custom — see resources.mjs.
 */
export const ACTIONS_RESOURCE = "actions";

/* ==========================================================================
 * TRAITS
 * --------------------------------------------------------------------------
 * The guide defines six stats. Daggerheart also has exactly six traits, so we
 * do not touch the data model at all — we only relabel them via i18n.
 * `dh` is the key that actually lives in actor.system.traits.
 * ========================================================================== */

export const TRAITS = {
    eye: { dh: "instinct", label: "Eye", short: "EYE", hint: "Perceptiveness and noticing things." },
    head: { dh: "knowledge", label: "Head", short: "HEA", hint: "Connecting facts." },
    body: { dh: "strength", label: "Body", short: "BOD", hint: "Physical strength." },
    leg: { dh: "agility", label: "Leg", short: "LEG", hint: "Physical speed." },
    hand: { dh: "finesse", label: "Hand", short: "HAN", hint: "Dexterity and precise action." },
    shadow: { dh: "presence", label: "Shadow", short: "SHA", hint: "Hiding and the sixth sense." }
};

/** Reverse lookup: daggerheart trait key -> drpg trait key. */
export const TRAIT_BY_DH = Object.fromEntries(
    Object.entries(TRAITS).map(([key, data]) => [data.dh, key])
);

/** Character creation spread from the guide: +2, +1, +1, 0, 0, -1. */
export const TRAIT_ARRAY = [2, 1, 1, 0, 0, -1];

/* ==========================================================================
 * STARTING RESOURCES
 * ========================================================================== */

export const STARTING = {
    hp: 4,
    stress: 6,
    hope: 2,
    hopeMax: 6,
    /** Per-GM Despair pool cap (Daggerheart "Max Fear"). */
    despairMax: 12,
    /** Base actions per time of day. */
    actions: 2,
    /** One free Move per time of day, on top of the action budget. */
    freeMoves: 1,
    /** Two experiences at +2 each. */
    experiences: 2,
    experienceValue: 2,
    /**
     * Everybody opens with one Tier 2 item tied to their Ultimate.
     *
     * WHAT it is stays a conversation — "do uzgodnienia z każdym graczem z
     * osobna" — so only the tier lives here. `initCharacter` takes the name.
     */
    startingItemTier: 2
};

/* ==========================================================================
 * TIME OF DAY
 * --------------------------------------------------------------------------
 * One session = one in-fiction day = five times of day. Advancing the clock
 * resets action budgets, free moves and per-room search tokens.
 * ========================================================================== */

export const TIMES_OF_DAY = ["morning", "noon", "afternoon", "evening", "night"];

export const TIME_OF_DAY_LABELS = {
    morning: "Morning",
    noon: "Noon",
    afternoon: "Afternoon",
    evening: "Evening",
    night: "Night"
};

/**
 * The three modes a session runs in. A canonical chapter is five sessions:
 * three Daily Life (the third carrying the murder), one Investigation, one
 * Class Trial. The GM sets this by hand — the guide allows stretching a
 * chapter when no murder has happened yet.
 */
export const PHASES = {
    dailyLife: { label: "Daily Life", hint: "You live inside a closed area. Two actions per time of day." },
    investigation: { label: "Investigation", hint: "A body was found. Observe and Analyze to build Truth Bullets." },
    classTrial: { label: "Class Trial", hint: "The moment of truth. Objections, testimony, the vote." }
};

/** Chapters in a canonical season. The modular variant runs a single chapter. */
export const CHAPTERS_PER_SEASON = 6;

/**
 * G-36. Roughly this many rooms per player, corridors and dormitories aside.
 *
 * Advice, not a rule, and the checklist row that reads it says so — the number
 * is here because it is the guide's and because a magic 1.5 in season-setup.mjs
 * would be a rule nobody could find.
 *
 * What it is really measuring is whether two conversations can happen at once.
 * Below it, every private word is a queue for the same empty room, and a
 * killing game where nobody can get anybody alone is a killing game with no
 * murders in it.
 */
export const ROOMS_PER_PLAYER = 1.5;

/* ==========================================================================
 * ROOMS
 * ========================================================================== */

/**
 * Room crossings each character gets during an Eclipse, free of the action
 * economy. Guide: "before each time of day the player may move their token by 2
 * connected rooms."
 *
 * Kept here rather than in eclipse.mjs because movement.mjs enforces the same
 * cap and cannot import eclipse.mjs — eclipse.mjs already imports movement.mjs,
 * and closing that loop would put the constant in a temporal dead zone.
 */
export const ECLIPSE_MOVES = 2;

/**
 * Eclipses that let you start anywhere on the map instead of two rooms away.
 *
 * ONE of the five: the Night Eclipse. The handbook's "at night you can pick any
 * room as your starting point" (p. 12) is the whole of the exception.
 *
 * The handbook's opening line — "you pick any room to begin in" — reads like a
 * second exception for the start of a session, and this list briefly carried
 * `morning` for that reason. It is not one: at the table the Morning Eclipse is
 * an ordinary placement window with the ordinary two crossings, and only the
 * night is free. Corrected on the author's ruling.
 *
 * Keyed by the time of day the Eclipse OPENS — a Night Eclipse runs before
 * Night — which is how they are named everywhere in the interface.
 */
export const ECLIPSE_FREE_PLACEMENT = ["night"];

export const ROOMS = {
    /** Search tokens available per room, per time of day. */
    searchTokensPerRoom: 3
};

/* ==========================================================================
 * ITEMS
 * --------------------------------------------------------------------------
 * Tier defines effectiveness. Categories carry hard inventory caps; Truth
 * Bullets are deliberately uncapped.
 * ========================================================================== */

export const ITEM_TIERS = [0, 1, 2, 3];

/**
 * HOW MUCH A THING TAKES BEFORE IT GIVES (Dawid, 28.08).
 *
 * A roll with Despair used to end the tool outright. It ends a tier-0 sack of
 * nothing outright still — but a good tool now survives its first bad moment,
 * and the number of bad moments is what the tier buys, alongside everything
 * else the tier buys.
 *
 * TIER 0 AND TIER 1 ARE BOTH ONE, and that is Dawid's number rather than a
 * rounding: tier 1 is the first thing worth carrying, not the first thing that
 * lasts. What tier 2 buys is a second chance; tier 3 buys a third.
 *
 * Read through `durabilityOf`, which answers 1 for anything with no tier
 * recorded — a hand-made item, a world made before this existed — so an
 * unknown thing behaves exactly as everything did before.
 */
export const ITEM_DURABILITY = { 0: 1, 1: 1, 2: 2, 3: 3 };

/**
 * TWO FLAG NAMES THAT TWO FILES BOTH NEED.
 *
 * The owner of a bedroom is written on its Region by vault.mjs; the key to that
 * bedroom is written on an Item by the same file. movement.mjs has to read both
 * to decide whether a token may cross the threshold, and it has to do it
 * synchronously, inside `preUpdateToken` — where there is no opportunity to
 * await an import.
 *
 * Importing vault.mjs into movement.mjs would close a cycle (vault already
 * reaches movement), and copying the strings into both files is how they drift.
 * config.mjs imports nothing and is imported by everything, so the names live
 * here and both readers agree by construction.
 */
export const ROOM_OWNER_FLAG = "drpgVaultOwner";
export const BEDROOM_KEY_FLAG = "bedroomKey";

export const ITEM_CATEGORIES = {
    usable: {
        label: "Usable",
        plural: "Usables",
        limit: 3,
        hint: "Healing items restore Health, sanity-relief items clear Sanity. Tier 3 lets you pick."
    },
    // "Murder Weapon" rather than "Crime Tool" — Dawid's wording, 2026-08-17.
    // Changed here rather than in the item window alone, because this table is
    // the one source these names come from: the inventory group header, the
    // Search tables, the GM's item tooling and the item's own subtitle all read
    // it, and a subtitle that disagreed with the header directly above it would
    // be a worse bug than the one being fixed.
    crimeTool: {
        label: "Murder Weapon",
        plural: "Murder Weapons",
        limitGroup: "gear",
        hint: "Makes a murder incident easier."
    },
    cleaningTool: {
        label: "Cleaning Tool",
        plural: "Cleaning Tools",
        limitGroup: "gear",
        hint: "Makes covering up a murder easier."
    },
    /**
     * A tool, in the ordinary sense: something you work with.
     *
     * Held ready, it gives advantage on project work and on sabotage. It is the
     * one category here that is not about a murder, which is exactly why it
     * shares its slots with the two that are — see LIMIT_GROUPS. A character
     * carrying a full workshop is a character not carrying a knife.
     */
    tool: {
        label: "Tool",
        plural: "Tools",
        limitGroup: "gear",
        hint: "Held ready, it gives advantage on project work — sabotage included. It can break."
    },
    truthBullet: {
        label: "Truth Bullet",
        plural: "Truth Bullets",
        limit: null,
        hint: "Evidence. No carry limit."
    },
    /**
     * A key to somebody's bedroom.
     *
     * Uncapped, like evidence, and for the same kind of reason: a key is not
     * something you carry instead of something else. It is not searched for
     * either — `tables.mjs` skips it, the same way it skips Truth Bullets —
     * because a key exists because a GM assigned a room, not because anybody
     * turned out a cupboard.
     */
    bedroomKey: {
        label: "Room Key",
        plural: "Room Keys",
        limit: null,
        hint: "Opens one bedroom. Copy it to let somebody else in."
    }
};

/**
 * OUR OWN DRAWINGS NOW, one per category, shipped in `icons/`.
 *
 * These were four of Foundry's painted icons: an oil-painted apple beside a
 * pixel-art sheet, and Tool and Room Key with no entry at all — which is a
 * blank frame, not a fallback. The old note here was about two paths that did
 * not exist in the core set, which is the other way the same thing goes wrong:
 * a default nobody can verify is a default nobody notices breaking.
 *
 * A path built from the key is what keeps the two lists honest — a category
 * added to ITEM_CATEGORIES and given a picture in `tools/item-icons.mjs` needs
 * nothing here, and one given no picture is a missing FILE, which shows up as
 * a 404 the first time it is drawn rather than as silence.
 *
 * Placeholders on purpose (Dawid, 28.08): one drawing per category, not per
 * item. Edit the picture in `tools/item-icons.mjs` and re-run it.
 */
export const itemIcon = category =>
    `modules/${MODULE_ID}/icons/item-${ITEM_CATEGORIES[category] ? category : "usable"}.svg`;

/**
 * What each tier means per category. Used by the Search roll tables and by the
 * GM tooling that improvises items.
 */
export const TIER_EFFECTS = {
    // The kind-neutral wording, for the few places that talk about usables in
    // general (an item whose kind nobody has recorded yet). Anything that KNOWS
    // whether the item is a healing or a stress-relief one reads
    // USABLE_KIND_EFFECTS below instead.
    usable: {
        0: "A random, seemingly useless item. Open to creative use.",
        1: "Restores 1 Health (healing) or 1 Sanity (sanity relief), by its kind.",
        2: "Restores 2 Health (healing) or 2 Sanity (sanity relief), by its kind.",
        3: "Restores 2 Health or 2 Sanity — your choice — plus 2 Hope."
    },
    crimeTool: {
        0: "A random, seemingly useless item.",
        1: "Meant for something else, but usable.",
        2: "Partly intended for the job.",
        3: "Made strictly for the job."
    },
    cleaningTool: {
        0: "A random, seemingly useless item.",
        1: "Meant for something else, but usable.",
        2: "Partly intended for the job.",
        3: "Made strictly for the job."
    }
};

/**
 * The two kinds of Usable Item, and which resource each one mends.
 *
 * Every usable is one or the other — a first aid kit patches the body, a music
 * player settles the nerves — and which it is comes from the item tables: the
 * Healing tables hold what restores Health, the Sanity Relief tables what clears
 * Sanity (Dawid, 2026-08-26). The player used to be asked at the moment of use;
 * now the table has already answered.
 *
 * `resource` is the Daggerheart resource key `use-items.mjs` writes to. The
 * labels feed the table names ("DRPG Usables (Healing) — Tier 2") through
 * USABLE_GOALS in tables.mjs, so renaming one here renames what a fresh world
 * installs.
 */
/**
 * `chip` is the short form, for the tag on an inventory row.
 *
 * Separate from `label` rather than replacing it: the long names go into item
 * descriptions, the GM's give-item receipt and the goal tables, where "Sanity
 * Relief" says what the thing does. On a row beside a Murder Weapon, next to
 * the resource it refills, "Sanity" is what a player is reading for.
 */
export const USABLE_KINDS = {
    healing: { label: "Healing", chip: "Health", resource: "hitPoints" },
    stress: { label: "Sanity Relief", chip: "Sanity", resource: "stress" }
};

/**
 * What each kind restores per tier, in words. The item descriptions, the GM's
 * give-item receipt and the goal tables' own descriptions all read this, so an
 * item says what IT does rather than what usables in general can do.
 *
 * Tier 3 reads the same in both columns on purpose: the top-tier usable is
 * where the two kinds meet, and the only place the player still chooses.
 */
export const USABLE_KIND_EFFECTS = {
    healing: {
        1: "Restores 1 Health.",
        2: "Restores 2 Health.",
        3: "Restores 2 Health or 2 Sanity — your choice — plus 2 Hope."
    },
    stress: {
        1: "Restores 1 Sanity.",
        2: "Restores 2 Sanity.",
        3: "Restores 2 Health or 2 Sanity — your choice — plus 2 Hope."
    }
};

/**
 * What using a Usable Item actually restores, by tier.
 *
 * Tiers 1 and 2 are `byKind`: the amount lands on whichever resource the item's
 * kind names (USABLE_KINDS above), no question asked — the choice was made when
 * the item came off a Healing or a Sanity Relief table. Only tier 3 still asks,
 * and it restores 2 Hope on top whichever way the player answers. Tier 0 is "a
 * random, seemingly useless object, open to creative use": there is no table
 * entry to apply, so it goes to the GM instead.
 *
 * Health and Sanity are reverse resources; `use-items.mjs` subtracts marks.
 */
export const USABLE_EFFECTS = {
    0: { creative: true },
    1: { amount: 1, byKind: true },
    2: { amount: 2, byKind: true },
    3: { amount: 2, choose: ["hitPoints", "stress"], bonus: { hope: 2 } }
};

/**
 * Categories a character can hold ready rather than merely own.
 *
 * The guide never says a weapon has to be drawn — but "Jeśli zdobyła przedmiot,
 * którego może użyć jako broń" and the crime tool being consumed after a murder
 * both assume a specific object is in hand, and the incident engine had no way
 * to be told WHICH. Equipping is that answer: one per category, and it is what
 * `bestWeaponTier` reads first.
 */
export const EQUIPPABLE = ["crimeTool", "cleaningTool", "tool"];

/**
 * Categories that share one carry limit between them.
 *
 * THREE SLOTS FOR EVERYTHING YOU HOLD IN YOUR HANDS (Dawid, 27.08, G-43).
 *
 * The guide gives one Murder Weapon and two Cleaning Tools: three, in fixed
 * proportions. The total stands; the division goes. Which three you have is
 * decided by what the dice turned up and what you chose to keep — a player who
 * found two knives no longer has to leave one behind while a slot sits empty
 * beside it, and the new Tool category does not quietly make the number five.
 *
 * A GROUP RATHER THAN A NUMBER ON EACH CATEGORY, because the question
 * `canCarry` asks changes shape: it stops being "how many of these" and becomes
 * "how much of this budget is spent". Categories with no group keep the old
 * behaviour exactly — Usables still cap at three of their own, Truth Bullets and
 * keys are still uncapped — so nothing outside this group notices.
 *
 * It is also what makes item ROLES safe. With separate counters, moving an
 * item's home moved which counter it drew from, so a screwdriver filed under
 * Tools could serve as a weapon without spending the weapon slot. With one
 * counter every item costs one slot whatever its home and whatever it can do.
 */
export const LIMIT_GROUPS = {
    gear: {
        label: "Gear",
        limit: 3,
        hint: "Murder Weapons, Cleaning Tools and Tools share three slots."
    }
};

/* ==========================================================================
 * REMNANTS & TRUTH BULLETS
 * --------------------------------------------------------------------------
 * A Remnant lives on the map. Observing it copies it into a player's
 * inventory as a Truth Bullet; the Remnant itself stays put.
 * ========================================================================== */

/** How hard a Remnant is to spot. Order matters: easiest -> hardest. */
export const REMNANT_VISIBILITY = ["obvious", "evident", "subtle", "hidden"];

export const REMNANT_VISIBILITY_LABELS = {
    obvious: "Obvious",
    evident: "Evident",
    subtle: "Subtle",
    hidden: "Hidden"
};

export const REMNANT_TYPES = {
    key: {
        label: "Key Remnant",
        hint: "GM-placed, unremovable. Becomes a Truth Bullet unanalysed.",
        reinforced: true
    },
    neutral: {
        label: "Neutral Remnant",
        hint: "Undetermined origin. Analysis turns it into a real category."
    },
    faint: {
        label: "Faint Remnant",
        hint: "Doubtful. Swept at chapter end unless tied to the murder."
    },
    prep: {
        label: "Prep Remnant",
        hint: "Left while preparing a murder or gathering tools."
    },
    incident: {
        label: "Incident Remnant",
        hint: "Left during the confrontation or the victim's death."
    },
    resolution: {
        label: "Resolution Remnant",
        hint: "Left by the killer's mistakes while cleaning up the scene."
    },
    autopsy: {
        label: "Autopsy Remnant",
        hint: "The state of the body. Handed out first, no roll needed."
    },
    final: {
        label: "Final Truth Remnant",
        hint: "One per chapter. Points at the Mastermind.",
        // Placed once a chapter and meant to survive the whole season, not just
        // this case — `placeRemnant` already reads this flag to set the token's
        // own `reinforced` flag, so nothing else has to know "final" is special.
        reinforced: true
    }
};

/**
 * Truth Bullet types — same keys as REMNANT_TYPES, since every Truth Bullet
 * traces back to exactly one Remnant type. Kept as a separate table because the
 * two are worded for different readers: a Remnant's hint is the GM's note on
 * the map, a Truth Bullet's is what ends up on a player's inventory card.
 */
export const TRUTH_BULLET_TYPES = {
    key: {
        label: "Key Truth Bullet",
        hint: "Evidence from the GMs, so the case is solvable. Identified the moment you pick it "
            + "up — no Analyze needed."
    },
    neutral: {
        label: "Neutral Truth Bullet",
        hint: "A trace of undetermined origin. Analyse it to find out what it really is."
    },
    faint: {
        label: "Faint Truth Bullet",
        hint: "Doubtful connection to the case. Survives the sweep at the start of the next "
            + "session, and can be analysed again."
    },
    prep: {
        label: "Prep Truth Bullet",
        hint: "Left by the killer during preparation."
    },
    incident: {
        label: "Incident Truth Bullet",
        hint: "Created during the murder itself."
    },
    resolution: {
        label: "Resolution Truth Bullet",
        hint: "Left by the killer's mistakes while cleaning up the crime scene."
    },
    autopsy: {
        label: "Autopsy Truth Bullet",
        hint: "The state of the body — when it was discovered, and the cause of death. Handed out "
            + "at the start of every Investigation."
    },
    final: {
        label: "Final Truth Bullet",
        hint: "One per chapter. Points at the Mastermind."
    }
};

/**
 * Observe action DCs — guide "Cel obserwacji" table.
 * Rows: how visible the Remnant is. Columns: what kind of Remnant it is.
 *
 * No `autopsy` column: Autopsy Truth Bullets are handed out by the GM from the
 * GM panel, never rolled for — see the panel's "Issue Autopsy Truth Bullet".
 *
 * `incident` and `resolution` are priced the same as `prep`. The guide's own
 * table left them blank (crime-scene evidence copying itself into inventory
 * with no roll at all), which was almost certainly a transcription gap rather
 * than the intended rule — a Class Trial's evidence should not be free. Table
 * confirmed this reading explicitly: Observe rolls for both.
 */
export const OBSERVE_DC = {
    obvious: { dailyLife: 8, key: 6, faint: 12, prep: 9, incident: 9, resolution: 9 },
    evident: { dailyLife: 12, key: 9, faint: 15, prep: 12, incident: 12, resolution: 12 },
    subtle: { dailyLife: 18, key: 12, faint: 18, prep: 15, incident: 15, resolution: 15 },
    hidden: { dailyLife: 21, key: 15, faint: 21, prep: 18, incident: 18, resolution: 18 }
};

/**
 * Remnant types the Observe/Analyze tables have no column for.
 *
 * The guide's tables are written for the types a Remnant is actually left AS:
 * Key, Faint, Prep, Incident, Resolution, Autopsy. "Neutral" is a state a Truth
 * BULLET is in — what the player sees before analysing it — not a kind of trace
 * somebody leaves. `REMNANT_TYPES` mirrors the bullet list all the same, so a GM
 * can place both on the map and the lookup has to answer for them.
 *
 *   neutral → prep    the standard evidence column; a trace of unstated origin
 *                     is priced like the ordinary evidence it stands in for
 *   final   → key     both are placed by the GM to be found, not stumbled upon
 *
 * `diagnoseTruthBullets` warns about Neutral Remnants on the map, since one is
 * usually a GM meaning to pick a real category and not getting to it.
 */
export const OBSERVE_TYPE_ALIAS = {
    neutral: "prep",
    final: "key"
};

/**
 * The Observe difficulty for one Remnant, with the aliases applied.
 * `null` means "no roll" — Autopsy Remnants are handed over, never spotted.
 */
export function observeDc(visibility, type) {
    const column = OBSERVE_TYPE_ALIAS[type] ?? type;
    return OBSERVE_DC[visibility]?.[column] ?? null;
}

/**
 * Failing an Observe roll costs the player Sanity.
 *
 * ONE, NOT TWO (Z1, from the E18 season run). Observe is the action a player
 * reaches for most often and the only common one whose failure is paid for in a
 * resource — and at 2 the arithmetic said "look twice and you are a third of
 * the way to a breakdown". The simulation measured what that does over a
 * chapter: the price is not paid in Sanity, it is paid in people declining to
 * look, which is the one behaviour this game cannot afford to discourage.
 *
 * The briefing, the miss card and the GM's ruling line all print this constant.
 * Two sentences elsewhere spelled the number out and moved with it — the sound
 * catalogue's hint and `DRPG.Action.observeGm` — because a rule R1 cannot see
 * inside of a sentence.
 */
export const OBSERVE_FAIL_STRESS = 1;

/**
 * What a critical pays, and it is this game's number rather than Daggerheart's.
 *
 * G-16. Daggerheart hands a critical +1 Hope and clears 1 Stress; the guide
 * says +2 Hope and says nothing about Stress. This module had never overridden
 * either, so it was running Daggerheart's rule by omission.
 *
 * FOLLOWING THE GUIDE EXACTLY, both halves. Keeping the cleared Stress as well
 * would give a critical more than either document describes. The trade is close
 * to neutral in size — one Sanity mark against one Hope — and it moves the
 * reward onto the currency a player can decide what to do with, so a critical
 * gets more USEFUL rather than weaker. It also stops a critical being worth
 * more to a wounded character than to a healthy one, which is a strange thing
 * for a critical to be.
 *
 * Applied by wrapping Daggerheart's own resource step — see critical.mjs. It is
 * here because it is a rule, and rules live in this file.
 */
export const CRITICAL = {
    hope: 2,
    clearsStress: false
};

/**
 * Analyze action DCs. Turns a Neutral Truth Bullet into an identified category.
 * A failed analysis locks that Truth Bullet for that player until the chapter
 * ends.
 *
 * ITS OWN TABLE, FROM THE FULL GUIDE (G-08, E16). This used to be DERIVED from
 * `OBSERVE_DC`, on the Player Handbook's line (p. 15) that the thresholds are
 * the same and only the statistic changes. Two of Dawid's documents disagree,
 * and the Full Guide is the one with an actual table: it prints Analyze in the
 * Investigation section rather than beside "Myśl", which is why the derivation
 * survived as long as it did — the table it contradicts was three sections
 * away.
 *
 * The guide's numbers, and they are not a uniform shift:
 *
 *   Daily Life   8 / 12 / 18 / 21   the same as Observe
 *   Faint        8 / 12 / 15 / 18   EASIER than finding it (Observe: 12/15/18/21)
 *   Prep        12 / 15 / 18 / 21   HARDER than finding it (Observe:  9/12/15/18)
 *   Key          no roll
 *
 * That shape is the rule, not a rounding: a faint trace is hard to spot and
 * obvious once in your hand, and a prepared one is easy to pick up and hard to
 * read. Deriving one table from the other flattened both.
 *
 * `incident` and `resolution` are priced like `prep`, which is the same
 * decision — with the same reasoning — that `OBSERVE_DC` already made and
 * states above: the guide leaves both columns blank in BOTH tables, and
 * crime-scene evidence that identifies itself for free is stranger here than
 * there. The "Bez rzutu." printed in the Incident column is the merged cell
 * belonging to Autopsy, exactly as in the observation table.
 *
 * `key: null` is not a gap: Key Truth Bullets arrive already identified (see
 * KEY_REMNANTS / REMNANT_TYPES.key) and never reach this lookup. No `autopsy`
 * column for the same reason.
 *
 * NOT DERIVED, AND THAT IS THE POINT NOW. The old comment said the two tables
 * must not be allowed to drift apart; after G-08 the difference between them IS
 * the rule, so anybody tempted to "fix" this back into a derivation would be
 * deleting it.
 */
export const ANALYZE_DC = {
    obvious: { dailyLife: 8,  key: null, faint: 8,  prep: 12, incident: 12, resolution: 12 },
    evident: { dailyLife: 12, key: null, faint: 12, prep: 15, incident: 15, resolution: 15 },
    subtle:  { dailyLife: 18, key: null, faint: 15, prep: 18, incident: 18, resolution: 18 },
    hidden:  { dailyLife: 21, key: null, faint: 18, prep: 21, incident: 21, resolution: 21 }
};

/**
 * The Analyze difficulty for one Truth Bullet.
 *
 * `null` means "no roll" rather than "impossible" — the guide prints "Bez rzutu"
 * for Key, and gives Autopsy and Final no column at all, because all three
 * arrive already identified. A bullet that somehow reaches Analyze in one of
 * those states is converted outright instead of being asked to beat a number
 * that was never written down.
 *
 * No alias table here, unlike `observeDc`: a bullet showing "neutral" is the
 * normal, expected state of something waiting to be analysed, and its REAL type
 * is what this looks up.
 */
export function analyzeDc(visibility, realType) {
    return ANALYZE_DC[visibility]?.[realType] ?? null;
}

/** How many Key Remnants the GM prepares, and the floor after the opening roll. */
export const KEY_REMNANTS = {
    prepared: 5,
    minimum: 3,
    /** Five clues, scaled trivial -> desperate. */
    scale: ["trivial", "standard", "standard", "complex", "desperate"],
    /**
     * What each step of that scale is called.
     *
     * Here rather than in the language file, and here rather than in
     * investigation.mjs where a copy of this object used to live: these are the
     * names of a rule, and the rule is the line above. The dashboard reads them
     * from here now.
     */
    scaleLabels: {
        trivial: "Trivial",
        standard: "Standard",
        complex: "Complex",
        desperate: "Desperate"
    },
    /** Together they must narrow the suspect pool to this range. */
    suspectRange: [3, 8],

    /**
     * G-32. Guide: every Key Remnant below four that the investigation failed
     * to turn up is worth Despair to Monokuma.
     *
     * `found` is the bar, not `placed`: a clue nobody found did its job as
     * badly as one that was never put out.
     *
     * PER MONOKUMA, NOT SPLIT BETWEEN THEM (trap 116). The guide writes "obaj
     * Monokuma" with two GMs in mind, which reads either way at four. It is
     * compensation for having run an investigation the table could not finish —
     * and each Monokuma ran it — rather than a pot to divide, which at four GMs
     * would leave each of them with less than the guide gives one of two.
     * The consequence is worth saying out loud: a completely failed
     * investigation is +12 Despair to every Monokuma at the table.
     */
    unfoundBar: 4,
    unfoundDespair: 3
};

/* ==========================================================================
 * ACTIONS
 * --------------------------------------------------------------------------
 * Actions are implemented as character abilities, not as GM calls. Each entry
 * declares which traits may roll it and what it costs.
 * ========================================================================== */
/**
 * `kind` on each entry below, and the ORDER they are written in.
 *
 * The sheet draws every `universal` entry as the action grid, in exactly this
 * order — so the table is the layout, and moving a tile means moving a block
 * of text here rather than editing a list somewhere else that could disagree
 * with it. Ten of them, two rows of five.
 *
 * The other two kinds are entries that are NOT tiles and must not be deleted:
 *
 *   panel    drawn by a panel of its own. `move` is the Monocub's, whose
 *            grid is exactly Move and Meddle.
 *   variant  reached through another action's menu. `sabotage` is the third
 *            branch of Projects, and `reroll.mjs` still dispatches on
 *            `case "sabotage"` while `briefingBlock` reads its description —
 *            an entry with no tile, not an entry that is gone.
 *
 * Crisis actions and the Monocub's Meddle have tables of their own.
 */
export const ACTIONS = {
    search: {
        kind: "universal",
        label: "Search",
        icon: "fa-magnifying-glass",
        traits: ["eye", "hand"],
        cost: 1,
        // The count of searches a room allows is a WORLD SETTING (0-10), not the
        // three this sentence used to promise. The briefing reads the real
        // number off the room and prints it as a fact line; a description that
        // states it in prose is a second copy, and the first GM to change the
        // setting turns it into a lie.
        hint: "Loot the room for something you name. Spends one of its search tokens.",
        description: "You loot the room for whatever you name. Taking a crime tool or a cleaning "
            + "tool leaves a trace behind.",
        thresholds: [
            { min: 8, tier: 0, remnant: "hidden" },
            { min: 12, tier: 1, remnant: "subtle" },
            { min: 18, tier: 2, remnant: "evident" }
        ],
        critical: { tierBonus: 1, remnant: "obvious" },
        failure: "Nothing found.",
        // `onlyFor` is a list of ROLES, not of goals — see the note on `leaves`
        // in `performSearch`. What decides is what came out of the table: a
        // tool that also serves as a weapon leaves a trace, and a tool that is
        // only a tool does not, whichever of the six the player asked for.
        leavesRemnant: { type: "prep", faint: true, onlyFor: ["crimeTool", "cleaningTool"] }
    },
    observe: {
        kind: "universal",
        label: "Observe",
        icon: "fa-eye",
        traits: ["eye"],
        cost: 1,
        // NOT a GM action any more, and that is the honest reading of the menu
        // behind it: sweeping the room, looking past the obvious and following
        // your own traces are all settled by a number against the ledger. Only
        // "focus your gaze" and "examine point of interest" summon a human, and
        // those are two of five — a red stripe on the tile promised a wait that
        // three of the five branches never have.
        callsGm: false,
        hint: "Look for evidence. Copies a Remnant into your inventory as a Truth Bullet.",
        // The Sanity a miss costs is `failStress` two lines down, and the
        // briefing prints it from there. It was written out here as well, and
        // the two would part company the first time the number moved.
        description: "You look for evidence here. A hit copies what you find into your inventory "
            + "as a Neutral Truth Bullet and leaves the original in place.",
        dcTable: "OBSERVE_DC",
        failStress: OBSERVE_FAIL_STRESS
    },
    /**
     * Think and Analyze are one action with two uses. Both are Head rolls that
     * end in a GM ruling, and splitting them only forced players to guess which
     * button to press before they knew what they wanted.
     */
    analyze: {
        kind: "universal",
        label: "Analyze",
        icon: "fa-brain",
        traits: ["head"],
        cost: 1,
        /**
         * A FUNCTION, not a flag — see `callsGmFor` in sheet.mjs.
         *
         * Analyze is two actions behind one tile: identifying a bullet is a
         * roll against a number, and asking for a hint is a question for a
         * person. Which one it will be is not a property of the action, it is a
         * property of the character at that moment — somebody holding three
         * unidentified bullets is going to analyse one, and somebody holding
         * none has only the hint left.
         */
        callsGm: actor => {
            try {
                return analysableBulletCount(actor) === 0;
            } catch {
                return false;
            }
        },
        hint: "Identify a Neutral Truth Bullet, or ask the GM for a hint.",
        description: "Identify what a Truth Bullet really is, or ask the GM for a hint. Failing "
            + "locks that bullet until the chapter ends.",
        dcTable: "ANALYZE_DC",
        /** Used when the player asks for a hint rather than analysing evidence. */
        hintThresholds: [
            { min: 14, result: "A subtle hint — e.g. “You are far from the target.”" },
            { min: 18, result: "A direct hint — e.g. “Search the pool room.”" }
        ],
        hintCritical: { result: "They ask you one question — e.g. “Did the victim really die in this room?”" },
        hintFailure: "No help.",
        /**
         * The third thing behind this tile: finding a hiding place.
         *
         * A flat number rather than a table, because there is nothing for a
         * table to say. Beating it does not open anything by itself — the
         * result goes to the GM and they decide what it bought. See
         * `locateStash` in action-rolls.mjs for why nothing is modelled.
         */
        stashThreshold: 16
    },
    project: {
        kind: "universal",
        label: "Projects",
        icon: "fa-hammer",
        traits: ["hand", "body", "leg", "head"],
        cost: 1,
        // The tile has two branches and one of them summons a human: proposing
        // a project sends the GM a card and waits for them. `callsGm` is what
        // paints the red stripe and the GM glyph on the tile, and a tile that
        // can hand the turn over should say so before it is pressed rather than
        // after — see the cost-stripe note in sheet.mjs.
        //
        // Which branch it will be is decided by the room, not by the action:
        // standing in a room with a project in it, this is a roll; standing
        // anywhere else, the only thing the tile can do is propose one and
        // wait. So the stripe asks the character rather than reading a
        // constant — see `callsGmFor`.
        callsGm: actor => {
            try {
                return workableProjectCount(actor) === 0;
            } catch {
                return false;
            }
        },
        hint: "Push a project here, or propose a new one for the GM to approve.",
        // The room requirement is not written here any more. `roomBlockFor()`
        // refuses the roll where it applies and says why, the tile greys out
        // before that, and the project list in the window is already the list
        // of what is workable from where you stand — three places that state it
        // at the moment it binds, against one paragraph that stated it in
        // advance and made this the longest text in the module.
        description: "The slow game: many actions over many times of day, and the one thing that "
            + "can change how this ends.",
        thresholds: [
            { min: 12, progress: 1 },
            { min: 18, progress: 2 }
        ],
        critical: { progress: 2, refundAction: true },
        failure: "No progress."
    },
    /**
     * The catch-all, and the only row here that is a placeholder rather than a
     * definition.
     *
     * Its label, hint and description are localised strings, which cannot be
     * written in this file: `game.i18n` does not exist when config.mjs is
     * evaluated. `dynamicDef()` in action-rolls.mjs builds the real thing at
     * render time and the grid asks for it when it reaches this row.
     *
     * What the row is FOR is its position. The dynamic tile used to be appended
     * after the loop over this table, which is why it sat last however the
     * table said — and a position nobody can choose is not a layout. It sits
     * where Dawid put it (28.08): closing the first row, next to Projects.
     */
    dynamic: {
        kind: "universal",
        deferred: true
    },
    /**
     * One tile, two rests. The choice of short or long is made in the dialog,
     * where the costs and room requirements can be shown side by side — and
     * keeping them together is half of what holds the grid at two rows of five.
     */
    rest: {
        kind: "universal",
        label: "Rest",
        icon: "fa-bed",
        traits: [],
        cost: 1,
        // "Bedroom only" was wrong, not just long: a Long Rest asks for a room
        // the GM flagged for it in Room Setup, which may be anybody's room or
        // nobody's. The dialog prices Short against Long and names the rooms
        // that allow each — see `DRPG.Rest.allowedIn` — so both the costs and
        // the room live where they are checked.
        hint: "Recover Health, Sanity or Hope. A Long Rest costs more and buys more.",
        description: "Sleep restores Health, a Meal clears Sanity, a Breath gives Hope — in full on a "
            + "Long Rest, by half on a Short."
    },
    listen: {
        kind: "universal",
        label: "Listen",
        icon: "fa-ear-listen",
        traits: ["shadow"],
        cost: 1,
        hint: "Work out who is in a neighbouring room. No GM needed.",
        description: "You listen at the wall of a neighbouring room. A modest result gives you a "
            + "headcount, a strong one gives you names.",
        thresholds: [
            { min: 14, result: "Pick one room; learn whether anyone is there." },
            { min: 18, result: "Pick one room; see the tokens of everyone in it." }
        ],
        critical: { result: "See every player token in all adjacent rooms." },
        failure: "You learn nothing."
    },
    /**
     * A hand in somebody else's pocket, going either way.
     *
     * TWO INDEPENDENT AXES, and that is the whole design: Shadow decides
     * whether you were seen, Hand decides whether it worked. Four outcomes, and
     * the two interesting ones are the mismatches — caught with nothing to show
     * for it, or robbed by somebody you never noticed.
     *
     * TWO DIRECTIONS THROUGH ONE TILE (Dawid, 28.08). Taking and leaving are
     * the same act of sleight, priced the same and rolled the same; splitting
     * them into two tiles would put the rarer one on the grid forever for the
     * sake of a difference that is one word wide. Which way it goes is the
     * first question the window asks.
     *
     * Not the stash, in either direction. Stealing from one has its own route
     * with its own conditions (`rifleStashDialog`, and the Search branch for
     * concealed ones); a Palm that reached into a stash would walk past all of
     * them, and planting into one would be the same hole in reverse.
     */
    palm: {
        kind: "universal",
        label: "Palm",
        icon: "fa-hand-sparkles",
        traits: ["hand"],
        cost: 1,
        hint: "Take something out of somebody's pocket, or leave something in it.",
        description: "You get a hand into somebody's pocket. One roll decides whether they "
            + "notice, another whether it works.",
        /**
         * ONE NUMBER FOR BOTH, and the asymmetry that might have argued for two
         * is already paid for elsewhere: a Steal takes what it finds and only a
         * critical lets you choose, while a Plant is always the thing you chose
         * — because your own pockets are not a secret from you. That is the
         * whole difference, and it is a difference in what you know rather than
         * in how hard the hand is.
         */
        threshold: 14,
        /** Whether they noticed. Its own axis, rolled separately. */
        unseen: { trait: "shadow", threshold: 15, label: "Keep your hands out of sight" },
        failure: "Your hand comes away empty."
    },
    /**
     * Cleaning up, and lying with the evidence, as an ordinary action.
     *
     * Both halves already existed and were reachable only from Stage 6 — see
     * `CLEANUP.actions` — which made the guide's "akcje rozwiązania w Etapie 2"
     * unreachable, and made planting a false trail a privilege of the one
     * person who least needs to be believed.
     *
     * TWO ROUTES, TWO PRICES, ONE IMPLEMENTATION. This tile costs an action and
     * no Sanity; the crisis window in Stage 6 still costs what it costs. Both
     * end in `attemptCleanup` / `attemptStageSix` with a flag saying which door
     * they came through — see `viaAction` in cleanup.mjs.
     */
    tamper: {
        kind: "universal",
        label: "Tamper",
        icon: "fa-broom",
        traits: ["shadow"],
        cost: 1,
        hint: "Wipe out a trace you left, or plant one pointing at somebody else.",
        // No thresholds here on purpose: the erase branch reads its number off
        // how visible the trace is (`CLEANUP.dc`) and the frame-up reads a flat
        // 18 off `CLEANUP.actions.misleadingTrail`. One number written here as
        // well would be a second copy of a rule this table does not own.
        description: "You go over a trace you left until it is gone, or you leave one that "
            + "points at somebody else. Being watched while you do it is its own problem."
    },
    directMurder: {
        kind: "universal",
        label: "Direct Murder",
        icon: "fa-skull",
        traits: [],
        cost: 1,
        callsGm: true,
        hint: "Open a direct murder. Agreed with the GM beforehand.",
        description: "A face-to-face killing, agreed with the GM beforehand and consented to by "
            + "the victim's player. You have to be alone with them."
    },

    /* ----------------------------------------------------------------------
     * NOT ON THE GRID
     * --------------------------------------------------------------------
     * Everything below this line is a real action that no tile in the action
     * panel draws. Deleting either entry breaks something that still reads it.
     * -------------------------------------------------------------------- */

    move: {
        kind: "panel",
        label: "Move",
        icon: "fa-shoe-prints",
        traits: [],
        cost: 0,
        hint: "Crossing into another room costs your free Move, then an action each.",
        description: "Moving inside your own room is free. Crossing into a connected room spends "
            + "this time of day's free Move.",
        instruction: "Drag your token. Crossing into another room is what counts — the cost "
            + "is applied when you arrive."
    },
    sabotage: {
        kind: "variant",
        label: "Sabotage",
        icon: "fa-screwdriver-wrench",
        traits: ["hand", "body", "leg", "head"],
        cost: 1,
        hint: "Break a project in this room so it needs a repair project. Always leaves a trace.",
        // "In this room" is the rule, not a hint: sabotage is a physical act on
        // a physical object, and only projects tied to the room you are standing
        // in can be targets. It used to reach every project with no room set,
        // from anywhere on the map. See `sabotageTargetsIn` in projects.mjs.
        description: "You break something the players made in the room you are standing in, so "
            + "it needs a repair project. It always leaves a trace, and Despair shows you to "
            + "the room.",
        thresholds: [
            { min: 12, result: "Success. The target needs a simple repair project.", remnant: "subtle" },
            { min: 18, result: "Success. The target needs a complex repair project.", remnant: "evident" }
        ],
        critical: { result: "Success. The target needs a hidden-difficulty repair project.", remnant: "obvious" },
        failure: "Nothing happens.",
        failureRemnant: "hidden",
        leavesRemnant: { type: "prep", faint: true }
    }
};

/* ==========================================================================
 * WHAT THE STATE-DEPENDENT `callsGm` PREDICATES ASK
 * --------------------------------------------------------------------------
 * Both live here rather than inline in the table so the table stays a table.
 * Both are deliberately defensive: this file is imported by everything and is
 * evaluated before the world is ready, so a predicate that throws would take
 * the action grid with it. A wrong stripe is a cosmetic mistake; a sheet that
 * fails to render is not.
 *
 * Both also go through dynamic imports on purpose. config.mjs is the bottom of
 * the import graph — truth-bullets.mjs and projects.mjs both import IT — so a
 * static import either way round would be a genuine cycle. The predicates only
 * run from a rendered sheet, by which point every module is long since loaded,
 * and the cached module registry makes the call as cheap as a property read.
 * ========================================================================== */

/** Truth Bullets this character could still put an Analyze into. */
function analysableBulletCount(actor) {
    const api = globalThis.game?.drpg;
    if (!actor || !api?.analysableBullets) return 1;      // unknown: assume there is work
    return api.analysableBullets(actor)?.length ?? 0;
}

/** Projects this character could work on from where they are standing. */
function workableProjectCount(actor) {
    const api = globalThis.game?.drpg;
    if (!actor || !api?.projectsAvailableIn || !api?.roomOfActor) return 1;
    const room = api.roomOfActor(actor);
    if (!room) return 0;                                  // nothing here to push
    return api.projectsAvailableIn(room)?.length ?? 0;
}

/**
 * Indirect murder — the guide makes this a project, with two extra Shadow rolls
 * layered on top of the normal project roll.
 */
export const INDIRECT_MURDER = {
    /** Hiding your intent when another player is in the room with you. */
    concealIntent: {
        label: "Conceal your intent",
        trait: "shadow",
        threshold: 16,
        success: "The others cannot see that you are doing anything. You may lie freely.",
        successWithDespair: "The others see nothing, and the project gains +1 progress.",
        failure: "The others get a general description of what you are doing — e.g. 'fiddling with test tubes'.",
        /** With nobody else in the room, the project simply gains this instead. */
        aloneBonus: 1
    },
    /** Every project action also rolls to hide the traces it leaves. */
    hideTraces: {
        label: "Hide the traces",
        trait: "shadow",
        thresholds: [
            { min: 0, remnant: "obvious" },
            { min: 12, remnant: "evident" },
            { min: 18, remnant: "subtle" }
        ],
        critical: { remnant: "hidden" }
    },
    /** The guide splits an indirect murder into at least two sub-projects. */
    subProjects: [
        { label: "Prepare the weapon", scale: ["everyday", "complex"], progress: [4, 6],
          note: "May require a specific room with the right equipment, unless you obtained the tool." },
        { label: "Set the trap", scale: ["trivial", "everyday"], progress: [3, 4],
          note: "Always requires a specific room." }
    ]
};

/**
 * A RUINED THING IS STILL A THING, AND GETTING RID OF IT IS A DECISION.
 * ---------------------------------------------------------------------------
 * Three moments in the guide destroy an object: a Crime Tool that has been
 * swung, a Cleaning Tool once the body turns up, and a Usable Item once it has
 * been opened. All three used to delete the item, and deleting it is the one
 * outcome that costs the killer nothing — the murder weapon left the world by
 * itself, tidily, the instant it stopped being useful.
 *
 * So nothing is deleted. What was used is marked Broken: the same object, in
 * the same slot, against the same carry limit, and no longer good for anything.
 * That leaves the holder with a problem the guide is full of and the module had
 * no way to express — an incriminating object nobody can put down for free.
 *
 * There are exactly two ways out of it, and both are already in the rules:
 *
 *   throw it away   somewhere, which is a thing a person does in a room, and
 *                   rooms remember. The roll below decides how loudly.
 *   stash it        in your own bedroom, which costs nothing and hides nothing
 *                   from anybody who searches the room (see vault.mjs).
 *
 * The table is `INDIRECT_MURDER.hideTraces` verbatim, and deliberately so:
 * dropping the knife in a bin is the same kind of act as wiping the bench, it
 * is rolled on the same statistic, and a second scale for it would be a second
 * thing to keep in step for no gain.
 */
export const BROKEN_ITEMS = {
    /** The word on the tag. Not a name change: the object is what it was. */
    label: "Broken",
    /** Not being seen to have done it — the same read as every other cover-up. */
    trait: "shadow",
    /** A Prep Remnant: this is somebody tidying up around a crime, not the crime. */
    remnantType: "prep",
    /**
     * NOT faint. A faint trace is swept at chapter end unless it is tied to the
     * murder, and the whole point of this object is that it is tied to the
     * murder — the trace of it being got rid of has to survive to the trial.
     */
    faint: false,
    thresholds: [
        { min: 0, remnant: "obvious" },
        { min: 12, remnant: "evident" },
        { min: 18, remnant: "subtle" }
    ],
    critical: { remnant: "hidden" }
};

/**
 * Sabotage, when you are not alone.
 *
 * The same shape as an indirect murder's conceal-intent roll, and for the same
 * reason: breaking someone's project in front of them is not something you can
 * do casually. Rolled *before* the sabotage itself, so a failure is known while
 * there is still a choice — the player may back out having spent nothing.
 *
 * The guide already has Despair on the sabotage roll reveal the attempt; this
 * covers the other half, the witnesses watching you do it in the first place.
 */
export const SABOTAGE_CONCEAL = {
    label: "Cover what you are doing",
    trait: "shadow",
    threshold: 16,
    success: "Nobody works out what you are really doing. You may lie freely about it.",
    successWithDespair: "Nobody works out what you are doing — but you fumble, and the sabotage is harder.",
    /** Despair on a successful concealment still costs you: -1 on the sabotage. */
    despairPenalty: -1,
    failure: "The others see roughly what you are up to — 'prying at the lock', 'pulling wires out'.",
    /** Failing does not stop you. It only means everyone watched you do it. */
    aloneNote: "Nobody else is in the room, so there is nothing to hide."
};

/**
 * Dynamic actions: the player describes something, the GM picks a threshold.
 * Note the inverted Remnant scale — creativity is rewarded with louder traces
 * being easier, not harder.
 */
export const DYNAMIC_THRESHOLDS = [
    { range: [8, 12], difficulty: "Trivial. Anyone could do it.", tier: 0, remnant: "obvious" },
    { range: [13, 15], difficulty: "Takes practice.", tier: 1, remnant: "evident" },
    { range: [16, 18], difficulty: "Foreign to most people. Hard to get right first try.", tier: 2, remnant: "subtle" },
    { range: [19, 21], difficulty: "Demands very niche expertise.", tier: 3, remnant: "hidden" }
];

/* ==========================================================================
 * REST
 * --------------------------------------------------------------------------
 * Long rest: 2 actions, pick 2, once per session, bedroom only.
 * Short rest: 1 action, pick 1, once per time of day, in designated rooms.
 * ========================================================================== */

/**
 * Which rooms allow which rest is NOT here: it is map data, flagged per Scene
 * Region by the GM in Room Setup — see `roomAllows` in rest.mjs. The guide is
 * explicit that the short-rest pool "depends entirely on the map prepared for
 * the season", and a `bedroomOnly: true` constant could only ever contradict
 * whatever the GM actually flagged.
 */
export const REST = {
    long: { actionCost: 2, picks: 2, perSession: 1 },
    short: { actionCost: 1, picks: 1, perTimeOfDay: 1 },
    options: {
        sleep: { label: "Sleep", long: "Restores all Health", short: "Restores half Health" },
        meal: { label: "Meal", long: "Restores all Sanity", short: "Restores half Sanity" },
        breath: { label: "Breath", long: "Grants 2 Hope", short: "Grants 1 Hope" }
    }
};

/* ==========================================================================
 * HOPE CALLS  (player spends Hope)
 * ========================================================================== */

/**
 * Hope Calls.
 *
 * `target` says what the call needs pointing at:
 *   none      nothing to choose
 *   player    another character
 *   project   a project in the room
 *
 * `grants` is the permission the call buys on the *next* roll — the roll dialog
 * keeps these controls disabled until a Call has paid for them, which is the
 * whole point of making them Calls rather than free checkboxes.
 */
export const HOPE_CALLS = {
    support: {
        label: "Support", icon: "fa-hands-holding-circle", cost: 1, target: "player", grants: "advantage",
        effect: "Give another player advantage on one roll. You have to be in the same room."
    },
    experience: {
        label: "Experience", icon: "fa-graduation-cap", cost: 1, target: "none", grants: "experience",
        effect: "Add your experience level to a roll that experience genuinely applies to."
    },
    ultimate: {
        label: "Ultimate", icon: "fa-star", cost: 2, target: "none", grants: "advantage",
        effect: "Advantage on a roll your Ultimate genuinely applies to."
    },
    contribution: {
        label: "Contribution", icon: "fa-screwdriver-wrench", cost: 2, target: "project", progress: 1,
        effect: "Add +{progress} progress to a project being worked on in the room you are in."
    },
    reroll: {
        // Not a grant: this one looks backwards, not forwards. It re-rolls the
        // dice you already threw and replaces what they did to you.
        reroll: true, label: "Reroll", icon: "fa-rotate-left", cost: 3, target: "none",
        effect: "Reroll the action. It reverts the previous outcome."
    },
    /*
     * THE THREE THAT BUY TIME RATHER THAN DICE.
     *
     * Every Call above this line changes what happens when you roll. These three
     * change what you can afford to do at all, and that difference is why not one
     * of them carries `grants`: that field parks the Call in `FLAGS.pendingCall`,
     * which holds ONE armed Call, so a Sprint sitting there would have deleted a
     * Support armed a moment earlier. They bank into counters of their own —
     * `freeMoveGrants` and `freeActionGrants` — and are spent by the two
     * functions that charge for a crossing and an action.
     *
     * They are also the first three Hope Calls in this module that are NOT in
     * the guide.
     *
     * PRICES, THIRD PASS (Z9, from the season run; Dawid, 29.08). Sprint 2,
     * Relief 3, Burst 4 — and the ladder is what it was always trying to be:
     * a crossing costs less than a rest, and a rest costs less than ANY action.
     * The first pass had them at 3 / 5 / 4 and got the general case cheapest;
     * the second (28.08) fixed Relief; this one fixes the floor.
     */
    sprint: {
        /*
         * TWO, NOT THREE (Z9). At 3 it stood level with Relief, which buys a
         * whole Short Rest — so the cheap specific case cost exactly as much as
         * the broad one, and the season run says what a player does with that:
         * nothing. Sprint was bought least of the three by a wide margin, and
         * not because a free Move is worthless. Because it was priced as though
         * it were a rest.
         */
        label: "Sprint", icon: "fa-person-running", cost: 2, target: "none",
        // One crossing. Sprint is the cheap specific case of Burst's expensive
        // general one — a Move you would otherwise pay an action for — and a
        // Call that says "a free Move" ought to hand over exactly one.
        freeMoves: 1,
        effect: "One more room crossing this time of day, without paying an action for it."
    },
    burst: {
        /*
         * FOUR (Z9, Dawid 29.08), and the shape of the menu is the same shape
         * it was at five — read it out loud: Sprint 2 buys a crossing, Relief 3
         * buys a Short Rest, Burst 4 buys ANY action. The general case still
         * costs more than either specific one, which is the right way round and
         * was not true before 28.08.
         *
         * What changed is the ceiling, not the ordering. Six is the Free
         * Critical and it is meant to be the thing you save for; at five, Burst
         * sat one point under it and competed with it for the same saved Hope —
         * so the action-buying Call, which is supposed to be the everyday one,
         * was being weighed against the rarest reward in the game.
         */
        label: "Burst", icon: "fa-bolt", cost: 4, target: "none",
        /*
         * ONE ACTION, NOT ONE POINT — the decision, and it has teeth.
         *
         * A Long Rest costs two actions, and "your next action is free" is a
         * sentence about the action, not about half of it. So a grant covers a
         * whole `spendAction` call whatever it is charging for. The other half
         * of that rule is trap 97: covering ONE call means the second call in
         * the same turn pays normally, or a Long Rest plus anything at all goes
         * on a single Burst.
         */
        freeActions: 1,
        effect: "Your next action costs nothing — the whole action, however many it would have cost."
    },
    relief: {
        /*
         * THREE, NOT FIVE (Dawid, 28.08): "nie ma powodu, by było droższe niż
         * Burst." It was priced above Burst on the reasoning that a rest buys
         * more than an action, which is true and is not the question — the
         * question is what a player will actually reach for, and a Call nobody
         * buys is a Call that is not in the game.
         *
         * It lands in the same price band as Sprint, Reroll and Determination,
         * and `byPrice()` is stable, so the panel keeps them in this table's
         * order within the band.
         */
        label: "Relief", icon: "fa-mug-hot", cost: 3, target: "none",
        /*
         * A Short Rest that ignores everything a Short Rest normally asks for.
         *
         * Both waivers are deliberate (decision 4). The once-per-time-of-day
         * limit and the marked room are what make a Short Rest a decision about
         * where you are and what you have already done — and a Call for five
         * Hope that could only be spent when you did not need it would be a Call
         * nobody buys. The moment you want this is exactly the moment both gates
         * are shut.
         *
         * The benefits themselves are `applyRest`'s, unchanged, so "as though
         * they had taken a rest" is literally what happens rather than a second
         * table that agrees with the first until somebody edits one.
         */
        freeRest: "short",
        effect: "Take a Short Rest right now — no action, no marked room, and it does not use up this time of day's."
    },
    determination: {
        /*
         * "Resolve", not "Determination" (Dawid, 28.08). Thirteen characters of
         * pixel font is 143px against a hundred-pixel tile, and it was the one
         * label in the game forcing every other tile's type down to fit it. The
         * shorter word says the same thing and costs the whole grid nothing.
         *
         * THE KEY STAYS `determination`. It is an identity, not a name: every
         * armed Call, sound mapping and flag in a live world is written against
         * it, and none of them is text anybody reads.
         */
        label: "Resolve", icon: "fa-hand-fist", cost: 3, target: "none", grants: "trait",
        effect: "For one roll, choose which statistic to add yourself."
    },
    freeCrit: {
        label: "Free Critical", icon: "fa-burst", cost: 6, target: "none", grants: "critical",
        effect: "On the next roll you get an automatic critical with the maximum result."
    }
};

/* ==========================================================================
 * DESPAIR CALLS  (GM spends Despair; pool caps at 12 per Monokuma)
 * ========================================================================== */

/**
 * Despair Calls. Same shape as Hope Calls, plus the direct effects a Monokuma's
 * money can buy: damage, stress, project progress, sealed rooms.
 */
export const DESPAIR_CALLS = {
    obstacle: {
        label: "Obstacle", icon: "fa-road-barrier", cost: 1, target: "player", grants: "disadvantage",
        effect: "Disadvantage on a player's roll."
    },
    forTheGame: {
        label: "Approval", icon: "fa-gift", cost: 1, target: "player", grants: "advantage",
        effect: "Advantage on a player's roll."
    },
    behindClosedDoors: {
        label: "Behind Closed Doors", icon: "fa-door-closed", cost: 2, target: "room", sealsRoom: true,
        effect: "Seal a room for one time of day."
    },
    thisWillHurt: {
        /*
         * THREE, NOT TWO (Z9) — the only rise in this pass, and the reason is
         * that it was the cheapest damage on the board while doing the most.
         * Two Health for two Despair, against Paranoia's two Sanity for the
         * same, in a game where Health is four and Sanity is six.
         *
         * The season run makes the case sharper than the ratio does: roughly
         * two thirds of a Monokuma's income spills over the cap of twelve, so a
         * two-point Call is not really priced at two — it is priced at nothing,
         * most of the time. The Calls that hurt are the ones that have to be
         * worth the wait.
         */
        label: "Pain", icon: "fa-heart-crack", cost: 3, target: "player", damage: { hitPoints: 2 },
        effect: "A player loses {hp} Health."
    },
    paranoia: {
        label: "Paranoia", icon: "fa-brain", cost: 2, target: "player", damage: { stress: 2 },
        effect: "A player loses {stress} Sanity."
    },
    chained: {
        // Not in the guide's table — added at the table's request. Priced
        // between Paranoia (2) and Game Integrity (3): losing a time of day's
        // movement is worse than losing 2 Sanity and cheaper than gutting a
        // project, because a room you are already in may be where you wanted
        // to be anyway.
        label: "Chained", icon: "fa-link", cost: 3, target: "player", chains: true,
        effect: "One player cannot leave their room until the end of the time of day."
    },
    silence: {
        // Priced above Chained: cutting off every Hope Call denies advantage,
        // experiences, rerolls and the free critical at once.
        label: "Silence", icon: "fa-comment-slash", cost: 4, target: "player", silences: true,
        effect: "One player cannot spend Hope Calls until the end of the time of day."
    },
    fuelTheCub: {
        // Guide, p. 16: a Monocub "prosi DMa" for the Hope that Meddle costs, and
        // that Hope only exists because a GM converted Despair into it. It was
        // already possible from the Monocub panel; this puts it where a Monokuma
        // is actually standing when they decide to do it — their own sheet.
        //
        // Priced at 1 because it IS the exchange rate: one Despair becomes one
        // Hope, and the Monokuma is buying a Monocub's single Meddle.
        label: "Fuel a Monocub", icon: "fa-hand-holding-heart", cost: 1, target: "monocub",
        grantsHope: 1,
        effect: "Turn {cost} Despair into {hope} Hope for a Monocub, so they can use Confusion."
    },
    /*
     * THE THREE PROJECT CALLS, AND THE SWAP OF 28.08.
     *
     * Game Integrity and the Call now called "Under Control" exchanged
     * EVERYTHING except their keys: the price, the effect and the sentence.
     * Integrity is now the expensive one that empties a project; Under Control
     * is the cheap one that knocks two off it.
     *
     * THE KEYS ARE NOT THE NAMES, and here that is load-bearing rather than
     * untidy. `gameProtection`, `favoriteProject`, `thisWillHurt` and
     * `forTheGame` are stored data: an armed Call sits on an actor flag under
     * its key, every button carries it in `data-drpg-call`, and the cards this
     * world has already posted were written against it. Dawid renamed the four
     * on 28.08 — Under Control, Patronage, Pain, Approval — and the labels are
     * the whole of that change.
     *
     * The whole entry moved rather than the label, because a key still bolted
     * to the other one's effect is a trap laid for whoever opens this file
     * next - `gameProtection` reading `wipesProgress` would have been true and
     * unreadable at the same time. Nothing outside this table names either
     * effect, so `callEffect()` rebuilds both sentences from the fields and
     * the sheet, the receipt and the tooltip follow without being touched.
     *
     * Priced together, which is the point of them sitting together: 3 to slow
     * a project down, 9 to end it. Nine is three quarters of a full pool, and
     * that is the intended shape - a Monokuma who erases a project has spent
     * their time of day on it.
     */
    gameProtection: {
        label: "Under Control", icon: "fa-arrow-trend-down", cost: 3, target: "project", progress: -2,
        effect: "Remove {progress} progress from a project."
    },
    favoriteProject: {
        label: "Patronage", icon: "fa-arrow-trend-up", cost: 3, target: "project", progress: 2,
        effect: "Add {progress} progress to a project."
    },
    gameIntegrity: {
        label: "Game Integrity", icon: "fa-eraser", cost: 9, target: "project", wipesProgress: true,
        effect: "A player project loses all progress."
    },
    contraband: {
        /*
         * FOUR (Z9, Dawid 29.08). The guide's table says 6 and this module has
         * been at 5 since G-01 was decided — so this is the second deliberate
         * step away from that row, and it is worth saying why rather than
         * leaving a number that looks like drift.
         *
         * Destroying one item is a narrow act with a wide reputation: it reads
         * expensive because it is irreversible, and it was priced for the
         * reading. What it actually removes is one object out of three carried
         * slots, replaceable by one Search — while Silence at 4 takes a
         * player's voice for a scene. At five it was the Call that Monokumas
         * described and did not buy.
         */
        label: "Contraband", icon: "fa-trash-can", cost: 4, target: "item",
        effect: "Destroy any one item."
    },
    publicAnnouncement: {
        /*
         * Guide table ("Parish Announcements"): 6 despair. Was priced at 9
         * here, which put it out of reach of a pool that has spent anything.
         *
         * IT IS NOW A SUMMONS, NOT A TELEPORT (E14). The announcement goes out
         * the moment it is bought and everybody is told which room and when;
         * the move itself happens at the start of the NEXT time of day. That
         * turns the Call from a thing done TO the cast into a thing the cast
         * has a time of day to react to - to arrive early, to arrive late, to
         * be somewhere they should not be while everyone else is walking to
         * the Main Hall. The room is public knowledge precisely so that the
         * planning is possible.
         *
         * `defers: true` is read by `applyCall`, which writes the standing
         * order instead of moving anybody, and by the sheet, which turns the
         * tile into its own cancel button while one is pending.
         */
        label: "Public Announcement", icon: "fa-bullhorn", cost: 6, target: "room",
        gathersEveryone: true, defers: true,
        effect: "Call everyone to one room at the start of the next time of day."
    },
    motive: {
        /*
         * MONOKUMA'S MOTIVE, AND THE ONLY WAY TO ONE.
         *
         * Guide, p. 16: a motive is a roleplay reason to kill, announced
         * publicly, lasting at most to the end of the chapter. It used to be
         * free - a GM typed it into `setMotive` and it appeared. Free was
         * wrong. A motive is the single loudest move in the game and the one
         * most likely to end somebody, and Monokuma's moves cost Despair.
         *
         * NINE, deliberately: three quarters of a full pool. A Monokuma who
         * announces a motive has spent their time of day on it and will do
         * almost nothing else, and two of them cannot both announce one
         * without having saved up first. That is the price of the loudest
         * move in the game, and it is the whole reason it is a Call.
         *
         * Three fields rather than one, because a motive that is only a
         * sentence is a motive nobody can hold Monokuma to: the demand, how
         * many times of day it runs, and what happens when it runs out. The
         * countdown lives on the HUD where the cast can watch it.
         */
        label: "Motive", icon: "fa-envelope", cost: 9, target: "none", setsMotive: true,
        effect: "Announce a motive: a demand, a deadline in times of day, and the price of ignoring it."
    },
    newRule: {
        label: "New Rule", icon: "fa-gavel", cost: 12, target: "none", announces: true,
        effect: "Introduce one new killing game rule of your choice."
    }
};

/**
 * The motive's timer.
 *
 * Counted in TIMES OF DAY, and Eclipses do not count - which costs nothing to
 * arrange: `endEclipse()` finishes with a single `advanceTimeOfDay()`, so an
 * Eclipse is a window BEFORE a time of day rather than a tick of its own, and
 * a counter hung on the time-of-day change skips it by construction.
 *
 * Five times of day make one in-fiction day, so the default of three is "by
 * this evening" and the ceiling of ten is two days - long enough for a motive
 * that spans a session boundary, short enough that it cannot be forgotten.
 */
export const MOTIVE = {
    minTimesOfDay: 1,
    maxTimesOfDay: 10,
    defaultTimesOfDay: 3
};

/**
 * A Call's effect line, with its own numbers put back into it.
 *
 * The magnitudes were written out twice: once as data the code acts on
 * (`damage.stress`, `progress`, `grantsHope`, `cost`) and once as a digit in
 * the sentence a GM reads before spending. Rebalancing one of these would have
 * moved the effect and left the sentence describing the old game — and nothing
 * would have failed, which is the worst version of that.
 *
 * The placeholders are the entry's own field names, so a Call that gains a
 * number needs no change here: write `{cost}` in the sentence and it is filled.
 *
 * Not `game.i18n.format` — these strings live in config.mjs, which is the
 * single source of truth about the rules and is deliberately not in the
 * language file (see the note at the top of this file).
 */
export function callEffect(call) {
    const text = call?.effect ?? "";
    if (!text.includes("{")) return text;

    const values = {
        cost: call.cost,
        hp: call.damage?.hitPoints,
        stress: call.damage?.stress,
        hope: call.grantsHope,
        // Written as a negative on the entry, because that is what it does to
        // the project; read as a magnitude here, because "Remove -2 progress"
        // is not a sentence.
        progress: call.progress === undefined ? undefined : Math.abs(call.progress)
    };

    return text.replace(/\{(\w+)\}/g, (whole, key) =>
        values[key] === undefined ? whole : String(values[key]));
}

/* ==========================================================================
 * PROJECTS
 * ========================================================================== */

export const PROJECT_SCALE = {
    trivial: { label: "Trivial", progress: 3 },
    // Key stays `everyday` — it is written on existing project documents. The
    // Player Handbook calls this tier "Standard", so that is what the label says.
    everyday: { label: "Standard", progress: 4 },
    complex: { label: "Complex", progress: 6 },
    desperate: { label: "Desperate", progress: 8 }
};

/* ==========================================================================
 * WHAT A TRAP WATCHES FOR
 * --------------------------------------------------------------------------
 * Dawid, 28.08: "nie jest mozliwe, by GM monitorowal jeden pokoj przez dwie
 * sesje z rzedu i to, co mowia/robia gracze."
 *
 * He is right, and until now the module asked him to. A finished indirect
 * murder sent one card with the killer's typed condition and a Fire button, and
 * then it was the GM's memory against two sessions of play.
 *
 * THE MODULE WATCHES, THE GM FIRES. NEVER THE OTHER WAY ROUND.
 *
 * An engine that opens a murder by itself takes from the GM the one thing a
 * computer is no good at — "not now, we are mid-trial", "she would have noticed
 * that", "wrong person" — and at the same time leaves them the one thing a
 * person is no good at: watching thirty rooms for four hours. So `fireTrap`
 * stays exactly as it is. The only thing that changes is WHEN the card arrives.
 *
 * `watch` is the whole contract: a trigger with one is read off an event, and a
 * trigger without one is the GM saying "I will watch this myself" — which is
 * today's behaviour, on the list, so choosing it is visible next to the eight
 * that are watched rather than being the silent default.
 *
 * `needs: "project"` marks the two that point at another project rather than a
 * room. Everything else is answered by where somebody is standing.
 * ========================================================================== */

export const TRAP_TRIGGERS = {
    /*
     * FIRST ON THE LIST BECAUSE IT IS THE ONE THE GM CANNOT SEE.
     *
     * Somebody being alone is not a thing that happens on screen — it is a
     * property of a room at a moment, and by the time a GM notices it the
     * moment has usually passed. Every other trigger here is a substitute for
     * attention; this one is a substitute for omniscience.
     */
    alone: {
        label: "Somebody is alone in the room",
        hint: "Fires when a character crosses in and finds nobody else there.",
        icon: "fa-user",
        watch: "crossing"
    },
    enters: {
        label: "Somebody enters the room",
        hint: "Fires on any crossing into the room, alone or not.",
        icon: "fa-door-open",
        watch: "crossing"
    },
    search: {
        label: "Somebody searches the room",
        hint: "A successful Search here. The thing in the drawer.",
        icon: "fa-magnifying-glass",
        watch: "action",
        actionKey: "search"
    },
    rest: {
        label: "Somebody rests here",
        hint: "A Rest taken in this room. The mined bedroom.",
        icon: "fa-bed",
        watch: "rest"
    },
    /*
     * THE ONE THAT TRAVELS, and the only one tied to a thing rather than a
     * place. See traps.mjs for the ledger, and `takePlant` for how the thing
     * gets into somebody's hands in the first place.
     */
    item: {
        label: "Somebody uses the planted item",
        hint: "You leave something behind; whoever finds it and uses it is the one it kills.",
        icon: "fa-flask-vial",
        watch: "item",
        needs: "plant"
    },
    project: {
        label: "Somebody works on a named project",
        hint: "Pushing that project forward is what does it — the scaffold, the crane.",
        icon: "fa-hammer",
        watch: "action",
        actionKey: "project",
        needs: "project"
    },
    sabotage: {
        label: "Somebody sabotages a named project",
        hint: "The mirror of the one above: breaking it is what does it.",
        icon: "fa-screwdriver-wrench",
        watch: "action",
        actionKey: "sabotage",
        needs: "project"
    },
    /*
     * THE ONLY ONE THAT CATCHES AN INTENTION RATHER THAN A MOVEMENT — you have
     * to go rummaging through other people's hiding places to set it off.
     *
     * EVERY ATTEMPT, INCLUDING A FAILED ONE (Dawid, 28.08). The trap answers
     * somebody who is looking, not somebody who succeeded, so it does not
     * settle up with the dice.
     */
    stash: {
        label: "Somebody hunts for a hidden stash here",
        hint: "Any attempt, hit or miss. It answers the looking, not the finding.",
        icon: "fa-box-archive",
        watch: "stash"
    },
    /*
     * TODAY'S BEHAVIOUR, WRITTEN DOWN. No `watch`, so nothing listens and the
     * card arrives the moment the project is finished, exactly as it always
     * has. It is on the list so that a GM who wants it has chosen it.
     */
    manual: {
        label: "My own condition, and I will watch for it",
        hint: "The card comes when the project is finished, as it does today.",
        icon: "fa-eye",
        watch: null
    }
};

/**
 * The two things that narrow a trigger, and neither is a trigger of its own.
 *
 * `notBuilder` DEFAULTS TO ON, and it earns the default: without it the most
 * likely thing to set off a trap is its own maker walking out of the room they
 * built it in. That is not an exotic edge case, it is the first thing that
 * happens.
 */
export const TRAP_MODIFIERS = {
    afterDark: {
        label: "Only after dark",
        hint: "Evening, night, or any time an Eclipse is running.",
        icon: "fa-moon",
        default: false
    },
    notBuilder: {
        label: "Not the one who built it",
        hint: "The killer walking out of their own room does not set it off.",
        icon: "fa-user-slash",
        default: true
    }
};

/** Times of day that count as "after dark", plus any Eclipse. */
export const AFTER_DARK = ["evening", "night"];

/* ==========================================================================
 * CHARACTER STATES
 * ========================================================================== */

/**
 * The guide's two player states, as real Foundry status effects.
 *
 * Guide, "Stany gracza": "Gracz przy utracie całego stresu dostaje disadvantage
 * na każdy rzut. Przy utracie całego hp w trakcie Daily Life gracz otrzymuje
 * -1 akcję na porę dnia."
 *
 * Daggerheart marks the same two moments with its own conditions — Vulnerable
 * at full Sanity, and a Death Move at full Health — and neither is this game's rule:
 * a Death Move offers to blaze out in glory, which a killing game does not
 * grant. `states.mjs` switches both of the system's automations off and applies
 * these instead.
 *
 * `resource` is the reverse resource whose track being FULL turns the state on.
 */
export const STATES = {
    breakdown: {
        id: "drpgBreakdown",
        label: "Breakdown",
        resource: "stress",
        // The `-red` variant of this icon does not exist in the core set; the
        // Breakdown condition was showing a broken image on every token.
        img: "icons/magic/control/fear-fright-monster-grin-red-orange.webp",
        trigger: "stress === 0",
        effect: "Disadvantage on every roll."
    },
    wounded: {
        id: "drpgWounded",
        label: "Wounded",
        resource: "hitPoints",
        img: "icons/skills/wounds/injury-triple-slash-bleed.webp",
        trigger: "hp === 0",
        effect: "-1 action per time of day."
    }
};

/* ==========================================================================
 * LEVEL UP
 * --------------------------------------------------------------------------
 * Replaces the Daggerheart level-up entirely. Players who vote correctly pick
 * one option; a Blackened who survives the vote picks three.
 * ========================================================================== */

export const LEVEL_UP_OPTIONS = {
    hp: { label: "Increase Health by +1" },
    stress: { label: "Increase Sanity by +1" },
    trait: { label: "Increase one statistic by +1" },
    experienceUp: { label: "Increase one experience by +1" },
    experienceNew: { label: "Add a new experience worth +2" }
};

export const LEVEL_UP = {
    standard: { picks: 1, when: "Named the Blackened correctly." },
    reinforced: { picks: 3, when: "The Blackened walked out of a wrong vote." }
};

/* ==========================================================================
 * MONOCUB
 * --------------------------------------------------------------------------
 * A dead player joins the GM side. Guide, p. 16: "Ma do dyspozycji tyle akcji
 * co gracze... Ma tylko dwie akcje: ruch i zamieszanie." Same budget as any
 * living student (STARTING.actions, refilled by the same code — nothing
 * Monocub-specific needed there), restricted to two action TYPES. Room
 * visibility stays restricted too: a Monocub is not a Monokuma and does not
 * see tokens outside its own room.
 *
 * Meddle is priced twice over, on purpose: "wymienić ten 1 hope aby użyć akcji
 * zamieszanie" — it costs an action from the normal budget AND a point of
 * Hope, and that Hope only exists because a GM chose to convert Despair into
 * it. A Monocub who has not been given any cannot Meddle at all, however many
 * actions they have left.
 *
 * "Stat: —" in the guide's own table means what it says: this is the one roll
 * in the whole system with no trait behind it, so it is built as a flat 2d12
 * in monocub.mjs rather than forced through a trait it does not have.
 */
export const MONOCUB = {
    /** Same as a living student's. Refilled by the same reset pass. */
    actions: STARTING.actions,
    meddle: {
        // Key stays `meddle` throughout the code; the Player Handbook names this
        // action "Confusion", so that is the label every player and GM sees.
        label: "Confusion",
        icon: "fa-hand-sparkles",
        /** Actions spent from the normal budget. */
        cost: 1,
        /** Hope spent on top of the action. Comes only from a GM's conversion. */
        hopeCost: 1,
        // The lower tier grants a flat +1/-1, the upper tier grants full
        // advantage/disadvantage. Both are armed on the target's very next
        // roll through the same Call machinery Support/Obstacle already use —
        // which is also how "help a crisis action" falls out for free: an
        // incident roll goes through the identical roll dialog.
        thresholds: [
            { min: 12, grants: "bonus",
              help: "You grant the player +1 on their next roll.",
              hinder: "You inflict −1 on the player's next roll." },
            { min: 16, grants: "advantage",
              help: "You grant the player advantage on their next roll.",
              hinder: "You inflict disadvantage on the player's next roll." }
        ],
        critical: {
            help: "The player gets the action back.", hinder: "The player wastes the action."
        },
        failure: "The attempt fails."
    }
};

/* ==========================================================================
 * MURDER
 * ========================================================================== */

/*
 * The guide's seven stages are not modelled as data.
 *
 * Four of them — declaration, preparation, trigger, body discovery — happen at
 * the table, away from it, or through a GM button that has nothing to do with
 * the incident state. Only the three the engine actually drives are stored, as
 * `murderState().stage`: `openingRoll`, `incident`, `resolution`. Their labels
 * live in `DRPG.Murder.stage.*`, which is what the tracker renders.
 */

/**
 * Stage 4 — the opening roll, guide p. 19.
 *
 * THERE IS EXACTLY ONE, and the kind of murder decides whose it is:
 *
 *   direct     the KILLER rolls. They are in the room and the question is
 *              whether they go through with it. The victim never rolls, is
 *              never asked, and on a failure is never told anything happened.
 *   indirect   the VICTIM rolls. There is nobody to confront — the trap is
 *              already set — so the only question is whether they notice it in
 *              time to back out. Being asked to roll is itself the warning.
 *
 * `MURDER_OPENING.victim` therefore describes sensing a TRAP, never sensing an
 * attacker. `openIncidentTracker` offers one button, picked by `state.indirect`.
 *
 * An earlier version of this comment described two rolls, one per side, and the
 * i18n strings were written to match it. That was a misreading of a table the
 * PDF extracts badly; the code has only ever offered one. The strings have been
 * corrected — if anything else here still speaks of "both openings", it is
 * wrong.
 *
 * Night swings whichever roll is actually thrown: the killer gets advantage, the
 * victim disadvantage.
 *
 * `keyRemnants` is the guide's sliding scale — the better the killer's roll, the
 * FEWER clues the case leaves behind, floored at the minimum in KEY_REMNANTS.
 */
export const MURDER_OPENING = {
    killer: {
        label: "Opening roll — killer",
        threshold: 8,
        traits: ["body", "hand"],
        /** Night favours the killer. */
        nightAdvantage: true,
        keyRemnants: { hope: 5, despair: 4, critical: 3 },
        hope: "The incident begins.",
        despair: "The incident begins. The victim loses all their Sanity and loses access to "
            + "Role Reversal for this incident.",
        critical: "The incident begins, and the victim learns who is attacking them.",
        failure: "No incident, and the victim never learns anything was attempted. The action is "
            + "spent; the attempt can be made again in another time of day.",
        /**
         * The same roll, thrown by somebody who is both sides of it.
         *
         * A student taking their own life is a Blackened like any other — it is
         * one of the oldest shapes this story has — and the roll they throw is
         * still the killer's: the numbers, the thresholds and the sliding scale
         * of Key Remnants are all unchanged. Only the prose is, because every
         * line of the ordinary table speaks about a victim who is somebody else.
         * "The victim learns who is attacking them" is not a critical success
         * when the victim already knows; "the victim loses Role Reversal" is a
         * Stage 5 penalty for an incident that has no Stage 5.
         *
         * Read as `def.selfInflicted ?? def`, the same variant idiom
         * `indirectVictim` uses in CRISIS_ACTIONS.
         */
        selfInflicted: {
            label: "Opening roll — by their own hand",
            hope: "It is done. Nothing about the room was arranged: the scene is exactly as "
                + "plain as the act, and it will read that way.",
            despair: "It is done, and something in how it was left will read as somebody "
                + "else's work.",
            critical: "It is done, and left so cleanly that the room barely argues with any "
                + "story the class decides to tell about it.",
            failure: "They could not go through with it. Nobody died, and nobody else ever "
                + "learns it was considered. The action is spent; it can be attempted again "
                + "in another time of day."
        }
    },
    /**
     * INDIRECT MURDERS ONLY. A direct murder never reaches this table.
     *
     * The victim is alone with a trap, and this is their one chance to notice it
     * before it closes. Every outcome below is written from inside that: there is
     * no attacker in the room to identify, only a thing that is about to happen.
     *
     * The victim throws this roll themselves, so unlike a direct murder — where a
     * failed attempt leaves them none the wiser — being asked is already the
     * warning. A success is a real way out, and taking it is their choice.
     */
    victim: {
        label: "Opening roll — victim",
        threshold: 20,
        traits: ["eye", "head"],
        /** Night works against the victim. */
        nightDisadvantage: true,
        hope: "Something is wrong with this room. A free Move, and no idea why — "
            + "spend it and you live.",
        despair: "You work out what has been set up here, and you can tell the others. "
            + "The project behind it stays active.",
        critical: "You spot the trap and know whose hands built it.",
        failure: "You notice nothing. The trap closes.",
        /**
         * Noticing leaves a trace of the attempt.
         *
         * The guide prints "Wyraźny Incident Remnant" under both halves of the
         * victim's successful roll — the Hope one where "próba jest niejawna"
         * and they never learn why, and the Despair one where "ofiara wie, że
         * próbowano ją zabić". Something happened in that room either way, and
         * this is the only Remnant in the whole of Stage 4.
         *
         * The failure row leaves nothing: the trap simply works, and everything
         * it leaves behind is produced by the incident that follows.
         */
        remnant: { hope: "evident", despair: "evident", critical: "evident" }
    }
};

/**
 * Stage 5 — the incident, guide pp. 20–25.
 *
 * A turn-based exchange. The victim always goes first, and every turn costs
 * them: Sanity until it runs out, then Health.
 */
export const INCIDENT = {
    /** Direct murder: 1 per turn. Indirect: the victim is alone and it is 2. */
    drain: { direct: 1, indirect: 2 },
    /**
     * The finishing blow's threshold is five times the victim's remaining Health —
     * which is what makes it free at zero, with no separate flag needed:
     * `finishingBlowThreshold()` returns 0 and any roll clears it.
     */
    finishingBlowPerHp: 5
};

/**
 * Crisis actions, by who may take them. Guide pp. 20–25.
 *
 * Every one of these is a roll with three good branches and one bad, and most
 * of them leave a Remnant either way — which is the point: an incident is the
 * densest source of evidence in the whole game.
 *
 * The module rolls, compares and applies what is mechanical (damage, Remnants,
 * advantage). The prose under each outcome is shown to the GM, because "the
 * victim takes something of the killer's and makes evidence of it" is a
 * sentence a human has to finish.
 */
export const CRISIS_ACTIONS = {
    /**
     * USE AN ITEM, mid-incident. Guide p. 21 ("Użycie przedmiotu"), threshold
     * 15, Hand — and missing from this table until E9, which left the one hole
     * the whole stage had: `useItem()` was reachable straight from the
     * inventory row, so a victim drank a healing kit in the middle of a murder
     * with no roll, no turn and no cost while every other act in the incident
     * paid all three.
     *
     * BOTH SIDES, and that is a deliberate departure. The guide gives it to the
     * victim alone. Symmetry is easier to say at a table than an exception, and
     * a killer in a Role Reversal is losing resources by then too.
     *
     * `hidden`, because it is not a tile. It is reached by pressing "use" on
     * the thing you want to use, which is where a player already looks for it —
     * a fifth tile in the crisis grid saying "use an item" and then asking
     * WHICH would be two decisions where the sheet already offers one.
     *
     * WHAT "SUCCESS" MEANS HERE IS NARROWER THAN ELSEWHERE. A success with
     * Despair still leaves a trace — you were seen fumbling with it — but the
     * item does not go in: see `usesItem` in `resolveCrisisAction`. That is the
     * guide's own table and it is the reason this action needed a field of its
     * own rather than the generic success branch.
     */
    useItem: {
        side: "both", label: "Use an item", icon: "fa-flask",
        threshold: 15, traits: ["hand"],
        hidden: true,
        usesItem: true,
        hint: "Get something out of your pocket while this is happening. "
            + "It works on a critical or a success with Hope; a success with Despair "
            + "leaves a trace and nothing else.",
        remnant: { hope: "evident", despair: "subtle", critical: "obvious" },
        criticalReinforced: true,
        // The guide gives the direct victim a second action and the indirect one
        // the action back. At a table those are the same thing — you act again —
        // so this module has one behaviour and says so rather than building two.
        criticalKeepsTurn: true,
        failure: "It stays in your pocket.",
        failureExtraDrain: { despair: 1 }
    },

    /* ---- the victim ---------------------------------------------------- */
    leaveClue: {
        side: "victim", label: "Leave a clue", icon: "fa-fingerprint",
        threshold: 12, traits: ["hand", "leg", "shadow"],
        hint: "Leave a trace at the scene meant to help the others.",
        remnant: { hope: "evident", despair: "subtle", critical: "obvious" },
        criticalReinforced: true,
        // G-17: a critical does not end the turn. Same field and same mechanism
        // as `useItem` above — the guide gives the direct victim a second action
        // and the indirect one their action back, which at a table is one thing.
        criticalKeepsTurn: true,
        failure: "No Remnant, but advantage on the next attempt. Only on a Hope failure.",
        failureGrantsAdvantage: true,
        /**
         * Dying to a trap is a different problem from dying to a person.
         *
         * The guide prints a SEPARATE table for the indirect victim (p. 20,
         * "Akcje kryzysowe pośredniej ofiary") and it differs in two ways that
         * matter: the stat is Body rather than Shadow — you are not hiding from
         * anyone, there is nobody there — and what a good roll buys is
         * PERMANENCE rather than visibility. Hope leaves a Reinforced trace,
         * Despair a plain one, and a critical leaves two Reinforced.
         *
         * Visibility is left as the direct table's, because the guide does not
         * restate it here and something had to be chosen; the axis it does
         * restate — reinforced, and how many — is what this overrides.
         */
        indirectVictim: {
            traits: ["hand", "leg", "body"],
            reinforced: { hope: true, critical: true },
            count: { critical: 2 }
        }
    },
    secureTrace: {
        side: "victim", label: "Secure a trace", icon: "fa-hand-holding",
        threshold: 15, traits: ["hand", "leg", "shadow"],
        hint: "Take something off the killer and turn it into a trace tied to their identity.",
        remnant: { hope: "evident", despair: "subtle", critical: "obvious" },
        criticalReinforced: true,
        // G-17, as on Leave a clue.
        criticalKeepsTurn: true,
        failure: "No Remnant, but advantage on the next attempt. Only on a Hope failure.",
        failureGrantsAdvantage: true,
        /**
         * Same split as Leave a clue, and the guide's critical here is worded
         * even more explicitly: "2 nieusuwalne przez mordercę, związane z nim
         * Incident Remnants" — two traces the killer cannot wipe in Stage 6.
         * There is no killer in the room to take something FROM, so what the
         * indirect victim secures is the trap itself.
         */
        indirectVictim: {
            traits: ["hand", "leg", "body"],
            reinforced: { hope: true, critical: true },
            count: { critical: 2 }
        }
    },
    /**
     * The gate on the victim's two ways out.
     *
     * Guide, the Samoobrona row: a success "odblokowuje obie akcje kryzysowe
     * rozwiązania ofiary" on Hope, and on Despair only "odwrócenie ról" — and
     * either way it "blokuje akcję kryzysową: Samoobrona", so it is one attempt.
     * A critical also stops the drain outright and hands the victim a free
     * follow-up.
     *
     * Until it lands, Survive and Role reversal are closed: fighting back is
     * what buys the chance to run or to turn the knife around.
     */
    selfDefence: {
        side: "victim", label: "Self-defence", icon: "fa-shield-halved",
        threshold: 18, traits: ["hand", "leg", "body"],
        hint: "You fight. Unlocks Survive and Role reversal. An item usable as a weapon gives "
            + "advantage.",
        weaponAdvantage: true,
        /** Which resolution actions a success opens, per duality band. */
        unlocks: {
            hope: ["survive", "roleReversal"],
            despair: ["roleReversal"],
            critical: ["survive", "roleReversal"]
        },
        /** One attempt: a success closes this action for the rest of the incident. */
        blocksSelf: true,
        /** A critical stops the per-turn drain entirely. */
        criticalStopsDrain: true,
        /*
         * G-18, AND ITS TWO HALVES ARE BOTH LOAD-BEARING.
         *
         * `criticalFreeResolution` opens one of the resolution actions this
         * critical just unlocked and lets it be TAKEN rather than rolled — an
         * automatic success, not an extra attempt. That is what separates it
         * from G-17, which buys another go at the dice.
         *
         * `criticalKeepsTurn` is what makes it reachable at all. The critical's
         * own text has always said "this turn", and Self-defence used to pass
         * the turn the moment it resolved — so a free action valid for this turn
         * would have expired before the player could press anything. The grant
         * lapses at the end of the round either way, so it cannot be banked.
         */
        criticalFreeResolution: true,
        criticalKeepsTurn: true,
        remnant: { hope: "evident", despair: "evident", critical: "evident" },
        criticalReinforced: true,
        hope: "You keep your feet. Survive and Role reversal are open to you now.",
        despair: "You keep your feet, but only barely — Role reversal is open to you now.",
        critical: "You stop the bleeding. Both ways out are open, and you may take one of them "
            + "this turn without rolling.",
        failure: "Nothing happens. On a Despair failure you lose an extra 1 Health or Sanity.",
        /**
         * The line above has said this since the action was written and nothing
         * was doing it — measured while rewriting the outcome cards. Despair
         * only, exactly as worded.
         */
        failureExtraDrain: { despair: 1 },
        /**
         * `critical` is unreachable and left as documentation of the table it
         * came from: a critical is always a success, so the failure branch only
         * ever sees `hope` and `despair`. Same for the three entries like it
         * elsewhere in this file.
         */
        failureRemnant: { hope: "evident", despair: "evident", critical: "obvious" }
    },
    survive: {
        side: "victim", label: "Survive", icon: "fa-person-running",
        threshold: 18, traits: ["leg"], kind: "resolution",
        // Closed until Self-defence lands — see `selfDefence.unlocks`.
        lockedUntil: "selfDefence",
        hint: "Withdraw from the incident and stop losing Health and Sanity. Needs Self-defence first.",
        hope: "The incident ends and the drain stops.",
        despair: "The incident ends and the drain stops. You get a hint about who they were.",
        critical: "The incident ends, you get a hint about who they were, and immunity for this "
            + "chapter and the next.",
        failure: "The incident continues. You lose an extra 1 Health or Sanity.",
        failureExtraDrain: 1,
        endsIncident: true
    },
    roleReversal: {
        side: "victim", label: "Role reversal", icon: "fa-arrows-rotate",
        threshold: 15, traits: ["hand", "leg", "body"], kind: "resolution",
        lockedUntil: "selfDefence",
        hint: "Tip the scales and become the killer yourself. From then on it is them losing "
            + "Health and Sanity. Needs Self-defence first.",
        weaponAdvantage: true,
        hope: "You become the killer and recover all Health and Sanity.",
        despair: "You become the killer.",
        critical: "You kill them outright. They can take no further action. You recover all Health "
            + "and Sanity and leave one Evident Reinforced Incident Remnant.",
        failure: "Nothing happens. On a Despair failure you lose an extra 1 Health or Sanity.",
        /**
         * As on Self-defence, and for the same reason: the sentence above was
         * written from the guide and the code was doing none of it. A victim
         * who tries to turn the knife around and misses on Despair pays for the
         * attempt — which is the only thing separating this from a free reroll
         * every turn.
         */
        failureExtraDrain: { despair: 1 },
        // The critical's own text promises a trace and nothing was creating one:
        // `applyRemnant` reads `remnant[band]`, and this entry had no `remnant`
        // table at all. Same shape of bug as the Dynamic action's missing trace —
        // the outcome was announced and the map stayed empty.
        remnant: { critical: "evident" },
        criticalReinforced: true,
        swapsRoles: true
    },

    /* ---- the killer ---------------------------------------------------- */
    strike: {
        side: "killer", label: "Strike", icon: "fa-hand-fist",
        threshold: 15, traits: ["hand", "leg", "body"],
        hint: "Speed up their decline. Costs 1 Health and 1 Sanity from them.",
        damage: {
            hope: { hp: 1, stress: 1 }, despair: { hp: 1, stress: 1 },
            // A critical is the same two marks, but the killer says where both
            // of them land instead of one going to each. `criticalAmount` is
            // stated rather than inferred from the rows above, so changing what
            // a critical is worth does not mean reading `applyDamage` to find
            // out where the number came from.
            critical: { choice: true }, criticalAmount: 2
        },
        remnant: { hope: "hidden", despair: "subtle", critical: null },
        failure: "Nothing on a Hope failure. On Despair you still take 1 Sanity off them and "
            + "leave an Evident Remnant; a critical failure leaves an Obvious one.",
        failureDamage: { despair: { stress: 1 } },
        failureRemnant: { despair: "evident", critical: "obvious" }
    },
    pin: {
        side: "killer", label: "Pin them down", icon: "fa-down-long",
        threshold: 12, traits: ["body"],
        hint: "Two turns of disadvantage on Leave a clue and Survive.",
        hinders: { actions: ["leaveClue", "survive"], turns: 2 },
        remnant: { despair: "subtle" },
        failureRemnant: { despair: "evident", critical: "obvious" }
    },
    keepDistance: {
        side: "killer", label: "Keep your distance", icon: "fa-arrows-left-right",
        threshold: 12, traits: ["leg"],
        hint: "Two turns of disadvantage on Secure a trace and Role reversal.",
        hinders: { actions: ["secureTrace", "roleReversal"], turns: 2 },
        remnant: { despair: "subtle" },
        failureRemnant: { despair: "evident", critical: "obvious" }
    },
    weaponAttack: {
        side: "killer", label: "Attack with a weapon", icon: "fa-khanda",
        threshold: 15, traits: ["body", "hand", "leg"],
        hint: "Use a found item as a weapon. Unarmed works at disadvantage, and succeeds into "
            + "an improvised tool.",
        /** 1 + tier/2 rounded up on a normal hit; 1 + full tier on a critical. */
        weaponDamage: { normal: tier => 1 + Math.ceil(tier / 2), critical: tier => 1 + tier },
        unarmedDisadvantage: true,
        /**
         * Guide: "Przedmiot tieru 0 jest negocjowalny jako tier 1 lub 2 w ramach
         * kreatywności zabójcy."
         *
         * A Tier 0 item is "a random, seemingly useless object" — a stapler, a
         * skipping rope — and whether swinging it counts for anything is exactly
         * the kind of call the guide hands to a human. So a Tier 0 weapon asks
         * the GM to rate this particular use, rather than silently dealing the
         * 1 damage the formula gives for tier 0 and never mentioning it.
         */
        tierZeroNegotiable: { min: 0, max: 2, prompt: true },
        /**
         * Guide: "Jeśli zabójca nie ma broni, może wykonać atak z disadvantage.
         * Przy sukcesie zyskuje broń improwizowaną, czyli narzędzie.
         * Hope - Tier 2, Despair - Tier 1."
         *
         * The improvised tool is a real Crime Tool on the killer's sheet, not a
         * line of prose — the next Attack with a weapon has to be able to find it.
         */
        unarmedImprovises: { hope: 2, despair: 1, critical: 2, name: "Improvised weapon" },
        remnant: { despair: "subtle" },
        failureRemnant: { despair: "evident", critical: "obvious" },
        failureRemnantReinforced: { critical: true }
    },
    finishingBlow: {
        side: "killer", label: "Finishing blow", icon: "fa-skull-crossbones",
        traits: ["body", "leg", "hand"], kind: "resolution",
        // The old hint ended "without this the victim keeps taking turns at 0 Health
        // and 0 Sanity", which stopped being true when running out started
        // ending the incident on its own. What the roll buys is ending it EARLY,
        // and the critical's free Stage 6 action — neither of which a victim who
        // simply bled out hands over.
        hint: "End the incident now. Threshold is five times their remaining Health — free at 0 Health. "
            + "A victim who runs out of both Health and Sanity dies without this, but then nobody "
            + "earns what a critical here grants.",
        endsIncident: true,
        hope: "The incident ends.",
        despair: "The incident ends and leaves one Incident Remnant.",
        critical: "The incident ends and you gain one free action in Stage 6.",
        remnant: { despair: "evident" },
        failureRemnant: { despair: "evident", critical: "obvious" },
        failureRemnantReinforced: { critical: true }
    },

    /* ---- somebody who walks in -----------------------------------------
     * Guide: "w wypadku, gdy w dowolnym momencie do pomieszczenia w trakcie
     * Incydentu wejdzie strona trzecia poprzez akcję ruch, strona trzecia
     * otrzymuje automatyczny, darmowy wybór między akcjami kryzysowymi
     * rozwiązania bezpośredniej strony trzeciej".
     *
     * FOUR of them, and only the first is a roll. The other three are decisions
     * — the guide gives them no threshold, no stat and no outcome table,
     * because there is nothing to fail at: you either throw in with one side,
     * or you leave. `noRoll` marks them so `takeCrisisAction` applies them
     * outright instead of opening a roll dialog.
     *
     * Zdrada — the fifth entry in the guide — is deliberately NOT here. It is
     * not part of this choice: it happens later ("po zabiciu pierwszego
     * oryginalnego uczestnika"), it "wymaga Rzutu akcji morderstwo
     * bezpośrednie", and the guide calls it "jedyny wyjątek od zasady
     * deklaracji zabójstwa" — that is the Direct Murder action starting a fresh
     * cycle, which the module already has.
     */
    sharedEscape: {
        side: "third", label: "Escape together", icon: "fa-door-open",
        threshold: 15, traits: ["leg"], kind: "resolution",
        hint: "Get the victim out with you.",
        hope: "Both of you escape. The victim's Health and Sanity are restored.",
        despair: "Both of you escape, but the victim's Health and Sanity are not restored.",
        critical: "Both of you escape with immunity for this chapter and the next, and the "
            + "victim's Health and Sanity are restored.",
        /*
         * NOT "the newcomer becomes a second victim" — an incident has exactly
         * one victim, start to finish. That sentence described a rule the
         * module has never had and the guide does not give: two bodies come
         * from the betrayal AFTER the incident, not from two people bleeding
         * inside it. See `afterIncident` in murder.mjs.
         */
        failure: "Only you get out. The victim stays where they are, and your one free choice "
            + "is spent — whatever happens next, it happens without you.",
        remnant: { hope: "obvious", despair: "evident" },
        // A failed escape leaves a trace too. It used to live under
        // `remnant.failure`, which nothing ever read: the failure branch looks up
        // `failureRemnant[band]`, and `band` is only ever hope/despair/critical.
        failureRemnant: { hope: "subtle", despair: "subtle", critical: "subtle" },
        remnantType: "prep",
        endsIncident: true
    },

    /**
     * "Podwójne odwrócenie ról — strona trzecia i ofiara zostają mordercami,
     * czyniąc przeżycie oryginalnego zabójcy prawie niemożliwym."
     *
     * The victim and the newcomer swap onto the killer's side, and the killer
     * becomes the victim. `swapsRoles` is the mechanism Role reversal already
     * uses; `alsoTakesThird` is what makes it double — the third party ends up
     * beside the old victim rather than watching.
     */
    doubleRoleReversal: {
        side: "third", label: "Double role reversal", icon: "fa-repeat",
        kind: "resolution", noRoll: true,
        hint: "You and the victim turn on the attacker together. They become the victim.",
        effect: "The victim and the third party become the killers. The original killer "
            + "starts bleeding and their survival is close to impossible.",
        swapsRoles: true,
        alsoTakesThird: true,
        remnant: { hope: "evident", despair: "evident", critical: "evident" }
    },

    /**
     * "Partnerzy zbrodni — strona trzecia dołącza do mordercy w zabójstwie,
     * czyniąc przeżycie oryginalnej ofiary prawie niemożliwym."
     *
     * No swap: the sides stay as they are and the newcomer joins the killer's.
     * `joinsKiller` is read by `resolveCrisisAction`, which moves them onto the
     * killer side and closes the third party's free choice behind them.
     */
    crimePartners: {
        side: "third", label: "Partners in crime", icon: "fa-handshake",
        kind: "resolution", noRoll: true,
        hint: "Side with the attacker. The victim is unlikely to walk out.",
        effect: "The third party joins the killer. The original victim's survival is "
            + "close to impossible.",
        joinsKiller: true,
        remnant: { hope: "subtle", despair: "subtle", critical: "subtle" }
    },

    /**
     * "Odwrócony wzrok — strona trzecia opuszcza pomieszczenie i nie
     * interweniuje. Może pójść po innych graczy, jednak koszt ruchu z dużym
     * prawdopodobieństwem mu to uniemożliwi."
     *
     * Leaves no trace on purpose: the whole point is that they were never part
     * of it. The movement cost the guide mentions is not modelled here — it is
     * simply the ordinary economy in movement.mjs, which is exactly what the
     * guide means by "koszt ruchu".
     */
    avertedEyes: {
        side: "third", label: "Averted eyes", icon: "fa-eye-slash",
        kind: "resolution", noRoll: true,
        hint: "Walk away and stay out of it. Leaves no trace of you.",
        effect: "The third party leaves the room and does not intervene. They may go and "
            + "fetch the others, though the cost of moving will probably stop them.",
        leavesIncident: true
    }
};

/**
 * The Class Trial, guide pp. 31–32.
 *
 * Only the parts a module can hold: how long an uninterrupted monologue runs,
 * and what a vote does. The session's shape (opening, method, testimony,
 * accusation, closing) is a schedule for humans, not a state machine.
 */
export const TRIAL = {
    /**
     * How long a free discussion runs before the bar turns red.
     *
     * NOT a monologue any more. The guide's original shape was a clockwise
     * queue of three-minute monologues, and that is what this number used to
     * bound; the trial now opens as a free discussion that anyone may speak
     * in, and this is the GM's default budget for it, editable every time
     * they open the floor. It stays 180 because that is the length the table
     * is used to, and because overrunning it is a red bar rather than a
     * hard stop — see `overrun` in trial-floor.mjs.
     */
    speakSeconds: 180,
    /**
     * An OBJECTION buys exactly one minute of silence, then the person it was
     * aimed at gets two minutes to answer back, and then the floor returns to
     * free discussion.
     *
     * Both are fixed rather than GM-editable on purpose: they are the shape of
     * the interruption, not a budget. A GM who needs to cut a rebuttal short
     * has the manual controls in the floor window; a GM who needs a longer one
     * has "+30 s". Making them configurable would turn one rule everybody at
     * the table already knows into a per-world variable nobody can predict.
     */
    objectionSeconds: 60,
    rebuttalSeconds: 120,
    /**
     * A tie is a loss for the players (guide p. 31), but nothing here reads
     * that: `closeVote` publishes the counts and says a tie is a tie, and the
     * GM then presses "Got it wrong" in the verdict dialog. A constant the code
     * consulted would be deciding a verdict the module deliberately never learns
     * — it never finds out who the Blackened was.
     */
    /**
     * You may accuse a Monokuma, somebody already dead, or yourself.
     *
     * The guide is explicit on all three: "Można głosować na Monokumę oraz na
     * martwych graczy" and "Można głosować na siebie". This comment used to end
     * "Not yourself", which was never true of the code — `vote.mjs` has never
     * filtered the voter out of their own ballot — so the only thing it did was
     * describe the rules wrongly in the one file that is meant to be the
     * authority on them.
     */
    allowVotingForDead: true,
    allowVotingForMonokuma: true,
    allowVotingForSelf: true,
    /** Consequences of getting it right, and of getting it wrong. */
    correct: { levelUp: "standard" },
    wrong: {
        /** The Blackened stays anonymous, stays in play, and is rewarded. */
        blackenedLevelUp: "reinforced",
        /** "Każdy DM (Monokuma) zapełnia swoją pulę Despair na maks." */
        fillDespair: true,
        /** "…wprowadza jedną dodatkową, dowolną zasadę za zgodą Monokumy." */
        newRule: true
    }
};

/** Resolution actions cost Sanity rather than actions, and need Sanity > 0. */
export const RESOLUTION_STRESS_COST = 1;

/* ==========================================================================
 * STAGE 6 — CLEANING UP
 * --------------------------------------------------------------------------
 * Guide: "Przedmioty sprzątające ułatwiają rozwiązanie morderstwa", and Stage 6
 * is where the killer finally sees what they left and can spend Sanity trying
 * to erase it.
 *
 * The thresholds are the module's own 9/12/15/18 ladder, read the other way up
 * from Observe's. Finding a trace and destroying one are opposite problems: a
 * hidden smear is hard to notice and trivial to wipe; something obvious is
 * impossible to miss and takes real work to make disappear.
 * ========================================================================== */

export const CLEANUP = {
    /** How hard this trace is to erase, by how visible it is. */
    dc: { hidden: 9, subtle: 12, evident: 15, obvious: 18 },

    /**
     * Covering your tracks is a Shadow job.
     *
     * The FIRST entry is what is actually rolled — the same convention
     * `takeCrisisAction` follows for `CRISIS_ACTIONS[key].traits`. The rest of
     * the list documents what else a GM could reasonably allow, and is the
     * single place to change it.
     *
     * This rolled Hand until the guide was read against it: every one of Stage
     * 6's three actions prints "Stat: Cień", and so does the concealment roll
     * that covers them. Wiping a room down is not dexterity, it is not being
     * seen to have been there.
     */
    traits: ["shadow", "hand", "head"],

    /**
     * An equipped Cleaning Tool grants advantage and takes its tier off the
     * threshold — a purpose-built Tier 3 kit turns an Obvious trace into the
     * same job as an Evident one. `EQUIPPED` is the operative word: the guide's
     * tools are objects in a hand, not entries on a list.
     */
    toolAdvantage: true,
    toolTierReducesDc: true,

    /**
     * What each outcome does to the trace, and what it leaves behind.
     *
     * A Despair success is the guide's whole shape for this stage: you got rid
     * of it, and cleaning is itself something a person does in a room. The trace
     * that replaces it is Faint, so the chapter-end sweep can take it — unlike
     * the failure's, which is not faint and is not going anywhere.
     *
     * Three readings corrected against the guide's own table:
     *   despair       leaves a "Wyraźny" (evident) trace, not a subtle one.
     *   critical      "Morderca odzyskuje 1 stres" — the only Stage 6 outcome
     *                 that hands the Sanity back, and it was not doing it.
     *   failure       the guide splits it. A Hope failure simply does not work
     *                 ("Morderca nie usuwa Remnant." and nothing more); only a
     *                 Despair failure adds "Powstaje Jawny Resolution Remnant".
     *                 One entry for both punished a clean roll that missed as if
     *                 it had gone wrong.
     */
    outcome: {
        critical: { removes: true, leaves: null, refundStress: 1, mayTransform: true },
        hope: { removes: true, leaves: null },
        despair: { removes: true, leaves: { visibility: "evident", faint: true } },
        failureHope: { removes: false, leaves: null },
        failureDespair: { removes: false, leaves: { visibility: "obvious", faint: false } }
    },

    /** Traces the clean-up leaves are Resolution Remnants, per REMNANT_TYPES. */
    remnantType: "resolution",

    /**
     * G-20: what a critical may turn a trace INTO, instead of erasing it.
     *
     * A NEW PERMISSION, NOT A NEW NUMBER. The killer relabels a trace that is
     * already on the map: what kind of thing it is, and how easy it is to see.
     * Erasing is still on the table and is still usually stronger — nothing at
     * all beats a decoy. What this buys is the option to leave something that
     * argues for the wrong story rather than a room that has been scrubbed
     * suspiciously clean.
     *
     * THE CHOICE IS BOUNDED, which is the whole of trap 115. Without a list
     * here, a critical would turn any piece of evidence into any other — and
     * the four types left out are left out for one reason each:
     *
     *   key       the GM placed it for the case to be solvable at all
     *   final     the same, for the Mastermind
     *   autopsy   issued from the GM panel, never found in a room
     *   neutral   a state a Truth Bullet is in, not a kind of trace
     *
     * WHO IT POINTS AT IS NOT ON THIS LIST. `pointsAt` is the Misleading trail's
     * business — its own Stage 6 action, with its own roll and its own price —
     * and folding it in here would make a critical clean-up strictly better than
     * an action somebody has to spend Sanity on.
     */
    transform: {
        types: ["faint", "prep", "incident", "resolution"],
        visibilities: ["obvious", "evident", "subtle", "hidden"]
    },

    /**
     * Both tools are destroyed when Stage 6 closes, not per attempt.
     *
     * The crime tool half is the guide's: a weapon that was used in an incident
     * is gone. The cleaning tool follows it for the
     * same reason — one crime scene, one set of gloves — rather than being spent
     * on each individual wipe, which would make a Tier 3 kit worth exactly one
     * roll and the carry limit of two meaningless.
     */
    /**
     * The crime tool goes when Stage 6 closes. The cleaning tool does NOT.
     *
     * The guide puts them in different stages and it is not an oversight:
     * "Narzędzie zbrodni, jeśli zostało użyte choć raz, zostaje usunięte z
     * ekwipunku mordercy" sits in Stage 6, while the cleaning tool's identical
     * sentence sits in Stage 7, under Odkrycie ciała. Destroying both at once
     * took the gloves off the killer before the body had even been found — and
     * with them any chance to clean again in the time between.
     *
     * See `CLEANUP.destroysToolsOnDiscovery` for the other half.
     */
    destroysTools: ["crimeTool"],

    /** Destroyed when the body is discovered — Stage 7, not Stage 6. */
    destroysToolsOnDiscovery: ["cleaningTool"],

    /**
     * Stage 6 has THREE actions, not one.
     *
     * Only "Zatarcie śladów" was modelled — the fields above are its own, kept
     * at the top level because `cleanupDc`, `cleaningTier` and the Reroll
     * receipt all read them there. The other two are the guide's, verbatim from
     * pp. 26–27, and they are what makes Stage 6 a decision rather than a
     * repeated dice roll against the same trace:
     *
     *   eraseTrace       remove what you left. Priced by how visible it is.
     *   misleadingTrail  leave something that points at somebody else.
     *   moveBody         the body is evidence too, and it can be carried.
     *
     * All three cost 1 Sanity and need the killer in the room, per
     * RESOLUTION_STRESS_COST and `isCleaner`.
     */
    actions: {
        eraseTrace: {
            label: "Erase a trace", icon: "fa-eraser",
            /** DC comes from the trace itself — see `dc` above. */
            dcFromVisibility: true,
            targets: "remnant",
            hint: "Wipe out one trace you left. The harder it is to see, the easier it is to erase."
        },

        /**
         * "Morderca próbuje zostawić dowód włączający innego gracza do kręgu
         * podejrzanych." Thresh 18, Stat Cień.
         *
         * The one Stage 6 action that ADDS evidence on purpose. `pointsAt` has
         * existed on Remnants since remnants.mjs was written and nothing has
         * ever set it; this is what it was for.
         *
         * Note the failure: it still plants the trace, just a Hidden Faint one
         * that probably nobody finds. A Despair failure plants nothing at all.
         */
        misleadingTrail: {
            label: "Misleading trail", icon: "fa-signs-post",
            threshold: 18,
            targets: "player",
            hint: "Plant a Prep Remnant pointing at somebody else.",
            remnant: { hope: "evident", despair: "subtle", critical: "obvious" },
            failureRemnant: { hope: "hidden" },
            failureFaint: true,
            remnantType: "prep",
            refundStress: { critical: 1 }
        },

        /**
         * "Morderca próbuje przenieść ciało ofiary w inne miejsce." Thresh 16,
         * Stat Ciało — the one Stage 6 action that is not Shadow, because
         * carrying a body is exactly the physical problem it looks like.
         *
         * `rooms` is how far it travels: an adjacent room on Hope, a connected
         * one on Despair, and two rooms away on a critical. All three leave an
         * Evident Resolution Remnant — you cannot drag a body quietly.
         */
        moveBody: {
            label: "Move the body", icon: "fa-person-falling",
            threshold: 16,
            traits: ["body"],
            targets: "body",
            hint: "Carry the body somewhere else. Always leaves an Evident trace.",
            rooms: { hope: 1, despair: 1, critical: 2 },
            remnant: { hope: "evident", despair: "evident", critical: "evident" },
            remnantType: "resolution",
            refundStress: { critical: 1 },
            /** A Cleaning Tool helps here too: "+(1*tier narzędzia)". */
            toolBonusPerTier: 1
        }
    },

    /**
     * "Jeśli min. jeden inny gracz zadeklaruje obecność w pomieszczeniu, w
     * którym zabójca realizuje akcje rozwiązania, zabójca na początku akcji
     * musi rzucić kośćmi za ukrycie swoich intencji."
     *
     * The same shape as SABOTAGE_CONCEAL and the indirect murder's, and priced
     * in Sanity rather than in the roll: a Despair success still costs you one,
     * and a Despair failure costs two. Cleaning a room in front of a witness is
     * the most incriminating thing in the game.
     *
     * Called at the top of both Stage 6 entry points — `attemptCleanup` and
     * `attemptStageSix` — so it covers "akcje rozwiązania" as a whole rather
     * than the wipe alone.
     */
    conceal: {
        label: "Cover what you are doing",
        trait: "shadow",
        threshold: 16,
        success: "Nobody works out what you are doing. You may lie freely about it.",
        successWithDespair: "Nobody works out what you are doing, but it costs you.",
        failure: "The others see roughly what you are up to.",
        stress: { successDespair: 1, failureHope: 1, failureDespair: 2 },
        refundStress: { critical: 1 },
        aloneNote: "Nobody else is in the room, so there is nothing to hide."
    }
};

/**
 * The playlist the GM's "put a track on now" control draws from.
 *
 * ONE playlist, by name. The control used to offer every playlist in the world,
 * which made it a second copy of Foundry's own Playlists sidebar sitting inside
 * a panel about the game's state — and it meant the button that is supposed to
 * mean "score this moment" could just as easily start the Investigation's
 * ambient loop by hand and leave the state machine arguing with the GM about
 * which of them was in charge.
 *
 * Matched by name rather than by a stored id: a name is visible in the sidebar
 * and fixable by renaming, an id is neither. The GM makes a playlist called
 * this and puts their stings, their reveals and their silences in it.
 */
export const SITUATIONAL_PLAYLIST = "Situational";

/**
 * The windows this game is PLAYED in, as a selector.
 *
 * Written for the motion layer and now shared with the sound layer, which is
 * why it lives here rather than in either of them: two files importing it from
 * each other is a cycle, and this module has paid for one of those before.
 *
 * The line is drawn around the windows a session happens in — this module's own
 * prompts, the character sheet, and the item cards that are Truth Bullets —
 * rather than around who wrote them. The sheet is the point: it is the window a
 * player opens more often than every other one put together, it belongs to
 * Daggerheart, and a layer that misses it has not covered the interface, it has
 * covered the corners of it.
 *
 * What stays outside is Foundry's own configuration furniture: Token Config,
 * Scene Config, the file picker, the settings screens. Not modesty — those
 * windows are full of `position: fixed` colour pickers and pop-outs, they are
 * the ones that were already glitching on The Forge, and none of them is a
 * moment in a session.
 */
export const GAME_WINDOWS =
    ".application[class*='drpg-'], .application.sheet.actor, .application.sheet.item";

/**
 * The five blocks the Sound panel files its table under.
 *
 * The catalogue of events itself is `SFX_EVENTS` below; the categories come
 * first because the panel groups by them, and a GM hunting for the door sound
 * should not have to read thirty-five rows to find it.
 *
 * These are FILING, NOT VOLUME. There are two sliders — see `SFX_SLIDERS` —
 * and they are deliberately not one per category: a per-category mixing desk is
 * a control nobody at this table asked for, and the only split a player
 * actually reaches for mid-session is "the music" against "everything else".
 *
 * SAFETY IS A CATEGORY OF ONE, AND THAT IS THE POINT. The safeword is the only
 * sound in this game that plays whatever the slider says, and the only one that
 * has to be unmistakable. Filed under "Interface" it would be the sixth row of
 * a block about buttons. Alone at the top of the panel it is a decision the GM
 * has to make on purpose, which is the correct amount of friction for the
 * control that stops the scene.
 *
 * After that, ordered by how often a player hears them.
 */
export const SFX_CATEGORIES = {
    safety:   { label: "Safety",    hint: "The safeword. Ignores the Sound slider — see the event's own note." },
    ui:       { label: "Interface", hint: "Windows, buttons and the chat in the corner." },
    chat:     { label: "Chat",      hint: "Messages, cards, announcements and Calls." },
    world:    { label: "World",     hint: "Rooms, the clock, and the everyday business of a Daily Life." },
    incident: { label: "Incident",  hint: "A death, the investigation, the trial floor and the states that lead there." }
};


/**
 * How far a varied sound may bend, as a fraction of its normal rate.
 *
 * ONE KNOB, NOT THREE. "Pitch and speed" sound like two controls and are one:
 * a Web Audio buffer source has `playbackRate` and `detune`, and `detune` is
 * only that same rate written in cents. Both RESAMPLE — faster is higher AND
 * shorter, like a tape run fast. Changing pitch without changing length needs a
 * phase vocoder, which is an absurd amount of machinery for a click on a
 * button, so this module bends the rate and says so.
 *
 * EIGHT PER CENT, AND THREE WAS WRONG. The note that stood here argued down
 * from five to three because ±5% is "most of a semitone" and would read as out
 * of tune against a playlist. The reasoning was sound and the conclusion was
 * not, because it optimised for the sound the module does NOT have: these
 * eleven events are dry interface clicks — a window, a button, a door, a
 * refusal — with no pitch to be out of tune WITH. Tuning the default so that
 * the worst imaginable file is safe made every real file identical, which is
 * the thing variation exists to prevent. Dawid, 28.08: it is either too weak or
 * not working at all.
 *
 * ±8% is about ±133 cents, a little over a semitone: unmistakably a different
 * click, and still nowhere near a wrong note. A GM who maps a tuned sound to a
 * window and dislikes it has the switch in the Sound panel.
 *
 * GAIN, TOO, AND IT IS HALF OF WHY THIS WAS INAUDIBLE. Rate alone is a weak
 * signal on a sound that lasts 80ms: there is not enough of it for the ear to
 * measure a pitch against. Loudness needs no duration at all. The two together
 * are what make a repeated sound stop sounding pasted, which is what every
 * game that does this actually does.
 *
 * Applied as a FRACTION OF the volume the sliders arrived at, never on top of
 * it — and only downwards, so no varied sound is ever louder than the GM's
 * setting says it may be. A variation that can exceed its own ceiling is a
 * volume control with a leak.
 *
 * Tuned by ear in E17, alongside `YIELD_MS`. Both are numbers no amount of
 * reasoning settles — which is the lesson of the paragraph this one replaced.
 */
/**
 * How far a repeated sound is allowed to wander.
 *
 * `rate` is the FULL reach of the pitch-and-speed bend and `floor` is how close
 * to unbent a play is allowed to land — see `rateFor` in sfx.mjs, which is
 * where the second number does its work.
 *
 * TUNED BY EAR, WHICH IS THE ONLY WAY. Dawid, 28.08, on 0.08: "you can hear it,
 * but it is not enough — it sounds a bit like there are two versions of the
 * sound, they differ so little." The number went to 0.14 and the shape of the
 * draw changed with it, because a wider spread alone would not have answered
 * that sentence: half of a uniform draw lands in the middle and is inaudible.
 *
 * 0.14 is about 227 cents at the edge, a little under two semitones. That is a
 * lot for anything with a pitch and nothing at all for a click — which is what
 * the eleven events that bend actually are. A GM who maps a tonal sting to one
 * of them will hear it wander against the music; the answer then is to leave
 * that event out of the bending list, not to flatten the eleven.
 */
export const SFX_VARIATION = { rate: 0.14, floor: 0.5, gain: 0.18 };

export const SFX_SLIDERS = {
    sound: { label: "Sound", hint: "The sound effects — windows, chat, doors, the trial floor. Not the music." },
    music: { label: "Music", hint: "The playlists. Foundry's own playlist volume, not a second one beside it.", proxiesFoundryMusic: true }
};

/** The sliders this module actually stores a volume for — see above. */
export const SFX_VOLUME_KEYS = Object.entries(SFX_SLIDERS)
    .filter(([, slider]) => !slider.proxiesFoundryMusic)
    .map(([key]) => key);

/**
 * Every sound this module can play, and nothing beyond that.
 *
 * Forty-two events: the seventeen Dawid listed, the eighteen the plan proposed
 * on top of them, the safeword — which arrived later and never updated this
 * count, which is why it read "thirty-five" over thirty-six rows for two
 * updates — five that a play-through found missing, and one that waited for
 * the stage that gives it a voice (`projectDone`, E10). Every one of the
 * additions is a moment that ALREADY has its own place in the code — its own
 * card, its own animation, its own status effect — so wiring it is a line, not
 * a feature.
 *
 * THE LAST FIVE WERE FOUND BY PLAYING, NOT BY PLANNING, and they have one thing
 * in common worth writing down before anybody adds a sixth: every one of them
 * is a FAILURE or an act done TO somebody. The successes in this game were
 * always going to get sounds because somebody was watching for them. What the
 * plan missed is that a consequence nobody is looking at is exactly the
 * consequence that needs announcing — a locked Truth Bullet, a broken tool, a
 * trace left by an attempt that achieved nothing. The rule for a sixth is the
 * same rule that keeps Rest and Listen silent below: not "did something
 * happen", but "would the player otherwise find out too late, or not at all".
 *
 * A ROW IN THE PANEL IS A PROMISE. Map a file here and you will hear it. An
 * entry with no call site behind it is a GM choosing a file, hearing silence,
 * and having no way to tell a missing hook from a broken speaker — and the
 * panel's honest empty state ("not assigned yet") makes that worse rather than
 * better, because it reads as though the silence were their fault. So the
 * catalogue and the call sites ship together: the interface events are wired in
 * E4, everything else in E5, and nothing is listed here ahead of the stage that
 * gives it a voice.
 *
 *   label         what the panel calls it. Handbook copy, not a working label.
 *   hint          one sentence saying WHEN it fires and WHO hears it. "Who"
 *                 carries more than it looks: almost all of these are local to
 *                 the client the thing happened on, and the few that are not
 *                 have to say so — "why did the GM hear that" is the question
 *                 this module's notification diet was written to answer.
 *   category      which block of the table it is filed under. FILING ONLY;
 *                 volume is `SFX_SLIDERS`, and there are two of those.
 *   yieldsTo      optional. Keys that beat this one when both fire at about the
 *                 same moment — see the precedence note in sfx.mjs. Pressing a
 *                 button that opens a window is one gesture and two events, and
 *                 so is pressing the one that closes it: measured on the Sound
 *                 panel, open → tab → Close produced four sounds for three
 *                 acts. The window winning both ways is what makes the footer's
 *                 Close and the frame's X sound alike, which they should,
 *                 because they do the same thing.
 *   ignoresVolume optional. Plays at full whatever the Sound slider says. The
 *                 safeword has it and nothing else ever should.
 *   vary          optional. Bend the rate a little on every play, so the same
 *                 file stops being the same event. OPT-IN, and the opting is
 *                 not a matter of taste: repetition fatigue is a function of
 *                 HOW OFTEN a thing is heard, so the ten events below that fire
 *                 constantly carry it and the thirty that fire once or twice a
 *                 session do not. A verdict never wears out, and it is exactly
 *                 the moment you want THE sound rather than a version of it.
 *
 *                 Default off also because the module ships no audio: we cannot
 *                 know whether a GM mapped a dry click or a musical chord to a
 *                 given key, and "play what they gave you" is the honest
 *                 default for the second case.
 *
 *                 The safeword is excluded in CODE rather than by leaving this
 *                 field off — see `fire`. A safety signal that sounds slightly
 *                 different each time is one the table learns to second-guess,
 *                 and that must not be one edit away from being true.
 *
 * WHERE THE FILING DIFFERS FROM THE PLAN'S OWN TABLE. That table put death,
 * the Truth Bullets, Analyze and the Monocubs under World, leaving Incident
 * with a single member. The category labels are shipped copy a GM reads in the
 * panel, and "World — rooms, the clock, the everyday business of a Daily Life"
 * is not where anybody would look for a corpse. Filed by what the labels say
 * instead. It changes which block a row is drawn in and nothing else.
 *
 * Grouped in `SFX_CATEGORIES` order so the panel can draw the table by walking
 * this object once.
 */
export const SFX_EVENTS = {
    /* ---- Safety ---------------------------------------------------------
     * One event, and the only one in the file with a rule of its own. */
    safeword: {
        label: "The safeword",
        hint: "Somebody stopped the scene. Heard by everyone, at full volume whatever the Sound slider says, and it should sound like nothing else in the game.",
        category: "safety",
        ignoresVolume: true
    },

    /* ---- Interface ------------------------------------------------------ */
    windowOpen: {
        label: "Window opens",
        hint: "Any window this module draws, and a character sheet. Heard by whoever opened it.",
        category: "ui",
        vary: true
    },
    windowClose: {
        label: "Window closes",
        hint: "The same windows on the way out. Heard by whoever closed it.",
        category: "ui",
        vary: true
    },
    windowButton: {
        label: "Button in a window",
        hint: "A button pressed anywhere except a character sheet. Stays quiet when the press opens or closes a window — you hear the window instead.",
        category: "ui",
        yieldsTo: ["windowOpen", "windowClose"],
        vary: true
    },
    sheetButton: {
        label: "Button on a character sheet",
        hint: "The sheet's own controls — actions, equipment, the pips. Separate from the other buttons because a sheet is a window too, and one key could not tell them apart.",
        category: "ui",
        yieldsTo: ["windowOpen", "windowClose"],
        vary: true
    },
    chatOpen: {
        label: "Chat opens",
        hint: "The messenger in the corner of the screen. Heard by whoever opened it.",
        category: "ui",
        vary: true
    },

    /* ---- Chat ----------------------------------------------------------- */
    chatSend: {
        label: "Message sent",
        hint: "Heard by the sender, on the browser that sent it.",
        category: "chat",
        vary: true
    },
    chatReceive: {
        label: "Message arrives",
        hint: "Heard by everyone the thread belongs to — its player and every GM — and never by the sender.",
        category: "chat",
        vary: true
    },
    gmAsk: {
        label: "A player calls for a GM",
        hint: "Heard by the GMs. The request lands in a thread, and a thread is easy to miss in the middle of a busy time of day.",
        category: "chat"
    },
    hopeCall: {
        label: "Hope Call used",
        hint: "Heard by the player who spent it.",
        category: "chat"
    },
    despairCall: {
        label: "Despair Call",
        hint: "A Monokuma spends one. Heard by whoever it lands on, and by the whole table when it is announced publicly.",
        category: "chat"
    },
    newRule: {
        label: "A new rule",
        hint: "A Monokuma adds one to the handbook. Heard by the whole table.",
        category: "chat"
    },
    motive: {
        label: "A motive",
        hint: "A Monokuma announces one, and again when its deadline arrives. Heard by the whole table — a motive nobody heard is not a motive.",
        category: "chat"
    },
    publicAnnouncement: {
        label: "An assembly is called",
        hint: "Everyone is summoned to one room for the next time of day, the order is called off, or the assembly is held. Heard by the whole table.",
        category: "chat"
    },

    /* ---- World ---------------------------------------------------------- */
    roomDiscovered: {
        label: "New room discovered",
        hint: "A room entered for the first time. Heard by the student who walked in.",
        category: "world"
    },
    roomEntered: {
        label: "Room entered",
        hint: "A room already on the map. Heard by whoever crossed the border.",
        category: "world",
        vary: true
    },
    refused: {
        label: "Crossing refused",
        hint: "A wall, a locked door or a sealed room turns somebody back. Heard by whoever tried — the one mistake a player makes regularly.",
        category: "world",
        vary: true
    },
    actionSpent: {
        label: "Action spent",
        hint: "Heard by the player who spent it.",
        category: "world",
        vary: true
    },
    projectDone: {
        label: "A project is finished",
        hint: "The bar filled. Heard by whoever proposed it and by the GMs — never publicly, because a project can be secret. A repair and an armed trap are not this: both have a louder announcement of their own.",
        category: "world"
    },
    critical: {
        label: "A critical roll",
        hint: "Heard by whoever rolled it. The one moment at a roll that the whole table waits for, and until now the only one with a card colour and no sound.",
        category: "world"
    },
    searchNothing: {
        label: "A search finds nothing",
        hint: "Heard by the searcher. The only common failure in the game that is otherwise completely silent.",
        category: "world",
        vary: true
    },
    observeFail: {
        label: "Observe fails",
        hint: "Heard by the observer. It costs Sanity and looks exactly like a success until the card is read.",
        category: "world"
    },
    sabotageFailed: {
        label: "Sabotage fails",
        hint: "Heard by the saboteur. A failed sabotage still leaves its trace, so this is not \"nothing happened\" — it is evidence bought for no gain. Stays quiet when the room saw you do it; you hear that instead.",
        category: "world"
    },
    sabotageSeen: {
        label: "Sabotage witnessed",
        hint: "Despair with somebody else in the room. Heard by the whole table, because the whole table is told.",
        category: "world"
    },
    toolBroke: {
        label: "A tool breaks",
        hint: "Heard by its owner. It changes the next roll, so it has to be noticed at the moment it happens.",
        category: "world"
    },
    stolen: {
        label: "Something was stolen from you",
        hint: "Heard by the victim, and only when the thief was clumsy enough to be noticed.",
        category: "world"
    },
    eclipseStart: {
        label: "The Eclipse begins",
        hint: "Heard by the whole table.",
        category: "world"
    },
    eclipseEnd: {
        label: "The Eclipse ends",
        hint: "Heard by the whole table.",
        category: "world"
    },

    /* ---- Incident ------------------------------------------------------- */
    death: {
        label: "A student dies",
        hint: "Heard by the GMs and by everyone whose character was part of the incident. Nobody else learns of a death this way.",
        category: "incident"
    },
    bodyFound: {
        label: "A body is found",
        hint: "Heard by the whole table. The moment the chapter changes genre.",
        category: "incident"
    },
    cleanupFailed: {
        label: "Cleaning up fails",
        hint: "Heard by the killer. The Sanity is spent either way, and a failure with Despair adds an Obvious trace to the one they were trying to remove.",
        category: "incident"
    },
    breakdown: {
        label: "Breakdown",
        hint: "Sanity reached zero. Heard by that student's player and by the GMs.",
        category: "incident"
    },
    wounded: {
        label: "Wounded",
        hint: "Health reached zero. Heard by that student's player and by the GMs.",
        category: "incident"
    },
    monocub: {
        label: "Monocub changes",
        hint: "A dead student joins the Monocubs, or stops being one. Heard by their player and by the GMs.",
        category: "incident"
    },
    meddle: {
        label: "A Monocub interferes",
        hint: "Heard by the Monocub and by whoever they landed it on — never by anyone else, and it says nothing about WHICH Monocub. The only thing in this game that changes your next roll without you having done anything, which is why the target needs telling: they are not watching the screen.",
        category: "incident"
    },
    yourTurn: {
        label: "Your turn in an incident",
        hint: "Heard by whoever is up. An incident is turn-based and the only other signal is a redrawn HUD.",
        category: "incident"
    },
    truthBullet: {
        label: "Truth Bullet found",
        hint: "Heard by whoever found it.",
        category: "incident"
    },
    analyzeHit: {
        label: "Evidence identified",
        hint: "A successful Analyze. Heard by the student who ran it.",
        category: "incident"
    },
    analyzeMiss: {
        label: "Analysis fails",
        hint: "Heard by the student who ran it. The bullet is locked until the next chapter — the longest-lasting consequence any failed roll in this game has, and it arrived as a whisper with nothing to mark it.",
        category: "incident"
    },
    debateOpen: {
        label: "Nonstop Debate opens",
        hint: "Heard by the whole table. It changes what everyone's Truth Bullet button does.",
        category: "incident"
    },
    objection: {
        label: "Objection",
        hint: "Somebody takes the trial floor. Heard by the whole table.",
        category: "incident"
    },
    voteOpen: {
        label: "The vote opens",
        hint: "Heard by the whole table.",
        category: "incident"
    },
    verdict: {
        label: "The verdict",
        hint: "Heard by the whole table. The most ceremonial moment of a chapter, and the last one that should be silent.",
        category: "incident"
    },
    levelUp: {
        label: "Level up",
        hint: "Heard by the survivor it happened to. The only reward in the whole game.",
        category: "incident"
    }
};

/*
 * WHAT IS DELIBERATELY SILENT, so that nobody adds it back without knowing why.
 *
 *   the time of day changing   the HUD has a scrolling animation and that IS
 *                              its moment; a sound would compete with it
 *   gaining Hope or Despair    the pips already flash, and at two or three
 *                              points a roll a sound becomes a rattle
 *   progress on a project      the same act as spending an action, which
 *                              already has one — two sounds back to back.
 *                              FINISHING one is not this, and E10 gave it
 *                              `projectDone`: the difference is that progress
 *                              happens on the turn you are already watching,
 *                              and the bar filling can happen on somebody
 *                              else's — the person who proposed the thing may
 *                              not have touched it for two days.
 */

/*
 * SAFETY IS MODELLED, BUT NOT AS A CONSTANT IN THIS FILE.
 *
 * This used to read "SAFETY is deliberately not modelled here — the table's
 * safeword is a sentence somebody types into chat and a GM answers", and it
 * stopped being true the day safeword.mjs was written: the word is a button
 * that pauses the game, tells every GM who pressed it and from where, and puts
 * the same card in front of everybody.
 *
 * The word itself is not a constant here because the table gets to choose it.
 * It lives in `SETTINGS.safeword`, is edited in Season setup next to the
 * campaign name, and defaults to "Safe Word" — with worlds that predate the
 * setting keeping MISIUBOMBO, which is what their players have been told.
 */

/** Aggregate export so macros can reach everything through one object. */
export const DRPG = {
    MODULE_ID,
    SOCKET,
    FLAGS,
    ACTIONS_RESOURCE,
    TRAITS,
    TRAIT_BY_DH,
    TRAIT_ARRAY,
    STARTING,
    TIMES_OF_DAY,
    TIME_OF_DAY_LABELS,
    PHASES,
    CHAPTERS_PER_SEASON,
    ROOMS_PER_PLAYER,
    ECLIPSE_MOVES,
    ECLIPSE_FREE_PLACEMENT,
    ROOMS,
    ITEM_TIERS,
    ITEM_CATEGORIES,
    TIER_EFFECTS,
    USABLE_KINDS,
    USABLE_KIND_EFFECTS,
    USABLE_EFFECTS,
    EQUIPPABLE,
    LIMIT_GROUPS,
    REMNANT_VISIBILITY,
    REMNANT_VISIBILITY_LABELS,
    REMNANT_TYPES,
    TRUTH_BULLET_TYPES,
    OBSERVE_DC,
    OBSERVE_TYPE_ALIAS,
    OBSERVE_FAIL_STRESS,
    CRITICAL,
    ANALYZE_DC,
    analyzeDc,
    observeDc,
    KEY_REMNANTS,
    ACTIONS,
    INDIRECT_MURDER,
    BROKEN_ITEMS,
    SABOTAGE_CONCEAL,
    DYNAMIC_THRESHOLDS,
    REST,
    HOPE_CALLS,
    DESPAIR_CALLS,
    MOTIVE,
    PROJECT_SCALE,
    TRAP_TRIGGERS,
    TRAP_MODIFIERS,
    STATES,
    LEVEL_UP_OPTIONS,
    LEVEL_UP,
    MONOCUB,
    MURDER_OPENING,
    INCIDENT,
    CRISIS_ACTIONS,
    TRIAL,
    RESOLUTION_STRESS_COST,
    CLEANUP,
    SITUATIONAL_PLAYLIST,
    GAME_WINDOWS,
    SFX_CATEGORIES,
    SFX_SLIDERS,
    SFX_VOLUME_KEYS,
    SFX_EVENTS,
};
