# Danganronpa RPG - Podręcznik GM

*Dla modułu "Danganronpa RPG" do Foundry VTT v14, wersja 1.2.67, zbudowanego na systemie Daggerheart.*

To podręcznik dla osób prowadzących killing game. Idzie w kolejności, w jakiej sezon naprawdę się buduje i gra: instalacja, ustawienie, prowadzenie dnia, morderstwo, Investigation, Class Trial, koniec rozdziału i od nowa. Tam, gdzie decyzja należy do GMa, a nie do modułu, tekst mówi to wprost.

> [!NOTE]
> Każda liczba w tym podręczniku pochodzi z `scripts/config.mjs`; jeśli któraś zasada wyda się sprzeczna z tym, co widać przy stole, ten plik jest autorytetem, a niniejszy dokument komentarzem.

Słownik zostaje po angielsku w każdym języku, w jakim mówi moduł: Hope, Despair, Sanity, Health, Truth Bullet, Remnant, Key Remnant, Blackened, Class Trial, Daily Life, Eclipse, Mastermind, Monokuma, Monocub, Ultimate, Vault, Stash, nazwy Calli i nazwy akcji. To nazwy własne tej gry - odmieniamy je, ale nie tłumaczymy.

---

## 1. Instalacja i zależności

Instaluj z zakładki **Add-on Modules** w Foundry przez **Install Module** i ten adres manifestu:

```
https://github.com/Akrobacjum/Danganronpa-RPG/releases/latest/download/module.json
```

Potem zainstaluj system i poniższe moduły z ich własnych stron. Moduł odmawia startu bez wymaganego i wymienia go jako "niezainstalowany" albo "zainstalowany, ale wyłączony". O dwóch zalecanych GM dostaje ostrzeżenie przy każdym wczytaniu świata, w oknie, które mówi, do czego każdy z nich służy, dopóki nie zaznaczy w nim pola "Nie przypominaj o tym więcej na tym komputerze"; wszystko działa i bez nich. Moduł nigdy niczego nie instaluje sam.

| Wymaga | Wersja |
|---|---|
| Foundry VTT | 14.364 lub nowsza (sprawdzone na 14.365) |
| Daggerheart (Foundryborne) | 2.6.5 lub nowsza (sprawdzone na 2.6.5; nowsza wersja się ładuje, a moduł mówi o tym GM-owi raz na wersję) |

| Moduł | Status | Po co |
|---|---|---|
| Dice So Nice! | wymagany | Każdy rzut w tej grze leci na ekranach, które mogą go widzieć; tak widać kości duality |
| Isometric Perspective | zalecany | Mapy akademii są rysowane izometrycznie; bez niego sceny, tokeny i Remnants trafiają na siatkę, dla której ta grafika nie powstała. Mapy kwadratowe i tak działają |
| LiveKit AVClient | zalecany | Głos per pokój: regiony stają się pokojami breakout, a przejście między pokojami zmienia, kto cię słyszy. Bez niego cała szkoła rozmawia na jednym kanale |

Moduł nie używa libWrapper. Jeśli Isometric Perspective kiedyś będzie go potrzebować, powie o tym strona tamtego modułu.

Moduł powstał i był grany na The Forge; działa tak samo na każdym hoście Foundry v14.

**Start świata.** Załóż świat na systemie Daggerheart, włącz moduł i zależności, potem otwórz panel GMa (przycisk **GM** w lewej kolumnie, pod zegarem) i uruchom **Ustaw sezon**. Cała reszta to sekcja 2.

**Aktualizacja z wersji sprzed 1.2.63.** 1.2.63 przenosi to, co wolno wiedzieć tylko GMom - sprawę, sekcja 14 - do magazynu, który trzyma osobno dla każdego świata w przeglądarce każdego GMa. Magazyn, który wcześniejsze wersje trzymały w przeglądarce, tylko czyta i nigdy go nie zapisuje, a nic nie opuszcza danych świata, zanim nowy magazyn tego nie odczyta z powrotem. Przed instalacją skopiuj świat (kopia zapasowa świata w Setup Foundry albo kopia folderu świata), jak przed każdą aktualizacją, która przenosi dane. Jeśli chcesz mieć też kopię samej przeglądarki, otwórz świat w przeglądarce każdego GMa i wklej to do konsoli (F12); zapisuje do jednego pliku każdy klucz `danganronpa-rpg.` tej przeglądarki i zwraca, ile ich zapisało. Ten plik zawiera każdy klucz odpowiedzi, który ta przeglądarka trzyma, ze wszystkich światów, które otwierała: trzymaj go tam, gdzie żaden gracz go nie otworzy, jak kopię sprawy.

```
(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith("danganronpa-rpg.")) o[k] = localStorage.getItem(k); } foundry.utils.saveDataToFile(JSON.stringify(o), "application/json", `drpg-browser-${game.world.id}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`); return Object.keys(o).length; })()
```

Świat skopiowany przed aktualizacją otwiera się z tą samą sprawą co oryginał w przeglądarce, która grała w oba: stary magazyn w przeglądarce nie mówił, którego świata jest, więc każda kopia bierze wiersze pasujące do jej własnych aktorów, scen i przedmiotów. Od pierwszego wczytania każdy świat trzyma już swoją. Czy Duplicate World w Foundry nadaje kopii własny identyfikator świata, od czego to zależy, nie zostało sprawdzone przy stole.

**Aktualizacja z wersji sprzed 1.2.64.** 1.2.64 wyjmuje z danych świata kolejne rzeczy, które wolno znać tylko GMom, i przenosi je do tego samego magazynu: kto buduje każdą pułapkę, co ją uruchamia i kto zsabotował projekt; Direct Murders zgłoszone w ciemności i przejścia trwającego Eclipse; plan Key Remnants; notatki graczy przed sesją; to, jak doszło do trwającego incydentu; licznik overflow; to, co zabrano z każdego ciała; i to, z którego śladu pochodzi każdy Truth Bullet. Usuwa z danych świata zakładkę Rerolla i fakty z karty Search, przywraca neutralną nazwę i obrazek na żetonach śladów, które wcześniejsze wersje nazwały, i przenosi do sprawy klucze odpowiedzi, które wciąż zostały na żetonach starych śladów. Dzieje się to raz, w przeglądarce głównego GMa, chwilę po pierwszym wczytaniu 1.2.64. Nic nie opuszcza danych świata, zanim magazyn tego nie odczyta z powrotem; krok, który nie może się dokończyć, zostawia świat bez zmian, mówi o tym w komunikacie, który zostaje na ekranie, a przy następnym wczytaniu świata próba się powtarza. Skopiuj świat przed instalacją, jak przy 1.2.63, i po tym pierwszym wczytaniu zrób **Kopię sprawy** (sekcja 14). Nie wracaj potem do 1.2.63: czyta ona dane świata, które 1.2.64 opróżniła, więc pułapki tracą zabójcę i wyzwalacz, notatki, plan Key Remnants i licznik overflow są puste, gracze przestają widzieć znalezione ślady, a to, co zabrano z każdego ciała, zostaje zapomniane.

**Ustawienia modułu warte znajomości.** W ustawieniach modułu w Foundry znajdziesz m.in.: *wymuszone prywatne rzuty graczy* (każdy rzut jest szeptem: ten, który rzuca akcja, tylko do GMów, a rzucający czyta swój, a statystyka kliknięta na arkuszu - do GMów i gracza tej postaci; z Dice So Nice 6.0 lub nowszym kości rzutu padają wtedy tylko na ekranach, które mogą go przeczytać (a w walce incydentu także u jego uczestników), niezależnie od ustawienia *Hide 3D dice on secret rolls* samego Dice So Nice - starszy Dice So Nice rozstrzyga to własnym ustawieniem), *anonimowe arkusze postaci* (cudzy arkusz otwiera się ocenzurowany), *Search Tokens na pokój*, *blokadę okna rzutu dla graczy*, *gracze widzą tylko tych, którzy są w ich pokoju*, *pokoje decydują, co widzą gracze* (mgła pokojów), *gracze nie edytują akcji, Hope, Health, Sanity ani statystyk*, *przejście między pokojami kosztuje Move*, *rzuty dają Despair*, *zastąpienie licznika Fear z Daggerheart*, *chroń edycję tokenów przed Isometric Perspective*, *muzyka podąża za stanem gry*, *głos per pokój*, oraz per przeglądarkę *Język* i *Motyw*. Domyślne wartości to sposób, w jaki gra ma być grana; przełączniki istnieją po to, by stół mógł któryś kawałek prowadzić ręcznie, gdy zechce.

> [!IMPORTANT]
> Dwa z tych ustawień są na starcie wyłączone, bo każde najpierw czegoś od ciebie potrzebuje: *muzyka podąża za stanem gry* (playlisty zmapowane w oknie Dźwięk) i *głos per pokój* (LiveKit AVClient i działający serwer).


> [!NOTE]
> **Co gracz może z konsoli, a czego nie.** Przeglądarki graczy proszą twoją o większość zmian w tej grze, a Daggerheart robi to samo dla własnych reguł. Twoja przeglądarka sprawdza każdą prośbę: kto naprawdę ją wysłał, czy gracz prowadzi tę postać albo może widzieć projekt, czy pokój, etap i tura na to pozwalają. Prośba gracza o cofnięcie czegoś jest odrzucana; Reroll wykonuje twoja przeglądarka. Prośba, która nie przejdzie, niczego nie zmienia. Odmowa zostawia linię z nazwą gracza w Dzienniku debugowania głównego GM-a i mówi graczowi, w jego języku, czego nie wykonano i dlaczego; kilka trafia tylko do dziennika - wśród nich zgłoszenie dla pułapek, dopytanie o oferty Level Up i szukanie podłożonego przedmiotu, na które nikt nie czeka - a prośba Daggerhearta rodzaju, którego moduł w ogóle nie zna, jest odnotowana bez nazwy. Przy zmianie od Daggerhearta dostajesz też ostrzeżenie na ekranie, a zmiana, której Daggerheart nie robi dla gracza, zostawia kartę na twoim czacie - zwykle znak, że ktoś obszedł grę, czasem funkcja Daggerhearta, której ten moduł jeszcze nie zna, więc zapytaj, zanim wyciągniesz wnioski. Fear nie jest racjonowany: każdy krok, o który prosi Daggerheart gracza, wchodzi, po jednym, a gdy klient jednego gracza ruszy go więcej niż cztery razy w dziesięć sekund, dostajesz notkę na ekranie - porównaj ją z rzutami na czacie; wolniejszych kroków nic z niczym nie porównuje. Od 1.2.67 kości akcji gracza i statystyki klikniętej na arkuszu rzuca przeglądarka głównego GMa, a to, co akcja przynosi, jest odczytywane z tego rzutu, nie z tego, co podaje przeglądarka gracza; od 1.2.68 to, co ten rzut dodaje do kości - statystyka, doświadczenia, premia, kości przewagi - to własny odczyt twojej przeglądarki: postaci, akcji i Calli, które GMowie mają nałożone, a to, co okno rzutu gracza dołożyło ponad to, nie jest liczone: dostajesz szept, karta samego gracza mówi, czego nie policzono, a `game.drpg.rollFlags()` wymienia ten rzut. Również od 1.2.68 zmianę, którą przeglądarka gracza robi na jego własnym uczniu - Hope, Health, Sanity, akcje, statystyki, przedmioty modułu - przeglądarka głównego GMa sprawdza względem tego, co trzymają GMowie, i cofa ją albo przynosi do ciebie (rozdział 6.3). Czego jeszcze nie sprawdza: kości rzutu rzuconego bez połączonego GMa (to, co taki rzut rusza, przyznajesz sam, rozdział 6) i własnych rzutów przedmiotów i obrażeń Daggerhearta; tego, co przeglądarka gracza wciąż odczytuje sama - tego, który przedmiot daje Search (jego tier jest sprawdzany), wyniku rzutu Shadow, który ukrywa przed pokojem, co uczeń robi, i tego, co słyszy Listen; zasobów każdego aktora, który nie jest uczniem, towarzyszy też; ładunków jego własnych przedmiotów (bez pilnowania maksimum przedmiotu) i ilości tych, które nie są przedmiotami modułu; tyknięć odliczań, po jednym kroku, i dowolnej zmiany odliczania, którego właścicielem go zrobiłeś; sum rzutów obronnych na jego własnych tokenach; wpisów rzutu grupowego i tag teamu jego drużyny; oraz kolejności środowisk sceny - żadne z nich nie ma limitu częstotliwości. Jeśli funkcja Daggerhearta używana przez gracza kończy się tą odmową (postawienie obszaru, uruchomienie odliczania, leczenie albo ranienie innego ucznia umiejętnością), prosi o coś, co ta gra zostawia GM-owi: zrób to za niego. Tak samo czeka na ciebie przekazanie przedmiotu drużynie przez gracza; dowiesz się o tym raz na sesję. Jeśli Daggerheart jest nowszy, niż moduł zna, dowiesz się raz, czego odmawia.
>
> **Co każda przeglądarka i tak ma.** Moduł trzyma swoje sekrety poza danymi świata. Resztę świata wysyła Foundry, i to do każdej przeglądarki, gdzie konsola czyta ją niezależnie od tego, co pokazuje ekran: gdzie stoi każdy token i kiedy się ruszył, łącznie z ukrytymi tokenami i z Eclipse; dane każdego aktora - Health ofiary na 0, zanim ktokolwiek znajdzie ciało, nowe maksima z Level Upu (klasa wybiera razem, co ukrywa chwilę, a nie wielkość: Blackened, który wyszedł z błędnego głosowania, bierze cztery wybory tam, gdzie inni jeden), budżety akcji i Hope, także z zamiany (sekcja 7); każdy przedmiot na każdym arkuszu i każde jego przejście z arkusza na arkusz; to, że karta czatu istnieje, kiedy, kto ją wystawił i do kogo jest szeptem - słowa prywatnych kart modułu idą obok niej, tylko do ich czytelników; Countdowny Daggerhearta, czyli projekty - nazwa tajnego projektu, jego postęp i to, kto może go widzieć (sekcja 11; ta wersja ich nie przenosi); ustawienia świata każdego innego modułu (sekcja 9.4 mówi o tym, które się liczy); i Truth Bullets innych graczy - to, że istnieją, ich nazwa, słowa, które przeczytał ich posiadacz, oraz pokój i czas znalezienia, ale nie ich klucz odpowiedzi i nie to, z którego śladu pochodzą.
>
> **Co wciąż mówi czat** (od 1.2.65). Rzut, który rzuca moduł, nie nazywa nikogo w swoim dokumencie - ani mówiącego, ani tytułu, ani aktora - i jest szeptem tylko do GMów, a rzucający czyta swój; to, co prywatna karta mówi o sobie, idzie z jej słowami; a karta, której samo istnienie coś by zdradziło, jest zasłonięta: zaadresowana do całego stołu i nienazywająca nikogo. Dopóki trwa incydent, zasłonięta jest każda prywatna karta, która nazywałaby postać albo gracza, ktokolwiek ją wystawia i kogokolwiek dotyczy - także własna karta postronnego, więc zasłonięta karta nic nie mówi o tym, kto jest w walce: mówi w niej Monokuma, a przeglądarka, której nie wysłano jej słów, gdy ją wystawiono, nigdy jej nie pokaże (zmierzone w harnessie testowym dla przedmiotu użytego w walce, Calla kupionego dla uczestnika i kart postronnego). Co zostaje, celowo, i na ile każdą rzecz zmierzono:
> - **Kto stworzył rzut albo kartę, i kiedy.** Foundry zapisuje w dokumencie jedno i drugie - użytkownika, którego przeglądarka go stworzyła. Od 1.2.67 rzut gracza - akcji, a także statystyki klikniętej na arkuszu - rzuca przeglądarka głównego GMa i to ona pisze jego wiadomość, więc jej autorem jest GM i nic w niej nie nazywa rzucającego (zmierzone w harnessie testowym, gdzie przeglądarka postronnego trzyma rzut otwarcia zabójcy z GMem jako autorem). Rzucający nadal widzi go jako swój: jego kości spadają na jego ekranie w jego kolorach, albo bez Dice So Nice gra dźwięk kości, i czyta wynik; GMowie widzą kości w kolorach rzucającego, uczestnicy incydentu każdy rzut incydentu, a nikt inny niczego - zmierzone na modelu Dice So Nice w harnessie testowym, nie przy stole. Rzut wykonany, gdy nie jest połączony żaden GM, albo na Daggerheart, którego rzutów moduł nie przejmuje (dostajesz o tym informację raz na wersję), rzuca przeglądarka gracza, a taki rzut nazywa tego gracza jak dawniej - gdy nie jest połączony żaden GM, akcja jest odrzucana, zanim gracz za nią zapłaci, a każdy inny rzut dostaje znacznik i niczego nie rusza, dopóki GM go nie przyzna (rozdział 6, główny GM). Prywatną kartę, którą przeglądarka gracza wystawiłaby w trakcie incydentu, wystawia na jej prośbę przeglądarka głównego GMa, więc i jej autorem jest GM (zmierzone w harnessie testowym, gdzie przeglądarka postronnego trzyma karty walki - użyty przedmiot, zepsute narzędzie - i wiadomość gracza do GMa z GMem jako autorem); gdy nie jest połączony żaden GM, karta nie zostaje wystawiona, a gracz dostaje informację, że żaden GM nie jest połączony. Każda inna karta, którą wystawia przeglądarka gracza, zasłonięta czy nie, nosi autora tak samo (reguła Foundry, nie mierzone karta po karcie).
> - **To, że zasłonięta karta istnieje, i kiedy; to, że GM szepnął do GMów, i kiedy.** Zmierzone dla pokwitowania pułapki: przeglądarka postronnego trzyma je jako kartę bez wątku i bez gracza, bez jej słów.
> - **Formuła rzutu**, która niesie wartość statystyki: gdy rzucasz za jedną postać, może ją odróżnić od innej (przeczytane w kodzie, nie mierzone).
> - **Własny reroll Daggerhearta** od 1.2.67 znika z menu czatu gracza, a kości, które przeglądarka gracza i tak przepisze - własnym rerollem Daggerhearta na karcie albo z konsoli - przeglądarka głównego GMa przywraca, a GMowie dostają o tym wiadomość (zmierzone w harnessie testowym dla przepisania z konsoli; menu i reroll na karcie nie, bo harness nie uruchamia logu czatu Daggerhearta). Rzutu rzuconego, zanim wczytała się przeglądarka głównego GMa, nie da się przywrócić - GMowie dostają tylko wiadomość. Kości 3D takiego przepisania mogą jeszcze spaść na każdym ekranie, zanim zostanie cofnięte (nie mierzone). Reroll modułu pokazuje swoje kości tylko rzucającemu, GMom i, w walce incydentu, jego uczestnikom.
> - **Aktywność użytkownika w Foundry**: cele i kursor gracza widzą wszyscy (zachowanie samego Foundry, tu nie mierzone; lista ustawienia sezonu może uczynić wskaźnik GMów prywatnym).
> - **Statystyka kliknięta na arkuszu** na twoją prośbę zachowuje kartę Daggerhearta, napisaną przez przeglądarkę GMa i nienazywającą nikogo, szeptem do GMów; poza nimi czytać ją może tylko przeglądarka rzucającego (zmierzone w harnessie testowym). Wszędzie, gdzie się ją czyta, jej nagłówek pokazuje postać rzucającego - portret i imię - albo, w przeglądarce, która nie wie już, czyj to był rzut (po przeładowaniu), nikogo; nigdy GMa (zmierzone na modelu nagłówka Daggerhearta w harnessie testowym, nie przy stole). **Rzut, którego moduł nie rzucił** - własne rzuty przedmiotów Daggerhearta - zachowuje kartę i mówiącego Daggerhearta, szeptem do GMów i gracza tej postaci (przeczytane w kodzie). **Meddle Monocuba** od 1.2.67 rzuca przeglądarka GMa, gdy już sprawdzi cel; jego karta jest kartą modułu, wystawioną przez przeglądarkę gracza Monocuba w imieniu Monocuba, i widzi ją pokój, jak każdy rzut Monocuba. Meddle, którego przeglądarka GMa odmówi, niczego nie rzuca i nie wystawia karty - gracz Monocuba dowiaduje się, że go odrzucono (przeczytane w kodzie; odmowa zmierzona w harnessie testowym).
> - **Log czatu zapisany przed 1.2.65, tam, gdzie jego pierwsze wczytanie nie mogło go przepisać.** To wczytanie przepisuje stare rzuty i prywatne karty modułu tak, jak pisze się je dziś: to, co dziś jest zasłonięte, zostaje zasłonięte (pokwitowania pułapki, karta przerobionego śladu, karty Confusion, informacja o Loaded Die, zużyte albo zepsute narzędzie, pokwitowanie Hope Calla, pora dnia ogłoszona w czasie incydentu), a lista rzutu traci pozostałych graczy incydentu. Zostawia szept, który niesie słowa w swoim dokumencie (szepty modułu sprzed czasu, gdy trzymał prywatne słowa poza dokumentem, i każdy szept, który nie jest modułu), publiczną kartę 1.2.64 o końcu naprawy sekretnego projektu, starą kartę zasłanianego rodzaju rozpoznawaną tylko po słowach, gdy przeglądarka głównego GMa już ich nie trzyma albo trzyma je w innym języku, rzut Monocuba oraz pozostałe prywatne karty wystawione w czasie incydentu - przedmiot użyty w walce, Call uzbrojony na uczestniku - dziś zasłaniane dlatego, że trwa incydent, a stara karta nie zapisuje, czy trwał. Zasłonięta karta wątku zachowuje miejsce w wątku tylko w przeglądarkach połączonych przy tym wczytaniu; gdzie indziej jej słowa zostają w logu czatu. Zmierzone w harnessie testowym dla pokwitowania, karty Confusion i rzutu z walki, nie na logu prawdziwego świata. Wyczyszczenie logu czatu na koniec sprawy zabiera to wszystko.

---

## 2. Lista kontrolna sezonu

**Panel GMa > Między sesjami > Ustaw sezon** (`scripts/season-setup.mjs`). To lista kontrolna, nie kreator: każdy wiersz zostaje na ekranie ze swoim stanem, więc pominięty krok wciąż widać. Ptaszek znaczy zrobione, krzyżyk - sezon tego potrzebuje, kreska - opcjonalne. Wiersze, które moduł umie dokończyć sam, mają przycisk **Zrób to**; wiersze, które potrzebują człowieka, mają **Otwórz** i prowadzą do właściwego okna. Każdy przycisk zamyka i otwiera listę na nowo, by znaczniki były aktualne.

Nad listą są trzy pola zapisywane przyciskiem **Zapisz**: nazwa kampanii (widoczna u góry ekranu każdego), rozdział (**1 do 6**, `CHAPTERS_PER_SEASON`) i **safeword** (puste znaczy domyślne "Safe Word"; sekcja 19).

| Krok | Co sprawdza | Jak naprawić |
|---|---|---|
| Nazwij kampanię | Kampania ma nazwę | Wpisz ją w polu powyżej |
| Obsada istnieje | Jest co najmniej jedna postać ucznia (Monokumy się nie liczą) | Utwórz aktorów |
| Co najmniej jeden Monokuma | Istnieje pula Despair (ma ją każde konto pełnego Gamemastera) i jakaś postać jest oznaczona jako Monokuma; wiersz wymienia, którego z tych dwóch brakuje | **Otwórz** otwiera Despair Flow (sekcja 7); działa też **Oznacz jako Monokumę** z menu prawego przycisku na liście aktorów |
| Startowe Health, Sanity i Hope | Każdy uczeń ma maks. Health 4 i maks. Sanity 6 (`STARTING`); do tego czasu postać liczy się jako Wounded i w Breakdown naraz | **Zrób to** uruchamia `initCharacter` dla każdego ucznia, u którego się nie zgadza |
| Każdy ma Ultimate | Flaga Ultimate jest wpisana u każdego ucznia | **Otwórz** otwiera pierwszy arkusz bez niej |
| Każdy ma swoje doświadczenia | Każdy uczeń ma co najmniej 2 doświadczenia (`STARTING.experiences`, każde +2) | **Otwórz** otwiera pierwszy arkusz, któremu brakuje |
| Każdy coś nosi | Każdy uczeń ma przedmiot startowy (Usable, Murder Weapon, Cleaning Tool albo Tool; klucze i Truth Bullets się nie liczą). Podręcznik daje każdemu jeden przedmiot Tier 2 związany z Ultimate (`STARTING.startingItemTier`); co to jest, uzgadniasz z każdym graczem osobno | **Otwórz** otwiera menedżer przedmiotów |
| Każdego ucznia pilnuje Monokuma | Każdy uczeń karmi jakąś pulę Despair (taki, którego nigdy nie przypisano, trafia do pierwszej puli) albo jest celowo ustawiony na "- nikt -" (postać prowadzona jako NPC, szablon), co liczy się jako pilnowany. Przeglądarka każdego gracza może odczytać, kto jest ustawiony na "- nikt -", więc Masterminda przypisz jak każdego innego ucznia | **Otwórz** otwiera Despair Flow |
| Uczniowie są podzieleni po równo między pule (opcjonalne) | Liczba żyjących uczniów na pulę różni się najwyżej o jednego | Tylko rada: **Otwórz** otwiera Despair Flow, gdzie **Podziel po równo** ich rozdaje. Obsada, która nie dzieli się równo, to decyzja, nie błąd |
| Pliki dźwiękowe (opcjonalne) | Co najmniej jedno zdarzenie ma plik | **Otwórz** otwiera okno Dźwięk; moduł nie zawiera żadnych dźwięków |
| Dość pokoi dla obsady (opcjonalne) | Wspólne pokoje (bez sypialni i regionów z zaznaczonym "To nie pokój" w Ustawieniach pokoi > Drzwi) wobec około 1,5 na gracza (`ROOMS_PER_PLAYER`), zaokrąglone przez `roomsWantedFor` | Tylko rada: poniżej tej proporcji dwie prywatne rozmowy nie mogą toczyć się naraz |
| Mapa ma pokoje | Robocza scena ma co najmniej jeden region | **Otwórz** otwiera Ustawienia pokoi. Wiersz niesie też instrukcję rysowania pokoi i przycisk **Sprawdź pokoje na tej scenie** |
| Kursor GMa jest prywatny (zalecane) | Udostępnianie kursora w Foundry jest wyłączone dla dwóch ról GMa | **Zrób to** edytuje macierz uprawnień core; gracze zachowują swoje |
| Mastermind (opcjonalnie) | Mastermind jest ustawiony | **Otwórz** otwiera okno Masterminda. Sezon bez niego to legalny sezon |
| Mastermind zasila pulę Despair (widoczny tylko, gdy nie zasila) | Mastermind jest w Despair Flow ustawiony na "- nikt -", co odczyta przeglądarka każdego gracza; sprawdzenie sprawy (`game.drpg.gmStoreHealth()`, `game.drpg.diagnoseGmStores()`) też to wymienia | **Otwórz** otwiera Despair Flow |
| Sekretu serwera głosu nie ma w świecie (widoczny tylko, gdy jest) | LiveKit AVClient jest ustawiony na własny serwer, a jego sekret API leży w ustawieniu świata, które trafia do każdej przeglądarki | Ten moduł nie może go przenieść: serwer, który sam wydaje tokeny dostępu, na przykład Tavern, trzyma sekret z dala od przeglądarek. `game.drpg.diagnoseVoice()` mówi to samo |

> [!IMPORTANT]
> **Jak rysować pokoje** (instrukcja z wiersza): najpierw ściany, potem <ins>jeden nazwany region na pokój</ins>, rysowany po ścianach z włączonym przyciąganiem. Nienazwany region nie jest pokojem i nigdy nie liczy się jako sąsiad. Sąsiedzi stykają się wspólną krawędzią i nigdy nie nachodzą na siebie. Drzwi to po prostu przerwa w ścianach, dowolnej szerokości. Dwie strefy to dwa pokoje. Kontrola zgłasza nachodzenia, granice narysowane obok ścian i narożniki poza siatką; nigdy nie edytuje mapy.

**Kontrola przed sezonem** (przycisk u dołu) uruchamia trzy raporty w jednym oknie: komu jeszcze brakuje zasobów startowych, które sceny z pokojami są przygotowane do widoczności opartej na pokojach, oraz audyt anonimowości (czyj arkusz gracz mógłby przeczytać, a nie powinien). Zielono tutaj znaczy, że lista powyżej jest kompletna.

**Liczby tworzenia postaci** (`config.mjs`):

| Na starcie | Wartość |
|---|---|
| Statystyki | sześć - Eye, Head, Body, Leg, Hand, Shadow - rozkład **+2, +1, +1, 0, 0, -1** (`TRAIT_ARRAY`) |
| Health | **4** |
| Sanity | **6** |
| Hope | **2** z maksimum 6 |
| Doświadczenia | dwa, po **+2** |

---

## 3. Panel GMa

`scripts/gm-panel.mjs`. Otwierany przyciskiem **GM** pod zegarem. Góra panelu to stan gry: nazwa kampanii, linia zegara ("Rozdział 2 · Dzień 3 · Sesja 3 · Popołudnie", z dopiskiem "· ECLIPSE", gdy trwa), faza, przycisk **Następna pora dnia**, linia **Dalej** oraz tabela żyjącej obsady z pozostałymi akcjami i tym, czy Free Move jeszcze jest. Monokum i zwykłych zmarłych w tabeli nie ma; Monocub jest, bo wydaje prawdziwy budżet.

**Linia Dalej** to jedna instrukcja, wedle pilności, wygrywa pierwsze dopasowanie:

1. Trwa incydent - doprowadź go do końca (otwiera tracker morderstwa).
2. Eclipse jest otwarty - zamknij go, gdy wszyscy się ustawią.
3. W Class Trial: trial przeżył swój rozdział (zakończ go); werdykt zapadł (zakończ rozdział); głosy policzone (ogłoś werdykt); brak otwartej debaty (otwórz, gdy sala gotowa); inaczej - trwający tryb i kto ma głos.
4. Znaleziono ciało, a Investigation nie ruszyło - rozpocznij je.
5. W Investigation: wszystkie zaplanowane Key Remnants znalezione - zacznij Class Trial; inaczej zajrzyj na pulpit.
6. Daily Life: "*n* uczniów ma jeszcze akcje do wydania", albo wszyscy wydali - zacznij Eclipse (jego otwarcie odnawia wszystkich, zamknięcie przesuwa zegar).

**Zrób to** obok linii wykonuje krok. Linia może wskazywać rzeczy, które nie są kafelkami (`EXTRA_ACTIONS`): przełączenie Eclipse, przesunięcie zegara, koniec rozdziału, start Investigation, konsolę Class Trial.

**Następna pora dnia** przesuwa zegar bez Eclipse i *odnawia* akcje, Free Moves i Search Tokens; nocą zaczyna też następny dzień i sesję. Ukryta podczas Eclipse (jego koniec przesuwa zegar) i podczas Class Trial (robi to koniec rozdziału).

Kafelki, według sekcji:

| Sekcja | Kafelki |
|---|---|
| Teraz (zawsze otwarta) | **Uczniowie** (żyje / nie żyje / Monocub, Hope Monocubów i jeden przycisk **Przedmioty** u dołu okna), **Projekty**, **Dźwięk**, **Zasady killing game** |
| Sprawa (Daily Life, Investigation, Class Trial) | **Morderstwo** (wyszarzone podczas Eclipse), pulpit **Investigation**, konsola **Class Trial** |
| Między sesjami (zwinięta) | **Edytuj kampanię**, **Despair Flow**, **Ustawienia pokoi**, **Tabele przedmiotów**, **Zresetuj wszystkie pokoje głosowe**, **Ustaw sezon**, **Mastermind**, **Zakończ rozdział**, **Zresetuj sezon** (czerwony) |
| Diagnostyka (zwinięta, przyciemniona) | **Dziennik debugowania** - wszystko, co w tej przeglądarce poszło nie tak od załadowania strony, z Kopiuj i Wyczyść |

O **Uczniach** warto dodać: lista rozwijana tylko przestawia flagi i jest narzędziem naprawczym na pomyłkę. Przyciski po prawej robią to naprawdę - **Postać umiera**, opisane niżej, i **Zaproś jako Monocuba**, który robi z martwego ucznia Monocuba. Kolumny Monocuba (Hope, zamiana Despair w Hope, Uciszony) pojawiają się dopiero, gdy jakiś Monocub istnieje. Śmierć, którą GMowie trzymają, dopóki ciało nie zostanie znalezione (sekcja 13.4), stoi na liście jako **Martwy, nieodnaleziony**; ustawienie *Nie żyje* (albo *Monocub*) ujawnia ją stołowi - tak samo, jak robi to odkrycie ciała - a ustawienie *Żyje* cofa śmierć.

> [!CAUTION]
> **Postać umiera** niszczy Truth Bullets postaci (chyba że zaznaczysz *Zachowaj ich Truth Bullets*, przy śmierci spoza killing game) i zostawia resztę przy ciele. Drugie pole, *Zachowaj to dla GM-ów, dopóki ciało nie zostanie znalezione*, jest zaznaczone dla ofiary trwającego incydentu: wtedy do stołu jeszcze nic nie dociera - bez flagi, bez znacznika, a Truth Bullets giną dopiero, gdy śmierć wyjdzie na jaw (sekcja 13.4).

---

## 4. Zegar

`scripts/clock.mjs`. Sezon > rozdział > sesja > pora dnia. Jedna sesja to jeden dzień fikcji, czyli pięć pór dnia: **Rano, Południe, Popołudnie, Wieczór, Noc** (`TIMES_OF_DAY`). Przejście za Noc przewija dzień i sesję naraz. Rozdziały nigdy nie przesuwają się same; podręcznik pozwala rozciągnąć rozdział, gdy nie było jeszcze morderstwa, więc rozdział przesuwasz ręcznie (Koniec rozdziału albo Edytuj kampanię).

Trzy **fazy**. Kanoniczny rozdział to pięć sesji, jak niżej - ale fazę ustawia się ręcznie:

| Faza | Co oznacza | Sesje w kanonicznym rozdziale |
|---|---|---|
| Daily Life | dwie akcje na porę dnia | trzy (trzecia z morderstwem) |
| Investigation | znaleziono ciało; Observe i Analyze budują Truth Bullets | jedna |
| Class Trial | - | jedna |

**Co robi zmiana pory dnia**, po kolei (`applyTimeOfDayChange`):

1. sprawdza Despair overflow (sekcja 7) - przed uzupełnieniem żetonów, bo zaciemnienie może zmniejszyć ich liczbę;
2. uzupełnia Search Tokens w każdym pokoju;
3. czyści każdy Despair Call obowiązujący przez jedną porę dnia (pieczęcie Behind Closed Doors, Chained, Silence);
4. odlicza jedną porę dnia od terminu Motive;
5. ogłasza nową porę dnia stołowi (prywatnie uczestnikom, gdy trwa morderstwo) i przerysowuje HUD u wszystkich.

> [!IMPORTANT]
> Zmiana pory dnia sama z siebie **nie odnawia akcji**. Budżet wraca, <ins>gdy Eclipse się otwiera</ins> (sekcja 12); panelowa **Następna pora dnia** przekazuje odnowienie jawnie dla stołów, które pomijają Eclipse, a okno Edytuj kampanię ma na to pole wyboru. Dwa odnowienia na jedną granicę to jedyna rzecz, której stół nie może dostać.

**Cofanie** (lewa strzałka na HUD) przesuwa zegar o jedną porę dnia wstecz jako korekta pomyłki. Jest odrzucane, gdy trwa Eclipse (zegar jeszcze się nie przesunął, więc nie ma do czego się cofać; zamiast tego zakończ Eclipse z panelu bez przesuwania zegara). Nie odnawia niczego, najpierw odwołuje zwołane zgromadzenie, czyści obowiązujące Calle i oddaje Motive jego porę dnia.

**Edytuj kampanię** (Między sesjami) edytuje nazwę, rozdział, fazę, dzień, sesję i porę dnia, z domyślnie wyłączonym *Odnów też akcje i Search Tokens*.

> [!WARNING]
> Dwie przestrogi:
>
> - zmiana fazy kończy zapis "znaleziono ciało i czeka";
> - przesunięcie zegara nie kończy Eclipse - jeśli trwał, po Zastosuj dostajesz ostrzeżenie, a linia zegara mówi ECLIPSE, dopóki nie zakończysz go z HUD.

**HUD** pokazuje to wszystko wszystkim. GM ma dodatkowo strzałki: lewa cofa, prawa zaczyna Eclipse przed następną porą dnia (podpowiedź go nazywa) i zamienia się w przycisk odtwarzania, który go kończy. Nocą podpowiedź prawej strzałki mówi, że kończy też sesję. HUD pokazuje też, jak długo trwa bieżąca pora dnia (bursztyn po **15 minutach**, czerwień po **30**, zamrożone, gdy gra stoi na pauzie). Podczas Class Trial wiersz pory dnia podaje zamiast niej tryb rozprawy, strzałki i linia czasu ustępują miejsca, a odliczanie debaty siedzi na karcie Class Trial w panelu zdarzeń. Pasek stanu GMa pokazuje licznik "Zostały akcje", a podczas Eclipse "Jeszcze się ustawiają". **Panel zdarzeń** pod paskiem Despair pokazuje trwające zdarzenia jako karty: stop safewordu, Class Trial i jego głosowanie, rzut otwarcia i incydent (tylko uczestnikom i GMom), znalezione ciało, zaciemnienie z overflow, zwołane zgromadzenie i Motive.

---

## 5. Akcje i budżety

`config.mjs ACTIONS`, `STARTING`, `scripts/actions.mjs`. Każdy uczeń ma **2 akcje** na porę dnia i **1 Free Move**. **Wounded** (całe Health zaznaczone) kosztuje 1 akcję na porę dnia; zaciemnienie *Panic* kosztuje 1 więcej; oba się sumują, ale nigdy poniżej **1**. Budżet jest wyliczany, nie przechowywany, więc postać, która wyleczy się w ciągu dnia, dostaje akcję z powrotem przy następnym odnowieniu. **Breakdown** (Sanity na 0) daje utrudnienie na każdym rzucie.

Dziesięć kafelków na arkuszu, w kolejności rysowania:

| Akcja | Statystyka | Koszt | Co robi | Liczby |
|---|---|---|---|---|
| Search | Eye | 1 + Search Token pokoju | Przeszukaj pokój pod kątem czegoś, co nazwiesz | 8: Tier 0 (ślad Hidden), 12: Tier 1 (Subtle), 18: Tier 2 (Evident); krytyk: +1 Tier i ślad Obvious. Zabranie Murder Weapon albo Cleaning Tool zostawia Faint Prep Remnant. Porażka nic nie znajduje |
| Observe | Eye | 1 | Skopiuj Remnant do ekwipunku jako Neutral Truth Bullet | DC z `OBSERVE_DC` (sekcja 14); porażka kosztuje 1 Sanity (`OBSERVE_FAIL_STRESS`) |
| Analyze | Head | 1 | Rozpoznaj Neutral Truth Bullet albo poproś GMa o wskazówkę | DC z `ANALYZE_DC`; porażka blokuje ten bullet do końca rozdziału. Tryb wskazówki: 14 subtelna, 18 bezpośrednia, krytyk: jedno pytanie do ciebie. Znajdź ukrytą skrytkę: 16 |
| Projects | statystyka projektu | 1 | Popchnij projekt w tym pokoju albo zaproponuj nowy do twojej zgody | 12: +1 postępu, 18: +2; krytyk: +2 i zwrot akcji |
| Dynamiczna | wybór GMa | 1 | Gracz opisuje coś, na co gra nie ma nazwy; ty ustalasz próg | pasma poniżej |
| Rest | brak | 1 (Short) albo 2 (Long) | Odzyskaj | poniżej |
| Listen | Shadow | 1 | Dowiedz się, kto jest obok, bez GMa | Pokój wybiera się przed rzutem. 14: ile osób w nim jest; 18: kto to jest, z imienia; krytyk: kto jest w każdym sąsiednim pokoju. Odpowiedź to prywatna karta. Sąsiad, którego słuchający nie odkrył, figuruje tylko jako "Nieodkryty pokój 1, 2...", na liście wyboru i w odpowiedzi |
| Palm | Hand, potem Shadow | 1 | Wyjmij coś z cudzej kieszeni albo coś w niej zostaw | Kradzież: 10 na powodzenie, 15 na Shadow, by nikt nie zauważył. Podłożenie: 8, niezauważone 13 |
| Tamper | Shadow | 1 albo 1 Sanity, gdy nie ma już akcji | Usuń ślad, przerób go albo podłóż taki, który wskazuje kogoś innego | Zasady Stage 6 (sekcja 13). Sięga tylko śladów w twoim pokoju, które znalazłeś (masz ich Truth Bullet), a przy otwartym incydencie także jego śladów Incident, jeśli jesteś jego ofiarą albo jednym z zabójców |
| Direct Murder | brak | 1 | Otwórz Direct Murder, uzgodnione z tobą wcześniej | Zgłaszane w Eclipse; sekcja 13 |

**Move** nie jest kafelkiem: akcją jest przeciągnięcie tokenu, a koszt nalicza się, gdy token wejdzie do innego pokoju. **Sabotage** to trzecia gałąź menu Projects i rzuca statystyką projektu, który psuje.

**Kto wybiera statystykę.** Rzut, którego definicja wymienia jedną statystykę, rzuca nią. Taki, który wymienia kilka - otwarcia, akcje kryzysowe, sprzątanie - pyta ciebie: gracz mówi ci w swoim wątku komunikatora, co robi jego postać, a ty wybierasz jedną z wymienionych statystyk na karcie w tym wątku albo w oknie na własnym ekranie, gdy sam rzucasz za postać. **Odmów** znaczy, że akcja nie zostaje wykonana, i nic nie jest wydane. Okno rzutu otwiera się na twoim wyborze, zablokowane. Jedynym wyjątkiem jest Hope Call **Resolve**, po którym gracz wybiera w oknie rzutu. Rzut projektu - praca nad nim albo jego Sabotage - bierze statystykę nadaną projektowi przy tworzeniu; projekt zapisany bez niej pyta cię raz, w ten sam sposób, i zachowuje twój wybór.

**Akcje dynamiczne** (`DYNAMIC_THRESHOLDS`). Opis gracza trafia do ciebie jako karta w jego wątku komunikatora z przyciskami **Ustal trudność** i **Odmów**. Wybierasz pasmo i statystykę; odmowa nic gracza nie kosztuje. Sukces zostawia Faint Prep Remnant o widoczności pasma:

| Pasmo | Próg | Tier | Ślad |
|---|---|---|---|
| Banalne. Każdy by to zrobił | 8 do 12 | 0 | Obvious |
| Wymaga wprawy | 13 do 15 | 1 | Evident |
| Obce większości ludzi | 16 do 18 | 2 | Subtle |
| Wymaga bardzo niszowej wiedzy | 19 do 21 | 3 | Hidden |

**Rest** (`REST`). **Long Rest** kosztuje **2 akcje**, wybiera 2 z trzech opcji, **raz na sesję**. **Short Rest** kosztuje **1 akcję**, wybiera 1, **raz na porę dnia**. Każdy działa <ins>tylko w pokoju z taką flagą</ins> (Ustawienia pokoi > Odpoczynki); podręcznik umieszcza Long Rest w sypialniach, więc oflaguj je.

| Opcja | Long Rest | Short Rest |
|---|---|---|
| Sen | przywraca całe Health | przywraca połowę |
| Posiłek | przywraca całe Sanity | przywraca pół |
| Oddech | daje 2 Hope | daje 1 |

**Sabotage** (`ACTIONS.sabotage`):

| Wynik | Psuje projekt tak, że potrzebuje | Ślad |
|---|---|---|
| 12 | prostej naprawy | Subtle |
| 18 | złożonej naprawy | Evident |
| Krytyk | naprawy o ukrytej trudności | Obvious |
| Porażka | - | i tak zostawia ślad Hidden |

Gdy w pokoju jest ktoś jeszcze, sabotażysta rzuca też Shadow przeciw **16**, by ukryć, co robi (`SABOTAGE_CONCEAL`); z Despair fuszeruje i sabotaż jest o 1 trudniejszy; wynik z Despair przy świadkach jest ogłaszany całemu stołowi. Zepsuty projekt jest zamrożony do ukończenia projektu naprawy.

> [!NOTE]
> Uszkodzenie nakłada klient GMa - jeśli żaden GM nie potwierdzi na czas, rzut się udał, ale cel może nie być zepsuty, i gracz ma o tym powiedzieć.

**Krytyki** dają **2 Hope** (`CRITICAL.hope`). Rzut z Despair, w którym użyto przedmiotu trzymanego w ręku, zdejmuje z niego jeden punkt wytrzymałości (sekcja 10).

---

## 6. Hope Calls i Despair Calls

### 6.1 Hope Calls (`HOPE_CALLS`)

Wydawane z arkusza postaci, szeptem do gracza. Call, który zmienia rzut - Support, Experience, Ultimate, Resolve, Loaded Die - jest kupowany w przeglądarce głównego GM-a, która pobiera Hope i go nakłada; bez połączonego GM-a nie da się go kupić i nic nie jest płacone (odczytane z kodu: przeglądarka GM-a odmawia przed zapłatą; zmierzone dla Search, nie dla Calla). Rzut losowany przez przeglądarkę głównego GM-a stosuje tylko Calle, które GMowie mają nałożone; rzut rzucony w przeglądarce gracza - bez połączonego GM-a albo na Daggerheart, którego rzutów moduł nie losuje - zużywa tam Calle, które pokazuje jego okno (odczytane z kodu). Zablokowane podczas Eclipse, pod zaciemnieniem *Silence*, dla gracza trafionego Despair Callem *Silence* i dla zmarłych; zostają otwarte w incydencie i w Class Trial. Dwa z nich wymagają twojej decyzji.

| Call | Koszt | Efekt | Potrzebuje GMa |
|---|---|---|---|
| Support | 1 | Daj innemu graczowi przewagę na jeden rzut; ten sam pokój | nie |
| Experience | 1 | Dodaj doświadczenie do rzutu, do którego naprawdę się stosuje | tak |
| Ultimate | 1 | Przewaga na rzut, do którego Ultimate naprawdę się stosuje | tak |
| Contribution | 2 | +1 postępu do projektu, nad którym pracuje się w twoim pokoju | nie |
| Sprint | 2 | Jedno dodatkowe przejście między pokojami w tej porze dnia, za darmo | nie |
| Reroll | 3 | Przerzuć akcję; poprzedni wynik jest cofnięty. Akcji kryzysowej, która kogoś zabiła, nie da się przerzucić: śmierć zostaje. Ślad, na którym coś zapisałeś, ślad, który ktoś już znalazł (gdy Reroll by go usunął), i ślad starszy, niż sięga Reroll, zostają bez zmian; dostajesz wiadomość, który to ślad, do rozstrzygnięcia ręcznie. Robi go twoja przeglądarka - Hope, kości, wiadomość, cofnięcie i powtórkę; bez podłączonego GM-a się nie odbywa. Rozlicza to, co rozliczyłby świeży rzut tymi kośćmi: Hope, Fear i drugi punkt Hope za krytyk tylko przy włączonej w Daggerheart automatyzacji Hope i Fear dla graczy, a Despair tylko przy włączonym "Rzuty dają Despair". Przeładowanie przeglądarki, która go robi, w połowie jest naprawiane, gdy wczyta się świat głównego GM-a: zanim nowe kości zaczęły się liczyć, wraca pierwszy rzut i Hope, a gracz i ty dostajecie o tym wiadomość; gdy akcja była wykonywana ponownie, dostajesz kartę z postacią, akcją i oboma wynikami - sprawdź ręcznie, co akcja zostawiła (postęp, przedmioty, ślady, obrażenia, turę) i rozstrzygnij to; Hope zostaje zapłacony, a tego rzutu nie da się już przerzucić; gdy Hope był płacony albo zwracany, zostaje pierwszy rzut, a ty dostajesz wiadomość, by ręcznie sprawdzić Hope tej postaci. Drugi Reroll postaci jest odrzucany, dopóki pierwszy jest robiony, w przeglądarce każdego GM-a. Reroll rzutu, który wylosowała twoja przeglądarka, rzuca go jeszcze raz tak, jak go policzono - te same kości i to, co policzyła twoja przeglądarka, nigdy to, co podało okno rzutu | nie |
| Resolve | 3 | Na jeden rzut sam wybierz statystykę | nie |
| Burst | 4 | Następna akcja nic nie kosztuje, ile by nie kosztowała | nie |
| Relief | 4 | Weź Short Rest teraz: bez akcji, bez pokoju odpoczynku, nie zużywa tego z tej pory dnia | nie |
| Loaded Die | 6 | Przy następnym rzucie jedna kość ustawiona na 12, druga rzucona; krytyk tylko, jeśli i ona wypadnie 12 | nie |

**Zatwierdzanie Experience i Ultimate.** Gracz musi napisać, do czego chce tego użyć - puste pole anuluje, bo decyzja dotyczy zdania, nie Calla. Prośba ląduje jako karta w wątku komunikatora gracza, widoczna dla gracza i każdego GMa, z przyciskami **Stosuje się** i **Nie tym razem**. Odpowiedzieć może każdy GM. Zgodę zachowuje przeglądarka głównego GMa, która tylko z nią uzbraja Call; karta wystawiona przez głównego GMa, który już wyszedł, nie przyjmie zgody - gracz prosi jeszcze raz (odczytane z kodu). Nic nie jest pobierane przed zgodą; odmowa albo milczenie nic gracza nie kosztuje (prośba wygasa po **pięciu minutach**). Jeśli twoja przeglądarka przeładuje się z otwartym pytaniem, klient gracza zapyta ponownie, gdy wrócisz. Po naciśnięciu przycisku karta zmienia się w pokwitowanie w wątku, więc nikt nie orzeka dwa razy; pod nią można jeszcze dopisać coś słowami.

> [!TIP]
> Pytanie jest z podręcznika: czy doświadczenie albo talent *naprawdę* się tu stosuje?

### 6.2 Despair Calls (`DESPAIR_CALLS`)

Wydawane z arkusza Monokumy, z puli, z której ten Monokuma czerpie, i zawsze ogłaszane całemu stołowi. Zablokowane podczas Eclipse i podczas Class Trial. Call, który niczego by nie zmienił, jest odrzucany, zanim zostanie opłacony, a jeśli efekt się nie powiedzie, Despair wraca.

| Call | Koszt | Efekt |
|---|---|---|
| Obstacle | 1 | Utrudnienie na rzut gracza |
| Approval | 1 | Przewaga na rzut gracza |
| Fuel a Monocub | 1 | 1 Despair staje się 1 Hope dla Monocuba, by mógł użyć Confusion |
| Feed the Overflow | 1 | Wlej 1 Despair do overflow |
| Behind Closed Doors | 2 | Zapieczętuj pokój na jedną porę dnia |
| Paranoia | 2 | Gracz traci 2 Sanity |
| Chained | 3 | Jeden gracz nie może opuścić pokoju do końca pory dnia |
| Game Integrity | 3 | Odejmij 2 postępu projektowi |
| Patronage | 3 | Dodaj 2 postępu projektowi |
| Pain | 4 | Gracz traci 2 Health |
| Silence | 4 | Jeden gracz nie może wydawać Hope Calls do końca pory dnia |
| Contraband | 4 | Zniszcz dowolny jeden przedmiot |
| Public Announcement | 6 | Zwołaj wszystkich do jednego pokoju na początek następnej pory dnia |
| Motive | 6 | Ogłoś Motive: żądanie, termin w porach dnia i cenę zignorowania |
| New Rule | 9 | Wprowadź jedną nową zasadę killing game |

Obstacle, Approval, Support i Confusion Monocuba są "uzbrajane" na następny rzut celu tym samym mechanizmem; okno rzutu je nakłada, a nałożony po otwarciu okna celu czeka na jego następny rzut (okno to mówi). Przy rzucie, który losuje twoja przeglądarka (od 1.2.68), decyduje zamiast tego lista twojej przeglądarki: utrudniający Call - utrudnienie albo ujemna premia - liczy się w nim, gdy okno go podaje, niezależnie od tego, kiedy go nałożono, oraz gdy nałożono go ponad minutę przed rzutem, czy okno go pokazuje, czy nie; na następny rzut czeka tylko taki, którego okno nie podaje i który nałożono później. Pieczęcie, Chained i Silence czyści otwarcie następnego Eclipse albo, gdy Eclipse nie jest używany, następna zmiana pory dnia. Public Announcement jest odroczone: zgromadzenie odbywa się na następnej granicy, a cofnięcie zegara je odwołuje. **Motive** pyta o żądanie, termin od **1 do 10** pór dnia (domyślnie **3**, `MOTIVE`) i konsekwencję; jest ogłaszane wszystkim, odlicza się przy każdej zmianie pory dnia (Eclipse się nie liczy), jest ogłaszane raz jeszcze, gdy termin minie, i zostaje na tablicy na zerze, dopóki go nie wycofasz albo rozdział się nie zmieni. **New Rule** trafia na listę zasad killing game, widoczną na każdym arkuszu postaci; brzmienie edytujesz, zasady wycofujesz albo dodajesz w **Zasadach killing game** w panelu.

### 6.3 Decyzje, karty i komunikator

Każda akcja, która potrzebuje człowieka - wskazówki Analyze, akcje dynamiczne, zgłoszenia Direct Murder, propozycje projektów, przerobione ślady, alarmy pułapek, powyższe Calle - przychodzi jako **karta w komunikatorze** (`scripts/gm-bridge.mjs`, `scripts/messenger.mjs`). Komunikator to jeden wspólny wątek na gracza: gracz i każdy GM czytają i piszą w tej samej rozmowie. GM otwiera wątki z przycisku w prawym dolnym rogu (lista z licznikami nieprzeczytanych) albo prawym kliknięciem na graczu w liście graczy Foundry. Karta pokazuje rzut, własne słowa gracza i blok tylko dla GMa z progami; przyciski są tylko dla GMa i sprawdzane ponownie po stronie odbiorcy, więc podrobione kliknięcie nic nie daje. Decyzja bez właściciela-gracza (aktor Monokumy, alarm pułapki) idzie do szeptów GMa, z tymi samymi przyciskami.

Dwóch GMów to norma. Jeden z nich jest **głównym GMem** (połączony pełny Gamemaster o najniższym id użytkownika; Asystent GMa tylko wtedy, gdy żaden pełny Gamemaster nie jest połączony) i to jego klient zapisuje stan świata: przyznany Despair, Search Tokens, odkrycia, wyniki incydentu. Korekty Despair asystenta są przekazywane do głównego. Jeśli coś "nic nie robi", sprawdź, czy główny GM jest połączony.

**Rzuty wykonane, gdy nie był połączony żaden GM.** Gdy nie jest połączony żaden GM, akcja gracza jest odrzucana, zanim gracz za nią zapłaci; każdy inny rzut (statystyka z arkusza, reakcja, rzuty przedmiotów samego Daggerheart) wykonuje przeglądarka gracza, jego karta jest oznaczona "rzucono bez połączonego GMa" i nie rusza Hope, Sanity ani Despair. Gdy GM się połączy, główny GM dostaje jedną kartę, **Rzuty wykonane bez połączonego GMa**: przy każdym takim rzucie postać, jego kości Hope i Despair tak, jak rzuciła je przeglądarka gracza, i to, co by poruszył (reakcja nie rusza niczego). **Przyznaj wszystkie** daje każdemu z nich to, co by poruszył - Hope, Fear Daggerheart, Despair Monokumy - jeden raz; **Nie przyznawaj** nie daje niczego. W obu przypadkach każdy rzut zostaje oznaczony jako rozstrzygnięty i staje się wiadomością GMa, więc nie wraca z pytaniem. Kości na karcie to słowo przeglądarki gracza i dlatego karta pyta. Przy każdym rzucie karta mówi też, co rzut podał - jego modyfikator i kości przewagi - i co dałaby mu lista twojej przeglądarki; to tylko do twojej wiadomości, a przyznanie rusza to, co ruszyły kości.

**Co gracz zapisuje na własnej karcie** (od 1.2.68). Hope, Health, Sanity, akcje i statystyki zmieniają się w grze - przez rzut, Rest, przedmiot, Call, Level Up - a przeglądarka głównego GM-a sprawdza każdą zmianę, jaką przeglądarka gracza robi na jego własnym uczniu, jego przedmiotach modułu i efektach na nich, względem tego, co trzymają GMowie. Zmiana, którą coś pokrywa, zostaje: oddana zapłata, którą twoja przeglądarka widziała, Rest w pokoju, który na niego pozwala, przedmiot użyty i zużyty, cena Calla, znalezisko Search w tierze, na który zasłużył jego rzut. To, czego nic nie pokrywa, idzie jedną z trzech dróg. **Cofnięte** od razu - przyrost Hope (o tyle, ile nic nie pokrywa, więc Hope podrobiony i od razu wydany i tak kosztuje prawdziwy Hope), statystyka, doświadczenie, maksimum (w tym punkty życia klasy), reguły i premie rzutów Daggerhearta i wybory Level Up, własne zapisy modułu, Call nałożony ręcznie, utrudniający Call albo nałożony przez GM-a zdjęty bez rzutu gracza dotyczącego tego ucznia po jego nałożeniu (rzut, który konsola gracza wyśle wcześniej, liczy się jako taki; jest na czacie do twojego wglądu), zmieniony tier, kategoria, role albo rodzaj użytkowego przedmiotu modułu, obniżone zużycie, naprawione zniszczenie albo zwiększona liczba, przeniesienie do schowka albo ze schowka, na które pokój nie pozwala, efekt, który zmienia którekolwiek z nich albo zasób, na uczniu albo na jednym z jego przedmiotów (przedmiot dodany z takim efektem jest usuwany): gracz dowiaduje się, że klient GM-a cofnął zmianę, a GMowie dostają jeden szept - kto, który uczeń i każde pole przed i po. **Zgłoszone** - przyrost Health, Sanity albo akcji, przydziałów Burst i Sprint albo oddany darmowy Move, przedmiot modułu zdjęty z karty albo do niej dodany: zmiana zostaje, a GMowie dostają jedną kartę z **Cofnij** i **Zostaw**; gracz nie dowiaduje się niczego. Kliknąć może każdy GM; przeglądarka głównego GM-a rozstrzyga raz. Cofnij zapisuje pole z powrotem tylko wtedy, gdy wciąż trzyma to, co zostawiła zmiana - pola, które od tego czasu się ruszyło, nie nadpisuje, a karta to mówi - tworzy na nowo usunięty przedmiot albo usuwa dodany. Kartę można rozstrzygnąć przez dobę. **Na liście** - wszystko inne, do przeczytania w `game.drpg.sheetWrites()`. Twoich własnych zmian nic nie ocenia: od tej chwili to one są tym, co trzymają GMowie, i tak ustawiasz ręcznie ruch, którego moduł nie zna.

**Zmiany na kartach postaci zrobione, gdy żaden GM nie patrzył.** Zmianę zrobioną bez połączonego GM-a ocenia się, gdy wczyta się świat głównego GM-a: to, co zostałoby cofnięte, jest cofane od razu, a każda inna różnica - przyrost Hope, Health, Sanity albo akcji, Rest, przedmiot zdjęty albo dodany - trafia na jedną kartę, **Zmiany na kartach postaci zrobione, gdy żaden GM nie patrzył**, wiersz na ucznia i pole z wartością przed i po, z **Cofnij** i **Zostaw** przy każdym oraz **Cofnij wszystko** i **Zostaw wszystko** dla całości. Rest albo przedmiot użyty bez połączonego GM-a też trafia na tę kartę.

**Ustawienie** *Gracze nie edytują akcji, Hope, Health, Sanity ani statystyk* rządzi tym wszystkim dla pól, które wymienia. Włączone (domyślnie) - jak wyżej, a kropki na karcie postaci i na karcie drużyny oraz paski w HUD tokenu są dla graczy tylko do odczytu (sprawdzenie przy stole, LIVE-E29-02, jeszcze nie wykonane). Wyłączone - zmiany gracza w tych polach trafiają na listę, nie są cofane ani zgłaszane. Przedmioty, efekty i zapisy modułu są oceniane tak czy inaczej.

---

## 7. Pule Despair, przydziały i overflow

`scripts/despair.mjs`, `scripts/assignments.mjs`, `scripts/overflow.mjs`, `config.mjs OVERFLOW`.

**Zdobywanie.** Gdy rzut ucznia wypadnie z wyższą kością Despair, **+1 Despair** idzie do puli Monokumy *tego ucznia* (ustawienie *rzuty dają Despair*, zapisywane przez głównego GMa). Rzuty reakcji - gołe kliknięcie statystyki - nic nie płacą; własne rzuty aktora Monokumy nic nie płacą. Uczeń ustawiony na "- nikt -" nie karmi nikogo (przydatne dla postaci wycofanej, prowadzonej jako NPC, albo szablonu). Nie dla Masterminda: podział to ustawienie świata, które odczyta przeglądarka każdego gracza, a jedyny uczeń poza pulami rzucałby się w oczy.

**Pule.** Każde konto pełnego Gamemastera ma pulę Despair z limitem **12** (`STARTING.despairMax`), a postacie Monokum wydają z tych pul. Widget Despair u góry ekranu pokazuje każdą pulę pod jej nazwą, także gdy jest tylko jedna (nazwa ustawiona w Despair Flow, a bez niej nazwa konta): wszyscy widzą liczby, GM ma dodatkowo przyciski. **Despair Flow** (Między sesjami) to jedno okno dla zespołu: którzy aktorzy są Monokumami, z puli którego GMa każdy czerpie, nazwy pul, dodatkowi posiadacze pul (Asystentowi GMa można przyznać pulę), który Monokuma pilnuje którego ucznia (z **Podziel po równo** i "- nikt -") oraz strojenie overflow. Kształt z podręcznika to co najmniej dwóch GMów dzielących uczniów ściśle między siebie, ale moduł działa i z jednym.

**Zamiana Despair w Hope** (1:1) to decyzja GMa z okna Uczniowie albo okna Masterminda, nigdy przycisk samoobsługowy: tak zasila się Monocuba i tak Mastermind utrzymuje się na powierzchni. Hope przychodzi od razu; spadek puli dawcy czeka do następnej pory dnia, kiedy każda pula mogła się ruszyć z tuzina innych powodów, a karta o nim jest prywatna - więc stół nie połączy jednego z drugim (Hope odbiorcy to dane aktora, które ma każda przeglądarka, sekcja 1). Do zmiany pory dnia pula pokazuje więcej, niż może wydać: każdy Call, zamiana i wybór liczy tylko to, co da się wydać, a listy wyboru pokazują, ile pula jest winna ("Kuma (5, 2 do spłaty)": 5 może wydać, 2 jest winna). Despair, który nie mieści się w pełnej puli, najpierw spłaca dług, a dopiero reszta wylewa się do overflow; napełnienie albo wyzerowanie pul kasuje to, co są winne. Każda zamiana jest osobnym długiem, więc gdy dwóch GMów zamienia naraz z jednej puli, liczą się obie zamiany, a pula płaci raz - także gdy przeglądarki jednego z GMów nie było przy spłacie. Zamiana zrobiona na ekranie innego GMa dokładnie w chwili zmiany pory dnia może zostać niespłacona.

**Overflow.** Despair zdobyty ponad pełną pulę kiedyś parował; teraz zbiera się w jednym liczniku wspólnym dla wszystkich Monokum. Feed the Overflow wlewa go celowo. Przy **progu** (domyślnie **20**, edytowalny od 6 do 60; podpowiedź sugeruje 12 plus połowa liczby graczy) licznik płaci próg, zachowuje resztę i losuje **jeden** efekt z tych, które zaznaczyłeś, na jedną porę dnia. Odpala w chwili, gdy licznik dojdzie do progu: karta przychodzi od razu, a efekt obejmuje nadchodzącą porę dnia. Jeśli jakieś zaciemnienie już trwa, licznik czeka do następnej granicy. Jest sprawdzany ponownie, gdy otwiera się Eclipse, i przy każdej zmianie pory dnia, a jedna granica płaci tylko raz. Zapisanie zmienionego progu albo listy efektów ogłasza stołowi nowy próg.

| Efekt | Rodzaj | Co robi |
|---|---|---|
| Darkness | stan | O 1 mniej przejść w Eclipse (minimum 1); Eclipse z dowolnym ustawieniem cofa się do 2 pokoi |
| Shift | stan | O 1 mniej Search Tokenów w każdym pokoju (minimum 1) |
| Panic | stan | O 1 mniej akcji dla każdego, ponad Wounded (minimum 1) |
| Despair | stan | Nie zdobywa się Hope; wydawanie tego, co masz, działa |
| Silence | stan | Żadnych Hope Calls, u nikogo |
| Fog | stan | Brak Free Move; przejścia wciąż kosztują akcje |
| Rot | jednorazowy | Każdy przedmiot z więcej niż jednym punktem wytrzymałości traci 1; nic się nie łamie |
| Earthquake | jednorazowy | Każdy projekt traci 1 postępu |

> [!TIP]
> Odznacz wszystkie osiem, a licznik rośnie i nigdy nie odpala - prawdziwe ustawienie, licznik jako klimat.

**Werdykt Class Trial opróżnia overflow** przy obu wynikach; reset sezonu też. Gracze widzą liczby w pulach i próg overflow, ale "?" zamiast jego licznika ("?/20") - kiedy kapelusz wystrzeli, wie tylko Monokuma. Od 1.2.64 sam licznik trzymają GMowie (sekcja 14), więc konsola nie przeczyta z niego więcej, niż pokazuje ekran; tobie pokazuje go Despair Flow.

---

## 8. Monokuma, Monocuby i Mastermind

**Monokuma** (`scripts/monokuma.mjs`) to aktor typu `character` z flagą, ustawianą w Despair Flow albo przez **Oznacz jako Monokumę** w menu prawego przycisku na liście aktorów. Co flaga zmienia:

- brak ekonomii akcji i brak Hope;
- siatka akcji staje się Despair Calls;
- ruch bez ograniczeń (bez kosztów pokoi, bez ścian, bez limitu Eclipse, bez pieczęci);
- widoczność pokojów nigdy nie ukrywa ich przed nimi samymi;
- ich rzuty są szeptem tylko do GMów i nie karmią żadnej puli;
- nie liczą się jako świadkowie incydentu ani ciała.

Podręcznik każe GMom chodzić po mapie jako dwa rozróżnialne Monokumy; każdy wskazuje pulę jednego GMa i głos per pokój podąża za tym samym przypisaniem.

**Monocub** (`scripts/monocub.mjs`, `MONOCUB`). Gracz zmarłego ucznia może dołączyć do GMów, gdy skończy się jego własny Class Trial - moment wybierasz ty, moduł wymaga tylko, by postać nie żyła. Zaproś go z okna **Uczniowie**. Zachowuje ten sam arkusz i dostaje dokładnie dwie rzeczy: **Move** oraz **Confusion** (**1 akcja + 1 Hope**), płaski rzut 2d12 bez statystyki, który podkręca rzut żyjącego ucznia w tym samym pokoju. Karta celu nigdy nie mówi, kto to zrobił, ale pokój widział, jak Monocub rzuca, i okno Confusion mówi o tym graczowi:

| Confusion | Daje | Nakłada |
|---|---|---|
| 12 | +1 na następny rzut celu | -1 na następny rzut celu |
| 16 | przewagę | utrudnienie |
| Krytyk | oddaje celowi akcję | marnuje akcję |

Hope Monocuba pochodzi tylko z zamiany Despair przez GMa (Fuel a Monocub albo okno Uczniowie). Pole **Uciszony** to zasada z podręcznika dla Monocuba, który natknął się na miejsce zbrodni: może działać, ale nie mówić o zbrodni do końca rozdziału; gracz jest powiadamiany, gdy to ustawiasz i zdejmujesz. Kości Monocuba widzą wszyscy w jego pokoju, także te z Confusion. Tego, w kogo Confusion wymierzono, nie widać: od 1.2.65 Call, który uzbraja, czeka tylko w przeglądarkach GMów i gracza celu, a tylko krytyk, który zmienia akcje celu, widać w danych, które trzyma każda przeglądarka.

**Mastermind** (`scripts/mastermind.mjs`). Wybierany przed sezonem za zgodą gracza, z **Między sesjami > Mastermind**. Tożsamość nigdy nie dotyka aktora ani świata: żyje tylko w przeglądarkach GMów i synchronizuje się między GMami; gracz Masterminda dostaje tylko prywatne "to ty" i pokój swojej kryjówki.

> [!CAUTION]
> Okno wymienia Masterminda, więc nie udostępniaj ekranu, dopóki jest otwarte.

Jego **pokój** (kryjówka) to region: <ins>stojąc w nim</ins> widzi każdy token na mapie, tak jak ty; wyjdzie i to znika. Zamknięte drzwi, pieczęcie, cudze sypialnie i ukryte skrytki stoją przed nim otworem wszędzie, a każdy pokój liczy się jako odwiedzony dla jego mgły - to on zbudował ten budynek. Despair zamienia się w jego Hope **1:1** z tego samego okna, gdy Mastermind zostanie już wybrany i zastosowany. Finał toczy się na zwykłym Class Trial:

| Element | Gdzie | Uwagi |
|---|---|---|
| Jeden **Final Truth Remnant** na rozdział | stawiany z zakładki **Final Truth Remnants** na pulpicie Investigation | wzmocniony przez typ, więc nikt go nie usunie - ekran końca rozdziału przypomina, jeśli żadnego nie postawiono |
| Flaga **Final Trial** | przełączana z konsoli Class Trial | ogłaszana stołowi |
| Werdykt finału | wydawany przyciskiem **Werdykt Final Trial** w oknie Masterminda | trafnie - Mastermind stracony, killing game się kończy; błędnie albo Mastermind już nie żyje - nikt nowy nie ginie, a stół widzi prawdę |

---

## 9. Pokoje, regiony, mgła i odkrywanie, ruch, głos

### 9.1 Pokoje i Ustawienia pokoi

Pokój to **nazwany region sceny**. Ruch, Search, Listen, odpoczynki, głos i każdy incydent są rozstrzygane w ich kategoriach. Sąsiedztwo wynika z geometrii (regiony stykające się krawędzią, z tolerancją około jednej trzeciej pola siatki), chyba że wpiszesz jawną listę we fladze `drpgNeighbours` regionu, po przecinku. Dwa regiony o tej samej nazwie to jeden pokój (korytarz narysowany w dwóch kawałkach).

**Ustawienia pokoi** (Między sesjami) to jedna tabela na rodzaj faktów, a **Zastosuj** zapisuje wszystkie zakładki naraz:

| Zakładka | Kolumny |
|---|---|
| Sypialnie | Czyja jest każda sypialnia (jeden uczeń, jedna sypialnia). Posiadanie sypialni zamyka jej drzwi przed innymi i daje właścicielowi klucz |
| Skrytki | Kto ma skrytkę w którym pokoju i czy jest ukryta. Kliknięcie komórki przełącza: brak / otwarta / ukryta. Sypialnia daje właścicielowi otwartą skrytkę automatycznie; skrytka w cudzym pokoju nie daje do niego klucza. Skrytki, w której coś leży, nie da się usunąć; usunięcie pustej sprawia, że zapomina o niej każdy, kto ją znalazł |
| Drzwi | Które drzwi są teraz zamknięte i które zaczynają sezon zamknięte (reset kopiuje drugą kolumnę na pierwszą) oraz czy region jest oznaczony jako To nie pokój (patrz niżej) |
| Przeszukiwanie | Z której tabeli losuje pokój (albo pula globalna), ile ma Search Tokenów, blokada "nie do przeszukania", oraz kategorie, którym sprzyja (przewaga na Search o nie) i które utrudnia (utrudnienie); nigdy obie naraz |
| Odpoczynki | Czy dozwolony jest Short Rest i Long Rest |
| Opis | Jak wygląda pokój, twoimi słowami; pokazywany na karcie ruchu przy wejściu i za zegarem |
| Mgła | Macierz odkryć - które pokoje każda postać już widziała na tej scenie - z Odkryj wszystko / Ukryj wszystko, procentem sceny nienależącym do żadnego pokoju i kontrolą regionów |

Zakładka **Drzwi** ma też kolumnę **To nie pokój**: zaznacz ją dla korytarzy, klatek schodowych i każdego miejsca, gdzie nikt nie porozmawia na osobności, a region przestaje liczyć się do rady o liczbie pokoi na gracza i nic więcej.

Search Tokens: **3 na pokój na porę dnia** (`ROOMS.searchTokensPerRoom`, edytowalne w ustawieniach), uzupełniane przy każdej zmianie pory dnia, jeden wydawany na Search.

### 9.2 Mgła i odkrywanie

`scripts/fog.mjs`, ustawienie *pokoje decydują, co widzą gracze*. Jedna warstwa nad całą sceną, trzy stany: pokój, w którym stoisz, jest czysty; pokój odwiedzony prześwituje przez zasłonę; wszystko inne, łącznie z fragmentem mapy poza każdym regionem, to pełna mgła. Podczas Eclipse nawet pokój, w którym stoisz, jest tylko za zasłoną. Odkrywanie jest **per postać**, zapisywane przez głównego GMa, gdy token wchodzi do pokoju po raz pierwszy (z dźwiękiem dla ucznia, który wszedł), i przetrwa sesje; pełny zapis zostaje w przeglądarkach GMów (sekcja 14), a przeglądarka każdego gracza trzyma tylko wiersze jego własnych postaci. GM widzi lżejszą mgłę: każdy pokój odkryty przez klasę jest czysty, a pokoje, których nikt jeszcze nie znalazł, razem z każdym miejscem poza pokojami, leżą pod zasłoną. Mastermind widzi każdy pokój jako odwiedzony.

By mgła działała, scena musi mieć wyłączone własne widzenie Foundry:

| Ustawienie | Musi być |
|---|---|
| Token vision | wyłączone |
| Globalne światło | włączone |
| Eksploracja mgły | wyłączona |

**Kontrola przed sezonem** mówi, które sceny z pokojami są gotowe; `game.drpg.prepareScenes()` przygotowuje wszystkie sceny z pokojami naraz i pamięta, co zmieniło, więc `restoreSceneVisionMode` może scenę oddać.

> [!WARNING]
> Scena z pokojami i włączonym widzeniem Foundry renderuje się graczom jako **czarny ekran** na v14 i nie mówi dlaczego - najczęstsze zgłoszenie "jest zepsute".

**Widoczność tokenów** (`scripts/visibility.mjs`, *gracze widzą tylko tych, którzy są w ich pokoju*) jest wymuszana wprost na tokenach, więc drzwi, arkady i mapy bez ścian nie przeciekają. Ujawniony Remnant widzą tylko ci, którzy sami go znaleźli.

### 9.3 Ruch i naliczanie

`scripts/movement.mjs`. Ruch wewnątrz pokoju jest darmowy. Przejście do połączonego pokoju wydaje **Free Move** tej pory dnia, potem **1 akcję** za przejście (najpierw wydaje się zbankowany Sprint). Przejście jest odrzucane przed zapisem, więc token, którego nie stać, wraca na miejsce z czerwoną kartą. Karta ruchu podaje pokój, cenę i opis pokoju, jeśli go napisałeś; przejście uruchamia też strażnika pułapek.

Niektóre odmowy działają niezależnie od ustawienia *przejście między pokojami kosztuje Move*:

- postać w incydencie nie może opuścić pokoju;
- podczas Class Trial nikt nie opuszcza pokoju;
- pokój zapieczętowany przez Behind Closed Doors, gracz z Chained;
- zamknięte drzwi (Ustawienia pokoi > Drzwi);
- cudza sypialnia bez klucza;
- limit przejść Eclipse i zasada połączonych pokoi.

Monokumy przechodzą przez to wszystko. Token zmarłego się nie rusza: ciało zostaje tam, gdzie upadło. Wyłączenie ustawienia oddaje ci *ekonomię* - Free Move i akcję - oraz, poza Eclipse, zasadę połączonych pokoi, do prowadzenia ręcznie.

### 9.4 Głos

`scripts/voice.mjs`, ustawienie *głos per pokój* plus LiveKit AVClient. Każdy zmapowany pokój staje się własnym pokojem breakout LiveKit; gracz słyszy tego, kto jest z nim w pokoju, a jego klient głosowy podąża za tokenem. Monokuma podąża za własnym tokenem, głosem GMa, do którego puli jest przypisany. Podczas Eclipse każdy jest we własnym kanale, a GMowie dzielą jeden. Zmarli, chyba że wrócą jako Monocub, wracają do pokoju głównego - ofiara, której śmierć trzymają GMowie (sekcja 13.4), w chwili zabójstwa, nie odkrycia; to odczytano z kodu, przy stole jeszcze tego nie słyszano. **Przez ten moduł nikt nie podsłucha:** wysyła on klienta głosowego tylko do pokoju, w którym stoi jego token, a LiveKit pokazuje kafelek każdego słuchacza w pokoju, więc GM, który chce słyszeć pokój, wchodzi do niego swoim Monokumą. **Zresetuj wszystkie pokoje głosowe** (Między sesjami) odsyła każdego do pokoju głównego. `game.drpg.voicePlan()` wypisuje, dokąd każdy *zostałby* wysłany, bez mikrofonu i bez nikogo innego połączonego, więc większość testu głosu to minuta jednej osoby; `game.drpg.diagnoseVoice()` mówi, które z pięciu ogniw jest zerwane; uruchom je na kliencie, który się skarży.

> [!WARNING]
> Moduł głosu zbliżeniowego zainstalowany obok potrafi uciszyć stół, gdy każda kontrola raportuje sukces - diagnoza go wymienia.

**Sekret serwera głosu.** Za co ten moduł nie ręczy, to własne ustawienie LiveKit AVClient. Ustawiony na własny serwer, tamten moduł trzyma klucz API i sekret serwera w ustawieniu świata, które dociera do przeglądarki każdego gracza jak każde inne (sekcja 1), a kto je ma, może połączyć się z każdym pokojem głosowym. Ten moduł nie może przenieść ustawienia innego modułu; zamiast tego mówi ci o nim - wierszem listy przygotowań sezonu (sekcja 2), widocznym tylko wtedy, gdy tak jest, i linią `game.drpg.diagnoseVoice()`. Serwer, który sam wydaje tokeny dostępu, taki jak Tavern, trzyma sekret poza każdą przeglądarką. To, co czyta ostrzeżenie - typy serwera, które daje avclient-livekit 0.6.8, i wpisany sekret przy każdym typie poza Tavern - pochodzi z kodu tamtego modułu, nie od stołu.

---

## 10. Przedmioty

`config.mjs ITEM_*`, `scripts/inventory.mjs`, `tables.mjs`, `gm-items.mjs`, `handover.mjs`, `vault.mjs`, `use-items.mjs`.

**Kategorie i limity.**

| Kategoria | Limit |
|---|---|
| Usables (Healing przywraca Health, Sanity Relief przywraca Sanity, rodzaj wynika z tabeli, z której przedmiot został wylosowany) | do **3** |
| Murder Weapons, Cleaning Tools i Tools | razem grupa **gear**: **2 sloty**, i tylko **1** może być schowany - noszenie dwóch znaczy, że jeden jest w ręku |
| Truth Bullets | bez limitu |
| Klucze do pokoi | bez limitu |

Nadanie przez GMa ignoruje limit i oznacza nadmiar.

**Tiery** od 0 do 3 i ich **wytrzymałość** (`ITEM_DURABILITY`):

| Tier | Usables | Broń i narzędzia do sprzątania | Wytrzymałość |
|---|---|---|---|
| 0 | "losowa, pozornie bezużyteczna rzecz, otwarta na kreatywne użycie"; trafia do ciebie do rozstrzygnięcia | bezużyteczne | **1** punkt |
| 1 | przywraca 1 | przeznaczone do czegoś innego, ale się nada | **1** punkt |
| 2 | przywraca 2 | częściowo do tej roboty | **2** punkty |
| 3 | przywraca 2 Health albo 2 Sanity do wyboru gracza plus 2 Hope | stworzone wyłącznie do niej | **3** punkty |

Tier Murder Weapon to obrażenia w incydencie; Tier Cleaning Tool schodzi z DC sprzątania i z Przenieś ciało; **Tool w ręku** daje przewagę na pracę nad projektem i sabotaż i zdejmuje swój Tier z progu (`TOOL_IN_HAND`).

**Wytrzymałość** (ostatnia kolumna powyżej). Rzut, który wypadnie z **Despair** - sukces czy porażka, nigdy krytyk - zdejmuje jeden punkt z przedmiotu trzymanego w ręku, <ins>jeśli rzut go użył</ins>: Tool przy pracy nad projektem albo sabotażu, Cleaning Tool przy sprzątaniu, Murder Weapon przy ciosie. Gdy zejdzie ostatni punkt, przedmiot się psuje. Zepsuty przedmiot zostaje w swoim slocie i jest zepsuty, dokądkolwiek trafi; posiadacz pozbywa się go, chowając go do skrytki albo wyrzucając (rzut Shadow, który zawsze zostawia ślad). Zaciemnienie Rot zużywa wszystko o jeden, ale nigdy nie zabiera ostatniego punktu.

**Tabele przedmiotów** (`scripts/tables.mjs`, Między sesjami > Tabele przedmiotów). Search losuje z tabel losowych: jedna **pula Tier** na kategorię i Tier ("DRPG Murder Weapons - Tier 2", "DRPG Usables (Healing) - Tier 1" itd.), znajdowana po nazwie, plus opcjonalne **pule pokoi**, na które można wskazać pokój w Ustawieniach pokoi. Edytor ma trzy zakładki - Pule Tier, Pule pokoi i Utwórz przedmiot - oraz przycisk **Zainstaluj / przeinstaluj**: jednorazowa instalacja własnych, zwyczajnych, szkolnych list modułu, jako 20 tabel losowych w folderze "Danganronpa RPG"; jeśli już istnieją, wybierasz między **Zachowaj moje** a przebudową. Od Tier 2 wzwyż wpis może mieć jedną dodatkową rolę ("służy też jako"), więc siekiera jest narzędziem, a mop bronią. Zmienione etykiety nie gubią starych tabel.

**Dawanie i zabieranie** (`scripts/gm-items.mjs`): **Uczniowie > Przedmioty**, przycisk u dołu okna Uczniowie. *Daj* ma dwie zakładki - istniejący wpis z tabeli (kategoria i Tier idą za tabelą) albo nowy przedmiot, który wpisujesz. *Zabierz* usuwa wszystko, co moduł śledzi. To samo okno wydaje **Truth Bullets** (z Remnantu na scenie albo napisane od nowa: prawdziwy typ, co gracz słyszy, że to jest, widoczność ustalająca DC analizy, tekst dla gracza i notatka tylko dla GMa) oraz **Autopsy Truth Bullet** uczniom, których zaznaczysz (domyślnie żyjącym).

**Przekazywanie** (`scripts/handover.mjs`): Truth Bullet jest *kopiowany* (oboje mają po jednym), przedmiot jest *przenoszony*, klucz jest kopiowany. Bez akcji, tylko w tym samym pokoju, odmawiane podczas Eclipse; zapis idzie przez klienta GMa, który sprawdza pokój ponownie.

**Sypialnie i klucze.** Sypialnia jest zamknięta dla wszystkich poza właścicielem; właściciel nigdy nie potrzebuje klucza. Każdy inny potrzebuje przedmiotu Klucz, który właściciel może komuś skopiować przez **Daj klucz do pokoju**. Klucz, który zmienia właściciela w inny sposób - wyciągnięty komuś przez Palm, zabrany ze skrytki, zdjęty z ciała - wciąż otwiera swoje drzwi.

> [!WARNING]
> Klucze nazywają swój pokój we fladze, więc zmiana nazwy regionu je osieroca.

**Skrytka** (`scripts/vault.mjs`). Wszystko, czego postać nie nosi, leży w skrytce: domyślnie w sypialni albo w każdym pokoju, w którym Ustawienia pokoi jej ją dają. Skrytka mieści **3** rzeczy (`VAULT_LIMIT`). Chowanie i wyjmowanie nic nie kosztuje, ale trzeba tam stać; Truth Bullets nie da się schować. **Otwarta** skrytka to szuflada: każdy stojący w pokoju może ją przejrzeć za darmo i wziąć jedną rzecz, a właściciel się o tym nie dowiaduje. Udane Search w pokoju, w którym ktoś inny trzyma niepustą skrytkę, bierze z tej skrytki zamiast z tabeli pokoju (najpierw z otwartych; ukryta to kość utrudnienia, jak przed 1.2.65, dokładana, gdy kości już upadną - odkłada jedną z kości przewagi albo dorzuca jeszcze jedną kość kary - a karta szukającego mówi, co zrobiła; okno rzutu tego nie pokazuje, bo otwarcie i zamknięcie Search mówiłoby, że jest tu ukryta skrytka), i tylko Search, który robi to z Despair, zostawia szufladę na tyle naruszoną, że właściciel to zauważy - nigdy kto to zrobił. **Ukrytą** skrytkę (właściciel zbudował schowek - projekt, według twojego uznania; ukrytą robisz ją, przełączając jej komórkę w Ustawieniach pokoi) trzeba najpierw znaleźć przez Analyze > Znajdź ukrytą skrytkę (Head, **16**), co otwiera tę jedną skrytkę tej jednej osobie, dopóki jej nie usuniesz. Mastermind widzi każdą skrytkę. `game.drpg.inspectVaults()` pokazuje ci zawartość każdej.

**Palm** (sekcja 5) to kradzież z kieszeni i podkładanie do kieszeni; oba rozstrzyga klient GMa według `ACTIONS.palm`, a niezgrabnego złodzieja ofiara słyszy.

**Zabieranie z ciała** (`scripts/handover.mjs`). Truth Bullets zmarłego ucznia przepadają; wszystko inne, co nosił, zostaje na arkuszu, a inny uczeń, który go otworzy, może nacisnąć **Weź** przy przedmiocie. Przedmiot przechodzi do zabierającego, który dostaje też Neutral Truth Bullet mówiący, co zabrał i komu, a ciało dostaje jeden Subtle Remnant, powiązany ze zbrodnią, którego notatka wymienia wszystko, co z niego zabrano. Jego karta śladu nazywa akcję "Zabrane z ciała", a token nosi dłoń Palm - dla GMa zawsze, dla gracza dopiero, gdy jego własna kopia zostanie rozpoznana, a przy śladzie ciała, którego nikt nie znalazł, dopiero gdy stół wie o tej śmierci (kopia znaleziona wcześniej do tego czasu nie mówi, co ją zostawiło). To, który ślad należy do ciała i co z niego zabrano, jest zapisem GMów (sekcja 14). Ciało, którego nikt jeszcze nie znalazł (sekcja 13.4), mogą przeszukać tylko ci, którzy wiedzą o śmierci - GMowie, gracze incydentu, gracz samej ofiary i uczeń, który znalazł je sam; jego Truth Bullets są wtedy wciąż na nim i nie da się ich zabrać. Przejście przedmiotu z arkusza na arkusz to dane świata, które ma każda przeglądarka, przed odkryciem tak samo jak po nim. Truth Bullet zabierającego mówi, czyje to było ciało, więc z ciała, którego nikt jeszcze nie znalazł, czeka: trzyma go wasz zapis tej śmierci, a daje go ujawnienie śmierci (sekcja 13.4), z dniem, porą i miejscem, kiedy i gdzie przedmiot zabrano.

---

## 11. Projekty i pułapki

`scripts/projects.mjs`, `projects-ui.mjs`, `traps.mjs`, `config.mjs PROJECT_SCALE`, `TRAP_TRIGGERS`, `TRAP_MODIFIERS`, `INDIRECT_MURDER`.

Projekty to Countdowny z Daggerheart liczące *w górę*. Skale:

| Skala | Postęp |
|---|---|
| Trivial | **3** |
| Standard | **4** |
| Complex | **6** |
| Desperate | **8** |

Każdy projekt ma nazwę, obrazek albo ikonę w zasobniku, skalę, pokój (albo dowolny), wymaganą statystykę (bierze ją każdy rzut na nim, także Sabotage; projekt sprzed 1.2.66 bez niej pyta cię przy pierwszym rzucie i zachowuje twój wybór), widoczność (tajne projekty widzą proponujący i GMowie; udostępnij je wspólnikom - budującego nie da się odsunąć od jego własnego projektu) oraz flagę morderstwa pośredniego. **Projekty** (kafelek panelu) to menedżer: tworzenie, edycja, udostępnianie, dodawanie i odejmowanie postępu, usuwanie. Projekt z pokojem stoi też na mapie jako token na dwa pola z młotkiem i bez nazwy, który możesz przeciągać; gracz widzi go, gdy już stał w jego pokoju, a tajny projekt - gdy zostanie do niego dopuszczony. Podwójne kliknięcie otwiera jego kartę. *Spójrz poza oczywiste* w Observe może odkryć tajny projekt w pokoju szukającego (DC 18), co dopuszcza go do tego projektu.

**Propozycje.** Z arkusza gracz albo pracuje nad projektem dostępnym w jego pokoju, albo **proponuje** nowy. Propozycja przychodzi do ciebie jako karta; zatwierdzasz ją (poprawiając po drodze skalę, pokój albo brzmienie) albo odrzucasz. Nic nie istnieje, dopóki tego nie zrobisz. Postęp rośnie tylko przez *Pracuj nad projektem*: 12 daje +1, 18 daje +2, krytyk +2 i zwrot akcji; Contribution dodaje +1, Patronage +2, Game Integrity odejmuje 2, Earthquake odejmuje 1. Ukończony projekt szepcze do proponującego i GMów - nigdy do stołu, bo projekt może być tajny - a co teraz daje, mówisz ty.

**Morderstwo pośrednie** (`INDIRECT_MURDER`). Pułapkę buduje się z projektów: przygotuj broń (Standard do Complex, 4 do 6 postępu; może wymagać konkretnego pokoju, chyba że narzędzie już zdobyto) i zastaw pułapkę (Trivial do Standard, 3 do 4; zawsze konkretny pokój). Karta radzi około 6 postępu łącznie, cztery do sześciu akcji. Pracując przy innych, zabójca rzuca Shadow przeciw **16**, by ukryć zamiar:

| Ukrywanie zamiaru (Shadow, 16) | Co się dzieje |
|---|---|
| Sukces | nikt nic nie widzi |
| Sukces z Despair | nikt nie widzi, a projekt zyskuje +1 |
| Porażka | inni dostają ogólny opis ("grzebie przy probówkach") |

Praca w samotności daje **+1 postępu**. Zacieranie śladów tej pracy to rzut Shadow:

| Zacieranie śladów (Shadow) | Zostawiony ślad |
|---|---|
| Poniżej 12 | Obvious |
| 12 | Evident |
| 18 | Subtle |
| Krytyk | Hidden |

**Pułapki: moduł pilnuje, GM odpala.** Projekt oznaczony jako morderstwo pośrednie ma wyzwalacz, wybierany przy tworzeniu albo edycji:

- ktoś jest sam w pokoju;
- ktoś wchodzi;
- ktoś przeszukuje pokój (udane Search);
- ktoś tu odpoczywa;
- ktoś używa podłożonego przedmiotu;
- ktoś pracuje nad wskazanym projektem;
- ktoś sabotuje wskazany projekt;
- ktoś szuka tu ukrytej skrytki (trafi czy nie);
- albo "mój własny warunek, sam go dopilnuję".

Dwa modyfikatory: **Tylko po zmroku** (Wieczór, Noc albo dowolny Eclipse) i **Nie ten, kto ją zbudował** (domyślnie włączony). Pułapka uzbraja się, gdy pasek się zapełni. Gdy warunek pasuje, alarm idzie tylko do GMów - nazywa wyzwalacz, osobę, pokój i porę dnia, i niesie wpisany warunek zabójcy - z przyciskami **Właśnie odpaliła** (otwiera ekran morderstwa z wpisanym zabójcą i zaznaczonym *pośrednie*; ofiarę wybierasz ty) i **Nie ten - pilnuj dalej**. Nic nie trafia do wątku zabójcy, a jedyna linia alarmu, którą niesie kopia karty w każdej przeglądarce, jej tytuł, brzmi tylko "Decyzja do podjęcia".

> [!IMPORTANT]
> Pułapka, która przemówiła, rozbraja się, dopóki jej nie uzbroisz ponownie, więc pułapka w holu nie wysyła dwudziestu kart na sesję.

Wyzwalacz podłożonego przedmiotu działa przez **Podłóż przedmiot** na ukończonym projekcie: który obiekt jest pułapką i w którym pokoju czeka; przychodzi jako to, czego szukało następne udane Search w tym pokoju (o ile nie zostało przekierowane do czyjejś skrytki), a zatruta tożsamość żyje w rejestrze twojej przeglądarki, nigdy na przedmiocie.

**Co zostaje w Countdownach Daggerhearta.** Projekt to Countdown Daggerhearta, a Countdowny są ustawieniem świata, które ma każda przeglądarka: nazwa każdego projektu, jego postęp i własność, która mówi, kto może go widzieć. Tajny projekt jest ukryty przed ekranami tych, którzy o nim nie wiedzą, nie przed ich konsolami; ta wersja nie przenosi Countdownów. Własny zapis modułu o każdym projekcie, też dane świata, mówi, jaki ma pokój, czy jest tajny, czy jest morderstwem pośrednim, jaką ma statystykę i ikonę, jaki ma token na mapie i czy jest zsabotowany i naprawiany. Od 1.2.64 reszta należy do GMów (sekcja 14): kto buduje pułapkę, wpisany dla niej warunek, jej wyzwalacz i modyfikatory, czy jest uzbrojona i kiedy ostatnio odpaliła, oraz kto zsabotował projekt. Przeglądarka GMa, która nie ma wiersza pułapki, nie może jej uzbroić ani odpalić, a kontrola zdrowia sprawy mówi, ile takich jest (sekcja 14).

---

## 12. Eclipse

`scripts/eclipse.mjs`, `ECLIPSE_MOVES`, `ECLIPSE_FREE_PLACEMENT`. Eclipse to okno ustawiania między dwiema porami dnia: gasną światła, nikt nikogo nie widzi, każdy przesuwa token tam, gdzie zastanie go następna pora dnia. Nazwany od pory dnia, którą *otwiera* - Eclipse nocny biegnie przed Nocą.

**Rozpoczęcie** (prawa strzałka na HUD albo **Zrób to** przy linii Dalej w panelu GMa): overflow sprawdzany dla nadchodzącej pory dnia; **akcje, Free Moves i zapasy Sprint/Burst są odnawiane tutaj** - to jedyne odnowienie; tutaj kończą się też pieczęcie, Chained i Silence, bo trwają tylko do końca pory dnia; karta ogłasza liczbę przejść; każdy gracz dostaje szeptem swój przydział i pokój; a każdy klient dostaje powiadomienie podsumowujące, co ten gracz zrobił w porze dnia, która właśnie minęła (GM dostaje podsumowanie całego stołu; gdy nic się nie wydarzyło, nie ma powiadomienia). Zwykły Eclipse pozwala na **2 przejścia między połączonymi pokojami**; Eclipse **nocny** pozwala każdemu wybrać dowolny pokój na mapie (losowanie Darkness cofa to do 2). Podczas Eclipse: działa tylko ruch; można zgłosić **Direct Murder** (wydaje akcję z nowego budżetu i czeka); Calle, przekazania, inne akcje, kafelek morderstwa i odkrycie ciała są odrzucane; muzyka przełącza się na playlistę Eclipse; każdy gracz jest we własnym kanale głosowym.

**Zakończenie**: **Zrób to** przy linii Dalej w panelu pokazuje tabelę ustawienia (kto ile razy przeszedł, gdzie stoi) z **Zakończ i przesuń zegar** (zwykła droga: przesuwa zegar, bez drugiego odnowienia) i **Zakończ bez przesuwania zegara**; przycisk odtwarzania na HUD kończy go i od razu przesuwa zegar. Potem zaparkowane Direct Murders są oceniane według tego, gdzie każdy faktycznie stanął: <ins>dokładnie jedna inna postać w pokoju zabójcy</ins> zostaje ofiarą, wszystko inne kończy się niepowodzeniem, a zabójca słyszy dlaczego, i tylko pierwsze ważne zgłoszenie otwiera incydent. Drugi zabójca, którego zgłoszenie też było ważne, słyszy tylko twoją zwykłą odmowę ("GM nie pozwolił. Akcja przepada."), a tobie mówi się, kto to był.

> [!IMPORTANT]
> Nic nie otwiera się bez ciebie: każde zgłoszenie w chwili złożenia wystawia w twoim dzienniku czatu kartę **Pozwól** / **Odmów** - szeptem do GMów, z tytułem tylko "Decyzja do podjęcia", bo karta w wątku zabójcy powiedziałaby każdej przeglądarce, kto coś zgłosił - a o to, którego jeszcze nie rozstrzygnąłeś, jesteś pytany przy zapalonym świetle (zamknięcie tego okna oznacza odmowę); odmowa dociera do zabójcy prywatnie od razu, o zgodzie nie słyszy, a odpowiedź poznaje, gdy zapali się światło. `game.drpg.ruleOnParkedMurder(killerId, true)` to skrót z konsoli, gdyby karta zginęła.

**Co trzyma ciemność** (od 1.2.64). Zgłoszenia należą do GMów (sekcja 14), od chwili złożenia do zapalenia świateł: zgłoszenie poza trwającym Eclipse jest odrzucane. Konsola przeczyta nadal to, że akcja zabójcy została wydana, bo budżet akcji to dane aktora (sekcja 1). Przejścia też liczą GMowie: przeglądarka głównego GMa ocenia każde według limitu i wystawia jego kartę, prywatnie, tylko przechodzącemu - z nazwą pokoju, do którego wszedł, gdy to pokój sceny, na której postać ma token, a inaczej z pokojem, w którym token stoi - a przeglądarka każdego gracza trzyma tylko licznik własnych postaci. To, gdzie kończy każdy token, pozostaje danymi świata (sekcja 1): ciemność jest ekranów, nie Foundry.

---

## 13. Silnik morderstwa od początku do końca

`scripts/murder.mjs`, `cleanup.mjs`, `chapter.mjs`; `config.mjs MURDER_OPENING`, `INCIDENT`, `CRISIS_ACTIONS`, `CLEANUP`, `INDIRECT_MURDER`. Moduł jest właścicielem liczb - progów, drenażu, kolejności tur, obrażeń, tego, jakie Remnants zostawia każdy wynik. Nie jest właścicielem prozy: zdanie każdego wyniku jest pokazywane tobie i uczestnikom do dokończenia przy stole. Czy zabójca jest we właściwym pokoju i czy etap trwał dość długo - to twoje.

### 13.1 Otwarcie

Dwie drogi. Gracz zgłasza **Direct Murder** podczas Eclipse (zgoda gracza ofiary to umowa przy stole, nie pole wyboru); zgłoszenie czeka i jest oceniane przy zapalonym świetle. Albo otwierasz je sam z **Sprawa > Morderstwo**: zabójca, ofiara i pole *pośrednie*, które zaznacza się samo, gdy ten zabójca ma ukończoną pułapkę; otwarte z karty pułapki, okno zaczyna od ucznia, którego pułapka odczytała. Mówi też, gdy wskazanego zabójcy nie ma wśród żywych, i gdy dwoje z Direct Murder stoi w różnych pokojach (otwórz mimo to, jeśli opowieść już ich połączyła). Jeden incydent naraz. Jedno nazwisko w obu polach otwiera śmierć z własnej ręki: Stage 4 wciąż rzuca, Stage 5 nie może biec, a incydent idzie prosto do Stage 6; śmierć zapisuje się, gdy zamkniesz incydent.

**Stage 4, rzut otwarcia.** Direct Murder otwiera się rzutem **zabójcy**: Body albo Hand przeciw **8**, z przewagą nocą. Którą z dwóch, wybierasz ty (sekcja 5): w oknie morderstwa, gdy otwierasz je sam (*Statystyka rzutu otwarcia*), a inaczej w oknie na twoim ekranie, gdy rzut wychodzi. Póki wybierasz, tylko zabójca dostaje prywatnie wiadomość, że wybierasz, i prośbę, by napisał w swoim wątku, jak się do tego zabiera; zaproszenie niesie potem twój wybór, zablokowany, i znika, gdy otwarcie się rozstrzygnie. Wynik rzutu - suma wobec progu i pasmo - trafia na karcie do ciebie i do strony, która rzuca (zabójców; przy pułapce do jej ofiary); liczba Key Remnants i tekst z tabeli trafiają tylko do ciebie. Nieudane otwarcie jest też ogłaszane na ekranie GMa, którego przeglądarka je policzyła.

| Rzut zabójcy | Co się dzieje | Key Remnants, które zostawi sprawa |
|---|---|---|
| Hope | incydent się zaczyna | **5** |
| Despair | zaczyna się; ofiara traci całe Sanity i Role reversal na ten incydent | **4** |
| Krytyk | zaczyna się, zostawiając najmniej Key Remnants | **3** |
| Porażka | brak incydentu; ofiara nigdy nie dowiaduje się, że coś próbowano; akcja wydana | - |

Liczba ma minimum **3** (`KEY_REMNANTS.minimum`). Pułapka otwiera się rzutem **ofiary**: Eye albo Head przeciw **20**, z utrudnieniem nocą, i wybierasz między nimi tak samo; ofiara słyszy tylko, że przygotowuje się dla niej rzut.

| Rzut ofiary | Co się dzieje |
|---|---|
| Hope | coś tu nie gra - może wydać swój Free Move, jeśli jeszcze go ma, by się wydostać, a jeśli to zrobi, żyje (moduł nie daje dodatkowego Move) |
| Despair | rozumie, co zastawiono, i może powiedzieć innym; projekt zostaje aktywny |
| Krytyk | widzi pułapkę i czyje ręce ją zbudowały |
| Porażka | pułapka się zamyka |

Każdy sukces zostawia Evident Incident Remnant, a zauważona pułapka zostawia incydent zawieszony na otwarciu, dopóki nie zamkniesz go z trackera. Pułapka zawsze zostawia sprawie pełne 5 Key Remnants. Ofierze mówi się, że incydent się zaczął, dopiero gdy naprawdę się zaczyna. W Direct Murder jej przeglądarka nie ma z niego niczego, gdy zabójca rzuca - ani obsady, ani karty, ani muzyki morderstwa, ani niczego na panelu zdarzeń; sukces daje jej to wszystko naraz, z szeptem, który nazywa zabójcę (walczy się twarzą w twarz), a porażka nie zostawia jej niczego.

### 13.2 Incydent (Stage 5)

Turowy, ofiara pierwsza; runda to ofiara, a potem po kolei każdy zabójca. Zabójca martwy dla ciebie nie dostaje tury; gdy żaden nie zostaje przy życiu, dostajesz o tym wiadomość i propozycję zamknięcia. **W pułapce działa tylko ofiara**: budowniczy jest gdzie indziej, więc każda tura ofiary oddaje turę jej samej, a runda, drenaż i utrudnienia idą z nią dalej. Za każdym razem, gdy tura wraca do ofiary (pierwsza jest darmowa), kosztuje ją **1** Sanity (bezpośrednio) albo **2** (pośrednio, jest sama z pułapką), potem Health, gdy Sanity się skończy; krytyczne Self-defence zatrzymuje drenaż. Ofiara pułapki ma przewagę na każdym rzucie kryzysowym, a jej Leave a clue i Secure a trace mają Body zamiast Shadow i zostawiają Reinforced Remnants przy Hope tak samo jak przy krytyku (przy krytyku dwa). Uczestnicy rzucają na swoich oczach - przeglądarka głównego GMa pokazuje każdemu z nich kości pozostałych, a karta kryzysu mówi, ile wyszło w każdym rzucie i jaka to była akcja, z Dice So Nice czy bez. Nikt inny nie widzi: budowniczy pułapki nie widzi z niego żadnych kości ani żadnej karty, także karty akcji, która go kończy. Akcje kryzysowe (`CRISIS_ACTIONS`), ze statystyką i progiem (gdzie wiersz podaje kilka statystyk, wybierasz jedną na podstawie tego, co według gracza robi jego postać, jak w sekcji 5 - chyba że gracz uzbroił *Resolve*, które pozwala wybrać jemu):

| Strona | Akcja | Rzut | Co robi |
|---|---|---|---|
| ofiara, zabójca | Use an item | Hand 15 | Wyjmij coś z kieszeni. Działa na krytyku albo sukcesie z Hope; z Despair - ślad i nic więcej; porażka z Despair kosztuje 1 dodatkowo. Nie dla trzeciej osoby |
| ofiara | Leave a clue | Hand/Leg/Shadow 12 | Remnant mający pomóc innym (Evident / Subtle / Obvious). Porażka z Hope daje przewagę przy następnej próbie tej akcji |
| ofiara | Secure a trace | Hand/Leg/Shadow 15 | Zabierz coś zabójcy i zrób z tego ślad związany z jego tożsamością (te same widoczności) |
| ofiara | Self-defence | Hand/Leg/Body 18 | Walcz. Hope otwiera Survive i Role reversal; Despair tylko Role reversal; krytyk zatrzymuje drenaż, otwiera oba i jedno można wziąć w tej turze bez rzutu. Broń daje przewagę. Role reversal otwiera się tylko tam, gdzie jest dostępne; Self-defence, które nie otworzyłoby niczego innego (Despair, gdy Role reversal jest niedostępne), nie zostaje zużyte i można spróbować znowu |
| ofiara | Survive | Leg 18 | Kończy incydent i drenaż. Despair dodaje wskazówkę, kim byli; krytyk dodaje nietykalność na ten i następny rozdział. Wymaga wcześniej Self-defence |
| ofiara | Role reversal | Hand/Leg/Body 15 | Zostań zabójcą. Hope albo krytyk przywraca też całe Health i Sanity; krytyk zabija napastnika od razu. Wymaga wcześniej Self-defence. Niedostępne wobec pułapki ani wtedy, gdy ktoś już dołączył do zabójcy (Partners in crime, Double role reversal) |
| zabójca | Strike | Hand/Leg/Body 15 | 1 Health i 1 Sanity z ofiary; krytyk: 2 do wyboru zabójcy. Porażka z Despair i tak zabiera 1 Sanity i zostawia ślad Evident |
| zabójca | Pin them down | Body 12 | Utrudnienie na Leave a clue i Survive przez dwie najbliższe tury ofiary |
| zabójca | Keep your distance | Leg 12 | Utrudnienie na Secure a trace i Role reversal przez dwie najbliższe tury ofiary |
| zabójca | Attack with a weapon | Body/Hand/Leg 15 | Obrażenia 1 + połowa Tieru broni zaokrąglona w górę (krytyk: 1 + Tier). Bez broni rzut z utrudnieniem, a sukces improwizuje broń (Tier 2 na Hope albo krytyku, 1 na Despair). Obrażenia rzeczy Tier 0 ustalasz ty, od 0 do 2 |
| zabójca | Finishing blow | Body/Leg/Hand | Próg to **5 razy pozostałe Health ofiary** - darmowy przy 0. Kończy incydent; Despair zostawia Incident Remnant; krytyk: pierwsza próba sprzątania zadającego w Stage 6 nie kosztuje Sanity, udana czy nie |
| trzecia | Escape together | Leg 15 | Oboje wychodzą; Hope albo krytyk przywraca ofierze zasoby; krytyk dodaje nietykalność na ten i następny rozdział; porażka: wychodzi tylko trzecia osoba i już nie wraca |
| trzecia | Double role reversal | bez rzutu | Ofiara i trzecia osoba stają się zabójcami; pierwotny zabójca zaczyna krwawić. Nikogo nie leczy |
| trzecia | Partners in crime | bez rzutu | Trzecia osoba dołącza do zabójcy |
| trzecia | Averted eyes | bez rzutu | Odejdź, bez śladu po tobie, i nie wracaj |

**Wejście na to.** W Direct Murder postać, której token wejdzie do pokoju, dostaje automatycznie jeden darmowy wybór spośród rozwiązań trzeciej osoby. **Czwarta osoba anuluje incydent** w miejscu: nikt nie ginie, nie ma Blackened, to, co już się stało, zostaje, a nowo przybyłemu nic się nie mówi. Trzecia osoba, która odeszła - Averted eyes albo nieudane Escape together - zostaje poza incydentem: jej token, wchodząc znowu, nie zajmuje miejsca. Ofiara, której skończą się Health i Sanity, ginie bez Finishing blow, i wtedy nikt nie zyskuje tego, co daje tam krytyk. Akcje rozwiązania (Survive, Role reversal, Escape together, Finishing blow) kosztują **1 Sanity** zamiast akcji, albo **1 Health**, gdy Sanity już nie ma; trzy wybory trzeciej osoby bez rzutu są darmowe. Nic tu nie zabija samo poza własnymi zakończeniami silnika.

> [!IMPORTANT]
> Niektóre wyniki z tabeli powyżej to proza, którą przekazujesz ty, a nie efekty nakładane przez silnik: przywrócenie ofiary po Escape together, nietykalność na ten i następny rozdział, wskazówka z Survive i śmierć napastnika przy krytycznym Role reversal (silnik zamienia strony, przywraca nowego zabójcę i zostawia ślad Evident Reinforced; śmierć zapisujesz ty). Zamiana przywraca nowego zabójcę tylko przy Hope albo krytyku; nikomu innemu Health ani Sanity z nią nie wraca.

**Tracker incydentu** (kafelek Morderstwo, gdy trwa) odświeża się na żywo i pokazuje, kto kogo atakuje (i ewentualną trzecią osobę), etap, turę, czyja strona działa, ile ofierze zostało i liczbę Key Remnants; gdy otwarcie czeka - czyjego rzutu czeka i do kogo poszło zaproszenie; w trakcie walki - trzy ostatnie tury: kto, jaka akcja, jak wyszło; w Stage 6 dokłada listę tylko do odczytu ze śladami w pokoju zabójcy, każdy z jego DC usunięcia. Jego przyciski: **Poproś o rzut otwarcia ponownie** (gdy otwarcie czeka, najwyżej raz na 10 sekund), **Oddaj turę** i **Zamknij morderstwo**. Nie ma ręcznego "ktoś wchodzi": jedyną drogą jest token wchodzący do pokoju. Stage 6 zaczyna się sam - po Finishing blow, gdy ofierze skończą się Health i Sanity, po udanym Survive albo Escape together, albo od razu po śmierci z własnej ręki - albo gdy oznaczysz ofiarę jako zmarłą przez **Postać umiera** i przyjmiesz pytanie, które się wtedy pojawi. Reroll gracza na akcji kryzysowej jest oceniany według zapisu, który trzyma tracker; Reroll akcji, która kogoś zabiła, jest odrzucany, a śmierć zostaje.

Na arkuszu walka to jeden kafelek: **Broń się** po stronie ofiary, **Akcje kryzysowe** po pozostałych, oznaczony jako darmowy i bez znaczka GM; poza swoją turą jest przygaszony i mówi, czyja to tura. Jego menu wymienia akcje strony; wybranie jednej rozwija, ile kosztuje, jakimi statystykami rzuca i kto wybiera, i co robi porażka, a **Rzuć** prowadzi do twojego wyboru statystyki, gdy akcja wymienia kilka, i do okna rzutu; akcja, która nie wymaga rzutu, ma zamiast tego **Zrób to**.

### 13.3 Sprzątanie (Stage 6) i Tamper

Gdy incydent kończy się ciałem, zabójca wreszcie widzi na arkuszu zostawione przez siebie Remnants i może nad nimi pracować. W jego własnym Stage 6 kosztuje to **zero akcji i 1 Sanity za każdy** (`RESOLUTION_STRESS_COST`) - pierwsza próba po jego krytycznym Finishing blow nie kosztuje nic, udana czy nie - a każdy ślad w pokoju, w którym stoi, jest do jego dyspozycji, znaleziony czy nie. Przez kafelek **Tamper** w zwykłej grze (`PRICE_CHAINS.tamper`) kosztuje akcję albo 1 Sanity, gdy akcji już nie ma - nigdy oba - i sięga tylko śladów wymienionych przy Tamper w sekcji 5. W Stage 6 usuwanie, przerabianie i fałszywy trop wymieniają Shadow, Hand i Head, a ty wybierasz jedną na podstawie tego, co według zabójcy robi (sekcja 5; z uzbrojonym *Resolve* wybiera on); przez Tamper w zwykłej grze ta sama praca rzuca Shadow i nikt nie jest pytany. Cleaning Tool w ręku daje przewagę i zdejmuje swój Tier z DC.

| Widoczność śladu | DC usunięcia |
|---|---|
| Hidden | 9 |
| Subtle | 12 |
| Evident | 15 |
| Obvious | 18 |

**Scena jest jeszcze ciepła:** **-3** na każdym DC, dopóki ciało nie zostanie znalezione albo nie ruszy Investigation (`CLEANUP.freshScene`). Wyniki:

| Usuwanie | Ślad |
|---|---|
| Krytyk | znika i wraca 1 (Sanity albo akcja, którą zapłacono), a zabójca dostaje propozycję, by zamiast tego przerobić ślad |
| Hope | znika |
| Despair | znika, ale zostaje Evident Faint Tamper Remnant |
| Porażka z Hope | zostaje, plus Subtle Faint Tamper Remnant |
| Porażka z Despair | zostaje, plus Evident |

Reinforced ślady nigdy nie schodzą.

**Przerób ślad** to też osobna próba, o 3 łatwiejsza niż usunięcie: zabójca pisze nową nazwę (do 60 znaków) i opis (do 400), ślad zawsze staje się Tamper Remnant, a przeróbka trafia do ciebie jako karta do zatwierdzenia albo odrzucenia - nic nie jest zapisywane, dopóki nie zatwierdzisz; krytyk dodatkowo ścisza ślad o jedno pasmo i oddaje to, czym zapłacono (Sanity albo akcję).

Dwie inne akcje Stage 6: **Mylny trop** (**15**) podkłada Prep Remnant wskazujący innego żyjącego ucznia (Evident / Subtle / Obvious; porażka z Hope zostawia Hidden Faint, porażka z Despair nic); **Przenieś ciało** (Body, **16**, o 1 mniej za każdy Tier Cleaning Tool w ręku) niesie je do połączonego pokoju, który zabójca wybiera przed rzutem, nigdy do sypialni; sukces zawsze zostawia ślad Evident Tamper, porażka zostawia ciało tam, gdzie było.

Gdy w pokoju jest ktokolwiek poza współzabójcą, usuwanie, przerabianie i podkładanie tropu najpierw rzucają Shadow przeciw **16**, by ukryć, co się robi (przenoszenie ciała nie):

| Ukrywanie (Shadow, 16) | Koszt |
|---|---|
| Sukces | darmowy |
| Sukces z Despair | 1 Sanity |
| Porażka z Hope | 1 Sanity |
| Porażka z Despair | 2 Sanity |

Porażka pozwala innym zobaczyć mniej więcej, co się dzieje.

**Co się psuje.** Psuje coś tylko incydent, który doszedł do Stage 6. Przy jego zamknięciu każde Murder Weapon, którym zabójca zamachnął się w walce, zostaje oznaczone jako zepsute - każdego zabójcy, wspólnika też; Finishing blow nie jest zamachem, więc broń tylko trzymana w ręku, gdy cios padał, zostaje cała, a nieudane otwarcie, pułapka czy wczesne zamknięcie nie psują żadnej. Gdy ciało zostanie znalezione, każde Cleaning Tool, które zabójca miał na sobie przy próbie sprzątania, zostaje oznaczone jako zepsute - w ręku czy odłożone od tamtej pory, byle wciąż noszone i nie schowane w skrytce (moduł trzyma ich spis w przeglądarkach GMów do tej chwili); zabójca, który nie sprzątał, traci zamiast tego Cleaning Tool, które ma w tej chwili w ręku. Tylko zabójcy znalezionych ciał: Cleaning Tool zdrajcy zostaje całe, dopóki nikt nie znajdzie jego ofiary. Jedno i drugie zostaje w torbie jako dowód, który zabójca musi wyrzucić albo schować do skrytki. Właściciel dostaje wiadomość tylko o przedmiocie, który naprawdę się zepsuł.

**Okno zdrady.** Gdy incydent zostawił ciało, jego trzecia osoba może obrócić się przeciw zabójcy: wspólnik - trzecia osoba, która stanęła po stronie zabójcy - albo, w Direct Murder, trzecia osoba, która weszła, została i niczego nie wybrała. Nigdy ktoś, kto odszedł (Averted eyes) albo próbował Escape together, i nigdy, w pułapce, trzecia osoba po stronie ofiary. Oferta trwa do końca tego dnia, z Investigation włącznie, przeżywa zamknięcie incydentu, jest jednorazowa i nie można z niej skorzystać, gdy trwa inna walka, ani podczas Class Trial. Podjęta w Eclipse jest zgłaszana jak każda akcja w nim: kosztuje akcję i otwiera się, gdy Eclipse się skończy - po nocnym Eclipse następnego ranka - a drugie zgłoszenie w tym samym Eclipse jest odrzucane. Zdrada, która nie może się otworzyć, gdy przyjdzie jej czas, jest odrzucana z podaniem powodu, a oferta wraca, póki trwa jej dzień. Otwiera drugi incydent z ciałem wciąż na podłodze. Twój ekran po incydencie (13.4) też ma ten przycisk, poza Class Trial. Spośród graczy ofertę trzyma w przeglądarce tylko ten, komu ją złożono.

### 13.4 Po incydencie i odkrycie ciała

Zamknięcie morderstwa mówi każdemu z jego graczy, że się skończyło, kartą, która nikogo nie nazywa - żywej ofierze, że znowu może działać; ofiara Direct Murder w trakcie rzutu otwarcia i budowniczy pułapki przed Stage 6 nie dostają nic. Tylko incydent, który zostawił ciało, zapisuje **Blackened** (każdego zabójcę rozdziału, ze zdrajcą włącznie); taki, który doszedł do Stage 6, psuje broń, którą się zamachnięto (13.3). Z ciałem otwiera ekran po incydencie, "Incydent zakończony - co teraz": **Znaleziono ciało** (ogłoś), **Przejdź do Investigation**, **Wydaj Autopsy Truth Bullet**, zdrada, jeśli jest w ofercie. Przypomina też, ile Key Remnants trzeba jeszcze postawić, i o wydaniu sekcji. Bez ciała nikt nie zostaje Blackened: po Escape together dostajesz ekran ucieczki, po innym przeżyciu krótki ekran, który to mówi, z przyciskiem do Remnants, a incydent zamknięty przed Stage 6 mówi, że został przerwany i nikt nie zginął.

**Odkrycie ciała** dzieje się samo, gdy w pokoju z ciałem z tego rozdziału stoi co najmniej dwóch uczniów, w tym co najmniej jeden <ins>niezwiązany z zabójstwem</ins> - ani zapisany Blackened, ani zabójca trwającego incydentu, który wciąż sprząta w Stage 6 (zabójcy nad własną ofiarą to wrabianie, nie odkrycie; Monokumy i zmarli z tego rozdziału nie są świadkami, Monocub jest), nigdy podczas Eclipse - albo przyciskiem **Znaleziono ciało**. Najpierw pyta cię, które Faint ślady Prep należą do tego morderstwa (stają się trwałymi dowodami), oznacza jako zepsute Cleaning Tools, które zabójcy mieli na sobie przy próbach sprzątania (13.3), zwołuje wszystkich do pokoju, ogłasza ciało stołowi z dźwiękiem, wstrzymuje muzykę i potem **czeka**.

> [!IMPORTANT]
> Faza zostaje Daily Life, dopóki nie rozpoczniesz Investigation z linii Dalej albo z ekranu po incydencie. Zmiana pory dnia kończy tylko ciszę.

**Śmierć trzymana do znalezienia ciała** (od 1.2.64). Gdy ginie ofiara trwającego incydentu - od Finishing blow, gdy skończą się jej Health i Sanity, przy śmierci z własnej ręki w chwili zamknięcia, albo przez **Postać umiera** z zaznaczonym *Zachowaj to dla GM-ów, dopóki ciało nie zostanie znalezione*, jak jest domyślnie dla tej ofiary - śmierć trafia do magazynu GMów i do stołu nic nie dociera: bez flagi deceased, bez znacznika śmierci, a Truth Bullets zostają na arkuszu. Karta śmierci idzie prywatnie do GMów i graczy incydentu, a jej dźwięk tylko do nich. Kto o niej wie: GMowie, gracze incydentu (łącznie z zabójcą z pułapki), gracz samej ofiary, a później samotny znalazca; przeglądarka każdego z nich trzyma śmierci, o których może wiedzieć, i żadnych innych. Każda inna śmierć - egzekucja, decyzja, okno z odznaczonym polem - od razu należy do stołu, jak dotąd.

Ujawniają ją dwie rzeczy i tylko dwie: odkrycie ciała, którego pierwszy krok ujawnia każdą trzymaną śmierć ciała w tym pokoju - na scenie, na której uczniowie na nie weszli, na którąkolwiek scenę patrzysz, a ogłoszone z formularza - na scenie, na którą patrzysz - i twoja ręka - uczeń ustawiony na *Nie żyje* w oknie Uczniowie, gdzie stoi jako **Martwy, nieodnaleziony** (sekcja 3). Wtedy Truth Bullets znikają (chyba że zachowane), flaga zostaje zapisana z rozdziałem, dniem i porą dnia zabójstwa, nie odkrycia, pojawia się znacznik, a ten, kto w międzyczasie coś z ciała zabrał, dostaje Truth Bullet tej rzeczy (sekcja 10). Nic innego jej nie ujawnia: początek Class Trial tylko mówi ci, w komunikacie, który zostaje na ekranie, ile jest śmierci, których nikt nie znalazł; koniec rozdziału nic o nich nie mówi. Dopóki jej nie ujawnisz, stół i rozprawa traktują tego ucznia jak żywego: jego gracz dostaje kartę do głosowania, jego imię stoi na niej bez oznaczenia śmierci, a Level Up za trafny werdykt dostaje i on. Zamknięcie morderstwa nadal zapisuje zabójcę w rejestrze Blackened, ale rozprawa liczy zabójcę tylko za śmierć znaną stołowi: karta nie pyta o nazwisko za śmierć, której nikt nie znalazł, a werdykt ani nie skazuje za nią jej zabójcy na stracenie, ani go za nią nie nagradza (zmierzone przez tier 2 zestawu testów w harnessie bez przeglądarki, jeszcze niesprawdzone przy stole). To samo dotyczy śmierci, którą cofniesz: ofiara, którą przywrócisz do życia, zostawia swojego zabójcę niepoliczonym. Ujawnij ją przed otwarciem głosowania, jeśli rozprawa ma pytać o jej zabójcę. Trzymana śmierć z wcześniejszego rozdziału nigdy nie zostanie znaleziona sama, bo odkrycie szuka tylko ciał z tego rozdziału: ujawnij ją ręcznie. Status *dead* przełączony ręcznie na tokenie nie jest żadną z nich: moduł czyta swój zapis, nigdy ikony statusu tokenu, więc dla modułu ten uczeń wciąż żyje - pułapka, którą zastawił, nadal czuwa, a on wszędzie liczy się wśród żywych. Śmierć zapisuje się w oknie Uczniowie (sekcja 3).

Przed odkryciem własny arkusz ofiary pokazuje panel śmierci z "Nikt jeszcze nie znalazł twojego ciała."; to, czego próbuje jej gracz, jest odrzucane tak jak u zmarłych. Odmowa, którą tłumaczy tylko nieodnalezione ciało - przekazanie jej przedmiotu, uzbrojenie na niej Calla - trafia do pytającego jako "Teraz nie da się tego zrobić.", a powód idzie do twojego Debug logu. Call jest tak odrzucany dopiero po każdym sprawdzeniu, które przechodzi Call na żywym uczniu, w tym Hope kupującego. Zgromadzenie zostawia ciało tam, gdzie leży. Stół może nadal przeczytać dane aktora (sekcja 1): Health ofiary na 0.

**Samotny znalazca.** Jeden uczeń niezwiązany z tym zabójstwem - także zabójca z innego incydentu tego rozdziału - który stanie sam w pokoju z ciałem, którego nikt nie znalazł, dowiaduje się o tym prywatnie, bez karty czatu: "W {room} znajdujesz ciało: {name}. Nikt inny jeszcze go nie widział i nic nie zostaje ogłoszone." Od tej chwili wie o tej śmierci: tylko jego ekran rysuje znacznik śmierci na ciele, a on może zabierać z ciała (sekcja 10). Na co Tamper pozwala każdemu, na to pozwala i jemu; przeniesienie ciała zostaje sprawą zabójcy. Nikt inny się nie dowiaduje, a jeden świadek to nie odkrycie: zasada dwóch zostaje. Znacznik znalazcy rysuje moduł na tym jednym ekranie; harness bez przeglądarki nie ma canvasu, więc przy stole jeszcze tego nie widziano.

---

## 14. Investigation

`scripts/remnants.mjs`, `investigation.mjs`, `truth-bullets.mjs`, `observe.mjs`, `analyze.mjs`; `config.mjs REMNANT_TYPES`, `KEY_REMNANTS`, `OBSERVE_DC`, `ANALYZE_DC`.

**Remnants** to ukryte tokeny na mapie, kładzione tam, gdzie stała postać, gdy akcja go zostawiła, z typem, widocznością (Obvious, Evident, Subtle, Hidden), kto go zostawił, pokojem, rozdziałem, dniem i porą dnia, oraz tym, czy jest Reinforced (nie do sprzątnięcia) i czy jest powiązany ze zbrodnią. Typy:

| Typ | Czym jest |
|---|---|
| **Key** | twoje, nieusuwalne, staje się Truth Bulletem bez analizy |
| **Neutral** | nieokreślony; Analyze zamienia go w prawdziwą kategorię |
| **Faint** | wątpliwy; czyszczony na końcu rozdziału, chyba że powiązany z morderstwem |
| **Prep** | - |
| **Incident** | - |
| **Tamper** | zostawiony przez sprzątanie |
| **Autopsy** | wydawany, nigdy nie znajdowany przez Observe |
| **Final Truth** | jeden na rozdział, wskazuje Masterminda, Reinforced |

Typy Truth Bullets są ich lustrem. Każdy Remnant to token z jedną neutralną nazwą i obrazkiem "?", znaleziony czy nie: od 1.2.64 nazwa i obrazek, które mu nadajesz, nigdy nie są zapisywane na tokenie, który ma każda przeglądarka. Ekrany, którym wolno wiedzieć więcej, rysują to na własnej kopii mapy - twój z danych sprawy, ekran znalazcy z jego własnego Truth Bulletu, jego nazwę i obrazek (rysuje to moduł na każdym ekranie; harness bez przeglądarki nie ma canvasu, więc przy stole jeszcze tego nie widziano). GM widzi ikonę akcji, która go zostawiła (Search, projekt, sabotaż, akcja dynamiczna, sprzątanie, incydent, wyrzucenie, postawienie przez GMa, zabranie z ciała), gracz dopiero, gdy jego własna kopia zostanie rozpoznana - a ikonę śladu zabrania z ciała, którego nikt nie znalazł, dopiero gdy stół wie o tej śmierci - a podwójne kliknięcie Remnantu otwiera jego kartę śladu. Ślady incydentu są pokazywane jego graczom w chwili powstania; gdy incydent się zamyka, te, których nikt nie skopiował, znów są ukrywane, więc gracze późniejszego incydentu nie widzą starego miejsca zbrodni. Świat zaktualizowany do 1.2.64 robi to samo raz, przy pierwszym wczytaniu, dla incydentów zamkniętych wcześniej; incydent, który wtedy trwa, zachowuje swoje.

**Pulpit Investigation** (Sprawa > Investigation) to żywa teczka sprawy:

| Zakładka | Co robi |
|---|---|
| **Ślady** | wymienia każdy Remnant z filtrami (po graczu, pokoju i rozdziale), pozwala edytować nazwę, tekst dla gracza i tekst analizy, poprawić typ i oznaczyć go jako Faint, powiązany ze zbrodnią albo Reinforced |
| **Key Remnants** | planer |
| **Final Truth Remnants** | stawia Final Truth Remnants |
| **Kto co ma** | pokazuje Truth Bullets każdego ucznia, ile jeszcze nie przeanalizowano i czym są naprawdę |

Stopka ma **Nowy ślad** (ślad dowolnego rodzaju, w dowolnym pokoju), **Wyczyść Faint Remnants**, **Zbierz Truth Bullets**, sekcję, dziennik dowodów Class Trial i ciało.

**Key Remnants** (`KEY_REMNANTS`). Przygotowujesz **5** tropów na rozdział, w skali Trivial, Standard, Standard, Complex, Desperate; rzut otwarcia decyduje, ile sprawa zachowa (5, 4 albo 3; pułapka zachowuje wszystkie 5), nigdy poniżej **3**. Razem mają zawęzić podejrzanych do **2 do 4** osób - ostatni krok od kręgu do nazwiska należy do Class Trial. Każdy wiersz planera ma nazwę i tekst dla gracza (co dostaje znalazca), tekst analizy (co ujawnia Analyze), twoją prywatną notatkę, pokój i widoczność; **Utwórz na mapie** stawia go w losowym miejscu wewnątrz pokoju jako Reinforced i powiązany ze zbrodnią. Plan należy do GMów (sekcja 14) i jest trzymany rozdział po rozdziale: każdy rozdział ma swoich pięć wierszy, a nowy rozdział otwiera się z pustym planem. Karta z prośbą gracza ("patrzę na okno") ma **Utwórz tu Key Remnant**, który może wypełnić jeden z pięciu wierszy.

> [!WARNING]
> Na starcie Class Trial moduł nalicza opłatę za nieudane śledztwo: każdy Key Remnant brakujący do **4 znalezionych** jest wart **3 Despair do puli każdego Monokumy** (`unfoundBar`, `unfoundDespair`) - całkiem nieudane śledztwo to **+12** do każdej puli. Naliczane raz na rozdział i tylko dopóki plan jest jeszcze planem tego rozdziału.

**Observe.** Gracz deklaruje, jak patrzy:

| Tryb | Czego szuka |
|---|---|
| **Rozejrzyj się za czymkolwiek** | najłatwiejszy ślad tutaj |
| **Spójrz poza oczywiste** | najtrudniejszy, a także tajny projekt w pokoju przy DC **18** |
| **Podążaj za własnymi śladami** | najpierw jego własne |
| **Skup wzrok** | nazywa, czego chce, a karta pyta cię, na który ślad wskazują te słowa |
| **Zbadaj punkt zainteresowania** | coś, co nie jest śladem, do twojego rozstrzygnięcia |

Przy obu ostatnich rzut pada, zanim je zobaczysz: odmowa wyboru przy Skup wzrok, Zbadaj punkt zainteresowania albo Observe w pokoju, w którym nie zostały żadne ślady, staje się kartą decyzji na tym rzucie z **Utwórz tu Key Remnant**, **Odpowiedz** i **Nic tam nie było**, co liczy się jak pudło. Rzut jest oceniany na twoim kliencie według prawdziwego typu i widoczności śladu; gracz słyszy wynik, nigdy to, jakie DC obowiązywało. Trafienie kopiuje Remnant do ekwipunku jako Neutral Truth Bullet i zostawia oryginał; pudło kosztuje **1 Sanity**. Jeden ślad daje jedną kopię na osobę. Ślady związane z morderstwem są pokazywane w pierwszej kolejności. Gdy ktoś po raz pierwszy skopiuje ślad, twoja przeglądarka prosi cię o jego opis (nazwa, tekst dla gracza, tekst analizy, wstępnie wypełnione); każdy, kto skopiuje go później, dostaje te same słowa, a krytyk pyta cię ponownie tylko o większą wskazówkę.

| Widoczność | Daily Life | Key | Faint | Prep / Incident / Tamper |
|---|---|---|---|---|
| Obvious | 8 | 6 | 12 | 9 |
| Evident | 12 | 9 | 15 | 12 |
| Subtle | 18 | 12 | 18 | 15 |
| Hidden | 21 | 15 | 21 | 18 |

(DC Observe, `OBSERVE_DC`. Neutral wyceniany jak Prep; Final jak Key.)

**Analyze.** Head przeciw prawdziwemu typowi bulleta i pierwotnej widoczności. Key i Final Truth Bullets pokazują swój rodzaj w chwili podniesienia, ale ich tekst analizy wciąż czeka na Analyze w najłatwiejszej kolumnie (6 / 9 / 12 / 15); tylko Autopsy Truth Bullet przychodzi w pełni odczytany. Sukces ujawnia prawdziwy typ (i czy jest powiązany ze zbrodnią); porażka blokuje ten bullet dla tego gracza do końca rozdziału - kopia przekazana komuś innemu to inny przedmiot i blokady nie niesie. Ten sam kafelek zawsze oferuje prośbę o wskazówkę do ciebie (**14** subtelna, **18** bezpośrednia, krytyk: jedno pytanie do wyboru gracza) i poszukiwanie ukrytej skrytki (**16**); gdy nie ma już bulleta do analizy, zostają tylko te dwie. Każde użycie Analyze wymaga GMa online i bez niego jest odrzucane, zanim cokolwiek zostanie opłacone.

| Widoczność | Daily Life | Faint | Prep / Incident / Tamper |
|---|---|---|---|
| Obvious | 8 | 8 | 12 |
| Evident | 12 | 12 | 15 |
| Subtle | 18 | 15 | 18 |
| Hidden | 21 | 18 | 21 |

(DC Analyze, `ANALYZE_DC`. Key i Final Truth Bullets oraz Autopsy wydany jako Neutral czyta się w kolumnie Key: 6 / 9 / 12 / 15. W Class Trial Analyze kosztuje akcję, albo 1 Hope, gdy akcji nie ma, albo 1 Sanity, gdy nie ma ani jednego, ani drugiego.)

> [!IMPORTANT]
> **Krytyczne** Observe albo Analyze jest ci winne solidną wskazówkę dla gracza - karta mówi to na czerwono.

**Sekcję** wydajesz z pulpitu albo z ekranu po incydencie zaznaczonym uczniom: nazwa, co gracz czyta, twoja notatka. Klucz odpowiedzi za każdym bulletem żyje tylko w przeglądarkach GMów, razem z resztą sprawy.

**Co żyje tylko w przeglądarkach GMów** (od 1.2.63): klucz odpowiedzi każdego Truth Bulletu; prawdziwy typ i odczyt każdego śladu; kto jest Mastermindem i gdzie jest jego kryjówka; obsada trwającego incydentu i Blackened każdego rozdziału; który podłożony przedmiot należy do której pułapki i co czeka w którym pokoju; oferowane Level Upy; które pokoje odkryła każda postać. Od 1.2.64 także: kto buduje każdą pułapkę, jej warunek i wyzwalacz, oraz kto zsabotował projekt (sekcja 11); Direct Murders zgłoszone w ciemności i to, kto ile razy przeszedł w Eclipse (sekcja 12); plan Key Remnants, rozdział po rozdziale; notatki graczy przed sesją (sekcja 19); to, jak doszło do incydentu - pułapka, śmierć z własnej ręki ofiary, jak się skończył; śmierci, których nikt jeszcze nie znalazł (sekcja 13.4); Reinforced Level Upy czekające na klasę (sekcja 15); licznik overflow i Despair, który każda pula jest winna za zamiany w Hope (sekcja 7); to, co zabrano z każdego ciała, i jego ślad (sekcja 10); oraz to, z którego śladu pochodzi każdy Truth Bullet. Od 1.2.65 także: Confusion uzbrojone na postaci, a jeszcze nierzucone (sekcja 8). Od 1.2.66 także: stan walki trwającego incydentu - runda, czyja strona działa, co jest utrudnione, zablokowane albo zużyte (sekcja 13.2); świat trzyma tylko to, że incydent trwa, i na jakim jest etapie; statystyka, którą wybrałeś do jego otwarcia, darmowa próba sprzątania z krytycznego Finishing blow (mają ją też przeglądarki zabójców, więc uderzający widzi ją jako darmową), trzy ostatnie tury z trackera i to, kto wszedł do walki i z niej wyszedł; zdrada zgłoszona w Eclipse; oraz to, które Cleaning Tools zabójcy mieli na sobie przy próbach sprzątania, dopóki ciało nie zostanie znalezione (sekcja 13.3). Nic z tego nie jest danymi świata, więc konsola gracza tego nie przeczyta. Przeglądarka każdego GMa trzyma kopię dla każdego świata, a przeglądarki GMów wymieniają się kopiami, gdy któryś dołącza, pole po polu: wygrywa nowsza decyzja, usunięcie też, więc GM, który dołącza z pustą przeglądarką, niczego nie traci i niczego nie zabiera. Przeglądarka gracza trzyma to, co wolno mu wiedzieć: czy sam jest Mastermindem, a jeśli tak - gdzie jest kryjówka; w incydencie, w którym bierze udział, jego obsadę - każde imię oprócz budowniczego pułapki po stronie ofiary; ofertę zdrady tylko w przeglądarce trzeciej osoby, której jest oferowana, i która trzyma ją, a z późniejszego incydentu, który nie jest jej, nic, do końca dnia; nigdy zapisu, z którego Reroll akcji kryzysowej ją cofa, a który czyta tylko GM; Level Upy oferowane jego własnym postaciom; i pokoje odkryte przez jego własne postacie. Od 1.2.64 także to, ile razy jego własne postacie przeszły w trwającym Eclipse, jego własną notatkę przed sesją, śmierci, o których wie, i to, z którego śladu pochodzi każdy z jego własnych Truth Bullets; obsada incydentu obejmuje to, jak do niego doszło. Od 1.2.65 także Confusion uzbrojone na jego własnej postaci. Od 1.2.66 obsada incydentu obejmuje jego walkę - rundę, czyja strona działa, co jest utrudnione, zablokowane albo zużyte - u tych, którzy w niej walczyli: nigdy liczby Key Remnants, statystyki otwarcia, darmowej próby sprzątania (poza zabójcami), ostatnich tur ani tego, kto wszedł do walki i z niej wyszedł, które zostają u GMów, i nie u budowniczego pułapki, który wraca na Stage 6 bez niej. Deklaracje Observe czekające na rzut zostają tylko w przeglądarce głównego GMa, a zakładka Rerolla - ostatni rzut i to, co zrobił - w przeglądarce, która rzucała, bez kopii u nikogo innego i bez kopii zapasowej.

**Kopia sprawy** (panel GMa, Między sesjami) zapisuje to wszystko do jednego pliku; trzymaj go tam, gdzie żaden gracz go nie otworzy. **Przywróć sprawę** scala plik z powrotem: bierze tylko to, co nowsze - także nowsze usunięcie, a jej okno liczy, co by usunęła - więc może to zrobić każdy GM, a dwa przywrócenia to jedno. Nigdy nie bierze z pliku resetu sezonu: wiersze sprzed resetu zostają pominięte, chyba że zaznaczysz pole, które je bierze. Plik innego świata jest brany tylko po zaznaczeniu i nie przynosi wtedy żadnych usunięć, a jego Mastermind i obsada incydentu - tylko jeśli zaznaczysz także je. Po przywróceniu każdy podłączony gracz dostaje ponownie swoją część. Gdy przeglądarka głównego GMa otwiera świat z mniejszą wiedzą, niż świat mówi, że powinna mieć - nowa przeglądarka, wyczyszczone dane strony - kontrola zdrowia nazywa, czego brakuje, i proponuje **Przywróć z pliku**, **Wpisz obsadę ręcznie** przy trwającym incydencie albo **Przenieś je do rejestru** dla śladów sprzed rejestru, których klucz odpowiedzi wciąż jest na żetonie. Od 1.2.64 liczy też morderstwo pośrednie, którego zabójcy, warunku i wyzwalacza ta przeglądarka nie ma (jego pułapka nie może się uzbroić ani odpalić), notatkę przed sesją oznaczoną jako napisana, której ta przeglądarka nie ma, i Masterminda ustawionego w Despair Flow na "- nikt -" (sekcja 2) - oraz ślad, którego żeton wciąż ma flagi klucza odpowiedzi: aktualizacja do 1.2.64 zostawia na żetonie, do twojej decyzji, awans Faint Prep, przeciw któremu stanęła późniejsza poprawka, i flagi bez wiersza w rejestrze, do którego by je przeniosła, i mówi o tym na ekranie, gdy tak się stanie. Z konsoli raportują o tym `game.drpg.gmStoreStatus()` i `gmStoreHealth()`; `exportLedger()` i `importLedger()` to kopia i przywrócenie.

---

## 15. Class Trial

`scripts/trial-floor.mjs`, `trial-floor-ui.mjs`, `trial.mjs`, `vote.mjs`; `config.mjs TRIAL`. Jedne drzwi: **Sprawa > Class Trial**, konsola czytająca rozprawę od góry do dołu i nigdy nie chowająca sekcji.

1. **Zacznij Class Trial.** Przesuwa fazę, rozdaje akcje pory dnia (zbankowane Sprint i Burst zostają; późniejsze debaty rozprawy niczego nie odnawiają), zeruje zapis rozprawy tego rozdziału, nalicza nieznalezione Key Remnants, ogłasza i mówi ci, ile jest śmierci, których nikt nie znalazł, żadnej nie ujawniając (sekcja 13.4). Class Trial otwiera się **dyskusją**: mówią wszyscy, dowody trafiają na stół bez przejmowania głosu. Dopóki trwa rozprawa, otwarty zostaje tylko kafelek Analyze (z Przedstaw, Hope Calls i przedmiotami), nikt nie przechodzi między pokojami, a Despair Calls i Confusion Monocuba są zablokowane; Analyze albo Objection kosztuje akcję, potem 1 Hope, potem 1 Sanity.
2. **Otwórz debatę** z budżetem w sekundach (domyślnie **180**, zapamiętywany w obrębie rozprawy). Przekroczenie zmienia zegar debaty (na karcie Class Trial w panelu zdarzeń) na czerwony i niczego nie kończy; kiedy spór się skończył, decydujesz ty. Od tej chwili przedstawienie Truth Bulleta to **OBJECTION**: objektor sam ma głos przez **60 sekund**, potem osoba, w którą wymierzono objection, odpowiada w **rebuttal** przez **120 sekund** dla tej dwójki, po czym głos sam wraca do otwartej dyskusji - zegar debaty nie rusza od nowa; otwórz kolejną debatę, gdy sala jej potrzebuje. Cisza jest społeczna, nie techniczna: moduł nikogo nie wycisza, tylko czyni stan jednoznacznym na każdym ekranie i odmawia przycisku Objection każdemu, dla kogo nie jest. Ręczne nadpisania: **+30 sekund** (liczone od teraz, jeśli zegar już się skończył), **Zakończ ten tryb teraz**, **Z powrotem do debaty**. **Zamknij debatę** wraca do dyskusji przy trwającej rozprawie. `game.drpg.objectionLog()` wymienia wszystko przedstawione w tym rozdziale.
3. **Głosowanie.** Karty idą do graczy każdego żyjącego ucznia (zmarli nie głosują, `deadCastBallots: false`); karta pozwala wskazać siebie, Monokumę albo zmarłych. Liczba wymaganych nazwisk to liczba Blackened zapisanych w tym rozdziale za śmierć znaną stołowi (sekcja 13.4). Karty nigdy nie dotykają danych świata: idą do GMów, są liczone w pamięci i publikowane są tylko sumy. Konsola pokazuje, kto jeszcze nie głosował; **Wyślij kartę ponownie** wysyła im świeżą kartę; **Zacznij głosowanie od nowa** wyrzuca oddane karty i najpierw ostrzega. **Zamknij i policz** publikuje wynik. Skazanie wymaga **więcej niż połowy rozesłanych kart** (połowa zaokrąglona w dół plus jeden); poniżej tego, albo gdy nad kreską remisuje więcej nazwisk, niż jest Blackened, wynik jest remisem, a remis liczy się jak błędny głos, chyba że stół to rozstrzygnie.
4. **Werdykt.** Okno mówi, kogo rejestr zapisał jako Blackened (bez zabójcy, którego ofiar nikt jeszcze nie znalazł, sekcja 13.4), pyta, kto zostaje stracony, jeśli klasa się pomyliła, i czy trafili. Trafnie: Blackened straceni, a każdy ocalały dostaje **Standard Level Up** (1 wybór). Błędnie: oskarżony stracony, każdy żyjący Blackened zostaje anonimowy i w grze z **Reinforced Level Up** (3 wybory) i jedną **nową zasadą** własnego wyboru (ty ją wpisujesz; ogłaszana bez nazwiska), a pula każdego Monokumy jest **napełniana do 12**. Od 1.2.64 ten Reinforced Level Up czeka na klasę, w magazynie GMów: jego właściciel dowiaduje się o tym prywatnie, a wybiera go razem z Level Upami klasy przy następnym werdykcie, który trafnie wskaże Blackened - jedno okno z 1 + 3 wyborami, zapisane naraz - albo sam, przy werdykcie Final Trial, więc żadna przeglądarka nie widzi, jak maksima Blackened rosną w dniu błędnego głosowania. Przepada, jeśli wcześniej zginie, a reset sezonu, który czyści Level Upy, go usuwa. Oba werdykty opróżniają overflow. Okna Level Up otwierają się na twoim kliencie, po jednym na postać: +1 maks. Health, +1 maks. Sanity, +1 do statystyki, +1 do doświadczenia albo nowe doświadczenie na +2. Level Up można też przyznać z arkusza postaci, gdzie decydujesz, co zostało zdobyte (Standard albo Reinforced) i czy wybierasz ty, czy gracz: wtedy jego przycisk Level Up świeci się na złoto, a klient głównego GMa sprawdza jego wybór z ofertą, zanim go zapisze. Ofertę trzyma przeglądarka każdego GMa, więc przetrwa zmianę głównego GMa; reset sezonu, który czyści rozwój postaci, ją wycofuje.
5. **Koniec rozdziału** (sekcja 16) i **Zakończ Class Trial**, który zamyka debatę i przywraca kampanię do Daily Life. Ekran końca rozdziału może zrobić to drugie za ciebie.

Podczas **Final Trial** działa ta sama debata i to samo głosowanie; tylko werdykt należy do Masterminda (sekcja 8).

---

## 16. Koniec rozdziału i reset sezonu

**Zakończ rozdział** (Między sesjami albo konsola Class Trial po zastosowaniu werdyktu) to jeden ekran z polami wyboru, każde policzone, zanim je zaproponuje:

- ujawnij, czym naprawdę jest każdy Truth Bullet (bullety bez zapisanego prawdziwego typu są wymieniane jako luźny koniec);
- zbierz Truth Bullets uczniów (Faint i Final zostają);
- wyczyść Faint Remnants (Reinforced i powiązane ze zbrodnią zostają);
- usuń Key Remnants postawione w tym rozdziale;
- zakończ Class Trial, jeśli wciąż trwa;
- przejdź do następnego rozdziału, policz następną sesję i otwórz następny rozdział **następnego ranka, dzień później, z odnowionymi akcjami i Search Tokenami**.

Plan Key Remnants trzyma wiersze każdego rozdziału pod tym rozdziałem, więc następny rozdział otwiera się z pustym planem; rejestr Blackened zaczyna następny rozdział pusty (liczy rozdziałami), a stara karta ciała nie przecieka do następnego rozdziału. O śmierci, której nikt nie znalazł, nic nie jest mówione i nic jej nie ujawnia: jeśli stół ma ją mieć, ujawnij ją najpierw ręcznie (sekcja 13.4). Jeśli drugi GM naciśnie go, gdy pierwszy już przesunął rozdział, słyszy, że rozdział został już zakończony, i nic nie dzieje się dwa razy. Notka przypomina, czy w tym rozdziale postawiono Final Truth Remnant. **Rozdział 6 jest ostatnim w sezonie:** tam pole przejścia do następnego rozdziału startuje odznaczone i mówi o tym ostrzeżenie; zamiast przechodzić do 7, zresetuj.

**Zresetuj sezon** (czerwony kafelek) wymazuje sezon i zachowuje obsadę: wymienia dokładnie, co znika, z liczbami - projekty, Remnants, Truth Bullets i klucz odpowiedzi, plan Key Remnants, które pokoje odkryła każda postać i które skrytki znalazła, śmierci i Monocuby, każdy noszony albo schowany przedmiot, każdy Level Up i to, co kupił, każdą kartę modułu i każdy wątek komunikatora, notatki, pule do zera i Hope z powrotem do 2, drzwi do stanu z otwarcia sezonu, incydent, Masterminda, rozprawę, Search Tokens, obowiązujące Calle, Motive, zasady killing game, zwołane zgromadzenie, overflow, reszta dziennika czatu i zegar na rozdział 1, dzień 1, rano z odnowionymi akcjami wszystkich. Każda z tych rzeczy to jedna z **29** grup do zaznaczenia w pięciu sekcjach (Sprawa, Obsada, Plansza, Dziennik, Świat), domyślnie wszystkie zaznaczone; odznacz którąś, a reset jej nie ruszy; wybór zostaje zapamiętany i przy następnym resecie wraca odznaczony. Grupy tną razem z resztą to, co trzymają GMowie (sekcja 14): *Projekty* zabierają to, kto buduje każdą pułapkę i co ją uruchamia, *Incydent* zgłoszenia z ciemności, *Ustawianie w Eclipse* przejścia, *Śmierci i Monocuby* śmierci, których nikt nie znalazł, *Level Upy* te czekające na klasę, *Notatki przed sesją* notatki, *Despair overflow* jego licznik, *Pule Despair* to, co pule są winne, *Remnants na mapach* to, co zabrano z każdego ciała. *Plan Key Remnants*, odznaczony, zachowuje tylko wiersze rozdziału, w którym był sezon.

**Co zostaje:** obsada z nazwiskami, portretami i Ultimate, mapy, pokoje i ich właściciele, kto kogo pilnuje, zespół Monokum, nazwa kampanii.

**Reset należy do głównego GMa** - połączonego pełnego Gamemastera o najniższym identyfikatorze użytkownika (Asystenta GMa tylko wtedy, gdy żaden pełny Gamemaster nie jest połączony); inny GM słyszy, kto nim jest, i nic się nie dzieje. Okno wymienia każdego GMa, który nie jest połączony. Przeglądarka GMa trzyma swoją kopię sprawy (sekcja 14), dopóki znów nie otworzy świata: reset zapisuje w zegarze, kiedy się odbył, dla każdej grupy, którą wyczyścił, a przeglądarka, której nie było, usuwa to, co te grupy trzymały, przy pierwszym wczytaniu, czy ktoś inny jest połączony, czy nie. Jeśli coś z tego może ci się jeszcze przydać, najpierw zrób kopię sprawy.

> [!CAUTION]
> Potwierdzasz wpisując **RESET**; nic tego nie cofnie.

---

## 17. Dźwięk i efekty

`scripts/music.mjs`, `sfx.mjs`, `sound*.mjs`; `config.mjs SFX_CATEGORIES`, `SFX_EVENTS`, `SFX_SLIDERS`, `SITUATIONAL_PLAYLIST`.

> [!NOTE]
> **Moduł nie zawiera żadnych dźwięków.** Pliki są twoje; zdarzenie bez pliku gra ciszą z wyboru, nie z winy.

Okno **Dźwięk** (Teraz > Dźwięk) ma dla GMa trzy zakładki:

- **Odtwarzanie**: utwór z playlisty o nazwie **"Situational"** w pętli, wstrzymujący to, co grało, i reset, który to oddaje. Jeśli świat nie ma playlisty dokładnie o tej nazwie, przycisk ją tworzy - dopasowanie jest po nazwie, a prawie ta sama nazwa to playlista, którą moduł ignoruje.
- **Muzyka**: jedna playlista na stan, w kolejności, w jakiej stany się przebijają: pauza gry, Eclipse, Objection w Class Trial (rebuttal zachowuje tę samą muzykę; losowy utwór na każde przejęcie głosu, start natychmiast), debata, dyskusja, znalezione ciało (domyślnie cisza, poprzednia muzyka wstrzymana), Investigation, potem każda z pięciu pór dnia. Wymaga ustawienia *muzyka podąża za stanem gry* (wyłączone, dopóki go nie włączysz); odtwarzanie głównego GMa jest odtwarzaniem wszystkich. Wiersz **zabójstwa** stoi poza tą drabiną: gra jeden utwór ze swojej playlisty tylko w przeglądarkach uczestników incydentu i GMów, niezależnie od ustawienia, i przycisza tam muzykę pokoju, więc nikt inny nie dowie się z muzyki, że trwa morderstwo (budowniczy pułapki, będąc gdzie indziej, nie słyszy nic). Gdy wiersz jest pusty, incydent trzyma to, co grało.
- **Efekty**: jeden plik na zdarzenie (albo kilka rozdzielonych `|`, losowanych, nigdy dwa razy z rzędu ten sam) i przycisk Test.

Dwa **suwaki głośności**, per przeglądarka, w oknie Ustawień i w oknie Dźwięk dla graczy: *Dźwięk* dla efektów oraz *Muzyka*, która jest głośnością playlist samego Foundry, a nie drugą obok. GM znajduje też przełącznik **Różnicuj dźwięki, które słychać często**, działający dla całego stołu, obok suwaków w Ustawieniach, a pod Monokuma Legacy u góry okna Dźwięk (`SFX_VARIATION`: tempo w granicach 14%, minimum 0,5, niewielkie zmiany głośności).

Katalog według kategorii:

| Kategoria | Zdarzenia |
|---|---|
| **Bezpieczeństwo** | safeword - pełna głośność niezależnie od suwaka |
| **Interfejs** | otwieranie i zamykanie okien, przyciski, otwarcie czatu |
| **Czat** | wiadomość wysłana, odebrana, gracz woła GMa, Hope Call, Despair Call, nowa zasada, Motive, zgromadzenie |
| **Świat** | odkryty pokój, wejście do pokoju, odrzucone przejście, wydana akcja, ukończony projekt, krytyk, Search bez wyniku, nieudane Observe, zauważony tajny projekt, nieudany albo zauważony sabotaż, złamane narzędzie, kradzież, początek i koniec Eclipse, odpalenie overflow |
| **Incydent** | śmierć, znalezione ciało, nieudane sprzątanie, Breakdown, Wounded, zmiana Monocuba, Confusion, twoja tura w incydencie, znaleziony Truth Bullet, rozpoznany dowód, nieudana analiza, otwarcie debaty, Objection, rebuttal, otwarcie głosowania, werdykt, Level Up |

Odbiorcy każdego zdarzenia są ustalone w katalogu - śmierć słyszą tylko GMowie i uczestnicy; znalezione ciało wszyscy; rebuttal cały stół, raz, gdy się zaczyna, niezależnie od tego, czy minęła minuta Objection, czy otworzyłeś go ty.

Przeglądarka nie gra niczego, dopóki nie zostanie kliknięta; moduł takie dźwięki porzuca, zamiast kolejkować. `game.drpg.diagnoseSfx()` liczy porzucone i wymienia, co jest przypisane, wyciszone albo już zawiodło; `game.drpg.testSfx(key)` mówi, czemu dźwięk nie zagrał; `game.drpg.diagnoseMusic()` drukuje każdy stan, czy obowiązuje i do czego jest przypisany.

---

## 18. Okno Ustawień, motywy i ustawienie Język

Zębatka w prawym dolnym rogu otwiera **Ustawienia** (`scripts/look.mjs`): wszystko w nim należy tylko do tej przeglądarki, poza jednym przełącznikiem, który GM też tam dostaje: **Różnicuj dźwięki, które słychać często**, działającym dla całego stołu. Są w nim dwa suwaki głośności i **Dźwięki komunikatora**, a także:

| Ustawienie | Szczegóły |
|---|---|
| **Język** | English albo Polski, per przeglądarka, domyślnie angielski, celowo osobno od języka core Foundry (zmiana prosi o przeładowanie; słownik zostaje po angielsku) |
| **Motyw** | *Stained Glass* (obecna tożsamość: czarne, pęknięte szkło wzdłuż krawędzi ekranu, kolor w spoinach) albo *Monokuma Legacy* (wcześniejszy wygląd, z przełącznikiem czcionki pikselowej) |
| **Skala interfejsu** | od 80% do 140% na własnym kroju i panelach modułu |
| Puls szkła, nazwa stanu za zegarem i **Szkło rozmywa mapę** | pod Stained Glass |
| **Ograniczone animacje** i **Wysoki kontrast** | pod oboma; każde włączane też przez własne ustawienie systemu operacyjnego |

Te same przełączniki są w ustawieniach modułu w Foundry.

> [!TIP]
> **Szkło rozmywa mapę** to najdroższy efekt motywu: pierwsza rzecz do wyłączenia, gdy interfejs się przycina, a `game.drpg.perf()` mówi, ile kosztuje na tej maszynie.

**Książka** obok, najmniejszy z trzech przycisków w rogu (`scripts/handbooks.mjs`), otwiera podręczniki w grze, w języku modułu, prosto z `docs/handbooks`: Ulotkę ucznia i Podręcznik gracza dla wszystkich, a ten Podręcznik GM tylko dla GMów.

Kliknięcie dowolnego stałego panelu - zegara, paska Despair, paska stanu, zasobnika projektów - otwiera okno, które tłumaczy, czym jest i jak stoją sprawy, pokazując każdemu użytkownikowi tylko to, co panel już mu pokazuje.

**Powiadomienia** (`scripts/popup.mjs`) to karty, na których pojawiają się wyniki, odmowy i ogłoszenia; GM dostaje te skierowane do stołu albo do niego. Powiadomienie zostaje, dopóki czytający go nie zamknie - zwykłe kliknięciem w dowolne miejsce na nim, przyklejone przyciskiem X; samo zamyka się tylko powiadomienie "czekamy na GMa", gdy przyjdzie odpowiedź. Najnowsze ląduje na górze i spycha starsze w dół. Gdy jest ich więcej, niż stos pokazuje (**2** na kafelku Stained Glass, **4** pod Monokuma Legacy), starsze czekają pod spodem za plakietką "+N" i wracają, w miarę jak karty są zamykane. Scena dowodów Class Trial na środku mapy pokazuje dwa i zachowuje kolejność przybycia, więc Objection czyta się po przedstawieniu, na które odpowiada.

---

## 19. Safeword

`scripts/safeword.mjs`. Każdy arkusz postaci ma w lewym dolnym rogu **przycisk safeword**, podpisany słowem stołu (ustawianym w Ustawieniach sezonu; puste znaczy domyślne "Safe Word"). Jest też skrót klawiszowy, nieprzypisany, dopóki stół go nie wybierze, oraz `game.drpg.safeword()`. **Nacisnąć może każdy** - gracz, GM, zmarły, Monocub, widz - a jedno naciśnięcie robi trzy rzeczy:

1. gra się zatrzymuje (robi to klient głównego GMa, więc jakiś GM musi być połączony);
2. wszyscy widzą tę samą kartę "SCENA ZATRZYMANA" i słyszą dźwięk safeword na pełnej głośności;
3. każdy GM dostaje przyklejoną notkę, kto to wywołał i, jeśli naciśnięto go na arkuszu, z którego pokoju.

Nikomu innemu nie mówi się kto: naciśnięcie gracza prosi przeglądarkę głównego GMa o wystawienie karty, więc nie ma na niej imienia żadnego gracza. Gdy żaden GM nie jest połączony, kartę wystawia przeglądarka wołającego - jej nagłówek nie pokazuje imienia, ale zapis karty podaje wołającego jako autora, jak każda karta wystawiona przez przeglądarkę gracza (sekcja 1). Tak samo jest z naciśnięciem, na które przeglądarka żadnego GMa nie odpowie w ciągu trzech sekund (`TIMING.safewordAnswerMs`) - GM połączony, ale przeładowujący stronę, którego moduł jeszcze nie słucha: kartę wystawia wtedy przeglądarka wołającego, a jego własna karta mu to mówi, GM, którego przeglądarka nie słuchała, nie dowiaduje się, kto to wywołał, a gra staje tylko wtedy, gdy przeglądarka głównego GMa zobaczy, że karta przyszła - jeśli twoja jeszcze się ładowała, zatrzymaj grę ręcznie. Panel zdarzeń trzyma kartę "Scena zatrzymana", bez nazwiska, tak długo, jak gra stoi na pauzie.

> [!CAUTION]
> Nie ma pola powodu ani celu: scena jest zatrzymywana, nie składa się oskarżenia. Wyjaśnijcie sprawę z tą osobą, potem wznówcie od punktu, na który wszyscy się zgodzą.

**Notatka przed sesją** w komunikatorze (siedem pytań, na które gracz odpowiada przed każdą sesją: czy zamierza zabić, czy jest otwarty na śmierć, zgoda na tortury albo romans, triggery, jak chce grać, jaki duży projekt planuje) to druga połowa tego samego; czytaj je, zanim zdecydujesz o zgodzie na morderstwo. Od 1.2.64 słowa notatki należą tylko do GMów i jej autora: przeglądarka żadnego innego gracza ich nie ma, a notatka zapisana, gdy żaden GM nie jest online, czeka w przeglądarce autora, aż któryś się połączy.

---

## 20. Rozwiązywanie problemów

Wszystko jest pod `game.drpg` w konsoli przeglądarki; argumenty aktora przyjmują dokument, id albo nazwę.

**Zestaw testów regresji.**

| Wywołanie | Co robi |
|---|---|
| `game.drpg.runTests()` | uruchamia regresje źródła i niezmienniki tylko do odczytu; bezpieczne w trakcie gry - na końcu sprawdza, czy nic w świecie się nie ruszyło, i mówi co, jeśli jednak tak (liczy się też gracz, który coś zrobił w trakcie) |
| `game.drpg.runTests({ tier: 2 })` | dokłada scenariusze, które zapisują; najpierw pyta, w oknie, które podaje nazwę świata, z Anuluj jako pierwszym i domyślnym przyciskiem; tylko na kopii świata |
| `game.drpg.runTests({ tier: 0 })` | czyta wyłącznie własne źródło modułu |

> [!CAUTION]
> **Tier 2 zapisuje** - otwiera incydenty, zabija ludzi i resetuje sezony na własnych, sprzątanych po sobie fixture'ach - więc nigdy nie uruchamiaj tieru 2 w świecie, w którym ktoś gra; scenariusze, którym świat nie daje dość ludzi albo pokoi, są pomijane i mówią, czego światu brakuje, tier 2 jest odrzucany, gdy incydent jest otwarty, a drugie uruchomienie na tym samym kliencie jest odrzucane, dopóki pierwsze trwa.

Wynik to licznik "passed, failed, skipped" - z dopiskiem ", red until a later stage", gdy jakiś test jest oznaczony, że ma nie przechodzić do wydania wskazanego etapu - a po nim linie `ok`, `FAIL`, `skip` i `red`; skip to test, który powiedział, czego brakuje środowisku, nigdy wynik, który wyszedł źle.

**Mgła i widoczność.**

| Wywołanie | Co robi |
|---|---|
| `diagnoseFog()` | na kliencie *gracza* (mgła GMa jest lżejsza i odsłania każdy pokój znaleziony przez klasę, więc nie pokaże problemu gracza) mówi, która z podobnych do siebie przyczyn zaszła: wyłączone ustawienie, brak nazwanych regionów, niezamontowana warstwa, wszystkie pokoje już odkryte, nieprzygotowana scena |
| `diagnoseScenes()` | wymienia sceny z pokojami i czy każda jest gotowa |
| `prepareScenes()` | naprawia je wszystkie |
| `whyBlack()` | wymienia, co warstwa mgły ma na ekranie, gdy obraz jest zły |
| `checkRegions()` | zgłasza nachodzące pokoje, granice obok ścian, przerwy za długie na drzwi i narożniki poza siatką |
| `doorwayReport()` | tłumaczy każdy odcinek granicy bieżącego pokoju |
| `fogPeek()` | chowa mgłę na kilka sekund |
| `fogAnimations(false)` | wyłącza animację odsłaniania w trakcie sesji |
| `seedDiscovery()` | zapisuje pokój, w którym każda postać już stoi |
| `diagnoseVisibility()` | na skarżącym się kliencie tłumaczy, czemu token z innego pokoju jest widoczny |

**Despair i kości.** `diagnoseDespair()` i `diagnoseDice()`; `diagnoseCharacters()` to raport ustawienia obsady. Despair, który nie dochodzi, to zwykle brak połączonego głównego GMa, wyłączone *rzuty dają Despair* albo rzut reakcji. Od 1.2.65 rzut, który rzuca moduł, nie nazywa nikogo w swoim dokumencie (sekcja 1), a przeglądarka głównego GMa dowiaduje się, czyj był, od przeglądarki rzucającego; gdy ta wiadomość przepadnie przy przeładowaniu, rzut liczy się jednej żyjącej postaci rzucającego, a bez takiej nie daje Despair.

**Inne narzędzia.** `diagnoseVoice()`, `diagnoseSfx()`, `testSfx()`, `diagnoseMusic()` oraz:

| Narzędzie | Na co |
|---|---|
| `diagnoseTruthBullets()` | czy bullety i klucz odpowiedzi się zgadzają |
| `diagnosePatches()` | czy każde nadpisanie jest tam, gdzie się spodziewa |
| `diagnoseWindows()` i `diagnoseStyles()` | ucięte okno albo źle wyglądający arkusz |
| `traceClicks()` | kliknięcie, które nic nie robi |
| `fileSizes()` | hostowany świat, który zdaje się serwować stare pliki |
| `perf()` | motyw, który się przycina |
| `a11y()` | kontrolki, których czytnik ekranu nie umie nazwać |
| `relayGuard()` | czy strażnik przekaźnika GM-a w Daggerheart stoi (`state: "ok"`) i czego odmówił w tej sesji |
| `rollFlags()` | rzuty graczy wylosowane w ostatniej półgodzinie (tak daleko, jak sięga Reroll), w których okno rzutu podało statystykę, doświadczenie, premię albo kości, jakich nie dała lista przeglądarki GMa, która je wylosowała, albo pominęło premię, kość przewagi albo kość ukrytej skrytki, które ta lista dała, albo które czekały na statystykę, której żaden GM nie wybrał; o każdym GMowie dostali szept, gdy go wylosowano, każdy policzono tak, jak daje lista, a linia może kończyć się tym, co GM policzył |
| `sheetWrites()` | zmiany, które przeglądarki graczy zrobiły na swoich uczniach w ostatniej dobie, a przeglądarka głównego GMa cofnęła, zgłosiła albo wpisała na listę, albo zostawiła na tym, co je pokrywało: kto, który uczeń, powód, który podała zmiana, każde pole przed i po, co zwrot wziął z wcześniej zapłaconego i jak oraz kto rozstrzygnął zgłoszoną |
| panelowy **Dziennik debugowania** (Diagnostyka) | jego przycisk Kopiuj daje dokładnie to, czego potrzebuje zgłoszenie błędu |

Naprawy: `resetAllActions()` dla zepsutego przejścia zegara, `ruleOnParkedMurder(killerId, true)`, `applyChapterEnd({...})`, `setMotive(null)`, `refreshMusic()`, `repaintFog()`, `resetAllVoice()`.

**Częste pułapki.**

| Objaw | Przyczyna i naprawa |
|---|---|
| *Gracze widzą czarny ekran.* | Scena ma pokoje, ale widzenie Foundry jest wciąż włączone. Kontrola przed sezonem albo `prepareScenes()`. |
| *"Rano · ECLIPSE" i morderstwa są ciągle odrzucane.* | Zegar edytowano w trakcie Eclipse. Zakończ Eclipse przyciskiem odtwarzania na HUD. |
| *Nikt nie dostał akcji z powrotem.* | Akcje wracają, gdy Eclipse się otwiera, nie gdy zegar się przesuwa. Użyj panelowej **Następnej pory dnia** dla granicy bez Eclipse albo zaznacz *Odnów też* w Edytuj kampanię. **Nigdy obu.** |
| *Search nigdy nie daje tego, co wpisałem do tabel.* | Tabele są znajdowane po nazwie; trzymaj się kształtu `DRPG <kategoria> - Tier n` albo instaluj z edytora. Na pule pokoi trzeba wskazać w Ustawieniach pokoi. |
| *Przycisk Odtwórz nic nie robi.* | Nie ma playlisty o dokładnej nazwie "Situational". Przycisk w zakładce Odtwarzanie ją tworzy. |
| *Cisza przez pierwsze minuty sesji.* | Przeglądarka nie została kliknięta. To nie usterka; `diagnoseSfx()` liczy, co porzucono. |
| *Panel mówi, że debata jest otwarta, a rozdział się skończył.* | Rozprawa przeżyła swój rozdział. Zakończ Class Trial z konsoli (ekran końca rozdziału ma na to pole). |
| *Despair Call albo decyzja nic nie zrobiły.* | Dwóch GMów: zapisuje główny. Sprawdź, który połączony pełny Gamemaster jest głównym (najniższe id użytkownika), i zajrzyj do Dziennika debugowania. |
| *Gracz słyszy, że zmiana w Daggerheart nie została wykonana, bo tę zmianę gra zostawia GM-owi.* | Jego funkcja Daggerhearta poprosiła o coś, co ta gra zostawia GM-owi (obszar na mapie, nowe odliczanie, Health innego ucznia). Ostrzeżenie na twoim ekranie mówi, o co; zrób to ręcznie. |
| *Koszt Daggerhearta u gracza nie wszedł, gdy GM przeładowywał stronę.* | Przy dwóch GM-ach zmiany Daggerhearta za graczy robi tylko główny; wysłana w chwili jego przeładowania może przepaść. Ustaw ręcznie. |
| *Czat mówi, że Daggerheart poprosił o zmianę od nadawcy, którego Foundry nie wskazało.* | Każda taka zmiana jest odrzucana. Jeśli Hope, Stress albo Fear graczy przestają się ruszać przy rzutach, to dlatego: daj znać autorowi modułu, z wynikiem `game.drpg.relayGuard()`. |
| *Zmiana gracza na jego karcie wróciła do poprzedniej wartości albo pyta o nią karta.* | Nic, o czym wie moduł, jej nie pokrywało (rozdział 6.3); `game.drpg.sheetWrites()` pokazuje, co i dlaczego. Jeśli to była twoja decyzja, ustaw wartość sam: zmiany GM-a nic nie ocenia. |
| *Drzwi zostają zamknięte po resecie sezonu.* | Reset przywraca kolumnę "zaczyna zamknięte" z zakładki Drzwi. |
| *Po aktualizacji na ekranie zostaje "migracja danych zatrzymała się w pół drogi".* | Krok, który przenosi dane świata do magazynu GMów, nie mógł ich odczytać z powrotem i zostawił świat bez zmian (sekcja 1). Szczegóły są w konsoli; przy następnym wczytaniu świata próba się powtarza, w przeglądarce głównego GMa. |
| *Stół nie widzi śmierci.* | Ofiarę trwającego incydentu GMowie trzymają, dopóki ciało nie zostanie znalezione (sekcja 13.4). Ustaw ją na *Nie żyje* w oknie Uczniowie, żeby to ujawnić. |

---

## 21. Lista kontrolna sesji

**Przed sesją**
- Otwórz **Ustaw sezon**: każdy nieopcjonalny wiersz zaptaszkowany; uruchom **Kontrolę przed sezonem** (żadnych scen z czarnym ekranem, żadnych czytelnych arkuszy).
- Ustawienia pokoi: sypialnie przypisane, drzwi jak trzeba, pokoje odpoczynku oflagowane, tabele i sprzyjanie ustawione, żetony uzupełnione.
- Despair Flow: każdy uczeń pilnowany; pule nazwane; próg overflow i kapelusz takie, jak chcesz.
- Tabele przedmiotów zainstalowane; przedmioty startowe w każdej torbie.
- Dźwięk: playlisty zmapowane (i "Situational" istnieje), pliki efektów przypisane, głośność sprawdzona na twojej przeglądarce.
- Przeczytaj notatki przed sesją w komunikatorze. Potwierdź safeword ze stołem.
- Plan Key Remnants naszkicowany, jeśli morderstwo w tej sesji jest prawdopodobne; Final Truth Remnant postawiony, jeśli rozdział go potrzebuje.
- Zegar: właściwy rozdział, dzień, sesja, pora dnia, faza.

**Każda pora dnia**
- Obserwuj linię **Dalej** i listę: kto ma jeszcze akcje.
- Szybko odpowiadaj na karty w komunikatorze (Experience, Ultimate, akcje dynamiczne, propozycje, cele Observe, przerobione ślady, zgłoszenia Direct Murder, alarmy pułapek).
- Gdy wszyscy skończą: zacznij Eclipse (odnowienie), pozwól im się ustawić, zakończ (przesunięcie zegara). Oceń zaparkowane morderstwa przy zapalonym świetle.
- Wydawaj Despair jak Monokuma: stół zawsze się dowiaduje.

**Gdy trwa morderstwo**
- Doprowadź incydent do końca, zanim zrobisz cokolwiek innego. Dokończ prozę, którą podają ci karty.
- Pozwól zabójcy sprzątać, dopóki scena jest ciepła. Postaw pozostałe Key Remnants (ekran po incydencie je liczy).
- Znalezione ciało: wybierz, które Faint ślady należą do sprawy, potem rozpocznij Investigation, gdy sala będzie gotowa. Wydaj sekcję.

**Investigation**
- Pulpit otwarty: Ślady, Key Remnants znalezione z postawionych, Kto co ma. Celuj w krąg podejrzanych 2 do 4.
- Honoruj wskazówki za krytyki. Zacznij rozprawę, gdy klasa jest gotowa, wiedząc, ile wyniesie opłata za nieznalezione.

**Class Trial**
- Start, dyskusja, debaty otwierane wedle potrzeby, zamykane; głosowanie, przypomnienie spóźnialskim, liczenie; werdykt; Level Upy; koniec rozdziału.

**Po**
- Koniec rozdziału: ujawnij, zbierz, wyczyść, następny rozdział, następna sesja, następny ranek.
- **Kopia sprawy** (panel GMa), a plik tam, gdzie żaden gracz go nie otworzy: klucze odpowiedzi, ślady i Mastermind żyją tylko w przeglądarkach GMów, a od 1.2.64 także budujący pułapki i ich wyzwalacze, plan Key Remnants, notatki i śmierci, których nikt nie znalazł.
- Skopiuj Dziennik debugowania, jeśli coś nie działało. Zapisz, czego potrzebuje następny rozdział.
