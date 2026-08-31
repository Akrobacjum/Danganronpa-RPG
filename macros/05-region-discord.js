/**
 * OUT OF SCOPE - NOT WIRED UP.
 * ---------------------------------------------------------------------------
 * Discord integration is deliberately parked. `game.drpg.notifyDiscord` was
 * removed from the module API in v0.2.0, so this script will not run as-is.
 * Kept on disk only as a starting point for whenever Discord comes back.
 * ---------------------------------------------------------------------------
 *
 * SKRYPT REGIONU: powiadom bota Discorda o zmianie pomieszczenia
 * ---------------------------------------------------------------------------
 * TO NIE JEST MAKRO. Ten kod wklejasz w:
 *   Warstwa Regionow > wybierz region > Zachowania (Behaviors) > +
 *   > typ "Execute Script" > Zdarzenia: "Token Enters"
 *
 * Nazwa regionu MUSI byc identyczna z kluczem w pliku config.json bota.
 * Np. region "Biblioteka" -> "rooms": { "Biblioteka": "ID_KANALU" }
 *
 * PAMIETAJ: zmien BOT_URL i BOT_SECRET na swoje.
 */

const BOT_URL = "http://127.0.0.1:8787";
const BOT_SECRET = "zmien-to-haslo";

// Ten skrypt wykonuje sie u kazdego zalogowanego uzytkownika.
// Chcemy, zeby zadanie do bota poszlo TYLKO RAZ - wiec wysyla je glowny DM.
if (game.users.activeGM?.id !== game.user.id) return;

const tokenDoc = event?.data?.token;
if (!tokenDoc?.actor) return;

// Kto jest wlascicielem tego tokenu?
const owner = game.users.find(u => !u.isGM && tokenDoc.actor.testUserPermission(u, "OWNER"));
if (!owner) return; // token DMa / Monokumy - ignorujemy

await game.drpg.notifyDiscord({
    player: owner.name,      // nazwa uzytkownika w Foundry
    room: region.name,       // nazwa regionu = nazwa pokoju
    url: BOT_URL,
    secret: BOT_SECRET
});

console.log(`DRPG | ${owner.name} -> ${region.name}`);
