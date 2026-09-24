# Danganronpa RPG - Podręcznik GM

*Dla modułu "Danganronpa RPG" do Foundry VTT v14, wersja 1.2.59, zbudowanego na systemie Daggerheart.*

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
| Dice So Nice! | wymagany | Każdy rzut w tej grze leci na oczach stołu; tak widać kości duality |
| Isometric Perspective | zalecany | Mapy akademii są rysowane izometrycznie; bez niego sceny, tokeny i Remnants trafiają na siatkę, dla której ta grafika nie powstała. Mapy kwadratowe i tak działają |
| LiveKit AVClient | zalecany | Głos per pokój: regiony stają się pokojami breakout, a przejście między pokojami zmienia, kto cię słyszy. Bez niego cała szkoła rozmawia na jednym kanale |

Moduł nie używa libWrapper. Jeśli Isometric Perspective kiedyś będzie go potrzebować, powie o tym strona tamtego modułu.

Moduł powstał i był grany na The Forge; działa tak samo na każdym hoście Foundry v14.

**Start świata.** Załóż świat na systemie Daggerheart, włącz moduł i zależności, potem otwórz panel GMa (przycisk **GM** w lewej kolumnie, pod zegarem) i uruchom **Ustaw sezon**. Cała reszta to sekcja 2.

**Ustawienia modułu warte znajomości.** W ustawieniach modułu w Foundry znajdziesz m.in.: *wymuszone prywatne rzuty graczy* (każdy rzut gracza jest szeptem do niego i do GMów), *anonimowe arkusze postaci* (cudzy arkusz otwiera się ocenzurowany), *Search Tokens na pokój*, *blokadę okna rzutu dla graczy*, *gracze widzą tylko tych, którzy są w ich pokoju*, *pokoje decydują, co widzą gracze* (mgła pokojów), *gracze nie edytują akcji, Hope, Health, Sanity ani statystyk*, *przejście między pokojami kosztuje Move*, *rzuty dają Despair*, *zastąpienie licznika Fear z Daggerheart*, *chroń edycję tokenów przed Isometric Perspective*, *muzyka podąża za stanem gry*, *głos per pokój*, oraz per przeglądarkę *Język* i *Motyw*. Domyślne wartości to sposób, w jaki gra ma być grana; przełączniki istnieją po to, by stół mógł któryś kawałek prowadzić ręcznie, gdy zechce.

> [!IMPORTANT]
> Dwa z tych ustawień są na starcie wyłączone, bo każde najpierw czegoś od ciebie potrzebuje: *muzyka podąża za stanem gry* (playlisty zmapowane w oknie Dźwięk) i *głos per pokój* (LiveKit AVClient i działający serwer).


> [!NOTE]
> **Co gracz może z konsoli, a czego nie.** Przeglądarki graczy proszą twoją o większość zmian w tej grze, a Daggerheart robi to samo dla własnych reguł. Twoja przeglądarka sprawdza każdą prośbę: kto naprawdę ją wysłał, czy gracz prowadzi tę postać albo może widzieć projekt, czy pokój, etap i tura na to pozwalają. Cofnięcie czegoś jest przyjmowane tylko tuż po tym, jak ten gracz przerzucił rzut tej postaci, raz dla każdego rodzaju cofanej rzeczy; to pokazuje, że rzut na jego karcie czatu został przerzucony, a nie, że Reroll był opłacony. Prośba, która nie przejdzie, niczego nie zmienia. Większość odmów mówi też graczowi, że klient GM-a odmówił, i zostawia linię z nazwą gracza w Dzienniku debugowania głównego GM-a; kilka trafia tylko do dziennika, a prośba Daggerhearta rodzaju, którego moduł w ogóle nie zna, jest odnotowana bez nazwy. Przy zmianie od Daggerhearta dostajesz też ostrzeżenie na ekranie, a zmiana, której Daggerheart nie robi dla gracza, zostawia kartę na twoim czacie - zwykle znak, że ktoś obszedł grę, czasem funkcja Daggerhearta, której ten moduł jeszcze nie zna, więc zapytaj, zanim wyciągniesz wnioski. Fear nie jest racjonowany: każdy krok, o który prosi Daggerheart gracza, wchodzi, po jednym, a gdy klient jednego gracza ruszy go więcej niż cztery razy w dziesięć sekund, dostajesz notkę na ekranie - porównaj ją z rzutami na czacie; wolniejszych kroków nic z niczym nie porównuje. Czego jeszcze nie sprawdza: sum własnych rzutów gracza; Hope, Stress i Health na jego własnej postaci, w ich granicach; zasobów każdego aktora, który nie jest uczniem, towarzyszy też; ładunków (bez pilnowania maksimum przedmiotu) i ilości jego własnych przedmiotów; tyknięć odliczań, po jednym kroku, i dowolnej zmiany odliczania, którego właścicielem go zrobiłeś; sum rzutów obronnych na jego własnych tokenach; wpisów rzutu grupowego i tag teamu jego drużyny; oraz kolejności środowisk sceny - żadne z nich nie ma limitu częstotliwości. Jeśli funkcja Daggerhearta używana przez gracza kończy się tą odmową (postawienie obszaru, uruchomienie odliczania, leczenie albo ranienie innego ucznia umiejętnością), prosi o coś, co ta gra zostawia GM-owi: zrób to za niego. Jeśli Daggerheart jest nowszy, niż moduł zna, dowiesz się raz, czego odmawia.

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
| Każdego ucznia pilnuje Monokuma | Każdy uczeń karmi jakąś pulę Despair (taki, którego nigdy nie przypisano, trafia do pierwszej puli) albo jest celowo ustawiony na "- nikt -", jak Mastermind, co liczy się jako pilnowany | **Otwórz** otwiera Despair Flow |
| Uczniowie są podzieleni po równo między pule (opcjonalne) | Liczba żyjących uczniów na pulę różni się najwyżej o jednego | Tylko rada: **Otwórz** otwiera Despair Flow, gdzie **Podziel po równo** ich rozdaje. Obsada, która nie dzieli się równo, to decyzja, nie błąd |
| Pliki dźwiękowe (opcjonalne) | Co najmniej jedno zdarzenie ma plik | **Otwórz** otwiera okno Dźwięk; moduł nie zawiera żadnych dźwięków |
| Dość pokoi dla obsady (opcjonalne) | Wspólne pokoje (bez sypialni i regionów z zaznaczonym "To nie pokój" w Ustawieniach pokoi > Drzwi) wobec około 1,5 na gracza (`ROOMS_PER_PLAYER`), zaokrąglone przez `roomsWantedFor` | Tylko rada: poniżej tej proporcji dwie prywatne rozmowy nie mogą toczyć się naraz |
| Mapa ma pokoje | Robocza scena ma co najmniej jeden region | **Otwórz** otwiera Ustawienia pokoi. Wiersz niesie też instrukcję rysowania pokoi i przycisk **Sprawdź pokoje na tej scenie** |
| Kursor GMa jest prywatny (zalecane) | Udostępnianie kursora w Foundry jest wyłączone dla dwóch ról GMa | **Zrób to** edytuje macierz uprawnień core; gracze zachowują swoje |
| Mastermind (opcjonalnie) | Mastermind jest ustawiony | **Otwórz** otwiera okno Masterminda. Sezon bez niego to legalny sezon |

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

O **Uczniach** warto dodać: lista rozwijana tylko przestawia flagi i jest narzędziem naprawczym na pomyłkę. Przyciski po prawej robią to naprawdę - **Postać umiera**, opisane niżej, i **Zaproś jako Monocuba**, który robi z martwego ucznia Monocuba. Kolumny Monocuba (Hope, zamiana Despair w Hope, Uciszony) pojawiają się dopiero, gdy jakiś Monocub istnieje.

> [!CAUTION]
> **Postać umiera** niszczy Truth Bullets postaci (chyba że zaznaczysz *Zachowaj ich Truth Bullets*, przy śmierci spoza killing game) i zostawia resztę przy ciele.

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
| Search | Eye albo Hand | 1 + Search Token pokoju | Przeszukaj pokój pod kątem czegoś, co nazwiesz | 8: Tier 0 (ślad Hidden), 12: Tier 1 (Subtle), 18: Tier 2 (Evident); krytyk: +1 Tier i ślad Obvious. Zabranie Murder Weapon albo Cleaning Tool zostawia Faint Prep Remnant. Porażka nic nie znajduje |
| Observe | Eye | 1 | Skopiuj Remnant do ekwipunku jako Neutral Truth Bullet | DC z `OBSERVE_DC` (sekcja 14); porażka kosztuje 1 Sanity (`OBSERVE_FAIL_STRESS`) |
| Analyze | Head | 1 | Rozpoznaj Neutral Truth Bullet albo poproś GMa o wskazówkę | DC z `ANALYZE_DC`; porażka blokuje ten bullet do końca rozdziału. Tryb wskazówki: 14 subtelna, 18 bezpośrednia, krytyk: jedno pytanie do ciebie. Znajdź ukrytą skrytkę: 16 |
| Projects | Hand, Body, Leg albo Head | 1 | Popchnij projekt w tym pokoju albo zaproponuj nowy do twojej zgody | 12: +1 postępu, 18: +2; krytyk: +2 i zwrot akcji |
| Dynamiczna | wybór GMa | 1 | Gracz opisuje coś, na co gra nie ma nazwy; ty ustalasz próg | pasma poniżej |
| Rest | brak | 1 (Short) albo 2 (Long) | Odzyskaj | poniżej |
| Listen | Shadow | 1 | Dowiedz się, kto jest obok, bez GMa | Pokój wybiera się przed rzutem. 14: ile osób w nim jest; 18: kto to jest, z imienia; krytyk: kto jest w każdym sąsiednim pokoju. Odpowiedź to prywatna karta. Sąsiad, którego słuchający nie odkrył, figuruje tylko jako "Nieodkryty pokój 1, 2...", na liście wyboru i w odpowiedzi |
| Palm | Hand, potem Shadow | 1 | Wyjmij coś z cudzej kieszeni albo coś w niej zostaw | Kradzież: 10 na powodzenie, 15 na Shadow, by nikt nie zauważył. Podłożenie: 8, niezauważone 13 |
| Tamper | Shadow | 1 albo 1 Sanity, gdy nie ma już akcji | Usuń ślad, przerób go albo podłóż taki, który wskazuje kogoś innego | Zasady Stage 6 (sekcja 13). Sięga tylko śladów w twoim pokoju, które znalazłeś (masz ich Truth Bullet), a przy otwartym incydencie także jego śladów Incident, jeśli jesteś jego ofiarą albo jednym z zabójców |
| Direct Murder | brak | 1 | Otwórz Direct Murder, uzgodnione z tobą wcześniej | Zgłaszane w Eclipse; sekcja 13 |

**Move** nie jest kafelkiem: akcją jest przeciągnięcie tokenu, a koszt nalicza się, gdy token wejdzie do innego pokoju. **Sabotage** to trzecia gałąź menu Projects.

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

Wydawane z arkusza postaci, szeptem do gracza. Zablokowane podczas Eclipse, pod zaciemnieniem *Silence*, dla gracza trafionego Despair Callem *Silence* i dla zmarłych; zostają otwarte w incydencie i w Class Trial. Dwa z nich wymagają twojej decyzji.

| Call | Koszt | Efekt | Potrzebuje GMa |
|---|---|---|---|
| Support | 1 | Daj innemu graczowi przewagę na jeden rzut; ten sam pokój | nie |
| Experience | 1 | Dodaj doświadczenie do rzutu, do którego naprawdę się stosuje | tak |
| Ultimate | 1 | Przewaga na rzut, do którego Ultimate naprawdę się stosuje | tak |
| Contribution | 2 | +1 postępu do projektu, nad którym pracuje się w twoim pokoju | nie |
| Sprint | 2 | Jedno dodatkowe przejście między pokojami w tej porze dnia, za darmo | nie |
| Reroll | 3 | Przerzuć akcję; poprzedni wynik jest cofnięty | nie |
| Resolve | 3 | Na jeden rzut sam wybierz statystykę | nie |
| Burst | 4 | Następna akcja nic nie kosztuje, ile by nie kosztowała | nie |
| Relief | 4 | Weź Short Rest teraz: bez akcji, bez pokoju odpoczynku, nie zużywa tego z tej pory dnia | nie |
| Loaded Die | 6 | Przy następnym rzucie jedna kość ustawiona na 12, druga rzucona; krytyk tylko, jeśli i ona wypadnie 12 | nie |

**Zatwierdzanie Experience i Ultimate.** Gracz musi napisać, do czego chce tego użyć - puste pole anuluje, bo decyzja dotyczy zdania, nie Calla. Prośba ląduje jako karta w wątku komunikatora gracza, widoczna dla gracza i każdego GMa, z przyciskami **Stosuje się** i **Nie tym razem**. Odpowiedzieć może każdy GM. Nic nie jest pobierane przed zgodą; odmowa albo milczenie nic gracza nie kosztuje (prośba wygasa po **pięciu minutach**). Jeśli twoja przeglądarka przeładuje się z otwartym pytaniem, klient gracza zapyta ponownie, gdy wrócisz. Po naciśnięciu przycisku karta zmienia się w pokwitowanie w wątku, więc nikt nie orzeka dwa razy; pod nią można jeszcze dopisać coś słowami.

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

Obstacle, Approval, Support i Confusion Monocuba są "uzbrajane" na następny rzut celu tym samym mechanizmem; okno rzutu je nakłada. Pieczęcie, Chained i Silence czyści otwarcie następnego Eclipse albo, gdy Eclipse nie jest używany, następna zmiana pory dnia. Public Announcement jest odroczone: zgromadzenie odbywa się na następnej granicy, a cofnięcie zegara je odwołuje. **Motive** pyta o żądanie, termin od **1 do 10** pór dnia (domyślnie **3**, `MOTIVE`) i konsekwencję; jest ogłaszane wszystkim, odlicza się przy każdej zmianie pory dnia (Eclipse się nie liczy), jest ogłaszane raz jeszcze, gdy termin minie, i zostaje na tablicy na zerze, dopóki go nie wycofasz albo rozdział się nie zmieni. **New Rule** trafia na listę zasad killing game, widoczną na każdym arkuszu postaci; brzmienie edytujesz, zasady wycofujesz albo dodajesz w **Zasadach killing game** w panelu.

### 6.3 Decyzje, karty i komunikator

Każda akcja, która potrzebuje człowieka - wskazówki Analyze, akcje dynamiczne, zgłoszenia Direct Murder, propozycje projektów, przerobione ślady, alarmy pułapek, powyższe Calle - przychodzi jako **karta w komunikatorze** (`scripts/gm-bridge.mjs`, `scripts/messenger.mjs`). Komunikator to jeden wspólny wątek na gracza: gracz i każdy GM czytają i piszą w tej samej rozmowie. GM otwiera wątki z przycisku w prawym dolnym rogu (lista z licznikami nieprzeczytanych) albo prawym kliknięciem na graczu w liście graczy Foundry. Karta pokazuje rzut, własne słowa gracza i blok tylko dla GMa z progami; przyciski są tylko dla GMa i sprawdzane ponownie po stronie odbiorcy, więc podrobione kliknięcie nic nie daje. Decyzja bez właściciela-gracza (aktor Monokumy, alarm pułapki) idzie do szeptów GMa, z tymi samymi przyciskami.

Dwóch GMów to norma. Jeden z nich jest **głównym GMem** (połączony pełny Gamemaster o najniższym id użytkownika; Asystent GMa tylko wtedy, gdy żaden pełny Gamemaster nie jest połączony) i to jego klient zapisuje stan świata: przyznany Despair, Search Tokens, odkrycia, wyniki incydentu. Korekty Despair asystenta są przekazywane do głównego. Jeśli coś "nic nie robi", sprawdź, czy główny GM jest połączony.

---

## 7. Pule Despair, przydziały i overflow

`scripts/despair.mjs`, `scripts/assignments.mjs`, `scripts/overflow.mjs`, `config.mjs OVERFLOW`.

**Zdobywanie.** Gdy rzut ucznia wypadnie z wyższą kością Despair, **+1 Despair** idzie do puli Monokumy *tego ucznia* (ustawienie *rzuty dają Despair*, zapisywane przez głównego GMa). Rzuty reakcji - gołe kliknięcie statystyki - nic nie płacą; własne rzuty aktora Monokumy nic nie płacą. Uczeń ustawiony na "- nikt -" nie karmi nikogo (przydatne dla postaci wycofanej, prowadzonej jako NPC, albo Masterminda według twojego uznania).

**Pule.** Każde konto pełnego Gamemastera ma pulę Despair z limitem **12** (`STARTING.despairMax`), a postacie Monokum wydają z tych pul. Widget Despair u góry ekranu pokazuje każdą pulę pod jej nazwą, także gdy jest tylko jedna (nazwa ustawiona w Despair Flow, a bez niej nazwa konta): wszyscy widzą liczby, GM ma dodatkowo przyciski. **Despair Flow** (Między sesjami) to jedno okno dla zespołu: którzy aktorzy są Monokumami, z puli którego GMa każdy czerpie, nazwy pul, dodatkowi posiadacze pul (Asystentowi GMa można przyznać pulę), który Monokuma pilnuje którego ucznia (z **Podziel po równo** i "- nikt -") oraz strojenie overflow. Kształt z podręcznika to co najmniej dwóch GMów dzielących uczniów ściśle między siebie, ale moduł działa i z jednym.

**Zamiana Despair w Hope** (1:1) to decyzja GMa z okna Uczniowie albo okna Masterminda, nigdy przycisk samoobsługowy: tak zasila się Monocuba i tak Mastermind utrzymuje się na powierzchni.

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

**Werdykt Class Trial opróżnia overflow** przy obu wynikach; reset sezonu też. Gracze widzą liczby w pulach i próg overflow, ale "?" zamiast jego licznika ("?/20") - kiedy kapelusz wystrzeli, wie tylko Monokuma.

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

**Monocub** (`scripts/monocub.mjs`, `MONOCUB`). Gracz zmarłego ucznia może dołączyć do GMów, gdy skończy się jego własny Class Trial - moment wybierasz ty, moduł wymaga tylko, by postać nie żyła. Zaproś go z okna **Uczniowie**. Zachowuje ten sam arkusz i dostaje dokładnie dwie rzeczy: **Move** oraz **Confusion** (**1 akcja + 1 Hope**), płaski rzut 2d12 bez statystyki, który podkręca rzut żyjącego ucznia w tym samym pokoju, nie mówiąc, kto to zrobił:

| Confusion | Daje | Nakłada |
|---|---|---|
| 12 | +1 na następny rzut celu | -1 na następny rzut celu |
| 16 | przewagę | utrudnienie |
| Krytyk | oddaje celowi akcję | marnuje akcję |

Hope Monocuba pochodzi tylko z zamiany Despair przez GMa (Fuel a Monocub albo okno Uczniowie). Pole **Uciszony** to zasada z podręcznika dla Monocuba, który natknął się na miejsce zbrodni: może działać, ale nie mówić o zbrodni do końca rozdziału; gracz jest powiadamiany, gdy to ustawiasz i zdejmujesz. Kości Monocuba widzą wszyscy w jego pokoju.

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

`scripts/fog.mjs`, ustawienie *pokoje decydują, co widzą gracze*. Jedna warstwa nad całą sceną, trzy stany: pokój, w którym stoisz, jest czysty; pokój odwiedzony prześwituje przez zasłonę; wszystko inne, łącznie z fragmentem mapy poza każdym regionem, to pełna mgła. Podczas Eclipse nawet pokój, w którym stoisz, jest tylko za zasłoną. Odkrywanie jest **per postać**, zapisywane przez głównego GMa, gdy token wchodzi do pokoju po raz pierwszy (z dźwiękiem dla ucznia, który wszedł), i przetrwa sesje; pełny zapis zostaje w przeglądarce GMa, a przeglądarka każdego gracza trzyma tylko wiersze jego własnych postaci. GM widzi lżejszą mgłę: każdy pokój odkryty przez klasę jest czysty, a pokoje, których nikt jeszcze nie znalazł, razem z każdym miejscem poza pokojami, leżą pod zasłoną. Mastermind widzi każdy pokój jako odwiedzony.

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

`scripts/voice.mjs`, ustawienie *głos per pokój* plus LiveKit AVClient. Każdy zmapowany pokój staje się własnym pokojem breakout LiveKit; gracz słyszy tego, kto jest z nim w pokoju, a jego klient głosowy podąża za tokenem. Monokuma podąża za własnym tokenem, głosem GMa, do którego puli jest przypisany. Podczas Eclipse każdy jest we własnym kanale, a GMowie dzielą jeden. Zmarli, chyba że wrócą jako Monocub, wracają do pokoju głównego. **Podsłuchu nie ma:** LiveKit pokazuje kafelek każdego słuchacza w pokoju, więc GM, który chce słyszeć pokój, wchodzi do niego swoim Monokumą. **Zresetuj wszystkie pokoje głosowe** (Między sesjami) odsyła każdego do pokoju głównego. `game.drpg.voicePlan()` wypisuje, dokąd każdy *zostałby* wysłany, bez mikrofonu i bez nikogo innego połączonego, więc większość testu głosu to minuta jednej osoby; `game.drpg.diagnoseVoice()` mówi, które z pięciu ogniw jest zerwane; uruchom je na kliencie, który się skarży.

> [!WARNING]
> Moduł głosu zbliżeniowego zainstalowany obok potrafi uciszyć stół, gdy każda kontrola raportuje sukces - diagnoza go wymienia.

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

**Skrytka** (`scripts/vault.mjs`). Wszystko, czego postać nie nosi, leży w skrytce: domyślnie w sypialni albo w każdym pokoju, w którym Ustawienia pokoi jej ją dają. Skrytka mieści **3** rzeczy (`VAULT_LIMIT`). Chowanie i wyjmowanie nic nie kosztuje, ale trzeba tam stać; Truth Bullets nie da się schować. **Otwarta** skrytka to szuflada: każdy stojący w pokoju może ją przejrzeć za darmo i wziąć jedną rzecz, a właściciel się o tym nie dowiaduje. Udane Search w pokoju, w którym ktoś inny trzyma niepustą skrytkę, bierze z tej skrytki zamiast z tabeli pokoju (najpierw z otwartych; ukryta kosztuje szukającego kość utrudnienia), i tylko Search, który robi to z Despair, zostawia szufladę na tyle naruszoną, że właściciel to zauważy - nigdy kto to zrobił. **Ukrytą** skrytkę (właściciel zbudował schowek - projekt, według twojego uznania; ukrytą robisz ją, przełączając jej komórkę w Ustawieniach pokoi) trzeba najpierw znaleźć przez Analyze > Znajdź ukrytą skrytkę (Head, **16**), co otwiera tę jedną skrytkę tej jednej osobie, dopóki jej nie usuniesz. Mastermind widzi każdą skrytkę. `game.drpg.inspectVaults()` pokazuje ci zawartość każdej.

**Palm** (sekcja 5) to kradzież z kieszeni i podkładanie do kieszeni; oba rozstrzyga klient GMa według `ACTIONS.palm`, a niezgrabnego złodzieja ofiara słyszy.

**Zabieranie z ciała** (`scripts/handover.mjs`). Truth Bullets zmarłego ucznia przepadają; wszystko inne, co nosił, zostaje na arkuszu, a inny uczeń, który go otworzy, może nacisnąć **Weź** przy przedmiocie. Przedmiot przechodzi do zabierającego, który dostaje też Neutral Truth Bullet mówiący, co zabrał i komu, a ciało dostaje jeden Subtle Remnant, powiązany ze zbrodnią, którego notatka wymienia wszystko, co z niego zabrano. Jego karta śladu nazywa akcję "Zabrane z ciała", a token nosi dłoń Palm - dla GMa zawsze, dla gracza dopiero, gdy jego własna kopia zostanie rozpoznana.

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

Każdy projekt ma nazwę, obrazek albo ikonę w zasobniku, skalę, pokój (albo dowolny), opcjonalnie wymaganą statystykę, widoczność (tajne projekty widzą proponujący i GMowie; udostępnij je wspólnikom) oraz flagę morderstwa pośredniego. **Projekty** (kafelek panelu) to menedżer: tworzenie, edycja, udostępnianie, dodawanie i odejmowanie postępu, usuwanie. Projekt z pokojem stoi też na mapie jako token na dwa pola z młotkiem i bez nazwy, który możesz przeciągać; gracz widzi go, gdy już stał w jego pokoju, a tajny projekt - gdy zostanie do niego dopuszczony. Podwójne kliknięcie otwiera jego kartę. *Spójrz poza oczywiste* w Observe może odkryć tajny projekt w pokoju szukającego (DC 18), co dopuszcza go do tego projektu.

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

Dwa modyfikatory: **Tylko po zmroku** (Wieczór, Noc albo dowolny Eclipse) i **Nie ten, kto ją zbudował** (domyślnie włączony). Pułapka uzbraja się, gdy pasek się zapełni. Gdy warunek pasuje, alarm idzie tylko do GMów - nazywa wyzwalacz, osobę, pokój i porę dnia, i niesie wpisany warunek zabójcy - z przyciskami **Właśnie odpaliła** (otwiera ekran morderstwa z wpisanym zabójcą i zaznaczonym *pośrednie*; ofiarę wybierasz ty) i **Nie ten - pilnuj dalej**. Nic nie trafia do wątku zabójcy.

> [!IMPORTANT]
> Pułapka, która przemówiła, rozbraja się, dopóki jej nie uzbroisz ponownie, więc pułapka w holu nie wysyła dwudziestu kart na sesję.

Wyzwalacz podłożonego przedmiotu działa przez **Podłóż przedmiot** na ukończonym projekcie: który obiekt jest pułapką i w którym pokoju czeka; przychodzi jako to, czego szukało następne udane Search w tym pokoju (o ile nie zostało przekierowane do czyjejś skrytki), a zatruta tożsamość żyje w rejestrze twojej przeglądarki, nigdy na przedmiocie.

---

## 12. Eclipse

`scripts/eclipse.mjs`, `ECLIPSE_MOVES`, `ECLIPSE_FREE_PLACEMENT`. Eclipse to okno ustawiania między dwiema porami dnia: gasną światła, nikt nikogo nie widzi, każdy przesuwa token tam, gdzie zastanie go następna pora dnia. Nazwany od pory dnia, którą *otwiera* - Eclipse nocny biegnie przed Nocą.

**Rozpoczęcie** (prawa strzałka na HUD albo **Zrób to** przy linii Dalej w panelu GMa): overflow sprawdzany dla nadchodzącej pory dnia; **akcje, Free Moves i zapasy Sprint/Burst są odnawiane tutaj** - to jedyne odnowienie; tutaj kończą się też pieczęcie, Chained i Silence, bo trwają tylko do końca pory dnia; karta ogłasza liczbę przejść; każdy gracz dostaje szeptem swój przydział i pokój; a każdy klient dostaje powiadomienie podsumowujące, co ten gracz zrobił w porze dnia, która właśnie minęła (GM dostaje podsumowanie całego stołu; gdy nic się nie wydarzyło, nie ma powiadomienia). Zwykły Eclipse pozwala na **2 przejścia między połączonymi pokojami**; Eclipse **nocny** pozwala każdemu wybrać dowolny pokój na mapie (losowanie Darkness cofa to do 2). Podczas Eclipse: działa tylko ruch; można zgłosić **Direct Murder** (wydaje akcję z nowego budżetu i czeka); Calle, przekazania, inne akcje, kafelek morderstwa i odkrycie ciała są odrzucane; muzyka przełącza się na playlistę Eclipse; każdy gracz jest we własnym kanale głosowym.

**Zakończenie**: **Zrób to** przy linii Dalej w panelu pokazuje tabelę ustawienia (kto ile razy przeszedł, gdzie stoi) z **Zakończ i przesuń zegar** (zwykła droga: przesuwa zegar, bez drugiego odnowienia) i **Zakończ bez przesuwania zegara**; przycisk odtwarzania na HUD kończy go i od razu przesuwa zegar. Potem zaparkowane Direct Murders są oceniane według tego, gdzie każdy faktycznie stanął: <ins>dokładnie jedna inna postać w pokoju zabójcy</ins> zostaje ofiarą, wszystko inne kończy się niepowodzeniem, a zabójca słyszy dlaczego, i tylko pierwsze ważne zgłoszenie otwiera incydent.

> [!IMPORTANT]
> Nic nie otwiera się bez ciebie: każde zgłoszenie w chwili złożenia wystawia w wątku zabójcy kartę **Pozwól** / **Odmów**, a o to, którego jeszcze nie rozstrzygnąłeś, jesteś pytany przy zapalonym świetle (zamknięcie tego okna oznacza odmowę); `game.drpg.ruleOnParkedMurder(killerId, true)` to skrót z konsoli, gdyby karta zginęła.

---

## 13. Silnik morderstwa od początku do końca

`scripts/murder.mjs`, `cleanup.mjs`, `chapter.mjs`; `config.mjs MURDER_OPENING`, `INCIDENT`, `CRISIS_ACTIONS`, `CLEANUP`, `INDIRECT_MURDER`. Moduł jest właścicielem liczb - progów, drenażu, kolejności tur, obrażeń, tego, jakie Remnants zostawia każdy wynik. Nie jest właścicielem prozy: zdanie każdego wyniku jest pokazywane tobie i uczestnikom do dokończenia przy stole. Czy zabójca jest we właściwym pokoju i czy etap trwał dość długo - to twoje.

### 13.1 Otwarcie

Dwie drogi. Gracz zgłasza **Direct Murder** podczas Eclipse (zgoda gracza ofiary to umowa przy stole, nie pole wyboru); zgłoszenie czeka i jest oceniane przy zapalonym świetle. Albo otwierasz je sam z **Sprawa > Morderstwo**: zabójca, ofiara i pole *pośrednie*, które zaznacza się samo, gdy ten zabójca ma ukończoną pułapkę. Jeden incydent naraz. Jedno nazwisko w obu polach otwiera śmierć z własnej ręki: Stage 4 wciąż rzuca, Stage 5 nie może biec, a incydent idzie prosto do Stage 6; śmierć zapisuje się, gdy zamkniesz incydent.

**Stage 4, rzut otwarcia.** Direct Murder otwiera się rzutem **zabójcy**: Body albo Hand przeciw **8**, z przewagą nocą.

| Rzut zabójcy | Co się dzieje | Key Remnants, które zostawi sprawa |
|---|---|---|
| Hope | incydent się zaczyna | **5** |
| Despair | zaczyna się; ofiara traci całe Sanity i Role reversal na ten incydent | **4** |
| Krytyk | zaczyna się; ofiara dowiaduje się, kto ją atakuje | **3** |
| Porażka | brak incydentu; ofiara nigdy nie dowiaduje się, że coś próbowano; akcja wydana | - |

Liczba ma minimum **3** (`KEY_REMNANTS.minimum`). Pułapka otwiera się rzutem **ofiary**: Eye albo Head przeciw **20**, z utrudnieniem nocą.

| Rzut ofiary | Co się dzieje |
|---|---|
| Hope | coś tu nie gra - może wydać swój Free Move, by się wydostać, a jeśli to zrobi, żyje (moduł nie daje dodatkowego Move) |
| Despair | rozumie, co zastawiono, i może powiedzieć innym; projekt zostaje aktywny |
| Krytyk | widzi pułapkę i czyje ręce ją zbudowały |
| Porażka | pułapka się zamyka |

Każdy sukces zostawia Evident Incident Remnant, a zauważona pułapka zostawia incydent zawieszony na otwarciu, dopóki nie zamkniesz go z trackera. Pułapka zawsze zostawia sprawie pełne 5 Key Remnants. Ofierze mówi się, że incydent się zaczął, dopiero gdy naprawdę się zaczyna.

### 13.2 Incydent (Stage 5)

Turowy, ofiara pierwsza; runda to ofiara, a potem po kolei każdy zabójca. Za każdym razem, gdy tura wraca do ofiary (pierwsza jest darmowa), kosztuje ją **1** Sanity (bezpośrednio) albo **2** (pośrednio, jest sama z pułapką), potem Health, gdy Sanity się skończy; krytyczne Self-defence zatrzymuje drenaż. Ofiara pułapki ma przewagę na każdym rzucie kryzysowym, a jej Leave a clue i Secure a trace mają Body zamiast Shadow i zostawiają Reinforced Remnants przy Hope tak samo jak przy krytyku (przy krytyku dwa). Uczestnicy rzucają na swoich oczach; nikt inny nie widzi. Akcje kryzysowe (`CRISIS_ACTIONS`), ze statystyką i progiem (gdzie podano kilka statystyk, tu i w Stage 4, rzuca się pierwszą; gracz, który chce innej, uzbraja *Resolve*):

| Strona | Akcja | Rzut | Co robi |
|---|---|---|---|
| obie | Use an item | Hand 15 | Wyjmij coś z kieszeni. Działa na krytyku albo sukcesie z Hope; z Despair - ślad i nic więcej; porażka z Despair kosztuje 1 dodatkowo |
| ofiara | Leave a clue | Hand/Leg/Shadow 12 | Remnant mający pomóc innym (Evident / Subtle / Obvious). Porażka z Hope daje przewagę przy następnej próbie |
| ofiara | Secure a trace | Hand/Leg/Shadow 15 | Zabierz coś zabójcy i zrób z tego ślad związany z jego tożsamością (te same widoczności) |
| ofiara | Self-defence | Hand/Leg/Body 18 | Walcz. Hope otwiera Survive i Role reversal; Despair tylko Role reversal; krytyk zatrzymuje drenaż, otwiera oba i jedno można wziąć w tej turze bez rzutu. Broń daje przewagę |
| ofiara | Survive | Leg 18 | Kończy incydent i drenaż. Despair dodaje wskazówkę, kim byli; krytyk dodaje nietykalność na ten i następny rozdział. Wymaga wcześniej Self-defence |
| ofiara | Role reversal | Hand/Leg/Body 15 | Zostań zabójcą. Hope przywraca też całe Health i Sanity; krytyk zabija napastnika od razu. Wymaga wcześniej Self-defence |
| zabójca | Strike | Hand/Leg/Body 15 | 1 Health i 1 Sanity z ofiary; krytyk: 2 do wyboru zabójcy. Porażka z Despair i tak zabiera 1 Sanity i zostawia ślad Evident |
| zabójca | Pin them down | Body 12 | Dwie tury utrudnienia na Leave a clue i Survive |
| zabójca | Keep your distance | Leg 12 | Dwie tury utrudnienia na Secure a trace i Role reversal |
| zabójca | Attack with a weapon | Body/Hand/Leg 15 | Obrażenia 1 + połowa Tieru broni zaokrąglona w górę (krytyk: 1 + Tier). Bez broni rzut z utrudnieniem, a sukces improwizuje broń (Tier 2 na Hope albo krytyku, 1 na Despair). Obrażenia rzeczy Tier 0 ustalasz ty, od 0 do 2 |
| zabójca | Finishing blow | Body/Leg/Hand | Próg to **5 razy pozostałe Health ofiary** - darmowy przy 0. Kończy incydent; Despair zostawia Incident Remnant; krytyk daje jedną darmową akcję w Stage 6 |
| trzecia | Escape together | Leg 15 | Oboje wychodzą; Hope albo krytyk przywraca ofierze zasoby; krytyk dodaje nietykalność na ten i następny rozdział; porażka: wychodzi tylko trzecia osoba |
| trzecia | Double role reversal | bez rzutu | Ofiara i trzecia osoba stają się zabójcami; pierwotny zabójca zaczyna krwawić |
| trzecia | Partners in crime | bez rzutu | Trzecia osoba dołącza do zabójcy |
| trzecia | Averted eyes | bez rzutu | Odejdź, bez śladu po tobie |

**Wejście na to.** W Direct Murder postać, której token wejdzie do pokoju, dostaje automatycznie jeden darmowy wybór spośród rozwiązań trzeciej osoby. **Czwarta osoba anuluje incydent** w miejscu: nikt nie ginie, nie ma Blackened, to, co już się stało, zostaje, a nowo przybyłemu nic się nie mówi. Ofiara, której skończą się Health i Sanity, ginie bez Finishing blow, i wtedy nikt nie zyskuje tego, co daje tam krytyk. Akcje rozwiązania (Survive, Role reversal, Escape together, Finishing blow) kosztują **1 Sanity** zamiast akcji, albo **1 Health**, gdy Sanity już nie ma; trzy wybory trzeciej osoby bez rzutu są darmowe. Nic tu nie zabija samo poza własnymi zakończeniami silnika.

> [!IMPORTANT]
> Niektóre wyniki z tabeli powyżej to proza, którą przekazujesz ty, a nie efekty nakładane przez silnik: przywrócenie ofiary po Escape together, nietykalność na ten i następny rozdział, wskazówka z Survive i śmierć napastnika przy krytycznym Role reversal (silnik zamienia strony, przywraca nowego zabójcę i zostawia ślad Evident Reinforced; śmierć zapisujesz ty).

**Tracker incydentu** (kafelek Morderstwo, gdy trwa) odświeża się na żywo i pokazuje, kto kogo atakuje (i ewentualną trzecią osobę), etap, turę, czyja strona działa, ile ofierze zostało i liczbę Key Remnants; w Stage 6 dokłada listę tylko do odczytu ze śladami w pokoju zabójcy, każdy z jego DC usunięcia. Jego przyciski: **Poproś o rzut otwarcia ponownie** (gdy otwarcie czeka, najwyżej raz na 10 sekund), **Oddaj turę** i **Zamknij morderstwo**. Nie ma ręcznego "ktoś wchodzi": jedyną drogą jest token wchodzący do pokoju. Stage 6 zaczyna się sam - po Finishing blow, gdy ofierze skończą się Health i Sanity, po udanym Survive albo Escape together, albo od razu po śmierci z własnej ręki - albo gdy oznaczysz ofiarę jako zmarłą przez **Postać umiera** i przyjmiesz pytanie, które się wtedy pojawi. Reroll gracza na akcji kryzysowej jest oceniany według zapisu, który trzyma tracker.

### 13.3 Sprzątanie (Stage 6) i Tamper

Gdy incydent kończy się ciałem, zabójca wreszcie widzi na arkuszu zostawione przez siebie Remnants i może nad nimi pracować. W jego własnym Stage 6 kosztuje to **zero akcji i 1 Sanity za każdy** (`RESOLUTION_STRESS_COST`), a każdy ślad w pokoju, w którym stoi, jest do jego dyspozycji, znaleziony czy nie. Przez kafelek **Tamper** w zwykłej grze (`PRICE_CHAINS.tamper`) kosztuje akcję albo 1 Sanity, gdy akcji już nie ma - nigdy oba - i sięga tylko śladów wymienionych przy Tamper w sekcji 5. Sprzątanie to rzut Shadow. Cleaning Tool w ręku daje przewagę i zdejmuje swój Tier z DC.

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

Porażka pozwala innym zobaczyć mniej więcej, co się dzieje. Użyte Murder Weapon zostaje oznaczone jako zepsute przy zamknięciu incydentu, a Cleaning Tools, które zabójcy trzymali w ręku - gdy ciało zostanie znalezione; jedno i drugie zostaje w torbie jako dowód, który zabójca musi wyrzucić albo schować do skrytki.

**Okno zdrady.** Wspólnik - trzecia osoba, która stanęła po stronie zabójcy - może się na niego obrócić: oferta trwa do końca tego dnia, przeżywa zamknięcie incydentu, jest jednorazowa i nie można z niej skorzystać, gdy trwa inna walka. Otwiera drugi incydent z ciałem wciąż na podłodze. Ekran po incydencie u zabójcy też ma ten przycisk.

### 13.4 Po incydencie i odkrycie ciała

Zamknięcie morderstwa zapisuje **Blackened** (każdego zabójcę rozdziału, ze zdrajcą włącznie), oznacza użytą broń jako zepsutą i otwiera ekran po incydencie, "Incydent zakończony - co teraz": **Znaleziono ciało** (ogłoś), **Przejdź do Investigation**, **Wydaj Autopsy Truth Bullet**, zdrada, jeśli jest w ofercie. Przypomina też, ile Key Remnants trzeba jeszcze postawić, i o wydaniu sekcji.

**Odkrycie ciała** dzieje się samo, gdy w pokoju z ciałem z tego rozdziału stoi co najmniej dwóch uczniów, w tym co najmniej jeden <ins>niezwiązany z zabójstwem</ins> - ani zapisany Blackened, ani zabójca trwającego incydentu, który wciąż sprząta w Stage 6 (zabójcy nad własną ofiarą to wrabianie, nie odkrycie; Monokumy i zmarli z tego rozdziału nie są świadkami, Monocub jest), nigdy podczas Eclipse - albo przyciskiem **Znaleziono ciało**. Najpierw pyta cię, które Faint ślady Prep należą do tego morderstwa (stają się trwałymi dowodami), oznacza narzędzia do sprzątania zabójców jako zepsute, zwołuje wszystkich do pokoju, ogłasza ciało stołowi z dźwiękiem, wstrzymuje muzykę i potem **czeka**.

> [!IMPORTANT]
> Faza zostaje Daily Life, dopóki nie rozpoczniesz Investigation z linii Dalej albo z ekranu po incydencie. Zmiana pory dnia kończy tylko ciszę.

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

Typy Truth Bullets są ich lustrem. Każdy Remnant zaczyna jako token z jedną neutralną nazwą i obrazkiem "?" (po pierwszej kopii nosi nazwę, którą mu nadałeś); GM widzi ikonę akcji, która go zostawiła (Search, projekt, sabotaż, akcja dynamiczna, sprzątanie, incydent, wyrzucenie, postawienie przez GMa, zabranie z ciała), gracz dopiero, gdy jego własna kopia zostanie rozpoznana, a podwójne kliknięcie Remnantu otwiera jego kartę śladu.

**Pulpit Investigation** (Sprawa > Investigation) to żywa teczka sprawy:

| Zakładka | Co robi |
|---|---|
| **Ślady** | wymienia każdy Remnant z filtrami (po graczu, pokoju i rozdziale), pozwala edytować nazwę, tekst dla gracza i tekst analizy, poprawić typ i oznaczyć go jako Faint, powiązany ze zbrodnią albo Reinforced |
| **Key Remnants** | planer |
| **Final Truth Remnants** | stawia Final Truth Remnants |
| **Kto co ma** | pokazuje Truth Bullets każdego ucznia, ile jeszcze nie przeanalizowano i czym są naprawdę |

Stopka ma **Nowy ślad** (ślad dowolnego rodzaju, w dowolnym pokoju), **Wyczyść Faint Remnants**, **Zbierz Truth Bullets**, sekcję, dziennik dowodów Class Trial i ciało.

**Key Remnants** (`KEY_REMNANTS`). Przygotowujesz **5** tropów na rozdział, w skali Trivial, Standard, Standard, Complex, Desperate; rzut otwarcia decyduje, ile sprawa zachowa (5, 4 albo 3; pułapka zachowuje wszystkie 5), nigdy poniżej **3**. Razem mają zawęzić podejrzanych do **2 do 4** osób - ostatni krok od kręgu do nazwiska należy do Class Trial. Każdy wiersz planera ma nazwę i tekst dla gracza (co dostaje znalazca), tekst analizy (co ujawnia Analyze), twoją prywatną notatkę, pokój i widoczność; **Utwórz na mapie** stawia go w losowym miejscu wewnątrz pokoju jako Reinforced i powiązany ze zbrodnią. Karta z prośbą gracza ("patrzę na okno") ma **Utwórz tu Key Remnant**, który może wypełnić jeden z pięciu wierszy.

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

**Sekcję** wydajesz z pulpitu albo z ekranu po incydencie zaznaczonym uczniom: nazwa, co gracz czyta, twoja notatka. Klucz odpowiedzi za każdym bulletem żyje tylko w przeglądarkach GMów i synchronizuje się między nimi; `game.drpg.exportLedger()` i `importLedger()` robią kopię i ją przywracają.

---

## 15. Class Trial

`scripts/trial-floor.mjs`, `trial-floor-ui.mjs`, `trial.mjs`, `vote.mjs`; `config.mjs TRIAL`. Jedne drzwi: **Sprawa > Class Trial**, konsola czytająca rozprawę od góry do dołu i nigdy nie chowająca sekcji.

1. **Zacznij Class Trial.** Przesuwa fazę, rozdaje akcje pory dnia (zbankowane Sprint i Burst zostają; późniejsze debaty rozprawy niczego nie odnawiają), zeruje zapis rozprawy tego rozdziału, nalicza nieznalezione Key Remnants, ogłasza. Class Trial otwiera się **dyskusją**: mówią wszyscy, dowody trafiają na stół bez przejmowania głosu. Dopóki trwa rozprawa, otwarty zostaje tylko kafelek Analyze (z Przedstaw, Hope Calls i przedmiotami), nikt nie przechodzi między pokojami, a Despair Calls i Confusion Monocuba są zablokowane; Analyze albo Objection kosztuje akcję, potem 1 Hope, potem 1 Sanity.
2. **Otwórz debatę** z budżetem w sekundach (domyślnie **180**, zapamiętywany w obrębie rozprawy). Przekroczenie zmienia zegar debaty (na karcie Class Trial w panelu zdarzeń) na czerwony i niczego nie kończy; kiedy spór się skończył, decydujesz ty. Od tej chwili przedstawienie Truth Bulleta to **OBJECTION**: objektor sam ma głos przez **60 sekund**, potem osoba, w którą wymierzono objection, odpowiada w **rebuttal** przez **120 sekund** dla tej dwójki, po czym głos sam wraca do otwartej dyskusji - zegar debaty nie rusza od nowa; otwórz kolejną debatę, gdy sala jej potrzebuje. Cisza jest społeczna, nie techniczna: moduł nikogo nie wycisza, tylko czyni stan jednoznacznym na każdym ekranie i odmawia przycisku Objection każdemu, dla kogo nie jest. Ręczne nadpisania: **+30 sekund** (liczone od teraz, jeśli zegar już się skończył), **Zakończ ten tryb teraz**, **Z powrotem do debaty**. **Zamknij debatę** wraca do dyskusji przy trwającej rozprawie. `game.drpg.objectionLog()` wymienia wszystko przedstawione w tym rozdziale.
3. **Głosowanie.** Karty idą do graczy każdego żyjącego ucznia (zmarli nie głosują, `deadCastBallots: false`); karta pozwala wskazać siebie, Monokumę albo zmarłych. Liczba wymaganych nazwisk to liczba Blackened zapisanych w tym rozdziale. Karty nigdy nie dotykają danych świata: idą do GMów, są liczone w pamięci i publikowane są tylko sumy. Konsola pokazuje, kto jeszcze nie głosował; **Wyślij kartę ponownie** wysyła im świeżą kartę; **Zacznij głosowanie od nowa** wyrzuca oddane karty i najpierw ostrzega. **Zamknij i policz** publikuje wynik. Skazanie wymaga **więcej niż połowy rozesłanych kart** (połowa zaokrąglona w dół plus jeden); poniżej tego, albo gdy nad kreską remisuje więcej nazwisk, niż jest Blackened, wynik jest remisem, a remis liczy się jak błędny głos, chyba że stół to rozstrzygnie.
4. **Werdykt.** Okno mówi, kogo rejestr zapisał jako Blackened, pyta, kto zostaje stracony, jeśli klasa się pomyliła, i czy trafili. Trafnie: Blackened straceni, a każdy ocalały dostaje **Standard Level Up** (1 wybór). Błędnie: oskarżony stracony, każdy żyjący Blackened zostaje anonimowy i w grze z **Reinforced Level Up** (3 wybory) i jedną **nową zasadą** własnego wyboru (ty ją wpisujesz; ogłaszana bez nazwiska), a pula każdego Monokumy jest **napełniana do 12**. Oba werdykty opróżniają overflow. Okna Level Up otwierają się na twoim kliencie, po jednym na postać: +1 maks. Health, +1 maks. Sanity, +1 do statystyki, +1 do doświadczenia albo nowe doświadczenie na +2. Level Up można też przyznać z arkusza postaci, gdzie decydujesz, co zostało zdobyte (Standard albo Reinforced) i czy wybierasz ty, czy gracz: wtedy jego przycisk Level Up świeci się na złoto, a klient głównego GMa sprawdza jego wybór z ofertą, zanim go zapisze.
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

Plan Key Remnants jest archiwizowany pod swoim rozdziałem, zanim zegar się przesunie, rejestr Blackened jest czyszczony, a stara karta ciała nie przecieka do następnego rozdziału. Jeśli drugi GM naciśnie go, gdy pierwszy już przesunął rozdział, słyszy, że rozdział został już zakończony, i nic nie dzieje się dwa razy. Notka przypomina, czy w tym rozdziale postawiono Final Truth Remnant. **Rozdział 6 jest ostatnim w sezonie:** tam pole przejścia do następnego rozdziału startuje odznaczone i mówi o tym ostrzeżenie; zamiast przechodzić do 7, zresetuj.

**Zresetuj sezon** (czerwony kafelek) wymazuje sezon i zachowuje obsadę: wymienia dokładnie, co znika, z liczbami - projekty, Remnants, Truth Bullets i klucz odpowiedzi, plan Key Remnants, które pokoje odkryła każda postać i które skrytki znalazła, śmierci i Monocuby, każdy noszony albo schowany przedmiot, każdy Level Up i to, co kupił, każdą kartę modułu i każdy wątek komunikatora, notatki, pule do zera i Hope z powrotem do 2, drzwi do stanu z otwarcia sezonu, incydent, Masterminda, rozprawę, Search Tokens, obowiązujące Calle, Motive, zasady killing game, zwołane zgromadzenie, overflow, reszta dziennika czatu i zegar na rozdział 1, dzień 1, rano z odnowionymi akcjami wszystkich. Każda z tych rzeczy to jedna z **29** grup do zaznaczenia w pięciu sekcjach (Sprawa, Obsada, Plansza, Dziennik, Świat), domyślnie wszystkie zaznaczone; odznacz którąś, a reset jej nie ruszy; wybór zostaje zapamiętany i przy następnym resecie wraca odznaczony.

**Co zostaje:** obsada z nazwiskami, portretami i Ultimate, mapy, pokoje i ich właściciele, kto kogo pilnuje, zespół Monokum, nazwa kampanii.

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

Nikomu innemu nie mówi się kto. Panel zdarzeń trzyma kartę "Scena zatrzymana", bez nazwiska, tak długo, jak gra stoi na pauzie.

> [!CAUTION]
> Nie ma pola powodu ani celu: scena jest zatrzymywana, nie składa się oskarżenia. Wyjaśnijcie sprawę z tą osobą, potem wznówcie od punktu, na który wszyscy się zgodzą.

**Notatka przed sesją** w komunikatorze (siedem pytań, na które gracz odpowiada przed każdą sesją: czy zamierza zabić, czy jest otwarty na śmierć, zgoda na tortury albo romans, triggery, jak chce grać, jaki duży projekt planuje) to druga połowa tego samego; czytaj je, zanim zdecydujesz o zgodzie na morderstwo.

---

## 20. Rozwiązywanie problemów

Wszystko jest pod `game.drpg` w konsoli przeglądarki; argumenty aktora przyjmują dokument, id albo nazwę.

**Zestaw testów regresji.**

| Wywołanie | Co robi |
|---|---|
| `game.drpg.runTests()` | uruchamia wszystko |
| `game.drpg.runTests({ tier: 1 })` | uruchamia regresje źródła i niezmienniki tylko do odczytu; bezpieczne w trakcie gry - na końcu sprawdza, czy nic w świecie się nie ruszyło, i mówi co, jeśli jednak tak (liczy się też gracz, który coś zrobił w trakcie) |
| `game.drpg.runTests({ tier: 0 })` | czyta wyłącznie własne źródło modułu |

> [!CAUTION]
> **Tier 2 zapisuje** - otwiera incydenty, zabija ludzi i resetuje sezony na własnych, sprzątanych po sobie fixture'ach - więc nigdy nie uruchamiaj domyślnego w świecie, w którym ktoś gra; jego scenariusze potrzebują co najmniej trzech żyjących uczniów, tier 2 jest odrzucany, gdy incydent jest otwarty, a drugie uruchomienie na tym samym kliencie jest odrzucane, dopóki pierwsze trwa.

Wynik to licznik "passed, failed, skipped", a po nim linie `ok`, `FAIL` i `skip`; skip to test, który powiedział, czego brakuje środowisku, nigdy wynik, który wyszedł źle.

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

**Despair i kości.** `diagnoseDespair()` i `diagnoseDice()`; `diagnoseCharacters()` to raport ustawienia obsady. Despair, który nie dochodzi, to zwykle brak połączonego głównego GMa, wyłączone *rzuty dają Despair* albo rzut reakcji.

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
| *Gracz mówi, że klient GM-a odrzucił zmianę Daggerhearta.* | Jego funkcja Daggerhearta poprosiła o coś, co ta gra zostawia GM-owi (obszar na mapie, nowe odliczanie, Health innego ucznia). Ostrzeżenie na twoim ekranie mówi, o co; zrób to ręcznie. |
| *Koszt Daggerhearta u gracza nie wszedł, gdy GM przeładowywał stronę.* | Przy dwóch GM-ach zmiany Daggerhearta za graczy robi tylko główny; wysłana w chwili jego przeładowania może przepaść. Ustaw ręcznie. |
| *Czat mówi, że Daggerheart poprosił o zmianę od nadawcy, którego Foundry nie wskazało.* | Każda taka zmiana jest odrzucana. Jeśli Hope, Stress albo Fear graczy przestają się ruszać przy rzutach, to dlatego: daj znać autorowi modułu, z wynikiem `game.drpg.relayGuard()`. |
| *Drzwi zostają zamknięte po resecie sezonu.* | Reset przywraca kolumnę "zaczyna zamknięte" z zakładki Drzwi. |

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
- Skopiuj Dziennik debugowania, jeśli coś nie działało. Zapisz, czego potrzebuje następny rozdział.
