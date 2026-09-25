/**
 * The world every harness run starts from: four users (a GM, role 4, and three
 * players, role 1), six actors (each player's character, Daichi with no owner,
 * Monokuma, and the Remnant actor traces stand on), one active scene with five
 * tokens and six rectangular rooms, and a second scene with one trace on it.
 * Daichi keeps a stash in the Storage room with one Tool in it (E30, below).
 *
 * Moved here verbatim from cluster.mjs (E30, 24.09.2026) so that the world is
 * one list another reader can take: the E30 plan has the sandbox seeder in
 * audit/live build the same documents from it. Until that exists the cluster
 * is its only reader. `world` is the cluster's store itself, not a template:
 * the cluster applies every write to this object, and every importer in the
 * same process gets the same object, so a second world needs a copy.
 */

import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { AUTOMATION_DEFAULT } from "./daggerheart.mjs";

export const IDS = {
    gm: "USERGM0000000000", p1: "USERP10000000000", p2: "USERP20000000000", p3: "USERP30000000000",
    // Not seeded: a scenario that wants the Assistant GM declares it (`accounts`, cluster.mjs).
    ag: "USERAG0000000000",
    aiko: "ACTORAIKO0000000", botan: "ACTORBOTAN000000", chie: "ACTORCHIE0000000", daichi: "ACTORDAICHI00000",
    stashedItem: "ITEMSTASHED00000",
    scene: "SCENEACADEMY0000",
    remnantActor: "ACTORREMNANT0000", annex: "SCENEANNEX000000", trace: "TOKTRACE00000000"
};

/* The name placeRemnant gives every trace token, read from the English file the
   harness loads (its clients know no other language), so the seed cannot drift
   from what the module writes. */
const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const TRACE_NAME = JSON.parse(fs.readFileSync(path.join(HERE, "..", "..", "..", "lang", "en.json"), "utf8")).DRPG.Remnant.tokenName;

function studentActor(id, name, ownerUserId) {
    return {
        _id: id, name, type: "character", img: "icons/svg/mystery-man.svg",
        ownership: { default: 0, ...(ownerUserId ? { [ownerUserId]: 3 } : {}) },
        system: {
            resources: {
                hope: { value: 2, max: 6 },
                stress: { value: 0, max: 6 },
                hitPoints: { value: 0, max: 6 },
                actions: { value: 3, max: 3 }
            },
            traits: {
                agility: { value: 1 }, strength: { value: 0 }, finesse: { value: 1 },
                instinct: { value: 0 }, presence: { value: 1 }, knowledge: { value: 0 }
            },
            experiences: {},
            biography: { background: "", connections: "", notes: "" },
            description: ""
        },
        items: [], effects: [], flags: {}, statuses: []
    };
}

export const world = {
    collections: {
        User: [
            { _id: IDS.gm, name: "GM", role: 4, active: true, character: null, color: "#ff0000", flags: {} },
            { _id: IDS.p1, name: "PlayerOne", role: 1, active: true, character: IDS.aiko, color: "#00ff00", flags: {} },
            { _id: IDS.p2, name: "PlayerTwo", role: 1, active: true, character: IDS.botan, color: "#0000ff", flags: {} },
            { _id: IDS.p3, name: "PlayerThree", role: 1, active: true, character: IDS.chie, color: "#ffaa00", flags: {} }
        ],
        Actor: [
            studentActor(IDS.aiko, "Aiko Hoshino", IDS.p1),
            studentActor(IDS.botan, "Botan Kage", IDS.p2),
            studentActor(IDS.chie, "Chie Mori", IDS.p3),
            /* ONE STASH WITH ONE THING IN IT (E30, 24.09.2026; audit S17-03). The two
               stash invariants in tier 1 ("no stashed thing points at a stash that is
               not there", "every stash belongs to somebody who exists") loop over the
               world's stashes, and this world had none: on 24.09, with the assertion
               counter in and nothing else changed, both FAILed "measured nothing". The
               stash is written as vault.mjs's setStash writes one (the room's
               drpgStashes list) and the item as inventory.mjs's addItem makes a
               stashed Tool (category, tier, location "vault", the room stamped on it,
               an identity). Daichi's, in Storage: nobody's bedroom and no token's
               room, on the one student no player drives, fourth in the roster that
               cast() takes its three from.
               AND A ROLE (E30 review, 25.09.2026): "no item claims a role that does
               not exist" reads every item's `roles` and this world had none, so it
               passed having read nothing. `["crimeTool"]` on a screwdriver filed
               under Tools is inventory.mjs's own example of the flag, written as
               addItem writes a table entry's roles. Stashed, so it arms nobody:
               carriedFor leaves out what is in a stash. */
            { ...studentActor(IDS.daichi, "Daichi Sato", null), items: [{
                _id: IDS.stashedItem, name: "Spare Screwdriver", type: "loot",
                img: "modules/danganronpa-rpg/icons/item-tool.svg",
                system: { description: "", quantity: 1 },
                flags: { "danganronpa-rpg": { category: "tool", tier: 1, location: "vault", stashRoom: "Storage", drpgItemId: "SEEDSTASHEDTOOL1", roles: ["crimeTool"] } }
            }] },
            { ...studentActor("ACTORMONOKUMA000", "Monokuma", null), flags: { "danganronpa-rpg": { monokuma: true } } },
            /* The actor every trace token stands on, as remnants.mjs's ensureRemnantActor
               creates it the first time a trace is placed: an npc named "Remnant", the
               question-mark icon, Observer for everybody, the marker flag. Seeded because
               the trace below stands on it; placeRemnant finds it by name and uses it. */
            { _id: IDS.remnantActor, name: "Remnant", type: "npc", img: "modules/danganronpa-rpg/icons/remnant-unknown.svg",
                ownership: { default: 2 }, system: {}, items: [], effects: [], flags: { "danganronpa-rpg": { isRemnant: true } } }
        ],
        Item: [], ChatMessage: [], RollTable: [], Playlist: [], Macro: [], JournalEntry: [], Folder: [],
        Scene: [{
            _id: IDS.scene, name: "Academy - Floor 1", active: true, width: 4000, height: 3000,
            grid: { size: 100, distance: 5, type: 1 },
            flags: {},
            tokens: [
                { _id: "TOKAIKO000000000", name: "Aiko", actorId: IDS.aiko, actorLink: true, x: 300, y: 300, width: 1, height: 1, hidden: false, flags: {}, texture: { src: "icons/svg/mystery-man.svg" }, disposition: 1 },
                { _id: "TOKBOTAN00000000", name: "Botan", actorId: IDS.botan, actorLink: true, x: 1300, y: 300, width: 1, height: 1, hidden: false, flags: {}, texture: { src: "icons/svg/mystery-man.svg" }, disposition: 1 },
                { _id: "TOKCHIE000000000", name: "Chie", actorId: IDS.chie, actorLink: true, x: 350, y: 1300, width: 1, height: 1, hidden: false, flags: {}, texture: { src: "icons/svg/mystery-man.svg" }, disposition: 1 },
                { _id: "TOKDAICHI0000000", name: "Daichi", actorId: IDS.daichi, actorLink: true, x: 1400, y: 1300, width: 1, height: 1, hidden: false, flags: {}, texture: { src: "icons/svg/mystery-man.svg" }, disposition: 1 },
                { _id: "TOKMONOKUMA00000", name: "Monokuma", actorId: "ACTORMONOKUMA000", actorLink: true, x: 2400, y: 300, width: 1, height: 1, hidden: false, flags: {}, texture: { src: "icons/svg/mystery-man.svg" }, disposition: -1 }
            ],
            regions: [
                { _id: "REGDORMA00000000", name: "Dorm A", shapes: [{ type: "rectangle", x: 200, y: 200, width: 600, height: 600 }], flags: {}, behaviors: [] },
                { _id: "REGCAFE000000000", name: "Cafeteria", shapes: [{ type: "rectangle", x: 1200, y: 200, width: 800, height: 600 }], flags: {}, behaviors: [] },
                { _id: "REGDORMB00000000", name: "Dorm B", shapes: [{ type: "rectangle", x: 200, y: 1200, width: 600, height: 600 }], flags: {}, behaviors: [] },
                { _id: "REGGYM0000000000", name: "Gym", shapes: [{ type: "rectangle", x: 1200, y: 1200, width: 800, height: 600 }], flags: {}, behaviors: [] },
                { _id: "REGHALL000000000", name: "Hall", shapes: [{ type: "rectangle", x: 2200, y: 200, width: 600, height: 600 }], flags: {}, behaviors: [] },
                { _id: "REGSTORAGE000000", name: "Storage", shapes: [{ type: "rectangle", x: 2200, y: 1200, width: 600, height: 600 }],
                    flags: { "danganronpa-rpg": { drpgStashes: [{ actorId: IDS.daichi, concealed: false }] } }, behaviors: [] }
            ],
            walls: []
        }, {
            /*
             * ONE TRACE, AS THE LEDGER ERA LEAVES IT (E30 review, 25.09.2026). "no Remnant
             * token carries the answer key" and "a Remnant token's name gives nothing
             * away" read every trace token on every scene, and this world had none until
             * tier 2 placed one, so tier 1 passed them having read nothing. The token is
             * the world half of what remnants.mjs's placeRemnant writes for a preparation
             * trace: the public name, the Remnant actor, unlinked, the question mark in
             * the neutral tint, half transparent, under the cast, hidden, neutral, the
             * marker flag and nothing else. The other half - the answer key - is the
             * primary GM's ledger, a client setting in that GM's browser, which a world
             * seed does not hold: to the GM this is a trace it has no record of, which
             * remnantData answers with null (remnants.mjs, "A trace this GM has no record
             * of"): the case dashboard and the Key and faint sweeps pass over it, and the
             * GM's ring reads it as a trace of no type.
             *
             * On a scene of its own that is not active: 10-murder reads the first trace
             * on the active scene as the one it placed, and the suite's scenarios place
             * and count theirs on the scene on screen.
             */
            _id: IDS.annex, name: "Academy - Annex", active: false, width: 4000, height: 3000,
            grid: { size: 100, distance: 5, type: 1 },
            flags: {},
            tokens: [
                { _id: IDS.trace, name: TRACE_NAME, actorId: IDS.remnantActor, actorLink: false, x: 1000, y: 1000, width: 1, height: 1,
                    texture: { src: "modules/danganronpa-rpg/icons/remnant-unknown.svg", tint: "#8a8a8a" }, alpha: 0.5, sort: -10,
                    hidden: true, disposition: 0, lockRotation: true, flags: { "danganronpa-rpg": { isRemnant: true } } }
            ],
            regions: [],
            walls: []
        }]
    },
    settings: {
        /* A table that plays with Daggerheart's Hope and Fear automation on (E30,
           24.09.2026). Daggerheart's own default has both flags off
           (lib/daggerheart.mjs, AUTOMATION_DEFAULT), and then no roll pays Hope or
           Fear at all; this world says which it is instead of leaning on a default. */
        "daggerheart.Automation": { ...structuredClone(AUTOMATION_DEFAULT), hopeFear: { gm: true, players: true } }
    }
};
