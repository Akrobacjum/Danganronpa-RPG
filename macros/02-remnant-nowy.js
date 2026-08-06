/**
 * MAKRO: Nowy Remnant
 * ---------------------------------------------------------------------------
 * Tworzy Remnant jako wpis w dzienniku (ukryty przed graczami) i — jesli masz
 * zaznaczony token — wbija pinezke w tym miejscu na mapie.
 *
 * Gracze NIE widza tej pinezki, bo uprawnienia wpisu ustawiamy na NONE.
 * Ty widzisz wszystko. Do reki gracza Remnant trafia dopiero makrem nr 3.
 *
 * Typ makra: Script.  Uruchamia: tylko DM.
 */

const FDE = foundry.applications?.ux?.FormDataExtended ?? FormDataExtended;
const DialogV2 = foundry.applications.api.DialogV2;
const FOLDER = "Remnants";

const TYPY = ["Key", "Prep", "Incident", "Resolution", "Autopsy"];
const TRUDNOSCI = ["Banalny", "Standardowy", "Skomplikowany", "Desperacki"];

const dane = await DialogV2.prompt({
    window: { title: "Nowy Remnant" },
    position: { width: 460 },
    content: `
    <form class="flexcol" style="gap:8px">
      <div class="form-group">
        <label>Nazwa (widziana pozniej przez gracza)</label>
        <input type="text" name="nazwa" placeholder="np. Slad blota przy oknie" autofocus>
      </div>
      <div class="form-group">
        <label>Typ</label>
        <select name="typ">${TYPY.map(t => `<option>${t}</option>`).join("")}</select>
      </div>
      <div class="form-group">
        <label>Trudnosc</label>
        <select name="trudnosc">${TRUDNOSCI.map(t => `<option>${t}</option>`).join("")}</select>
      </div>
      <div class="form-group">
        <label><input type="checkbox" name="faint"> Faint (znika na koniec rozdzialu)</label>
      </div>
      <div class="form-group">
        <label><input type="checkbox" name="reinforced"> Reinforced (zabojca nie usunie)</label>
      </div>
      <div class="form-group">
        <label>Pomieszczenie</label>
        <input type="text" name="pokoj" placeholder="np. Biblioteka">
      </div>
      <div class="form-group">
        <label>Opis dla gracza</label>
        <textarea name="opis" rows="3" placeholder="Co dokladnie widzi ten, kto to znajdzie."></textarea>
      </div>
      <div class="form-group">
        <label>Notatka DMa (gracz tego nie zobaczy)</label>
        <textarea name="notatka" rows="2" placeholder="Na kogo wskazuje, skad sie wzielo."></textarea>
      </div>
    </form>`,
    ok: {
        label: "Utworz",
        callback: (event, button) => new FDE(button.form).object
    }
});

if (!dane || !dane.nazwa?.trim()) return;

// --- Folder ----------------------------------------------------------------
let folder = game.folders.find(f => f.name === FOLDER && f.type === "JournalEntry");
if (!folder) {
    folder = await Folder.create({ name: FOLDER, type: "JournalEntry", color: "#6b2d5c" });
}

// --- Wpis w dzienniku ------------------------------------------------------
const etykieta = [
    dane.faint ? "Faint" : null,
    dane.reinforced ? "Reinforced" : null,
    dane.trudnosc,
    dane.typ
].filter(Boolean).join(" ");

const entry = await JournalEntry.create({
    name: `[${dane.pokoj || "?"}] ${dane.nazwa}`,
    folder: folder.id,
    ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE }, // niewidoczne dla graczy
    pages: [{
        name: dane.nazwa,
        type: "text",
        text: {
            format: 1,
            content: `
              <p><b>${etykieta} Remnant</b></p>
              <p><b>Pomieszczenie:</b> ${dane.pokoj || "—"}</p>
              <hr>
              <p><b>Opis dla gracza:</b><br>${dane.opis || "—"}</p>
              <hr>
              <p><b>Notatka DMa:</b><br>${dane.notatka || "—"}</p>`
        }
    }],
    flags: {
        "danganronpa-rpg": {
            typ: dane.typ,
            trudnosc: dane.trudnosc,
            faint: !!dane.faint,
            reinforced: !!dane.reinforced,
            pokoj: dane.pokoj || "",
            opis: dane.opis || ""
        }
    }
});

// --- Pinezka na mapie ------------------------------------------------------
const token = canvas.tokens.controlled[0];
if (token && canvas.scene) {
    await canvas.scene.createEmbeddedDocuments("Note", [{
        entryId: entry.id,
        x: token.x + (canvas.grid.size / 2),
        y: token.y + (canvas.grid.size / 2),
        text: dane.nazwa,
        iconSize: 40,
        global: false
    }]);
    ui.notifications.info(`Remnant utworzony i wbity na mape: ${dane.nazwa}`);
} else {
    ui.notifications.info(`Remnant utworzony: ${dane.nazwa}. Przeciagnij go z Dziennika na mape, zeby wbic pinezke.`);
}
