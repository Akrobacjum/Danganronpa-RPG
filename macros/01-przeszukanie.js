/**
 * MAKRO: Przeszukanie
 * ---------------------------------------------------------------------------
 * Gracz rzuca w karcie postaci (Oko lub Reka). Ty wpisujesz sam WYNIK.
 * Makro dobiera Tier, losuje konkretny przedmiot z RollTable i szepcze
 * wynik do gracza + do DMow.
 *
 * WYMAGA: RollTable o nazwach dokladnie takich jak w tablicy TABELE ponizej.
 * Typ makra: Script.  Uruchamia: tylko DM.
 */

const FDE = foundry.applications?.ux?.FormDataExtended ?? FormDataExtended;
const DialogV2 = foundry.applications.api.DialogV2;

// --- Konfiguracja: nazwy Twoich RollTable ----------------------------------
const TABELE = {
    lecznicze: ["Przeszukanie - Leczace - T0", "Przeszukanie - Leczace - T1", "Przeszukanie - Leczace - T2", "Przeszukanie - Leczace - T3"],
    zbrodni: ["Przeszukanie - Zbrodni - T0", "Przeszukanie - Zbrodni - T1", "Przeszukanie - Zbrodni - T2", "Przeszukanie - Zbrodni - T3"],
    czyszczace: ["Przeszukanie - Czyszczace - T0", "Przeszukanie - Czyszczace - T1", "Przeszukanie - Czyszczace - T2", "Przeszukanie - Czyszczace - T3"]
};

const ETYKIETY = {
    lecznicze: "Przedmiot leczacy / usuwajacy stres",
    zbrodni: "Narzedzie zbrodni",
    czyszczace: "Narzedzie czyszczace"
};

// Wynik rzutu -> Tier oraz jakosc pozostawionego Faint Prep Remnant
const PROGI = [
    { min: 18, tier: 2, remnant: "Standardowy" },
    { min: 12, tier: 1, remnant: "Skomplikowany" },
    { min: 8, tier: 0, remnant: "Desperacki" }
];

// --- Wybrany token = gracz, ktory przeszukuje ------------------------------
const token = canvas.tokens.controlled[0];
if (!token) {
    return ui.notifications.warn("Zaznacz najpierw token gracza, ktory przeszukuje.");
}

// --- Okno dialogowe --------------------------------------------------------
const dane = await DialogV2.prompt({
    window: { title: `Przeszukanie — ${token.name}` },
    position: { width: 420 },
    content: `
    <form class="flexcol" style="gap:8px">
      <div class="form-group">
        <label>Wynik rzutu (2d12 + statystyka + modyfikatory)</label>
        <input type="number" name="wynik" value="12" autofocus>
      </div>
      <div class="form-group">
        <label>Cel przeszukania</label>
        <select name="kategoria">
          <option value="lecznicze">Przedmiot leczacy / usuwajacy stres</option>
          <option value="zbrodni">Narzedzie zbrodni</option>
          <option value="czyszczace">Narzedzie czyszczace</option>
        </select>
      </div>
      <div class="form-group">
        <label>Nazwa pomieszczenia (do licznika zetonow)</label>
        <input type="text" name="pokoj" placeholder="np. Biblioteka">
      </div>
      <div class="form-group">
        <label><input type="checkbox" name="kryt"> Kryt (dwie takie same kosci)</label>
      </div>
    </form>`,
    ok: {
        label: "Rozstrzygnij",
        callback: (event, button) => new FDE(button.form).object
    }
});

if (!dane) return;

const wynik = Number(dane.wynik) || 0;
const kategoria = dane.kategoria;
const pokoj = (dane.pokoj || "").trim();

// --- Licznik zetonow przeszukania -----------------------------------------
if (pokoj) {
    const ok = await game.drpg.useToken(pokoj);
    if (!ok) {
        return ui.notifications.error(`Brak zetonow przeszukania w pomieszczeniu "${pokoj}".`);
    }
}

// --- Ustalenie Tieru -------------------------------------------------------
let prog = PROGI.find(p => wynik >= p.min);

if (!prog && !dane.kryt) {
    await game.drpg.whisperToOwner(token.actor,
        `<h3>Przeszukanie — nieudane</h3>
         <p><b>${token.name}</b> niczego nie znajduje. (wynik ${wynik})</p>`);
    return;
}

let tier = prog ? prog.tier : 0;
let jakoscRemnanta = prog ? prog.remnant : "Desperacki";

if (dane.kryt) {
    tier = Math.min(tier + 1, 3);
    jakoscRemnanta = "Banalny";
}

// --- Losowanie konkretnego przedmiotu -------------------------------------
const nazwaTabeli = TABELE[kategoria][tier];
const tabela = game.tables.getName(nazwaTabeli);

let przedmiot = "(brak tabeli — wymysl przedmiot sam)";
if (!tabela) {
    ui.notifications.warn(`Nie znaleziono RollTable "${nazwaTabeli}". Improwizuj.`);
} else {
    const draw = await tabela.draw({ displayChat: false });
    przedmiot = draw.results.map(r => r.name ?? r.text ?? "?").join(", ");
}

// --- Komunikat -------------------------------------------------------------
const zostawiaRemnant = kategoria !== "lecznicze";

let tresc = `
  <h3>Przeszukanie${pokoj ? ` — ${pokoj}` : ""}</h3>
  <p><b>${token.name}</b> szuka: <i>${ETYKIETY[kategoria]}</i></p>
  <p>Wynik: <b>${wynik}</b>${dane.kryt ? " (KRYT)" : ""} &rarr; <b>Tier ${tier}</b></p>
  <p style="font-size:1.1em"><b>Znajduje: ${przedmiot}</b></p>`;

await game.drpg.whisperToOwner(token.actor, tresc);

if (zostawiaRemnant) {
    const gmIds = game.users.filter(u => u.isGM).map(u => u.id);
    await ChatMessage.create({
        content: `<p><b>DM:</b> ${token.name} zostawia w pomieszczeniu
                  <b>${jakoscRemnanta} Faint Prep Remnant</b>${pokoj ? ` (${pokoj})` : ""}.</p>`,
        whisper: gmIds
    });
}

if (pokoj) {
    ui.notifications.info(`Zetony w "${pokoj}": ${game.drpg.tokensLeft(pokoj)}`);
}
