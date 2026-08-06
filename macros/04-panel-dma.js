/**
 * MAKRO: Panel DMa
 * ---------------------------------------------------------------------------
 * Jeden przycisk do rzeczy, ktore robisz co pore dnia / co rozdzial:
 *   - reset zetonow przeszukania
 *   - podglad zetonow
 *   - zbiorka wszystkich graczy w jednym pomieszczeniu (Etap 7: odkrycie ciala)
 *   - sprzatanie Faint Remnantow na koniec rozdzialu
 *
 * Typ makra: Script.  Uruchamia: tylko DM.
 */

const DialogV2 = foundry.applications.api.DialogV2;

const akcja = await DialogV2.wait({
    window: { title: "Panel DMa — Danganronpa RPG" },
    position: { width: 420 },
    content: `<p>Co robimy?</p>`,
    buttons: [
        { action: "reset", label: "Reset zetonow (nowa pora dnia)" },
        { action: "podglad", label: "Pokaz zetony przeszukania" },
        { action: "zbiorka", label: "Zbiorka — odkrycie ciala" },
        { action: "sprzataj", label: "Koniec rozdzialu — usun Faint Remnants" },
        { action: "anuluj", label: "Anuluj" }
    ]
});

switch (akcja) {

    /* --------------------------------------------------------------------- */
    case "reset": {
        await game.drpg.resetTokens();
        break;
    }

    /* --------------------------------------------------------------------- */
    case "podglad": {
        await game.drpg.showTokens();
        break;
    }

    /* --------------------------------------------------------------------- *
     * Etap 7: wszyscy gracze teleportuja sie do pomieszczenia z cialem.
     * Zaznacz najpierw JEDEN token stojacy tam, gdzie ma byc zbiorka.
     * --------------------------------------------------------------------- */
    case "zbiorka": {
        const kotwica = canvas.tokens.controlled[0];
        if (!kotwica) {
            ui.notifications.warn("Zaznacz najpierw token w pomieszczeniu, do ktorego maja przyjsc wszyscy.");
            break;
        }

        const gridSize = canvas.grid.size;
        const gracze = canvas.tokens.placeables.filter(t =>
            t.id !== kotwica.id &&
            t.actor &&
            game.users.some(u => !u.isGM && t.actor.testUserPermission(u, "OWNER"))
        );

        // Ustawiamy ich w siatce wokol kotwicy
        const updates = gracze.map((t, i) => {
            const kolumna = i % 4;
            const wiersz = Math.floor(i / 4);
            return {
                _id: t.id,
                x: kotwica.x + (kolumna + 1) * gridSize,
                y: kotwica.y + wiersz * gridSize
            };
        });

        await canvas.scene.updateEmbeddedDocuments("Token", updates, { animate: false });

        await ChatMessage.create({
            content: `<h3>Odnaleziono cialo</h3>
                      <p>Wszyscy uczniowie zostali wezwani na miejsce zdarzenia.</p>`
        });
        ui.notifications.info(`Przeniesiono ${updates.length} tokenow.`);
        break;
    }

    /* --------------------------------------------------------------------- */
    case "sprzataj": {
        const potwierdz = await DialogV2.confirm({
            window: { title: "Koniec rozdzialu" },
            content: `<p>Usunac wszystkie <b>Faint</b> Remnanty oraz Truth Bullety
                      z ekwipunku graczy (poza Faint Truth Bullets)?</p>
                      <p><b>Tej operacji nie da sie cofnac.</b></p>`
        });
        if (!potwierdz) break;

        // 1. Faint Remnanty (wpisy dziennika + pinezki)
        const folder = game.folders.find(f => f.name === "Remnants" && f.type === "JournalEntry");
        const doUsuniecia = (folder?.contents ?? []).filter(e => e.flags?.["danganronpa-rpg"]?.faint);
        for (const e of doUsuniecia) await e.delete();

        // 2. Truth Bullety u graczy
        let usunieteBullety = 0;
        for (const actor of game.actors) {
            const bullety = actor.items.filter(i => {
                const fl = i.flags?.["danganronpa-rpg"];
                return fl?.truthBullet && !fl?.faint; // Faint Truth Bullets zostaja
            });
            if (bullety.length) {
                await actor.deleteEmbeddedDocuments("Item", bullety.map(i => i.id));
                usunieteBullety += bullety.length;
            }
        }

        ui.notifications.info(`Usunieto ${doUsuniecia.length} Faint Remnantow i ${usunieteBullety} Truth Bulletow.`);
        break;
    }
}
