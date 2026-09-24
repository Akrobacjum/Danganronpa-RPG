/**
 * The world every harness run starts from: four users (a GM, role 4, and three
 * players, role 1), five actors (each player's character, Daichi with no owner,
 * Monokuma), and one active scene with five tokens and six rectangular rooms.
 * Daichi keeps a stash in the Storage room with one Tool in it (E30, below).
 *
 * Moved here verbatim from cluster.mjs (E30, 24.09.2026) so that the world is
 * one list another reader can take: the E30 plan has the sandbox seeder in
 * audit/live build the same documents from it. Until that exists the cluster
 * is its only reader. `world` is the cluster's store itself, not a template:
 * the cluster applies every write to this object, and every importer in the
 * same process gets the same object, so a second world needs a copy.
 */

import { AUTOMATION_DEFAULT } from "./daggerheart.mjs";

export const IDS = {
    gm: "USERGM0000000000", p1: "USERP10000000000", p2: "USERP20000000000", p3: "USERP30000000000",
    // Not seeded: a scenario that wants the Assistant GM declares it (`accounts`, cluster.mjs).
    ag: "USERAG0000000000",
    aiko: "ACTORAIKO0000000", botan: "ACTORBOTAN000000", chie: "ACTORCHIE0000000", daichi: "ACTORDAICHI00000",
    stashedItem: "ITEMSTASHED00000",
    scene: "SCENEACADEMY0000"
};

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
               cast() takes its three from. */
            { ...studentActor(IDS.daichi, "Daichi Sato", null), items: [{
                _id: IDS.stashedItem, name: "Spare Screwdriver", type: "loot",
                img: "modules/danganronpa-rpg/icons/item-tool.svg",
                system: { description: "", quantity: 1 },
                flags: { "danganronpa-rpg": { category: "tool", tier: 1, location: "vault", stashRoom: "Storage", drpgItemId: "SEEDSTASHEDTOOL1" } }
            }] },
            { ...studentActor("ACTORMONOKUMA000", "Monokuma", null), flags: { "danganronpa-rpg": { monokuma: true } } }
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
