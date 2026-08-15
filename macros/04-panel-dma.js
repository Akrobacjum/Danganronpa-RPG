/**
 * MAKRO: Panel DMa — skrot
 * ---------------------------------------------------------------------------
 * To makro NIE ma juz wlasnej logiki. Wszystko, co kiedys robilo recznie,
 * mieszka teraz w module i jest dostepne z panelu DMa (ikona zegara na pasku
 * narzedzi tokenow, albo `game.drpg.gmPanel()`).
 *
 * Co sie zmienilo i dlaczego:
 *
 *   "zbiorka"   -> `game.drpg.bodyDiscoveryDialog()`. Stara wersja przesuwala
 *                  zetony wpisujac x/y, co Foundry traktuje jako RUCH — sciana
 *                  miedzy graczem a miejscem zbiorki blokowala teleport. Teraz
 *                  idzie przez `region.teleportTokens`, plus ogloszenie,
 *                  przelaczenie fazy na Investigation i pytanie o to, ktore
 *                  Faint Prep Remnanty naleza do tego morderstwa.
 *
 *   "sprzataj"  -> `game.drpg.chapterEndDialog()`. Stara wersja czytala flagi,
 *                  ktorych modul juz nie uzywa (`truthBullet` na przedmiocie,
 *                  Remnanty jako wpisy w folderze dziennika), wiec od dawna nie
 *                  usuwala niczego. Nowy panel pokazuje liczby PRZED wykonaniem
 *                  i osobno traktuje ujawnienie typow (koniec rozdzialu) oraz
 *                  sweep (start nastepnej sesji).
 *
 *   reset/podglad zetonow -> panel DMa, sekcja "More...".
 *
 * Makro zostawione, bo moze byc podpiete na pasku. Mozna je skasowac.
 *
 * Typ makra: Script.  Uruchamia: tylko DM.
 */

if (!game.user.isGM) {
    ui.notifications.warn("To makro moze uruchomic tylko DM.");
    return;
}
if (!game.drpg?.gmPanel) {
    ui.notifications.error("Modul Danganronpa RPG nie jest aktywny.");
    return;
}

await game.drpg.gmPanel();
