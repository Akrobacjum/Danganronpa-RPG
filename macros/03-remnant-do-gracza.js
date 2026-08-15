/**
 * MAKRO: Truth Bullet do gracza
 * ---------------------------------------------------------------------------
 * Kopiuje wybrany Remnant z mapy do ekwipunku jednego lub kilku graczy jako
 * Truth Bullet. Sam Remnant zostaje na miejscu — tak jak chce przewodnik.
 *
 * WAZNE — co sie zmienilo wzgledem poprzedniej wersji tego makra:
 * makro wpisywalo indeks widocznosci w pole `tier`, bo kula nie miala wtedy
 * wlasnego miejsca na widocznosc. Przez to "Wyrazny" Remnant robil sie kula
 * "Tier 1". Od Etapu 1 kula ma wlasne flagi, wiec makro wola
 * `game.drpg.createTruthBullet` — jedyna sciezke tworzenia w module. Typ
 * Remnanta, jego widocznosc, notatka DMa oraz id zrodla przenosza sie same.
 *
 * Prawdziwy typ kuli NIE trafia na przedmiot gracza. Siedzi w magazynie DMa,
 * ktorego klient gracza nie dostaje.
 *
 * Typ makra: Script.  Uruchamia: tylko DM.
 */

const DialogV2 = foundry.applications.api.DialogV2;

if (!game.user.isGM) {
    ui.notifications.warn("To makro moze uruchomic tylko DM.");
    return;
}
if (!game.drpg?.createTruthBullet) {
    ui.notifications.error("Modul Danganronpa RPG nie jest aktywny (albo jest starszy niz Etap 1).");
    return;
}

// --- Ktory Remnant ---------------------------------------------------------
const remnants = game.drpg.remnantsOn(canvas.scene)
    .map(t => ({ token: t, data: game.drpg.remnantData(t) }))
    .filter(r => r.data);

if (!remnants.length) {
    ui.notifications.warn("Na tej scenie nie ma zadnych Remnantow. Postaw je makrem nr 2.");
    return;
}

// --- Komu ------------------------------------------------------------------
const uczniowie = game.drpg.studentActors();
if (!uczniowie.length) {
    ui.notifications.warn("Brak postaci graczy.");
    return;
}

const wynik = await DialogV2.wait({
    window: { title: "Truth Bullet do gracza" },
    classes: ["drpg-panel"],
    position: { width: 520 },
    content: `
    <form class="flexcol" style="gap:8px">
      <div class="form-group">
        <label>Ktory Remnant</label>
        <select name="remnant">${
            remnants.map((r, i) => {
                const d = r.data;
                const opis = `${d.visibilityLabel} ${d.typeLabel}${d.room ? ` · ${d.room}` : ""}${d.subject ? ` · ${d.subject}` : ""}`;
                return `<option value="${i}">${foundry.utils.escapeHTML(opis)}</option>`;
            }).join("")
        }</select>
      </div>
      <div class="form-group">
        <label>Nazwa kuli — to widzi gracz</label>
        <input type="text" name="name" placeholder="np. Slad blota przy oknie" autofocus>
      </div>
      <div class="form-group">
        <label>Opis dla gracza</label>
        <textarea name="description" rows="3" placeholder="Co dokladnie widzi ten, kto to znalazl."></textarea>
      </div>
      <div class="form-group">
        <label>Komu (Ctrl / Shift zaznacza kilku)</label>
        <select name="targets" multiple size="${Math.min(8, uczniowie.length)}">${
            uczniowie.map(a => `<option value="${a.id}">${foundry.utils.escapeHTML(a.name)}</option>`).join("")
        }</select>
      </div>
      <p class="notes">Remnant zostaje na mapie. Kula trafia do ekwipunku, do grupy Truth Bullets.
      Typ i widocznosc przenosza sie z Remnanta; gracz widzi "Neutral", dopoki nie zrobi Analizy.</p>
    </form>`,
    buttons: [
        {
            action: "ok",
            label: "Wydaj",
            default: true,
            callback: (event, button, dialog) => {
                const f = dialog.element.querySelector("form");
                return {
                    remnant: Number(f.remnant.value),
                    name: f.name.value.trim(),
                    description: f.description.value.trim(),
                    targets: Array.from(f.targets.selectedOptions).map(o => o.value)
                };
            }
        },
        { action: "cancel", label: "Anuluj" }
    ],
    rejectClose: false
});

if (!wynik || wynik === "cancel") return;

if (!wynik.targets.length) {
    ui.notifications.warn("Nie wybrano zadnego gracza.");
    return;
}

const zrodlo = remnants[wynik.remnant];
const nazwa = wynik.name || `${zrodlo.data.visibilityLabel} ${zrodlo.data.typeLabel}`;

let wydano = 0;
for (const id of wynik.targets) {
    const actor = game.actors.get(id);
    if (!actor) continue;

    const item = await game.drpg.createTruthBullet(actor, {
        name: nazwa,
        // Prawda o kuli. Nie ląduje na przedmiocie gracza.
        realType: zrodlo.data.type,
        // Widocznosc ma teraz wlasna flage — to ona ustala prog Analizy.
        visibility: zrodlo.data.visibility,
        faint: !!zrodlo.data.faint,
        playerText: wynik.description,
        gmNote: zrodlo.data.note ?? "",
        remnantId: zrodlo.token.id,
        sceneId: canvas.scene?.id ?? null,
        // Pokoj Remnanta, nie pokoj gracza. Bez tego `createTruthBullet`
        // podstawia `roomOfActor(actor)` — czyli miejsce, w ktorym akurat stoi
        // odbiorca — i kula dostawala stempel z zupelnie innego pomieszczenia.
        room: zrodlo.data.room ?? null
    });
    if (!item) continue;

    wydano++;
    await game.drpg.whisperToOwner(actor, `
      <h3>Nowy Truth Bullet</h3>
      <p><strong>${foundry.utils.escapeHTML(nazwa)}</strong></p>
      ${wynik.description ? `<p>${foundry.utils.escapeHTML(wynik.description)}</p>` : ""}
      <p><small>Znajdziesz go w ekwipunku, w grupie Truth Bullets.</small></p>`);
}

ui.notifications.info(`Wydano Truth Bullet "${nazwa}" — ${wydano} gracz(y).`);
