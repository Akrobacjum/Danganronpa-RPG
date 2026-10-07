/*
 * HARNESS GLUE, NOT DAGGERHEART'S CODE (E33 C2a, 07.10.2026; the window since E33 C2b, 07.10.2026).
 * dhRoll.mjs, d20Roll.mjs and dualityRoll.mjs beside this import it as their `DefaultDialog`; at a
 * table that is Daggerheart's roll window, module/applications/dialogs/d20RollDialog.mjs (2.10.5).
 * Until C2b this was the window pressed at once - `configure` answered the config untouched - so the
 * module's hooks on the window (roll-dialog.mjs) never ran on a roll the harness threw, and a Call's
 * die, a Breakdown's, a room's or an Experience was never on the roll that the GM counted (the plan's
 * E29 Q5 (b)). Scenario 13's one flagged roll is not that gap: it is thrown past the crisis menu that
 * arms its die, and it keeps its flags on this window (e33run/scratch/c2b/logs/s13-after.log).
 *
 * A STAND-IN, SHAPED AS THE WINDOW. Read in Daggerheart's source; Foundry's own ApplicationV2 is the
 * shim's (lib/shim.mjs `buildApplications`), whose render and close fire `renderApplicationV2` and
 * `closeApplicationV2` with Foundry's arguments, so the module's hooks run on this as they are -
 * every other window hook of the module too, as at a table. What it models, line by line:
 *   - the constructor (:7-23): `roll`, `config`, `config.experiences` emptied (:12), `reactionOverride`
 *     from the config's actionType (:13), `selectedEffects`. Not the action and item it looks up (:16-22).
 *   - DEFAULT_OPTIONS (:25-47): a `form` with the window's classes, its five actions and its form
 *     options (:42-46, below). `title` (:49-51) and `actor` (:53-55, the roll data's `parent`).
 *   - `_prepareContext` (:69-141): the costs defaulted (:84); the experiences from the roll data's
 *     `system` (:113-121, not a companion's); advantage, extra formula; `formula` - the roll's own
 *     `constructFormula`, run on every render as there (:133), which is where the window's choices
 *     reach the dice; the abilities when the actor has traits (:134); `showReaction` (:136). Not the
 *     costs' and uses' calculation (:85-107), rally dice, effects.
 *   - the markup the hooks read, from templates/dialogs/dice-roll/ - `_renderHTML` below cites each
 *     element and the roll-dialog.mjs reader it is drawn for. Not Handlebars, labels, icons, layout.
 *   - the actions, as written there: `updateIsAdvantage` (:173-189), `selectExperience` (:191-209),
 *     `toggleReaction` (:211-221), `toggleSelectedEffect` (:223-226), `submitRoll` (:228-230); a click
 *     reaches them through one listener on the window (Foundry's, as the shim's DialogV2 has it), so a
 *     capture listener the module puts on a chip (`lockChip`) refuses it and a disabled button never
 *     fires. `_onClose` (:233-235): unsubmitted, `config` is false. `configure` (:237-243).
 *   - Foundry queues a window's renders, so one asked for inside a render hook (`forceAdvantage`,
 *     `capExperiences`) runs after it, and a render asked of a closed window is none. As remembered of
 *     Foundry, whose source is not on this machine - not read, not measured.
 *   - THE FORM'S SUBMIT ON A CHANGE (since E33 C3, 07.10.2026): `form.handler` and `submitOnChange`
 *     (:42-46). Foundry listens for `change` on a form window and, under `submitOnChange`, runs the
 *     handler with the form's data - as remembered of Foundry's ApplicationV2 and FormDataExtended
 *     (every named control but a button or a disabled one, a checkbox as its state), not read: their
 *     source is not on this machine. Of `updateRollConfiguration` (:150-171) this runs :151 (the
 *     form's data expanded), :169 (`config.extraFormula` - the input roll-dialog.mjs `lockBonus`
 *     writes and says it changed) and :170 (a render). Not :153 (the message mode: this window's
 *     select holds one value, 'public' where Daggerheart's defaults to the core setting, :74), not
 *     :155-158 (the costs and uses), not :159-161 (the dice: `lockDice` disables every select of
 *     them) and not :162-168 (the statistic: `lockTrait` disables its select unless a Determination
 *     Call is armed, and a roll the harness throws has no actor, so no select). Nobody here types or
 *     picks, so the handler runs only on a change the module says it made. The Roll button carries
 *     `type="button"` and its click submits nothing; the template's has no `type`
 *     (rollSelection.hbs:195), and whether a table's Roll click submits the form - copying the input
 *     once more - is Foundry's: not modelled.
 *
 * THE PLAYER. Nobody sits at the harness's window: once its renders have settled, it clicks the
 * experience chips the config arrived with (client-entry.mjs `diceRoll` puts `__forceExperiences`
 * there) - a chip the module locked refuses the click, as at a table - and then Roll. The roll data's
 * `parent` is not in the shim's `getRollData`, so on a roll the harness throws `actor` is undefined:
 * no Statistic select (:134) and an experience's cost is Hope (:203). tests-tier2.mjs `rollWindow`
 * opens this with a `parent` given.
 */
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const TRAITS = ["agility", "strength", "finesse", "instinct", "presence", "knowledge"];   // config/actorConfig.mjs `abilities`
const FACES = [4, 6, 8, 10, 12, 20];                                                       // CONFIG.DH.GENERAL.dieFaces
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
/* The form's data as Foundry's FormDataExtended gives it, as remembered (the header): every named control but a button or a disabled one. */
const formObject = form => Object.fromEntries([...form.elements]
    .filter(el => el.name && el.tagName !== 'BUTTON' && !el.disabled)
    .map(el => [el.name, el.type === 'checkbox' ? el.checked : el.value]));

export default class D20RollDialog extends HandlebarsApplicationMixin(ApplicationV2) {
    #queue = Promise.resolve();
    #wired = false;

    constructor(roll, config = {}, options = {}) {
        super(options);
        this.roll = roll;
        this.config = config;
        this.config.experiences = [];
        this.reactionOverride = config.actionType === 'reaction';
        this.selectedEffects = this.config.bonusEffects;
    }

    static DEFAULT_OPTIONS = {
        tag: 'form',
        classes: ['daggerheart', 'dialog', 'dh-style', 'views', 'roll-selection'],
        position: { width: 'auto' },
        window: { icon: 'fa-solid fa-dice' },
        actions: {
            updateIsAdvantage: this.updateIsAdvantage,
            selectExperience: this.selectExperience,
            toggleReaction: this.toggleReaction,
            toggleSelectedEffect: this.toggleSelectedEffect,
            submitRoll: this.submitRoll
        },
        form: {
            handler: this.updateRollConfiguration,
            submitOnChange: true,
            submitOnClose: false
        }
    };

    get title() {
        return `${this.config.title}${this.actor ? `: ${this.actor.name}` : ''}`;
    }

    get actor() {
        return this.config?.data?.parent;
    }

    render(options = {}) {
        const force = options === true || options?.force === true;
        const next = this.#queue.then(() => (force || this.rendered ? super.render(options) : this));
        this.#queue = next.catch(() => {});
        return next;
    }

    /* Every render asked for so far, and those they asked for, done. */
    async settled() {
        let at;
        do { at = this.#queue; await at; } while (at !== this.#queue);
    }

    async _prepareContext() {
        const context = { rollConfig: this.config, hasRoll: !!this.config.roll, canRoll: true };
        context.selectedMessageMode = this.config.selectedMessageMode ?? 'public';
        context.selectedEffects = this.selectedEffects;
        this.config.costs ??= [];
        context.costs = this.config.costs;
        if (this.roll) {
            context.roll = this.roll;
            context.rollType = this.roll?.constructor.name;
            const experiences = this.config.data?.system?.experiences || {};
            context.experiences = Object.keys(experiences).map(id => ({ id, ...experiences[id] }));
            context.selectedExperiences = this.config.experiences;
            context.advantage = this.config.roll?.advantage;
            context.extraFormula = this.config.extraFormula;
            context.formula = this.roll.constructFormula(this.config);
            if (this.actor?.system?.traits) context.abilities = TRAITS;
            context.showReaction = !this.config.skips?.reaction && context.rollType === 'DualityRoll';
            context.reactionOverride = this.reactionOverride;
        }
        return context;
    }

    async _renderHTML(c) {
        const roll = c.roll ?? {};
        const option = (value, selected, label = value) => `<option value="${esc(value)}"${selected ? ' selected' : ''}>${esc(label)}</option>`;
        const off = c.advantage ? '' : ' disabled';
        // header.hbs:4-9 - `forceReaction` reads [data-action="toggleReaction"] and its <i>.
        const header = c.showReaction
            ? `<header class="dialog-header"><div class="reaction-chip${c.reactionOverride ? ' selected' : ''}" data-action="toggleReaction"><span><i class="${c.reactionOverride ? 'fa-solid' : 'fa-regular'} fa-circle"></i></span></div></header>`
            : '<header class="dialog-header"></header>';
        // rollSelection.hbs:38, :48 - `lockDice` reads select[name^="roll.dice."].
        const dice = c.rollType === 'DualityRoll'
            ? `<div class="dices-section"><select name="roll.dice.dHope">${option(roll.dHope?.denomination ?? 'd12', true)}</select><select name="roll.dice.dFear">${option(roll.dFear?.denomination ?? 'd12', true)}</select></div>`
            : '';
        // rollSelection.hbs:114-126 - `lockExperiences` reads [data-action="selectExperience"].
        const chips = (c.experiences ?? []).filter(e => e.name).map(e =>
            `<div class="experience-chip${c.selectedExperiences?.includes(e.id) ? ' selected' : ''}" data-action="selectExperience" data-key="${esc(e.id)}">${esc(e.name)} ${Number(e.value) >= 0 ? '+' : ''}${esc(e.value)}</div>`).join('');
        // rollSelection.hbs:127-179 - `lockAdvantage` and the unlocked branch read .advantage-chip and
        // .disadvantage-chip, `lockDice` the .modifier-container .nest-inputs selects, `lockTrait`
        // select[name="trait"], `lockBonus` input[name="extraFormula"].
        const modifiers = `<fieldset class="modifier-container"><div class="nest-inputs">`
            + `<button type="button" class="advantage-chip${c.advantage === 1 ? ' selected' : ''}" data-action="updateIsAdvantage" data-advantage="1"><span><i class="${c.advantage === 1 ? 'fa-solid' : 'fa-regular'} fa-circle"></i></span></button>`
            + `<button type="button" class="disadvantage-chip${c.advantage === -1 ? ' selected' : ''}" data-action="updateIsAdvantage" data-advantage="-1"><span><i class="${c.advantage === -1 ? 'fa-solid' : 'fa-regular'} fa-circle"></i></span></button></div>`
            + `<div class="nest-inputs"><select name="roll.dice.advantageNumber"${off}>${Array.from({ length: 10 }, (_, i) => option(i + 1, roll.advantageNumber === i + 1)).join('')}</select>`
            + `<select name="roll.dice.advantageFaces"${off}>${FACES.map(f => option(f, roll.advantageFaces === f, `d${f}`)).join('')}</select></div>`
            + (c.abilities ? `<select name="trait">${option('', !this.config.roll?.trait)}${c.abilities.map(t => option(t, this.config.roll?.trait === t)).join('')}</select>` : '')
            + `<input type="text" name="extraFormula" value="${esc(c.extraFormula)}"></fieldset>`;
        // costSelection.hbs:1-19 (rollSelection.hbs:183-185) - `hideCostSection` reads input[name^="costs."].
        const costs = c.costs?.length
            ? `<fieldset class="one-column"><ul>${c.costs.map((cost, i) => `<li class="scalable-input"><input name="costs.${i}.enabled" type="checkbox"${cost.enabled === false ? '' : ' checked'}></li>`).join('')}</ul></fieldset>`
            : '';
        // rollSelection.hbs:188-196 - the formula; the mode select `lockControls` disables; the button
        // whose <i class="fa-dice"> the render hook turns into a d12.
        const controls = `<span class="formula-label">${esc(c.formula)}</span><div class="roll-dialog-controls">`
            + `<select class="roll-mode-select" name="selectedMessageMode">${option(c.selectedMessageMode, true)}</select>`
            + `<button type="button" class="submit-btn" data-action="submitRoll"${c.canRoll ? '' : ' disabled'}><i class="fa-solid fa-dice"></i></button></div>`;
        // rollSelection.hbs:2 - `showWaitingCalls` writes into .roll-dialog-container.
        return `${header}<div class="roll-dialog-container">${dice}${chips ? `<fieldset class="experience-container">${chips}</fieldset>` : ''}${modifiers}${costs}${controls}</div>`;
    }

    async _replaceHTML(html, element) {
        element.innerHTML = html;
    }

    async _onRender() {
        if (this.#wired) return;
        this.#wired = true;
        this.element.addEventListener('click', event => {
            const target = event.target?.closest?.('[data-action]');
            const handler = target && this.options.actions?.[target.dataset.action];
            if (typeof handler !== 'function') return;
            event.preventDefault();
            handler.call(this, event, target);
        });
        // A change in the form submits it to its handler under `submitOnChange` (the header).
        this.element.addEventListener('change', event => {
            const { handler, submitOnChange } = this.options.form ?? {};
            if (!submitOnChange || typeof handler !== 'function') return;
            event.preventDefault();
            handler.call(this, event, this.element, { object: formObject(this.element) });
        });
    }

    /* :150-171, the lines the header names: the extra formula copied into the config, then a render. */
    static updateRollConfiguration(_event, _, formData) {
        const { ...rest } = foundry.utils.expandObject(formData.object);
        this.config.extraFormula = rest.extraFormula;
        this.render();
    }

    static updateIsAdvantage(_, button) {
        const advantage = Number(button.dataset.advantage);
        this.advantage = advantage === 1;
        this.disadvantage = advantage === -1;

        this.config.roll.advantage = this.config.roll.advantage === advantage ? 0 : advantage;
        if (this.config.roll.advantage === 0) return this.render();

        const defaultFaces =
            this.config.roll.advantage === 1
                ? this.config.data.rules.roll?.defaultAdvantageDice
                : this.config.data.rules.roll?.defaultDisadvantageDice;
        const faces = Number.parseInt(defaultFaces);
        this.roll.advantageFaces = Number.isNaN(faces) ? this.roll.advantageFaces : faces;

        this.render();
    }

    static selectExperience(_, button) {
        this.config.experiences =
            this.config.experiences.indexOf(button.dataset.key) > -1
                ? this.config.experiences.filter(x => x !== button.dataset.key)
                : [...this.config.experiences, button.dataset.key];
        this.config.costs =
            this.config.costs.indexOf(this.config.costs.find(c => c.extKey === button.dataset.key)) > -1
                ? this.config.costs.filter(x => x.extKey !== button.dataset.key)
                : [
                    ...this.config.costs,
                    {
                        extKey: button.dataset.key,
                        key: this.config?.data?.parent?.isNPC ? 'fear' : 'hope',
                        value: 1,
                        name: this.config.data?.system.experiences?.[button.dataset.key]?.name
                    }
                ];
        this.render();
    }

    static toggleReaction() {
        if (this.config.roll) {
            this.reactionOverride = !this.reactionOverride;
            this.config.actionType = this.reactionOverride
                ? 'reaction'
                : this.config.actionType === 'reaction'
                    ? 'action'
                    : this.config.actionType;
            this.render();
        }
    }

    static toggleSelectedEffect(_event, button) {
        this.selectedEffects[button.dataset.key].selected = !this.selectedEffects[button.dataset.key].selected;
        this.render();
    }

    static async submitRoll() {
        await this.close({ submitted: true });
    }

    _onClose(options = {}) {
        if (!options.submitted) this.config = false;
    }

    static async configure(roll, config = {}, options = {}) {
        const picks = [...(config.experiences ?? [])];
        return new Promise(resolve => {
            const app = new this(roll, config, options);
            app.addEventListener('close', () => resolve(app.config), { once: true });
            app.render({ force: true }).then(() => app.play(picks));
        });
    }

    /*
     * The harness's player: the experience chips named, then Roll, each once the renders before it have
     * settled. A Roll that did not close the window - nothing the module does refuses it today - would
     * leave the roll waiting for ever, as a window left open does; it is said on the console and the
     * window closed unsubmitted instead, so the roll is abandoned where a test can see it.
     */
    async play(picks) {
        await this.settled();
        for (const key of picks) {
            [...this.element.querySelectorAll('[data-action="selectExperience"]')].find(chip => chip.dataset.key === key)?.click();
            await this.settled();
        }
        this.element.querySelector('[data-action="submitRoll"]')?.click();
        await new Promise(resolve => setTimeout(resolve, 0));
        if (this.rendered) {
            console.error('[harness] the roll window\'s Roll did not close it; closed unsubmitted');
            await this.close();
        }
    }
}
