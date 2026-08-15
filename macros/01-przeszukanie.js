/**
 * MAKRO: Przeszukanie — skrot
 * ---------------------------------------------------------------------------
 * To makro NIE ma juz wlasnej logiki. Akcja Przeszukanie mieszka w module
 * (`scripts/action-rolls.mjs`) i jest na karcie postaci, w siatce akcji.
 *
 * Dlaczego stara wersja musiala zniknac — robila trzy rzeczy zle, i wszystkie
 * trzy po cichu:
 *
 *   przedmiot   ogłaszala "Znajduje: Siekiera" i nie tworzyla zadnego Itema.
 *               Przedmiot istnial wylacznie w tresci szeptu, wiec limity
 *               noszenia, skrytka i procedura smierci nie widzialy go nigdy.
 *
 *   Remnant     pisala "zostawia Standardowy Faint Prep Remnant" i nie stawiala
 *               zadnego tokenu. Sledztwo szukalo potem sladu, ktorego nie bylo
 *               na mapie — jedynej awarii, po ktorej sledztwo sie nie podnosi.
 *
 *   tabele      losowala z RollTable o polskich nazwach ("Przeszukanie -
 *               Leczace - T0"), a `game.drpg.installTables()` tworzy tabele
 *               nazwane "DRPG Usable Items (Healing) — Tier 0". Te dwa swiaty
 *               nigdy sie nie spotkaly, wiec makro zawsze szlo w improwizacje.
 *
 * Zeton przeszukania natomiast zabieralo naprawde — czyli jedyne, co dzialalo,
 * to koszt.
 *
 * Akcja w module robi to wszystko poprawnie: rzuca kostkami (Oko albo Reka),
 * pyta czego szukasz, zabiera zeton dopiero gdy kosci sa na stole, tworzy Item
 * z kategoria i tierem, stawia Prep Remnant na mapie dla narzedzi zbrodni i
 * czyszczacych, i przeszukuje cudza skrytke, jesli w tym pokoju jakas jest.
 *
 * Makro zostawione, bo moze byc podpiete na pasku. Mozna je skasowac.
 *
 * Typ makra: Script.  Uruchamia: DM (dla zaznaczonego tokenu).
 */

if (!game.drpg?.performAction) {
    ui.notifications.error("Modul Danganronpa RPG nie jest aktywny.");
    return;
}

// Zaznaczony token, a jak nie ma — wlasna postac.
const actor = canvas.tokens?.controlled?.[0]?.actor ?? game.user.character;
if (!actor || actor.type !== "character") {
    ui.notifications.warn("Zaznacz najpierw token postaci, ktora przeszukuje.");
    return;
}

await game.drpg.performAction(actor, "search");
