/**
 * MAKRO: Remnant -> Truth Bullet
 * ---------------------------------------------------------------------------
 * Kopiuje wybrany Remnant do ekwipunku graczy jako przedmiot "Truth Bullet".
 * Remnant zostaje na mapie (zgodnie z zasadami — kopiowanie go nie usuwa).
 *
 * JAK UZYWAC:
 *   1. Wyceluj (klawisz T) w tokeny graczy, ktorzy maja dostac poszlake.
 *   2. Uruchom makro.
 *   3. Wybierz Remnant z listy.
 *
 * Key Remnant trafia od razu jako Key Truth Bullet (bez analizy).
 * Reszta trafia jako Neutral — kategorie ujawnisz makrem "Analiza".
 *
 * Typ makra: Script.  Uruchamia: tylko DM.
 */

const FDE = foundry.applications?.ux?.FormDataExtended ?? FormDataExtended;
const DialogV2 = foundry.applications.api.DialogV2;

const TYP_PRZEDMIOTU = "loot"; // jesli Twoja wersja systemu nie ma "loot", zmien na "consumable"
const FOLDER = "Remnants";

// --- Odbiorcy --------------------------------------------------------------
const cele = Array.from(game.user.targets);
if (!cele.length) {
    return ui.notifications.warn("Najpierw wyceluj (klawisz T) w tokeny graczy, ktorzy maja dostac poszlake.");
}

// --- Lista dostepnych Remnantow -------------------------------------------
const folder = game.folders.find(f => f.name === FOLDER && f.type === "JournalEntry");
const remnanty = (folder?.contents ?? []).filter(e => e.flags?.["danganronpa-rpg"]);

if (!remnanty.length) {
    return ui.notifications.warn(`Brak Remnantow w folderze "${FOLDER}". Utworz je makrem "Nowy Remnant".`);
}

const opcje = remnanty
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(e => `<option value="${e.id}">${e.name}</option>`)
    .join("");

const dane = await DialogV2.prompt({
    window: { title: `Przekaz poszlake — ${cele.length} odbiorca/-ow` },
    position: { width: 480 },
    content: `
    <form class="flexcol" style="gap:8px">
      <p><b>Odbiorcy:</b> ${cele.map(t => t.name).join(", ")}</p>
      <div class="form-group">
        <label>Remnant</label>
        <select name="remnantId" style="width:100%">${opcje}</select>
      </div>
      <div class="form-group">
        <label><input type="checkbox" name="ujawnijKategorie"> Ujawnij od razu kategorie (kryt na obserwacji)</label>
      </div>
    </form>`,
    ok: {
        label: "Przekaz",
        callback: (event, button) => new FDE(button.form).object
    }
});

if (!dane) return;

const entry = game.journal.get(dane.remnantId);
if (!entry) return ui.notifications.error("Nie znaleziono Remnanta.");

const f = entry.flags["danganronpa-rpg"];
const isKey = f.typ === "Key";
const pokazKategorie = isKey || dane.ujawnijKategorie;
const kategoria = pokazKategorie ? f.typ : "Neutral";

// --- Tworzenie przedmiotu u kazdego odbiorcy ------------------------------
let dodano = 0;
for (const target of cele) {
    const actor = target.actor;
    if (!actor) continue;

    // Nie duplikujemy tej samej poszlaki
    const juzMa = actor.items.find(i => i.getFlag("danganronpa-rpg", "remnantId") === entry.id);
    if (juzMa) continue;

    await Item.create({
        name: `[${kategoria}] ${f.opis ? entry.name.replace(/^\[.*?\]\s*/, "") : entry.name}`,
        type: TYP_PRZEDMIOTU,
        img: "icons/sundries/documents/document-sealed-brown-red.webp",
        system: {
            description: `<p>${f.opis || "—"}</p>
                          <p><i>Kategoria: ${kategoria}</i></p>`
        },
        flags: {
            "danganronpa-rpg": {
                truthBullet: true,
                remnantId: entry.id,
                kategoriaPrawdziwa: f.typ,   // znasz ja Ty; gracz widzi tylko "kategoria"
                trudnosc: f.trudnosc,
                faint: f.faint
            }
        }
    }, { parent: actor });

    dodano++;
}

// --- Komunikat do graczy ---------------------------------------------------
for (const target of cele) {
    if (!target.actor) continue;
    await game.drpg.whisperToOwner(target.actor, `
      <h3>Nowy Truth Bullet</h3>
      <p><b>${entry.name.replace(/^\[.*?\]\s*/, "")}</b></p>
      <p>${f.opis || "—"}</p>
      <p><i>Kategoria: ${kategoria}</i></p>
      <p style="font-size:0.9em;opacity:0.8">Znajdziesz go w swoim ekwipunku. Podczas Class Trial przeciagnij go na czat, zeby zglosic Objection.</p>`);
}

ui.notifications.info(`Przekazano poszlake ${dodano} graczom.`);
