/**
 * Danganronpa RPG - Advancement.
 * ---------------------------------------------------------------------------
 * Replaces the Daggerheart level-up entirely. The guide gives two flavours:
 *
 *   Standard    - everyone who voted for the correct Blackened picks ONE.
 *   Reinforced  - a Blackened who survived a wrong vote picks THREE.
 *
 * Options (repeatable - picking "+1 max Health" three times means +3):
 *   +1 max Health · +1 max Sanity · +1 to a trait · +1 to an experience ·
 *   a new experience at +2
 */

import { MODULE_ID, FLAGS, LEVEL_UP, LEVEL_UP_OPTIONS, TRAITS, STARTING } from "./config.mjs";
import { listExperiences, resourceMax } from "./character.mjs";
import { log, error, isPrimaryGm, ownerIdsOf } from "./utils.mjs";
import { SETTINGS } from "./settings.mjs";

const DialogV2 = foundry.applications.api.DialogV2;

/**
 * Resolved on use, not at import time. Foundry moved FormDataExtended under
 * `foundry.applications.ux` and keeps a deprecated global alias; resolving it
 * eagerly would throw during module load on any build that drops the global,
 * taking the whole file down instead of one dialog.
 */
function readFormData(form) {
    const FDE = foundry.applications?.ux?.FormDataExtended ?? globalThis.FormDataExtended;
    if (FDE) return new FDE(form).object;

    // Last resort: plain FormData still gives us every named control.
    return Object.fromEntries(new FormData(form).entries());
}

/**
 * Ask which advancement was earned, then open the picker. This is what the
 * button on the character sheet calls, so the GM never has to remember the
 * argument names.
 *
 * @param {Actor} actor
 */
export async function openAdvancementFor(actor) {
    if (!actor || actor.type !== "character") {
        ui.notifications.warn(game.i18n.localize("DRPG.Character.notACharacter"));
        return null;
    }

    // The module's one menu shape - see `chooseVariant` in action-rolls.mjs.
    // Imported dynamically because this window is opened from a sheet button
    // and a GM console, neither of which is on a path that has already paid
    // for that module.
    const { chooseVariant } = await import("./action-rolls.mjs");

    const picked = await chooseVariant({
        actor,
        title: game.i18n.format("DRPG.Advance.title", { actor: actor.name }),
        prompt: game.i18n.format("DRPG.Advance.whichKind", {
            actor: foundry.utils.escapeHTML(actor.name)
        }),
        options: [
            { value: "standard", icon: "fa-arrow-up",
              label: game.i18n.localize("DRPG.Advance.kind.standard"),
              hint: game.i18n.localize("DRPG.Advance.kind.standardHint") },
            { value: "reinforced", icon: "fa-shield-halved",
              label: game.i18n.localize("DRPG.Advance.kind.reinforced"),
              hint: game.i18n.localize("DRPG.Advance.kind.reinforcedHint") }
        ]
    });

    if (!picked) return null;

    /*
     * WHO PICKS (N-2, Dawid 20.09).
     *
     * The GM decides WHAT was earned - standard or reinforced - and that stays
     * theirs; who chooses the buff is a separate question, and at most tables the
     * answer is the player. Asked as a second menu rather than as four options in
     * the first, because the two questions are not the same kind of question: the
     * first is a ruling about what happened, the second is about who is at the
     * keyboard next.
     */
    const who = await chooseVariant({
        actor,
        title: game.i18n.format("DRPG.Advance.title", { actor: actor.name }),
        prompt: game.i18n.format("DRPG.Advance.whoPicks", {
            actor: foundry.utils.escapeHTML(actor.name)
        }),
        options: [
            { value: "gm", icon: "fa-user-pen",
              label: game.i18n.localize("DRPG.Advance.who.gm"),
              hint: game.i18n.localize("DRPG.Advance.who.gmHint") },
            { value: "player", icon: "fa-paper-plane",
              label: game.i18n.localize("DRPG.Advance.who.player"),
              hint: game.i18n.localize("DRPG.Advance.who.playerHint") }
        ]
    });
    if (!who) return null;

    if (who.value === "player") return offerAdvancement(actor, picked.value);
    return openAdvancement(actor, picked.value);
}

/* ==========================================================================
 * WHERE AN OFFER LIVES (review of stage D, 21.09)
 * ==========================================================================
 *
 * N-2 kept the offer as a flag on the character, and a flag is world data:
 *
 *   - AN OWNER CAN WRITE IT. A player may set flags on their own actor, and the
 *     GM's client checked that same flag before writing a Level Up - so one line
 *     in the console gave a player a Reinforced Level Up, as often as they liked.
 *   - EVERYONE CAN READ IT. After a wrong verdict the GM hands the Blackened a
 *     Reinforced Level Up; until they spent it, any player's console could list
 *     who carried one - the surviving killer, by name.
 *
 * So the offer lives where the module keeps every other secret: in a CLIENT-scoped
 * setting (see secret.mjs, observe.mjs). The PRIMARY GM's copy is the authority,
 * holding every offer; an owner's browser holds only its own characters', written
 * from an addressed message, and uses it for nothing but lighting the button. The
 * primary never reads anything a player can write.
 *
 * DELIVERY, AND AN OWNER WHO WAS NOT THERE. A message sent on `userConnected`
 * arrives before the newcomer's listeners exist (gm-bridge.mjs records the
 * measurement), so the owner ASKS: once when their bridge is up, and again when
 * a primary GM announces itself. The answer is their whole set, so asking twice
 * costs nothing and a withdrawn offer disappears the same way a new one arrives.
 */
function readOffers() {
    try {
        return { ...(game.settings.get(MODULE_ID, SETTINGS.advanceOffers) ?? {}) };
    } catch {
        return {};
    }
}

async function writeOffers(offers) {
    await game.settings.set(MODULE_ID, SETTINGS.advanceOffers, offers);
}

/** Primary GM: write or withdraw one offer, then send each owner their set. */
export async function recordOffer(actorId, kind) {
    if (!isPrimaryGm()) return null;
    const offers = readOffers();
    if (kind && LEVEL_UP[kind]?.picks) offers[actorId] = { kind, at: Date.now() };
    else delete offers[actorId];
    await writeOffers(offers);
    const actor = game.actors.get(actorId);
    const { sendOffersTo } = await import("./gm-bridge.mjs");
    for (const userId of actor ? ownerIdsOf(actor) : []) sendOffersTo(userId);
    return offers[actorId] ?? null;
}

/** Primary GM: the offers standing on this user's own characters - and only those. */
export function offersFor(userId) {
    const user = game.users.get(userId);
    const out = {};
    if (!user || user.isGM) return out;
    for (const [actorId, offer] of Object.entries(readOffers())) {
        const actor = game.actors.get(actorId);
        if (actor?.testUserPermission?.(user, "OWNER") && LEVEL_UP[offer?.kind]?.picks) {
            out[actorId] = { kind: offer.kind };
        }
    }
    return out;
}

/** Owner: replace this browser's copy with the set the primary sent, and redraw. */
export async function receiveOffers(offers) {
    const before = readOffers();
    const mine = {};
    for (const [actorId, offer] of Object.entries(offers ?? {})) {
        // Bounded here as well: only a character this user owns, only a real kind.
        if (game.actors.get(actorId)?.isOwner && LEVEL_UP[offer?.kind]?.picks) {
            mine[actorId] = { kind: offer.kind };
        }
    }
    await writeOffers(mine);
    for (const id of new Set([...Object.keys(before), ...Object.keys(mine)])) {
        game.actors.get(id)?.sheet?.render(false);
    }
}

/** Any GM: an offer is spent or taken back. The primary writes it; others ask it to. */
async function withdrawOffer(actorId) {
    if (isPrimaryGm()) return recordOffer(actorId, null);
    const { requestOfferRecord } = await import("./gm-bridge.mjs");
    return requestOfferRecord(actorId, null);
}

/**
 * Hand the choice to the player (N-2).
 *
 * The offer is the whole mechanism: it lights the button on their sheet, tells
 * the picker which kind was earned, and is what the primary GM checks before it
 * applies anything. It lives in the primary GM's client store, not on the
 * character - see "WHERE AN OFFER LIVES" above. Nothing is written to the
 * character until they have chosen - an offer is not an advancement.
 *
 * WHISPERED, NOT ANNOUNCED. Which advancement somebody earned is between them and
 * the GM until they spend it; a public card would also tell the table who voted
 * correctly, which is the one thing a trial keeps quiet.
 */
export async function offerAdvancement(actor, kind = "standard") {
    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }
    if (!actor || actor.type !== "character") {
        ui.notifications.warn(game.i18n.localize("DRPG.Character.notACharacter"));
        return null;
    }
    if (!LEVEL_UP[kind]?.picks) {
        ui.notifications.error(game.i18n.format("DRPG.Advance.unknownKind", { kind }));
        return null;
    }

    const offer = { kind, by: game.user.id, at: Date.now() };
    try {
        if (isPrimaryGm()) {
            await recordOffer(actor.id, kind);
        } else {
            const { requestOfferRecord } = await import("./gm-bridge.mjs");
            requestOfferRecord(actor.id, kind);
        }
    } catch (err) {
        error(`Could not offer ${actor.name} a Level Up`, err);
        ui.notifications.error(game.i18n.localize("DRPG.Advance.offerFailed"));
        return null;
    }

    const { whisperToOwner } = await import("./utils.mjs");
    const line = game.i18n.format("DRPG.Advance.offered", {
        kind: game.i18n.localize(`DRPG.Advance.kind.${kind}`),
        n: LEVEL_UP[kind].picks
    });
    await whisperToOwner(actor, `<p><strong>${
        game.i18n.localize("DRPG.Advance.offerTitle")}</strong></p><p>${line}</p>`);

    // The sheet is what lights up, and it is open in front of them right now as
    // often as not.
    actor.sheet?.render(false);
    log(`${actor.name} was offered a ${kind} Level Up; the choice is theirs.`);
    ui.notifications.info(game.i18n.format("DRPG.Advance.offerSent", { name: actor.name }));
    return offer;
}

/**
 * The offer standing on this character, if any (N-2) - as THIS browser holds it:
 * every offer on the primary GM, a character's own on its owner's, nothing
 * anywhere else.
 */
export function pendingAdvance(actor) {
    const offer = readOffers()[actor?.id] ?? null;
    return offer && LEVEL_UP[offer.kind]?.picks ? offer : null;
}


/**
 * Open the advancement dialog for an actor.
 *
 * @param {Actor} actor
 * @param {"standard"|"reinforced"} kind
 */
export async function openAdvancement(actor, kind = "standard") {
    /*
     * THE PICKER IS THE PLAYER'S TOO NOW (N-2), AND THE APPLY IS STILL NOT.
     *
     * Advancement is the GM's to award, and this is on `game.drpg` - so without a
     * check any player could call it from the console and raise their own maxima.
     * What opens that door exactly as far as it needs to go is the OFFER: a player
     * may open this window for their own character when the GM has left an offer
     * on it, and what they press sends their picks to the GM's client, which
     * checks the offer again and does the writing. `applyAdvancement` below stays
     * GM-only, because it is the thing that writes.
     */
    const offer = !game.user.isGM ? pendingAdvance(actor) : null;
    const asPlayer = Boolean(offer);
    if (!game.user.isGM && !asPlayer) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }
    if (asPlayer && !actor.isOwner) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }
    // The GM's argument, or the kind the offer was made for - never a kind the
    // player chose, which is the half of this a forged call would reach for.
    if (asPlayer) kind = offer.kind;

    if (!actor || actor.type !== "character") {
        ui.notifications.warn(game.i18n.localize("DRPG.Character.notACharacter"));
        return null;
    }

    const picks = LEVEL_UP[kind]?.picks;
    if (!picks) {
        ui.notifications.error(game.i18n.format("DRPG.Advance.unknownKind", { kind }));
        return null;
    }

    const experiences = listExperiences(actor);

    const result = await DialogV2.wait({
        window: { title: game.i18n.format("DRPG.Advance.title", { actor: actor.name }) },
        classes: ["drpg-advance"],
        content: buildContent(actor, kind, picks, experiences),
        buttons: [
            {
                action: "apply",
                label: game.i18n.localize("DRPG.Advance.apply"),
                default: true,
                callback: (event, button, dialog) => readForm(dialog, picks)
            },
            {
                action: "cancel",
                label: game.i18n.localize("DRPG.Advance.cancel")
            }
        ],
        render: (event, dialog) => wireForm(dialog, picks, actor, experiences),
        rejectClose: false
    });

    if (!result || result === "cancel") return null;

    /*
     * A PLAYER'S PICKS GO TO THE GM, WHO CHECKS THEM AGAINST THE OFFER. The picks
     * are a claim: the count, the options and the character are all checked again
     * on the GM's client before anything is written - see `requestAdvancement` and
     * its handler in gm-bridge.mjs. The offer is cleared by the apply, so pressing
     * twice cannot buy two.
     */
    if (asPlayer) {
        /* A NEW EXPERIENCE WITH NO NAME is caught HERE, on the screen of the person
           who left it blank. The apply's own warning fires on the GM's client, so a
           player's blank name used to warn the GM, spend the offer on the picks that
           did work, and tell the player nothing. The offer is untouched and the
           button is still lit; they press it again. */
        if (result.some(p => p?.option === "experienceNew" && !String(p.name ?? "").trim())) {
            ui.notifications.warn(game.i18n.localize("DRPG.Advance.experienceNeedsNameKept"));
            return null;
        }
        const { requestAdvancement } = await import("./gm-bridge.mjs");
        return requestAdvancement({ actorId: actor.id, picks: result, kind });
    }
    return applyAdvancement(actor, result, kind);
}

/* ==========================================================================
 * FORM
 * ========================================================================== */

function buildContent(actor, kind, picks, experiences) {
    const intro = game.i18n.format(
        picks === 1 ? "DRPG.Advance.introOne" : "DRPG.Advance.introMany",
        { picks, reason: game.i18n.localize(`DRPG.Advance.reason.${kind}`) }
    );

    const rows = Array.from({ length: picks }, (_, i) => `
        <fieldset class="drpg-advance-pick" data-index="${i}">
            <legend>${game.i18n.format("DRPG.Advance.choice", { n: i + 1 })}</legend>
            <select name="pick.${i}.option" data-pick="${i}">
                ${Object.entries(LEVEL_UP_OPTIONS)
                    .map(([key, opt]) => `<option value="${key}">${opt.label}</option>`)
                    .join("")}
            </select>
            <div class="drpg-advance-detail" data-detail="${i}"></div>
        </fieldset>
    `).join("");

    const warning = experiences.length
        ? ""
        : `<p class="notification warning">${game.i18n.localize("DRPG.Advance.noExperiences")}</p>`;

    return `<form><p>${intro}</p>${warning}${rows}</form>`;
}

/** Swap the detail control whenever a pick's option changes. */
function wireForm(dialog, picks, actor, experiences) {
    const root = dialog.element;

    for (let i = 0; i < picks; i++) {
        const select = root.querySelector(`select[data-pick="${i}"]`);
        const detail = root.querySelector(`[data-detail="${i}"]`);
        if (!select || !detail) continue;

        const refresh = () => {
            detail.innerHTML = buildDetail(select.value, i, actor, experiences);
        };
        select.addEventListener("change", refresh);
        refresh();
    }
}

function buildDetail(option, index, actor, experiences) {
    switch (option) {
        case "trait": {
            const options = Object.entries(TRAITS)
                .map(([, t]) => {
                    const value = actor.system.traits?.[t.dh]?.value ?? 0;
                    const sign = value > 0 ? `+${value}` : `${value}`;
                    return `<option value="${t.dh}">${t.label} (${sign})</option>`;
                })
                .join("");
            return `<label>${game.i18n.localize("DRPG.Advance.whichTrait")}
                        <select name="pick.${index}.trait">${options}</select>
                    </label>`;
        }

        case "experienceUp": {
            if (!experiences.length) {
                return `<p class="notification warning">${game.i18n.localize("DRPG.Advance.noExperiences")}</p>`;
            }
            const options = experiences
                .map(e => `<option value="${e.id}">${foundry.utils.escapeHTML(e.name || "-")} (+${e.value ?? 0})</option>`)
                .join("");
            return `<label>${game.i18n.localize("DRPG.Advance.whichExperience")}
                        <select name="pick.${index}.experience">${options}</select>
                    </label>`;
        }

        case "experienceNew":
            return `<label>${game.i18n.localize("DRPG.Advance.newExperienceName")}
                        <input type="text" name="pick.${index}.name" placeholder="${game.i18n.localize("DRPG.Advance.newExperiencePlaceholder")}" />
                    </label>`;

        default:
            return "";
    }
}

function readForm(dialog, picks) {
    const form = dialog.element.querySelector("form");
    if (!form) return null;

    const flat = readFormData(form);
    const data = foundry.utils.expandObject(flat);
    const list = [];

    for (let i = 0; i < picks; i++) {
        const pick = data.pick?.[i];
        if (!pick?.option) continue;
        list.push(pick);
    }
    return list;
}

/* ==========================================================================
 * APPLY
 * ========================================================================== */

/**
 * Turn a list of picks into a single actor update, so three "+1 max Health" picks
 * accumulate instead of overwriting each other.
 */
export async function applyAdvancement(actor, picks, kind = "standard") {
    // Same guard as `openAdvancement`, and for the same reason. This is also on
    // `game.drpg`, and it writes through `automatedUpdate` - which bypasses the
    // resource guard by design - so without it a player could raise their own
    // max Health and traits from the console with a single call, walking straight
    // past the check the dialog in front of it makes.
    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }
    if (!actor || !picks?.length) return null;

    const update = {};
    const summary = [];

    // Start from current values and accumulate.
    let hpMax = resourceMax(actor, "hitPoints");
    let stressMax = resourceMax(actor, "stress");
    const traitDeltas = {};
    const experienceDeltas = {};
    const newExperiences = {};

    for (const pick of picks) {
        switch (pick.option) {
            case "hp":
                hpMax += 1;
                summary.push(LEVEL_UP_OPTIONS.hp.label);
                break;

            case "stress":
                stressMax += 1;
                summary.push(LEVEL_UP_OPTIONS.stress.label);
                break;

            case "trait": {
                const key = pick.trait;
                if (!key) break;
                traitDeltas[key] = (traitDeltas[key] ?? 0) + 1;
                const label = Object.values(TRAITS).find(t => t.dh === key)?.label ?? key;
                summary.push(`+1 ${label}`);
                break;
            }

            case "experienceUp": {
                const id = pick.experience;
                if (!id) break;
                experienceDeltas[id] = (experienceDeltas[id] ?? 0) + 1;
                const name = actor.system.experiences?.[id]?.name ?? id;
                summary.push(`+1 ${name}`);
                break;
            }

            case "experienceNew": {
                const name = String(pick.name ?? "").trim();
                if (!name) {
                    ui.notifications.warn(game.i18n.localize("DRPG.Advance.experienceNeedsName"));
                    break;
                }
                newExperiences[foundry.utils.randomID()] = {
                    name,
                    value: STARTING.experienceValue,
                    description: "",
                    core: false
                };
                summary.push(`${name} (+${STARTING.experienceValue})`);
                break;
            }
        }
    }

    if (hpMax !== resourceMax(actor, "hitPoints")) update["system.resources.hitPoints.max"] = hpMax;
    if (stressMax !== resourceMax(actor, "stress")) update["system.resources.stress.max"] = stressMax;

    for (const [key, delta] of Object.entries(traitDeltas)) {
        const current = actor.system.traits?.[key]?.value ?? 0;
        update[`system.traits.${key}.value`] = current + delta;
    }

    for (const [id, delta] of Object.entries(experienceDeltas)) {
        const current = actor.system.experiences?.[id]?.value ?? 0;
        update[`system.experiences.${id}.value`] = current + delta;
    }

    for (const [id, data] of Object.entries(newExperiences)) {
        update[`system.experiences.${id}`] = data;
    }

    if (!Object.keys(update).length) {
        ui.notifications.warn(game.i18n.localize("DRPG.Advance.nothingToApply"));
        return null;
    }

    try {
        // Marked as automation: `system.traits` is guarded against hand-editing,
        // so a plain update would have the trait rise silently stripped while the
        // Health and Sanity rises went through - a half-applied advancement.
        const { automatedUpdate } = await import("./resource-guard.mjs");
        await automatedUpdate(actor, update);
        const taken = (actor.getFlag(MODULE_ID, FLAGS.advances) ?? 0) + 1;
        await actor.setFlag(MODULE_ID, FLAGS.advances, taken);
        /* AN OFFER IS SPENT BY BEING TAKEN (N-2). Withdrawn here rather than at the
           three call sites - the GM's own picker, a player's picks arriving over the
           socket, and the API - because this is the one place that writes an
           advancement. Through the primary GM, which holds the offers. */
        await withdrawOffer(actor.id);

        log(`Advancement (${kind}) applied to ${actor.name}: ${summary.join(", ")}`);
        await tellPlayer(actor, kind, summary, taken);
        return summary;
    } catch (err) {
        error("Could not apply the advancement", err);
        ui.notifications.error(game.i18n.localize("DRPG.Advance.failed"));
        return null;
    }
}

/** Private note to the player and the GMs. Advancement is not public knowledge. */
async function tellPlayer(actor, kind, summary, taken) {
    const { whisperToOwner } = await import("./utils.mjs");
    const title = game.i18n.localize(`DRPG.Advance.reason.${kind}`);
    const items = summary.map(s => `<li>${foundry.utils.escapeHTML(s)}</li>`).join("");
    /*
     * On the card that already reaches the player, and NOT marked for the GMs.
     *
     * Advancement is the survivor's reward and the GMs are on this whisper as
     * witnesses - the same reason the popup diet leaves them out of a card they
     * were merely copied into. A GM applying an advancement already knows: they
     * are the one who pressed it.
     */
    return whisperToOwner(
        actor,
        `<h3>${game.i18n.format("DRPG.Advance.chatTitle", { n: taken })}</h3>
         <p><em>${title}</em></p>
         <ul>${items}</ul>`,
        { flags: { [MODULE_ID]: { sfx: "levelUp" } } }
    );
}
