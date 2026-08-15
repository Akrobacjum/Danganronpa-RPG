/**
 * MAKRO: Nowy Remnant
 * ---------------------------------------------------------------------------
 * Stawia Remnant na mapie w miejscu zaznaczonego tokenu.
 *
 * WAZNE — co sie zmienilo wzgledem starej wersji tego makra:
 * poprzednio makro tworzylo wpis w dzienniku plus pinezke (Note) z wlasnymi,
 * polskimi kluczami flag. Modul operuje na TOKENACH z flagami z REMNANT_FLAGS,
 * wiec te dwa swiaty nigdy sie nie spotykaly: `game.drpg.reportRemnants()`,
 * sprzatanie Faint na koniec rozdzialu i wyszukiwanie po pokoju nie widzialy
 * niczego, co powstalo tym makrem. Teraz makro wola `game.drpg.dropRemnant`,
 * czyli dokladnie te sama sciezke co Przeszukanie i Sabotaz.
 *
 * Gracze nie widza Remnantow — token jest zawsze ukryty. Do reki gracza trafia
 * Truth Bullet, makrem nr 3.
 *
 * Typ makra: Script.  Uruchamia: tylko DM.
 */

const DialogV2 = foundry.applications.api.DialogV2;

if (!game.user.isGM) {
    ui.notifications.warn("To makro moze uruchomic tylko DM.");
    return;
}
if (!game.drpg?.dropRemnant) {
    ui.notifications.error("Modul Danganronpa RPG nie jest aktywny.");
    return;
}

// Remnant ladowany jest tam, gdzie stoi zaznaczony token.
const token = canvas.tokens.controlled[0];
if (!token?.actor) {
    ui.notifications.warn("Zaznacz najpierw token postaci, przy ktorej ma lezec Remnant.");
    return;
}

// Klucze musza byc te same, ktorych uzywa modul — inaczej etykieta i kolor
// tokenu nie beda sie zgadzac z reszta systemu.
const TYPY = {
    key: "Key — czyni sprawe rozwiazywalna, nie da sie usunac",
    neutral: "Neutral — nieznane pochodzenie",
    faint: "Faint — watpliwa istotnosc",
    prep: "Prep — przygotowania do zbrodni",
    incident: "Incident — sam moment zbrodni",
    resolution: "Resolution — bledy przy sprzataniu",
    autopsy: "Autopsy — stan ciala",
    final: "Final Truth — wskazuje Mastermind"
};

const WIDOCZNOSC = {
    obvious: "Obvious — rzuca sie w oczy",
    evident: "Evident — widoczny",
    subtle: "Subtle — subtelny",
    hidden: "Hidden — ukryty"
};

const dane = await DialogV2.wait({
    window: { title: "Nowy Remnant" },
    classes: ["drpg-panel"],
    position: { width: 480 },
    content: `
    <form class="flexcol" style="gap:8px">
      <p class="notes">Remnant stanie przy tokenie <strong>${foundry.utils.escapeHTML(token.actor.name)}</strong>.</p>
      <div class="form-group">
        <label>Typ</label>
        <select name="type">${
            Object.entries(TYPY).map(([k, v]) =>
                `<option value="${k}"${k === "prep" ? " selected" : ""}>${v}</option>`).join("")
        }</select>
      </div>
      <div class="form-group">
        <label>Widocznosc (jak trudno go znalezc)</label>
        <select name="visibility">${
            Object.entries(WIDOCZNOSC).map(([k, v]) =>
                `<option value="${k}"${k === "evident" ? " selected" : ""}>${v}</option>`).join("")
        }</select>
      </div>
      <div class="form-group">
        <label>Co to jest — notatka dla DMa</label>
        <textarea name="note" rows="3" placeholder="Skad sie wzielo, na kogo wskazuje."></textarea>
      </div>
      <div class="form-group">
        <label>Czego dotyczy (przedmiot, projekt, osoba)</label>
        <input type="text" name="subject" placeholder="np. Siekiera">
      </div>
      <div class="form-group">
        <label><input type="checkbox" name="faint"> Faint — znika przy sprzataniu na koniec rozdzialu</label>
      </div>
      <div class="form-group">
        <label><input type="checkbox" name="tiedToCrime"> Powiazany ze zbrodnia lub narzedziem — przetrwa sprzatanie</label>
      </div>
      <div class="form-group">
        <label><input type="checkbox" name="reinforced"> Reinforced — zabojca go nie usunie</label>
      </div>
    </form>`,
    buttons: [
        {
            action: "ok",
            label: "Utworz",
            default: true,
            callback: (event, button, dialog) => {
                const f = dialog.element.querySelector("form");
                return {
                    type: f.type.value,
                    visibility: f.visibility.value,
                    note: f.note.value.trim(),
                    subject: f.subject.value.trim(),
                    faint: f.faint.checked,
                    tiedToCrime: f.tiedToCrime.checked,
                    reinforced: f.reinforced.checked
                };
            }
        },
        { action: "cancel", label: "Anuluj" }
    ],
    rejectClose: false
});

if (!dane || dane === "cancel") return;

const created = await game.drpg.dropRemnant(token.actor, {
    type: dane.type,
    visibility: dane.visibility,
    faint: dane.faint,
    tiedToCrime: dane.tiedToCrime,
    reinforced: dane.reinforced,
    note: dane.note,
    subject: dane.subject,
    action: "manual"
});

if (created) {
    ui.notifications.info(`Remnant postawiony przy ${token.actor.name}. Sprawdz "Lista Remnantow" w panelu DMa.`);
} else {
    ui.notifications.error("Nie udalo sie postawic Remnanta — zobacz konsole.");
}
