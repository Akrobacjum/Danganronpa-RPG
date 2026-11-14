/*
 * HARNESS GLUE, NOT DAGGERHEART'S CODE (E33 C2a, 07.10.2026; the window since E33 C2b, 07.10.2026; modelled on 2.12.8's
 * window since 13.11.2026, the owner's consent to re-copy dh-dice, "zgoda na dh-dice").
 * dhRoll.mjs, d20Roll.mjs and dualityRoll.mjs beside this import it as their `DefaultDialog`; at a table that is
 * Daggerheart's roll window, module/applications/dialogs/d20RollDialog.mjs - here read at tag 2.12.8 (commit 71c318de25,
 * 235 lines), and every `:n` below is that file's line. Until 13.11.2026 this modelled 2.10.5's window: the experiences
 * emptied at construction (2.10.5 :12), `reactionOverride` and the chip on a DualityRoll alone (:13, :136), the actor
 * off the roll data's `parent` (:53-55). 2.12.8 has none of those.
 *
 * WHY NOT THE FILE ITSELF. 2.12.8's window renders two Handlebars templates (PARTS, :56-65) through Foundry's
 * HandlebarsApplicationMixin and reads Foundry's form data; the shim has neither (lib/shim.mjs `buildApplications`), so
 * the file cannot run here as it stands. What runs here is its code where the harness allows - the constructor, the
 * getters, the context and the five actions copied from it, each marked where it differs - and markup written by hand
 * for the elements the module's hooks read. Foundry's own ApplicationV2 is the shim's, whose render and close fire
 * `renderApplicationV2` and `closeApplicationV2` with Foundry's arguments, so the module's hooks run on this as at a table.
 *
 * WHAT IS 2.12.8'S, LINE BY LINE:
 *   - the constructor (:7-13): `roll`, `config`, `originalActionType` (:11), `selectedEffects` (:12). The config's
 *     experiences are left as they came, as 2.12.8 leaves them.
 *   - DEFAULT_OPTIONS (:15-37), `title` (:39-41), `actor` (:43-45, `config.actor`), `item` and `action` (:47-53).
 *   - `_prepareContext` (:67-134): the message mode (:72), the selected effects (:79-80), the roll's context (:105-131) -
 *     the experiences off `config.data.experiences` (:110-116), advantage and disadvantage (:117-118), `isLite` (:124),
 *     the extra formula (:125), `formula`, the roll's own `constructFormula` run on every render (:126), which is where
 *     the window's choices reach the dice, the abilities when the actor has traits (:127), `showReaction` - every roll but
 *     a FateRoll whose config does not skip it (:129) - and `isReaction`, the config's actionType (:130). NOT: the costs'
 *     and uses' calculation (:82-104; client-entry.mjs `wrapWindowCosts` greys the Roll from the costs instead, LIVE-E16-01)
 *     and the rally die (:108).
 *   - the actions: `updateIsAdvantage` (:166-182), `selectExperience` (:184-202), `toggleReaction` (:204-212: the
 *     actionType flipped between the original and its other), `toggleSelectedEffect` (:214-217), `submitRoll`
 *     (:219-221). `_onClose` (:224-226): unsubmitted, `config` is false. `configure` (:228-234).
 *   - THE FORM'S SUBMIT ON A CHANGE (`form.handler`, `submitOnChange`, :32-36): Foundry runs the handler with the form's
 *     data on a `change` - as remembered of Foundry's ApplicationV2 and FormDataExtended (every named control but a button
 *     or a disabled one, a checkbox as its state), not read: their source is not on this machine. Of
 *     `updateRollConfiguration` (:143-164) this runs :144 (the data expanded), :146 (the message mode), :155-161 (the
 *     statistic and the title it gives a roll from no item), :162 (`config.extraFormula`, the input roll-dialog.mjs
 *     `lockBonus` writes and says it changed) and :163 (a render). Not :148-151 (the costs and uses merged) and not
 *     :152-154 (the dice merged into the roll: `lockDice` disables their selects).
 *   - the markup the hooks read, from templates/dialogs/dice-roll/ at 2.12.8 (header.hbs, rollSelection.hbs, which
 *     differ from 2.10.5's in the chip's `isReaction` alone) - `_renderHTML` cites each element and the roll-dialog.mjs
 *     reader it is drawn for. Not Handlebars, labels, icons, layout.
 *   - Foundry queues a window's renders, so one asked for inside a render hook (`forceAdvantage`, `capExperiences`) runs
 *     after it, and a render asked of a closed window is none. As remembered of Foundry, not read, not measured.
 *
 * THE PLAYER (harness, not Daggerheart). Nobody sits at the harness's window: once its renders have settled, it clicks
 * the experience chips a test named - `__forceExperiences`, which client-entry.mjs `diceRoll` hands to MoveContext as
 * the config's experiences - and then Roll. Those are a player's clicks, not a caller's choice, so `configure` takes
 * them off the config before the window is built and clicks them (a chip the module locked refuses the click, as at a
 * table): the one place this differs from 2.12.8's `configure`, marked there. A caller's experiences reach 2.12.8's
 * window selected; none of the module's callers sends any to a window today (scripts/: the GM's draw sends them with
 * the window skipped).
 */
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const TRAITS = ["agility", "strength", "finesse", "instinct", "presence", "knowledge"];   // config/actorConfig.mjs `abilities` (the ids :137 maps)
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
        this.originalActionType = config.actionType;
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
        return this.config.actor ?? null;
    }

    get item() {
        return this.config.item ?? null;
    }

    get action() {
        return this.config.action ?? null;
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
        const context = { rollConfig: this.config, hasRoll: !!this.config.hasRoll, canRoll: true };   // :69-71 (:68 is Foundry's)
        context.selectedMessageMode = this.config.selectedMessageMode ?? game.settings.get('core', 'messageMode');   // :72
        context.hasSelectedEffects = Boolean(this.selectedEffects && Object.keys(this.selectedEffects).length);   // :79
        context.selectedEffects = this.selectedEffects;
        // :82-104 not run (the header): the costs as the config holds them, so the cost rows' markup has its inputs.
        context.costs = this.config.costs ?? [];
        if (this.roll) {
            context.roll = this.roll;
            context.rollType = this.roll?.constructor.name;

            const experiences = this.config.data?.experiences ?? {};
            context.experiences = Object.keys(experiences).map(id => ({
                id,
                ...experiences[id]
            }));

            context.selectedExperiences = this.config.experiences;
            context.advantage = this.config.roll?.advantage;
            context.disadvantage = this.config.roll?.disadvantage;
            context.isLite = this.config.roll?.lite;
            context.extraFormula = this.config.extraFormula;
            context.formula = this.roll.constructFormula(this.config);
            if (this.actor?.system?.traits) context.abilities = TRAITS;   // :127, the ids alone (`getTraitModifiers` :136-141 labels them)

            context.showReaction = !this.config.skips?.reaction && context.rollType !== 'FateRoll';
            context.isReaction = this.config.actionType === 'reaction';
        }
        return context;
    }

    async _renderHTML(c) {
        const roll = c.roll ?? {};
        const option = (value, selected, label = value) => `<option value="${esc(value)}"${selected ? ' selected' : ''}>${esc(label)}</option>`;
        const off = c.advantage ? '' : ' disabled';
        // header.hbs:4-9 (2.12.8: `isReaction`) - `forceReaction` reads [data-action="toggleReaction"] and its <i>.
        const header = c.showReaction
            ? `<header class="dialog-header"><div class="reaction-chip${c.isReaction ? ' selected' : ''}" data-action="toggleReaction"><span><i class="${c.isReaction ? 'fa-solid' : 'fa-regular'} fa-circle"></i></span></div></header>`
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
        // rollSelection.hbs:3-4, 180-181 - the dice, the chips and the modifiers only on a roll (`hasRoll`) that is not lite.
        const rolled = c.hasRoll && !c.isLite ? `${dice}${chips ? `<fieldset class="experience-container">${chips}</fieldset>` : ''}${modifiers}` : '';
        return `${header}<div class="roll-dialog-container">${rolled}${costs}${controls}</div>`;
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

    /* :143-164, the lines the header names: the message mode, the statistic, the extra formula, then a render. */
    static updateRollConfiguration(_event, _, formData) {
        const { ...rest } = foundry.utils.expandObject(formData.object);

        this.config.selectedMessageMode = rest.selectedMessageMode;

        if (rest.hasOwnProperty('trait')) {
            this.config.roll.trait = rest.trait;
            if (!this.config.source.item && this.config.roll.trait)
                this.config.title = game.i18n.format('DAGGERHEART.UI.Chat.dualityRoll.abilityCheckTitle', {
                    ability: game.i18n.localize(`DAGGERHEART.CONFIG.Traits.${this.config.roll.trait}.name`)   // :159's `abilities[...]?.label`
                });
        }
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
                        key: this.config?.actor?.isNPC ? 'fear' : 'hope',
                        value: 1,
                        name: this.config.data?.experiences?.[button.dataset.key]?.name
                    }
                ];
        this.render();
    }

    static toggleReaction() {
        if (this.config.roll) {
            const overrideType = this.originalActionType === 'reaction' ? 'trait' : 'reaction';
            this.config.actionType =
                this.config.actionType === this.originalActionType ? overrideType : this.originalActionType;

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
        // HARNESS, not :228-234: the player's picks taken off the config and clicked once the window stands (the header).
        const picks = [...(config.experiences ?? [])];
        config.experiences = [];
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
