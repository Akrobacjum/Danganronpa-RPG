/**
 * Danganronpa RPG — static configuration.
 * ---------------------------------------------------------------------------
 * Single source of truth for every number, threshold and table that the
 * "Danganronpa RPG System — Full Guide" defines. Nothing in here touches
 * Foundry; it is plain data so the rest of the module (and macros) can read
 * the rules instead of hardcoding them.
 *
 * If a rule changes in the guide, change it HERE and nowhere else.
 */

export const MODULE_ID = "danganronpa-rpg";

/** Socket channel used for player -> GM requests (search tokens, reveals). */
export const SOCKET = `module.${MODULE_ID}`;

/**
 * Document flag keys, all stored under `flags["danganronpa-rpg"]`.
 * Never spell these out inline — a typo in a flag name fails silently.
 */
export const FLAGS = {
    /** Character: the student's Ultimate talent, shown under their name. */
    ultimate: "ultimate",
    /** Character: how many DRPG advances they have taken. */
    advances: "advances",
    /** Character: has this character already taken their free Move this time of day? */
    freeMoveUsed: "freeMoveUsed",
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
    eye: { dh: "instinct", label: "Eye", short: "EYE", hint: "Perception and noticing." },
    head: { dh: "knowledge", label: "Head", short: "HEA", hint: "Connecting facts." },
    body: { dh: "strength", label: "Body", short: "BOD", hint: "Physical prowess." },
    leg: { dh: "agility", label: "Leg", short: "LEG", hint: "Speed." },
    hand: { dh: "finesse", label: "Hand", short: "HAN", hint: "Dexterity." },
    shadow: { dh: "presence", label: "Shadow", short: "SHA", hint: "Hiding and sixth sense." }
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
    /** Every character starts with one Tier 2 item tied to their Ultimate. */
    startingItemTier: 2,
    /** Two experiences at +2 each. */
    experiences: 2,
    experienceValue: 2
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
    dailyLife: { label: "Daily Life", hint: "Living in the killing game. Two actions per time of day." },
    investigation: { label: "Investigation", hint: "A body was found. Observe and Analyze to build Truth Bullets." },
    classTrial: { label: "Class Trial", hint: "The moment of truth. Objections, testimony, and the vote." }
};

/** Chapters in a canonical season. The modular variant runs a single chapter. */
export const CHAPTERS_PER_SEASON = 6;

/* ==========================================================================
 * ROOMS
 * ========================================================================== */

export const ROOMS = {
    /** Search tokens available per room, per time of day. */
    searchTokensPerRoom: 3,
    /** Rooms a map should offer: playerCount * 1.5 (dormitory counts as one). */
    roomsPerPlayer: 1.5
};

/* ==========================================================================
 * ITEMS
 * --------------------------------------------------------------------------
 * Tier defines effectiveness. Categories carry hard inventory caps; Truth
 * Bullets are deliberately uncapped.
 * ========================================================================== */

export const ITEM_TIERS = [0, 1, 2, 3];

export const ITEM_CATEGORIES = {
    usable: {
        label: "Usable Item",
        plural: "Usable Items",
        limit: 3,
        hint: "Restores HP, Stress or Hope."
    },
    crimeTool: {
        label: "Crime Tool",
        plural: "Crime Tools",
        limit: 1,
        hint: "Makes a murder incident easier."
    },
    cleaningTool: {
        label: "Cleaning Tool",
        plural: "Cleaning Tools",
        limit: 2,
        hint: "Makes covering up a murder easier."
    },
    truthBullet: {
        label: "Truth Bullet",
        plural: "Truth Bullets",
        limit: null,
        hint: "Evidence. No carry limit."
    }
};

/**
 * What each tier means per category. Used by the Search roll tables and by the
 * GM tooling that improvises items.
 */
export const TIER_EFFECTS = {
    usable: {
        0: "Seemingly useless object, open to creative use.",
        1: "Restores 1 HP or 1 Stress.",
        2: "Restores 2 HP or 2 Stress.",
        3: "Restores 2 HP, 2 Stress and 2 Hope."
    },
    crimeTool: {
        0: "Improvised at best.",
        1: "Meant for something else, but usable.",
        2: "At least partly suited to the job.",
        3: "Powerful and purpose-built."
    },
    cleaningTool: {
        0: "Improvised at best.",
        1: "Meant for something else, but usable.",
        2: "At least partly suited to the job.",
        3: "Powerful and purpose-built."
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
        hint: "GM-placed, unremovable, makes the case solvable. Converts to a Truth Bullet without analysis.",
        reinforced: true
    },
    neutral: {
        label: "Neutral Remnant",
        hint: "Unidentified origin. Can be analyzed into a real category."
    },
    faint: {
        label: "Faint Remnant",
        hint: "Doubtful relevance. Wiped at chapter end unless tied to the murder."
    },
    prep: {
        label: "Prep Remnant",
        hint: "Left while preparing a murder, gathering tools or sabotaging."
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
        hint: "State of the body. Always handed out first, no roll needed. Carries time and cause of death."
    },
    final: {
        label: "Final Truth Remnant",
        hint: "One per chapter. Points at the Mastermind and the real reason for the killing game."
    }
};

/**
 * Observe action DCs — guide "Cel obserwacji" table.
 * Rows: how visible the Remnant is. Columns: what kind of Remnant it is.
 * `null` means no roll is required.
 */
export const OBSERVE_DC = {
    obvious: { dailyLife: 8, key: 6, faint: 12, prep: 9, incident: null, resolution: null, autopsy: null },
    evident: { dailyLife: 12, key: 9, faint: 15, prep: 12, incident: null, resolution: null, autopsy: null },
    subtle: { dailyLife: 18, key: 12, faint: 18, prep: 15, incident: null, resolution: null, autopsy: null },
    hidden: { dailyLife: 21, key: 15, faint: 21, prep: 18, incident: null, resolution: null, autopsy: null }
};

/** Failing an Observe roll costs the player Stress. */
export const OBSERVE_FAIL_STRESS = 2;

/**
 * Analyze action DCs — guide "Cel analizy" table. Turns a Neutral Truth Bullet
 * into an identified category. A failed analysis locks that Truth Bullet for
 * that player until the end of the chapter.
 */
export const ANALYZE_DC = {
    obvious: { dailyLife: 8, key: null, faint: 8, prep: 12, incident: null, resolution: null, autopsy: null },
    evident: { dailyLife: 12, key: null, faint: 12, prep: 15, incident: null, resolution: null, autopsy: null },
    subtle: { dailyLife: 18, key: null, faint: 15, prep: 18, incident: null, resolution: null, autopsy: null },
    hidden: { dailyLife: 21, key: null, faint: 18, prep: 21, incident: null, resolution: null, autopsy: null }
};

/** How many Key Remnants the GM prepares, and the floor after the opening roll. */
export const KEY_REMNANTS = {
    prepared: 5,
    minimum: 3,
    /** Guide: five clues scaled trivial -> desperate. */
    scale: ["trivial", "standard", "standard", "complex", "desperate"],
    /** Together they must narrow the suspect pool to this range. */
    suspectRange: [3, 8],
    /** Missing Key Remnants at trial hand each Monokuma this much Despair. */
    despairPerMissing: 3
};

/* ==========================================================================
 * ACTIONS
 * --------------------------------------------------------------------------
 * Actions are implemented as character abilities, not as GM calls. Each entry
 * declares which traits may roll it and what it costs.
 * ========================================================================== */

export const ACTION_KINDS = {
    universal: "Universal",
    rest: "Rest",
    dynamic: "Dynamic",
    crisis: "Crisis",
    resolution: "Resolution",
    monocub: "Monocub"
};

export const ACTIONS = {
    move: {
        kind: "universal",
        label: "Move",
        icon: "fa-shoe-prints",
        traits: [],
        cost: 0,
        hint: "One free Move per time of day. Every extra Move costs an action.",
        description: "Moving inside the room you are already in is free and needs no action at all. "
            + "Crossing into another room spends your free Move for this time of day; after that, "
            + "each further room you enter costs an action. You move to a room directly connected "
            + "to the one you are in.",
        instruction: "To move, drag your token on the map. Crossing into another room is what counts — "
            + "the cost is applied automatically when you arrive."
    },
    search: {
        kind: "universal",
        label: "Search",
        icon: "fa-magnifying-glass",
        traits: ["eye", "hand"],
        cost: 1,
        hint: "Search the room for items. Consumes one of the room's three search tokens.",
        description: "You search the room and may declare what you are looking for. You can find healing "
            + "or stress-relieving items, potential crime tools, or cleaning tools. What turns up can "
            + "depend on the room. Items meant for murder or for cleaning leave a Prep Remnant behind. "
            + "Each room has three search tokens per time of day; once they are spent, the room cannot "
            + "be searched again.",
        thresholds: [
            { min: 8, tier: 0, remnant: "hidden" },
            { min: 12, tier: 1, remnant: "subtle" },
            { min: 18, tier: 2, remnant: "evident" }
        ],
        critical: { tierBonus: 1, remnant: "obvious" },
        failure: "Nothing found.",
        leavesRemnant: { type: "prep", faint: true, onlyFor: ["crimeTool", "cleaningTool"] }
    },
    observe: {
        kind: "universal",
        label: "Observe",
        icon: "fa-eye",
        traits: ["eye"],
        cost: 1,
        callsGm: true,
        hint: "Look for clues. Copies a Remnant into your inventory as a Truth Bullet.",
        description: "You look for clues or anything else of interest. A success copies a Remnant into "
            + "your inventory as a Neutral Truth Bullet — the Remnant itself stays where it is. During "
            + "Daily Life it can instead turn up something useful. Declare how you are looking: a general "
            + "sweep finds the easiest thing in the room, a specific request finds whatever is closest to "
            + "it, and looking for the non-obvious finds the hardest. A failed roll costs 2 Stress.",
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
        callsGm: true,
        hint: "Identify a Neutral Truth Bullet, or ask the GM for a nudge.",
        description: "You put the pieces together. Either analyse a Neutral Truth Bullet to identify what "
            + "it really is, or simply ask the GM for a hint. Analysis that fails locks that Truth Bullet "
            + "away from you until the end of the chapter — it stays in your inventory, still "
            + "unidentified. A critical converts it and earns a substantial hint.",
        dcTable: "ANALYZE_DC",
        /** Used when the player asks for a hint rather than analysing evidence. */
        hintThresholds: [
            { min: 14, result: "A subtle hint. e.g. 'You are far from the target.'" },
            { min: 18, result: "A direct hint. e.g. 'Search room X.'" }
        ],
        hintCritical: { result: "Ask the GM one question. e.g. 'Did the victim really die in this room?'" },
        hintFailure: "No help."
    },
    listen: {
        kind: "universal",
        label: "Listen",
        icon: "fa-ear-listen",
        traits: ["shadow"],
        cost: 1,
        hint: "Work out who is in a neighbouring room. Resolves itself.",
        description: "You listen at the walls and doors. Pick a neighbouring room: a modest result shows "
            + "you how many people are there, but not who — the tokens come back anonymous. A strong "
            + "result names them. A critical sweeps every neighbouring room at once. No GM needed.",
        thresholds: [
            { min: 14, result: "Pick one room; learn whether anyone is there." },
            { min: 18, result: "Pick one room; see the tokens of everyone in it." }
        ],
        critical: { result: "See every player token in all adjacent rooms." },
        failure: "You learn nothing."
    },
    project: {
        kind: "universal",
        label: "Work on Project",
        icon: "fa-hammer",
        traits: ["hand", "body", "leg", "head"],
        cost: 1,
        hint: "Push a project you agreed with the GM. Several characters can work on one and pool progress.",
        description: "Projects take several times of day and many actions. They can grant buffs, raise "
            + "traits, create an item, or in agreed cases change the course of the whole game. Several "
            + "characters can work on one project and their progress adds up. Scale: Trivial 3, Everyday 4, "
            + "Complex 6, Desperate 8 progress. You must be in the room the project belongs to.",
        thresholds: [
            { min: 12, progress: 1 },
            { min: 18, progress: 2 }
        ],
        critical: { progress: 2, refundAction: true },
        failure: "No progress."
    },
    sabotage: {
        kind: "universal",
        label: "Sabotage",
        icon: "fa-screwdriver-wrench",
        traits: ["hand", "body", "leg", "head"],
        cost: 1,
        hint: "Damage a project or object so it needs a repair project. Always leaves a Prep Remnant.",
        description: "You sabotage a project or object the players built, damaging it so that it needs a "
            + "repair project before it works again. A tool obtained by searching grants advantage. Hope "
            + "hides the attempt from the others; Despair reveals it to anyone in the room at the time. "
            + "Sabotage always leaves a Prep Remnant — the better the roll, the harder that trace is to "
            + "find. You must be in the room the project belongs to.",
        thresholds: [
            { min: 12, result: "Success. The target needs a simple repair project.", remnant: "subtle" },
            { min: 18, result: "Success. The target needs a complex repair project.", remnant: "evident" }
        ],
        critical: { result: "Success. The target needs a hidden-difficulty repair project.", remnant: "obvious" },
        failure: "Nothing happens.",
        failureRemnant: "hidden",
        leavesRemnant: { type: "prep", faint: true }
    },
    /**
     * One tile, two rests. Kept together so the action grid stays two rows of
     * five; the choice of short or long is made in the dialog, where the costs
     * and room requirements can be shown side by side.
     */
    rest: {
        kind: "universal",
        label: "Rest",
        icon: "fa-bed",
        traits: [],
        cost: 1,
        hint: "Short Rest: 1 action, pick 1. Long Rest: 2 actions, pick 2, bedroom only.",
        description: "Short Rest — 1 action, choose one: Sleep restores half your marked HP, a Meal clears "
            + "half your Stress, a Breath grants 1 Hope. Once per time of day, in rooms the map marks as "
            + "rest spots.\n\nLong Rest — 2 actions, choose two: Sleep restores all marked HP, a Meal "
            + "clears all Stress, a Breath grants 2 Hope. Once per session, in a bedroom only.\n\nWhich "
            + "rooms allow which rest is set per scene by the GM."
    },
    directMurder: {
        kind: "universal",
        label: "Direct Murder",
        icon: "fa-skull",
        traits: [],
        cost: 1,
        callsGm: true,
        hint: "Open a direct murder. Requires prior agreement with the GM.",
        description: "You commit to killing someone. This is never spontaneous: you agree the plan, the "
            + "location and the victim with the GM before the session, and you have their consent to "
            + "proceed. Spending the action checks that you are alone with your victim — if a third party "
            + "is present, or the victim is not there, nothing happens and the action is still spent. "
            + "The attempt can be made again in another time of day."
    }
};

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
    { range: [8, 12], difficulty: "Utterly trivial; anyone could do it.", tier: 0, remnant: "obvious" },
    { range: [13, 15], difficulty: "Requires practice.", tier: 1, remnant: "evident" },
    { range: [16, 18], difficulty: "Foreign to most people; hard to pick up first try.", tier: 2, remnant: "subtle" },
    { range: [19, 21], difficulty: "Demands extremely niche expertise.", tier: 3, remnant: "hidden" }
];

/* ==========================================================================
 * REST
 * --------------------------------------------------------------------------
 * Long rest: 2 actions, pick 2, once per session, bedroom only.
 * Short rest: 1 action, pick 1, once per time of day, in designated rooms.
 * ========================================================================== */

export const REST = {
    long: { actionCost: 2, picks: 2, perSession: 1, bedroomOnly: true },
    short: { actionCost: 1, picks: 1, perTimeOfDay: 1, bedroomOnly: false },
    options: {
        sleep: { label: "Sleep", long: "Restores all HP", short: "Restores half HP" },
        meal: { label: "Meal", long: "Restores all Stress", short: "Restores half Stress" },
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
        effect: "Give another player in the same room advantage on one roll."
    },
    experience: {
        label: "Experience", icon: "fa-graduation-cap", cost: 1, target: "none", grants: "experience",
        effect: "Add your experience level to the result. The roll must relate to that experience."
    },
    ultimate: {
        label: "Ultimate", icon: "fa-star", cost: 2, target: "none", grants: "advantage",
        effect: "Gain advantage on a roll. The roll must relate to your Ultimate — the GM decides."
    },
    contribution: {
        label: "Contribution", icon: "fa-screwdriver-wrench", cost: 2, target: "project", progress: 1,
        effect: "Add +1 progress to a project being run in your current room."
    },
    reroll: {
        // Not a grant: this one looks backwards, not forwards. It re-rolls the
        // dice you already threw and replaces what they did to you.
        reroll: true, label: "Reroll", icon: "fa-rotate-left", cost: 3, target: "none",
        effect: "Reroll your last action. The new result replaces the old one."
    },
    determination: {
        label: "Determination", icon: "fa-hand-fist", cost: 3, target: "none", grants: "trait",
        effect: "For one roll, choose which trait you add."
    },
    freeCrit: {
        label: "Free Critical", icon: "fa-burst", cost: 6, target: "none", grants: "critical",
        effect: "Take the action and score an automatic critical with no roll."
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
        label: "For the Game", icon: "fa-gift", cost: 1, target: "player", grants: "advantage",
        effect: "Advantage on a player's roll."
    },
    behindClosedDoors: {
        label: "Behind Closed Doors", icon: "fa-door-closed", cost: 2, target: "room", sealsRoom: true,
        effect: "Seal a room for one time of day."
    },
    thisWillHurt: {
        label: "This Will Hurt", icon: "fa-heart-crack", cost: 2, target: "player", damage: { hitPoints: 2 },
        effect: "A player loses 2 HP."
    },
    paranoia: {
        label: "Paranoia", icon: "fa-brain", cost: 2, target: "player", damage: { stress: 2 },
        effect: "A player loses 2 Stress."
    },
    gameIntegrity: {
        label: "Game Integrity", icon: "fa-arrow-trend-down", cost: 3, target: "project", progress: -2,
        effect: "Remove 2 progress from a project."
    },
    favoriteProject: {
        label: "Favorite Project", icon: "fa-arrow-trend-up", cost: 3, target: "project", progress: 2,
        effect: "Add 2 progress to a project."
    },
    contraband: {
        label: "Contraband", icon: "fa-trash-can", cost: 6, target: "item",
        effect: "Destroy any one item."
    },
    publicAnnouncement: {
        label: "Public Announcement", icon: "fa-bullhorn", cost: 9, target: "room", gathersEveryone: true,
        effect: "Monokuma moves every player into a single room."
    },
    newRule: {
        label: "New Rule", icon: "fa-gavel", cost: 12, target: "none", announces: true,
        effect: "Introduce one new killing game rule of your choice."
    },
    gameProtection: {
        label: "Game Protection", icon: "fa-eraser", cost: 12, target: "project", wipesProgress: true,
        effect: "A player project loses all progress."
    }
};

/* ==========================================================================
 * PROJECTS
 * ========================================================================== */

export const PROJECT_SCALE = {
    trivial: { label: "Trivial", progress: 3 },
    everyday: { label: "Everyday", progress: 4 },
    complex: { label: "Complex", progress: 6 },
    desperate: { label: "Desperate", progress: 8 }
};

/* ==========================================================================
 * CHARACTER STATES
 * ========================================================================== */

export const STATES = {
    /** Out of Stress: disadvantage on every roll. */
    breakdown: { label: "Breakdown", trigger: "stress === 0", effect: "Disadvantage on every roll." },
    /** Out of HP during Daily Life: one action fewer per time of day. */
    wounded: { label: "Wounded", trigger: "hp === 0", effect: "-1 action per time of day." }
};

/* ==========================================================================
 * LEVEL UP
 * --------------------------------------------------------------------------
 * Replaces the Daggerheart level-up entirely. Players who vote correctly pick
 * one option; a Blackened who survives the vote picks three.
 * ========================================================================== */

export const LEVEL_UP_OPTIONS = {
    hp: { label: "+1 max HP" },
    stress: { label: "+1 max Stress" },
    trait: { label: "+1 to one trait" },
    experienceUp: { label: "+1 to one experience" },
    experienceNew: { label: "New experience at +2" }
};

export const LEVEL_UP = {
    standard: { picks: 1, when: "Voted for the correct Blackened." },
    reinforced: { picks: 3, when: "Blackened survived a wrong vote." }
};

/* ==========================================================================
 * MONOCUB
 * --------------------------------------------------------------------------
 * A dead player joins the GM side. Two actions only: Move and Meddle.
 * Despair can be converted 1:1 into Monocub Hope to fuel Meddle.
 * ========================================================================== */

export const MONOCUB = {
    actions: STARTING.actions,
    meddle: {
        label: "Meddle",
        cost: 1,
        thresholds: [
            { min: 12, help: "Grant the player +1.", hinder: "Impose -1 on the player." },
            { min: 16, help: "Grant the player advantage.", hinder: "Impose disadvantage on the player." }
        ],
        critical: { help: "The player regains an action.", hinder: "The player wastes an action." },
        failure: "The attempt fails."
    }
};

/* ==========================================================================
 * MURDER
 * ========================================================================== */

export const MURDER_STAGES = [
    "declaration",
    "preparation",
    "trigger",
    "openingRoll",
    "incident",
    "resolution",
    "bodyDiscovery"
];

export const MURDER_STAGE_LABELS = {
    declaration: "Stage 1 — Declaration",
    preparation: "Stage 2 — Preparation",
    trigger: "Stage 3 — Trigger",
    openingRoll: "Stage 4 — Opening Roll",
    incident: "Stage 5 — Incident",
    resolution: "Stage 6 — Resolution",
    bodyDiscovery: "Stage 7 — Body Discovery"
};

/** Resolution actions cost Stress rather than actions, and need Stress > 0. */
export const RESOLUTION_STRESS_COST = 1;

/* ==========================================================================
 * SAFETY
 * ========================================================================== */

export const SAFEWORD = {
    word: "Misiubombo",
    effect: "Stop the scene immediately, ping the GM, resume from an agreed point."
};

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
    ROOMS,
    ITEM_TIERS,
    ITEM_CATEGORIES,
    TIER_EFFECTS,
    REMNANT_VISIBILITY,
    REMNANT_VISIBILITY_LABELS,
    REMNANT_TYPES,
    OBSERVE_DC,
    OBSERVE_FAIL_STRESS,
    ANALYZE_DC,
    KEY_REMNANTS,
    ACTION_KINDS,
    ACTIONS,
    INDIRECT_MURDER,
    DYNAMIC_THRESHOLDS,
    REST,
    HOPE_CALLS,
    DESPAIR_CALLS,
    PROJECT_SCALE,
    STATES,
    LEVEL_UP_OPTIONS,
    LEVEL_UP,
    MONOCUB,
    MURDER_STAGES,
    MURDER_STAGE_LABELS,
    RESOLUTION_STRESS_COST,
    SAFEWORD
};
