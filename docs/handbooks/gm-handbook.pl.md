# Danganronpa RPG - Podręcznik GM

*Dla modułu „Danganronpa RPG” do Foundry VTT v14, wersja 1.2.112, zbudowanego na systemie Daggerheart.*

To podręcznik dla osób prowadzących killing game. Rozdziały idą w kolejności, w jakiej przygotowuje się i rozgrywa sezon: instalacja, ustawienie, prowadzenie dnia, morderstwa, Investigation i Class Trial, koniec rozdziału i start od nowa. Tam, gdzie decyzja należy do GM-a, a nie do modułu, tekst mówi to wprost.

> [!NOTE]
> Każda liczba w tym podręczniku pochodzi z kodu modułu, większość z jego pliku reguł. Jeśli któraś zasada wyda się sprzeczna z tym, co widać przy stole, autorytetem jest kod, a ten podręcznik jest do niego komentarzem. Nazwy plików, wywołania konsoli, identyfikatory testów i historia wersji są w uwagach technicznych, w sekcji 22.

Słownictwo gry zostaje po angielsku w każdym języku, w jakim mówi moduł: Hope, Despair, Sanity, Health, Truth Bullet, Remnant, Key Remnant, Blackened, Class Trial, Daily Life, Eclipse, Mastermind, Monokuma, Monocub, Ultimate, nazwy Calli i nazwy akcji. To nazwy własne tej gry. Stash i vault to za to zwykłe słowa, więc po polsku mówimy skrytka i sejf. Gdy podręcznik mówi o „przewodniku”, ma na myśli własny podręcznik zasad gry, *Danganronpa RPG System - Full Guide*, według którego gra moduł.

---

## 1. Instalacja i zależności

Instaluj z zakładki **Add-on Modules** w Foundry przez **Install Module** i ten adres manifestu:

```
https://github.com/Akrobacjum/Danganronpa-RPG/releases/latest/download/module.json
```

Potem zainstaluj system i poniższe moduły z ich własnych stron. Moduł nigdy niczego nie instaluje sam. „Wymagany” oznacza, że moduł musi być zainstalowany i włączony; nic nie sprawdza, czy serwer LiveKit odpowiada.

| Wymaga | Wersja |
|---|---|
| Foundry VTT | 14.364 lub nowsza (sprawdzone na 14.365) |
| Daggerheart (Foundryborne) | 2.6.5 lub nowsza (sprawdzone na 2.12.8; nowsza wersja się ładuje, a każdy GM dostaje ostrzeżenie przy każdym wczytaniu, dopóki nie zaznaczy, żeby na tym komputerze nie wspominać już o tej wersji) |

| Moduł | Status | Po co |
|---|---|---|
| Dice So Nice! | wymagany | Każdy rzut pada jako kości 3D, które widzą tylko osoby uprawnione do tego rzutu, w jednym stylu kości, który GM ustawia dla stołu |
| Isometric Perspective | wymagany | Mapy rysowane do gry izometrycznej wyglądają źle na płaskiej siatce |
| LiveKit AVClient | wymagany | Głos zależy od pokoju: słyszysz osoby z pokoju, w którym jest twoja postać, a przejście do innego pokoju zmienia, kto cię słyszy |

**Gdy brakuje wymaganego modułu**, moduł nie startuje. GM dostaje okno **Danganronpa RPG nie działa**, które przy każdym brakującym module pisze „niezainstalowany” albo „zainstalowany, ale wyłączony” i podaje powód, w języku tej przeglądarki; gracz dostaje powiadomienie, które zostaje na ekranie. Zainstaluj albo włącz to, co wymienia okno, i wczytaj świat ponownie.

Z modułu, który nie wystartował, nic nie działa: żaden jego wygląd, ustawienie ani pilnowanie nie wchodzi w życie, a pasek skrótów, nawigacja scen i lista graczy stoją tam, gdzie rysuje je Foundry. To, co moduł zmienił w Foundry, gdy działał wcześniej, zostaje tak, jak to zostawił, dopóki nie zadziała znowu i nie naciśniesz **Oddaj ustawienia Foundry** (sekcja 1.2).

Moduł nie używa libWrapper. Jeśli Isometric Perspective kiedyś będzie go potrzebować, powie o tym strona tamtego modułu. Moduł powstał na The Forge i tam był grany, a na każdym hoście Foundry v14 działa tak samo.

**Inne tokeny są przygaszone na ekranie gracza.** Robią to dwa ustawienia spoza modułu, których moduł nie zmienia. *Enable Occlusion: Dynamic Tile* w Isometric Perspective rysuje nad mapą kopię własnego tokenu gracza, więc jasny zostaje tylko jego token. Inne tokeny przygasza też ciemność sceny, gdy jej światło globalne nie jest jasne.

### 1.1 Start świata

Załóż świat na systemie Daggerheart, włącz moduł i jego zależności i wczytaj świat jako GM. Dopóki świat nie ma nazwy kampanii ani uczniów, pierwsze wczytanie GM-a otwiera **Od czego zacząć**, raz w przeglądarce każdego GM-a. Okno mówi *Zacznij tutaj: panel GM-a > Ustawienia sezonu.*, a jego przycisk **Ustawienia sezonu** otwiera to okno. Panel GM-a to czerwony przycisk z okiem w prawym dolnym rogu, nad zębatką. Wszystkie kroki od pierwszego wczytania do pierwszego Eclipse robisz w oknach modułu:

1. **Ustawienia sezonu** (sekcja 2) otwierają się na górze, na polach Edytuj kampanię, z kursorem w nazwie kampanii. Nazwij kampanię i naciśnij **Zapisz**, utwórz uczniów, a dla każdego Monokumy utwórz postać i oznacz ją jako Monokumę (sekcja 8).
2. Otwórz **Listę kontrolną sezonu**, ostatni kafelek na dole Ustawień sezonu, i przejdź jej wiersze po kolei. Każdy wiersz mówi, co sprawdził, a przy wierszu, w którym może pomóc, stoi przycisk, którego nazwa mówi, co zrobi: **Nadaj zasoby startowe**, **Ukryj kursor GM-ów**, **Zamień na przejścia**, **Ukryj** albo **Otwórz**.
3. Narysuj pokoje i oznacz je (sekcja 9.1), potem naciskaj **Sprawdź pokoje na tej scenie** w wierszu pokoi na liście, aż kontrola nie znajdzie problemu; to, co może znaleźć, wymienia sekcja 2. Wiersz pokoi rysuje się na nowo, gdy tylko kontrola się skończy.
4. Przeczytaj **dalsze sprawdzenia** na dole Listy kontrolnej sezonu i popraw to, co wymieniają (sekcja 2).
5. Przeczytaj, co moduł zmienia w Foundry (sekcja 1.2).

**Linia Dalej.** Dopóki nie są spełnione wszystkie wymagane wiersze, linia **Dalej** w panelu GM-a zaczyna się od *Do ustawienia:* i podaje pierwszy wiersz, który został do zrobienia, a **Lista kontrolna sezonu** obok niej otwiera listę. Przed spełnieniem wszystkich wymaganych wierszy linia Dalej nigdy nie proponuje Eclipse. Pokoje ocenia na scenie szkoły, na jakąkolwiek scenę patrzysz, i nie czeka na wiersz, którego moduł nie może za ciebie dokończyć: wiersz sekretu serwera głosu (sekcja 2) zostaje na liście skreślony. Gdy wymagane wiersze są spełnione albo gdy sezon już ruszył, choćby z niezrobionym wierszem, linia Dalej prowadzi przez dzień (sekcja 3, linia Dalej, punkty 10 i 11).

### 1.2 Co moduł zmienia w Foundry i jak to oddać

Póki działa, moduł trzyma te ustawienia Foundry, Daggerheart i modułów, których potrzebuje. Ustawienie, które moduł trzyma, nie pojawia się w Configure Settings, a zmiana wprowadzona w nim mimo to jest cofana. Moduł zachowuje wartość, jaką każde z tych ustawień miało, zanim pierwszy raz je zmienił.

| Co moduł trzyma | Jego przełącznik w ustawieniach gry |
|---|---|
| Automatyki Vulnerable i Defeated z Daggerheart są wyłączone, a zastępują je Breakdown i Wounded; gdy moduł wyłącza je pierwszy raz, GM-owie dostają o tym szept | Nie ma przełącznika |
| Gracze i Zaufani gracze nie przeglądają ani nie wysyłają plików | *Bez przeglądarki plików dla graczy* (sekcja Foundry i system; sekcja 1.3) |
| Okno powitalne Isometric Perspective zostaje zamknięte u wszystkich | *Trzymaj okno powitalne Isometric Perspective zamknięte u wszystkich* (sekcja Foundry i system) |
| Dziennik powitalny Daggerheart nie otwiera się nikomu | *Trzymaj dziennik powitalny Daggerheart zamknięty u wszystkich* (sekcja Foundry i system) |
| Głos LiveKit zostaje w oknie Foundry u wszystkich | *Głos w oknie Foundry u wszystkich* (sekcja Foundry i system) |
| Dok kamer Foundry jest zwinięty, gdy działa kafelek głosu, i żadna kamera nie wyskakuje w osobnym oknie | *Kafelek głosu zamiast doku kamer* (sekcja Głos) |
| Na scenach z pokojami własne widzenie, mgłę i globalne światło Foundry przejmują pokoje | *Pokoje decydują, co widzą gracze*: jego wyłączenie oddaje scenom widzenie, mgłę i światło |

**Wygląd kości.** *Wygląd kości przy stole* ma trzy wybory, a jeśli nie masz pewności, zostaw domyślny. Przy *Każdy gracz własny* moduł niczego nie zapisuje i każdy rzuca kośćmi, które sam ustawił. Przy *Wszyscy: Dice So Nice*, domyślnym, każdy gracz i Asystent GM-a rzuca kośćmi Dice So Nice w wyglądzie jednego pełnego Gamemastera, ustalonym, gdy gra pierwszy raz działa z tym ustawieniem, razem z wyglądami ról tego Gamemastera z Dice Roles w Dice So Nice, a własny wygląd roli, na sobie albo na swojej postaci, zostaje zastąpiony wspólnym. Na Daggerheart 2.9 i starszym każda kość Hope i Despair na każdym ekranie ma też wygląd, który ten Gamemaster ustawił w ustawieniach Dice So Nice samego Daggerhearta, kto by nią nie rzucał. *Wszyscy: Daggerheart* działa tak samo jak *Wszyscy: Dice So Nice*, a na Daggerheart 2.10 i nowszym każda kość Hope, Despair, przewagi i utrudnienia na każdym ekranie ma własne kolory Daggerhearta (żółty Hope, niebieski Despair, zielona przewaga, czerwone utrudnienie), kto by nią nie rzucał, także GM. Gracz, którego przeglądarka nie rysuje kości Dice So Nice, nie widzi kości 3D przy żadnym wyborze, bo Daggerheart nie rysuje własnych.

Przy jednym wyglądzie dla stołu wspólny wygląd nie ma efektów specjalnych poza tymi, które któryś Gamemaster oznaczy jako globalne, a późniejsze zmiany tego wyglądu, których dokona pełny Gamemaster, docierają do wszystkich. Wygląd, który gracz albo Asystent GM-a wybierze w Dice So Nice dla siebie albo na swojej postaci, a Asystent GM-a także na tamtym Gamemasterze, zostaje zastąpiony wspólnym. Gracz, który wybrał wygląd dla siebie albo na swojej postaci, raz na sesję czyta *Twój wygląd kości ustala GM.*, a wygląd Asystenta GM-a na tamtym Gamemasterze nikomu tego nie mówi. Pełni Gamemasterzy zachowują własny wygląd, a każdy zachowuje własne ustawienia wyświetlania i wydajności. Przełączyć wygląd kości albo wskazać, czyj to wygląd, może tylko pełny Gamemaster: zmiana jednego albo drugiego przez Asystenta GM-a jest cofana, a główny GM dostaje o tym wiadomość (główny GM to połączony pełny Gamemaster z najniższym identyfikatorem użytkownika, sekcja 6.3). Oddanie ustawień Foundry nie zmienia wyglądu kości, a ani ono, ani wyłączenie wspólnego wyglądu nikomu nie przywraca jego dawnego wyglądu, bo moduł nigdy go nie zachował.

**Oddaj ustawienia Foundry** to przycisk w ustawieniach gry (kafelek **Ustawienia gry** w panelu GM-a), w sekcji Foundry i system, dla użytkowników, którzy mogą zmieniać ustawienia świata. Okno wymienia te same zmiany. **Oddaj je** zapisuje zachowane wartości z powrotem, każda przeglądarka swoje, i od tej chwili moduł tych ustawień nie rusza, a **Przejmij je znowu** pozwala mu znów je trzymać. **Oddaj je** może nacisnąć tylko pełny Gamemaster, a Asystent GM-a czyta, dlaczego nie może. Część, której zapisu Foundry odmówi, zostaje zachowana, a okno znów proponuje dla niej **Oddaj je**. Przycisk nie rusza widzenia, mgły i światła scen: oddaje je wyłączenie *Pokoje decydują, co widzą gracze*.

Dwóch starych wartości może brakować. Gdy uprawnienia do plików odebrała wersja modułu, która nie zachowywała starej wartości, nie ma czego oddać: okno to mówi, a uprawnienia nadajesz znów w uprawnieniach Foundry. Gdy automatyki Daggerheart wyłączyła wcześniejsza wersja, wartości sprzed modułu także nie są znane: okno mówi to wprost, a **Oddaj je** ustawia domyślne wartości Daggerheart (obie włączone).

> [!IMPORTANT]
> **Zanim wyłączysz moduł**, naciśnij **Oddaj je** w oknie Oddaj ustawienia Foundry i wyłącz *Pokoje decydują, co widzą gracze*. Wyłączony moduł niczego nie zapisuje, więc to, co trzymał, zostaje, dopóki tego nie oddasz. **Gdy włączysz go znowu**, dalej niczego nie trzyma: GM jest o to pytany przy każdym starcie, Lista kontrolna sezonu pokazuje wiersz *Moduł trzyma ustawienia Foundry*, a Kontrola przed sezonem mówi, że moduł niczego nie trzyma, dopóki nie naciśniesz **Przejmij je znowu**.

### 1.3 Ustawienia modułu warte znajomości

Ustawienia modułu są w dwóch miejscach. Ustawienia gry to wszystko, co zmienia stół dla wszystkich: otwiera je kafelek **Ustawienia gry** w panelu GM-a, w sekcji Między sesjami, a otworzy je tylko GM, który może zmieniać ustawienia świata. Wybierz sekcję po lewej, zmień, co chcesz, i naciśnij **Zapisz zmiany**; linia pod każdym ustawieniem mówi, co zmienia, a dymek mówi resztę. Ustawienia tej przeglądarki, czyli język, motyw, wygląd, efekty, głośność, dźwięki komunikatora i głos, to okno zębatki, takie samo dla GM-a i gracza; są też w Configure Settings, w Ustawieniach DRPG (sekcja 18).

W ustawieniach gry warto znać te:

- *Wymuszaj prywatne rzuty graczy*: gdy jest włączone, każdy rzut jest szeptem. Rzut z akcji idzie tylko do GM-ów, a rzucający czyta swój; statystyka kliknięta na arkuszu idzie do GM-ów i gracza tej postaci. Z Dice So Nice 6.0 lub nowszym kości padają tylko na ekranach osób, które mogą zobaczyć ten rzut, a w walce incydentu na ekranach jej uczestników; ustawienie *Hide 3D dice on secret rolls* samego Dice So Nice tego nie zmienia. Starszy Dice So Nice rozstrzyga, gdzie padają kości, własnym ustawieniem.
- *Bez przeglądarki plików dla graczy*: Gracze i Zaufani gracze nie przeglądają ani nie wysyłają plików, a kliknięcie portretu nic im nie otwiera. Przy pierwszym starcie GM-owie dostają kartę z tym, co to ustawienie odebrało. Jego wyłączenie tego nie przywraca; przywraca to **Oddaj ustawienia Foundry** (sekcja 1.2). Dopóki jest włączone, zmiana tych dwóch uprawnień w oknie Foundry jest cofana, a GM-owie dostają o niej wiadomość. Konto, któremu dasz przeglądarkę plików imiennie, ją zachowuje.
- *Anonimowe arkusze postaci*: cudzy arkusz otwiera się ocenzurowany.
- *Statystyki graczy bez zatwierdzania* to ustawienie domyślnie wyłączone (sekcja 5).
- *Frisk: zmuszanie po odmowie* jest domyślnie włączone. Gdy je wyłączysz, otwarty Frisk tylko pyta, a odmowa albo brak odpowiedzi kończy Frisk (sekcja 10.5).
- Dalsze ustawienia gry to *Wygląd kości przy stole* (sekcja 1.2), *Search Tokeny na pokój*, *Zablokuj graczom okno rzutu*, *Gracze widzą tylko osoby w swoim pokoju*, *Pokoje decydują, co widzą gracze* (mgła pokoi), *Zablokuj graczom zasoby na arkuszu*, *Przejście między pokojami kosztuje Move*, *Rzuty dają Despair*, *Zastąp licznik Fear z Daggerheart*, *Chroń edycję tokenów przed Isometric Perspective*, *Trzymaj dziennik powitalny Daggerheart zamknięty u wszystkich* i *Głos osobno w każdym pokoju*.

*Muzyka podąża za stanem gry* i *Różnicuj dźwięki, które słychać często* to przełączniki w oknie Dźwięk (sekcja 17). Domyślne wartości pokazują, jak ta gra ma działać; przełączniki są po to, żeby stół mógł któryś kawałek prowadzić ręcznie, gdy zechce.

> [!IMPORTANT]
> Oprócz ustawienia *Statystyki graczy bez zatwierdzania* dwa z tych ustawień są na starcie wyłączone, bo każde najpierw czegoś od ciebie potrzebuje: *Muzyka podąża za stanem gry* (playlisty zmapowane w oknie Dźwięk) i *Głos osobno w każdym pokoju* (LiveKit AVClient i działający serwer).

### 1.4 Konta graczy

Nazwij konto każdego gracza dokładnie tak jak jego ucznia, a przy pierwszym starcie uczeń zostanie postacią gracza, a gracz Właścicielem arkusza ucznia, jeśli nie jest nim już inny gracz. Wielkość liter, polskie znaki, dodatkowe spacje i spacje na początku albo na końcu nazwy konta nie mają znaczenia, ale brakująca spacja ma, a część imienia nie wystarczy. Postać przypisana albo wyczyszczona przez ciebie ręcznie zostaje taka, jak ją ustawisz, także gdy gracz uruchomi grę ponownie; w nowym sezonie konto bez postaci zostaje dopasowane od nowa. Gdy żaden uczeń nie nazywa się tak jak konto albo nazywa się tak więcej niż jeden, gdy dwa konta nazywają się tak samo, gdy uczeń należy już do innego gracza albo gdy konto jest już Właścicielem innego ucznia, nic nie zostaje przypisane, a GM-owie dostają kartę z nazwami kont.

**Uczeń z dwoma właścicielami.** Gdy drugi gracz jest Właścicielem arkusza ucznia, prywatne karty do tego ucznia, czyli odpowiedź z Listen, znalezisko, linia decyzji i karta tajnego przejścia, trafiają do obu graczy i do GM-ów. Tak samo trafiają do nich rzuty ucznia, gdy rzuty są wymuszone jako prywatne, to, co słychać w pokoju ucznia, słowo sprzątania do świadków oraz karty incydentu i własne słowa ofiary przy jego zamknięciu. Gracz z uprawnieniem Obserwatora albo Ograniczonym do arkusza nie czyta żadnej z tych kart.

Wątek komunikatora należy do jednego konta. Pytanie, które zadaje jeden z właścicieli i na które czeka, czyli Call, Dynamic Action, statystyka z kilku, które rzut wymienia, i Observe na punkt zainteresowania, ląduje w wątku tego właściciela. Pozostałe karty decyzji o uczniu (Search na coś konkretnego, podpowiedź z Analyze, przedmiot Tier 0, projekt) i notki, które decyzja wysyła po nich, lądują w wątku jednego właściciela: pierwszego połączonego, a gdy nikt nie jest połączony, pierwszego.

### 1.5 Aktualizacja modułu

Przed instalacją aktualizacji, która przenosi dane, skopiuj świat: kopią zapasową świata w Setup Foundry albo kopią folderu świata. Jeśli aktualizujesz z wersji starszej niż 1.2.64, skopiuj świat najpierw, a po pierwszym wczytaniu naciśnij **Zrób kopię** w kafelku **Sprawa** (panel GM-a, Diagnostyka; sekcja 14.8). Nic nie zostaje usunięte z danych świata, zanim nowy magazyn tego nie odczyta z powrotem. Krok, którego nie da się dokończyć, zostawia świat bez zmian i mówi o tym w komunikacie, który zostaje na ekranie, a przy następnym wczytaniu świata próba się powtarza.

> [!WARNING]
> Nie wracaj do 1.2.63 po 1.2.64. Wersja 1.2.63 czyta dane świata, które 1.2.64 opróżniła, więc pułapki tracą zabójcę i wyzwalacz, notatki, plan Key Remnantów i licznik overflow są puste, gracze przestają widzieć znalezione Remnanty, a to, co zabrano z każdego ciała, zostaje zapomniane.

To, co 1.2.63 i 1.2.64 przeniosły z danych świata, jak zapisać stary magazyn przeglądarki do pliku i co zawiera świat skopiowany przed aktualizacją, opisuje sekcja 22.

### 1.6 Co przeglądarki graczy widzą i mogą zrobić

Przeglądarki graczy proszą przeglądarkę GM-a o większość zmian w tej grze, a Daggerheart robi to samo dla własnych reguł. Każda prośba jest sprawdzana: kto naprawdę ją wysłał, czy ten gracz prowadzi postać albo może widzieć projekt i czy pozwalają na nią pokój, etap i tura. Prośba, która nie przejdzie, niczego nie zmienia, a gracz dowiaduje się w swoim języku, czego nie wykonano i dlaczego; kilka nieudanych próśb, na które nikt nie czeka, trafia tylko do dziennika. Prośba gracza o cofnięcie czegoś jest odrzucana, a Reroll wykonuje przeglądarka GM-a.

Co z tego widzisz i co jeszcze jest sprawdzane:

- Odmowa zostawia linię z nazwą gracza w **Dzienniku debugowania** głównego GM-a.
- Przy zmianie od Daggerhearta dostajesz też ostrzeżenie na ekranie, a zmiana, której Daggerheart nie robi dla gracza, zostawia kartę na twoim czacie. Odmowa to zwykle znak, że ktoś obszedł grę, a czasem funkcja Daggerhearta, której ten moduł jeszcze nie zna, więc zapytaj, zanim wyciągniesz wnioski.
- Fear z Daggerhearta to jedyny wspólny zasób GM-a w tym systemie. Moduł ukrywa pasek Fear i zastępuje go pulami Despair, a *Zastąp licznik Fear z Daggerheart* jest domyślnie włączone. Fear nie ma limitu: przechodzi każdy krok, o który prosi Daggerheart gracza, po jednym naraz. Gdy klient jednego gracza ruszy Fear więcej niż 4 razy w 10 sekund, dostajesz notkę na ekranie; porównaj ją z rzutami na czacie. Wolniejszych kroków moduł z niczym nie porównuje.
- Kości akcji gracza i statystyki klikniętej na arkuszu rzuca przeglądarka głównego GM-a, a to, co rzut przynosi, jest odczytywane z tego rzutu. To, co rzut dodaje do kości, czyli statystykę, doświadczenia, premię i kości przewagi, przeglądarka GM-a odczytuje sama z postaci, akcji i Calli, które GM-owie mają nałożone. To, co okno rzutu gracza dołożyło ponad to, nie jest liczone: dostajesz o tym szept, a karta samego gracza mówi, czego nie policzono.
- Zmianę, którą przeglądarka gracza robi na jego własnym uczniu, w Hope, Health, Sanity, akcjach, statystykach i przedmiotach modułu, przeglądarka GM-a sprawdza względem tego, co trzymają GM-owie, i cofa albo przynosi do ciebie (sekcja 6.3).
- Prośba Daggerhearta o ucznia, której odmówiono, wiadomość, którą przeglądarka gracza napisała tak, jak może pisać tylko przeglądarka GM-a, i kości rzutu przepisane przez gracza są cofane albo odrzucane. Każda z tych rzeczy zostaje zapisana jako Remnant z nazwą gracza, którego Foundry podaje jako nadawcę (sekcja 6.3).
- Jeśli Daggerheart jest nowszy, niż moduł zna, dowiesz się raz, czego odmawia.

Jeśli funkcja Daggerhearta, której używa gracz, kończy się tą odmową, prosi o coś, co ta gra zostawia GM-owi, na przykład o postawienie obszaru, uruchomienie odliczania albo leczenie lub ranienie innego ucznia umiejętnością: zrób to za gracza. Tak samo czeka na ciebie przekazanie przedmiotu drużynie przez gracza; dowiesz się o tym raz na sesję.

Tych rzeczy nic jeszcze nie sprawdza i żadna z nich nie ma limitu częstotliwości:

- Kości rzutu rzuconego, gdy nie jest połączony żaden GM, i kości własnych rzutów przedmiotów i obrażeń Daggerhearta; to, co rusza rzut bez połączonego GM-a, przyznajesz sam (sekcja 6.3).
- To, co przeglądarka gracza wciąż odczytuje sama: który przedmiot daje Search (jego tier jest sprawdzany), wynik rzutu Shadow, który ukrywa przed pokojem, co uczeń robi, i to, co słyszy Listen.
- Zasoby każdego aktora, który nie jest uczniem, także towarzyszy.
- Ładunki własnych przedmiotów graczy, bez pilnowania maksimum przedmiotu, i ilości tych ich przedmiotów, które nie są przedmiotami modułu.
- Tyknięcia odliczań, po jednym kroku, i każda zmiana odliczania, którego właścicielem ustawisz gracza.
- Sumy rzutów obronnych na własnych tokenach gracza.
- Wpisy rzutu grupowego i tag teamu drużyny gracza.
- Kolejność środowisk sceny.

**Co i tak ma każda przeglądarka.** Moduł trzyma swoje sekrety poza danymi świata. Resztę świata wysyła Foundry, i to do każdej przeglądarki, a konsola czyta ją niezależnie od tego, co pokazuje ekran:

- Gdzie stoi każdy token i kiedy się ruszył, łącznie z ukrytymi tokenami i z Eclipse.
- Opis i zdjęcie każdego pokoju, które wędrują jak tło sceny. Zakładka **Opis** w Ustawieniach pokoi mówi: "Każda przeglądarka ma opisy i zdjęcia wszystkich pokoi, więc sekrety pokoju trzymaj w skrytkach i śladach."
- Dane każdego aktora: Health ofiary na 0, zanim ktokolwiek znajdzie ciało, nowe maksima z Level Upu, budżety akcji i Hope, także z zamiany (sekcja 7). Klasa wybiera nagrody Level Upu razem, co ukrywa moment, ale nie wielkość nagrody: Blackened, czyli zabójca rozdziału (sekcja 13), który wyszedł cało z błędnego głosowania, wybiera 4 razy, a inni po 1.
- Każdy przedmiot na każdym arkuszu i każde jego przejście z arkusza na arkusz.
- To, że karta czatu istnieje, kiedy, kto ją wystawił i do kogo jest szeptem; słowa prywatnych kart modułu idą obok niej, tylko do ich czytelników.
- Countdowny Daggerhearta, czyli projekty: nazwa tajnego projektu, jego postęp i to, kto może go widzieć (sekcja 11). Ta wersja nie przenosi danych tajnych projektów.
- Obrazek na tokenie każdego projektu, którym jest ikona projektu w zasobniku, także tajnego. Konsola odczyta więc, jaki projekt stoi w pokoju, nawet taki, którego jej gracz nie widzi.
- Ustawienia świata każdego innego modułu; to, które się liczy, opisuje sekcja 9.5.
- Truth Bullety innych graczy: to, że istnieją, ich nazwa, słowa, które przeczytał ich posiadacz, oraz pokój i czas znalezienia, ale nie ich klucz odpowiedzi ani to, z którego Remnantu pochodzą.

**Co jeszcze mówi czat.** Rzut, który wykonuje moduł, nie nazywa nikogo w swoim dokumencie: nie ma mówiącego, tytułu ani aktora i jest szeptem tylko do GM-ów, a rzucający czyta swój. To, co prywatna karta mówi o sobie, idzie z jej słowami. Karta, której samo istnienie coś by zdradziło, jest zasłonięta: jest zaadresowana do całego stołu, nie nazywa nikogo, a mówi w niej Monokuma. Dopóki trwa incydent, zasłonięta jest każda prywatna karta, która nazywałaby postać albo gracza, ktokolwiek ją wystawia i kogokolwiek dotyczy, także własna karta postronnego, więc zasłonięta karta nic nie mówi o tym, kto jest w walce. Przeglądarka, której nie wysłano słów karty, gdy ją wystawiono, nigdy tej karty nie pokaże.

Co zostaje celowo:

- Kto stworzył rzut albo kartę i kiedy: Foundry zapisuje to w dokumencie. Rzut gracza pisze przeglądarka głównego GM-a, więc jego autorem jest GM i nic w rzucie gracza nie nazywa rzucającego.
- To, że zasłonięta karta istnieje, i kiedy, oraz to, że GM szepnął do GM-ów, i kiedy.
- Formuła rzutu, która niesie wartość statystyki: gdy rzucasz za jedną postać, formuła może ją odróżnić od innej.
- Aktywność użytkownika w Foundry: cele i kursor gracza widzą wszyscy. Lista kontrolna sezonu może ukryć kursor GM-ów przed graczami.

To, kto widzi które kości, co dzieje się z rzutem bez połączonego GM-a, własny reroll Daggerhearta, karty statystyki klikniętej na arkuszu i Meddle Monocuba oraz log czatu sprzed 1.2.65 opisuje sekcja 22. Wyczyszczenie logu czatu na koniec sprawy usuwa go w całości.

---

## 2. Lista kontrolna sezonu

**Ustawienia sezonu** (panel GM-a > Między sesjami) to jedyne miejsce, w którym ustawiasz sezon. Od góry są w nim **Edytuj kampanię** (sekcja 4), część **Sceny** (sekcja 15.1) i **Zresetuj sezon** w ramce ostrzeżenia (sekcja 16). **Edytuj kampanię** mieści nazwę kampanii, rozdział, fazę (Daily Life, Investigation albo Class Trial), dzień, sesję, porę dnia, **Zdanie na następny poranek** i **Safeword**, a na dole, osobno, *Odnów też akcje i Search Tokeny* oraz **Zakończ rozdział**. Część **Sceny** podpina szkołę i salę rozpraw. **Zapisz** zapisuje pola Edytuj kampanię dokładnie tak, jak robi to **Zastosuj** w Edytuj kampanię, i zadaje te same pytania.

Rząd kafelków stoi u dołu okna nad **Zapisz**, zawsze na widoku: **Despair Flow**, **Mastermind**, **Zasady killing game** i **Lista kontrolna sezonu**. Gdy okno jest niskie, przewija się część nad tym rzędem. Okno każdego kafelka otwiera się na wierzchu, a Ustawienia sezonu czekają za nim w takim stanie, w jakim były, razem z tym, co wpisano.

Ustawienia sezonu otwierają się na górze, na nazwie kampanii, którą każdy widzi u góry swojego ekranu. Puste pole **Safeword** znaczy domyślne „Safe Word” (sekcja 19).

**Lista kontrolna sezonu** to osobne okno: najpierw jej wiersze, potem wiersze *Pierwsza sesja*, a na końcu dalsze sprawdzenia, których wiersze nie obejmują. Każdy wiersz zostaje na ekranie ze swoim stanem, więc pominięty krok wciąż widać. Ptaszek znaczy zrobione, a krzyżyk, jedyny czerwony znak, znaczy, że sezon tego potrzebuje (czytnik ekranu mówi wtedy *Wymagane, jeszcze nie zrobione*); kreska znaczy opcjonalne, a **!**, że coś jest nie tak i decyzja należy do ciebie (*Do sprawdzenia*). Wiersz dostaje ptaszek dopiero wtedy, gdy coś sprawdził. Wiersz, który czeka na coś innego, nie ma ani znaku, ani przycisku: bez uczniów wiersze o uczniach mówią *Czeka na obsadę: najpierw utwórz uczniów.*

Wiersz, który moduł umie dokończyć sam, ma przycisk, którego nazwa mówi, co zrobi, na przykład **Nadaj zasoby startowe**, **Ukryj kursor GM-ów**, **Zamień na przejścia** albo **Ukryj**. Wiersz, który potrzebuje ciebie, ma **Otwórz** i prowadzi do właściwego okna. Przycisk każdego wiersza zamyka listę i otwiera ją na nowo, żeby znaki były aktualne, a okno otwarte przez **Otwórz** stoi przed listą.

| Krok | Co sprawdza | Jak naprawić |
|---|---|---|
| Nazwij kampanię | Kampania ma nazwę | Wpisz ją w Edytuj kampanię w Ustawieniach sezonu i naciśnij **Zapisz** |
| Obsada istnieje | Jest co najmniej jedna postać ucznia; Monokumy się nie liczą | Utwórz postacie na liście aktorów Foundry |
| Postacie bez gracza są oznaczone (opcjonalnie) | Każda postać, której właścicielem nie jest żaden gracz, jest Monokumą, Widzem (sekcja 8) albo ma zaznaczone *Poza klasą*; wiersz wymienia pozostałe | Tylko rada, bo taka postać to pewnie NPC: zaznacz jej *Poza klasą* na arkuszu albo zostaw ją tak, jak jest |
| Co najmniej jeden Monokuma | Istnieje pula Despair (sekcja 7; ma ją każde konto pełnego Gamemastera) i jakaś postać jest oznaczona jako Monokuma (sekcja 8); wiersz wymienia, którego z tych dwóch brakuje | **Otwórz** otwiera okno Uczniowie, którego kolumna **Rola** robi Monokumę (sekcja 3); działa też **Oznacz jako Monokumę** w nagłówku arkusza postaci |
| Startowe Health, Sanity i Hope | Każdy uczeń ma co najmniej maks. Health 4 i maks. Sanity 6; arkusz, którego maksima wciąż wynoszą 0, od razu liczy się jako Wounded i w Breakdown (sekcja 5) | **Nadaj zasoby startowe** podnosi do tych wartości każdego ucznia, który ma mniej; na jednym arkuszu to samo robi różdżka obok imienia |
| Każdy ma Ultimate | Każdy uczeń ma na arkuszu wpisany Ultimate | **Otwórz** otwiera pierwszy arkusz bez Ultimate |
| Każdy ma swoje doświadczenia | Każdy uczeń ma co najmniej 2 doświadczenia, każde za +2; wiersz wymienia każdego, komu ich brakuje, z ich liczbą | **Otwórz** otwiera pierwszy arkusz, któremu ich brakuje |
| Każdy coś nosi | Każdy uczeń ma przedmiot startowy: Usable, Murder Weapon, Cleaning Tool albo Tool; klucze i Truth Bullety się nie liczą. Podręcznik zasad daje każdemu jeden przedmiot Tier 2 związany z jego Ultimate, a co to za przedmiot, uzgadniasz z każdym graczem | **Otwórz** otwiera **Daj / zabierz przedmioty** |
| Każdego ucznia pilnuje Monokuma | Każdy uczeń jest przypisany przez GM-a do puli Despair w Despair Flow (sekcja 7) albo celowo ustawiony na „- nikt -” (na przykład postać prowadzona jako NPC albo szablon), co też liczy się jako pilnowany. Uczeń, którego nikt nie przypisał, zasila pierwszą pulę i do czasu przypisania jest tu wypisany jako *Imię (bez przypisania: trafia do Puli)*. To, kto jest ustawiony na „- nikt -”, może odczytać każdy gracz, więc Masterminda przypisz jak każdego innego ucznia | **Otwórz** otwiera Despair Flow |
| Mastermind zasila pulę Despair (widoczny tylko, gdy nie zasila) | Czy Mastermind jest w Despair Flow ustawiony na „- nikt -”; Despair Flow może odczytać każdy gracz, a sprawdzenie stanu sprawy też wymienia Masterminda | **Otwórz** otwiera Despair Flow; daj Mastermindowi Monokumę jak każdemu innemu uczniowi |
| Uczniowie są podzieleni po równo między pule (opcjonalnie) | Liczba żyjących uczniów na pulę różni się najwyżej o jednego | Tylko rada: **Otwórz** otwiera Despair Flow, gdzie **Podziel po równo** rozdaje uczniów. Obsada, która nie dzieli się po równo, to twoja decyzja; nierówny podział pokazuje **!** i liczbę uczniów każdej puli (*Nierówny podział: ...*) |
| Próg overflow pasuje do obsady (opcjonalnie) | Próg overflow (sekcja 7) to sugestia modułu dla tego sezonu, 12 plus połowa żyjących uczniów; wiersz podaje *Sugerowane dla n uczniów i p pul: x.* i obecny próg | Tylko rada, bo próg jest twój: domyślne 20 zostaje, dopóki go nie zmienisz. **Otwórz** otwiera Despair Flow, gdzie próg ustawia zakładka **Overflow** |
| Dość pokoi dla obsady (opcjonalnie) | Czy wspólnych pokoi na scenie jest co najmniej około 1,5 na żyjącego ucznia, z zaokrągleniem w górę; nie liczą się sypialnie ani pokoje z zaznaczonym **Bez prywatności** na zakładce **Pokoje** w Ustawieniach pokoi, a zamknięte pokoje się liczą. Bez pokoi wiersz nigdy nie ma ptaszka, a zakładka Pokoje podaje tę samą liczbę | Tylko rada: poniżej tej proporcji dwie prywatne rozmowy nie mogą toczyć się naraz |
| Mapa ma pokoje | Jakaś scena ma pokoje, a oceniana scena (ta na ekranie, gdy jest mapą z pokojami, inaczej szkoła) ma najwyżej 10% własnej powierzchni poza pokojami, bez marginesu wokół mapy, i żadnego błędu z ostatniego **Sprawdź pokoje na tej scenie**. Każda scena z pokojami ma też wyłączone widzenie tokenów i mgłę Foundry, a włączone światło globalne, bo inaczej gracze mogą widzieć czerń; te trzy przełączniki opisuje sekcja 9.2. Linia pod wierszem podaje ocenianą scenę i ile scen ma pokoje | **Otwórz** otwiera Ustawienia pokoi. Wiersz ma też instrukcję rysowania pokoi i **Sprawdź pokoje na tej scenie** |
| Każdy nazwany region rozstrzygnięty: pokój albo nie | Żaden nazwany region bez zachowań, na żadnej scenie, nie czeka już na **To jest pokój** od GM-a; wiersz wymienia czekające regiony. Gdy nigdzie nie ma nazwanego regionu, wiersz nie ma ptaszka i mówi, żeby najpierw narysować pokoje | **Otwórz** otwiera Ustawienia pokoi na zakładce **Pokoje** |
| Kursor GM-a jest prywatny (zalecane) | Udostępnianie kursora w Foundry jest wyłączone dla dwóch ról GM-a | **Ukryj kursor GM-ów** zabiera udostępnianie kursora dwóm rolom GM-a w uprawnieniach Foundry; gracze zachowują swoje |
| Brak sekretnych drzwi Foundry (zalecane) | Żadna scena świata nie ma sekretnych drzwi Foundry, bo takie drzwi może otworzyć każdy gracz; wiersz wymienia każdą scenę, która je ma, i ile ich na niej jest | **Zamień na przejścia** robi z każdych sekretnych drzwi zwykłą, zamkniętą ścianę, a tam, gdzie stały między dwoma pokojami, także tajne przejście, którego jeszcze nikt nie zna (sekcja 9.6) |
| Linijka ruchu graczy jest ukryta (opcjonalnie) | Role Gracz i Zaufany gracz nie pokazują linijki ruchu Foundry, którą cały stół widzi, gdy token jest przeciągany, także z trasą przez tajne przejście | **Ukryj** zabiera linijkę ruchu rolom Gracz i Zaufany gracz, a **Pokaż** ją oddaje; role GM-a zachowują swoją |
| Sekretu serwera głosu nie ma w świecie (widoczny tylko, gdy jest) | Czy LiveKit AVClient jest ustawiony na własny serwer, a jego sekret API leży w ustawieniu świata, które trafia do każdego gracza | Ten moduł nie może przenieść sekretu, więc wiersz nie ma przycisku, a linia Dalej na niego nie czeka. Serwer, który sam wydaje tokeny dostępu, na przykład Tavern, trzyma sekret z dala od każdej przeglądarki |
| Mastermind (opcjonalnie) | Mastermind jest ustawiony | **Otwórz** otwiera okno **Mastermind**. Sezon bez Masterminda jest zgodny z zasadami |

**Pierwsza sesja.** Trzy wiersze stoją osobno, pod *Pierwsza sesja* za listą. Każdy z nich ustawia się raz, przed pierwszą sesją, ze stanem i przyciskiem jak w każdym wierszu. Wszystkie trzy są opcjonalne i na żaden z nich nie czeka linia Dalej w panelu GM-a.

| Krok | Co sprawdza | Jak naprawić |
|---|---|---|
| Szkoła i sala rozpraw są podpięte (opcjonalnie) | Ustawienia sezonu podpinają scenę, na której toczy się sezon, i scenę, na której odbywa się Class Trial; wiersz sprawdza też tokeny sali, a sala potrzebuje twojego tokenu tylko dla Monokumy, bo tokeny uczniów robi moduł | **Otwórz** otwiera Ustawienia sezonu (sekcja 15.1). Bez podpiętych scen Class Trial odbywa się tam, gdzie akurat jest stół |
| Moduł trzyma ustawienia Foundry (opcjonalnie) | Widoczny tylko wtedy, gdy ustawienia Foundry są oddane; moduł nie trzyma wtedy żadnego z nich | **Otwórz** otwiera **Oddaj ustawienia Foundry**, gdzie **Przejmij je znowu** bierze je z powrotem (sekcja 1.2) |
| Dice So Nice (opcjonalnie) | Czy Dice So Nice jest włączony; to wymagany moduł (sekcja 1), więc dopóki ten moduł działa, wiersz zawsze ma ptaszek | **Otwórz** otwiera listę modułów Foundry, gdzie włącza się Dice So Nice |

> [!IMPORTANT]
> **Jak rysować pokoje** (instrukcja z wiersza): narysuj ściany, potem region na każdy pokój i zaznacz „To jest pokój” w Ustawieniach pokoi.
> Reszta: rysuj każdy region do ścian z włączonym przyciąganiem; pokój może składać się z kilku regionów o jednej nazwie. Region, którego nikt nie zaznaczył, przejście (region, który teleportuje token albo zmienia jego poziom) i region narysowany przez gracza nie są pokojami i nigdy nie liczą się jako sąsiedzi. Sąsiedzi stykają się wspólną krawędzią i nigdy się nie nakładają. Drzwi to przerwa w ścianach, dowolnej szerokości. Dwie strefy to dwa pokoje. Kontrola w wierszu zgłasza błędy, nałożenia, granice, które odchodzą od ścian, pokój bez wyjścia i bez sąsiada, pokój, którego części się różnią, i rogi poza siatką; nigdy nie edytuje mapy.

Raport **Sprawdź pokoje na tej scenie** najpierw, nad listą, jeden raz objaśnia, co znaczy każdy rodzaj znaleziska, a potem przy każdym pokoju podaje krótki fakt, czyli ile kratek jego granicy nie ma ściany i ile kratek podłogi dzielą dwa pokoje, oraz **Pokaż na mapie**, który przenosi mapę w to miejsce i je zaznacza. Bez sceny na płótnie raport mówi *Na płótnie nie ma sceny*, a na scenie bez pokoi *Na tej scenie nie ma pokoi*; to, że mapa jest czysta, mówi tylko wtedy, gdy sprawdził jakieś pokoje.

**Dalsze sprawdzenia** pod wierszami Listy kontrolnej sezonu to raporty w języku stołu. Każda część pokazuje się tylko wtedy, gdy ma coś do powiedzenia, z wyjątkiem wyglądu kości i audytu anonimowości.

- **Zdjęcia pokoi**: krzyżyk przy zdjęciach, które się nie wczytują (wybierz plik jeszcze raz w Ustawieniach pokoi); **!** przy zdjęciach ponad 4096 px na boku albo ponad 8 MB, bo każdy gracz długo na nie czeka, przy zdjęciach, których rozmiaru pliku serwer nie podał, i przy zdjęciach, które nie wczytały się na czas, więc ich rozmiaru nie sprawdzono (uruchom sprawdzenia jeszcze raz przy szybszym łączu).
- **Głos**: **!** przy każdym znalezisku. Audio/Wideo jest w tym świecie wyłączone, więc kafelek głosu nie działa; świat ma ustawione samo wideo, więc nikt nie wysyła dźwięku; świat wysyła wideo, którego nikt nie ogląda.
- **Wygląd kości**: co ta przeglądarka odczytuje z wyglądu kości każdego użytkownika, z **!** przy każdej rzeczy, przez którą kości mogą wyglądać inaczej, a z ptaszkiem, gdy nie ma żadnej. **Otwórz wygląd kości** otwiera całe okno (sekcja 20). Przeglądarkę innej osoby odczytuje się tylko w niej samej, a jak, mówi **Foundry i moduły** w Dzienniku debugowania (sekcja 3).
- **Audyt anonimowości**: pod *napraw te* wymienia arkusze należące do każdego gracza, które każdy gracz czyta w całości, i proponuje dla nich **Ustaw je na Obserwatora**; potem każdy gracz może je otworzyć, a ich sekrety są ukryte. Arkusze na poziomie Obserwatora są w porządku i ich nie wymienia. Arkusze zamknięte dla pozostałych graczy wymienia dla twojej wiadomości, bo ciała takiej postaci nikt nie przeszuka. Wymienia też arkusze, których właścicielem jest Asystent GM-a, arkusze kilku graczy i arkusze bez właściciela wśród graczy, a gdy anonimowe arkusze postaci są wyłączone w ustawieniach gry, także arkusze na poziomie Obserwatora, które każdy gracz czyta w całości.

**Liczby na start postaci:**

| Na starcie | Wartość |
|---|---|
| Statystyki | sześć: Eye, Head, Body, Leg, Hand, Shadow, w rozkładzie **+2, +1, +1, 0, 0, -1** |
| Health | **4** |
| Sanity | **6** |
| Hope | **2**, z maksimum 6 |
| Doświadczenia | dwa, każde na **+2** |

---

## 3. Panel GM-a

`scripts/gm-panel.mjs` rysuje panel GM-a. Otwiera go czerwony przycisk z okiem w prawym dolnym rogu, nad zębatką, podpisany **Otwórz panel GM-a**. Góra panelu to stan gry: nazwa kampanii, linia zegara (na przykład „Rozdział 2 · Dzień 3 · Sesja 3 · Popołudnie”, z dopiskiem „· ECLIPSE”, gdy trwa Eclipse), faza (Daily Life, Investigation albo Class Trial, sekcja 4), **Pomiń Eclipse** we własnym wierszu, linia **Dalej** i to, ilu uczniów ma jeszcze akcje w tej porze dnia. Ta liczba obejmuje Monocuba, czyli zmarłego ucznia, który gra dalej (sekcja 8), bo ma prawdziwy budżet akcji, a pomija Monokumy i zmarłych; akcje i Free Move każdego ucznia są w oknie **Uczniowie**. Gdy sprawdzenie wykryło w tej przeglądarce niekompletną sprawę, nad całym panelem stoi ramka ostrzeżenia: *Sprawa w tej przeglądarce jest niekompletna:* i to, czego brakuje (sekcja 14).

**Linia Dalej** podaje jedną instrukcję, najpilniejszą z poniższych, w tej kolejności, a przycisk obok niej nazywa ten krok i go wykonuje:

1. Gdy trwa incydent, linia mówi, żeby doprowadzić go do końca; **Otwórz incydent** otwiera tracker incydentu.
2. Gdy gracze dostali pytanie przed przesunięciem zegara, a pytanie wciąż czeka na odpowiedź, linia mówi, żeby otworzyć je ponownie; przycisk to **Przesuń zegar**, a przy pytaniu Eclipse **Zacznij Eclipse** albo **Zakończ Eclipse**.
3. Gdy Eclipse jest otwarte, linia mówi, żeby je zamknąć, kiedy wszyscy się ustawią; przycisk to **Zakończ Eclipse**.
4. Gdy koniec rozdziału zatrzymał się przed wykonaniem wszystkich kroków, linia mówi, żeby go dokończyć; przycisk to **Zakończ rozdział**.
5. W Class Trial, gdy rozdział tej rozprawy już się skończył, linia mówi, żeby ją zakończyć, a przycisk to **Otwórz konsolę trialu**. Inaczej linia podaje następny krok konsoli, tymi samymi słowami, których używa pierwsza linia konsoli i pierwsza linia okna głosowania: od *Żaden Class Trial nie trwa. Zacznij Class Trial.* przez *Karty są rozesłane. Gdy wrócą, użyj Zamknij i policz w oknie Głosowanie.* do *Werdykt zapadł. Zakończ rozdział.* Linia nazywa tylko krok, bez trybu na sali i bez tego, kto ma głos. Przycisk otwiera konsolę, a przy kroku werdyktu jest nim **Zakończ rozdział**.
6. Gdy ogłoszono ciało, a nie wszystkie Key Remnanty tej sprawy stoją już na mapie, linia mówi, żeby postawić je z zakładki Key Remnanty okna Investigation; przycisk to **Otwórz Investigation**.
7. Gdy znaleziono ciało, a Investigation jeszcze się nie zaczęło, linia mówi, żeby je rozpocząć; przycisk to **Rozpocznij Investigation**.
8. W Investigation, gdy ciało z tego rozdziału zostało ogłoszone, linia mówi, żeby wydać Truth Bullet z sekcji zwłok, jeśli w tym rozdziale go nie wydano; trafia on do wszystkich żyjących, a przycisk to **Wydaj sekcję zwłok**. Gdy każdy zaplanowany Key Remnant jest znaleziony, linia mówi, żeby zacząć Class Trial, a przycisk to **Otwórz konsolę trialu**. Inaczej linia mówi, żeby zajrzeć do okna Investigation, a przycisk to **Otwórz Investigation**.
9. W Daily Life ciało, które znaleźli dwaj świadkowie, czeka na twoją decyzję. Ciało, którego nikt jeszcze nie znalazł, czeka w swoim pokoju na dwóch świadków, a potem na twoją decyzję, a ciało, którego token jest ukryty albo nie stoi w żadnym pokoju, czeka, aż je ogłosisz. Przycisk **Ogłoś ciało** otwiera okno z sekcji 13.4.
10. W Daily Life, dopóki jakiś wymagany wiersz Listy kontrolnej sezonu nie jest zrobiony, a sezon jeszcze nie ruszył, linia mówi *Do ustawienia:* i ten wiersz, a przycisk to **Lista kontrolna sezonu**. Sezon rusza, gdy zegar opuści Rozdział 1, Dzień 1, Sesję 1, Rano w Daily Life, albo gdy Eclipse odnowi obsadę. Od tej chwili niezrobiony wiersz pokazuje się zamiast tego pod linią niżej, jako druga, cichsza linia: *Lista kontrolna sezonu wciąż czeka na:* i ten wiersz, z **Otwórz**.
11. Inaczej linia mówi *n uczniów ma jeszcze akcje do wydania.*, a gdy wszyscy wydali akcje, mówi, żeby zacząć Eclipse: jego otwarcie odnawia wszystkich, a zamknięcie przesuwa zegar. Przycisk to **Zacznij Eclipse**.

Linia Dalej może wskazywać rzeczy, które nie są kafelkami: Eclipse, przesunięcie zegara, koniec rozdziału, start Investigation, konsolę trialu, ogłoszenie ciała i Listę kontrolną sezonu.

**Pomiń Eclipse** przesuwa zegar bez Eclipse i odnawia akcje, Free Move i Search Tokeny; w Nocy zaczyna też następny dzień i następną sesję. Przycisk stoi w swoim wierszu w każdej fazie, ale jest wyłączony podczas Eclipse, bo zegar przesuwa wtedy koniec Eclipse, i podczas Class Trial, bo zegar przesuwa wtedy koniec rozdziału; jego dymek mówi, który powód zachodzi. Najpierw pyta graczy (sekcja 12, *Najpierw gracze*).

Tak jak początek Eclipse, **Pomiń Eclipse** otwiera na każdym ekranie podsumowanie pory dnia, którą kończy (sekcja 12, *Rozpoczęcie*), i tak samo robi każde inne przesunięcie zegara naprzód, gdy nie trwa Eclipse, także z Edytuj kampanię. Każdy ekran podsumowuje porę dnia raz: koniec Eclipse, cofnięcie i nowy sezon albo rozdział nie otwierają podsumowania, a **Pomiń Eclipse** po Eclipse zakończonym bez przesuwania zegara podsumowuje tylko to, co zagrano od tego zakończenia. Gdy trwa incydent, gracz spoza niego nie dostaje podsumowania, kiedy zegar się przesuwa.

Kafelki, według sekcji:

| Sekcja | Kafelki |
|---|---|
| Teraz (zawsze otwarta) | **Uczniowie**, **Projects**, **Dźwięk** |
| Sprawa (Daily Life, Investigation, Class Trial) | **Morderstwo**, **Investigation** i konsola **Class Trial**; Morderstwo jest wyszarzone podczas Eclipse, chyba że trwa incydent, a gdy incydent trwa, otwiera tracker incydentu |
| Między sesjami (zwinięta) | **Ustawienia pokoi**, **Tabele przedmiotów**, **Ustawienia sezonu** (sekcja 2) i **Ustawienia gry**; kafelek Ustawienia gry jest wyłączony, z podanym powodem, dla GM-a, któremu Foundry nie pozwala zmieniać ustawień |
| Diagnostyka (zwinięta, przyciemniona) | **Dziennik debugowania**, **Napraw głos** i **Sprawa**, czyli kopia zapasowa i przywracanie, z wiekiem ostatniej kopii (sekcja 14) |

**Dziennik debugowania** wymienia wszystko, co w tej przeglądarce poszło nie tak od załadowania strony; powtórka to jeden wiersz z licznikiem, a przeładowanie opróżnia dziennik. Gdy coś w nim jest, ma **Kopiuj do schowka** i **Wyczyść dziennik**, a zawsze ma **Foundry i moduły**. Okno Foundry i moduły ma dwie części. *Foundry, Daggerheart i moduły* daje jedną linię, gdy każde miejsce, na którym moduł w nich polega, jest takie, jakiego ta wersja oczekuje, a **!** przy każdym, które nie jest, z tym, co stół dostaje zamiast tego; listę ma sekcja 20, „Umowa z Foundry, Daggerheart i modułami”. Miejsca, których nie dało się sprawdzić na tym ekranie, to jedna policzona linia z listą schowaną pod nią; nie wiadomo, czy działają, bo czego nie sprawdzono, tego moduł nigdy nie zalicza. *Wygląd kości* mówi, jak odczytuje się wygląd kości innej przeglądarki, i ma **Otwórz wygląd kości**.

**Napraw głos** wysyła każdemu jeszcze raz jego pokój głosowy (sekcja 9.5). Nacisnąć go może tylko główny GM i tylko przy aktywnym LiveKit AVClient.

**Uczniowie** mają wiersz dla każdej postaci, w grupach, gdy jest ich więcej niż jedna: najpierw uczniowie, potem Monokumy, Widzowie i postacie poza klasą. Każdy wiersz ma imię, przycisk arkusza, obok niego **Przedmioty** (poza wierszem Monokumy, bo jego arkusz nie ma zakładki Ekwipunek), kolumnę **Rola** i **Level Up** tam, gdzie arkusz go proponuje. **Rola** to Uczeń, Monokuma, Widz albo Poza klasą i zmienia się od razu, tak jak kontrolki w nagłówku arkusza, a oznaczenie postaci gracza jako Monokumy najpierw pyta; Widz zmarłego ucznia ma w tej kolumnie *Widz zmarłego ucznia*. **Level Up** otwiera menu Level Up arkusza i mówi, ile ofert czeka (*n oferty Level Up*), a **Przedmioty** otwierają **Daj / zabierz przedmioty** dla tej postaci; po każdym z nich tabela wraca.

Wiersz ucznia ma też **Stan**, **Akcje**, **Free Move** i trzy kolumny Monocuba. **Akcje** pokazują, ile zostało i jakie jest maksimum w tej porze dnia, a **Free Move** pełną ikonę stopy, dopóki jest, i sam jej kontur po wykorzystaniu; u zmarłego ucznia obie komórki to -. Trzy kolumny Monocuba to **Hope**, **Despair → Hope** i **Świadek zbrodni**; są zawsze, a uczeń, który nie jest Monocubem, ma w nich przygaszone „-”. Lista **Stan** zmienia tylko zapisany stan, po **Zastosuj**, i służy do poprawienia pomyłki.

Kolumna **Zrób** zmienia stan w grze, ze wszystkimi skutkami. Przy żywym uczniu stoi **Postać umiera**, a przy zmarłym **Zaproś jako Monocuba**, przycisk, który wysyła zaproszenie: uczeń zostaje Monocubem, gdy jego gracz przyjmie Zasadę Monocuba. To samo zaproszenie wysyła *Monocub* na liście **Stan**. Otwarte zaproszenie mówi *Zaproszenie wysłane*, a **Wycofaj** je cofa. Przy śmierci, którą GM-owie na razie ukrywają, **Wycisz teraz** przenosi głos tego gracza do Widzów, zanim ciało zostanie znalezione. **Zwróć ostatnie przejście** stoi w wierszu postaci, której ostatnie przejście GM-owie mogą jeszcze oddać, a jego dymek wymienia oba pokoje.

Śmierć, którą GM-owie ukrywają do znalezienia ciała (sekcja 13.4), stoi na liście jako **Nie żyje, ciała nie znaleziono**. Ustawienie *Nie żyje* (albo *Monocub*) ujawnia ją stołowi, tak samo jak robi to odkrycie ciała, a ustawienie *Żyje* cofa śmierć.

> [!CAUTION]
> **Postać umiera** niszczy Truth Bullety postaci, chyba że zaznaczysz *Zachowaj Truth Bullets tej postaci (śmierć poza killing game)*, i zostawia resztę przy ciele. Drugie pole, *Zachowaj to dla GM-ów, dopóki ciało nie zostanie znalezione*, jest zaznaczone dla ofiary trwającego incydentu: wtedy do stołu jeszcze nic nie dociera (bez flagi, bez znacznika), a Truth Bullety giną dopiero, gdy śmierć wyjdzie na jaw (sekcja 13.4).

---

## 4. Zegar

Zegar biegnie tak: sezon > rozdział > sesja > pora dnia. Jedna sesja to jeden dzień fikcji, czyli pięć pór dnia: **Rano, Południe, Popołudnie, Wieczór, Noc**. Przejście za Noc przewija dzień i sesję naraz. Rozdziały nigdy nie przesuwają się same, bo podręcznik zasad, na którym zbudowano moduł (*Danganronpa RPG System - Full Guide*), pozwala rozciągnąć rozdział, gdy nie było jeszcze morderstwa; rozdział przesuwasz ty, przez **Zakończ rozdział** (sekcja 16) albo Edytuj kampanię.

Są trzy **fazy** i każdą ustawia się ręcznie. Kanoniczny rozdział ma 5 sesji:

| Faza | Co oznacza | Sesje w kanonicznym rozdziale |
|---|---|---|
| Daily Life | 2 akcje na porę dnia | 3, z morderstwem w trzeciej |
| Investigation | znaleziono ciało; Observe i Analyze budują Truth Bullety | 1 |
| Class Trial | Objection, Testimony i głosowanie (sekcja 15) | 1 |

**Co robi zmiana pory dnia**, po kolei:

1. Sprawdza Despair overflow (sekcja 7) przed uzupełnieniem Search Tokenów, bo zaciemnienie, czyli stan Overflow obejmujący porę dnia (sekcja 7), może zmniejszyć ich liczbę.
2. Uzupełnia Search Tokeny w każdym pokoju.
3. Czyści każdy Despair Call obowiązujący przez jedną porę dnia (pieczęcie Behind Closed Doors, Chained, Silence), a każdy Bribe wciąż bez odpowiedzi i każdy Bounty, którego nikt nie odebrał, wygasa (sekcja 6).
4. Odlicza jedną porę dnia od terminu Motive Monokumy (sekcja 6.2).
5. Ogłasza nową porę dnia stołowi, a gdy trwa incydent, prywatnie jego uczestnikom i GM-om, i przerysowuje HUD u wszystkich.

Gdy trwa incydent, Motive, któremu mija termin, trafia szeptem, zakryty, do uczestników incydentu i GM-ów, i to raz, choćby pora dnia przesunęła się w incydencie kilka razy. Jego karta dla całego stołu pojawia się, gdy incydent się zamyka. Do tego czasu każdy spoza incydentu widzi w panelu zdarzeń odliczanie Motive takie, jakie było, gdy pora dnia pierwszy raz przesunęła się w incydencie, bo jego zegar stoi tam, gdzie stał.

> [!IMPORTANT]
> Zmiana pory dnia sama z siebie **nie odnawia** akcji. Budżet wraca, <ins>gdy Eclipse się otwiera</ins> (sekcja 12); **Pomiń Eclipse** w panelu GM-a odnawia go dla stołów, które pomijają Eclipse, a Edytuj kampanię ma na to pole wyboru. Nigdy nie odnawiaj jednej granicy dwa razy: moduł odnawia każdą granicę raz, a pole w Edytuj kampanię odnawia za każdym razem, gdy jest zaznaczone.

Gdy odnawia **Pomiń Eclipse**, GM-owie dostają też notatkę z każdym uczniem w stanie Wounded, któremu w tej porze dnia została jedna akcja (sekcja 5).

**Cofanie** (lewa strzałka na HUD) cofa zegar o jedną porę dnia i służy do poprawienia pomyłki. Rano cofanie przenosi na Noc poprzedniego dnia, razem z dniem i sesją. Gdy trwa Eclipse, cofanie jest odrzucane (*Trwa Eclipse. Najpierw je zakończ.*); zamiast tego zakończ Eclipse z panelu bez przesuwania zegara.

Cofnięcie niczego nie odnawia. W ciągu **5 minut** od granicy, przez którą się cofa, cofa też to, co ta granica dała: akcje, Free Move, Search Tokeny i pieczęcie wracają do stanu sprzed niej (*Cofnięte: ...*), a granica przy następnym przejściu odnawia dokładnie tak, jak odnowiłaby wcześniej. Po kilku granicach z rzędu (do 4) tyle samo cofnięć cofa każdą z nich, każde w ciągu 5 minut od swojej granicy; później niczego się nie przywraca. Cofnięcie najpierw odwołuje zgromadzenie, które jeszcze się nie zebrało (zgromadzenie zwołuje Public Announcement, sekcja 6.2), czyści obowiązujące Despair Calle, a gdy cofa granicę, przywraca pieczęcie pory dnia, do której wraca. Oddaje też Motive jego porę dnia.

**Edytuj kampanię** stoi na górze Ustawień sezonu (sekcja 2) i poprawia zegar: edytuje nazwę, rozdział, fazę, dzień, sesję, porę dnia i **Zdanie na następny poranek**. *Odnów też akcje i Search Tokeny* jest domyślnie wyłączone; zaznaczone odnawia akcje i Search Tokeny, ale nie robi nic innego z tego, co robi granica. Motive, pieczęcie i overflow zostają bez zmian, a karta pory dnia się nie pojawia. **Rozdział**, **Dzień** i **Sesja** to liczby z - i + obok. Rozdział można ustawić od 1 do 6, bo tyle rozdziałów ma sezon, albo do rozdziału zegara, gdy zegar jest już dalej.

Edytuj kampanię nie robi tego, co robi koniec rozdziału albo otwarcie Class Trial. Zmiana rozdziału najpierw pyta (*Popraw numer rozdziału*): poprawia tylko numer, bez ujawniania, bez zbierania Truth Bulletów i bez Blackened, czyli zabójcy rozdziału, a **Anuluj** zostawia rozdział i stosuje resztę okna. **Zakończ rozdział** stoi osobno na dole, w ramce ostrzeżenia: ujawnia, zbiera Truth Bullety, wskazuje Blackened i najpierw pyta. Jego przycisk zamyka Edytuj kampanię bez zastosowania tego, co wpisano, pyta jeszcze raz, z **Anuluj** jako domyślnym, i dopiero po drugim pytaniu otwiera koniec rozdziału (sekcja 16).

Przestawienie fazy na Class Trial też pyta (*Otwórz Class Trial*), bo otwiera budżet Class Trial i pobiera opłatę za nieznalezione Key Remnanty (sekcja 15). Podczas Eclipse faza zostaje bez zmian, dostajesz o tym wiadomość, a reszta okna jest stosowana. Zmiana pory dnia albo sesji odwołuje zgromadzenie, które jeszcze się nie zebrało, kartą widoczną dla stołu i bez zwrotu. Zgromadzenie zostaje, gdy pora dnia idzie naprzód (później tego samego dnia albo inna pora dnia w późniejszym dniu), a sesja się nie cofa.

> [!WARNING]
> Dwie przestrogi:
>
> - zmiana fazy kończy zapis „znaleziono ciało i czeka”;
> - przesunięcie zegara nie kończy Eclipse: gdy pora dnia, dzień albo rozdział zmieniły się w trakcie Eclipse, po Zastosuj dostajesz ostrzeżenie, a linia zegara mówi ECLIPSE, dopóki nie zakończysz Eclipse z HUD.

**HUD** pokazuje to wszystko wszystkim. GM-owie mają na nim dodatkowo strzałki: lewa cofa, a prawa zaczyna Eclipse przed następną porą dnia. Dymek prawej strzałki nazywa następną porę dnia, a w Nocy mówi, że strzałka kończy też sesję. Prawa strzałka najpierw pyta, **Zacznij** albo **Anuluj** (domyślnie), a po starcie zamienia się w przycisk odtwarzania, który kończy Eclipse. Strzałka robi dokładnie to samo co **Zacznij Eclipse** i **Zakończ Eclipse** przy linii Dalej w panelu GM-a, a gracze najpierw dostają pytanie (sekcja 12).

HUD pokazuje też, jak długo trwa bieżąca pora dnia: linia czasu robi się bursztynowa po **15 minutach** i czerwona po **30**. Pokazuje minuty, które stół zagrał, i jest zamrożona, gdy gra stoi na pauzie; przeładowanie ani przerwa między sesjami nic nie dodają, z dokładnością do minuty. GM, który otwiera następną sesję na innym komputerze albo po wyczyszczeniu danych przeglądarki, liczy zamiast tego od ostatniej zmiany zegara, czyli pauzy, jej końca albo nowej pory dnia. Z linii znikają wtedy minuty zagrane po tej zmianie, nigdy dni między sesjami. Podczas Eclipse tej linii nie ma.

Podczas Class Trial wiersz pory dnia podaje zamiast niej tryb rozprawy, a strzałek i linii czasu wtedy nie ma; odliczanie debaty jest na karcie Class Trial w panelu zdarzeń. Podczas Eclipse linia fazy podaje zamiast fazy nazwę Eclipse (na przykład *Eclipse (Noc)*). Gdy gra stoi na pauzie, mówi to każdy zegar: w miejscu nazwy kampanii stoi **Wstrzymano**, dopóki gra nie ruszy, a własny napis Foundry na środku ekranu i przygaszenie zostają takie jak zawsze. Pod liniami zegara pasek podaje utwór, który gra ta przeglądarka.

Pasek stanu GM-a pokazuje licznik *Zostały akcje*, a podczas Eclipse *Jeszcze się ustawiają*; przy ustawianiu w dowolnym pokoju ten drugi liczy tych, którzy jeszcze się nie ruszyli. Pasek liczy tych samych uczniów co linia Dalej w panelu: żywych i Monocubów. W trakcie incydentu nikt nie wydaje akcji pory dnia, więc licznika *Zostały akcje* nie ma, ale w Class Trial zostaje.

**Panel zdarzeń** pod paskiem Despair pokazuje trwające zdarzenia jako karty: stop safeword, Class Trial i jego głosowanie, rzut otwarcia i incydent, znalezione ciało, zaciemnienie z overflow, zwołane zgromadzenie i Motive. Karta incydentu trafia tylko do jego uczestników i GM-ów, a karta znalezionego ciała podaje jego pokój. Panel ma jeden rozmiar, cokolwiek zawiera, a karta dłuższa od niego przewija się w środku.

**Obroty zegara i plansze dnia.** Każda zmiana pory dnia obraca kurtynę: godzina naprzód od góry, nowy dzień albo cofnięcie od dołu, a Eclipse od środka. Investigation zaczyna się błyskami szyb, a ogłoszenie ciała sprawia, że kurtyna migocze.

Gdy zaczyna się Noc, na końcu nocnego Eclipse albo przy **Pomiń Eclipse** z Wieczoru, jeśli nie prowadzisz nocnego Eclipse, każdy widzi **planszę końca dnia**: co zrobił tego dnia, co widziała szkoła i **nastrój szkoły**. Ty widzisz na planszy cały stół. Nastrój szkoły to Spokój, Niepokój albo Na krawędzi i zależy od tego, jak Hope uczniów wypada wobec Hope Monocubów, Despair Monokumy i Overflow; gracze widzą tylko słowo nastroju.

Gdy zaczyna się następny dzień, na początku porannego Eclipse albo przy **Pomiń Eclipse** z Nocy, jeśli nie prowadzisz porannego Eclipse, każdy widzi **planszę początku dnia**: nowy dzień, obsadę i twoje zdanie na poranek z pola **Zdanie na następny poranek** w Edytuj kampanię. Puste zdanie niczego nie pokazuje, a przy dwóch GM-ach to zdanie GM-a, który przesuwa zegar. Koniec porannego Eclipse nie pokazuje żadnej planszy, choć numer dnia i sesja wciąż zmieniają się na jego końcu, a **Zakończ bez przesuwania zegara** przy porannym Eclipse oddaje twoje zdanie z powrotem do pola. Przy następnym poranku z ekranu Końca rozdziału pojawiają się obie plansze, po wyjściu z rozprawy. Edytuj kampanię nie pokazuje żadnej. Esc pomija planszę, a przełącznik **Sekwencje na cały ekran** wyłącza to wszystko (sekcja 15.3).

---

## 5. Akcje i budżety

Każdy uczeń ma **2 akcje** na porę dnia i **1 Free Move**. **Wounded** (Health się skończyło) kosztuje 1 akcję na porę dnia w Daily Life i w Investigation; w Class Trial nie kosztuje żadnej, choć stan i jego plakietka zostają, a Monocub nigdy nie traci akcji przez Wounded. Zaciemnienie *Panic* (sekcja 7) kosztuje 1 akcję więcej; oba się sumują, ale Panic nigdy nie obniża budżetu poniżej **1**. Postać, która wyleczy się w ciągu dnia, dostaje akcję z powrotem przy następnym odnowieniu. Odłożony Burst (Hope Call, sekcja 6.1) płaci całą cenę następnej akcji, także 2 akcje Long Rest, zanim zejdzie jakakolwiek akcja, a przejście do innego pokoju bierze najpierw Free Move, potem odłożone darmowe przejście, potem Burst, a dopiero na końcu akcję (sekcja 9.3). **Breakdown** (Sanity się skończyło) daje utrudnienie na każdym rzucie; karta rzutu nazywa dodatkową kość Disadvantage i nigdy nie mówi Breakdown (*Kto co czyta*, niżej).

Dziesięć kafelków na arkuszu, w kolejności rysowania:

| Akcja | Statystyka | Koszt | Co robi | Liczby |
|---|---|---|---|---|
| Search | Eye albo inna, którą zatwierdzisz | 1 + jeden z Search Tokenów pokoju | Przeszukaj pokój pod kątem czegoś, co nazwiesz | 8: przedmiot Tier 0 (sekcja 10.1) i Hidden Remnant (dowód, który akcja zostawia na mapie, sekcja 14.1); 12: Tier 1 i Subtle Remnant; 18: Tier 2 i Evident Remnant; krytyk: +1 Tier i Obvious Remnant, więc krytyk, który nie sięga żadnego progu, i tak znajduje przedmiot Tier 1. Zabranie Murder Weapon albo Cleaning Tool zostawia Faint Prep Remnant. Search nigdy nie sięga do skrytki. Porażka nic nie znajduje |
| Observe | Eye | 1 | Skopiuj Remnant do ekwipunku jako Neutral Truth Bullet (nierozpoznany, sekcja 14.1) | DC zależy od widoczności Remnantu (sekcja 14); porażka kosztuje 1 Sanity |
| Analyze | Head | 1 | Rozpoznaj Neutral Truth Bullet albo poproś GM-a o wskazówkę | DC zależy od widoczności (sekcja 14); porażka blokuje ten Truth Bullet do końca rozdziału. Wskazówka: 14 subtelna, 18 bezpośrednia, a krytyk pozwala zadać ci jedno pytanie. Find Stash: 16. Find Passage: 16 (sekcja 9.6). W Class Trial jest tylko rozpoznanie, a wskazówka, skrytka albo przejście, o które ktoś i tak poprosi, są odrzucane, zanim cokolwiek zostanie zapłacone; bez akcji Analyze kosztuje tam 1 Hope, a gdy Hope się skończy, 1 Sanity |
| Infiltrate | Shadow | 1 | Listen: dowiedz się, kto jest obok, bez twojego rozstrzygnięcia; albo jedna z siedmiu pozostałych akcji kafelka (pod tabelą) | Pokój wybiera się przed rzutem. 14: ile osób w nim jest; 18: kto to jest, z imienia; krytyk: kto jest w każdym sąsiednim pokoju. Odpowiedź to prywatna karta. Sąsiad, którego słuchający nie odkrył, ma tylko nazwę „Nieodkryty pokój 1, 2...” na liście wyboru i w odpowiedzi |
| Palm | Shadow, potem Hand (Frisk jawnie: bez rzutu albo Body po odmowie lub braku odpowiedzi) | 1 | Wyjmij coś z cudzej kieszeni, zostaw coś w niej albo zobacz, co nosi | Kradzież: 12 na powodzenie, 15 na Shadow, by nikt nie zauważył. Podłożenie: 8, niezauważone 13; przy pełnych kieszeniach przedmiot zostaje u podkładającego, akcja zostaje wydana, a cel nie dowiaduje się niczego. Frisk jawnie: bez rzutu, gracz celu odpowiada w ciągu 60 s, a za postać bez gracza odpowiadasz ty; przeszukujący może wymusić Frisk rzutem Body 12 po odmowie albo braku odpowiedzi, chyba że *Frisk: zmuszanie po odmowie* jest wyłączone (sekcja 10.5), i decyduje o tym w ciągu 30 s. Frisk w tajemnicy: ukradkiem Shadow 15, potem Hand 10 |
| Projects | statystyka projektu | 1 | Popchnij projekt w tym pokoju albo zaproponuj nowy, a ty go zatwierdzasz | 12: +1 postępu, 18: +2; krytyk: +2 i zwrot akcji |
| Facilities | brak | Short Rest 1, Long Rest 2; akcja pokoju według własnej ceny (sekcje 9.1 i 11) | *Odpocznij* albo użyj jednej z akcji pokoju, w którym stoisz | *Odpocznij*, poniżej |
| Dynamic Action | wybór GM-a (gracz proponuje) | 1 | Gracz opisuje coś, na co gra nie ma nazwy; ty ustalasz pasmo | *Dynamic Actions*, poniżej |
| Tamper | Shadow | 1 (zabójca, który sprząta w noc własnego morderstwa, płaci zamiast tego 1 Sanity); bez akcji nie ma Tamper | Usuń Remnant, przerób go albo podłóż taki, który wskazuje kogoś innego | Zasady Stage 6, czyli sprzątania po morderstwie (sekcja 13.3). Sięga tylko Remnantów w twoim pokoju, których Truth Bullet masz, a przy otwartym incydencie także jego Incident Remnantów, jeśli jesteś jego ofiarą albo jednym z zabójców |
| Direct Murder | brak | 1 | Otwórz Direct Murder: zabójstwo uzgodnione wcześniej z tobą | Zgłaszane w Eclipse (sekcja 13) |

**Move** nie jest kafelkiem: akcją jest przeciągnięcie tokenu, a cenę płaci się, gdy token dotrze do innego pokoju. **Sabotage** to trzecia gałąź menu Projects i rzuca statystyką projektu, który psuje.

**Infiltrate** wymienia swoje wiersze w tej kolejności; każdy kosztuje 1 akcję, a sekcja 4 podręcznika gracza opisuje każdy w całości.

| Wiersz | Rzut | Co robi |
|---|---|---|
| Listen | Shadow | wiersz kafelka z tabeli wyżej |
| Echoes | bez rzutu | Podaje najbliższy pokój, w którym stoi żywy uczeń innego gracza, nigdy nie mówi, kto |
| Tail Someone | Shadow 15, by pozostać niezauważonym, potem Leg albo Shadow, które GM wybiera na karcie | Śledzi innego ucznia |
| Dash | Leg | 12 daje 2 darmowe przejścia, 18 daje 3, krytyk 4 |
| Shut the Door | Body | Barykaduje od środka pokój, który ma najwyżej dwoje drzwi |
| Force the Door | Body | Barykada ustępuje wynikowi wyższemu niż jej własny, zamek albo pieczęć ustępuje przy 18 |
| Pick the Lock | Shadow 16, by pokój za drzwiami nie zobaczył, kto, potem Hand 15 | Otwiera zamek albo pieczęć tylko dla otwierającego, dopóki nie wyjdzie z pokoju za drzwiami; jego własny pokój zawsze widzi, kto to. Właściciel sypialni dowiaduje się o zamku otwartym poniżej 18 i o pudle z Despair; krytyk nie ostrzega nikogo |
| Keep Watch | Body 12, przed Eclipse, ale nie wieczorem (przed nocnym Eclipse warty nie ma) | Wynik poniżej 12 nie daje warty; warta 18 albo krytyk dokłada jedną kość utrudnienia do rzutu otwarcia tego, kto otworzy morderstwo na pilnującym (sekcja 13.1). Kość utrudnienia to jedna kość disadvantage, którą okno zabójcy podaje bez jej przyczyny |

**Kto wybiera statystykę.** Rzut, którego definicja wymienia jedną statystykę, rzuca nią i nikogo nie pyta. Gdy akcja wymienia kilka, gracz proponuje jedną w oknie akcji, pod wyborami (*Którą statystykę proponujesz?*), i może dopisać, jak to robi (*Jak to robisz? (opcjonalnie)*); ty rozstrzygasz na jednej karcie w jego wątku: **Zatwierdź** proponowaną, **Zmień na** inną statystykę z listy rzutu (innych karta nie oferuje) albo **Odmów**. Gdy to ty rzucasz za postać, okno na twoim ekranie daje **Zatwierdź**, **Zmień na** dla każdej innej statystyki z listy i **Anuluj**, które niczego nie rzuca; w tym oknie nie ma **Odmów**. Przed twoją odpowiedzią nic nie schodzi, a odmowa nic nie kosztuje, z jednym wyjątkiem: Direct Murder zabójcy zużywa akcję już przy zgłoszeniu, więc **Odmów** na jego karcie tej akcji nie oddaje.

Po **Zmień na** okno gracza mówi, na jaką statystykę ją zmieniono, i daje **Rzuć** z tą statystyką albo *Rezygnuję (nic nie schodzi)*; rezygnacja zostawia jedną linię w jego wątku, a w walce menu kryzysowe otwiera się po niej znowu. Okno rzutu otwiera się wtedy na twojej odpowiedzi, zablokowane: *Zatwierdzone przez GM-a.*, *Zmienione przez GM-a.* albo, gdy gracz nic nie proponował, *Wybrane przez GM-a.* Kto wybiera, rzut po rzucie:

| Rzut | Wymieniane statystyki | Kto wybiera |
|---|---|---|
| Search | wszystkie sześć, Eye pierwsze | Eye: nikt nie jest pytany. Inna: gracz proponuje ją na karcie do ciebie |
| Praca nad projektem, Sabotage | jedna, statystyka projektu | nikt nie jest pytany; projekt zapisany bez statystyki raz dostaje propozycję gracza, a twoja odpowiedź zostaje jego statystyką |
| Dynamic Action | dowolna | ty ustalasz pasmo i statystykę; karta podaje tę, którą zaproponował gracz |
| Akcje kryzysowe (13.2) | od jednej do trzech, jak w tamtej tabeli | gracz proponuje, ty rozstrzygasz na karcie |
| Rzuty otwarcia (13.1) | zabójca: Body, Hand; ofiara pułapki: Eye, Head | ofiara pułapki: wybierasz ty; zabójca: proponuje zabójca, ty rozstrzygasz (13.1) |
| Sprzątanie w Stage 6 (13.3) | Shadow; Move the Body: Body | nikt nie jest pytany |
| Zabieranie z ciała (sekcja 10) | Hand, z Shadow 16 jako osłoną | nikt nie jest pytany |
| Observe, Analyze, Listen, Tamper, Palm | po jednej; Palm ma Hand, z Shadow jako osłoną | nikt nie jest pytany |
| Każdy rzut z kilkoma statystykami, przy uzbrojonym Resolve | dowolna | gracz, w oknie rzutu; nikt nie jest pytany |

**Samodzielne zatwierdzanie.** Ustawienie świata **Statystyki graczy bez zatwierdzania** jest domyślnie wyłączone. Po włączeniu propozycja gracza do Search na statystyce innej niż Eye albo do projektu zapisanego bez statystyki jest zatwierdzana bez twojego kliknięcia, ale tylko wtedy, gdy zegar jest w Daily Life, nie trwa żadne Eclipse i nie ma otwartego incydentu: karta w wątku gracza mówi *Zatwierdzone automatycznie.* i rzut idzie dalej jak po twoim kliknięciu, a gdy to ty rzucasz za postać, żadne okno się nie otwiera. Automatyczne zatwierdzanie nigdy nie obejmuje akcji kryzysowej, sprzątania, otwarcia ani Dynamic Action, a Resolve od początku nikogo nie pyta. Przy wyłączonym ustawieniu każda propozycja czeka na ciebie.

**Dynamic Actions.** Opis gracza trafia do ciebie jako karta w jego wątku komunikatora z przyciskami **Ustal trudność** i **Odmów**. Wybierasz pasmo i statystykę; karta podaje tę, którą gracz zaproponował, jeśli zaproponował, a odmowa nic gracza nie kosztuje. Rzut zdaje pasmo, gdy osiągnie jego liczbę (13 zdaje „przebij 13”); oba okna mówią „przebij N”, a karta rzutu „potrzeba N”. Sukces zostawia Faint Prep Remnant o widoczności pasma i daje ci kartę z przyciskiem, który otwiera tabele przedmiotów na Tierze pasma, z wpisanym pokojem i słowami gracza; nic nie zostaje dane, dopóki tego nie dasz. Reroll, który zamienia porażkę w sukces, przynosi tę samą kartę.

| Pasmo | Przebij | Tier | Remnant |
|---|---|---|---|
| Trywialne. Każdy by to zrobił | 8 | 0 | Obvious |
| Wymaga wprawy | 13 | 1 | Evident |
| Obce większości ludzi | 16 | 2 | Subtle |
| Wymaga bardzo niszowej wiedzy | 19 | 3 | Hidden |

Łatwy wyczyn zostawia wyraźny Remnant, a trudny ledwo widoczny. Search działa odwrotnie: lepsze znalezisko zostawia wyraźniejszy Remnant.

**Dynamic Action nigdy nie zastępuje przeszukania.** Gracza, który chce coś w pokoju znaleźć albo zabrać, odsyłasz do Search, które zużywa jeden z Search Tokenów pokoju i losuje z jego tabel: naciśnij **Odmów** na karcie i powiedz to graczowi.

**Odpocznij.** **Long Rest** kosztuje **2 akcje**, daje wybór 2 z trzech opcji i można go wziąć **raz na sesję**. **Short Rest** kosztuje **1 akcję**, daje wybór 1 opcji i można go wziąć **raz na porę dnia**. Każdy działa tylko w pokoju z taką flagą (**Ustawienia pokoi** > **Facilities**); zasady przewidują Long Rest w sypialniach, więc daj sypialniom tę flagę. Oba liczą się w obrębie rozdziału: nowy rozdział zaczyna je od nowa, nawet w tym samym dniu, porze dnia i sesji.

| Opcja | Long Rest | Short Rest |
|---|---|---|
| Sleep | przywraca całe Health | przywraca połowę |
| Meal | przywraca całe Sanity | przywraca połowę |
| Breath | daje 2 Hope | daje 1 |

Wyniki **Sabotage**:

| Wynik | Psuje projekt tak, że potrzebuje | Remnant |
|---|---|---|
| 12 | prostej naprawy, 2 postępu | Subtle |
| 18 | złożonej naprawy, 6 postępu | Evident |
| Krytyk | naprawy w skali Desperacki, 8 postępu | Obvious |
| Porażka | - | i tak zostaje Hidden Remnant |

Gdy w pokoju jest ktoś jeszcze, sabotażysta rzuca też Shadow przeciw **16**, by ukryć, co robi; z Despair fuszeruje i sabotaż jest o 1 trudniejszy. Wynik z Despair przy świadkach poznają gracze uczniów obecnych w pokoju i GM-owie. Zepsuty projekt jest zamrożony do ukończenia projektu naprawy.

> [!NOTE]
> Uszkodzenie nakłada przeglądarka GM-a. Jeśli żaden GM nie potwierdzi na czas, rzut się udał, ale projekt może nie być zepsuty, a gracz dostaje wiadomość, żeby ci o tym powiedział.

**Krytyki** dają **2 Hope**. Rzut z Despair, w którym użyto przedmiotu trzymanego w ręku, zdejmuje z niego jeden punkt wytrzymałości, a przedmiot Tier 0 zużywa każdy rzut, który go użył, także krytyk (sekcja 10).

**Zapas na arkuszu postaci.** Daggerheart trzyma Health i Sanity jako to, co ubyło, a moduł pokazuje je wszędzie jako to, co **zostało**: dwa paski na arkuszu są pełne u nietkniętego ucznia i skracają się, gdy jest ranny, a każdy ma pod tytułem wiersz (**3 / 4**: ile zostało, a potem ile może być najwięcej). Kropki rysuje sam moduł i wyglądają tak samo, czy kropki Daggerheart są włączone, czy wyłączone; panel Event, tracker, paski tokenu i arkusz drużyny pokazują to samo. Zapas wpisujesz w polu na arkuszu, a moduł zapisuje to, co ubyło; gracz, który posiada ucznia, ma to pole tylko przy wyłączonym **Zablokuj graczom zasoby na arkuszu** (sekcja 6.3). Dwa paski tokenu ucznia też są zapasem i nie da się ich tam edytować: dwa pola w HUD tokenu są wyłączone dla wszystkich, także dla GM-a, więc zapas wpisujesz na arkuszu. Token Monokumy i NPC czyta się jak token ucznia (*Kto co czyta*, niżej), a każdy aktor, który nie jest postacią, ma paski Foundry. Wiersze arkusza drużyny to zapas, z wyłączonymi przełącznikami dla graczy.

**Kto co czyta.** Sanity jest prywatne: gracz, który nie posiada ucznia, także Obserwator, czyta jego Health, ale nie Sanity (**?** w wierszu arkusza) na arkuszu, w paskach tokenu, na arkuszu drużyny, w panelu Event i w trackerze; właściciel i GM-owie czytają oba. Token Monokumy i NPC (Poza klasą) czyta się tak samo, a jego paski pokazują to, co zostało; pasek Sanity widzą tylko właściciel i GM-owie, a pola pasków w HUD są wyłączone, więc zmieniasz je na arkuszu. Wiersze Monokumy i NPC na arkuszu drużyny czyta się tak samo.

**Breakdown i Wounded są publiczne na arkuszu**: kto otworzy arkusz postaci, czyta pod zasobami plakietkę każdego stanu, w którym postać jest, z jego nazwą i podpowiedzią, co robi; tak samo u ucznia, Monokumy i NPC. Publiczny jest tylko stan: inny gracz nadal czyta **?** przy Sanity, ale plakietka Breakdown mówi mu, że Sanity się skończyło. Żaden token nikomu nie pokazuje ikony tych stanów; nakładka śmierci nadal jest rysowana, a paleta statusów w HUD tokenu nadal wymienia oba statusy. Karta rzutu nigdy nie nazywa Breakdown: rzut w Breakdown pokazuje dodatkową kość jako Disadvantage każdemu czytelnikowi, a Breakdown mówią tylko własne okno rzutu rzucającego, odprawa kryzysowa, podgląd ceny i audyt GM-ów. Wszystko to dotyczy tylko tego, co rysują ekrany: każda przeglądarka nadal dostaje dane ucznia, status Breakdown i dane rzutu, a konsola je czyta (sekcja 1.6, *Co i tak ma każda przeglądarka*).

**Ikony stanów.** Breakdown, Wounded i nakładka śmierci to własna pikselowa grafika modułu, 16x16 jak ikony przedmiotów: nakładka śmierci jest na tokenie, a Breakdown i Wounded tylko na plakietkach stanów na arkuszu. GM, który wybrał własną ikonę śmierci w ustawieniu Automation Daggerheart, ją zachowuje (uwagi techniczne: sekcja 22.5).

**Pozostałe części arkusza.** Biografia to pole z podpisem **Przeszłość**, zapisywane, gdy z niego wyjdziesz, przy zmianie zakładki i przy zamknięciu arkusza; dla patrzącego, który nie może edytować arkusza, jest tylko do odczytu, a odświeżenie w trakcie pisania zachowuje tekst i miejsce. Gdy ktoś inny zapisze ją w trakcie twojego pisania, twój następny zapis niczego nie zapisuje i mówi o tym raz (*Ktoś inny zmienił w międzyczasie przeszłość tej postaci...*): twój tekst zostaje w polu, a ponowne wyjście z pola zapisuje go w miejsce tamtego. Arkusz Monokumy nie ma zakładki Ekwipunek (ani Biografii, W ręku i Experience): to, co Monokuma miał, zostaje w jego danych, nic nie jest usuwane ani przenoszone, a odznaczenie Monokumy przywraca zakładkę i przedmioty. Gdy jakaś część arkusza się nie narysuje, reszta nadal się rysuje, a główny GM dostaje jedno powiadomienie z nazwą tej części (*Części arkusza postaci nie udało się narysować: ...*).

**Jedna bramka, pięć arkuszy.** Co pokazuje arkusz, zależy od tego, czyj jest i kto patrzy. Arkusz **ucznia** pokazuje właścicielowi i GM-om siatkę akcji, a przy przedmiotach Użyj, Wyrzuć, Przekaż lub Udostępnij, skrytkę, Przedstaw i Analizuj. Arkusz ucznia, który **nie żyje**, pokazuje pieczęć **Nie żyje**, wiersz o tym, co zmarli nadal robią, i panel zmarłych; nagłówek nadal pokazuje Hope, akcje i Move, ale nie zaznacza zmiany Hope, a przy przedmiotach nie ma żadnego z tych przycisków. Arkusz Monocuba pokazuje jego własny panel, **Monocub**, z Confusion wśród kafelków i bez tych przycisków, bo Monocub gra dalej. Postać **Poza klasą** nie ma dla właściciela panelu akcji, Level Upu ani Calli, a GM-owie w miejscu panelu czytają wiersz, który mówi dlaczego. Arkusz postaci oznaczonej jako **Monokuma** pokazuje Despair Calls, bez części ucznia: bez nagłówków W ręku i Experience, bez Przeszłości, a grupa ekwipunku jest tylko na to, co Monokuma trzyma. Nikt inny (inny gracz, Obserwator) nie dostaje żadnej kontrolki na żadnym z pięciu arkuszy, a przy włączonym ustawieniu **Anonimowe arkusze postaci** czyta arkusz ocenzurowany: Health zostaje, a Sanity, Hope, statystyki i akcje są **?**.

**Arkusz, który nie mruga.** Trafienie, leczenie albo wydany lub dany Hope odświeża na miejscu każdą otwartą kopię arkusza, a pole, w którym ktoś pisze, zostaje na swoim miejscu (uwagi techniczne: sekcja 22.5).

---

## 6. Hope Calls i Despair Calls

### 6.1 Hope Calls

Gracz wydaje Hope Calls z arkusza postaci, a każdy Hope Call trafia do niego szeptem. Hope Calls są zablokowane podczas Eclipse, pod zaciemnieniem *Silence*, dla gracza trafionego Despair Callem Silence i dla zmarłych; zostają otwarte w incydencie i w Class Trial. Call, który zmienia rzut (Support, Experience albo Ultimate z Talent, Resolve, Loaded Die), kupuje się przez głównego GM-a, który pobiera Hope i uzbraja Call; bez połączonego GM-a takiego Calla nie da się kupić i nic nie jest płacone. Dwa Calle z Talent wymagają twojej decyzji.

| Call | Koszt | Efekt | Wymaga twojej decyzji |
|---|---|---|---|
| Support | 1 | Daje innemu uczniowi w tym samym pokoju przewagę na jego następny rzut; karta podaje, kto wydał Support. Uczeń, który ma już niewykorzystany Support, nie może dostać kolejnego, a wydający zachowuje wtedy swój Hope | nie |
| Talent | 1 | Jeden kafelek, dwa Calle: gracz wybiera Experience (dodaj doświadczenie do rzutu, do którego naprawdę się stosuje) albo Ultimate (przewaga na rzut, do którego Ultimate naprawdę się stosuje); każdy z nich zachowuje swoje zasady | tak |
| Contribution | 2 | +1 postępu do projektu, nad którym pracuje się w pokoju ucznia; przy planie morderstwa rzuca też na Hide the Traces, jak praca nad nim | nie |
| Sprint | 2 | Jedno dodatkowe przejście między pokojami w tej porze dnia, za darmo | nie |
| Reroll | 3 | Rzuć akcję jeszcze raz; poprzedni wynik zostaje cofnięty (*Reroll*, niżej) | nie |
| Resolve | 2 | Na jeden rzut gracz wybiera w oknie rzutu dowolną statystykę, wszędzie tam, gdzie akcja wymienia kilka, i nikt nie jest pytany. Resolve schodzi na rzut, na który go uzbrojono | nie |
| Burst | 4 | Następna akcja nic nie kosztuje, ile by nie kosztowała | nie |
| Relief | 4 | Short Rest teraz, bez akcji i bez pokoju do odpoczynku; nie zużywa Short Rest tej pory dnia. Breath jest w nim wyszarzony i odrzucany, bo oddałby mniej Hope, niż kosztuje Relief | nie |
| Loaded Die | 6 | Przy następnym rzucie jedna z dwóch kości, losowo, jest ustawiona na 12, a druga rzucona; krytyk jest tylko wtedy, gdy i ona wypadnie 12, a rzut z ustawioną kością Despair wychodzi z Despair. Jeśli kość nie zadziała (niektóre ustawienia kości ją pomijają), gracz dostaje Call z powrotem na następny rzut | nie |
| Bribe | 1 | Oferuje Monocubowi 1 Hope za przysługę; Hope schodzi tylko wtedy, gdy jego gracz przyjmie ofertę. Nikt inny o Bribe nie wie (sekcja 8) | nie |

**Reroll** rozlicza to, co rozliczyłby świeży rzut tymi kośćmi: Hope, Fear i drugi Hope za krytyk tylko przy włączonej w Daggerheart automatyzacji Hope i Fear dla graczy, a Despair tylko przy włączonym **Rzuty dają Despair**. Fear to własny zasób GM-a w Daggerheart; *Zastąp licznik Fear z Daggerheart* (sekcja 1.3) chowa jego pasek. Na akcji kryzysowej, która kogoś zabiła, nie da się zrobić Rerolla: śmierć zostaje. Close the breach, Repair an item i Secret Passage są zachowywane dla Rerolla rzutu, który je ukończył. Remnant z twoim zapisem, Remnant, który ktoś już znalazł (gdy Reroll by go usunął), i Remnant starszy, niż sięga Reroll, zostają po Rerollu bez zmian, a ty dostajesz wiadomość, które to są, do rozstrzygnięcia ręcznie. Reroll rzutu, który wylosowała przeglądarka GM-a, rzuca go jeszcze raz tak, jak go policzono, tymi samymi kośćmi. Bez połączonego GM-a Reroll się nie odbywa, a drugi Reroll tej samej postaci jest odrzucany, dopóki trwa pierwszy.

Po przeładowaniu okno Rerolla nadal nazywa rzut, który cofa: na twoim ekranie rzut, który wiersz GM-ów trzyma dla tej postaci, z jego akcją i kośćmi; na ekranie gracza jego ostatni rzut na czacie, z linią, że o tym, który rzut Reroll cofa, decyduje wiersz GM-ów. Reroll, który zamienia sukces Dynamic w chybienie, wyszarza u GM-ów kartę tego sukcesu, obok karty chybienia, z linią *Reroll zmienił ten rzut w chybienie*. Gdy GM już odpowiedział na kartę sukcesu, karta zostaje, jak była, a GM-owie dostają o tym wiadomość ze słowami gracza; to, co na niej dano, zostaje, dopóki tego nie cofniesz.

**Reroll przerwany przeładowaniem** przeglądarki, która go robi, jest naprawiany, gdy wczyta się świat głównego GM-a. Przerwany, zanim nowe kości zaczęły się liczyć: wraca pierwszy rzut i Hope, a gracz i ty dostajecie o tym wiadomość. Przerwany, gdy akcja była wykonywana ponownie: dostajesz kartę z postacią, akcją i oboma wynikami; sprawdź ręcznie, co akcja zostawiła (postęp, przedmioty, Remnanty, obrażenia, turę), i rozstrzygnij to, a Hope zostaje zapłacony i na tym rzucie nie da się już zrobić Rerolla. Przerwany, gdy Hope był płacony albo zwracany: zostaje pierwszy rzut, a ty dostajesz wiadomość, by ręcznie sprawdzić Hope tej postaci.

**Zatwierdzanie Experience i Ultimate.** Gracz musi napisać, co chce zrobić z Callem; puste pole anuluje, bo decyzja dotyczy tego zdania. Prośba ląduje jako karta w wątku komunikatora gracza, widoczna dla gracza i każdego GM-a, z przyciskami **Zatwierdź** i **Odmów**. Odpowiedzieć może każdy GM, a Call uzbraja tylko zgoda: przed nią nic nie jest pobierane, a odmowa albo milczenie nic gracza nie kosztuje. Karta mówi, do kiedy jest otwarta (**pięć minut**). Jeśli twoja przeglądarka przeładuje się z otwartym pytaniem, przeglądarka gracza zapyta ponownie, gdy wrócisz, a pytanie zostaje przy swojej karcie. Karta, której główny GM wyszedł, znów przyjmuje zgodę, gdy przeglądarka gracza zapyta nowego głównego (sekcja 6.3). Po odpowiedzi karta zmienia się w wątku w potwierdzenie odpowiedzi.

> [!TIP]
> Pytanie, które warto zadać: czy doświadczenie albo talent *naprawdę* się tu stosuje?

### 6.2 Despair Calls

GM wydaje Despair Calls z arkusza Monokumy, z puli, z której ten Monokuma czerpie. Każdy Despair Call poza Bounty (ostatni wiersz tabeli) jest ogłaszany całemu stołowi. Karta nie podaje tajnego projektu ani pokoju ucznia z Chained: Game Integrity albo Patronage na tajnym projekcie mówi stołowi tylko, że zmienia się postęp projektu, a ty i ci, którzy o projekcie wiedzą, dostajecie jego nazwę i postęp na osobnej karcie; pokój podaje własne powiadomienie ucznia z Chained. Despair Calls są zablokowane podczas Eclipse i podczas Class Trial. Call, który niczego by nie zmienił, jest odrzucany, zanim zostanie opłacony, a jeśli efekt się nie powiedzie, Despair wraca.

| Call | Koszt | Efekt |
|---|---|---|
| Obstacle | 1 | Utrudnienie na rzut gracza |
| Approval | 1 | Przewaga na rzut gracza |
| Fuel a Monocub | 1 | 1 Despair staje się 1 Hope dla Monocuba, by mógł użyć Confusion |
| Feed the Overflow | 1 | Wlej 1 Despair do Overflow |
| Behind Closed Doors | 2 | Zapieczętuj pokój na jedną porę dnia |
| Paranoia | 2 | Gracz traci 2 Sanity |
| Chained | 3 | Jeden gracz nie może opuścić swojego pokoju do końca pory dnia |
| Game Integrity | 3 | Odejmij projektowi 2 postępu |
| Patronage | 3 | Dodaj projektowi 2 postępu |
| Pain | 4 | Gracz traci 2 Health |
| Silence | 4 | Jeden gracz nie może wydawać Hope Calls do końca pory dnia |
| Contraband | 4 | Zniszcz jeden dowolny przedmiot |
| Public Announcement | 6 | Zwołaj wszystkich do jednego pokoju na początek następnej pory dnia |
| Motive | 6 | Ogłoś Motive: żądanie, termin w porach dnia i cenę zignorowania |
| New Rule | 9 | Wprowadź jedną nową zasadę killing game |
| Bounty | 1 | Wybierany w kafelku Fuel a Monocub, który pyta: Fuel czy Bounty; nie ma własnego kafelka. Jedyny Call, który nie jest jawny: wiedzą Monocuby i GM-owie, nikt inny. Jeden Hope trafia do sakiewki pierwszego Monocuba, którego Confusion przeszkodzi wskazanemu uczniowi i trafi. Despair jest należny od teraz i schodzi w następnej porze dnia; mówi to karta GM-ów, a pasek Despair GM-a pokazuje Bounty jako dług. Nieodebrany Bounty wygasa w następnej porze dnia, a jego Despair wraca do puli: dług zostaje anulowany albo zwrócony, jeśli pula już go spłaciła; karta GM-ów mówi, które z dwóch, a Monocuby dowiadują się, że wygasł |

Obstacle, Approval, Support i Confusion Monocuba są uzbrajane na następny rzut celu, a okno rzutu nakłada uzbrojone Calle; Call uzbrojony po otwarciu okna celu czeka na jego następny rzut (okno to mówi). Utrudniający Call (utrudnienie albo ujemna premia) liczy się w rzucie, gdy okno rzutu go podaje albo gdy uzbrojono go ponad minutę przed rzutem; w przeciwnym razie czeka na następny rzut. Premia, którą uzbraja Call (pomoc Confusion), jest wpisywana w pole premii okna, tylko do odczytu, i idzie z rzutem, a Call zdjęty, gdy okno jest otwarte, zostawia pole puste.

Pieczęcie, Chained i Silence czyści otwarcie następnego Eclipse albo, gdy Eclipse nie jest używane, następna zmiana pory dnia. Public Announcement jest odroczone: zgromadzenie odbywa się na następnej granicy, a cofnięcie zegara je odwołuje.

**Motive** pyta o żądanie, termin od **1 do 10** pór dnia (domyślnie **3**) i konsekwencję. Jest ogłaszany wszystkim, odlicza się przy każdej zmianie pory dnia (Eclipse się do nich nie liczy), jest ogłaszany raz jeszcze, gdy minie termin, i zostaje na tablicy z zerem, dopóki go nie wycofasz albo rozdział się nie zmieni. **Zasady killing game**, kafelek okna **Ustawienia sezonu**, pokazują obowiązujący Motive, czas, który mu został, i jego cenę, z przyciskiem **Wycofaj**, który go zdejmuje i ogłasza to wszystkim.

**New Rule** trafia na listę zasad killing game, którą pokazuje każdy arkusz postaci; brzmienie edytujesz, zasady wycofujesz albo dodajesz w **Zasady killing game**. Pole **Ogłoś zmiany** jest domyślnie zaznaczone, a zapis wysyła wszystkim jedną kartę, *Zasady killing game się zmieniły*, z zasadami wprowadzonymi i cofniętymi. Zasada cofnięta i wprowadzona ponownie w jednym zapisie jest wymieniona raz, jako wprowadzona, a sama zmiana brzmienia niczego nie wysyła. Zasadę cofa się jej polem wyboru; zasada, którą opróżnisz, zachowuje brzmienie, a ty dowiadujesz się, która to. Zapis, którego nie udało się wykonać, mówi o tym i niczego nie ogłasza.

### 6.3 Decyzje, karty i komunikator

Każda akcja, o której musi zdecydować człowiek, przychodzi jako **karta w komunikatorze**: wskazówki Analyze, Dynamic Actions, zgłoszenia Direct Murder, propozycje projektów, przerobione Remnanty, alarmy pułapek i powyższe Calle. Komunikator to jeden wspólny wątek na gracza: gracz i każdy GM czytają i piszą w tej samej rozmowie. Wątek otworzysz przyciskiem w prawym dolnym rogu (lista z licznikami nieprzeczytanych) albo prawym kliknięciem na graczu w liście graczy Foundry. Lista zamyka się po kliknięciu poza nią albo w wiersz, a ponowne naciśnięcie przycisku nie otwiera drugiej.

Każdy GM ma własne znaczniki przeczytania. Wątek liczy się jako przeczytany tylko wtedy, gdy jego okno jest na wierzchu, na zakładce Czat, a strona jest widoczna; wiadomość, która przyjdzie, gdy okno leży pod innym, jest na zakładce Notatka albo w ukrytej zakładce przeglądarki, pokazuje swoją kartę i zostaje nieprzeczytana, dopóki nie spojrzysz. Karta, którą moduł wysyła do wątku gracza z twojej własnej sesji, też liczy się u ciebie jako nieprzeczytana, dopóki jej nie przeczytasz albo nie rozstrzygniesz. Wiadomość usunięta z dziennika czatu znika z każdego otwartego okna wątku.

Karta pokazuje rzut, własne słowa gracza i blok tylko dla GM-a z progami. Przyciski karty może nacisnąć tylko GM, a po naciśnięciu karta zmienia się w wątku w potwierdzenie decyzji, więc nikt nie rozstrzyga dwa razy; pod kartą możesz jeszcze odpowiedzieć słowami. Decyzja o postaci, której nie ma żaden gracz (aktor Monokumy, alarm pułapki), trafia zamiast tego do szeptów GM-a, z tymi samymi przyciskami. Gdy żaden GM nie jest połączony, pytanie gracza w ogóle nie zostaje wysłane: gracz czyta *Żaden GM nie jest połączony.* i odzyskuje to, co kosztowało.

**Jedna decyzja na kartę.** Kliknięcie GM-a, który nie jest głównym, idzie do głównego GM-a, a ten bierze kartę raz: drugi GM, który naciśnie tę samą kartę, czyta *Ta karta jest już rozstrzygnięta przez GM-a {gm}.* albo że inny GM właśnie ją rozstrzyga. Karta otwarta na nowo przez jej autora nie jest rozstrzygana drugi raz.

**Pytanie, na które gracz czeka** (Call Experience albo Ultimate, Dynamic Action, statystyka rzutu, który wymienia kilka, Observe na punkt zainteresowania), mówi na swojej karcie, do kiedy jest otwarte (*Otwarta do 21:40.*): pięć minut dla Calla, trzy dla pozostałych. Każdy czytelnik widzi tę godzinę i zdanie, którym karta się kończy, w swojej strefie czasowej i swoim języku. Twoja zgoda albo trudność idzie przez głównego GM-a, a karta pokazuje decyzję jako przekazaną dopiero wtedy, gdy przeglądarka gracza potwierdzi, że ją dostała. Jeśli gracz przestał czekać, w ciągu ośmiu sekund od decyzji nie przyszło potwierdzenie albo minął czas karty, karta kończy się u wszystkich słowami *Nikt nie odpowiedział na czas. Możesz zapytać jeszcze raz.*, a u GM-ów *Gracz już nie czekał.*; zgoda na Call zostaje wtedy cofnięta i nic nie jest pobierane.

Decyzja, której gracz już użył, nie jest cofana: zgoda, na której uzbroił Call, albo trudność, na której rzucił w Dynamic Action, kończy kartę jako rozstrzygniętą (*... zatwierdza prośbę.*), cokolwiek przeglądarka gracza powie potem. Trudność bez potwierdzenia i bez rzutu kończy się słowami *... odpowiada, ale nie wiadomo, czy odpowiedź dotarła.*: zostaje twoim zapisem, więc gracz nie dostaje prośby, żeby zapytał jeszcze raz. Tak samo kończy się decyzja, którą przeładowany główny GM znajduje tylko na karcie. Główny GM, którego świat się wczytuje, kończy otwarte karty po ich czasie. Jeśli przy otwartym pytaniu główny GM się przeładuje albo głównym zostanie inny GM, przeglądarka gracza zapyta jeszcze raz, najwyżej trzy razy, a pytanie zostaje przy swojej jednej karcie.

**Prywatna karta, której gracz nie dostał.** Treść karty prywatnej trafia tylko do przeglądarek połączonych w chwili jej wysłania. Czytelnik, którego nie było albo który otwiera grę w nowej przeglądarce, prosi połączonych GM-ów o tę treść, gdy wczyta się świat albo wróci GM. Każdy GM odpowiada z tego, co trzyma jego własna przeglądarka, tylko czytelnikom tej karty i bez bloku dla GM-ów. Linia napisana tylko dla tego gracza (*Tracisz 1 Health.*) wraca tak, jak była dla niego napisana. Karta, której treści nie trzyma żaden GM, brzmi *Prywatna karta. Jej treść nie dotarła do tej przeglądarki.* zamiast gołej kreski.

**Główny GM.** Dwóch GM-ów to norma. Jeden z nich jest **głównym GM-em**: to połączony pełny Gamemaster o najniższym id użytkownika, a Asystent GM-a jest głównym tylko wtedy, gdy żaden pełny Gamemaster nie jest połączony. Główny GM zapisuje stan świata: przyznany Despair, Search Tokeny, odkrycia, wyniki incydentu i każdą zmianę pul Despair i Overflow; kontrolki innego GM-a proszą głównego o zmianę pul Despair i Overflow. Pule usuniętych kont usuwa tylko główny GM. Jeśli coś „nic nie robi”, sprawdź, czy główny GM jest połączony.

**Rzuty graczy pod nieobecność GM-a.** Gdy nie jest połączony żaden GM, akcja gracza jest odrzucana, zanim gracz za nią zapłaci. Każdy inny rzut (statystyka z arkusza, reakcja, rzuty przedmiotów samego Daggerheart) wykonuje przeglądarka gracza: jego karta jest oznaczona *Rzucono bez połączonego GM-a, więc na razie rzut nie zmienia Hope, Sanity ani Despair. Gdy GM się połączy, zdecyduje, czy przyznać to, co rzut by zmienił.* i nie rusza Hope, Sanity ani Despair. Gdy GM się połączy, główny GM dostaje jedną kartę, **Rzuty graczy pod nieobecność GM-a**, a na niej przy każdym takim rzucie postać, kości Hope i Despair tak, jak rzuciła je przeglądarka gracza, i to, co rzut by poruszył. Reakcja nie rusza niczego, a statystyka z arkusza jest rzucana jako reakcja, więc nie rusza niczego nawet po przyznaniu. **Przyznaj wszystkie** daje każdemu rzutowi to, co by poruszył (Hope, Fear Daggerheart, Despair Monokumy), jeden raz; **Nie przyznawaj** nie daje niczego. W obu przypadkach każdy rzut zostaje oznaczony jako rozstrzygnięty i staje się wiadomością GM-a, więc nie wraca z pytaniem. Karta pyta, bo o jej kościach wie tylko przeglądarka gracza. Przy każdym rzucie karta mówi też, co rzut podał (jego modyfikator i kości przewagi) i co dałaby mu lista twojej przeglądarki; to tylko do twojej wiadomości, a przyznanie rusza to, co ruszyły kości.

**Co gracz zapisuje na własnym arkuszu.** Hope, Health, Sanity, akcje i statystyki zmieniają się w grze (przez rzut, odpoczynek, przedmiot, Call, Level Up), a przeglądarka głównego GM-a sprawdza każdą zmianę, jaką przeglądarka gracza robi na jego własnym uczniu, jego przedmiotach modułu i efektach na nich, względem tego, co trzymają GM-owie. Zmiana, którą coś uzasadnia, zostaje: oddana zapłata, którą twoja przeglądarka widziała, odpoczynek w pokoju, który na niego pozwala, przedmiot użyty i zużyty, cena Calla, znalezisko Search w tierze, na który zasłużył jego rzut. To, czego nic nie uzasadnia, idzie jedną z trzech dróg.

- **Cofnięte** od razu: gracz dowiaduje się, że klient GM-a cofnął zmianę, a GM-owie dostają jeden szept z tym, kto to był, który uczeń i każde pole przed i po. Dotyczy to:
  - przyrostu Hope, o tyle, ile nic nie uzasadnia, więc Hope podrobiony i od razu wydany i tak kosztuje prawdziwy Hope;
  - statystyki, doświadczenia albo maksimum (w tym punktów życia klasy);
  - reguł i premii rzutów Daggerheart oraz wyborów Level Up;
  - własnych zapisów modułu, Calla uzbrojonego ręcznie oraz utrudniającego Calla albo uzbrojonego przez GM-a, zdjętego bez rzutu gracza dotyczącego tego ucznia po jego uzbrojeniu;
  - zmienionego tieru, kategorii, ról albo rodzaju użytkowego przedmiotu modułu, obniżonego zużycia, naprawionego zniszczenia albo zwiększonej liczby;
  - przeniesienia do skrytki albo ze skrytki, na które pokój nie pozwala;
  - efektu, który zmienia którekolwiek z nich albo zasób, na uczniu albo na jednym z jego przedmiotów (przedmiot dodany z takim efektem jest usuwany).
- **Zgłoszone**: przyrost Health, Sanity albo akcji, przydziałów Burst i Sprint albo oddany Free Move, przedmiot modułu zdjęty z arkusza albo do niego dodany. Zmiana zostaje i gracz nie dowiaduje się niczego, a GM-owie dostają jedną kartę z **Cofnij** i **Zostaw**; kliknąć może każdy GM, a przeglądarka głównego GM-a rozstrzyga raz. Cofnij zapisuje pole z powrotem tylko wtedy, gdy wciąż trzyma ono to, co zostawiła zmiana; pola, które od tego czasu się ruszyło, nie nadpisuje, a karta to mówi. Cofnij tworzy na nowo usunięty przedmiot albo usuwa dodany. Kartę można rozstrzygnąć przez dobę.
- **Na liście**: wszystko inne, na liście, którą czytasz z konsoli (sekcja 20.3). Lista trzyma też to, co wymienia sekcja 1.6: odrzuconą prośbę, podrobioną wiadomość i cofniętą zmianę, każdą z tym, czym była. Ta sama odrzucona albo podrobiona prośba od tego samego gracza w ciągu pół minuty liczy się na swoim wierszu, zamiast dodawać nowy. Przyrost Hope, który przekaźnik Daggerheart zalicza za własny rzut gracza, którego twoja przeglądarka nie losowała, stoi na własnym wierszu z nazwą wiadomości tego rzutu.

Gdy karta pyta cię o zmianę na arkuszu gracza, użyj **Cofnij**, chyba że ta zmiana ma twoją zgodę. Twoich własnych zmian nic nie ocenia: od tej chwili to one są tym, co trzymają GM-owie, i tak ustawiasz ręcznie ruch, którego moduł nie zna.

**Zmiany pod nieobecność GM-a.** Zmianę zrobioną bez połączonego GM-a ocenia się, gdy wczyta się świat głównego GM-a: to, co zostałoby cofnięte, jest cofane od razu, a każda inna różnica (przyrost Hope, Health, Sanity albo akcji, odpoczynek, przedmiot zdjęty albo dodany) trafia na jedną kartę, **Zmiany na arkuszach pod nieobecność GM-a**. Karta ma wiersz na ucznia i pole, z wartością przed i po, z **Cofnij** i **Zostaw** przy każdym wierszu oraz **Cofnij wszystko** i **Zostaw wszystko** dla całości. Odpoczynek albo przedmiot użyty bez połączonego GM-a też trafia na tę kartę.

Ustawienie **Zablokuj graczom zasoby na arkuszu** decyduje o tym wszystkim w polach, które wymienia. Włączone (domyślnie) działa jak wyżej: pole zapasu na arkuszu postaci nie jest dla graczy rysowane, a na tokenie postaci pole paska w HUD tokenu, które nie jest Health ani Sanity ucznia (na przykład Hope), jest dla graczy wyłączone. Niezależnie od ustawienia kropki na arkuszu drużyny są dla graczy tylko do odczytu, a pola Health i Sanity ucznia w HUD tokenu zostają wyłączone dla wszystkich (sekcja 5, *Zapas na arkuszu postaci*). Przy wyłączonym ustawieniu pole zapasu jest rysowane dla gracza, który posiada ucznia, pozostałe pola pasków w HUD tokenu może on wpisywać, a jego zmiana w tych polach nie jest cofana ani zgłaszana: statystyka, maksimum, które ustawienie wymienia, albo przyrost Hope, Health, Sanity lub akcji (także leczenie wpisane w zapas) trafia na listę i zostaje, a spadek Hope, Health, Sanity lub akcji zostaje bez wiersza. Przedmioty, efekty i zapisy modułu są oceniane tak czy inaczej.

---

## 7. Pule Despair, przydziały i Overflow

**Zdobywanie.** Gdy rzut ucznia wypadnie z wyższą kością Despair, **+1 Despair** idzie do puli Monokumy przypisanego temu uczniowi, o ile włączone jest ustawienie **Rzuty dają Despair**. Rzuty reakcji (gołe kliknięcie statystyki) nie dają Despair, tak samo jak własne rzuty Monokumy. Uczeń ustawiony na **- nikt -** nie zasila żadnej puli: użyj tego dla postaci wycofanej albo prowadzonej jako NPC, albo dla szablonu. Nie ustawiaj Masterminda na **- nikt -**: przeglądarka każdego gracza może odczytać podział, a jedyny uczeń poza pulami rzuca się w oczy. Lista kontrolna sezonu ostrzega cię, gdy Mastermind nie zasila żadnej puli (sekcja 2).

**Pule.** Każde konto pełnego Gamemastera ma pulę Despair, która mieści najwyżej **12**, a postacie Monokum wydają z tych pul. Pasek Despair u góry ekranu pokazuje każdą pulę pod jej nazwą, także gdy jest tylko jedna; to nazwa ustawiona w Despair Flow, a bez niej nazwa konta. Liczby widzą wszyscy, a GM-owie mają przy nich także przyciski do zmiany.

**Despair Flow** to jedno okno dla całego zespołu GM-ów: znajdziesz je w panelu GM-a > Między sesjami > Ustawienia sezonu. Ma cztery zakładki:

- **Pule**: nazwy pul i pule dodatkowe. **Dodaj pulę** przyznaje dodatkową pulę Asystentowi GM-a, a **Usuń pulę** ją odbiera.
- **Monokumy**: z puli którego GM-a czerpie każdy Monokuma. Kto jest Monokumą, ustawiasz w oknie Uczniowie, w kolumnie **Rola** (kolumna: sekcja 3; oznaczanie Monokumy: sekcja 8).
- **Uczniowie**: który Monokuma pilnuje którego ucznia, z **Podziel po równo** i **- nikt -**. Uczeń nigdy nieprzypisany zasila pierwszą pulę, a jego lista mówi *(domyślnie)*. **Zapisz** zapisuje tylko wiersze zmienione teraz albo ustawione wcześniej, więc domyślny zostaje domyślnym.
- **Overflow**: próg Overflow i jego efekty (niżej).

Podręcznik zasad gry, według którego działa moduł, zakłada co najmniej dwóch GM-ów, którzy ściśle dzielą uczniów między siebie, ale moduł działa i z jednym. Przy jednym GM-ie, bez Asystenta GM-a, któremu można przyznać pulę, nie ma czego wybierać: okno otwiera się na zakładce **Overflow**, a trzy pozostałe chowa pod **Pokaż pule, Monokumy i uczniów**.

**Zamiana Despair w Hope** (1:1) to decyzja GM-a, nigdy przycisk samoobsługowy: tak zasila się Monocuba i tak Mastermind utrzymuje się na powierzchni. Prowadzą do niej dwie drogi i obie dopisują Hope tak samo, z prywatną kartą dla odbiorcy, która nazywa płacącą pulę.

- **Cicha droga** to okno Uczniowie albo okno Masterminda i działa także w Class Trial. Prośba o więcej, niż pula może wydać, albo o więcej, niż mieści się pod maksimum Hope odbiorcy, daje tyle, ile się mieści; odmawia tylko pula, która nie ma nic do wydania, albo odbiorca z pełnym Hope.
- **Fuel a Monocub** (sekcja 6) to droga jawna: Despair Call opłacony od razu, z własną kartą. W Class Trial go nie ma.

**Dług puli.** Hope odbiorcy przychodzi od razu, a pula dawcy płaci dopiero przy następnej porze dnia, kiedy inne pule też mogły się zmienić, i to prywatną kartą, więc stół nie połączy Hope ze spadkiem puli. Do zmiany pory dnia pula pokazuje więcej, niż może wydać: każdy Call, każda zamiana i każda lista wyboru liczy tylko to, co pula może wydać, a listy pokazują, ile pula jest winna („Kuma (5, 2 do spłaty)”: 5 może wydać, 2 jest winna).

Tylko ekran GM-a pokazuje dług także na samej puli: czaszki do spłaty na pasku Despair są przygaszone, podpowiedź licznika mówi *2 do spłaty przy następnej porze dnia*, okno **Despair** dopisuje *(2 do spłaty)*, a GM, który daje Hope z okna Uczniowie, z okna Masterminda albo na Ask for Hope Monocuba, dostaje komunikat *2 Despair do spłaty z puli Kuma. Pula płaci przy następnej porze dnia; dług widzą tylko GM-owie.* Ekran gracza pokazuje pulę bez zmian, dopóki nie zapłaci.

Despair, który nie mieści się w pełnej puli, najpierw spłaca to, co pula jest winna, a dopiero reszta wylewa się do Overflow. Napełnienie albo opróżnienie pul kasuje ich dług. Każda zamiana jest osobnym długiem, więc gdy dwóch GM-ów zamienia naraz z jednej puli, liczą się obie zamiany, a pula płaci raz, także wtedy, gdy przeglądarki jednego z GM-ów nie było przy spłacie. Zamiana zrobiona na ekranie innego GM-a dokładnie w chwili zmiany pory dnia może zostać niespłacona.

**Overflow.** Despair zdobyty ponad pełną pulę zbiera się w jednym liczniku, wspólnym dla wszystkich Monokum, a **Feed the Overflow** (sekcja 6) wlewa go tam celowo. Licznik odpala w chwili, gdy dojdzie do **progu**: płaci próg, zachowuje resztę i losuje **jeden** efekt spośród tych, które są zaznaczone. Karta przychodzi od razu; stan (zaciemnienie) obejmuje nadchodzącą porę dnia, a efekt jednorazowy dzieje się od razu. Jeśli jakieś zaciemnienie już trwa, licznik czeka do następnej granicy. Jest sprawdzany ponownie, gdy otwiera się Eclipse, i przy każdej zmianie pory dnia, a jedna granica płaci tylko raz.

**Próg** wynosi domyślnie 20 i możesz go ustawić od 6 do 60. Wiersz overflow na Liście kontrolnej sezonu (sekcja 2) i zakładka Overflow podsuwają próg dla twojego sezonu, 12 plus połowa żyjących uczniów, ale próg zostaje twój. Zapisanie zmienionego progu albo listy efektów ogłasza stołowi nowy próg. Opróżnione pole niczego nie zmienia, a wielkość efektu jest trzymana w granicach 0-5.

Na zakładce **Overflow** w Despair Flow próg stoi nad dwiema tabelami efektów: najpierw stany, potem efekty jednorazowe, w kolejności tabeli niżej. Każdy efekt ma swój wiersz: **Włączone** (zaznaczenie), **Efekt**, **Ile** (wielkość, tam gdzie efekt ją ma) i **Co robi**. Liczby niżej to domyślne wielkości.

| Efekt | Rodzaj | Co robi |
|---|---|---|
| Darkness | stan | O 1 mniej przejść w Eclipse (minimum 1); Eclipse z dowolnym rozstawieniem cofa się do 2 pokoi |
| Shift | stan | O 1 mniej Search Tokenów w każdym pokoju (minimum 1), nigdy więcej, niż ustawiono pokojom; świat ustawiony na 0 zostaje przy 0 |
| Panic | stan | O 1 akcję mniej dla każdego (minimum 1), ponad to, co zabiera Wounded |
| Despair | stan | Nie zdobywa się Hope; wydawanie tego, co masz, nadal działa |
| Silence | stan | Żadnych Hope Calls, u nikogo |
| Fog | stan | Brak Free Move; przejścia nadal kosztują akcje |
| Lockdown | stan | Żadnych akcji pokoju w kafelku Facilities; Short Rest i Long Rest nadal działają |
| Insomnia | stan | Brak Short Rest; Long Rest nadal działa |
| Toll | stan | Każda akcja pokoju kosztuje o 1 akcję więcej (wielkość), także akcja pokoju z projektu, która nic nie kosztuje |
| Jitters | stan | Rzuty na akcje samego pokoju są z utrudnieniem; to akcje, które ustawiasz w Ustawieniach pokoi |
| Power cut | stan | Żadnych akcji z ukończonych projektów; akcje samego pokoju nadal działają |
| Rot | jednorazowy | Każdy przedmiot, któremu zostało więcej niż jeden punkt wytrzymałości, traci 1; ostatniego punktu Rot nigdy nie zabiera, więc nic się nie psuje |
| Earthquake | jednorazowy | Każdy projekt jeszcze nieukończony i niezamrożony traci 1 postępu |

> [!TIP]
> Odznacz wszystkie trzynaście, a licznik będzie rósł i nigdy nie odpali: to pełnoprawne ustawienie: licznik buduje wtedy tylko klimat. Pięć stanów akcji pokoju (od Lockdown do Power cut) jest na starcie zaznaczonych i bierze udział w losowaniu jak reszta. Losowanie jest równe: przy wszystkich trzynastu zaznaczonych każdy efekt wypada raz na 13. Odznacz te pięć, jeśli chcesz losować tylko z pozostałych ośmiu.

**Werdykt Class Trial opróżnia Overflow**, jakikolwiek by był, a reset sezonu też. Zaciemnienie ogłoszone w trakcie Class Trial i tak przychodzi: jego karta mówi, że zacznie się od następnej pory dnia; werdykt każe mu czekać, a przynosi je następna pora dnia albo otwierające ją Eclipse, bez ponownej opłaty i bez drugiej karty. Reset sezonu czyści także takie zaciemnienie.

Gracze widzą liczby w pulach i próg Overflow, ale zamiast jego licznika widzą „?” („?/20”): kiedy Overflow odpali, wie tylko Monokuma. Licznik trzymają tylko GM-owie, a tobie pokazuje go Despair Flow. Uwagi techniczne są w sekcji 22.

**Ręczne czyszczenie.** Pod licznikiem na zakładce Overflow jest **Wyczyść overflow**. Najpierw pyta, z **Anuluj** jako domyślnym, a potem zeruje rozlany Despair, ktokolwiek z GM-ów go naciśnie. Zaciemnienie, które już wylosowano, trwa do końca swojej pory dnia.

---

## 8. Monokuma, Monocuby i Mastermind

**Monokuma** to postać, którą tworzysz specjalnie w tym celu. Oznaczasz ją w oknie Uczniowie, w kolumnie **Rola** (**Monokuma**), albo przyciskiem **Oznacz jako Monokumę** w nagłówku arkusza postaci: to kontrolka GM-a obok **Poza klasą**, która pokazuje stan, jaki zmienia, więc przy Monokumie mówi **Zdejmij oznaczenie Monokumy**. Oznaczenie postaci gracza najpierw pyta, z **Anuluj** jako domyślnym, bo ustawia jej Hope i akcje na 0; zdjęcie oznaczenia nie pyta i ich nie oddaje.

- Monokuma nie ma ekonomii akcji ani Hope.
- Zamiast siatki akcji Monokuma ma Despair Calls.
- Monokuma porusza się bez ograniczeń: bez kosztów pokoi, ścian, limitu Eclipse i pieczęci.
- Widoczność pokoi nigdy nie ukrywa Monokumy przed nim samym.
- Rzuty Monokumy idą szeptem tylko do GM-ów i nie zasilają żadnej puli.
- Monokuma nie liczy się jako świadek incydentu ani ciała.

Podręcznik zasad każe GM-om chodzić po mapie jako dwa Monokumy, które stół potrafi rozróżnić. Skieruj każdego Monokumę na pulę jednego GM-a (zakładka **Monokumy** w Despair Flow, sekcja 7); od tego samego przypisania zależy też głos w pokojach.

**Poza klasą** to kontrolka GM-a w nagłówku arkusza postaci, przeznaczona dla NPC. Z nią postać wypada z głosowań, Level Upów, obsady morderstwa, panelu GM-a, spisu i Calli: żaden Support, Obstacle ani Approval nie podaje jej jako celu, a Support wymierzony w nią z konsoli gracza jest odrzucany. Jej arkusz nie ma panelu akcji, Level Upu ani Calli i mówi dlaczego: *Poza klasą: bez akcji, głosów i Level Upów.* Naciśnij **Poza klasą** jeszcze raz, by postać znów była uczniem. Zapis tego oznaczenia przez gracza jest cofany, tak jak przy Monokumie. Lista kontrolna sezonu wymienia każdą postać, której nie ma żaden gracz, w wierszu *Postacie bez gracza są oznaczone*, z radą: *Postać, której nie gra żaden gracz, to pewnie NPC: oznacz ją na jej arkuszu jako „Poza klasą” albo zostaw, jak jest.*

**Widz** to gracz, który ogląda i nie gra. Ustawiasz go w oknie **Uczniowie**, Rola **Widz**. Widz nie wykonuje akcji i nie liczy się w żadnym głosowaniu, Class Trial, incydencie ani pokoju. Inni gracze nie widzą jego tokenu, a ty widzisz go blado. Porusza się, przeciągając token, bez żadnego kosztu. Jego mikrofon jest wyłączony: **Porozmawiaj z Widzami** na jego kafelku głosu przenosi go na osobny kanał głosowy Widzów, a **Wróć do swojego pokoju** sprowadza go z powrotem. Gdy **Kafelek głosu zamiast doku kamer** jest wyłączony, przycisku do rozmowy z Widzami nie ma. Widz nie ma czatu, ale gracz z konsolą przeglądarki nadal przeczyta publiczne wiadomości.

Widz widzi każdy pokój, który odkryła klasa, każdy token oraz nazwę, postęp i opis każdego projektu w każdym pokoju, także tajnego. Niczego innego tajnego nie widzi, nigdy twojej połowy tajnego projektu. Na koniec dnia widzi tylko koniec dnia i nastrój szkoły. Gdy znów zrobisz z niego ucznia, zachowa pokoje, które odkrył sam, i straci tajne projekty, które mu pokazano, zanim został Widzem.

**Zmarli jako Widzowie.** Gdy uczeń ginie i nie jest Monocubem, moduł daje jego graczowi własnego Widza: nową postać z imieniem, portretem i obrazem tokenu ucznia, należącą tylko do tego gracza, z tokenem tam, gdzie leży ciało. Token ciała zostaje zwłokami. Gracz przeciąga Widza dokądkolwiek, bez kosztu; inni gracze go nie widzą, a ty widzisz go blado. Zmarły nadal widzi tylko to, co widzi zmarły uczeń: Widz wprowadzony do pokoju nic mu tam nie pokazuje. Jak rozmawiają zmarli, mówi sekcja 9.5.

Uczeń, którego gracz jest w chwili śmierci offline, nadal należy do tego gracza i dostaje Widza. Uczeń, którego w chwili śmierci nie ma żaden gracz, to NPC i Widza nie dostaje. O Widzu NPC ze starszego świata mówi sekcja 22.

Widz powstaje w chwili śmierci, także śmierci, którą ukrywasz. Nowa postać i jej token są danymi świata, więc gracz z konsolą przeglądarki może się z nich dowiedzieć o tajnej śmierci, zanim ktoś znajdzie ciało.

Przy śmierci w grze (morderstwo albo przycisk wiersza **Postać umiera**) ekran zmarłego ucznia gaśnie, a dźwięk **Gaśnięcie** gra tylko dla niego; ustawiasz go w oknie Dźwięk, w grupie Incydent, a bez pliku gra dźwięk śmierci. Dźwięk samej śmierci, który słyszą GM-owie i pozostali gracze incydentu, pomija zmarłego ucznia, więc słyszy on jeden dźwięk. Egzekucja nie wygasza ekranu: wszyscy słyszą dźwięk egzekucji, a potem końca rozprawy. Zmiana z listy w oknie Uczniowie, Edytuj kampanię albo reset sezonu tworzy lub zabiera Widza bez gaśnięcia.

Wskrzeszenie zabiera Widza. Gdy dwóch GM-ów naraz tworzy Widza tego samego ucznia, główny GM zostawia jednego, a drugiego usuwa. Gdy uczeń zostaje Monocubem, token Widza zostaje tam, gdzie stoi, i staje się własnym tokenem Monocuba, postać Widza znika, a token ciała zostaje. Kto przestaje być Monocubem, a nadal nie żyje, dostaje Widza z powrotem na tym tokenie.

**Ciało na mapie.** Gdy uczeń umiera, a jego śmierć staje się jawna dla stołu (od razu albo gdy śmierć zatrzymana przez GM-ów zostanie znaleziona albo gdy ją ujawnisz), moduł zostawia jego ciało jako kafel tam, gdzie w tej chwili leży jego token. Śmierć pokazuje więc na mapie dwie rzeczy: własny token ucznia, czyli ciało, ze znacznikiem śmierci i podpisem „Ciało: {name}” nad nim, oraz jego Widza. Kafel ciała jest całkiem przezroczysty i to z niego moduł odczytuje, gdzie leży ciało; jest ukryty, jeśli token jest ukryty, a na warstwie kafli nadal możesz go zaznaczyć i usunąć. Śmierć, którą ukrywasz, nie zostawia kafla, dopóki nie stanie się jawna, więc żaden ekran nie dowie się o niej wcześniej.

Dopóki uczeń leży martwy, kafel idzie tam, gdzie jego token, gdy go przeciągniesz albo gdy zabójca użyje Move the Body; gdy uczeń zostanie Monocubem, token odchodzi, a kafel zostaje. Ciało przeszukuje się z pokoju kafla; gdy usuniesz kafel, znów z pokoju tokenu, i nic nie położy kafla na nowo. Każdy kafel ciała znika, gdy kończy się Class Trial, także kafel straconego, położony przez wyrok i zabrany tym samym kliknięciem, a kafel ucznia znika, gdy uczeń wraca do życia albo przy resecie sezonu. Uczeń, którego tokenu nie da się odczytać na scenie z pokojami, nie zostawia kafla i dostajesz o tym informację, poza śmiercią w Class Trial. Ciało, którego token przeniesiesz na inną scenę, zostawia kafel tam, gdzie leżało.

**Monocub**: gracz zmarłego ucznia może dołączyć do GM-ów, gdy jego śmierć stanie się jawna dla stołu. Moment zaproszenia wybierasz ty, moduł wymaga tylko, by śmierć była jawna. **Zaproś jako Monocuba** w oknie **Uczniowie** wysyła zaproszenie: okno gracza pokazuje Zasadę Monocuba (*Nigdy nie mówisz żywym tego, co wiedzą tylko zmarli: kto cię zabił, jak, ani co widzisz od teraz.*) i jej trzy kroki na wypadek złamania (rozmowa, odebranie roli, wypadnięcie z gry). **Przyjmuję Zasadę** robi z gracza Monocuba, a **Nie teraz** zamyka zaproszenie i dostajesz o tym informację; otwarte zaproszenie możesz wycofać przyciskiem **Wycofaj**. Nic innego nie zmienia ucznia w Monocuba.

Monocub zaczyna od zera: 0 Hope, pełne Health i Sanity, bez Wounded i Breakdown, cokolwiek miało przy sobie ciało, a Wounded nigdy nie odbiera mu akcji. Zachowuje ten sam arkusz. Jego token chodzi swobodnie: przechodzi do połączonego pokoju bez akcji i bez Free Move, także podczas Eclipse, bez kafelka Move, a dwie stopy w nagłówku arkusza i na pasku stanu Monocuba są zawsze pełne. Do pokoju, w którym trwa morderstwo, Monocub nie wejdzie, a komunikat brzmi jak przy pieczęci.

Panel Monocuba daje te kafelki i nic więcej, a kafelek, którego nie da się użyć, mówi dlaczego. Poza Ghost Bet żaden nie działa w Eclipse ani w Class Trial.

- **Confusion** (**1 akcja + 1 Hope**): płaski rzut 2d12 bez statystyki, z **Pomóż** albo **Przeszkódź**, który wpływa na żyjącego ucznia w tym samym pokoju (tabela niżej).
- **Tinker** (**1 akcja + 1 Hope**): Confusion wymierzone w jawny, nieukończony projekt w pokoju Monocuba, nad którym w tej porze dnia pracował żyjący uczeń. Wynik 12 lub więcej przesuwa projekt o krok do przodu albo do tyłu, nigdy do ukończenia, a krytyk oddaje Hope. Tinker nigdy nie pokazuje na liście ani nie sięga żadnego tajnego projektu.
- **Redeem** (za darmo): +1 Hope, raz na dzień gry; nie działa przy pełnym Hope ani wtedy, gdy zaciemnienie blokuje Hope.
- **Ask for Hope** (za darmo, nie przy pełnym Hope): karta w wątku Monocuba z przyciskami **Daj 1 Hope**, **Daj 2 Hope** i **Nie teraz**, rozstrzygana raz przez GM-a, który kliknie, i płacona z Despair tego GM-a (sekcja 7). Naraz otwarta jest jedna, a ta, na którą nikt nie odpowiedział, przestaje blokować następną, gdy kończy się jej pora dnia.
- **Ghost Bet** (za darmo, niżej).

Monocub widzi każdy pokój, który znalazła klasa, bez tego, kto go znalazł, ale nie widzi pokoi Masterminda. Uczeń może być celem jednego Confusion na porę dnia i dwóch na dzień gry, licząc wszystkie Monocuby, także nieudane Confusion. To, co Monocub nosił, należy do jego ciała: arkusz nie daje Użyj, Wyrzuć ani otwartej skrytki, a ciało przeszukuje się jak każde inne.

Moduł najpierw sprawdza ruch, a dopiero potem bierze akcję i Hope, więc Monocub dowiaduje się o odmowie, a ta nic go nie kosztuje (uwagi techniczne są w sekcji 22). Karta celu nigdy nie mówi, kto to zrobił, ale pokój widział, jak Monocub rzuca: okno Confusion mówi o tym graczowi i wypisuje progi wyników, a karta wyniku mówi, ile było trzeba.

| Confusion | Daje (Pomóż) | Nakłada (Przeszkódź) |
|---|---|---|
| 11 lub więcej | +1 na następny rzut celu | -1 na następny rzut celu |
| 16 lub więcej | przewagę | utrudnienie |
| Krytyk (dublet) | oddaje celowi akcję | marnuje akcję |

Krytyk, który nie ma czego ruszyć, bo cel ma wszystkie akcje albo nie ma już żadnej do stracenia, mówi to na obu kartach.

**Hope i sakiewka.** Hope Monocuba pochodzi z zamiany Despair przez GM-a (Fuel a Monocub albo okno Uczniowie), z Redeem i z Ask for Hope. Bribe, Bounty i Ghost Bet płacą zamiast tego do jego **sakiewki**, którą GM-owie trzymają obok arkusza. Sakiewka liczy się razem z Hope do limitu Hope, wydaje się ją najpierw, a pokazuje ją kolumna Hope w oknie Uczniowie.

**Bribe** to Hope Call żyjącego ucznia: 1 Hope zaproponowany Monocubowi, płacony do jego sakiewki dopiero na „tak” jego gracza i wygasający przy następnej porze dnia. Karty Bribe idą tylko do tych dwóch graczy. Dostajesz szeptem ostrzeżenie, gdy Bribe pochodzi od Blackened tego rozdziału, i przy trzecim Bribe tej samej pary w rozdziale. Przyjęty Bribe robi z następnego Confusion albo Tinker Monocuba w tej porze dnia ruch na zlecenie, który kosztuje tylko akcję.

**Ghost Bet** wskazuje ucznia, którego skaże werdykt, a naraz trwa jeden zakład. Wygrana wynosi 4, 3, 2 albo 1 Hope, zależnie od tego, kiedy zakład postawiono: przed ogłoszeniem ciała, po nim, w rozprawie przed głosowaniem albo w trakcie głosowania. Krok werdyktu *Ghost Bet* płaci za trafny werdykt na tę osobę do sakiewki i czyści wszystkie zakłady. Ghost Bet nie jest dla Monocuba, którego własna sprawa trwa, ani dla świadka zbrodni.

Po błędnym werdykcie Monocub ze sprawy tej śmierci i każdy świadek zbrodni tego rozdziału dostają zasłoniętą kartę, która nikogo nie nazywa: do następnej rozprawy żadnych ruchów na korzyść ani na szkodę sprawcy, jego projektów, Bribe ani Ghost Bet. Twoje podsumowanie wymienia, kto ją dostał.

Pole **Świadek zbrodni** w wierszu Monocuba w oknie Uczniowie to zasada z podręcznika dla Monocuba, który widział zbrodnię, a podpowiedź kolumny ją podaje: taki Monocub może działać, ale do końca rozdziału nie może mówić o zbrodni. Gracz dostaje powiadomienie, gdy pole jest ustawiane i gdy zostaje zdjęte. Moduł sam je zaznacza Monocubowi, który stoi w pokoju morderstwa, gdy incydent się zaczyna, albo wchodzi do niego w trakcie, także przy pułapce; zaznacz je ręcznie Monocubowi, który widział zbrodnię inaczej. Oznaczenie trzymają GM-owie, a dostaje je tylko gracz tego Monocuba.

Kości Monocuba, także te z Confusion, widzą wszyscy w jego pokoju. Pokój nie widzi, w kogo Confusion wymierzono; tylko krytyk, który zmienia akcje celu, widać w danych, które ma każda przeglądarka.

**Mastermind** jest wybierany przed sezonem, za zgodą gracza, w Ustawieniach sezonu > **Mastermind** (Między sesjami). Kim jest, wiedzą tylko GM-owie: jego tożsamości nie zapisuje się ani na aktorze, ani w danych świata. Gracz Masterminda dostaje tylko prywatne „to ty” i pokój swojej kryjówki.

> [!CAUTION]
> Okno wymienia Masterminda, więc nie udostępniaj ekranu, dopóki jest otwarte.

**Kryjówka** Masterminda to pokój: dopóki w niej stoi, widzi każdy token na mapie, tak jak ty, a gdy z niej wyjdzie, traci ten widok. Zamknięte drzwi, pieczęcie, cudze sypialnie i ukryte skrytki stoją przed nim otworem wszędzie, a każdy pokój liczy się jako już odwiedzony dla jego mgły i dla jawnych projektów w nim, bo to on zbudował ten budynek. Mastermind zna każde tajne przejście (sekcja 9.6). Na swoim arkuszu może zamknąć albo otworzyć kryjówkę i zamknąć tajne przejście, które do niej prowadzi. Zamek kryjówki to ten sam zamek co w oknie **Ustawienia pokoi**, więc dla wszystkich innych to zwykłe zamknięte drzwi, a ty możesz otworzyć jeden i drugi zamek.

Z okna Masterminda Despair zamienia się w jego Hope **1:1**, gdy Mastermind jest już wybrany i zapisany (sekcja 7). Finał toczy się na zwykłym Class Trial:

| Element | Gdzie | Uwagi |
|---|---|---|
| Jeden **Final Truth Remnant** na rozdział | stawiany z zakładki **Final Truth Remnanty** w oknie **Investigation** | z samego typu jest Reinforced, więc nikt go nie usunie; ekran końca rozdziału przypomina, jeśli żadnego nie postawiono |
| Flaga **Final Trial** | przełączana z konsoli trialu | ogłaszana stołowi |
| Werdykt finału | wydawany przyciskiem werdyktu w konsoli Class Trial, który w Final Trial otwiera **Werdykt Final Trial** | trafny: Mastermind zostaje stracony, gdy rozprawa się kończy, i killing game się kończy; błędny albo gdy Mastermind już nie żyje: nikt nowy nie ginie, a stół poznaje prawdę |

---

## 9. Pokoje, regiony, mgła i odkrywanie, ruch, głos

### 9.1 Pokoje i Ustawienia pokoi

Pokój to **nazwany region sceny, który GM oznaczył jako pokój**: zaznaczasz go polem **To jest pokój** na zakładce **Pokoje** w Ustawieniach pokoi. Ruch, Search, Listen, Rest, głos i każdy incydent działają według pokoi. Region z zachowaniem Teleport albo zmiany poziomu nigdy nie jest pokojem, tak samo jak region utworzony przez gracza. Ściany i regiony rysujesz narzędziami sceny Foundry, które znajdziesz też w oknie modułu **Narzędzia mapy** (sekcja 18). Region, który narysujesz, oznaczasz ty, a Lista kontrolna sezonu wymienia regiony, które czekają na oznaczenie.

Zmianę oznaczenia przez gracza cofa się do tego, co zostawił GM, a GM-owie dostają o tym szept; gdy przeglądarka GM-a nie ma zapisu oznaczenia sprzed zmiany, nic się nie cofa, a GM-owie dostają szept, żeby sprawdzili ten region w Ustawieniach pokoi. Zmiany dokonanej, gdy żaden GM nie jest połączony, nikt nie ocenia.

Dwa regiony o tej samej nazwie to jeden pokój (korytarz narysowany w dwóch kawałkach): zamknięcie, pieczęć albo lista Sąsiadów na którymkolwiek kawałku obowiązuje cały pokój, a Ustawienia pokoi zapisują każdy kawałek i pokazują taki pokój jako jeden wiersz. Na scenie o kilku piętrach pokój czyta się na piętrze tokenu (sekcja 9.4).

**Ustawienia pokoi** otwierasz w części **Między sesjami** panelu GM-a, a panel otwiera czerwony przycisk GM (sekcja 3). Okno działa na scenie, która była na ekranie przy jego otwarciu: jego tytuł ją nazywa, a **Zastosuj** zapisuje właśnie tam, nawet jeśli w tym czasie na ekranie jest już inna mapa, i potem podaje, ile pokoi na tej scenie się zmieniło. Okno ma jedną zakładkę na każdy rodzaj ustawień, w tej kolejności, a **Zastosuj** zapisuje wszystkie zakładki naraz. Od razu, bez Zastosuj, działają tylko przyciski zakładki Tajne przejścia, przyciski Search Tokenów i **Zapisz akcje w pokoju**.

| Zakładka | Kolumny |
|---|---|
| Pokoje | Czy region w ogóle jest pokojem (**To jest pokój**, przełącznik wyszarzony dla regionu, który nie może nim być), czyja jest każda sypialnia (jeden uczeń, jedna sypialnia; posiadanie sypialni zamyka jej drzwi przed wszystkimi innymi i daje właścicielowi klucz oraz otwartą skrytkę) i **Bez prywatności** (niżej) |
| Drzwi | Kolumna **Zamknięte** pokazuje, które drzwi są zamknięte teraz, a **Zamknięte na start**, które zaczynają sezon zamknięte (reset sezonu kopiuje kolumnę Zamknięte na start na kolumnę Zamknięte). Do tego **Zepsute** i **Sąsiedzi** pokoju (oba niżej) |
| Tajne przejścia | Tajne przejścia na tej scenie (sekcja 9.6), w kolumnach Pokoje, Rodzaj, Kształt, Pochodzenie, Kto zna, Na start sezonu i Stan, z przyciskami **+ Nowe tajne przejście** i **+ Tunel lub schody**, a w każdym wierszu **Pokaż**, **Wskaż ponownie**, **Zamknij** albo **Otwórz**, **Ujawnij** albo **Utajnij** i **Usuń**, zawsze w tych samych miejscach. Wskaż ponownie jest wyszarzone, dopóki ściana przejścia się nie przesunie, a Zamknij jest wyszarzone, kiedy się przesunęła. Wiersz wyłomu ma **Pokaż** i **Zamknij wyłom** (sekcja 11) |
| Przeszukiwanie | Z której tabeli (RollTable) losuje pokój albo czy z puli globalnej, ile Search Tokenów pokojowi zostało (- i + obok liczby oraz przycisk uzupełnienia zapisują każde kliknięcie od razu, jako jedną zmianę), blokada „nie do przeszukania” i jeden przełącznik na kategorię, który kolejnymi kliknięciami przechodzi: obojętne / dobre miejsce / złe miejsce. Dobre miejsce daje przewagę na Search o tę kategorię, złe miejsce utrudnienie, a kategoria nigdy nie jest obiema naraz |
| Facilities | Czy dozwolony jest tu Short Rest i czy Long Rest, oraz akcje samego pokoju: ich liczba i **Edytuj akcje**, które otwiera listę akcji pokoju (najwyżej 8). Każda akcja ma nazwę, statystykę, próg i do 4 efektów, każdy na używającego, na wszystkich obecnych albo na pozostałych obecnych: Health, Sanity, Hope, Free Move, Search Token dla pokoju, obniżenie Overflow albo twoje słowa. Efekt może też trwać albo czekać: statystyka podniesiona na jakiś czas, Experience na jakiś czas, przewaga przy następnym rzucie, ochrona przed Despair przy rzucie, przejścia w najbliższym Eclipse, wytrzymałość z powrotem dla najbardziej zużytego przedmiotu, koniec Wounded albo Breakdown, postęp najstarszego projektu w pokoju albo mocniejszy następny Ultimate. **Zapisz akcje w pokoju** zapisuje listę. Gracz widzi akcje pokoju tylko wtedy, gdy w nim stoi; każda to rzut i kosztuje 1 akcję, a gdy ktoś jej użyje, także nieudanym rzutem, nikt nie użyje jej aż do następnej pory dnia. Użycie akcji pokoju zostawia Faint Subtle Remnant (sekcja 14.1) |
| Skrytki | Kto ma skrytkę w którym pokoju i czy jest ukryta. Kliknięcie komórki przełącza: brak / otwarta / ukryta; legenda nad tabelą pokazuje te trzy stany, a zacieniona komórka to własna sypialnia właściciela. Uczniowie są nagłówkami kolumn, każde imię zajmuje najwyżej dwie linie, a ucięte widać w całości w podpowiedzi, jak na zakładce Mgła. Sypialnia daje właścicielowi otwartą skrytkę, jakkolwiek ją ustawisz: gdy oznaczasz pokój i oddajesz go uczniowi w dowolnej kolejności, w jednym Zastosuj albo w dwóch, i gdy naciskasz Zastosuj na tej zakładce, nie ruszając żadnej komórki. Komórka, której nie zmienisz, zostaje taka, jak była. Gdy oddajesz sypialnię komuś innemu, dotychczasowy właściciel zachowuje swoją skrytkę i to, co w niej leży, a nowy dostaje w tym pokoju własną otwartą skrytkę. Skrytka w cudzym pokoju nie daje do niego klucza. Skrytki, w której coś leży, nie da się usunąć; usunięcie pustej sprawia, że zapomina o niej każdy, kto ją znalazł |
| Opis | **Jak wygląda**: pokój twoimi słowami, zwykły tekst pokazany tak, jak go wpisano, a pusta linia zaczyna nowy akapit. **Zdjęcie**: jedno zdjęcie z plików tego serwera albo, na The Forge, z twojej Assets Library, ale nie z S3, w formacie jpg, png, webp albo avif, wybrane w oknie wyboru pliku albo usunięte. Innej ścieżki moduł nie zapisuje i mówi ci o tym. Zdjęcie większe niż 4096 px na boku albo 8 MB jest oznaczone w swojej komórce (*To zdjęcie jest duże i każdemu graczowi wczytuje się powoli: ...*), tak samo zdjęcie, które się nie wczytuje (*To zdjęcie się nie wczytuje - wybierz plik jeszcze raz.*). Żadne z tych oznaczeń nie wstrzymuje Zastosuj, a oba widać na kafelku pokoju (niżej) |
| Mgła | Macierz odkryć: które pokoje każda postać już widziała na tej scenie. Nad nią **Odkryj wszystko** i **Ukryj wszystko** zaznaczają albo czyszczą każde pole, a nic się nie zmienia przed Zastosuj. Do tego procent sceny, który nie należy do żadnego pokoju, i kontrola regionów |
| Sceny | To nie zakładka Ustawień pokoi: ta część jest w oknie **Ustawienia sezonu**, pod nagłówkiem **Sceny**, i na każdej scenie wygląda tak samo. Podpinasz w niej raz dwie sceny sezonu: **Szkoła** i **Sala rozpraw**, która jest osobną sceną; muszą być różne, a **Zapisz** w Ustawieniach sezonu czeka, aż będą. Jest tu obsada sali, czyli tabela z przełącznikiem na postać w kolumnie **Bierze udział**, z kolumną **Token w sali** tam, gdzie stoi twój token, a także **Nazwa**, **Zdjęcie** i **Opis** sali na kafelek pokoju w rozprawie oraz **Przygotuj salę przy Zapisz** (sekcja 15.1) |

**Kafelek pokoju.** Ekran każdego gracza ma pod zegarem kafelek pokoju, w którym stoi jego postać: nazwę pokoju, pozostałe Search Tokeny, twoje **Zdjęcie** na całym kafelku pod nazwą i twoje słowa pod **Czytaj dalej**, a gdy w pokoju jest projekt, nad którym ten gracz może pracować, także **Możesz tu pracować nad projektem**. Na wąskim ekranie kafelek pokazuje małe zdjęcie i okno **Opis**. Twój ekran też ma ten kafelek, dla pokoju, w którym stoi twój Monokuma, a w czasie Class Trial kafelek pokazuje salę rozpraw (sekcja 15.1). Kliknięcie zegara też wypisuje słowa pokoju. Kafelek tak, jak widzi go gracz, pokazuje sekcja 3 Podręcznika gracza.

Zaznacz **Bez prywatności** (zakładka Pokoje) dla korytarzy, klatek schodowych i każdego miejsca, gdzie nikt nie porozmawia na osobności. Taki region przestaje się liczyć do liczby pokoi (linii proporcji na zakładce Pokoje oraz wierszy pokoi i dalszych sprawdzeń na Liście kontrolnej sezonu) i do niczego więcej. Zamknięty pokój dalej się liczy.

Pole **Zepsute** (zakładka Drzwi) jest zaznaczone przy pokoju, którego zamek wyważono, przez Force the Door albo przez wyłom (sekcja 11.3). Dopóki jest zaznaczone, ani zamek pokoju, ani klucz do sypialni nikogo nie zatrzymują. Odznacz je i naciśnij Zastosuj, żeby naprawić zamek ręcznie; kolumna Zamknięte zostaje bez zmian. Gotowego projektu Repair the Lock jeszcze nie ma.

**Barykada.** Shut the Door gracza barykaduje pokój od środka. GM-owie widzą, kto postawił barykadę i jak jest mocna, a każdy gracz widzi tylko, że pokój jest zabarykadowany. Barykada znika, gdy jej autor wychodzi, z następną porą dnia, na początku Eclipse i przy resecie sezonu.

Kolumna **Sąsiedzi** to miejsce, w którym drzwi mają pierwszeństwo przed mapą. Gdy jest pusta, sąsiedzi pokoju to pokoje bez listy, których ściany mają z jego ścianami wspólną krawędź, i każdy pokój, który go wpisał. Ściany mają wspólną krawędź, gdy dzieli je najwyżej około jednej trzeciej pola siatki i biegną obok siebie na co najmniej pół pola, więc sam narożnik nie wystarczy. Wyszarzone nazwy w pustym polu to pokoje, z którymi zasady łączą go teraz. Wpisz nazwy pokoi rozdzielone przecinkami, a pokój będzie połączony dokładnie z nimi, w obie strony: dwa pokoje są połączone, gdy którykolwiek wpisał drugi, a z pokoju obok pokoju z listą nie da się do niego przejść, dopóki jeden z nich nie wpisze drugiego. Zastosuj zapisuje listę na każdym kawałku pokoju i mówi ci o nazwie, której nie nosi żaden pokój na scenie, bo taka nazwa niczego nie łączy.

Pokój, któremu listy i ściany nie dały żadnego sąsiada, nie ma żadnych drzwi. Pokój bez listy, którego nie wpisał żaden inny i który nie styka się z żadnym pokojem, nawet narożnikiem, nie jest sprawdzany: można z niego przejść do dowolnego pokoju.

**Zmiana nazwy pokoju.** Gdy GM zmienia nazwę regionu pokoju, moduł przenosi na nową nazwę to, co wskazywało na starą, kiedy ostatni kawałek pokoju o starej nazwie na tej scenie dostanie nową - do tego czasu pokój o starej nazwie wciąż stoi i wszystko zatrzymuje. Przenosi klucze do pokoju, przedmioty schowane w nim w skrytkach, notatki o znalezionej tam skrytce, to, kto go odkrył, pokój projektu, podłożonego przedmiotu i zwołanego zebrania, które tam były, pokój Masterminda, gdy żadna scena nie ma już pokoju o starej nazwie, listy Sąsiadów innych pokoi, które go wymieniają, pieczęć Despair Calla na nim i pokój ciał tam znalezionych, a potem szepcze GM-om, co przeniósł. Nie przenosi treści opisu klucza. Zmiana nazwy przez gracza niczego nie przenosi, a pokój narysowany od nowa pod nową nazwą to nowy pokój.

**Co przenosi zmiana nazwy w świecie z kilkoma scenami.** Klucze i przedmioty w skrytkach nie wymieniają sceny, więc przechodzą na nową nazwę tylko tam, gdzie nie da się ich pomylić z pokojem o tej samej nazwie na innej scenie: klucze, gdy pokój jest sypialnią, a żadna inna scena nie ma sypialni o starej nazwie, przedmioty postaci, gdy żadna inna scena nie ma jej skrytki w pokoju o starej nazwie. Pieczęć też nie wymienia sceny i zamyka każdy pokój o swojej nazwie: nowa nazwa zostaje zapieczętowana, a stara pozostaje zapieczętowana, dopóki inna scena ma pokój o starej nazwie. Zapis znalezionego ciała wymienia swoją scenę i idzie, gdy to ta scena; zapis bez sceny - takie jest ciało, na które GM-owie jeszcze nie odpowiedzieli - idzie, gdy żadna scena przed tą, licząc od szkoły, nie ma pokoju o starej nazwie.

**Zmiana nazwy na nazwę innego pokoju.** Zmiana nazwy na nazwę pokoju, który już jest na scenie, to nie zmiana nazwy, tylko kawałek dołączający do tamtego pokoju: nic się nie przenosi, ani pieczęć, ani znalezione ciała, z kawałka znikają jego własne wartości z Ustawień pokoi (właściciel, skrytki, zamknięcia, pieczęć, Sąsiedzi i reszta), a GM-owie dostają o tym szept. Zmiana nazwy jednego z kilku kawałków pokoju tak samo zdejmuje z niego wartości pokoju; pozostałe kawałki je zachowują.

**Jedna nazwa na kilku scenach.** Pokój to nazwa na scenie, a dwie sceny mogą mieć każda swoją Kuchnię. Każda zasada czyta pokój na jego własnej scenie:

- projekt widać, rozwija się go i sabotuje w jego pokoju na scenie jego tokenu na mapie (a bez tokenu na pierwszej scenie z pokojem o tej nazwie, najpierw szkolnej), tajny projekt znajduje nieoczywisty Observe tylko w tym pokoju na tej scenie, a pułapka zbudowana jako projekt zadziała tylko tam;
- Listen, pokoje, które wymienia Rest, publiczność rzutu Monocuba i pułapka czekająca, aż ktoś będzie sam, czytają scenę, na której stoi postać;
- Move the Body wymaga ciała w pokoju zabójcy na tej samej scenie i piętrze i bez tego jest odrzucane, zanim się za nie zapłaci.

**Search Tokeny.** Każdy pokój ma 3 na porę dnia, a ustawienie **Search Tokeny na pokój** przyjmuje wartości od 0 do 10. Search Tokeny są uzupełniane przy każdej zmianie pory dnia, a każdy Search wydaje jeden. Pokój, którego licznik zapisano powyżej obniżonego maksimum, pokazuje maksimum. Gdy odpowiedź na Search gracza nie przyjdzie na czas (sekcja 22), gracz czyta *Search się nie liczy. Nie tracisz akcji.*, a token sam wraca do pokoju, raz. Search, którego odmówisz, bo pokój jest zapieczętowany, mówi graczowi, że tego pokoju nie da się przeszukać, a akcja wraca.

### 9.2 Mgła i odkrywanie

Gdy włączone jest **Pokoje decydują, co widzą gracze**, nad całą sceną leży jedna warstwa mgły o trzech stanach: pokój, w którym stoisz, jest czysty, pokój odwiedzony prześwituje przez zasłonę, a wszystko inne, łącznie z fragmentem mapy poza każdym regionem, to pełna mgła. Podczas Eclipse nawet pokój, w którym stoisz, jest tylko za zasłoną. Odkrywanie jest **osobne dla każdej postaci**: pokój jest odkryty, gdy token postaci pierwszy raz do niego wejdzie, uczeń, który wszedł, słyszy wtedy dźwięk, a odkrycie przetrwa sesje. GM widzi lżejszą mgłę: każdy pokój odkryty przez klasę jest czysty, a pokoje, których nikt jeszcze nie znalazł, razem z każdym miejscem poza pokojami, leżą pod zasłoną. Mastermind widzi każdy pokój jako odwiedzony, a pokoje, do których wchodzi, nie liczą się do twojej mgły, tak samo jak te, które znalazł, zanim go wybrano. Na scenie o kilku piętrach mgła rysuje piętro, które jest na ekranie, według tej samej zasady (sekcja 9.4).

Żeby mgła działała, scena musi mieć wyłączone własne widzenie Foundry:

| Ustawienie | Musi być |
|---|---|
| Token vision | wyłączone |
| Globalne światło | włączone |
| Eksploracja mgły | wyłączona |

Wiersz pokoi Listy kontrolnej sezonu wymienia scenę z pokojami, która nie jest gotowa. Ustaw te trzy rzeczy w ustawieniach samej sceny albo uruchom wywołanie konsoli z sekcji 20.3, które przygotowuje naraz wszystkie takie sceny. Jak to przygotowanie oddać, mówi sekcja 22.

> [!WARNING]
> Scena z pokojami i włączonym widzeniem Foundry pokazuje się graczom na v14 jako **czarny ekran** i nie mówi dlaczego. To najczęstsze zgłoszenie „jest zepsute”.

**Widoczność tokenów** (**Gracze widzą tylko osoby w swoim pokoju**) działa wprost na tokenach, więc ani drzwi, ani arkady, ani mapy bez ścian niczego nie zdradzają. Ujawniony Remnant widzą tylko ci, którzy sami go znaleźli.

**Ikony drzwi.** Przy wyłączonym token vision Foundry pokazałoby graczowi ikonę każdych drzwi na mapie. Moduł pokazuje graczowi tylko drzwi pokoi, które mgła zostawia mu czyste albo za zasłoną na piętrze na ekranie, łącznie z drzwiami z pokoju, w którym stoi, a sekretnych drzwi nie pokazuje mu tam nigdy. To, kto może drzwi otworzyć, nadal rozstrzyga Foundry.

**Pokoje rysowane w trakcie gry.** Gdy scena dostaje w trakcie gry swój pierwszy pokój, bo GM go rysuje albo oznacza, moduł przygotowuje scenę do mgły. Każdy ekran, który patrzy na scenę, przerysowuje mgłę, gdy któryś z jej regionów zostanie narysowany, zmieniony albo usunięty, a dodanie albo usunięcie zachowania regionu też jest taką zmianą. Teleport zdjęty z oznaczonego regionu robi z niego pokój, a gdy to pierwszy pokój sceny, przygotowuje scenę; teleport dodany z powrotem od razu przerysowuje mgłę. Wyłączenia teleportu w miejscu moduł nie czyta jako zmiany: region z teleportem jest przejściem, czy teleport jest włączony, czy wyłączony.

**Napis nad regionem.** Napisy Daggerhearta nad tokenem, takie jak *Hope +1* albo rana, nigdy się nie pokazują, bo moduł je wstrzymuje (sekcja 22). Region, któremu dasz zachowanie Foundry **Display Scrolling Text**, pokazuje swój tekst, ale tylko nad tokenem, który dany ekran pokazuje. Token, który mgła pokoju ukrywa przed graczem (stoi w pokoju, w którym nie ma postaci tego gracza), nie dostaje napisu na ekranie tego gracza, cokolwiek mówi widoczność zachowania, tak samo jak w Eclipse token ukryty przed każdym graczem; napis pokaże się mimo to, gdy w tym samym miejscu stoi token, który ten ekran pokazuje.

### 9.3 Ruch i naliczanie

Ruch wewnątrz pokoju jest darmowy. Przejście do połączonego pokoju wydaje najpierw **Free Move** tej pory dnia, potem odłożone darmowe przejście (z Callem Sprint, z akcją Dash albo z akcji pokoju z Facilities), potem odłożony Burst, a dopiero potem **1 akcję** za przejście. Token, którego nie stać, wraca na miejsce, zanim ruch zostanie zapisany, a gracz dostaje czerwoną kartę. Karta ruchu mówi tylko, do którego pokoju weszła postać i ile kosztowało przejście. Słowa i zdjęcie pokoju są na kafelku pokoju. Przejście może też uruchomić pułapkę (sekcja 11).

Niektóre odmowy działają niezależnie od ustawienia **Przejście między pokojami kosztuje Move**:

- postać w incydencie nie może opuścić pokoju;
- podczas Class Trial nikt nie opuszcza pokoju;
- pokój zapieczętowany przez Behind Closed Doors, gracz z Chained;
- zamknięte drzwi (Ustawienia pokoi > Drzwi);
- cudza sypialnia bez klucza;
- limit przejść Eclipse i zasada połączonych pokoi, razem ze schodami (sekcja 9.4).

Monokumy przechodzą przez to wszystko. Token zmarłego się nie rusza: ciało zostaje tam, gdzie upadło. Wyłączenie ustawienia oddaje ci cenę przejścia, czyli Free Move i akcję, oraz, poza Eclipse, zasadę połączonych pokoi razem ze schodami, do prowadzenia ręcznie. Zmiana piętra jest ruchem jak krok po mapie: jest odrzucana, naliczana i cofana tak samo (sekcja 9.4).

**Wejście, na które zasady nie pozwalają.** Każde wejście gracza jest oceniane jeszcze raz według tych samych zasad, bez ceny. Ruch gracza do pokoju, który zamyka jedna z powyższych odmów (wyjście z pokoju incydentu, zanim pozwoli na nie akcja kryzysowa, zamknięte drzwi, pieczęć, Chained, cudza sypialnia, sala rozpraw, przejście w Eclipse ponad limit), jest cofany tam, gdzie token ostatnio stał zgodnie z zasadami, razem z piętrem i wysokością, jakkolwiek ruch zapisano. Gracz dostaje wiadomość, która zasada go zawróciła, a GM-owie dostają jeden szept na całą serię takich ruchów. Odesłanie do zamkniętej dla niego sypialni, o które prosi gracz, jest odrzucane. Wejście, które łamie tylko zasadę połączonych pokoi albo przechodzi przez ścianę, jest tylko odnotowywane w Dzienniku debugowania, dopóki **Token gracza przesunięty przez ścianę** (sekcja 9.6) ma domyślne ustawienie. Niczego, co robisz ty, moduł nie cofa: jeśli przesuniesz albo postawisz token, miejsce, w którym stoi, jest dozwolone.

**Gdzie liczy się uczeń.** Uczeń, który stoi w pokoju, do którego te zasady by go nie wpuściły, nie jest świadkiem przy ciele ani stroną trzecią morderstwa, dopóki nie stanie tam, dokąd mógł dojść z ostatniego pokoju, do którego wszedł zgodnie z zasadami, a GM-owie dostają o tym szept. Taki uczeń nie powstrzymuje też pułapki czekającej, aż ktoś będzie sam, i nie liczy się w pokoju zabójcy, gdy na koniec Eclipse, które kończy główny GM, ocenia się odłożone Direct Murder. Jeden uczeń to jeden świadek, ile by jego tokenów nie stało w pokoju. Token, który gracz upuści na mapę, ocenia się od miejsca, w którym ten uczeń ostatnio stał na tej scenie; uczeń, który jeszcze nigdzie tam nie stał, liczy się tam, gdzie token wylądował, a GM-owie dostają o tym szept. Upuszczony token, na który zasady nie pozwalają, jest usuwany, a GM-owie dostają o tym wiadomość.

**Zwróć ostatnie przejście.** Każdy wiersz okna Uczniowie ma przycisk **Zwróć ostatnie przejście**, z dwoma pokojami w podpowiedzi. Stawia on token tam, gdzie stał przed najnowszym przejściem tej postaci, i oddaje dokładnie to, ile przejście kosztowało: Free Move, Sprint, Burst, akcję, przejście w Eclipse (tylko w tym Eclipse, w którym je zrobiono) albo cenę tunelu, z tokenem z powrotem przy jego wejściu. Działa także po zmianie pory dnia, ale akcja wraca tylko do maksimum budżetu, a Free Move tylko w tej porze dnia, w której go wzięto. Działa raz na przejście, a gracz dostaje o tym wiadomość. Cena to to, co ruch wydał przy przejściu (sekcja 22); innego wydatku, który dotrze pierwszy, na przykład akcji Search, ani wydatku późniejszego się nie oddaje, a gracz dostaje wtedy wiadomość, że poza tokenem nic nie wróciło.

**Arkusz z wiersza.** Każdy wiersz okna Uczniowie, czy to ucznia, Monokumy, czy NPC, ma obok imienia przycisk arkusza (*Otwórz arkusz: imię*): otwiera arkusz tej postaci albo wysuwa go na wierzch, gdy jest już otwarty, a okno Uczniowie zostaje otwarte obok.

### 9.4 Piętra (Levels w Foundry)

Foundry v14 może umieścić na jednej scenie kilka pięter - Levels: token stoi na jednym piętrze, region leży na piętrach, które wymienia, a region, który żadnego nie wymienia, leży na każdym. Moduł czyta pokój na piętrze tokenu, więc token na parterze pod strychem stoi w pokoju na parterze, nigdy na strychu. Piętra są uporządkowane według wysokości (elevation), od najniższego.

- **Schody** to region z zachowaniem Change Level z Foundry, a taki region nigdy nie jest pokojem. Narysuj go wewnątrz pokoi, które łączy: łączy pokoje pod swoim środkiem na każdym ze swoich pięter. Wejście albo zejście po schodach z jednego pokoju do innego kosztuje jedno przejście, dokładnie jak drzwi. Pokój narysowany na dwóch piętrach, klatka schodowa, to jeden pokój, a zmiana piętra w nim jest darmowa.
- **Bez schodów nie ma wspinaczki.** Na scenie ze schodami zmiana piętra między dwoma pokojami, których schody nie łączą, jest odrzucana, a odmowa wymienia tylko pokój, w którym stoisz. Scena z piętrami bez regionu schodów jest oceniana po obrysach pokoi. Schody należą do zasady połączonych pokoi: wyłączenie ustawienia *przejście między pokojami kosztuje Move* oddaje ci je razem z nią, a Eclipse stosuje je wszędzie tam, gdzie stosuje tę zasadę - w każdym Eclipse poza takim, w którym każdy wybiera dowolny pokój (sekcja 12). Schody narysowane przez gracza niczego nie łączą.
- **Mgła rysuje jedno piętro**, to na ekranie, według zasady z sekcji 9.2, a ikony drzwi pokazują się dla tego samego piętra. Kontrola regionów sprawdza każde piętro osobno (sekcja 20).
- **Kto widzi które piętro.** Gracz widzi pokoje odkryte przez swoją postać na każdym piętrze dokładnie tak jak na własnym: za zasłoną, bez cudzych tokenów. Pokój, w którym nigdy nie był, zostaje pod pełną mgłą na każdym piętrze. Rząd przycisków obok HUD, **Piętra**, proponuje graczowi piętra, na których stoją jego tokeny, i każde piętro z pokojem, który odkrył, od najniższego, a GM-owi i Mastermindowi każde piętro; pojawia się tylko na scenie o co najmniej dwóch piętrach. Piętro postawione na ekranie w inny sposób, także własnym przełącznikiem poziomów Foundry, jest rysowane według tej samej zasady.

### 9.5 Głos

Gdy włączone jest **Głos osobno w każdym pokoju** i połączony jest LiveKit AVClient, każdy zmapowany pokój jest osobnym kanałem głosowym. Gracz słyszy tych, którzy są z nim w pokoju, a jego głos przenosi się razem z jego tokenem. Głos Monokumy przenosi się z jego własnym tokenem, u GM-a, do którego puli Monokuma jest przypisany. Monocub mówi jako Monocub.

**Podczas Eclipse** żaden gracz nie jest w głosie, dopóki nie wróci światło, a GM-owie dzielą jeden kanał. Gdy Eclipse się kończy, zegarem albo cofnięciem, każdy dostaje znowu pokój, do którego należy, a konto bez postaci (Widz, GM bez Monokumy) dostaje pokój główny.

**Podczas Class Trial** wszyscy są w pokoju głównym (żyjący, zmarli, Monocuby i GM-owie), gdziekolwiek stoi ich token i czy sala rozpraw jest podpięta, czy nie (sekcja 15.1); Eclipse otwarte w trakcie rozprawy nadal wyłącza z głosu każdego gracza. Zmarli słuchają, ale w rozprawie nie mówią: na czas rozprawy moduł blokuje mikrofon gracza każdego zmarłego ucznia - także śmierci, której nikt nie znalazł - własną blokadą Foundry. Mikrofonu Monocuba ani GM-a moduł nigdy nie blokuje, a oddaje dokładnie te blokady, które sam zrobił (sekcja 15, krok 1). Kafelek Monocuba mówi, kiedy ten może mówić (*Dyskusja: możesz mówić.*), a kiedy słucha (*Tryb: nazwa. Słuchasz.*, *Głosowanie: słuchasz.*, *Słuchasz: to rozprawa w twojej sprawie.*). To tylko informacja: moduł nie blokuje żadnego Monocuba.

**Kanał zmarłych.** Ofiara incydentu zostaje w pokoju, w którym zginęła, dopóki ten incydent trwa. Gdy incydent się zakończy, gdy ktoś znajdzie ciało, gdy do pokoju wejdzie żywy uczeń spoza incydentu albo gdy naciśniesz **Wycisz teraz** (wiersz ucznia w oknie Uczniowie albo tracker incydentu przy ofierze), gracz zmarłego ucznia rozmawia z Widzami na kanale głosowym Widzów. Dzieje się tak przy śmierci, o której stołowi nie powiedziano (sekcja 13.4), i przy tej, o której powiedziano: żywi go nie słyszą, a on słyszy Widzów i innych zmarłych. Inny zmarły gracz albo Widz może więc dowiedzieć się o śmierci, której nikt nie znalazł. Mikrofon zmarłego gracza zostaje jego: wycisza go i włącza sam, z powodem pod spodem, a poza rozprawą moduł nie zapisuje na jego koncie żadnej blokady. Śmierć poza incydentem jest tak umieszczana od razu.

**Przez ten moduł nikt nie podsłucha niezauważony.** Głos gracza trafia tylko do pokoju, w którym stoi jego token, a gdy token stoi poza każdym pokojem (pole drzwi, nienarysowany korytarz, niżej), do pokoju, z którego przyszedł. Każdy w pokoju widzi, ile innych osób w nim jest, także milczących: to liczba na głośniku kafelka głosu, a gdy kafelek głosu jest wyłączony, po jednym kafelku kamery na osobę w doku Foundry. GM, który chce słyszeć pokój, wchodzi do niego swoim Monokumą.

**Podsłuch pod drzwiami** to jedyny wyjątek, jaki zasady od tego robią, i on też jest liczony. Po Listen z wynikiem 14 lub więcej, przy włączonym **Głos osobno w każdym pokoju**, głos słuchającego przenosi się na kanał pokoju, którego słuchał, a jego mikrofon zostaje zablokowany tą samą blokadą Foundry, której używa rozprawa. Blokady założonej przez ciebie moduł nie rusza i oddaje tylko to, co sam zapisał. Słuchający słyszy ten pokój, nikt tam nie słyszy jego, nikt tam nie dostaje wiadomości, a liczba na głośniku kafelków głosu tego pokoju go liczy. Twoja lista **Kogo słyszysz** pokazuje u góry, pod **Podsłuchują pod drzwiami**, po jednej linii na słuchającego (*imię słucha: pokój, z: pokój*), na jakimkolwiek kanale jesteś, i nie oferuje blokady mikrofonu słuchającego. Słuchający kończy podsłuch przyciskiem **Przestań słuchać: *pokój*** na swoim kafelku głosu. Podsłuch kończy się też, gdy wyjdzie z pokoju, z którego słucha (krok w jego obrębie albo w drzwi tego nie robi), z końcem pory dnia, przy Eclipse, incydencie, Class Trial albo jego śmierci; najpierw wraca głos, a blokada schodzi około 4 sekund później. Ponowny podsłuch tego samego pokoju w tej samej porze dnia nie kosztuje gracza akcji ani rzutu. Gdy osobny głos w pokojach jest wyłączony, Listen to sama karta, a ty dostajesz o tym jedną wiadomość.

**Echoes**, wiersz kafelka Infiltrate obok Listen, wskazuje najbliższy pokój, licząc przez drzwi, schody i tunele znane graczowi, w którym stoi żywy uczeń innego gracza. Nie liczy ciał (także śmierci, którą ukrywasz) ani Monokumy, Monocuba, Widza, ukrytego tokenu i postaci GM-a, a w czasie Eclipse nie działa nigdy.

**Drzwi albo korytarz.** Token gracza, który stoi poza każdym pokojem (pole drzwi, korytarz nienarysowany jako pokój), zachowuje pokój głosowy, z którego przyszedł, dopóki ten pokój stoi na jego scenie i piętrze. Przejście z pokoju przez lukę do następnego zmienia więc pokój głosowy raz, a krok w drzwi i z powrotem nie zmienia niczego. Do pokoju głównego token trafia, gdy stanie na innej scenie albo piętrze lub gdy jego pokój zostanie usunięty, a Eclipse, rozprawa i śmierć mają swoje własne reguły. Token gracza, który przeciągniesz na korytarz, też zachowuje swój ostatni pokój; przeciągnij go do pokoju, żeby przenieść jego głos. Token Monokumy poza każdym pokojem trafia do pokoju głównego, więc wyprowadzając Monokumę z pokoju na korytarz, wyprowadzasz z tego pokoju swój głos. Pokój, do którego tokenowi gracza odmówiono wejścia (zamknięte drzwi, przejście, za które nie mógł zapłacić), nigdy nie jest tym, który token zachowuje. Gdy główny GM przeładuje stronę albo głównym zostanie inny GM, token poza każdym pokojem zaczyna znowu od pokoju głównego. Nic z tego nie zostało jeszcze usłyszane przy stole (LIVE-E88-03).

**Gdy głos nie działa.** **Napraw głos** (część **Diagnostyka** panelu GM-a) wysyła każdemu połączonemu graczowi pokój, do którego teraz należy, tak jakby nikt jeszcze niczego nie dostał. To lekarstwo na gracza, który jest w złym pokoju albo nikogo nie słyszy. Może to zrobić tylko główny GM, a Napraw głos mówi, do ilu osób dotarło. Gracz, któremu zerwie się połączenie głosowe, dostaje kartę **Głos rozłączony** (zostaje w jego historii powiadomień) i sam łączy się ponownie; gdy karta każe przeładować, wraca dopiero po F5. Diagnoza głosu (sekcja 20.3) mówi, które z pięciu ogniw jest zerwane; uruchom ją u tego, kto się skarży.

**Kafelek głosu.** Gdy połączony jest LiveKit AVClient, każdy ekran pokazuje kafelek głosu w miejscu doku kamer Foundry: portret i imię tego, kogo ten ekran słyszy we własnym kanale głosowym, przycisk mikrofonu i przycisk głośnika (sekcja 3 Podręcznika gracza). Na The Forge portretem, czyli awatarem gracza albo zdjęciem jego ucznia, może być dowolne zdjęcie z serwera plików The Forge. Dok zostaje na stronie niewidoczny, bo przez niego LiveKit gra dźwięk wszystkich; razem z kafelkiem głosu tracisz lokalny podgląd kamery z doku i przyciski, które wkłada do doku inny moduł, także proximity-voice-chat. Gdy nikt nie mówi, kafelek zablokowanego gracza mówi **Zablokowano**, a gracz, który nie jest jeszcze w głosie, widzi tam **Łączenie** albo **Rozłączono**. Ustawienie świata **Kafelek głosu zamiast doku kamer** jest domyślnie włączone, a jego wyłączenie przywraca wszystkim dok kamer Foundry.

**Blokowanie mikrofonu.** Na twojej liście **Kogo słyszysz** wiersz każdego gracza ma **Zablokuj mikrofon: *imię* (u wszystkich)**. To własna blokada Foundry, ta z doku, i trzyma tak daleko, jak trzyma blokada Foundry. Przycisk jest wyłączony, z powodem obok, gdy ten mikrofon blokuje sam moduł: przy śmierci, którą ukrywasz, bo blokada zdradziłaby ją stołowi, i w trakcie Class Trial przy uczniu z listy zmarłych rozprawy, którego blokada należy do rozprawy.

**Ustawienia, które moduł trzyma dla każdej przeglądarki.** Dwa wybory są robione za cały stół i nikomu nie są pokazywane jako jego do zmiany. Głos zawsze działa w oknie Foundry: wybór osobnego okna albo zakładki w LiveKit AVClient jest wyłączony dla wszystkich, także dla GM-ów, i zabrany z ustawień. Ustawienie świata **Głos w oknie Foundry u wszystkich** jest domyślnie włączone, a jego zmiana działa po przeładowaniu. Gdy kafelek głosu jest włączony, dok kamer Foundry jest trzymany zwinięty i żadna kamera nie otwiera się we własnym oknie: te dwa pola są wyszarzone w ustawieniach A/V Foundry, a zmiana zrobiona mimo to wraca. Urządzenia, głośności, wyciszenia, blokady i klawisz naciśnij, aby mówić, zostają własne każdego gracza. Z wyłączonym kafelkiem głosu moduł nie trzyma niczego z doku, a każdy ekran raz dostaje z powrotem dok i okna kamer, zwinięte albo otwarte tak jak przed ukryciem ich przez kafelek; wyłącz więc kafelek głosu, zanim wyłączysz moduł. Przyciski w rogu, kafelek powiadomień i stos na wąskim ekranie stoją nad dokiem, gdy jest widoczny. Ustaw tryb A/V świata na sam dźwięk: kafelek nie pokazuje obrazu, a Lista kontrolna sezonu mówi ci, gdy świat wysyła obraz, którego nikt nie ogląda.

> [!WARNING]
> Moduł głosu zbliżeniowego zainstalowany obok potrafi uciszyć stół, podczas gdy każda kontrola raportuje sukces. Diagnoza głosu wymienia taki moduł (sekcja 20.3).

**Sekret serwera głosu.** Za własne ustawienie LiveKit AVClient ten moduł nie ręczy. Gdy LiveKit AVClient jest ustawiony na własny serwer, trzyma klucz API i sekret serwera w ustawieniu świata, które dociera do przeglądarki każdego gracza jak każde inne (sekcja 1.6), a kto ma klucz i sekret, może połączyć się z każdym pokojem głosowym. Ten moduł nie może przenieść ustawienia innego modułu, więc mówi ci o tym wierszem Listy kontrolnej sezonu (sekcja 2), widocznym tylko wtedy, gdy tak jest, i linią diagnozy głosu (sekcja 20.3). Serwer, który sam wydaje tokeny dostępu, taki jak Tavern, trzyma sekret poza każdą przeglądarką.

### 9.6 Tajne przejścia

Tajne przejście to odcinek zwykłej ściany między dwoma pokojami jednego piętra albo tunel lub schody między dwoma pokojami, na jednym piętrze lub dwóch. Uczniowie, którzy je znają, przechodzą przez nie za cenę drzwi (przejście między pokojami, płatne i odrzucane według zasad sekcji 9.3), a dla wszystkich innych to ściana. Przejścia tworzysz i prowadzisz na zakładce **Tajne przejścia** w Ustawieniach pokoi. Przejście w ścianie otwiera przerwę w obrysie pokoju tylko na własnym ekranie tego, kto je zna; koniec tunelu w jego pokoju jest tam oznaczony „Tajne przejście do:” i pokojem, do którego prowadzi, nazwanym, gdy już ten pokój znalazł. To nie jest to, co kontrola regionów nazywa przejściem (sekcja 9.1): tamto to region z zachowaniem Teleport albo Change Level, który nigdy nie jest pokojem.

- **Nowe przejście.** Na zakładce Tajne przejścia kliknij **+ Nowe tajne przejście**, a potem dwa razy na ścianie między dwoma pokojami piętra na ekranie: gdzie przejście się zaczyna i gdzie kończy (Esc anuluje). Daj je uczniowi przyciskiem **+** i jego imieniem. Każdy przycisk zakładki działa od razu; Zastosuj i Anuluj tego nie zmieniają.
- **Tunel lub schody.** **+ Tunel lub schody**, potem kliknięcie w każdym z dwóch pokoi: gdzie się zaczyna i gdzie wychodzi, a każdy koniec ląduje na środku swojego pola. Przy schodach przełącz piętro przed drugim kliknięciem (Esc anuluje). Koniec poza pokojem, oba końce w jednym pokoju albo koniec na polu, na którym kończy się już inny tunel, są odrzucane. Kształt w jego wierszu mówi Tunel lub schody; Zamknięte zabiera znającym oznaczenia z ekranu razem z drogą.
- **Na mapie GM-a.** Ekran każdego GM-a, także Asystenta GM-a, rysuje na mapie przejścia piętra na ekranie, a ekran gracza nie: odcinek w ścianie przerywaną linią w kolorze przejść, końce tunelu jako kółka połączone przerywaną linią, zamknięte przejście szarą przerywaną linią, a zepsute czerwonymi kropkami. Pod każdym kółkiem tajnego tunelu lub schodów jest, przygaszone, „Tajne przejście do:” i nazwa pokoju, do którego prowadzi ten koniec; przy wyjściu tunelu jednokierunkowego „Tajne przejście z:” i pokój, z którego prowadzi, a grot na przerywanej linii wskazuje wyjście. Schody nie mają linii między końcami na jednym piętrze: kierunek mówią ich napisy. Obrys, który twój ekran rysuje dla pokoju, w którym stoi token Monokumy, jest przerwany tam, gdzie w jego ścianie biegnie tajne przejście, tak jak obrys tego, kto je zna, a przerwa jest narysowana jeszcze raz, przygaszona, w kolorze obrysu.
- **Przejdź.** Uczeń, który zna tunel, przechodzi nim, gdy jego token zostanie przeciągnięty na jeden z jego końców: przez gracza na znacznik albo przez GM-a na pole tego końca (kółko na mapie GM-a, wyżej; gdzie ono jest, pokazuje **Pokaż** w wierszu przejścia). Przechodzi też, gdy stoi na znaczniku lub na polu obok niego i naciska **Przejdź** obok niego pod **Znane tajne przejścia** na karcie postaci. Przeciągnięcie, które kończy się obok końca, nigdzie nie prowadzi, tak jak token, który stawia tam sam moduł: zebranie wszystkich przy ciele, rozstawienie obsady na początku sezonu lub po rozprawie, ciało przeniesione przy sprzątaniu, cofnięcie i lądowanie. Twój własny teleport w Foundry nigdzie nie prowadzi tylko wtedy, gdy Foundry oznacza ruch jako teleport. Do przejścia potrzebny jest połączony GM.
- **Ile kosztuje tunel i gdzie ląduje.** Tunel jest oceniany tak jak drzwi: kosztuje jedno przejście za cenę drzwi, a w czasie Eclipse jedno przejście Eclipse. Tunelem uczeń cudzą sypialnię przechodzi, a zamknięte drzwi, zapieczętowany pokój, Chained, trwający incydent, Class Trial, cena, której nie może zapłacić, i wyczerpane Eclipse zawracają ucznia słowami drzwi, i wtedy nic nie jest płacone. Token ląduje na polu dalszego końca albo na najbliższym wolnym polu pokoju tego końca, na jego piętrze; jeśli tokenu nie da się tam przesunąć, cena wraca. Mastermind przechodzi tak też przez zamknięte drzwi i zapieczętowany pokój. Własny ruch gracza tokenem na dalszy koniec tunelu, przez ścianę albo na piętro, na które nie prowadzą schody, to ruch przez ścianę (ostatni punkt tej sekcji).
- **W jedną stronę.** Tunel lub schody prowadzą w obie strony, dopóki pod ich kształtem na zakładce Tajne przejścia nie wybierzesz „Tylko z” jednego pokoju „do” drugiego. Z drugiego końca **Przejdź** jest wtedy odrzucane („Tym przejściem nie przejdziesz z tej strony.”), a uczniowie, którzy je znają, widzą ten koniec oznaczony „Tajne przejście z:” i pokojem, z którego prowadzi. Przejście w ścianie zawsze prowadzi w obie strony.
- **Kto zna.** Każdy wiersz wymienia uczniów, którzy znają przejście, i skąd je znają: od GM-a (GM), od startu sezonu (start), od innego ucznia (pokazane) albo z Find Passage (znalezione). **Na start sezonu** to druga lista: kto zna przejście, gdy zaczyna się następny sezon. Reset sezonu przywraca tę listę i zabiera resztę (sekcja 16).
- **Przejście z projektu.** Secret Passage zbudowane przez gracza ma w kolumnie Źródło: Projekt, a jego budujący i ci, którym je udostępniono, są na liście jako zbudowane i udostępnione; wyłom ma Rodzaj Wyłom (sekcja 11). Każdy przycisk działa na przejście z projektu tak jak na twoje. Przejścia z projektów i to, kto je zna, znikają z resetem sezonu; twoje zostają.
- **Odbierz.** Uczeń, który nie stoi w pokojach przejścia, zapomina je od razu. Dla tego, który w nich stoi, wybierasz: **Odbierz teraz** robi z przejścia ścianę dla niego od tej chwili, a **Odbierz po wyjściu z pokoju** zostawia je otwarte, dopóki nie wyjdzie.
- **Zamknij, Otwórz i Usuń.** Zamknięte przejście zachowuje listę tych, którzy je znają, i jest dla nich wszystkich ścianą, dopóki go nie otworzysz. **Usuń** zapomina przejście i to, kto je znał, po potwierdzeniu. Gdy ściana pod przejściem zostanie przesunięta albo usunięta, wiersz to mówi: wskaż wtedy przejście jeszcze raz. Mastermind może zamknąć przejście prowadzące do jego kryjówki przyciskiem **Zamknij** na własnym arkuszu (sekcja 8), a tak zamknięte przejście otwiera z powrotem tylko GM.
- **Ujawnij i Utajnij.** **Ujawnij**, obok Zamknij, daje przejście od razu każdemu uczniowi i nikt nie dostaje o tym wiadomości: ani karty, ani dźwięku. Nie zdejmuje żadnej blokady, a reset sezonu zostawia przejście jawnym. **Utajnij** oddaje je z powrotem tylko uczniom wymienionym w jego wierszu; pokazanie w czasie, gdy było jawne, nie zostaje. Rodzaj w wierszu mówi Jawne albo Tajne, a Źródło: GM albo Tajne drzwi dla przejścia zrobionego przez Zamień na przejścia.
- **Find Passage.** Czwarty wybór Analyze, dostępny w każdym pokoju i odrzucany w Class Trial, zanim cokolwiek zostanie zapłacone: Head przeciw 16, 1 akcja. 16 albo krytyk znajduje najstarsze otwarte tajne przejście pokoju ucznia na jego piętrze, którego uczeń nie zna, a od tej chwili uczeń je zna; znaleźć można odcinek ściany albo koniec tunelu. Poniżej 16 albo gdy nie ma czego znaleźć, Find Passage nie znajduje nic. Mastermind nie znajduje żadnego: zna wszystkie. Cokolwiek z tego wyjdzie, uczeń i GM-owie dostają jedną kartę tego samego kształtu, ze znalezionym przejściem albo z „Nie znajdujesz tu tajnego przejścia.”, i z dźwiękiem otwierającego się tajnego przejścia albo Search bez wyniku. Reroll powyżej 16 znajduje raz, w pokoju, w którym padł jego rzut, i tylko wtedy, gdy uczeń wciąż tam stoi - inaczej Reroll wraca w całości; taki, który spada poniżej, zabiera tylko to, co znalazł jego własny rzut. Reset sezonu zabiera to, co znaleziono, i zachowuje tunele.
- **Pokazywanie.** Uczeń, który zna przejście, może je pokazać innemu uczniowi stojącemu w tym samym pokoju (**Pokaż tajne przejście**), bez pytania ciebie i bez akcji (sekcja 3 Podręcznika gracza). Dowiadujesz się o tym z karty. Pokazanie uczniowi, który już zna przejście, niczego nie zapisuje i nikomu nic nie mówi poza graczem, który je pokazał.
- **Mastermind zna każde tajne przejście** i nie ma go na liście. To jeden gracz, który gra Mastermindem: pierwszy połączony gracz spośród właścicieli ucznia Masterminda. Inny gracz, który też jest właścicielem tego ucznia, zna tylko przejścia, które uczeń dostał albo które mu pokazano, i obowiązują go one jak każdego ucznia. Token Monokumy przechodzi przez każde otwarte tajne przejście, gdy przesuwa go GM; czy Foundry 14 w ogóle zatrzymuje przeciągnięcie GM-a na ścianie, jeszcze nie zmierzono (LIVE-E79-08).
- **Każdy pokój potrzebuje zwykłego wejścia.** Pokoje i tokeny są w przeglądarce każdego gracza, więc pokój, do którego nie prowadzą żadne drzwi, zdradza swoje przejście: token, który w nim stoi, przyszedł przez nie. Każdy gracz widzi też, jak token przechodzi przez ścianę w miejscu przejścia i jak token, który przechodzi tunelem, znika przy jednym końcu i staje przy drugim.
- **Sekretne drzwi Foundry.** Sekretne drzwi Foundry może otworzyć każdy gracz, a jego postać przez nie przejdzie. **Sprawdź pokoje na tej scenie** wymienia każde, a wiersz Listy kontrolnej sezonu Brak sekretnych drzwi Foundry ma przycisk na nie: **Zamień na przejścia** robi z każdych zwykłą, zamkniętą ścianę, na wszystkich scenach świata, a tam, gdzie stały między dwoma pokojami, także tajne przejście, którego jeszcze nikt nie zna; daj je uczniowi na zakładce Tajne przejścia. Do tego czasu sekretne drzwi, które zmienił gracz, wracają do stanu, w jakim GM ostatnio je zostawił, tak samo jak drzwi zmienione, gdy nie był połączony żaden GM, a krok przez nie jest oceniany jak krok przez ścianę (ostatni punkt tej sekcji).
- **Linijki graczy.** Gdy gracz przeciąga token, cały stół widzi jego trasę, także przez tajne przejście. Wiersz Listy kontrolnej sezonu Linijka ruchu graczy jest ukryta ma **Ukryj**, a gdy linijka jest już ukryta, **Pokaż**.
- **Token gracza przesunięty przez ścianę** (ustawienia modułu) decyduje, co się dzieje, gdy token gracza zostanie przesunięty przez ścianę, przez którą jego postać nie mogła przejść, także przez nieznane jej tajne przejście. **Zapisz to w Dzienniku debugowania** (domyślnie) zapisuje tam wiersz, a **Cofnij token** cofa token tam, gdzie stał, mówi o tym jego graczowi i ostrzega GM-ów, raz na pół minuty dla tego samego tokenu i gracza.

---

## 10. Przedmioty

### 10.1 Kategorie, Tiery i wytrzymałość

| Kategoria | Limit |
|---|---|
| Użytkowe (leczące, Healing, przywracają Health, a uspokajające, Sanity Relief, przywracają Sanity; rodzaj przedmiotu wynika z tabeli, z której go wylosowano) | do **3** |
| Narzędzia zbrodni, Narzędzia do sprzątania i Narzędzia | razem tworzą grupę **sprzętu**: **2** sloty, najwyżej **1** przedmiot w ręku i najwyżej **1** schowany, więc uczeń z dwoma takimi przedmiotami jeden z nich trzyma w ręku |
| Truth Bullety | bez limitu |
| Klucze do pokoi | bez limitu |

Przedmiot nadany przez GM-a pomija limit noszenia, a nadmiar zostaje oznaczony.

Przedmioty mają **Tiery** od 0 do 3, a każdy Tier ma swoją **wytrzymałość**. Przedmiot użytkowy Tier 1-3 przywraca tyle, ile wynosi jego Tier, Health albo Sanity zależnie od rodzaju, bez wyboru i bez Hope:

| Tier | Użytkowe | Narzędzia zbrodni i Narzędzia do sprzątania | Wytrzymałość |
|---|---|---|---|
| 0 | „Losowy, z pozoru bezużyteczny przedmiot. Otwarty na kreatywne użycie.”; o jego użyciu orzekasz ty | bezużyteczne | **jednorazowy** |
| 1 | przywraca 1 | przeznaczone do czegoś innego, ale się nadają | **1** punkt |
| 2 | przywraca 2 | częściowo przeznaczone do tej roboty | **2** punkty |
| 3 | przywraca 3 | zrobione wyłącznie do tej roboty | **3** punkty |

Tier narzędzia zbrodni to obrażenia, które zadaje w incydencie. Tier narzędzia do sprzątania odejmuje się od DC sprzątania i Move the Body. **Przedmiot z kategorii Narzędzia trzymany w ręku** daje przewagę przy pracy nad projektem i przy sabotażu, a jego Tier odejmuje się od progu.

Kreatywne użycie przedmiotu użytkowego Tier 0 nie jest rzutem: trafia do ciebie jako karta z przyciskami **Działa i daje efekt**, **Działa bez efektu i się zużywa** i **Nie działa**, a o tym, czy przedmiot się zużył, orzekasz ty. Orzekasz o jednej rzeczy naraz: gdy twoje okno dla pierwszej karty jest otwarte, przycisk Działa na drugiej karcie o tej samej rzeczy czeka, a karta o rzeczy zużytej albo już nienoszonej zamyka się i nic nie zostaje dane.

**Wytrzymałość.** Rzut, który wypadnie z Despair, czy to sukces, czy porażka, zdejmuje jeden punkt z przedmiotu trzymanego w ręku, jeśli rzut go użył. Punkt traci przedmiot z kategorii Narzędzia przy pracy nad projektem albo sabotażu, narzędzie do sprzątania przy sprzątaniu i narzędzie zbrodni przy ciosie. Krytyk nigdy nie zdejmuje punktu. Punkt, który opróżnia przedmiot, psuje go. Przedmiot Tier 0 jest za to jednorazowy: psuje go każdy rzut, który go użył, z Hope czy z Despair, krytyk, sukces czy porażka, a arkusz pokazuje przy nim **Jednorazowy** zamiast paska wytrzymałości. Reroll akcji w incydencie oddaje przedmiot Tier 0 razem z akcją, a powtórka tej akcji zużywa go znowu. Przedmiot bez zapisanego Tieru liczy się jako Tier 0. Zaciemnienie Rot zużywa wszystko o jeden, ale nigdy nie zabiera ostatniego punktu.

Zepsuty przedmiot zostaje w swoim slocie i pozostaje zepsuty, dokądkolwiek trafi. Posiadacz pozbywa się go, chowając go do skrytki albo wyrzucając, a wyrzucenie zepsutego przedmiotu to rzut Shadow, który zawsze zostawia Remnant: Tamper Remnant w Investigation, w Class Trial i wtedy, gdy wyrzuca go strona trwającego incydentu, a w pozostałych przypadkach Prep Remnant. Własny arkusz gracza nie naprawi zepsutego przedmiotu; robi to projekt **Repair an item**, który przywraca do całości zepsuty albo zużyty przedmiot użytkowy albo przedmiot z grupy sprzętu.

### 10.2 Tabele przedmiotów

**Tabele przedmiotów** (Między sesjami) trzymają to, co może znaleźć Search. Search losuje z tabel losowych: z jednej puli Tier na kategorię i Tier (na przykład „DRPG Murder Weapons - Tier 2” i „DRPG Usables (Healing) - Tier 1”), a także z opcjonalnych tabel pokoi, na które wskazuje pokój w Ustawieniach pokoi. Search w pokoju pyta swoje źródła w stałej kolejności:

- Najpierw własne tabele pokoju: `<pokój> - Tier N`, potem `<pokój> - <kategoria>`, potem własną tabelę pokoju, a gdy żadna z nich nie odpowie, wszystkie tabele pokoju w losowej kolejności, każdą z równą szansą.
- Potem pule Tier.
- Na końcu wbudowane listy modułu.

Search daje to, co wylosował, z kategorią i Tierem tego wpisu, ale nigdy powyżej Tieru, który wywalczył rzut. Tabelę Tier znajduje się po kategorii i Tierze zapisanych na niej; zapisują je instalator i zakładka **Pule Tier**, a tabelę bez tych danych moduł rozpoznaje po nazwie w tym formacie.

Edytor ma trzy zakładki, **Pule Tier**, **Pule pokoi** i **Nowy przedmiot**, oraz przycisk **Zainstaluj / przeinstaluj**, czyli jednorazową instalację własnych, zwyczajnych, szkolnych list modułu: powstaje 20 tabel losowych w folderze „Danganronpa RPG”, a jeśli tabele już istnieją, wybierasz między **Zachowaj moje** a przebudową. Tabele stoją w kolumnie **Tabela**, z liczbą wpisów w kolumnie **Przedmioty**, a wpisy tabeli w kolumnach **Nazwa**, **Opis**, **Służy też jako** (tam, gdzie tabela ma drugie role) i **Akcje**. Wpisy tabeli pokoju są pogrupowane według rodzaju, a **Pokaż** nad nimi wybiera jedną grupę albo **Wszystko**, każdą z jej liczbą; rodzaj, którego pokój nie ma wcale, stoi na liście z 0 i nie da się go wybrać. **Zmień nazwę tabeli** i **Usuń tabelę** stoją razem obok nazwy tabeli.

Od Tier 2 wzwyż wpis może mieć jedną drugą rolę (**Służy też jako**), więc siekiera bywa narzędziem, a mop bronią. Po zmianie etykiet stare tabele nadal się znajdują. Własne listy modułu są po angielsku w każdym języku; żeby grać w innym, zmień zainstalowane tabele albo zbuduj własne. Przedmiot użytkowy ma rodzaj z tabel wszędzie tam, gdzie znają one jego nazwę: nazwa z tabel Sanity Relief przywraca Sanity, jakkolwiek przedmiot znaleziono albo dano, a Daj mówi o tym pod kategorią, gdy wybierzesz drugi rodzaj.

### 10.3 Dawanie, przekazywanie i klucze

**Dawanie i zabieranie.** **Przedmioty**, przycisk obok imienia każdej postaci w oknie Uczniowie, otwiera **Daj / zabierz przedmioty**. Na zakładce **Daj** wybierasz, co dajesz: **Przedmiot**, **Truth Bullet** albo **Klucz do pokoju**, a dla przedmiotu **Z tabel** (istniejący wpis) albo **Utwórz nowy** (taki, który wpisujesz). Kategoria i Tier istniejącego wpisu idą za przedmiotem: to te z puli Tier albo, dla tabeli pokoju, to, co pule Tier mówią o jego nazwie, a gdy nic nie mówi, oba pola pokazują **- wybierz -** i Daj czeka, aż je wybierzesz. Druga rola wpisu idzie z nim dopiero od Tier 2. **Zabierz** usuwa wszystko, co moduł śledzi. To samo okno wydaje Truth Bullety, z Remnantu na scenie albo napisane od nowa; dla takiego nowego Truth Bulletu podajesz prawdziwy typ, to, za co ma go uważać gracz, widoczność, która ustala DC Analyze, tekst dla gracza i notatkę tylko dla GM-a. Okno wydaje też Autopsy Truth Bullet uczniom, których zaznaczysz, a domyślnie zaznaczeni są żyjący.

**Przekazanie.** Uczeń może dać innemu uczniowi w tym samym pokoju Truth Bullet, przedmiot albo klucz do pokoju; takie przekazanie nie kosztuje akcji. Truth Bullet i klucz są kopiowane, więc oboje mają po jednym, a przedmiot jest przenoszony. Podczas Eclipse przekazanie jest odrzucane. Obowiązują je te same ograniczenia co kradzież albo Plant: bez Monocubów, bez Monokumy, bez ukrytych tokenów, nie w Class Trial i nie przez kogoś uwikłanego w trwający incydent. Przeglądarka GM-a sprawdza pokój ponownie, zanim zapisze przekazanie.

**Sypialnie i klucze.** Sypialnia jest zamknięta dla wszystkich poza właścicielem, a właściciel nigdy nie potrzebuje klucza. Każdy inny potrzebuje w ręku przedmiotu Klucz do pokoju; klucz schowany w skrytce niczego nie otwiera. Ten, kto ma klucz, kopiuje go komuś w swoim pokoju przez **Podziel się kopią** w wierszu klucza, a ty możesz dać klucz na zakładce **Daj** (Co: **Klucz do pokoju**). Klucz, który zmienia właściciela w inny sposób (wyciągnięty komuś przez Palm, zabrany ze skrytki, zdjęty z ciała), wciąż otwiera swoje drzwi. Gdy w Ustawieniach pokoi dajesz sypialnię komuś innemu, klucze starego właściciela do niej są zabierane, a razem z nimi kopie, które dał innym; dostajesz wiadomość, kto stracił klucz, i każdy z nich też ją dostaje. W Investigation sypialnia ucznia, o którego śmierci stół wie, stoi otworem dla wszystkich, a sypialnia ucznia, o którego śmierci wiesz tylko ty, zostaje zamknięta.

> [!WARNING]
> Klucze nazywają swój pokój we fladze: zmiana nazwy pokoju przez GM-a je przenosi (kiedy - mówi sekcja 9.1); zmiana nazwy przez gracza albo pokój narysowany od nowa pod inną nazwą zostawia je przy starej nazwie.
> Sprawdzenie kluczy naprawia, gdzie się da, własny klucz właściciela do jego sypialni, a gdy właściciel ma ich kilka, zostawia jeden; gdy naprawić się nie da, powstaje nowy klucz, a stary zostaje do usunięcia przez ciebie. Kopii, które mają inni uczniowie, sprawdzenie nigdy nie rusza (uwagi techniczne: sekcja 22).

### 10.4 Skrytki

Wszystko, czego uczeń nie nosi, leży w skrytce: domyślnie w sypialni albo w każdym pokoju, w którym Ustawienia pokoi mu ją dają. Skrytka mieści **3** rzeczy. Chowanie i wyjmowanie nic nie kosztuje, ale trzeba przy tym stać w pokoju skrytki; Truth Bulletów nie da się schować. Search nigdy nie sięga do skrytki: losuje tylko z pokoju, ktokolwiek trzymałby tam skrytkę.

**Otwarta** skrytka to szuflada: każdy, kto stoi w pokoju, może ją przejrzeć za darmo i wziąć z niej jedną rzecz, raz na porę dnia z każdej skrytki. Drugie sięgnięcie do tej samej skrytki w tej samej porze dnia jest odrzucane, a właściciel nie dowiaduje się o sięgnięciu w tej chwili. **Ukryta** skrytka to taka, dla której właściciel zbudował schowek; to projekt według twojego uznania, a skrytkę robisz ukrytą, przełączając jej komórkę w Ustawieniach pokoi (**ukryta**). Ukrytą skrytkę znajduje tylko Analyze > Find Stash, rzut na Head przeciw **16**. Znalezienie otwiera tę jedną skrytkę tej jednej osobie, dopóki tego nie usuniesz, i odtąd ta osoba przegląda ją jak otwartą. Mastermind widzi każdą skrytkę.

**Właściciel dowiaduje się po powrocie.** Gdy sięgnięcie coś zabrało, a właściciel stał wtedy gdzie indziej, dostaje szept *Ktoś ruszał twoją skrytkę i czegoś w niej brakuje.* następnym razem, gdy stanie w tym pokoju, którędykolwiek tam trafi: przejściem płatnym, darmowym albo w Eclipse, albo wtedy, gdy ty przesuniesz jego token. Dowiaduje się raz, ile by nie było sięgnięć, nigdy nie słyszy, kto ani kiedy i nie dostaje szeptu za sięgnięcie zrobione, gdy stał w pokoju, ani za własne. Ty wiesz od razu: karta tylko dla GM-ów mówi, czy właściciel widział sięgnięcie, czy dopiero się dowie, a gdy się dowie, czyich sięgnięć to dotyczy. Zaległa wiadomość przepada bez słowa, gdy skrytki już nie ma albo gdy właściciel nie żyje, zanim wróci.

### 10.5 Palm i Frisk

**Palm** (sekcja 5) to kradzież z kieszeni i podkładanie do kieszeni, a jedno i drugie rozstrzyga klient GM-a. Niezgrabnego złodzieja łapie ofiara, a pozostali uczniowie w pokoju go widzą i wiedzą, czyja to była ręka; przedmiot widzą tylko przy Despair na rzucie Shadow, tak jak przy ciele. Plant do pełnych kieszeni nie wchodzi: przedmiot zostaje u podkładającego, który słyszy, że ofiara niczego nie poczuła, ofiara nie dowiaduje się niczego, a akcja przepada. **Frisk**, trzeci kierunek Palm, niczego nie przenosi. Jawny Frisk pyta gracza celu, który ma 60 s na odpowiedź, a za postać bez gracza odpowiadasz ty. Odmowa albo brak odpowiedzi pozwala przeszukującemu zmusić cel rzutem Body 12 na oczach pokoju, a o zmuszeniu przeszukujący decyduje w ciągu 30 s; zmuszanie po odmowie działa, dopóki nie wyłączysz *Frisk: zmuszanie po odmowie* w ustawieniach modułu. Frisk ukradkiem to dwa rzuty Palm, a Frisk ukradkiem, który cel zauważy, pokój widzi tak samo, tylko bez przedmiotu. Listę dostajesz ty i przeszukujący, a przy jawnym Frisk, w którym kieszenie zostają pokazane z własnej woli albo siłą, także uczniowie w pokoju; Truth Bullety ani skrytki nigdy się na niej nie pojawiają. Frisk na ciele, którego śmierć jeszcze ukrywasz, albo na kimś w incydencie nikogo nie pyta i rozgrywa się jak przy uczniu, który nie odpowiada; dostajesz wtedy powiadomienie i możesz ręcznie otworzyć odkrycie ciała.

Gdy przeglądarka przeszukującego nie potwierdzi na czas, że dostała odmowę albo milczenie, prośba kończy się tak, jak zakończyłoby ją jego **Odpuść**, a ty dostajesz o tym wiadomość (uwagi techniczne: sekcja 22).

### 10.6 Zabieranie z ciała

Truth Bullety zmarłego ucznia przepadają, a wszystko inne, co nosił, zostaje na jego arkuszu. Inny uczeń otwiera ten arkusz, naciska **Take from the Body**, w tym oknie zaznacza, co chce, i naciska **Weź**. Zabranie nie kosztuje akcji i rzuca **Hand** raz na wszystko, co w nim jest, i to za każdym razem: drugie zabranie rzuca od nowa. Zabierający dostaje przedmioty i Neutral Truth Bullet, który mówi, co zabrał i z czyjego ciała. Przy pełnych rękach i braku skrytki przedmiot zostaje na ciele, a zabierający się o tym dowiaduje.

Zabierający musi żyć, stać w pokoju ciała i być poza Class Trial i Eclipse, a ciało (jego kafelek, a bez kafelka jego token) nie może być ukryte. Okno wyszarza zabranie, które zostałoby odrzucone, razem z powodem, i rzecz, której pełne ręce bez skrytki by nie zmieściły. Ciało Monocuba przeszukuje się jak każde inne. Ciało, którego nikt jeszcze nie znalazł, mogą przeszukać tylko ci, którzy wiedzą o śmierci: GM-owie, gracze incydentu, gracz samej ofiary i uczeń, który znalazł je sam; jego Truth Bullety są wtedy wciąż na nim i nie da się ich zabrać. Truth Bullet zabierającego, który mówi, czyje to było ciało, czeka wtedy w twoim zapisie tej śmierci; daje go ujawnienie śmierci (sekcja 13.4), z datą i miejscem zabrania przedmiotu. Przejście przedmiotu z arkusza na arkusz to dane świata, które ma każda przeglądarka, przed odkryciem tak samo jak po nim.

Ciało zachowuje **jeden** Remnant, powiązany ze zbrodnią, a jego notatka wymienia wszystko, co z ciała zabrano. Rzut na Hand ustala, jak wyraźny jest ten Remnant; jego widoczność tylko rośnie, więc kolejne zabranie może go uwyraźnić, nigdy osłabić:

| Rzut na Hand przy zabraniu | Remnant ciała |
|---|---|
| Poniżej **12** | Evident |
| Od **12** do **17** | Subtle |
| **18** i więcej albo krytyk | Hidden |

Remnant zostaje tam, gdzie go położono, przy kafelku ciała, a dopóki ciało nie ma kafelka, przy jego tokenie. Karta Remnantu nazywa akcję „Zabrane z ciała”, a token nosi dłoń Palm: dla GM-a zawsze, dla gracza dopiero wtedy, gdy jego własna kopia zostanie rozpoznana, a przy Remnancie ciała, którego nikt nie znalazł, dopiero wtedy, gdy stół wie o tej śmierci; kopia znaleziona wcześniej do tego czasu nie mówi, co ją zostawiło. To, który Remnant należy do ciała i co z ciała zabrano, zapisują tylko GM-owie (sekcja 14).

Gdy w pokoju jest jeszcze inny uczeń, zabierający rzuca też **Shadow** przeciw **16**, żeby nikt tego nie zauważył, a krytyk wystarcza; gdy nikogo więcej nie ma, o rzut się nie pyta. O tym, czy rzut na Shadow jest potrzebny, decyduje to, kogo w pokoju pokazuje twój ekran, a ekran zabierającego się tu nie liczy: zabranie gracza, które u ciebie jest widziane, przychodzi z rzutem na Shadow albo niczego nie przenosi, a jego okno prosi wtedy o ten rzut, nawet gdy na jego ekranie nikogo nie ma; gdy zamknie okno, nic nie zostaje zabrane. Pudło wysyła jedną kartę uczniom policzonym w pokoju i tobie: przy Hope mówi, że zabierający przeszukał kieszenie ciała, a przy Despair także, co zabrał. Pudło nie kosztuje Sanity, a przy ciele, o którego śmierci stół jeszcze nie wie, karta idzie tylko do ciebie.

Liczy się tylko pierwszy rzut wykonany na dane zabranie; rzut powtórzony, zanim to zabranie zostanie wysłane, nie liczy się wcale. Zabranie, którego odmawiasz (zabierający wyszedł z pokoju), zachowuje swój rzut na następną próbę, a nowe kości tej próby się nie liczą. Reroll zabrania przepisuje kości i nic więcej: zabrane rzeczy zostają, a ciało wygląda tak jak przedtem.

Zmarli sami niczego nie ruszają: arkusz zmarłego ucznia nie daje Użyj, Weź do ręki, Wyrzuć, Schowaj ani Wyjmij.

---

## 11. Projekty i pułapki

### 11.1 Projekty

Projekty to Countdowny z Daggerheart, które liczą *w górę*. Skale:

| Skala | Postęp |
|---|---|
| Trivial | **3** |
| Standard | **4** |
| Complex | **6** |
| Desperate | **8** |

Każdy projekt ma nazwę, obrazek albo ikonę w zasobniku, skalę, pokój (albo dowolny), wymaganą statystykę, widoczność, pole **Morderstwo pośrednie** i opis do 1000 znaków. Statystykę projektu bierze każdy rzut na nim, także Sabotage. Projekt zapisany bez statystyki dostaje propozycję gracza przed pierwszym rzutem: zatwierdzasz ją, zmieniasz albo odmawiasz na jednej karcie, a statystyka, którą ustalisz, zostaje statystyką projektu (sekcja 5). Tajny projekt widzą proponujący i GM-owie; udostępnij go wspólnikom. Budującego nie da się odsunąć od jego własnego projektu.

Opis jest wymagany w propozycji gracza oraz w twoich oknach tworzenia i edycji. Tekst z propozycji otwiera okno zatwierdzenia i możesz go tam zmienić, a projekt ustalonego rodzaju przychodzi z nazwą rodzaju, która nie wymienia żadnego pokoju. Po zatwierdzeniu opis zmieniają już tylko GM-owie, w oknie edycji projektu (ołówek w jego wierszu menedżera). Każdy, kto zna projekt, czyta opis na karcie jego tokenu, a otwarta karta nadąża za edycją. Starszy projekt bez opisu dostaje go, gdy otworzysz jego okno edycji, które o opis poprosi; zapis w menedżerze o opis nie prosi.

**Projects** (kafelek panelu) to menedżer: tabela projektów pogrupowanych według pokoju, z kolumną dla każdego gracza pod **Widoczny także dla**. Tu tworzysz, edytujesz, udostępniasz, dodajesz i odejmujesz postęp oraz usuwasz; kosz w wierszu projektu najpierw pyta, potem usuwa projekt na dobre. **Szerokie okna projektów**, ustawienie każdej przeglądarki (domyślnie włączone), otwiera na tym ekranie szerzej okna Utwórz projekt, Edytuj projekt i Zaproponuj projekt. W zasobniku Countdownów Daggerhearta przyciski - i + w wierszu projektu dodają albo odejmują jeden postęp, a menu wiersza usuwa projekt tak jak menedżer. Zasobnik nie daje w wierszu projektu Reveal ani Hide, bo to, kto widzi projekt, ustawiasz w menedżerze.

Projekt z pokojem stoi na mapie jako token na dwa pola, bez przezroczystości i bez nazwy, z ikoną projektu w zasobniku albo, gdy projekt nie ma ikony, z młotkiem. Token możesz przeciągać, a podwójne kliknięcie otwiera jego kartę. Gracz widzi token, gdy już stał w jego pokoju, a token tajnego projektu dopiero wtedy, gdy ktoś mu ten projekt udostępni. Gracz Masterminda zna jawny projekt w każdym pokoju sceny, na której stoi jego postać, na swojej mapie i w swoim zasobniku; karta na twoim ekranie wymienia go tylko przy pokojach, w których ma go zapis, żeby udostępniony ekran go nie zdradził.

Tokeny idą za swoimi projektami po każdej zmianie. Nowy projekt w pokoju dostaje token, a projekt przeniesiony do innego pokoju zabiera token na środek tego pokoju; token, który postawisz w drzwiach albo na korytarzu, zostaje tam, gdzie go postawisz. Token ukończonego projektu zmienia kolor i wraca do dawnego, gdy pasek zostanie cofnięty, a projekt bez pokoju traci token. Udostępnienie albo odebranie od razu pokazuje token temu graczowi albo go przed nim chowa. Brakujący token wraca, a token projektu, którego już nie ma, znika. Token usunięty ręcznie pozostaje usunięty, dopóki **Pokaż na mapie** w menedżerze go nie przywróci, a drugi token tego samego projektu jest tylko zgłaszany ostrzeżeniem, z nazwą projektu i jego scenami. Usunięcie projektu albo reset sezonu z zaznaczonym *Projects* zdejmuje jego tokeny ze wszystkich scen. **Spójrz poza oczywiste** w Observe może odkryć tajny projekt w pokoju szukającego (DC 18), a szukający od tej chwili zna ten projekt.

**Propozycje.** Z arkusza gracz albo pracuje nad projektem dostępnym w jego pokoju, albo proponuje nowy. Propozycja przychodzi do ciebie jako karta; zatwierdzasz ją, poprawiając po drodze skalę, pokój albo brzmienie, albo ją odrzucasz, a dopóki jej nie zatwierdzisz, nic nie istnieje. Rzut na **Praca nad projektem** daje +1 przy 12, +2 przy 18 i +2 przy krytyku, który dodatkowo zwraca akcję. Contribution dodaje +1, Patronage +2, Game Integrity odejmuje 2, a Earthquake 1. Efekt akcji pokoju *Postęp najstarszego niedokończonego projektu w pokoju* (sekcja 9.1) dodaje swoją wartość najstarszemu nieukończonemu projektowi w tym pokoju, który widzi użytkownik akcji, ale nigdy morderstwu pośredniemu. Ukończony projekt szepcze do proponującego i GM-ów, nigdy do stołu, bo projekt może być tajny, a to, co ukończony projekt teraz robi, mówisz ty.

Ukończony projekt może też dać swojemu pokojowi akcję. Przycisk **Edytuj akcję w pokoju** obok ołówka w menedżerze projektów ustala jej nazwę, efekty (jak akcje samego pokoju, sekcja 9.1), to, czy kosztuje akcję (**Kosztuje akcję**, włączone, dopóki tego nie wyłączysz), i czas działania: na stałe albo przez określoną liczbę pór dnia lub dni od pory dnia, w której projekt ukończono, ale nigdy dłużej niż do końca rozdziału. Taka akcja nie wymaga rzutu i zostawia Faint Remnant o widoczności Subtle, jak akcja samego pokoju; każda postać może jej użyć raz na porę dnia, a okno Projects mówi, że akcja jest w Facilities i jak długo działa.

**Kto widzi jawny projekt.** Jawny projekt z pokojem pojawia się w zasobniku i na mapie gracza, gdy któraś z jego postaci już stała w jego pokoju albo stoi w nim teraz. Proponującemu pokazuje się od chwili, gdy go zatwierdzisz, gdziekolwiek go umieścisz, a jego gracz dostaje o tym prywatną kartę. To, kto zaproponował projekt, wiesz tylko ty i nie ma tego w żadnych danych, które trzymają przeglądarki graczy. Reszta stołu widzi projekt dopiero wtedy, gdy ich własna postać tam dotrze, a projekt, na który nikt z nich nie wszedł, nie stoi w ich zasobniku. Lista **Wie, że tu jest** na karcie projektu mówi, kto go widzi.

### 11.2 Projekty, które zmieniają ścianę, przedmiot albo zamek

Okno gracza **Zaproponuj projekt** daje w polu **Rodzaj** sześć rodzajów obok własnego projektu, każdy z ustaloną statystyką i rozmiarem. To, co rodzaj robi, gdy jego pasek się zapełni, dzieje się samo i nie zostawia ci niczego do orzekania:

| Rodzaj | Statystyka, rozmiar | Dostępny, gdy | Po ukończeniu | Reroll rzutu, który go ukończył |
|---|---|---|---|---|
| Secret Passage | Hand, Complex (6), zawsze tajny | pokój budującego dzieli ścianę z innym pokojem na tym piętrze | tajne przejście przez tę ścianę; zna je budujący i każdy uczeń każdego gracza, któremu udostępniono projekt, zanim został ukończony | tajne przejście i to, kto je znał, znikają |
| Breach the Wall | Body, Complex (6), jawny albo tajny | jak przy Secret Passage | dziura w ścianie, która nikogo nie zatrzymuje, dla wszystkich; pokój za nią jest wyłamany (sekcja 11.3) | ściana wraca |
| Seal the passage | Hand, Complex (6) | budujący zna tajne przejście, które ma bok w pokoju, w którym stoi | tajne przejście zamknięte, jak Zamknij w zakładce Tajne przejścia; kto je znał, zna je dalej, a ty możesz je otworzyć ponownie | tajne przejście znów jest otwarte |
| Close the breach | Body, Complex (6) | w ścianie tego pokoju stoi wyłom | ściana znów cała, jak **Zamknij wyłom** w zakładce | wyłom zostaje wycięty ponownie taki, jaki był; jeśli ściana się w międzyczasie zmieniła, nic nie zostaje wycięte, a GM-owie dostają wiadomość |
| Repair an item | Hand; Trivial (3) dla przedmiotu Tier 0 lub 1, Complex (6) dla Tier 2 lub 3 | przedmiot użytkowy albo przedmiot z grupy sprzętu z własnego arkusza budującego, noszony albo w skrytce, jest zepsuty albo zużyty | ten przedmiot znów cały: niezepsuty i bez zużycia; jeśli Tier przedmiotu wzrósł przed końcem naprawy, nic nie zostaje naprawione, a ty dostajesz powód, chyba że rozmiar wybrano ręcznie przy zatwierdzaniu | przedmiot znów jest zepsuty i zużyty jak przedtem, chyba że w międzyczasie znów się zepsuł albo zużył |
| Repair the Lock | Hand, Trivial (3) | zamek pokoju budującego albo pokoju obok został wyłamany przez Force the Door albo wyłom; zatwierdzenie odrzuca zamek, który naprawia już inny projekt | zamek znów trzyma, dla wszystkich; właściciel sypialni dowiaduje się o tym, gdy następnym razem do niej wejdzie | zamek znów jest wyłamany |

Po takim Rerollu projekt zostaje, dopóki następny rzut tego ucznia nie zastąpi rzutu, który Reroll mógłby cofnąć, a potem znika jako ukończony. Zamek, który naprawisz ręcznie w kolumnie **Zepsute** Ustawień pokoi, usuwa każdy projekt, który go naprawia, a GM-owie dostają o tym wiadomość.

Twoje okno zatwierdzenia sprawdza cel ponownie według tego, gdzie GM-owie widzą budującego, i pokazuje, co znalazło. Dla Secret Passage i wyłomu nazywa pokój budującego i pokój za ścianą i ma **Wskaż odcinek na ścianie**: dwa kliknięcia na ścianie między tymi dwoma pokojami, na piętrze budującego, jak przy nowym tajnym przejściu (sekcja 9.6). **Utwórz projekt** jest odrzucane, dopóki nie wskazano odcinka, a kliknięcie innej ściany okno wskazywania odrzuca. Odcinek wyłomu może leżeć na tajnym przejściu, ale nigdy na ścianie, z której wyłom już wycięto. Przy Secret Passage pole Tajny jest zaznaczone i zablokowane. Przy pozostałych rodzajach okno nazywa cel i mówi, dlaczego nie da się tego zrobić, a **Utwórz projekt** jest odrzucane, dopóki się nie da. Seal the passage i Close the breach można zatwierdzić tylko dla tajnego przejścia albo wyłomu, który ma bok w pokoju, w którym GM-owie widzą budującego, a ukończenie sprawdza to ponownie. Rozmiar Repair an item wynika z Tieru przedmiotu, jaki mają GM-owie, cokolwiek mówi karta, a ty wciąż możesz go zmienić. Statystykę, skalę i brzmienie zmieniasz jak w każdej propozycji. To, dokąd projekt prowadzi (odcinek, pokój za ścianą, tajne przejście, wyłom, przedmiot albo zamek), leży w sekretach GM-ów (sekcja 14) i nigdy w danych świata.

Gdy pasek się zapełni, cel jest oceniany jeszcze raz, zanim cokolwiek się stanie: ściana wciąż musi stać między dwoma pokojami, poza odcinkiem innego tajnego przejścia, budujący wciąż musi znać tajne przejście, wyłom wciąż musi stać, przedmiot wciąż musi być na własnym arkuszu budującego i być zepsuty albo zużyty, a zamek wciąż musi być wyłamany. Przedmiotu aktora drużyny Daggerheart ani przedmiotu innej postaci nic nigdy nie naprawia. To, czego nie da się zrobić, nie zostaje zrobione: GM-owie dostają kartę z powodem („Projekt ... jest ukończony, ale ...”), a pasek zostaje pełny.

Gdy ukończenie Secret Passage albo wyłomu zostaje odrzucone, bo tajnego przejścia nie da się otworzyć albo ściany przebić tam, gdzie je wycelowano, projekt zostaje z pełnym paskiem, a ty dostajesz kartę z powodem i przyciskiem **Wybierz cel ponownie**. Przycisk otwiera ten sam wybór co zatwierdzenie, na scenie i piętrze odrzuconego odcinka, a pokój, do którego projekt miał prowadzić, wybiera się najpierw. Wybór jest oceniany jak na starcie, a ukończenie następuje od razu, jak przy każdym ukończeniu: przychodzą karty budującego i znalazców, a projekt zostaje zachowany dla Rerolla rzutu, który go ukończył. Gdy wybór znów zostanie odrzucony, przychodzi nowa karta. Projektu, który w międzyczasie cofnięto, usunięto albo ukończono, nie da się już wycelować ponownie. Karta mówi potem, kto wybrał cel.

Uczeń, który odkrył tajny projekt przez Observe, dowiaduje się tylko, że projekt jest ukończony, i nie poznaje z niego tajnego przejścia. Ta karta przychodzi, gdy któraś z postaci tego gracza znów będzie w pokoju projektu, albo od razu, jeśli któraś tam stoi, a do tego czasu czeka u GM-ów; **Zrób kopię** zachowuje czekającą kartę.

### 11.3 Wyłom

Ściana z wyłomem zostaje na swoim miejscu, skrócona tam, gdzie zaczyna się dziura. Dziura to osobna ściana, która nie zatrzymuje ruchu, wzroku, światła ani dźwięku, a reszta ściany to kopia za dziurą. Dziurę widzą wszyscy. Tajne przejście na tej ścianie zostaje na kawałku, który je trzyma, a to, którego dotyka dziura, staje się jawne: znów jest tajne, jeśli Reroll cofnie wyłom albo sezon zostanie zresetowany, i zostaje jawne po Close the breach, bo dziurę widziano. Na jedną ścianę przypada jeden wyłom: drugi czeka, aż pierwszy zostanie zamknięty.

Pokój za wyłomem jest wyłamany na każdym swoim kawałku: jego zamek i drzwi sypialni nikogo nie zatrzymują, z kluczem czy bez, dopóki ściana nie zostanie naprawiona, a jego pieczęć jest zerwana do końca pory dnia, bez zwrotu Despair. Uczeń Chained zostaje skuty, a sala rozpraw nigdy się nie otwiera.

Uczniowie w obu pokojach dowiadują się, że ściana ustąpiła, a karta wymienia budującego tylko wtedy, gdy stoi on w jednym z nich. Uczniowie w pokojach obok słyszą łomot i to, z którego pokoju dobiegł. Tym kartom towarzyszy dźwięk „Ktoś przebija ścianę” (dźwięki Świata w sekcji 17). GM-owie dowiadują się, że pokój jest wyłamany, i o zerwanej pieczęci, jeśli była. Właściciel sypialni dowiaduje się, że jej drzwi nikogo nie zatrzymują, gdy następnym razem wejdzie do sypialni, albo od razu, jeśli w niej jest, ale nie słyszy tego drugi raz, jeśli stał w którymś z dwóch pokoi. Wyłamane drzwi, nieostrożne otwieranie zamka i naprawiony zamek docierają do właściciela tak samo: jedną kartą za wszystko, co zdarzyło się pod jego nieobecność. Budujący dowiaduje się z karty samego projektu.

Zakładka Tajne przejścia pokazuje wyłom jako Rodzaj Wyłom, Źródło Projekt, z przyciskiem **Zamknij wyłom**. Zamknij wyłom przywraca ścianę dokładnie taką, jaką zastało ją cięcie, usuwa dziurę i kopię, przenosi z powrotem tajne przejścia, które cięcie przeniosło, i sprawia, że pokój przestaje być wyłamany, chyba że wyłamuje go inny wyłom. Pieczęć pokoju wraca, jeśli zerwano ją w tej samej porze dnia. Jeśli GM w międzyczasie usunął ścianę, Zamknij wyłom niczego nie odbudowuje i mówi o tym: pokój za ścianą wraca do normalnego stanu, wyłom znika z listy, a dziurę i kawałki usuwasz ręcznie. Reset sezonu najpierw zamyka każdy wyłom (sekcja 16).

### 11.4 Morderstwo pośrednie i pułapki

Pułapkę buduje się z dwóch projektów: Prepare the Weapon (Standard do Complex, 4 do 6 postępu; może wymagać konkretnego pokoju, chyba że narzędzie już zdobyto) i Set the Trap (Trivial do Standard, 3 do 4; zawsze konkretny pokój). Karta radzi około 7-10 postępu łącznie, bo tyle wynoszą sumy obu części w najmniejszej i największej skali; to mniej więcej 4 do 5 akcji po 2 postępu za każdą pracę nad projektem (12 i +1 za pracę w pojedynkę). Pracując nad pułapką przy innych, zabójca rzuca Shadow przeciw **16**, żeby ukryć zamiar:

| Ukrywanie zamiaru (Shadow, 16) | Co się dzieje |
|---|---|
| Sukces | nikt nic nie widzi |
| Sukces z Despair | nikt nic nie widzi, a projekt zyskuje +1 |
| Porażka | pozostali dostają ogólny opis („grzebie przy probówkach”); pokój dostaje go sam, z imieniem pracującego i nazwą pokoju, bez projektu, a szczegół możesz dodać ty |

Praca nad pułapką, gdy w pokoju nie ma nikogo innego, daje **+1 postępu** ponad to, co daje rzut, także przy pudle. Każda taka praca rzuca też **Hide the Traces** (Shadow):

| Hide the Traces (Shadow) | Zostawiony Remnant |
|---|---|
| Poniżej 12 | Obvious |
| Od 12 do 17 | Evident |
| 18 i więcej | Subtle |
| Krytyk | Hidden |

**Pułapki: moduł pilnuje, GM odpala.** Projekt oznaczony jako morderstwo pośrednie ma wyzwalacz, który wybierasz przy tworzeniu albo edycji projektu:

- ktoś jest sam w pokoju;
- ktoś wchodzi;
- ktoś przeszukuje pokój (udane Search: takie, które losuje z pokoju albo prosi cię o coś konkretnego i znajduje to na kościach);
- ktoś tu odpoczywa;
- ktoś używa podłożonego przedmiotu;
- ktoś pracuje nad wskazanym projektem;
- ktoś sabotuje wskazany projekt;
- ktoś szuka tu ukrytej skrytki, znajdzie czy nie;
- ktoś szuka tu tajnego przejścia, znajdzie czy nie;
- albo „Mój własny warunek; pilnuję go osobiście”: nic go nie pilnuje, a karta przychodzi, gdy projekt jest ukończony.

Wyzwalacz zawężają dwa modyfikatory: **Tylko po zmroku** (Wieczór, Noc albo dowolne Eclipse) i **Nie ten, kto ją zbudował** (domyślnie włączony). Pułapka uzbraja się, gdy jej pasek się zapełni. Gdy pasek zostanie cofnięty poniżej celu (Reroll, twoje -), pułapka się rozbraja, a Earthquake nie odbiera niczego ukończonemu projektowi. Zapełniona znowu, pułapka uzbraja się ponownie, chyba że już raz odpaliła: taką uzbrajasz ponownie tylko ty. Gdy warunek pasuje, alarm idzie tylko do GM-ów: nazywa wyzwalacz, osobę, pokój i scenę, na której jest (dla pułapki na przedmiot - pokój i scenę, w których stoi ten, kto go trzyma), i porę dnia, i niesie wpisany warunek zabójcy. **Odpal pułapkę** otwiera ekran morderstwa z wpisanym zabójcą i zaznaczonym morderstwem pośrednim, a ofiarę wybierasz ty; **Uzbrój pułapkę ponownie** uzbraja pułapkę ponownie. Nic nie trafia do wątku zabójcy, a tytuł karty mówi tylko „Decyzja do podjęcia”.

> [!IMPORTANT]
> Pułapka, która odpaliła, jest rozbrojona, dopóki jej ponownie nie uzbroisz.

Wyzwalacz podłożonego przedmiotu działa przez **Podłóż przedmiot** na ukończonym projekcie: wybierasz, który obiekt jest pułapką i w którym pokoju czeka. Podłożony przedmiot przychodzi jako to, czego szukało następne udane Search w tym pokoju, a to, który przedmiot jest zatruty, wiesz tylko ty i nie ma tego zapisanego na przedmiocie.

**Co przeczyta konsola.** Nazwa projektu, jego postęp i to, kto może go widzieć, to dane świata, które ma każda przeglądarka, więc tajny projekt jest ukryty przed ekranami tych, którzy o nim nie wiedzą, ale nie przed ich konsolami. Kto buduje pułapkę, wpisany dla niej warunek, jej wyzwalacz i modyfikatory, czy jest uzbrojona i kiedy ostatnio odpaliła, a także to, kto zsabotował projekt, znają tylko GM-owie (sekcja 14). Przeglądarka GM-a, która nie ma zapisu pułapki, nie może jej uzbroić ani odpalić, a kontrola zdrowia sprawy liczy takie pułapki (sekcja 14.8).

---

## 12. Eclipse

Eclipse to przerwa na ustawienie się między dwiema porami dnia: gasną światła, nikt nikogo nie widzi, a każdy przesuwa swój token tam, gdzie zastanie go następna pora dnia. Eclipse nosi nazwę pory dnia, którą *otwiera*, więc nocne Eclipse odbywa się przed Nocą.

### 12.1 Rozpoczęcie

Naciśnij prawą strzałkę na HUD albo **Zacznij Eclipse** przy linii Dalej w panelu GM-a. Oba najpierw pytają, z przyciskami **Zacznij** i **Anuluj** (domyślnie). Eclipse nie zaczyna się w tych przypadkach:

- Podczas Class Trial: HUD nie pokazuje wtedy strzałki, więc najpierw zakończ rozprawę.
- Gdy znalezione ciało czeka na swoje Investigation (13.4): strzałka na HUD jest wtedy przygaszona i podaje powód, a próba rozpoczęcia mówi *Znaleziono ciało. Najpierw rozpocznij Investigation.*
- Gdy incydent jest na otwarciu albo w walce (Stage 4 i 5): strzałka jest przygaszona tak samo, a próba rozpoczęcia mówi *Trwa incydent. Najpierw go zakończ.* Od Stage 6 Eclipse się zaczyna, a w Eclipse od Stage 6 można ogłosić zdradę (sekcja 13.3).

Gdy Eclipse się zaczyna:

- Sprawdzane jest Overflow dla nadchodzącej pory dnia.
- **Akcje i Free Move są odnawiane, a niewydany Sprint albo Burst przepada**; to jedyne odnowienie.
- Kończą się pieczęcie, Chained i Silence, które trwają do końca pory dnia, a także barykady, efekty akcji pokoju dane do końca pory dnia (przy nocnym Eclipse także te dane do końca dnia) i wejście z Pick the Lock, przez które nikt jeszcze nie przeszedł; żadne z nich nie trwa w ciemności ani nie zostaje na arkuszu, gdy zgłoszone w niej morderstwo jest rozstrzygane. Pora dnia zmieniona bez Eclipse kończy je przy tej zmianie.
- Keep Watch zgłoszony przed Eclipse obejmuje posterunek w pokoju, w którym stoi pilnujący, a pilnujący zostaje na tym posterunku (sekcja 5).
- Karta ogłasza liczbę przejść, a każdy gracz dostaje szeptem swój przydział i swój pokój.
- Każdy gracz dostaje powiadomienie podsumowujące, co zrobił w porze dnia, która właśnie minęła, a GM dostaje podsumowanie całego stołu; gdy nic się nie wydarzyło, powiadomienia nie ma. To samo powiadomienie otwiera **Pomiń Eclipse**, gdy pora dnia kończy się bez Eclipse.

Gdy Eclipse zakończone bez przesuwania zegara później niż pięć minut od jego początku zostanie otwarte ponownie dla tej samej granicy, drugi raz niczego nie odnawia, a mówi o tym pytanie przy otwarciu. Zapasy Sprint i Burst kupione od tamtej pory i tak kończą się z jego otwarciem, a także przy **Pomiń Eclipse** przez taką granicę.

### 12.2 W ciemności

Zwykłe Eclipse pozwala na **2 przejścia między połączonymi pokojami**, a akcja pokoju może dać uczniowi więcej przejść. **Nocne** Eclipse pozwala każdemu wybrać dowolny pokój na mapie. Losowanie Darkness (sekcja 7) cofa nocne Eclipse do 2 przejść, a zwykłe do 1. Każde przejście jest oceniane według przydziału, a jego karta idzie prywatnie tylko do przechodzącego: z nazwą pokoju, do którego wszedł, gdy to pokój sceny, na której uczeń ma token, a w przeciwnym razie z pokojem, w którym stoi token. Przejście ponad przydział wraca tam, gdzie token stał. Gdy żaden GM nie jest połączony, żeby odpowiedzieć, przejście jest odrzucane, a token wraca; trasa odrzucona w połowie wraca na koniec ostatniego przejścia, na które pozwolono.

Podczas Eclipse działa tylko ruch. Wyjątkiem jest **Direct Murder**: można go zgłosić, wydaje akcję z nowego budżetu i czeka odłożony do końca Eclipse. Calle, przekazania, inne akcje, kafelek morderstwa i odkrycie ciała są odrzucane. Muzyka przełącza się na playlistę Eclipse. Żaden gracz nie jest w głosie, dopóki Eclipse się nie skończy, także gracze zmarłych, a GM-owie dzielą jeden kanał.

> [!IMPORTANT]
> Nic nie otwiera się bez ciebie: każde zgłoszenie w chwili złożenia wystawia w twoim dzienniku czatu kartę, szeptem do GM-ów, z tytułem „Decyzja do podjęcia”. Zabójca proponuje statystykę swojego rzutu otwarcia, a karta daje przycisk **Pozwól:** z proponowaną statystyką, przycisk **Zmień na:** z drugą i **Odmów**; gdy propozycji nie ma, daje po jednym przycisku **Pozwól:** dla każdej statystyki. O zgłoszenie, które wciąż czeka na twoją decyzję, pyta cię okno przy zapaleniu świateł, a zamknięcie tego okna oznacza odmowę. Odmowa dociera do zabójcy prywatnie od razu; o zgodzie zabójca nie słyszy, a odpowiedź poznaje, gdy zapalą się światła. Jeśli karta zginie, sekcja 20.3 podaje wywołanie z konsoli, które rozstrzyga zgłoszenie.

### 12.3 Zakończenie

Naciśnij przycisk odtwarzania na HUD albo **Zakończ Eclipse** przy linii Dalej w panelu; oba robią to samo. Gdy każdy ustawiający się uczeń przeszedł co najmniej raz, także w nocnym Eclipse, Eclipse kończy się od razu i przesuwa zegar. Uczeń, który zostaje tam, gdzie stoi, nigdzie nie przechodzi: jego gracz mówi **Gotowe** w rundzie z sekcji 12.4 albo decydujesz za niego ty w tabeli ustawienia. W przeciwnym razie otwiera się tabela ustawienia, która pokazuje, kto ile razy przeszedł i gdzie stoi, a ci, którzy jeszcze nie przeszli, są wyszarzeni. Tabela daje:

- **Zakończ i przesuń zegar** to zwykła droga: przesuwa zegar bez drugiego odnowienia.
- **Zakończ bez przesuwania zegara** w ciągu pięciu minut od początku Eclipse cofa też to, co odnowiło jego otwarcie: akcje, Free Move, Search Tokeny, zapasy Sprint i Burst oraz pieczęcie są takie, jak były, a efekty akcji pokoju i niewykorzystane wejścia z Pick the Lock, które zakończył jego początek, wracają; barykada nie wraca. Mówi wtedy *Początek tej pory dnia jest cofnięty: akcje, Free Move, to, co dały Sprint i Burst, Search Tokeny pokoi i pieczęcie wracają do stanu sprzed niego.* Następne Eclipse znów odnawia raz. Później niż po pięciu minutach Zakończ bez przesuwania zegara to wszystko zostawia. Poranne Eclipse zakończone w ten sposób cofa też następny dzień, który otworzyło na planszach, a twoje zdanie na poranek wraca do szkicu.
- **Anuluj** zamyka tabelę, a Eclipse trwa dalej.

Potem odłożone zgłoszenia Direct Murder są oceniane według tego, gdzie każdy ostatecznie stanął: gdy w pokoju zabójcy jest **dokładnie jedna inna postać**, zostaje ona ofiarą, wszystko inne kończy się niepowodzeniem, a zabójca słyszy dlaczego. Tylko pierwsze ważne zgłoszenie otwiera incydent. Drugi zabójca, którego zgłoszenie też było ważne, słyszy tylko twoją zwykłą odmowę („GM nie pozwolił. Akcja przepada.”), a ty dowiadujesz się, kto to był. Pilnujący z Keep Watch dostaje podsumowanie, ile osób weszło na jego posterunek i z niego wyszło, a jego warta się kończy.

### 12.4 Najpierw gracze

Zanim zegar przesunie się po twoim naciśnięciu (strzałką, **Zacznij Eclipse** po pytaniu, **Zakończ Eclipse** albo **Pomiń Eclipse**), każdy gracz, który ma ucznia w obsadzie, czyli wśród żywych i Monocubów, dostaje okno z tym, co chcesz zrobić, i przyciskami **Gotowe** i **Jeszcze chwila** (domyślnie); po **Jeszcze chwila** okno wraca z samym przyciskiem Gotowe. Twoje okno pokazuje każdego gracza jako *Gotowe*, *Jeszcze chwila*, *Jeszcze bez odpowiedzi* albo *Bez połączenia, liczy się jako „Gotowe”*. Okno idzie dalej samo, gdy każdy połączony gracz odpowie Gotowe, a przy zakończeniu dopiero wtedy, gdy każdy uczeń przeszedł albo jego gracz odpowiedział Gotowe. Własnymi przyciskami tego okna (**Zacznij**; **Zakończ i przesuń zegar** albo **Zakończ bez przesuwania zegara**; **Przesuń zegar**) idziesz dalej bez czekania na pozostałych, po potwierdzeniu: **Dalej** albo **Anuluj** (domyślnie, wraca do okna). Przy zakończeniu z uczniem, za którego nikt się nie ustawił, pyta zamiast tego tabela ustawienia. Własne **Anuluj** tego okna kończy rundę i zamyka okna graczy, a każdy gracz dowiaduje się, że jeszcze chwilę poczekasz. Odpowiedź gracza sama niczego nie przesuwa: zegar przesuwa twoje okno, swoim przyciskiem albo samo po ostatnim Gotowe.

Rundy nie ma, gdy trwa incydent przed Stage 6, podczas Class Trial ani gdy nie jest połączony żaden gracz z obsady. Edytuj kampanię, cofanie i konsola nikogo nie pytają, a zegar przesunięty którymkolwiek z nich kończy otwartą rundę. Rundę prowadzi tylko główny GM: gdy przycisk naciśnie inny GM, jego przeglądarka prosi o rundę głównego, a drugie naciśnięcie dołącza do rundy już otwartej, więc gdy przy jednej rundzie jest dwóch GM-ów, zegar przesuwa się raz. Incydent albo Class Trial, który zaczyna się przy otwartej rundzie, niczego w niej nie zmienia: gdy twoje okno idzie dalej, okna graczy zamykają się jak przy każdej innej rundzie, ale zegar się nie przesuwa, a tylko ty dostajesz o tym jedną linijkę. Rundę, której GM nie jest już połączony, kończy następne naciśnięcie przycisku przez innego GM-a, a ten GM dostaje o tym jedną linijkę. Gdy runda jest otwarta, mówi o tym linia **Dalej** w panelu, a jej przycisk (**Przesuń zegar** albo **Zacznij Eclipse** czy **Zakończ Eclipse**) otwiera okno ponownie.

### 12.5 Co trzyma ciemność

Zgłoszenia i przejścia znają tylko GM-owie (sekcja 14) od chwili złożenia do zapalenia świateł, a zgłoszenie poza trwającym Eclipse jest odrzucane. Konsola przeczyta nadal to, że akcja zabójcy została wydana, bo budżet akcji to dane aktora. To, gdzie kończy każdy token, pozostaje danymi świata (sekcja 1.6).

---

## 13. Silnik morderstwa od początku do końca

O liczbach decyduje moduł: o progach, drenażu, kolejności tur, obrażeniach i o tym, jakie Remnanty zostawia każdy wynik. Prozę piszesz ty: zdanie każdego wyniku pojawia się u ciebie i u uczestników, żebyście dokończyli je przy stole. Ty decydujesz, czy zabójca jest we właściwym pokoju i czy etap trwał już dość długo. Etapy trzymają się liczb z przewodnika po grze. Morderstwo przechodzi przez Stage 4 (otwarcie), Stage 5 (incydent) i Stage 6 (sprzątanie), a Investigation po odkryciu ciała to Stage 7. Notatki techniczne są w sekcji 22.

### 13.1 Otwarcie

Morderstwo otwiera się jedną z dwóch dróg. Gracz zgłasza **Direct Murder** podczas Eclipse; zgłoszenie czeka i jest oceniane przy zapalonym świetle. Zgoda gracza ofiary to umowa przy stole i nie ma na nią pola wyboru. Albo otwierasz je z **Sprawa > Morderstwo**: okno pyta o zabójcę, ofiarę i *Pułapka (ofiara sama, traci podwójnie)*. To pole zaznacza się samo, gdy ten zabójca ma ukończoną pułapkę, a okno otwarte z karty pułapki zaczyna od ucznia, którego pułapka odczytała. Okno ostrzega cię, gdy wskazanego zabójcy nie ma wśród żywych i gdy zabójca i ofiara Direct Murder stoją w różnych pokojach; otwórz je mimo to, jeśli opowieść już ich połączyła. Naraz trwa jeden incydent. To samo imię w obu polach otwiera śmierć z własnej ręki: Stage 4 wciąż rzuca, Stage 5 nie może się odbyć, a incydent idzie prosto do Stage 6; śmierć zapisuje się, gdy zamkniesz incydent.

**Stage 4, rzut otwarcia.** Direct Murder otwiera się rzutem **zabójcy**: Body albo Hand przeciw **8**, nocą z przewagą. Którą z dwóch statystyk wybrać, decydujesz ty (sekcja 5): w oknie morderstwa, gdy to ty je otwierasz (*Statystyka rzutu otwarcia*), a w przeciwnym razie w oknie na twoim ekranie, gdy rzut wychodzi. Póki wybierasz, tylko zabójca dostaje prywatnie wiadomość, że wybierasz, i prośbę, by napisał w swoim wątku, jak się do tego zabiera; w zaproszeniu jest potem twój wybór, zablokowany, a samo zaproszenie znika, gdy otwarcie się rozstrzygnie. Ofiara, która trzyma wartę z wynikiem 18 lub więcej albo z krytykiem (Keep Watch, sekcja 5), dokłada jedną kość utrudnienia do rzutu otwarcia zabójcy; okno rzutu zabójcy nazywa ją *kość utrudnienia*, nigdy nie mówi dlaczego, a wyłączyć jej się nie da.

Wynik rzutu, czyli suma wobec progu i pasmo, trafia na karcie do ciebie i do strony, która rzuca: do zabójców, a przy pułapce do jej ofiary. Key Remnanty, które zostawia rzut, i tekst z tabeli trafiają tylko do ciebie. Nieudane otwarcie jest też ogłaszane na ekranie GM-a, który je rozliczył. Rzucający, który zamknie okno rzutu, dostaje je ponownie, w sumie 3 razy; potem dowiadujesz się, że nie rzucił. **Poproś o rzut otwarcia ponownie** na trackerze pyta jeszcze raz.

**Zabójca proponuje.** Direct Murder zgłoszone podczas Eclipse zawiera propozycję zabójcy: pod zdaniem o tym, jak to robi, okno deklaracji pyta *Którą statystykę proponujesz?* i daje Body albo Hand, na start Body. Karta, która pyta cię o zgodę, mówi *Propozycja: Hand* i daje **Pozwól: Hand** na propozycji, **Zmień na: Body** na drugiej statystyce i **Odmów**; na każdym przycisku jest wartość zabójcy. Karta bez propozycji daje **Pozwól:** na każdej z dwóch. Pytanie przy zapalonym świetle, gdy odpowiedź nie padła podczas Eclipse, daje te same przyciski, a domyślne jest Anuluj. Otwarcie rzuca się potem na zatwierdzonej przez ciebie statystyce, bez drugiego okna. Zabójca nie poznaje twojej odpowiedzi przed zapaleniem świateł, więc nie ma tu *Rezygnuję*.

Zdrada nie pyta o zgodę. Jej potwierdzenie pyta o tę samą propozycję (a poza Eclipse także *Jak to robisz?*), twoje okno otwarcia daje najpierw **Zatwierdź: Body** (albo Hand), a zabójca dowiaduje się, że rozstrzygasz o statystyce, którą zaproponował. Otwarcie ofiary pułapki zostaje twoim wyborem, bez propozycji, tak samo jak morderstwo, które otwierasz ze sprawy; **Poproś o rzut otwarcia ponownie** pyta bez propozycji.

| Rzut zabójcy | Co się dzieje | Ile Key Remnantów będzie w sprawie |
|---|---|---|
| Hope | incydent się zaczyna | **5** |
| Despair | incydent się zaczyna; Sanity ofiary od razu spada do 0, a Role Reversal jest dla niej zamknięte na ten incydent | **4** |
| Krytyk | incydent się zaczyna; krytyczne otwarcie zostawia najmniej Key Remnantów | **3** |
| Porażka | nie ma incydentu; ofiara nigdy się nie dowiaduje, że coś próbowano, a akcja przepada | - |

**Zabójca za „?”.** Otwarcie Direct Murder, które udaje się z Hope albo jest krytykiem, ukrywa zabójcę. Jego tokeny na każdej scenie stają się „?” z mystery man Foundry, bez pierścienia, imienia i pasków, a jego wygląd wraca dokładnie wtedy, gdy kończy się maska. Nikt poza zabójcami nie dowiaduje się, kto to: karta Eventu ofiary i jej wiersz tury nikogo nie nazywają, a pierwszy szept do ofiary mówi *ktoś*. Arkusz zabójcy, który ma otwarty inny gracz, zamyka się. Zabójca trafia do własnego cichego pokoju głosowego: nie słyszy pokoju i nikt go nie słyszy. Jego mikrofon jest zablokowany; blokada ustawiona przez ciebie zostaje, a moduł zdejmuje tylko własną. Ty i Widzowie widzicie imię nad „?”. Zabójca dostaje pytanie *Zostać w ukryciu?* i ma **Ujawnij się** na kafelku głosu. Maska kończy się przy ujawnieniu albo z następną porą dnia, nie z incydentem. Gracz, który czyta konsolę przeglądarki zamiast interfejsu, nadal może poznać, kto stoi za „?”.

**Pułapka otwiera się rzutem ofiary**: Eye albo Head przeciw **20**, nocą tak samo jak za dnia, a między Eye i Head wybierasz tak samo jak przy Direct Murder. Ofiara dowiaduje się tylko, że czeka ją rzut. Liczba Key Remnantów nigdy nie spada poniżej **3**, a pułapka zawsze zostawia sprawie pełne 5.

| Rzut ofiary | Co się dzieje |
|---|---|
| Hope | coś tu nie gra: ofiara może wydać swój Free Move, jeśli jeszcze go ma, by się wydostać, a jeśli się wydostanie, żyje; moduł nie daje dodatkowego Move |
| Despair | ofiara rozumie, co zastawiono, i może powiedzieć innym; projekt zostaje aktywny |
| Krytyk | ofiara widzi pułapkę i czyje ręce ją zbudowały |
| Porażka | pułapka się zamyka |

Każdy sukces zostawia Evident Incident Remnant, a po zauważonej pułapce incydent zatrzymuje się na otwarciu, dopóki nie zamkniesz go z trackera. Ofiara dowiaduje się, że incydent się zaczął, dopiero gdy naprawdę się zaczyna. W Direct Murder, gdy zabójca rzuca, ekran ofiary nie pokazuje z incydentu niczego: ani obsady, ani karty, ani muzyki morderstwa, ani niczego na panelu zdarzeń. Sukces daje jej to wszystko naraz, z szeptem, który nazywa zabójcę, bo walczy się twarzą w twarz; porażka nie zostawia jej niczego.

### 13.2 Incydent (Stage 5)

**Tury i drenaż.** Incydent jest turowy, a zaczyna ofiara. Runda to ofiara, a potem po kolei każdy zabójca. Zabójca oznaczony u ciebie jako martwy nie dostaje tury; gdy żaden zabójca nie zostaje przy życiu, dostajesz o tym wiadomość i propozycję zamknięcia. Pierwsza tura ofiary jest darmowa. Za każdym razem, gdy tura wraca do ofiary, kosztuje ją **1** Sanity w Direct Murder albo **2** w pułapce, bo tam ofiara jest z drenażem sama; gdy Sanity się skończy, drenaż zabiera Health. Krytyczne Self-Defense zatrzymuje drenaż.

**W pułapce działa tylko ofiara**, bo budowniczy jest gdzie indziej: po każdej turze ofiary tura wraca do niej, a runda, drenaż i utrudnienia idą dalej z każdą jej turą. Ofiara pułapki ma przewagę na każdym rzucie kryzysowym. Jej Leave a Clue i Secure a Trace mają na pierwszym miejscu Body zamiast Shadow (Body / Hand / Leg) i zostawiają Reinforced Remnanty z Hope tak samo jak przy krytyku, a przy krytyku dwa. Rodzaje Remnantów, w tym Incident, i to, co znaczy Reinforced, opisuje sekcja 14.1.

**Obrona:** akcja wymierzona w drugą stronę jest o 1 trudniejsza, gdy statystyka broniącego to +1 lub więcej. Body ofiary broni przed Strike, Attack with a Weapon i Pin Them Down, a Leg ofiary przed Keep Your Distance; Body zabójcy broni przed Self-Defense i Role Reversal, a Leg zabójcy przed Survive i Escape Together. Obrona liczy się tak samo na kafelku, w oknie rzutu i w twojej ocenie, ale nigdy w rzutach otwarcia ani w Finishing Blow.

**Kto widzi kości.** Uczestnicy rzucają jawnie przed sobą nawzajem: każdy widzi kości pozostałych, a karta kryzysu mówi, ile wyszło w każdym rzucie i jaka to była akcja, z Dice So Nice czy bez. Nikt inny nie widzi ich kości. Budowniczy pułapki nie widzi żadnej z jej kości ani żadnej karty, także karty akcji, która kończy pułapkę.

Akcje kryzysowe ze statystyką i progiem. Gdzie wiersz wymienia kilka statystyk, gracz proponuje jedną, a ty rozstrzygasz jak w sekcji 5; gracz, który uzbroił *Resolve*, wybiera statystykę sam.

| Strona | Akcja | Rzut | Co robi |
|---|---|---|---|
| ofiara, zabójca | Use an Item | Hand 15 | Wyjmij coś z kieszeni. Działa przy krytyku albo przy trafieniu z Hope; z Despair daje Remnant i nic więcej. Każde trafienie zostawia Remnant: z Hope Evident, z Despair Subtle, przy krytyku Obvious i Reinforced. Krytyk nie kończy tury, a porażka z Despair kosztuje 1 dodatkowo. Przedmiot Tier 0 czeka na twoją decyzję, jak poza incydentem, i nie jest zużyty, dopóki nie zdecydujesz. Nie dla trzeciej osoby |
| ofiara | Leave a Clue | Hand/Leg/Shadow 12 | Remnant powiązany ze zbrodnią, zostawiony na miejscu, by pomóc innym (Evident / Subtle / Obvious), przy krytyku Reinforced. Krytyk nie kończy tury. Porażka z Hope daje przewagę przy następnej próbie tej akcji |
| ofiara | Secure a Trace | Hand/Leg/Shadow 15 | Remnant powiązany ze zbrodnią, zostawiony na miejscu i Reinforced przy każdym trafieniu (Evident / Subtle / Obvious). Krytyk nie kończy tury. Porażka z Hope daje przewagę przy następnej próbie tej akcji |
| ofiara | Self-Defense | Hand/Leg/Body 18 | Walcz. Hope otwiera Survive i Role Reversal, Despair tylko Role Reversal. Krytyk zatrzymuje drenaż i otwiera oba, a jedno z nich można wziąć w tej turze bez rzutu. Broń daje przewagę. Role Reversal otwiera się tylko tam, gdzie jest dostępne; Self-Defense, które nie otworzyłoby niczego innego (Despair, gdy Role Reversal jest niedostępne), nie przepada i można spróbować znowu. Porażka z Despair kosztuje 1 dodatkowo |
| ofiara | Survive | Leg 18 | Kończy incydent i drenaż. Despair dodaje wskazówkę, kto to był; krytyk dodaje odporność na ten i następny rozdział. Wymaga wcześniej Self-Defense. Porażka kosztuje 1 dodatkowo |
| ofiara | Role Reversal | Hand/Leg/Body 15 | Ofiara staje się zabójcą. Hope albo krytyk przywraca też całe Health i całe Sanity; krytyk od razu zabija pierwotnego zabójcę. Wymaga wcześniej Self-Defense. Niedostępne wobec pułapki i wtedy, gdy ktoś już dołączył do zabójcy (Partners in Crime, Double Role Reversal). Broń w ręku daje przewagę, a porażka z Despair kosztuje 1 dodatkowo |
| zabójca | Strike | Hand/Leg/Body 15 | Zabiera ofierze 1 Health i 1 Sanity i zostawia Remnant: z Hope Hidden, z Despair Subtle. Krytyk: 2 do wyboru zabójcy i żadnego Remnantu. Porażka z Despair i tak zabiera 1 Sanity i zostawia Evident Remnant |
| zabójca | Pin Them Down | Body 12 | Utrudnienie na Leave a Clue i Survive ofiary przez jej dwie najbliższe tury; krytyk blokuje oba na te tury. Z Despair trafienie zostawia Subtle Remnant, a pudło Evident Remnant |
| zabójca | Keep Your Distance | Leg 12 | Utrudnienie na Secure a Trace i Role Reversal ofiary przez jej dwie najbliższe tury; krytyk blokuje oba na te tury. Z Despair trafienie zostawia Subtle Remnant, a pudło Evident Remnant |
| zabójca | Attack with a Weapon | Body/Hand/Leg 15 | Obrażenia to 1 + połowa Tieru broni zaokrąglona w górę (krytyk: 1 + Tier). Bez broni rzut z utrudnieniem, a sukces improwizuje broń: Tier 2 z Hope albo przy krytyku, Tier 1 z Despair. Obrażenia rzeczy Tier 0 ustalasz ty, od 0 do 2 |
| zabójca | Finishing Blow | Body/Leg/Hand | Próg to **5 razy pozostałe Health ofiary**, więc przy 0 Health cios jest darmowy. Kończy incydent; Despair zostawia Incident Remnant. Krytyk: pierwsza próba sprzątania zadającego cios w Stage 6 nie kosztuje Sanity, udana czy nie |
| trzecia osoba | Escape Together | Leg 15 | Oboje wychodzą. Hope albo krytyk przywraca ofierze zasoby, a krytyk dodaje odporność na ten i następny rozdział. Przy porażce wychodzi tylko trzecia osoba i już nie wraca |
| trzecia osoba | Double Role Reversal | bez rzutu | Ofiara i trzecia osoba stają się zabójcami, a pierwotny zabójca zaczyna krwawić. Nikogo nie leczy. Zostawia Evident Remnant |
| trzecia osoba | Partners in Crime | bez rzutu | Trzecia osoba dołącza do zabójcy. Zostawia Subtle Remnant |
| trzecia osoba | Averted Eyes | bez rzutu | Odejdź. Nie zostaje po tobie żaden Remnant i już nie wracasz |

Koszt „1 dodatkowo” to 1 Health albo Sanity więcej ponad drenaż. Akcje rozwiązania (Survive, Role Reversal, Escape Together, Finishing Blow) kosztują **1 Sanity** zamiast akcji, a gdy Sanity już nie ma, **1 Health**. Trzy wybory trzeciej osoby bez rzutu są darmowe.

**Wejście w trakcie.** W Direct Murder postać, której token wejdzie do pokoju, automatycznie dostaje jeden darmowy wybór spośród rozwiązań trzeciej osoby. Token wchodzący do pokoju to jedyna droga: nie ma ręcznego „ktoś wchodzi”. **Czwarta osoba anuluje incydent** tam, gdzie stoi: nikt nie ginie, nikt nie zostaje Blackened, to, co już się stało, zostaje, a nowo przybyłemu nic się nie mówi. Trzecia osoba, która odeszła (Averted Eyes albo nieudane Escape Together), zostaje poza incydentem, a jej token, wchodząc znowu, nie zajmuje miejsca. Ofiara, której skończą się Health i Sanity, ginie bez Finishing Blow i wtedy nikt nie zyskuje tego, co daje tam krytyk. Poza zakończeniami, które rozlicza sam silnik, nic tu nie zabija automatycznie.

> [!IMPORTANT]
> Niektóre wyniki z tabeli powyżej to proza, którą przekazujesz ty, a nie efekty, które nakłada silnik: przywrócenie ofiary po Escape Together, odporność na ten i następny rozdział, wskazówka z Survive i śmierć pierwotnego zabójcy przy krytycznym Role Reversal (silnik zamienia strony, przywraca nowego zabójcę i zostawia Remnant (Evident, Reinforced); śmierć zapisujesz ty). Zamiana przywraca nowego zabójcę tylko z Hope albo przy krytyku; nikomu innemu Health ani Sanity z nią nie wraca.

**Tracker incydentu** (kafelek Morderstwo, gdy trwa) odświeża się na żywo i od otwarcia do Stage 6 ma jedną szerokość. Zaczyna się paskiem tury: etap, tura i czyja strona działa, w kolorach tej strony, a w Stage 6 informacja, że tury się skończyły. Pod nim stoją trzy fakty: **Kto** (kto atakuje kogo i ewentualna trzecia osoba), **Zostało** (ile Health i Sanity zostało ofierze, tak jak mówi jej arkusz) i **Sprawa** (liczba Key Remnantów). Gdy otwarcie czeka, tracker pokazuje, na czyj rzut czeka i do kogo poszło zaproszenie; w trakcie walki trzy ostatnie tury: kto, jaka akcja i jak wyszło; w Stage 6 listę tylko do odczytu z Remnantami w pokoju zabójcy, każdy z jego DC usunięcia, albo jedną linię, gdy w pokoju nie ma żadnego. Jego przyciski to **Poproś o rzut otwarcia ponownie** (gdy otwarcie czeka, najwyżej raz na 10 sekund), **Oddaj turę** i **Zakończ morderstwo**. Otwarty, gdy żadne morderstwo nie trwa, mówi *Żadne morderstwo nie trwa.* i daje przycisk **Otwórz morderstwo...**, który otwiera okno Morderstwo; gdy incydent się zacznie, okno Morderstwo staje się trackerem.

Stage 6 zaczyna się sam po Finishing Blow, gdy ofierze skończą się Health i Sanity, po udanym Survive albo Escape Together albo od razu po śmierci z własnej ręki. Zaczyna się też, gdy oznaczysz ofiarę jako zmarłą przez **Postać umiera** i przyjmiesz pytanie, które się wtedy pojawi. Reroll gracza na akcji kryzysowej jest oceniany według zapisu, który trzyma tracker; Reroll akcji, która kogoś zabiła, jest odrzucany, a śmierć zostaje.

Na arkuszu walka to jeden kafelek: **Broń się** po stronie ofiary i **Akcje kryzysowe** u pozostałych, oznaczony jako darmowy i bez znaczka GM-a. Poza swoją turą jest przygaszony i mówi, czyja to tura. Jego menu wymienia akcje strony; wybranie jednej rozwija, ile kosztuje, na jakich statystykach się rzuca i co robi porażka. Gdy akcja wymienia kilka statystyk, pole pod nią pozwala graczowi zaproponować jedną i napisać, jak to robi. **Rzuć** wysyła propozycję na kartę GM-a, a potem prowadzi do okna rzutu; GM, który rzuca za postać, odpowiada we własnym oknie. Akcja, która nie wymaga rzutu, ma zamiast tego **Zrób to**.

### 13.3 Sprzątanie (Stage 6) i Tamper

Gdy incydent kończy się ciałem, zabójca wreszcie widzi na arkuszu Remnanty, które zostawił, i może nad nimi pracować. W jego własnym Stage 6 każda próba kosztuje **zero akcji i 1 Sanity**, a pierwsza próba po jego krytycznym Finishing Blow nie kosztuje nic, udana czy nie. Każdy Remnant w pokoju, w którym stoi, jest do jego dyspozycji, znaleziony czy nie. Przez kafelek **Tamper** w zwykłej grze próba kosztuje akcję i żadnego Sanity; bez akcji nie ma Tamper, a Tamper sięga tylko Remnantów wymienionych przy Tamper w sekcji 5. Liczba prób w porze dnia nie ma limitu: każda kosztuje swoją cenę i nic więcej jej nie ogranicza. W Stage 6 usuwanie, przerabianie i podkładanie tropu rzucają Shadow, a Move the Body rzuca Body; nikt nie jest pytany o statystykę, tak jak przez Tamper w zwykłej grze. Z uzbrojonym *Resolve* zabójca wybiera w oknie rzutu. Narzędzie do sprzątania w ręku daje przewagę i zdejmuje swój Tier z DC.

| Widoczność Remnantu | DC usunięcia |
|---|---|
| Hidden | 9 |
| Subtle | 12 |
| Evident | 15 |
| Obvious | 18 |

**Scena jest jeszcze ciepła:** **-3** na każdym DC, gdy trwa incydent albo gdy ciało z tego rozdziału, o którym rzucający wie, leży nieznalezione; zniżka trwa, dopóki ciało nie zostanie znalezione albo nie ruszy Investigation. Bez incydentu i bez nieznalezionego ciała, czyli w zwykły dzień, zniżki nie ma. Po wszystkich ulgach (narzędzie, ciepła scena, 3 za przerobienie) DC sprzątania nigdy nie spada poniżej **8**, ani na karcie, ani tam, gdzie GM je liczy. Wyniki **Erase a Trace**:

| Usuwanie | Remnant |
|---|---|
| Krytyk | znika i wraca 1 (Sanity albo akcja, którą zapłacono), a rzucający dostaje propozycję, by zamiast tego przerobić Remnant i wybrać, jak głośno się czyta; przeróbka, którą odrzucisz, zostawia go usuniętym |
| Hope | znika |
| Despair | znika, ale zostaje Evident Faint Tamper Remnant |
| Porażka z Hope | zostaje, a do tego Subtle Faint Tamper Remnant |
| Porażka z Despair | zostaje, a do tego Evident Faint Tamper Remnant |

Reinforced Remnanty nigdy nie schodzą.

**Reshape a Trace** to też osobna próba, o 3 łatwiejsza niż usunięcie. Rzucający pisze nową nazwę (do 60 znaków) i nowy opis (do 400), a Remnant zawsze staje się Tamper Remnantem. Przeróbka trafia do ciebie jako karta do zatwierdzenia albo odrzucenia i nic nie jest zapisywane, dopóki nie zatwierdzisz. Krytyk dodatkowo ścisza Remnant o jedno pasmo i oddaje to, czym zapłacono (Sanity albo akcję). Karta mówi, ile kopii Remnantu już ktoś ma: te kopie zachowują słowa, z jakimi je znaleziono, a kto znajdzie Remnant później, czyta przeróbkę. Na przeróbkę przypada jedno orzeczenie: orzeczenie drugiego GM-a albo twoje drugie kliknięcie jest odrzucane z informacją, kto już orzekł. Przeróbka, w której wypełniono tylko jedno z dwóch pól, jest odrzucana. Próba, którą moduł odrzuca (Reinforced Remnant, Remnant, którego gracz nie znalazł, albo Stage 6, który już minął), oddaje to, co kosztowała, i mówi graczowi dlaczego.

**Misleading Trail** ma próg **15** i podkłada Prep Remnant wskazujący innego żyjącego ucznia (Evident / Subtle / Obvious); porażka z Hope zostawia Hidden Faint Remnant, porażka z Despair nic. **Move the Body** rzuca Body przeciw **16**, o 1 mniej za każdy Tier narzędzia do sprzątania w ręku, i przenosi ciało do połączonego pokoju, który zabójca wybiera przed rzutem, nigdy do sypialni ani przez sypialnię. Pokój dwa dalej stoi na liście pod osobnym nagłówkiem i dociera do niego tylko krytyk; każde inne trafienie zostawia ciało w pokoju pomiędzy. Sukces zawsze zostawia Evident Tamper Remnant, a porażka zostawia ciało tam, gdzie było. Krytyk przy każdej z tych akcji oddaje to, czym zapłacono (Sanity albo akcję).

Sukces każdej z nich, czyli podłożony trop albo przeniesione ciało, od razu daje zabójcy Truth Bullet Remnantu, który zostawił, jak znalezisko (*Znasz ten Remnant: jest na twoim arkuszu.*). Nie daje go żadna porażka ani usunięcie czy przeróbka. Reroll tego rzutu zabiera Truth Bullet (*Nowy rzut zabiera Truth Bullet Remnantu, który po tobie został.*), a Remnant zostaje tam, gdzie jest.

Gdy w pokoju jest ktokolwiek poza współzabójcą, usuwanie, przerabianie i podkładanie tropu najpierw rzucają Shadow przeciw **16**, by ukryć, co się robi; przenoszenie ciała tego rzutu nie wymaga.

| Ukrywanie (Shadow, 16) | Koszt |
|---|---|
| Sukces | darmowy; krytyk oddaje 1 Sanity |
| Sukces z Despair | 1 Sanity |
| Porażka z Hope | 1 Sanity |
| Porażka z Despair | 2 Sanity |

Porażka ukrywania pozwala innym zobaczyć mniej więcej, co się dzieje.

**Co się psuje.** Psuje coś tylko incydent, który doszedł do Stage 6. Przy jego zamknięciu każde narzędzie zbrodni, którym zabójca zamachnął się w walce, zostaje oznaczone jako zepsute, broń każdego zabójcy i wspólnika też. Finishing Blow nie jest zamachem, więc broń tylko trzymana w ręku, gdy padał ten cios, zostaje cała, a nieudane otwarcie, pułapka czy wczesne zamknięcie nie psują żadnej broni. Gdy ciało zostanie znalezione, każde narzędzie do sprzątania, które zabójca miał na sobie przy próbie sprzątania, zostaje oznaczone jako zepsute, czy jest w ręku, czy odłożone od tamtej pory, byle wciąż noszone i nieschowane w skrytce. Zabójca, który nie sprzątał, traci zamiast tego narzędzie do sprzątania, które ma w tej chwili w ręku. Narzędzia tracą tylko zabójcy znalezionych ciał: narzędzie zdrajcy zostaje całe, dopóki nikt nie znajdzie jego ofiary. Zepsute przedmioty zostają w torbie jako dowód, który zabójca musi wyrzucić albo schować do skrytki. Właściciel dostaje wiadomość tylko o przedmiocie, który naprawdę się zepsuł.

**Okno zdrady.** Gdy incydent zostawił ciało, jego trzecia osoba może zwrócić się przeciw zabójcy: wspólnik, czyli trzecia osoba, która stanęła po stronie zabójcy, albo w Direct Murder trzecia osoba, która weszła, została i niczego nie wybrała. Nigdy ktoś, kto odszedł (Averted Eyes) albo próbował Escape Together, i nigdy, w pułapce, trzecia osoba po stronie ofiary. Oferta trwa do końca tego dnia, razem z Investigation, nie wygasa wraz z zamknięciem incydentu i jest jednorazowa; nie można z niej skorzystać, gdy trwa inna walka, ani podczas Class Trial. Spośród graczy ofertę widzi tylko ten, komu ją złożono. Zdrada podjęta w Eclipse jest zgłaszana jak każda akcja w nim: kosztuje akcję i otwiera się, gdy Eclipse się skończy, a po nocnym Eclipse następnego ranka; drugie zgłoszenie w tym samym Eclipse jest odrzucane. Zdrada, która nie może się otworzyć, gdy przyjdzie jej czas, jest odrzucana z podaniem powodu, a oferta wraca, póki trwa jej dzień. Zdrada otwiera drugi incydent z ciałem wciąż na podłodze. Twój ekran po incydencie (13.4) też ma przycisk zdrady, poza Class Trial.

### 13.4 Po incydencie i odkrycie ciała

Gdy morderstwo się zamyka, każdy jego gracz dostaje kartę, która nikogo nie nazywa, z informacją, że się skończyło, a żywa ofiara dowiaduje się też, że znowu może działać. Ofiara Direct Murder w trakcie rzutu otwarcia i budowniczy pułapki przed Stage 6 nie dostają niczego. Tylko incydent, który zostawił ciało, zapisuje **Blackened**: zabójców, których ma znaleźć Class Trial tego rozdziału (każdego zabójcę rozdziału, razem ze zdrajcą). Incydent, który doszedł do Stage 6, psuje broń, którą się zamachnięto (13.3). Z ciałem zamknięcie otwiera ekran po incydencie, *Incydent zakończony - co teraz*: **Znaleziono ciało** (ogłoś), **Przejdź do Investigation**, **Wydaj Autopsy Truth Bullet** i zdrada, jeśli jest w ofercie. Ekran przypomina też, ile Key Remnantów trzeba jeszcze rozmieścić, i o wydaniu autopsji. Bez ciała nikt nie zostaje Blackened: po Escape Together dostajesz ekran ucieczki, po innym przeżyciu krótki ekran, który to mówi, z przyciskiem do Remnantów, a incydent zamknięty przed Stage 6 mówi, że został przerwany i nikt nie zginął.

O **odkrycie ciała** moduł pyta cię, gdy w pokoju, w którym leży ciało z tego rozdziału, stoi co najmniej dwóch uczniów, w tym co najmniej jeden <ins>niezwiązany z zabójstwem</ins>. Pokój to pokój kafelka ciała albo, dopóki kafelka nie ma, jego tokenu. Niezwiązany znaczy: ani zapisany Blackened, ani zabójca trwającego incydentu, który wciąż sprząta w Stage 6; zabójcy nad własną ofiarą to wrabianie, nie odkrycie, a Monokumy i zmarli, także Monocuby, nie są świadkami. Podczas Eclipse moduł nigdy o odkrycie nie pyta. Możesz też je zacząć przyciskiem **Znaleziono ciało**.

**Moduł pyta, zanim ogłosi.** Gdy świadków jest dość, odkrycie czeka, a główny GM dostaje okno *Uczniowie znaleźli ciało*: **Ogłoś** uruchamia odkrycie, a **Jeszcze nie** zostawia je w oczekiwaniu i jest domyślne, więc Enter niczego nie ogłasza. Na to okno odpowiada tylko pełny Gamemaster: gdy połączony jest tylko Asystent GM-a, odkrycie czeka na pełnego Gamemastera. Czekające odkrycie przetrwa przeładowanie i wraca jako pytanie, gdy główny GM przeładuje stronę albo gdy jakiś GM wyjdzie i głównym zostanie inny. Do tego czasu okno **Znaleziono ciało** wymienia czekające odkrycie (*Czeka na twoje słowo*) i otwiera się na jego pokoju i ciele, więc do ogłoszenia wystarczy jedno kliknięcie. W tym czasie każdy świadek dowiaduje się prywatnie, tak jak samotny znalazca (niżej), że znalazł ciało i że nie jest tu jedynym świadkiem.

Odkrycie biegnie w ustalonej kolejności: najpierw ujawnia każdą wstrzymaną śmierć ciała w tym pokoju, potem oznacza jako zepsute narzędzia do sprzątania, które zabójcy mieli na sobie przy próbach sprzątania (13.3), zwołuje wszystkich do pokoju (ekran każdego gracza przesuwa się na jego własny token), ogłasza ciało stołowi z dźwiękiem, wstrzymuje muzykę i **czeka**. Dopiero potem pyta cię, które Faint Prep Remnanty z tego rozdziału należą do tego morderstwa; te stają się trwałymi dowodami. Ciało znalezione w tym rozdziale jest ogłaszane raz: ani werdykt, ani koniec rozprawy, ani późniejsze przejście obok niego nie ogłaszają go ponownie, a karta ciała zostaje na wierzchu przez całe Investigation. Odkrycie może ogłosić tylko główny GM: na ekranie innego GM-a **Znaleziono ciało** niczego nie ogłasza i mówi, kogo poprosić. W tym oknie ciało już ogłoszone w tym rozdziale jest tak oznaczone, a ponowne ogłoszenie go z nazwy jest odrzucane; żeby ogłosić w tym pokoju inne ciało, zostaw ciało bez nazwy. Śmierć, której nie da się ujawnić, nie jest wymieniana: odkrycie pomija tego ucznia, a GM-owie dostają informację, by ujawnili tę śmierć ręcznie. Egzekucja, z werdyktu albo z Final Trial, nigdy nie jest ciałem do znalezienia.

> [!IMPORTANT]
> Faza zostaje Daily Life, dopóki nie rozpoczniesz Investigation z linii Dalej albo z ekranu po incydencie. To czekanie nikogo nie zatrzymuje: akcje uczniów zostają otwarte, a na Investigation czeka tylko Eclipse (sekcja 12). Cisza i pulsująca karta ciała trwają tylko przez porę dnia, dzień i rozdział, w których ciało znaleziono; samo czekanie trwa, dopóki faza się nie zmieni, rozdział się nie skończy albo nie zabierze go reset (*Znalezione ciało, które czeka na odpowiedź*). Ciało ogłoszone, gdy Investigation już trwa, niczego nie wstrzymuje: Eclipse nie jest przez nie odrzucane.

**Śmierć wstrzymana do znalezienia ciała.** Gdy ginie ofiara trwającego incydentu, moduł wstrzymuje tę śmierć dla GM-ów i do stołu nic nie dociera. Chodzi o śmierć od Finishing Blow, śmierć ofiary, której skończyły się Health i Sanity, śmierć z własnej ręki w chwili zamknięcia albo śmierć przez **Postać umiera** z zaznaczonym *Zachowaj śmierć dla GM-ów, dopóki ktoś nie znajdzie ciała*; dla tej ofiary to pole jest zaznaczone od początku. Uczeń nie zostaje oznaczony jako zmarły, nie pojawia się znacznik śmierci, a jego Truth Bullety zostają na arkuszu. Karta śmierci idzie prywatnie do GM-ów i graczy incydentu, a jej dźwięk tylko do nich. O śmierci wiedzą tylko GM-owie, gracze incydentu (łącznie z zabójcą z pułapki), gracz samej ofiary, a później samotny znalazca. Każda inna śmierć, czyli egzekucja, decyzja albo okno z odznaczonym polem, od razu jest znana stołowi.

Wstrzymaną śmierć ujawniają tylko dwie rzeczy. Pierwsza to odkrycie ciała, którego pierwszy krok ujawnia każdą wstrzymaną śmierć ciała w tym pokoju na scenie, na której uczniowie je znaleźli, niezależnie od tego, na którą scenę patrzysz; ogłoszone z formularza ujawnia ją na scenie, na którą patrzysz. Druga to twoja decyzja: uczeń ustawiony na *nie żyje* w oknie Uczniowie, gdzie wstrzymana śmierć widnieje jako **Nie żyje, ciała nie znaleziono** (sekcja 3). Wtedy Truth Bullety znikają (chyba że są zachowane), śmierć zostaje zapisana z rozdziałem, dniem i porą dnia zabójstwa, nie odkrycia, pojawia się znacznik, a ten, kto w międzyczasie coś z ciała zabrał, dostaje Truth Bullet tej rzeczy (sekcja 10). Nic innego wstrzymanej śmierci nie ujawnia: początek Class Trial tylko mówi ci, w komunikacie, który zostaje na ekranie, ile jest śmierci, których nikt nie znalazł, a koniec rozdziału nic o nich nie mówi.

Dopóki nie ujawnisz wstrzymanej śmierci, stół i rozprawa traktują tego ucznia jak żywego: jego gracz dostaje kartę do głosowania, jego imię stoi na niej bez oznaczenia śmierci, a Level Up za trafny werdykt dostaje i on. Zamknięcie morderstwa nadal zapisuje zabójcę w rejestrze Blackened, ale rozprawa liczy zabójcę tylko za śmierć znaną stołowi: karta do głosowania nie pyta o nazwisko za śmierć, której nikt nie znalazł, a werdykt ani nie skazuje za nią zabójcy na stracenie, ani go za nią nie nagradza. Tak samo jest ze śmiercią, którą cofniesz: gdy przywrócisz ofiarę do życia, rozprawa nie liczy jej zabójcy. Ujawnij śmierć przed otwarciem głosowania, jeśli rozprawa ma pytać o jej zabójcę. Wstrzymana śmierć z wcześniejszego rozdziału nigdy nie zostanie znaleziona sama, bo odkrycie szuka tylko ciał z tego rozdziału: ujawnij ją ręcznie. Śmierć ujawniona w rozdziale późniejszym niż zabójstwo nie trafia na żadną rozprawę, bo rozprawa liczy tylko Blackened swojego rozdziału; taka rozprawa ani nie pyta o zabójcę tej śmierci, ani go nie skazuje.

Status *nie żyje* przełączony ręcznie na tokenie nie jest żadną z tych dwóch rzeczy: moduł czyta swój zapis, nigdy ikony statusu tokenu, więc dla modułu ten uczeń wciąż żyje. Pułapka, którą zastawił, nadal czuwa, a on wszędzie liczy się wśród żywych. Śmierć zapisuj w oknie Uczniowie (sekcja 3).

Przed odkryciem własny arkusz ofiary pokazuje panel śmierci z *Nikt jeszcze nie znalazł twojego ciała.*, a to, czego próbuje jej gracz, jest odrzucane tak jak u zmarłych. Odmowa, którą tłumaczy tylko nieodnalezione ciało, na przykład przekazanie ofierze przedmiotu albo uzbrojenie na niej Calla, trafia do pytającego jako *Teraz nie możesz tego zrobić.*, a powód trafia do okna **Dziennik debugowania**. Call jest tak odrzucany dopiero po każdym sprawdzeniu, które przechodzi Call na żywym uczniu, w tym Hope kupującego. Zgromadzenie zostawia ciało tam, gdzie leży. Stół może nadal odczytać dane aktora (sekcja 1.6), a w nich Health ofiary równe 0.

**Dźwięk znalezienia dla tego, kto wchodzi.** Za każdym razem, gdy postać ucznia wchodzi do pokoju, w którym leży ciało, jej gracz słyszy dźwięk znalezienia; dotyczy to każdej śmierci, znanej stołowi albo trzymanej, ogłoszonej albo nie, w pojedynkę albo nie. Nikt inny go nie słyszy. Dźwięk gra raz przy każdym ciele dla każdej postaci i jest zapamiętany po przeładowaniu; uczeń wskrzeszony i zabity ponownie to nowe ciało. Krok w obrębie pokoju, w którym postać już stoi, nie jest wejściem. Dźwięk nie gra podczas Eclipse, gdy idzie zmarły albo Monocub, dla zabójców tego ciała ani trzeciej osoby z jego incydentu i wtedy, gdy żaden gracz tej postaci nie jest połączony; taki gracz usłyszy go przy następnym wejściu. Dźwięk samego ogłoszenia dla całego stołu się nie zmienia, a uczniowie zwołani przez ogłoszenie nie słyszą dźwięku wejścia drugi raz.

**Samotny znalazca.** Jeden uczeń niezwiązany z tym zabójstwem, także zabójca z drugiego incydentu tego rozdziału, który stanie sam w pokoju z ciałem, którego nikt nie znalazł, dowiaduje się o tym prywatnie, bez karty czatu: *W pokoju {room} znajdujesz ciało postaci {name}. Nikt inny go jeszcze nie widział i na razie nic nie jest ogłaszane.* Od tej chwili wie o tej śmierci: tylko jego ekran rysuje znacznik śmierci na ciele, a on może zabierać z ciała (sekcja 10). Na co Tamper pozwala każdemu, na to pozwala i jemu, ale przeniesienie ciała zostaje sprawą zabójcy. Nikt inny się nie dowiaduje, a jeden świadek to nie odkrycie: zasada dwóch zostaje. Gdy świadków jest dwóch, każdy z nich, kto jeszcze nie wie, dowiaduje się tak samo, zdaniem, które mówi, że nie jest sam i że nic nie zostaje ogłoszone, dopóki nie zdecydujesz.

---

## 14. Investigation

### 14.1 Remnanty

**Remnanty** to ukryte tokeny kładzione na mapie tam, gdzie stała postać, gdy jej akcja zostawiła Remnant. Każdy ma swój typ, widoczność (Obvious, Evident, Subtle albo Hidden), to, kto go zostawił, pokój, rozdział, dzień i porę dnia, to, czy jest Reinforced (takiego nie da się posprzątać), i to, czy jest powiązany ze zbrodnią. Typy Truth Bulletów odpowiadają typom Remnantów.

| Typ | Czym jest |
|---|---|
| **Key** | twój, nieusuwalny, staje się Truth Bulletem bez analizy |
| **Neutral** | nieokreślony; Analyze zamienia go w prawdziwą kategorię |
| **Faint** | wątpliwy; to osobny rodzaj z własną kolumną Observe, a zarazem znacznik: ma go Prep Remnant zostawiony przez narzędzie z Search, Sabotage albo Misleading Trail, a w zakładce Remnanty możesz nim oznaczyć każdy Remnant. Oznaczony Remnant zachowuje swój rodzaj i jest znajdowany i analizowany przy DC tego rodzaju. Gdy zaznaczysz to w **Zakończ rozdział** (sekcja 16), koniec rozdziału usuwa każdy Faint Remnant, który nie jest ani powiązany z morderstwem, ani Reinforced; Truth Bullet ze znacznikiem **Faint** przetrwa to sprzątanie |
| **Prep** | zostaje, gdy ktoś zbierał narzędzia albo coś przygotowywał |
| **Incident** | Incident Remnant zostaje podczas samego morderstwa |
| **Tamper** | zostawia go sprzątanie, a także wyrzucony zepsuty przedmiot: podczas Investigation, w trakcie incydentu, gdy wyrzucający stoi po jednej z jego stron, i od znalezienia ciała z tego rozdziału do końca jego rozprawy; w każdym innym czasie wyrzucony zepsuty przedmiot zostawia Prep Remnant |
| **Autopsy** | wydawany; Observe nigdy go nie znajduje |
| **Final Truth** | jeden na rozdział, wskazuje Masterminda, Reinforced |

Remnanty trwającego incydentu są pokazywane jego graczom w chwili powstania, a gdy ukryjesz taki ręcznie, póki incydent trwa, znika też z ekranów graczy. Gdy incydent się zamyka, te, których nikt nie skopiował, znów są ukrywane, żeby gracze późniejszego incydentu nie zobaczyli starego miejsca zbrodni.

Każdy token Remnantu pokazuje jedną neutralną nazwę i obrazek „?”, znaleziony czy nie: nazwa i obrazek, które nadajesz Remnantowi, nigdy nie są zapisywane na tokenie. Twój ekran rysuje Remnant z danych sprawy, a ekran znalazcy z jego własnego Truth Bulletu, z jego nazwą i obrazkiem. GM widzi ikonę akcji, która zostawiła Remnant (Search, projekt, Sabotage, Dynamic Action, sprzątanie, incydent, wyrzucenie, postawienie przez GM-a, zabranie z ciała); gracz widzi ją dopiero, gdy jego własna kopia zostanie rozpoznana, a ikonę Remnantu zostawionego przez zabranie z ciała, którego nikt nie znalazł, dopiero gdy stół wie o tej śmierci. Podwójne kliknięcie Remnantu otwiera jego okno, w którym GM ustawia też jego widoczność, tak jak w zakładce Remnanty.

Powiązanie ze zbrodnią ma trzy stany: nierozstrzygnięty, **Powiązany** i **Niepowiązany**, a kolumna **Powiązany ze zbrodnią** w zakładce Remnanty pokazuje je jako ?, Tak i Nie. Gdy ofiara rozdziału umiera, z cudzej ręki albo z własnej, każdy nierozstrzygnięty Remnant rozdziału zostaje powiązany, ale ten, który oznaczysz jako Niepowiązany, takim zostaje. Broń użyta w walce wiąże Remnanty, które ją wydały. Rozpoznane kopie graczy dostają informację o powiązaniu, gdy śmierć staje się znana (odkrycie, okno Uczniowie albo publiczne zabójstwo), a gdy walka nie zostawiła śmierci, przy jej zamknięciu. Sabotage morderstwa pośredniego zostawia Remnant powiązany, gdy zrobił go zabójca albo pomysłodawca pułapki, a niepowiązany, gdy zrobił go ktoś postronny; Misleading Trail podłożony przez niewinnego nie jest powiązany.

### 14.2 Okno Investigation

**Investigation** (**Sprawa** > Investigation na panelu GM-a) to twoja teczka sprawy, aktualizowana na bieżąco. Okno otwiera się na Mapie (sekcja 14.3), a jego Tabela ma cztery zakładki.

| Zakładka | Co robi |
|---|---|
| **Remnanty** | wymienia każdy Remnant, z filtrami po graczu, pokoju i rozdziale. Tu edytujesz nazwę Remnantu, tekst dla gracza i tekst analizy, poprawiasz jego typ (na rodzaj, który może znaleźć Observe, albo zostawiasz własny) i oznaczasz go jako Faint, powiązany ze zbrodnią albo Reinforced. Kolumna **Widoczność** ustala, jak trudno Remnant zauważyć (Obvious, Evident, Subtle albo Hidden), a więc jakiego rzutu Observe potrzebuje znalazca, czy Remnant już znaleziono, czy nie: kopie już utworzone zachowują swoją widoczność, a kopia następnego znalazcy powstaje z nową. Reroll akcji albo sprzątania, które zostawiło Remnant, zachowuje widoczność, którą ustawisz. **Usuń** w wierszu najpierw pyta, podając nazwę Remnantu, a potem zdejmuje jego token z mapy i jego wiersz ze sprawy; Reinforced Remnantu nie usuwa i mówi o tym komunikat |
| **Key Remnanty** | planer (sekcja 14.4) |
| **Final Truth Remnanty** | stawia Final Truth Remnanty: **Zapisz** stawia jeden na scenie, na którą patrzysz, gdzieś wewnątrz wybranego pokoju, a bez wybranego pokoju nie stawia żadnego; gdy w tym rozdziale żadnego nie postawiono, zakładka to mówi |
| **Kto co ma** | jeden wiersz na ucznia: ile ma Truth Bulletów, Key i jeszcze nieprzeanalizowanych, każdy Truth Bullet z nazwy z tym, czym jest naprawdę, i pozostałe przedmioty z nazwy |

Stopka ma **Nowy Remnant**, **Wydaj Autopsy Truth Bullet**, **Znaleziono ciało** i **Podgląd realizacji**. **Nowy Remnant** tworzy Remnant dowolnego rodzaju w dowolnym pokoju. Oba sprzątania są w **Zakończ rozdział** (sekcja 16), a dziennik dowodów w konsoli rozprawy (sekcja 15).

**Zapisz** zapisuje tylko pola, które zmienisz, i zamyka okno. Każde inne zamknięcie okna (jego X, Escape albo **Zamknij**) też zapisuje zmiany, tak samo jak zamknięcie jednym z pozostałych przycisków stopki, które otwierają okno ponownie z tym, co zrobiły. Final Truth Remnant z wybranym pokojem jest stawiany dopiero, gdy powiesz **Postaw**. Pole, które zmieniło się gdzie indziej, gdy twoje okno było otwarte, na przykład przez zapis innego GM-a albo przeróbkę zatwierdzoną w międzyczasie, jest oznaczane i nie jest zapisywane: powiadomienie podaje jego nazwę z wpisaną przez ciebie wartością i zostaje, dopóki go nie zamkniesz. Reszta twoich zmian jest zapisywana.

Zmiana rodzaju tutaj pociąga za sobą to, co od niego zależy: Remnant zmieniony na Faint jest Faint także na kopiach graczy, zaplanowany Key Remnant, któremu dasz inny rodzaj, jest opisywany jako taki, który przestał być Key Remnantem, a Remnant, którego nikt nie skopiował, przestawiony na Incident albo z Incident, jest rysowany graczom incydentu tak, jakby go tak postawiono.

> [!NOTE]
> Każdy Remnant pamięta, kto go zostawił, a widzą to tylko GM-owie (**Kto zostawił (tylko GM-owie)**). Autor ustawiony przez ciebie działa jak własny autor gracza: czytają go **Follow My Traces**, powiązanie z incydentem i sprzątanie zabójcy, więc wskazanie zabójcy jako autora daje mu ten Remnant do posprzątania.

### 14.3 Mapa

Investigation otwiera się na **Mapie**: dowody po lewej, to, co z nich wynika, w środku, rozwiązanie po prawej; Remnanty niepowiązane z morderstwem stoją pod odstępem w kolumnie dowodów. **Tabela** jest jeden przełącznik dalej, a ten przełącznik dotyczy tylko ciebie: wybór każdego GM-a zostaje na jego własnym koncie.

Każdy węzeł pokazuje wszystko, co ma, całą nazwę i opis, i rośnie, żeby się zmieścić, a Mapa robi mu miejsce. Kliknij węzeł (albo naciśnij na nim Enter), a jego pola otworzą się w jego miejscu, w jego szerokości; Remnant albo miejsce na Key Remnant pokazuje te same pola co Tabela. Pola węzła zapisują się, gdy go zamkniesz, wybierzesz inny, przełączysz na Tabelę albo zamkniesz okno, a **Zamknij** też je zapisuje, więc na Mapie nie potrzebujesz przycisku Zapisz. **Zamknij**, Escape albo kliknięcie w puste miejsce zamyka węzeł, a **W górę** i **W dół** ustawiają ręcznie kolejność w jego kolumnie.

Na pasku nad Mapą są przyciski **Dodaj wniosek**, **Dodaj kontrę** i **Dodaj rozwiązanie**, a **Dodaj plan** dodaje **Zaplanowany Remnant**, **Zaplanowany Final Truth** albo **Zaplanowany Truth Bullet** (sekcja 14.5). Wybór obok **Dodaj plan** ustala kolejność w kolumnie: ręcznie, po rodzaju, po pokoju, po stanie albo z mniejszą liczbą skrzyżowań. Z czego wynika każdy węzeł, ustawiasz w jego własnych polach.

Węzeł z trybem rozprawy Straw Poll, Scrum Debate albo Logic Dive planuje w swoich polach także tę grę: pytanie i dwie odpowiedzi (przy Scrum Debate także tezę) albo zapisany zestaw Logic Dive. Jego przycisk startu w konsoli rozprawy otwiera wypełnione okno **Strefy sali** (sekcja 15.2), a **Zacznij** i tak naciskasz ty.

Po Mapie przesuwasz się, ciągnąc środkowym przyciskiem myszy w dowolnym miejscu, także nad węzłem; na touchpadzie bez środkowego przycisku ciągnij puste miejsce lewym przyciskiem. Kółko przybliża tam, gdzie jest wskaźnik, a +, - i **Dopasuj do widoku** (albo klawisze +, - i 0) przybliżają od środka.

Liczba „x/y” przy wniosku mówi, ile jego wejść mają żywi uczniowie poza sprawcą. Wniosek jest osiągalny, gdy uczniowie mają ponad połowę jego wejść (oba z dwóch, trzy z czterech), a Truth Bullet, który ma tylko sprawca, się nie liczy.

Linia nad Mapą podaje rozdział, jego liczby i problemy. Rozwiń ją, a znajdziesz w niej **Sprawdź spójność**, które wymienia to, co się ze sobą nie zgadza (wniosek, który nie wynika z niczego, rozwiązanie, do którego nic nie prowadzi, odwołanie do czegoś, czego już nie ma, tryb, którego rozprawa nie ma) i niczego nie blokuje, a także to, kto co ma, po nazwie, i formularz Final Truth.

### 14.4 Key Remnanty

Przygotowujesz **5** Key Remnantów na rozdział, w skali Trivial, Standard, Standard, Complex i Desperate. Skala to kolumna **Trudność** planera, wskazówka, jak trudno ma być znaleźć każdy z nich; nie ustala DC, bo DC wynika z widoczności, którą dasz Key Remnantowi, gdy go postawisz (sekcja 14.6). Rzut otwarcia decyduje, ile z nich zachowa sprawa (5, 4 albo 3; pułapka zachowuje wszystkie 5), nigdy mniej niż **3**. Razem Key Remnanty mają zawęzić krąg podejrzanych do **2 do 4** osób, a ostatni krok od kręgu do nazwiska należy do rozprawy.

Każdy wiersz planera ma nazwę, tekst dla gracza (co dostaje znalazca), tekst analizy (co ujawnia Analyze), twoją prywatną notatkę i **Stan**: gdzie stoi na mapie albo że jeszcze go nie postawiono. **Postaw** pyta o pokój i widoczność, stawia Key Remnant w losowym miejscu wewnątrz tego pokoju jako Reinforced i powiązany ze zbrodnią i daje mu tekst wpisany w wierszu. Postawiony wiersz pokazuje tekst swojego Remnantu; zmiana, która nadpisałaby nazwę zmienioną w międzyczasie, jest odrzucana, a GM, którego zmianę odrzucono, dostaje o tym wiadomość. Wiersz ponad liczbę Key Remnantów sprawy da się postawić tylko z zaznaczonym **Postaw więcej, niż pozwala rzut otwarcia**, a liczba sprawy przetrwa zamknięcie incydentu.

Plan należy do GM-ów (sekcja 14.8) i jest przechowywany osobno dla każdego rozdziału: każdy rozdział ma swoich pięć wierszy, a nowy rozdział otwiera się z pustym planem. Karta z prośbą gracza („patrzę na okno”) ma przycisk **Utwórz tu Key Remnant**, który może wypełnić jedno z pięciu miejsc.

> [!WARNING]
> Na starcie Class Trial moduł nalicza opłatę za Key Remnanty nieudanego śledztwa: każdy Key Remnant brakujący do **4 znalezionych**, albo do liczby sprawy, gdy jej otwarcie dało ich mniej, jest wart **3 Despair do puli każdego Monokumy** (`unfoundBar`, `unfoundDespair`, `keyFeeOf`), więc całkiem nieudane śledztwo to **+12** do każdej puli. Znaleziony to taki, którego kopię ma żyjący uczeń, tak jak trzymają ją GM-owie; kopia, której Remnant zniknął, liczy się w rozdziale, w którym ją znaleziono. Opłata jest naliczana raz na rozdział, u głównego GM-a, którykolwiek GM otwiera Class Trial, tak samo z zapisanym planerem i bez niego, i nie jest naliczana wcale, gdy rozdział minął już etap sprawy.

### 14.5 Realizacja i zaplanowane dowody

**Podgląd realizacji** niczego nie zmienia: wymienia każde miejsce na Key Remnant, którego nie ma jeszcze na mapie, a ty wybierasz pokój dla każdego, które ma stanąć. Zaplanowany pokój miejsca (wybór pokoju obok jego **Postaw**, na Mapie i w Tabeli) jest pierwszym wyborem w podglądzie i w **Postaw**; jeśli scena nie ma już takiego pokoju, mówi o tym jedna linia i wybierasz inny. Miejsce planuje też widoczność, autora i obraz: **Postaw** zaczyna od zaplanowanej widoczności, a realizacja stawia miejsce ze wszystkimi zaplanowanymi polami. Miejsce bez pokoju jest wymienione przy sprawdzeniu spójności Mapy.

**Uruchom realizację** stawia miejsca tak, jak robi to **Postaw** w planerze, i oznacza każde w twojej sprawie. Gdy realizacja coś postawiła, w tym samym oknie jest **Cofnij realizację**: najpierw pyta, potem usuwa tylko to, czego nikt nie znalazł i czego Monokuma nie ujawnił, i zwalnia jego miejsce. Gdy znaleziono ciało, a rozdział ma zaplanowaną sprawę, której realizacja się jeszcze nie odbyła, główny GM jest pytany raz na rozdział, czy otworzyć podgląd; nic nie pojawia się na mapie samo.

Zaplanowany Remnant stawiasz z jego własnego węzła na Mapie: otwórz go i naciśnij **Postaw na mapie**, które otwiera **Nowy Remnant** wypełniony z planu. Pola **Zaplanowanego Remnantu** są polami okna Nowy Remnant, w tej samej kolejności: pokój, typ, kto go zostawił, widoczność, powiązanie ze zbrodnią, Reinforced, nazwa, tekst, analiza, twoja notatka i obraz. Zaplanowany Remnant jest Incident Remnantem, chyba że wybierzesz Prep, Neutral, Faint albo Tamper, a jego widoczność i typ ustalają, jak trudno go znaleźć. Zaplanowany Remnant bez pokoju jest wymieniony przy sprawdzeniu spójności Mapy, a jego Nowy Remnant pyta o pokój.

**Zaplanowany Final Truth** tak samo planuje Final Truth Remnant: ma pola formularza Final Truth (pokój, widoczność, kto go zostawił, nazwa, tekst, analiza i twoja notatka) i obraz. Jego **Postaw na mapie** stawia go ze wszystkimi tymi polami, a gdy pokój nie jest zaplanowany, pyta o niego.

**Zaplanowany Truth Bullet** planuje Truth Bullet, który dajesz ręcznie: ma pola zakładki **Napisz nowy** okna **Daj Truth Bullet** (nazwa, prawdziwy typ, jak się pokazuje, widoczność, Faint, powiązanie ze zbrodnią, słowa, analiza i twoja notatka), obraz, odbiorcę i to, czy odbiorca dostanie wiadomość. **Daj Truth Bullet** z planu otwiera to okno wypełnione, a gdy Truth Bullet zostanie dany, węzeł pokazuje Wydany. Odbiorcą może być **Wszyscy**, w planie i w **Daj Truth Bullet**: wtedy każdy żywy uczeń dostaje własną kopię (zmarli, Monocuby i Widzowie jej nie dostają), każdy z wiadomością albo bez, jak ustawisz. Plan pokazuje Wydany dopiero, gdy wyszły wszystkie kopie; inaczej okno podaje, kto nie dostał żadnej, i możesz dać Zaplanowany Truth Bullet jeszcze raz. Na Mapie Truth Bullet, który mają wszyscy, to nadal jedno wejście. Zaplanowany Truth Bullet bez nazwy albo odbiorcy jest wymieniony przy sprawdzeniu spójności Mapy.

Truth Bullet dostaje zaplanowany obraz. Puste pole obrazu każdego planu pokazuje rysunek Truth Bulletu z modułu i ten rysunek dostaje Truth Bullet dany bez zaplanowanego obrazu, a także Zaplanowany Remnant, Zaplanowany Final Truth albo miejsce na Key Remnant postawione bez obrazu.

**Zaplanowane Autopsy.** W kolumnie dowodów zawsze jest co najmniej jeden węzeł Autopsy Truth Bullet: wpisz w jego polach nazwę, tekst dla graczy i swoją notatkę. Pola pierwszego węzła Autopsy podają też, ile Autopsy planuje rozdział: domyślnie po jednym na każde ciało (znalezione ciała i ofiara morderstwa, a jeden, póki rozdział nie ma żadnego), a możesz wybrać więcej albo mniej. Każdy zaplanowany Autopsy z wpisaną nazwą albo tekstem trafia sam, bez kliknięcia, do każdego żywego ucznia, gdy zostanie znalezione jego ciało: pierwszy przy pierwszym ciele, drugi przy drugim, chyba że w **Wysyłany przy** wybierzesz inne.

Autopsy możesz też wydać ręcznie, ile razy chcesz: **Wydaj Autopsy Truth Bullet** z panelu GM-a, ze stopki tego okna albo z ekranu po incydencie wydaje go zaznaczonym uczniom jako nazwę, to, co czyta gracz, i twoją notatkę. Okno wypełnia się następnym zaplanowanym Autopsy i oznacza go jako wysłany.

### 14.6 Observe

Gracz deklaruje, jak patrzy:

| Tryb | Czego szuka |
|---|---|
| **Rozejrzyj się za czymkolwiek** | najłatwiejszego Remnantu w tym pokoju |
| **Spójrz poza oczywiste** | najtrudniejszego Remnantu, a także tajnego projektu w pokoju przy DC **18** |
| **Follow My Traces** | najpierw własnych Remnantów gracza |
| **Skup wzrok** | tego, co gracz nazwie: karta, którą widzi każdy GM, pyta, na który Remnant wskazują te słowa, wybiera dowolny GM, a główny GM sprawdza wybór w pokoju |
| **Zbadaj punkt zainteresowania** | czegoś, co nie jest Remnantem; to ty rozstrzygasz |

Przy **Skup wzrok** i **Zbadaj punkt zainteresowania** rzut pada, zanim je zobaczysz. Odmowa wyboru przy Skup wzrok, Zbadaj punkt zainteresowania albo Observe w pokoju, w którym nie zostały żadne Remnanty, staje się kartą decyzji na tym rzucie z przyciskami **Utwórz tu Key Remnant**, **Odpowiedz** i **Nic tam nie było.**, a to ostatnie liczy się jak pudło. Wybór przy Skup wzrok zrobiony, gdy gracz przestał już czekać, po wyborze innego GM-a albo po odmowie jest odrzucany, a GM, który go zrobił, dostaje o tym wiadomość.

Rzut jest oceniany według prawdziwego typu i widoczności Remnantu; gracz poznaje wynik, ale nigdy DC. Trafienie kopiuje Remnant do ekwipunku gracza jako Neutral Truth Bullet i zostawia oryginał, a pudło kosztuje **1 Sanity**. Jeden Remnant daje jedną kopię na osobę, a Remnanty powiązane z morderstwem są pokazywane w pierwszej kolejności. Gdy ktoś po raz pierwszy skopiuje Remnant, dostajesz prośbę o jego opis (nazwa, tekst dla gracza i tekst analizy, wstępnie wypełnione); każdy, kto skopiuje go później, dostaje ten sam tekst, a krytyk pyta cię ponownie tylko o większą wskazówkę.

| Widoczność | Daily Life | Key | Faint | Prep / Incident / Tamper |
|---|---|---|---|---|
| Obvious | 8 | 6 | 12 | 9 |
| Evident | 12 | 9 | 15 | 12 |
| Subtle | 18 | 12 | 18 | 15 |
| Hidden | 21 | 15 | 21 | 18 |

Tabela podaje DC Observe. Neutral jest wyceniany jak Prep, a Final Truth jak Key. Na kolumnie Daily Life nie jest liczony żaden rzut: żaden Remnant nie jest tego rodzaju. To drabina, którą briefing Observe pokazuje graczowi dla czegoś, za czym nie stoi żaden Remnant, i skala, do której przykładasz **Zbadaj punkt zainteresowania**.

### 14.7 Analyze

Analyze to rzut Head przeciw prawdziwemu typowi Truth Bulletu i jego pierwotnej widoczności. Key i Final Truth Bullety pokazują swój rodzaj od chwili, gdy gracz je zdobędzie, ale ich tekst analizy wciąż czeka na Analyze w najłatwiejszej kolumnie (6 / 9 / 12 / 15); tylko Autopsy Truth Bullet przychodzi w pełni odczytany. Sukces ujawnia prawdziwy typ i to, czy Truth Bullet jest powiązany ze zbrodnią, a porażka blokuje ten Truth Bullet dla tego gracza do końca rozdziału. Kopia przekazana komuś innemu to inny przedmiot i nie ma blokady.

Poza Class Trial ten sam kafelek oferuje też prośbę o wskazówkę do ciebie (**14** subtelna, **18** bezpośrednia, a krytyk daje jedno pytanie, które wybierze gracz), Find Stash (**16**) i Find Passage (**16**, sekcja 9.6); gdy nie ma już Truth Bulletu do analizy, zostają tylko te trzy. W Class Trial kafelek oferuje tylko Truth Bullety. Każde użycie Analyze wymaga GM-a online, a bez niego jest odrzucane, zanim cokolwiek zostanie zapłacone.

| Widoczność | Daily Life | Faint | Prep / Incident / Tamper |
|---|---|---|---|
| Obvious | - | 8 | 12 |
| Evident | - | 12 | 15 |
| Subtle | - | 15 | 18 |
| Hidden | - | 18 | 21 |

Tabela podaje DC Analyze. Analyze nie ma kolumny Daily Life: Truth Bullet czyta się w kolumnie tego, czym naprawdę jest. Key i Final Truth Bullety oraz Autopsy wydany jako Neutral czyta się w kolumnie Key: 6 / 9 / 12 / 15. Analyze kosztuje 1 akcję; w Class Trial, gdy akcji już nie ma, kosztuje 1 Hope, a gdy nie ma ani akcji, ani Hope, 1 Sanity.

> [!IMPORTANT]
> Przy **krytycznym** Observe albo Analyze należy się graczowi od ciebie solidna wskazówka i karta mówi to na czerwono. Przy krytycznym Observe okno opisu ma na nią osobne pole, **Podpowiedź tylko dla tej osoby**: to, co tam wpiszesz, trafia tylko na Truth Bullet tego ucznia, pod opisem Remnantu, i nigdy do opisu, który kopiują późniejsi znalazcy.

### 14.8 Gdzie jest przechowywana sprawa

Sprawa jest przechowywana tylko w przeglądarkach GM-ów, nigdy w świecie, więc konsola żadnego gracza jej nie przeczyta. Zawiera klucz odpowiedzi każdego Truth Bulletu, prawdziwy typ i odczyt każdego Remnantu, to, kto jest Mastermindem i gdzie jest jego kryjówka, obsadę każdego incydentu i to, jak do niego doszło, Blackened każdego rozdziału, sekrety pułapek, plan Key Remnantów, śmierci, których nikt jeszcze nie znalazł, i resztę wymienioną w sekcji 22. Przeglądarka każdego GM-a trzyma kopię sprawy dla każdego świata, a przeglądarki GM-ów uzupełniają się nawzajem, gdy któryś GM dołącza, więc GM, który dołącza z pustą przeglądarką, niczego nie traci i niczego nie zabiera (sekcja 22.14). Przeglądarka gracza trzyma tylko to, co wolno mu wiedzieć (sekcja 22).

Gracz, który wie o tajnym projekcie, zna jego nazwę, a lista odliczań samego Daggerheart pokazuje tajny projekt jako „???”. Zmieniaj jego nazwę w menedżerze projektów, nigdy w oknie odliczań Daggerheart, bo to zapisałoby nazwę z powrotem tam, gdzie czyta ją każda przeglądarka.

**Sprawa** (panel GM-a, Diagnostyka) otwiera jedno okno z informacją, jak stara jest ostatnia kopia, i z dwoma przyciskami. **Zrób kopię** zapisuje całą sprawę do jednego pliku; trzymaj go tam, gdzie żaden gracz go nie otworzy. **Przywróć z pliku** scala plik z powrotem, gdy jego okno pokaże, co zmieni w każdym magazynie, i policzy, co by usunęło. Przywrócenie bierze tylko to, co nowsze, także nowsze usunięcie, więc może je uruchomić każdy GM, a dwa przywrócenia dają to samo co jedno. Nigdy nie bierze z pliku resetu sezonu: wiersze sprzed resetu zostają pominięte, chyba że zaznaczysz pole, które je bierze. Plik innego świata jest brany tylko po zaznaczeniu i nie przynosi żadnych usunięć, a jego Mastermind i obsada incydentu przychodzą tylko wtedy, gdy zaznaczysz także je. Po przywróceniu każdy podłączony gracz dostaje ponownie swoją część.

Gdy główny GM otwiera świat w przeglądarce, która ma mniej ze sprawy, niż według świata powinna (nowa przeglądarka, wyczyszczone dane strony), kontrola zdrowia nazywa, czego brakuje, i proponuje **Przywróć z pliku**, **Wpisz obsadę ręcznie** przy trwającym incydencie albo **Przenieś je do rejestru** dla starszych Remnantów, których klucz odpowiedzi wciąż jest na tokenie; rejestr to sprawa w takiej postaci, w jakiej trzymają ją przeglądarki GM-ów, a ten przycisk przenosi każdy taki klucz z tokenu do sprawy. Kontrola liczy też morderstwo pośrednie, którego zabójcy, warunku i wyzwalacza ta przeglądarka nie ma (jego pułapka nie może się uzbroić ani odpalić), notatkę przed sesją oznaczoną jako napisaną, której ta przeglądarka nie ma, Masterminda ustawionego w Despair Flow na „- nikt -” (sekcja 2) i Remnant, którego token wciąż ma swój klucz odpowiedzi.

---

## 15. Class Trial

Class Trial prowadzisz z jednej konsoli w jednym oknie: **Sprawa > Class Trial**. Jej pierwsza linia podaje następny krok: zacząć rozprawę, otworzyć debatę, wysłać karty, wydać werdykt, dokończyć go albo zakończyć rozdział. Ta linia liczy też Blackened w rejestrze tego rozdziału i ostrzega, gdy rejestr jest pusty, a w tym rozdziale zginął uczeń (zabójca trafia do rejestru, gdy jego incydent zostaje zamknięty). Odczyt konsoli ma **Dziennik dowodów Class Trial**, ten sam dziennik, który otwiera stopka okna Investigation: widać w nim, kto co przedstawił i kto wobec kogo wniósł Objection. Uwagi techniczne są w sekcji 22.

W trakcie rozprawy konsola pokazuje też *Czas Class Trial: użyte z budżetu min (szacunkowo)*: minuty od otwarcia rozprawy wobec 270 minut na szesnastu graczy, przeliczanych na liczbę graczy, którzy brali udział w otwarciu. Jak każdy czas w tej sekcji, to szacunek do planowania, który niczego nie blokuje. Gdy rozprawa się przeciąga, o tym, co skrócić, decydujesz ty, ale nigdy nie skracaj Ujawnienia Monokumy, Closing Argument ani głosowania.

**Stopka konsoli** zostawia każdy przycisk na jego miejscu, gdy rozprawa idzie dalej: konsola odświeża się w tym samym miejscu. Następny krok, ten, który nazywa pierwsza linia, stoi po prawej i to jego naciska Enter. Po lewej stoją **Zamknij** i to, czego nie da się cofnąć: **Zakończ Class Trial**, **Zakończ rozdział** i **Zacznij Final Trial**, a żadnego z nich Enter nie naciska. Gdy trwa Objection albo jego rebuttal, następny krok zostaje na swoim miejscu, a Enter nic nie naciska. Przycisk **Zacznij Final Trial** jest wyszarzony, dopóki nie ustawiono Masterminda, i po najechaniu mówi dlaczego: *Nie ustawiono Masterminda. Najpierw wybierz go w Ustawieniach sezonu.* Masterminda wybierasz w **Ustawienia sezonu > Mastermind** (sekcja 8).

**Stopka zmienia się wraz z rozprawą.** **Werdykt** pojawia się, gdy głosy są policzone, a **Zakończ rozdział**, gdy werdykt i podsumowanie sprawy są gotowe; każdy z nich jest wtedy następnym krokiem konsoli. Przycisku **Zacznij Final Trial** konsola nie pokazuje w trakcie zwykłego Class Trial. Rozdział bez werdyktu kończy się w dolnej części okna **Edytuj kampanię**.

**Układ konsoli.** Konsola otwiera się szeroka i na całą wysokość ekranu, żeby nic w niej nie wymagało przewijania (sekcja 22.15). Gdy Class Trial nie trwa, jej linie (następny krok i rejestr) stoją u góry, resztę okna wypełnia schemat sprawy, tylko do odczytu i bez żadnych zaznaczeń, a pod nim zostają przyciski stopki: **Zamknij**, **Zacznij Final Trial** i **Zacznij Class Trial**.

- **U góry status**: pierwsza linia, czas rozprawy, scena stołu i rejestr, a pod nimi wybór trybu, po jednym przycisku na tryb (**Nonstop Debate**, **Testimony**, **Panic Round**, **Closing Argument**, **Straw Poll**, **Logic Dive**, **Scrum Debate**). Każdy przycisk trybu jest wyszarzony, gdy trwa inny tryb, i po najechaniu podaje powód.
- **Po lewej odczyt**: tryb, który ma głos, **Dziennik dowodów Class Trial** i **Findings**, a pod nimi *Brakujące Key Remnanty* i głosowanie. Gdy odczyt jest dłuższy niż okno, przewija się sam.
- **Po prawej schemat sprawy**, tak wysoki, jak pozwala okno.
- **Na dole, przypięte**: pasek GM-a (**Pomiń**, **-30 s**, **+30 s**, **Oddalenie**, **Zakończ ten tryb**, **Z powrotem do debaty**, **Przekieruj**), a pod nim stopka.

Na wąskim ekranie obie kolumny układają się jedna pod drugą, a konsola się przewija.

Rozprawa idzie w pięciu krokach i każdy z nich jest po kolei następnym krokiem konsoli.

1. **Zacznij Class Trial.** Przesuwa fazę i rozdaje akcje pory dnia (zbankowane Sprint i Burst zostają, a późniejsze debaty rozprawy niczego nie odnawiają), zeruje zapis rozprawy tego rozdziału, pobiera opłatę za nieznalezione Key Remnanty (sekcja 14.4), ogłasza rozprawę i mówi ci, ile jest śmierci, których nikt nie znalazł, nie ujawniając żadnej (sekcja 13.4). Obok przycisku podaje zasadę stołu: **umarli słuchają, ale nie mówią w rozprawie**, a moduł jej pilnuje: przy otwarciu rozprawy wypisuje każdego zmarłego ucznia - także śmierć, której nikt nie znalazł, nigdy Monocuba - i na czas rozprawy wyłącza mikrofon jego gracza własną blokadą Foundry, tą z listy na kafelku głosu (sekcja 9.5). Resztę opisuje *Otwarcie rozprawy* niżej.
2. **Otwórz debatę**, tyle razy, ile rozprawa potrzebuje: to debata na czas, w której gracz może przerwać przyciskiem **OBJECTION!** (*Debata i Objection*, niżej).
3. **Głosowanie.** **Głosowanie** w konsoli rozsyła karty do głosowania i liczy je (*Głosowanie*, niżej).
4. **Werdykt.** **Werdykt** zapisuje, czy klasa trafiła, kogo skazuje i kto dostaje Level Up (*Werdykt* i *Level Upy*, niżej).
5. **Koniec rozdziału** (sekcja 16) i **Zakończ Class Trial**, który wykonuje czekający wyrok (krok 4), zamyka głos i przywraca kampanię do Daily Life. Ekran końca rozdziału może to drugie zrobić za ciebie (*Koniec rozprawy*, niżej).

#### Otwarcie rozprawy

Z podpiętą salą rozpraw (sekcja 15.1) okno Zacznij Class Trial ją nazywa i wymienia, kto bierze udział, z jednym polem na postać, jak na zakładce Sceny, a otwarcie rozprawy przenosi tam każdą przeglądarkę. Bez podpiętej sali okno mówi, że stół zostaje tam, gdzie jest.

Gracz, który gra też żyjącego ucznia, zachowuje mikrofon. Konta GM-a moduł nigdy nie blokuje, a gracza zablokowanego przez ciebie moduł zostawia tak, jak go ustawisz. Lista zmarłych jest jawna celowo: mikrofon, który milknie, mówi stołowi, że ten uczeń nie żyje, także gdy jego ciała nikt nie znalazł, a nikt z listy nie dostaje karty do głosowania. Uczeń, który zginie w trakcie rozprawy, dołącza do listy, ten, który zostaje Monocubem, z niej wypada, a każda droga wyjścia z rozprawy zdejmuje blokady założone przez rozprawę i żadnych innych. Monocub mówi tylko wtedy, gdy nie trwa żaden tryb, a słucha w każdym trybie, od otwarcia głosowania i przez całą rozprawę w sprawie własnej śmierci. Skazani mówią do końca rozprawy. W rozprawie zmarli siedzą ze wszystkimi w pokoju głosowym rozprawy, a poza nią rozmawiają z Widzami i żywi ich nie słyszą (sekcja 9.5).

W trakcie Eclipse Zacznij Class Trial niczego nie otwiera i mówi o tym, a żadne inne drzwi nie otwierają rozprawy po ciemku: Edytuj kampanię zostawia fazę, stosuje resztę swojego okna i mówi o tym, a `game.drpg.setPhase` i `game.drpg.setClock` odmawiają całej zmiany. Przy wciąż otwartym incydencie Zacznij Class Trial najpierw pyta: zamknąć go teraz (**Zakończ morderstwo**), **Kontynuuj przy otwartym** albo Anuluj. Zakończ morderstwo zapisuje jego Blackened w rejestrze, z którego czytają głosowanie i werdykt. W rozdziale, który ma już werdykt, pyta jeszcze raz (**Otwórz nowy Class Trial**), zanim otworzy drugą rozprawę, z Anuluj jako pierwszym i domyślnym przyciskiem, bo drugi werdykt to kolejna egzekucja i kolejna runda Level Upów. Edytuj kampanię zadaje to samo pytanie, gdy przestawia fazę na Class Trial, i to o rozdział, do którego okno przechodzi, więc powrót do rozdziału, który ma już werdykt, najpierw pyta. Mówi też, co robi wejście w rozprawę: otwiera jej budżet i pobiera opłatę za nieznalezione Key Remnanty, a Anuluj zostawia wtedy fazę i stosuje resztę.

Class Trial otwiera się **dyskusją**: mówią wszyscy, a dowody trafiają na stół bez przejmowania głosu. Dopóki trwa rozprawa, otwarty zostaje tylko kafelek Analyze (z Przedstaw, Hope Calls i przedmiotami), nikt nie przechodzi między pokojami, a Despair Calls i Confusion Monocuba są zablokowane. Analyze albo Objection kosztuje akcję, potem 1 Hope, potem 1 Sanity.

#### Debata i Objection

Debatę otwierasz przyciskiem **Otwórz debatę**, z budżetem w sekundach (domyślnie **180**, co najmniej **30**, a krótszy trwa 30), zapamiętywanym w obrębie rozprawy, i z opcjonalnym *Pytaniem debaty*, które pokazują karta Class Trial w panelu zdarzeń, konsola oraz karty Objection i Przedstaw tej debaty. Pytanie mieści do 200 znaków. Przekroczenie czasu zmienia zegar debaty na karcie Class Trial w panelu zdarzeń na czerwony i niczego nie kończy: kiedy spór się skończył, decydujesz ty.

Od tej chwili gracz może przerwać przyciskiem **OBJECTION!** na swoim kafelku głosu (*OBJECTION! na kafelku głosu*, niżej). Objection trafia w tego, kogo pokój głosowy głównego GM-a słyszy teraz (liczy się mniej więcej sekunda mowy), a gdy nikt nie mówi, w ostatniego gracza, który mówił w tej rozprawie. Nigdy nie trafia w GM-a, Monocuba, ucznia, którego śmierć ogłoszono, we wnoszącego ani w innego ucznia jego gracza; uczeń, którego śmierć trzymasz w tajemnicy, dla stołu żyje i można wobec niego wnieść Objection. Gdy nie ma w kogo, Objection jest odrzucane i nic nie kosztuje. Gdy główny GM nie ma pokoju głosowego, po naciśnięciu cel wskazuje gracz: do wskazania nic nie jest płacone, a wskazanie podlega tym samym zasadom.

Cenę płaci się w chwili naciśnięcia, a potem gracz ma **30 sekund** na wybór Truth Bulletu; do tego czasu karta mówi, że Objection czeka, a konsola odlicza sekundy. Bez Truth Bulletu na czas Objection zostaje wycofane, jego karta to mówi, cena nie wraca, a głos wraca do debaty z czasem, który jej został. **Przekieruj** w konsoli wymierza trwające Objection w innego żyjącego ucznia. Karta Objection stoi nad każdym oknem, dopóki ktoś jej nie kliknie.

Gdy Truth Bullet jest na karcie, wnoszący sam ma głos przez **60 sekund**, potem osoba, w którą wymierzono Objection, odpowiada w rebuttalu przez **120 sekund** dla tej dwójki, po czym głos sam wraca do otwartej dyskusji, a następnym krokiem konsoli jest **Otwórz debatę ponownie**: to samo pytanie i budżet, bez okna (`game.drpg.reopenDebate()`). Po twoim własnym **Zamknij debatę** następnym krokiem jest nowe **Otwórz debatę**, bo Zamknij debatę wraca do dyskusji przy trwającej rozprawie.

Kto mówi w danym trybie, pilnuje stół: moduł wycisza tylko zmarłych (krok 1), na każdym ekranie jasno pokazuje stan rozprawy i nie daje przycisku Objection nikomu, komu nie przysługuje. Martwy uczeń nie może przedstawiać dowodów ani wnosić Objection.

#### Pasek GM-a

Dopóki trwa Class Trial, konsola ma jeden rząd przycisków w tej samej kolejności w każdym trybie, żeby żaden się nie przesuwał, gdy zmienia się głos: **Pomiń**, **-30 s**, **+30 s**, **Oddalenie**, **Zakończ ten tryb**, **Z powrotem do debaty** i **Przekieruj**. Przycisk, który teraz niczego by nie zmienił, jest wyszarzony i mówi dlaczego, po najechaniu i po naciśnięciu; poza Class Trial każdy odmawia. Naciskać je może każdy GM.

**Pomiń** kończy bieżącą turę: minuta Objection przechodzi w jego rebuttal, rebuttal zamyka głos, a debata nie ma tury do pominięcia. **-30 s** zabiera pół minuty z bieżącego zegara: gdy w Objection albo rebuttalu zostało mniej niż 30 sekund, działa jak Pomiń, a debatę zdejmuje najwyżej do zera i jej nie zamyka. **+30 s** dodaje pół minuty, liczone od teraz, gdy zegar już się skończył, i może przedłużyć tryb ponad jego zwykłą długość. **Zakończ ten tryb** zamyka debatę tak jak **Zamknij debatę**, a Objection albo rebuttal kończy tak, jak kończy się sam rebuttal. **Z powrotem do debaty** daje debacie czas, który jej został, gdy wcięło się Objection, a nie cały budżet.

Naciśnięcie, które dotrze, gdy głos już przesunął się dalej, niczego nie przesuwa i mówi ci o tym. Każdy krok jest jawny: pominięta tura i zakończony tryb wysyłają kartę, która to mówi, a zmiana czasu pokazuje *GM: +30 s* na karcie Class Trial w panelu zdarzeń przez dziesięć sekund.

**Oddalenie** cofa najnowsze Objection tej rozprawy i żadne inne. W trakcie jego wymiany, czyli sekund na wybór Truth Bulletu, jego minuty albo jego rebuttalu, głos wraca do tego, komu albo czemu przerwało, z czasem, jaki wtedy miał; Objection wniesione w rebuttal wymaga dwóch naciśnięć, po jednym na każde. Gdy jego wymiana już się skończyła, przebieg głosu się nie zmienia: Objection zostaje oznaczone, a konsola proponuje **Otwórz debatę ponownie** z czasem, który debacie został. Koszt nigdy nie wraca. Karta dostaje pieczątkę **Objection oddalone przez GM-a**, a OBJECTION! zamyka się na każdym ekranie. Starsze Objection, Objection wycofane albo odrzucone i Objection z rozprawy, która już się skończyła, są odrzucane, z powodem.

**Pełna kontrola, uczciwie.** Pasek daje ci pełną kontrolę nad głosem, a stół ufa, że używasz go tak samo wobec każdego. Mów na głos, co naciskasz i dlaczego. Pilnuj formy, nie treści: tura kończy się, bo skończył się jej czas albo stół ma kłopot, nigdy z powodu tego, o co toczy się spór. **Oddalenie** stosuj do Objection naciśniętego przypadkiem albo niezwiązanego z tym, co mówi mówca, nigdy do słabego argumentu, a koszt oddalonego Objection zostaje zapłacony. Mówcy nie chroni żadna reguła modułu, tylko ty, więc **Zakończ ten tryb** jest na kłopot techniczny albo przekroczony czas, nigdy po to, żeby ktoś nie zdążył skończyć.

#### Głosowanie

**Głosowanie** w konsoli otwiera jedno okno, a naciśnięte ponownie wysuwa je na wierzch zamiast rysować drugie. Przed naciśnięciem **Wyślij karty** okno wymienia, do kogo trafią karty, a przy wciąż otwartym incydencie Wyślij najpierw pyta, tak jak Zacznij. Pierwsza linia okna to następny krok rozprawy, tymi samymi słowami co pierwsza linia konsoli i linia **Dalej** w panelu GM-a. Okno zostaje otwarte, gdy głosowanie otwiera się albo zamyka, a jego stopka odświeża się w tym samym miejscu.

Kartę dostaje każdy połączony gracz żyjącego ucznia, jedną na osobę: gracz z dwoma uczniami dostaje jedną kartę, a uczeń, którego gra tylko GM, nie dostaje żadnej (zmarli nie głosują, `deadCastBallots: false`). Nie dostaje jej też Monocub ani uczeń z listy zmarłych rozprawy (krok 1), w tym śmierć, której nikt nie znalazł. Karta pozwala wskazać siebie, Monokumę albo zmarłych. Liczba wymaganych nazwisk to liczba Blackened zapisanych w tym rozdziale za śmierć znaną stołowi (sekcja 13.4).

Stan głosowania (otwarte czy zamknięte, jego runda, kto dostał kartę, wynik) jest w świecie, więc przeładowanie GM-a go zachowuje, a konsola każdego GM-a czyta to samo głosowanie. Każda karta jest sprawdzana, zanim zostanie zapisana: jedna na osobę, z otwartej rundy, żadne nazwisko dwa razy i nie więcej nazwisk, niż trzeba. Stół widzi tylko sumy i żaden gracz nie dostaje cudzej karty. Gracz, który połączy się w trakcie głosowania, dostaje kartę, gdy wczytuje się jego przeglądarka, i ta karta liczy się do rozesłanych, więc podnosi poprzeczkę. Okno i konsola mówią, ile kart wróciło, z ilu, i ile głosów potrzeba do skazania.

Konsola pokazuje, kto jeszcze nie głosował. **Wyślij kartę ponownie** wysyła tym osobom świeżą kartę, a **Zacznij głosowanie od nowa** wyrzuca oddane karty i najpierw ostrzega. Przycisk **Zamknij i policz** publikuje wynik w jednym zdaniu; może go nacisnąć każdy GM, stoi po lewej stronie stopki, przy tym, czego nie da się cofnąć, i nigdy nie jest domyślny: gdy głosowanie trwa, Enter naciska Anuluj. Skazanie wymaga **więcej niż połowy rozesłanych kart** (połowa zaokrąglona w dół plus jeden) dla każdego wskazanego nazwiska. Poniżej tego wynik mówi, że nie ma większości, a brak większości albo więcej nazwisk remisujących nad kreską, niż jest Blackened, liczy się jak błędny głos, chyba że stół to rozstrzygnie. Moduł niczego nie rozstrzyga za ciebie: **Zacznij głosowanie od nowa** uruchamia nową rundę, a okno *Werdykt* daje oba werdykty bez względu na wynik.

#### Werdykt

Okno mówi, kogo rejestr zapisał jako Blackened (bez zabójcy, którego ofiar nikt jeszcze nie znalazł, sekcja 13.4), kogo wskazało liczenie i na ilu kartach, pyta, kto zostaje stracony, jeśli klasa się pomyliła, i czy trafili. Lista straconych wymienia każdego ucznia, także Blackened z rejestru, i otwiera się na uczniu wskazanym przez liczenie, a na swojej pierwszej opcji, **Nikt nie zostaje stracony**, po remisie, bez większości, gdy nikogo nie wskazano, gdy wskazany już nie żyje (okno to mówi) albo gdy wskazany jest jednym z tych Blackened. Zmarli zostają na liście, oznaczeni, ale wybrać można tylko żyjącego ucznia. Uczeń, którego ciała nikt nie znalazł, nie jest tu oznaczony jako martwy, bo dla stołu żyje, a okno mówi tylko tobie, czyja to śmierć: stracenie go czyni tę śmierć egzekucją, a stół dowiaduje się o niej, gdy rozprawa się kończy.

Przyciski to Anuluj, **Trafili** i **Pomylili się**, w tej kolejności bez względu na wynik: domyślny jest Anuluj, więc Enter zamyka okno i nikt nie ginie.

| Werdykt | Kto zostaje skazany | Co dalej |
|---|---|---|
| **Trafili** | Blackened | każdy ocalały dostaje **Standard Level Up** (1 wybór) |
| **Pomylili się** | oskarżony | każdy ocalały Blackened zostaje anonimowy i w grze, dostaje **Reinforced Level Up** (3 wybory) i jedną nową zasadę własnego wyboru (ty ją wpisujesz, a ogłaszana jest bez nazwiska), a pula każdego Monokumy jest napełniana do 12 |

Oba werdykty opróżniają Overflow. Reinforced Level Up Blackened czeka na klasę, a jego właściciel dowiaduje się o tym prywatnie. Wybiera się go razem z Level Upami klasy przy następnym werdykcie, który trafnie wskaże Blackened, w jednym oknie z 1 + 3 wyborami, zapisanymi naraz, a sam, bez Level Upów klasy, przy werdykcie Final Trial. Czeka po to, żeby nikt nie zobaczył, jak maksima Blackened rosną w dniu błędnego głosowania. Przepada, jeśli Blackened wcześniej zginie, a reset sezonu, który czyści rozwój postaci, go usuwa.

Werdykt zostaje najpierw zapisany, a każdy gracz widzi potem jedną kartę, **WERDYKT**: kto jest skazany albo że nikt, i czy klasa trafiła, nigdy z nazwiskiem Blackened, którego klasa nie wskazała. To samo mówi panel zdarzeń. Jeden werdykt na rozprawę.

Werdykt nikogo nie zabija i niczego nie kończy: jego karta mówi *Wyrok zapadł wobec postaci imiona. Egzekucja odbędzie się po zakończeniu Class Trial.*, rozprawa trwa dalej, a wyrok jest wykonywany raz, gdy rozprawa kończy się którąkolwiek drogą (Zakończ Class Trial, koniec rozdziału, wybór fazy albo wywołanie z konsoli, które zmienia fazę), zanim stół zostanie zabrany z sali. Każdy skazany, który jeszcze żyje, ginie wtedy, w rozdziale tej rozprawy, zapisany jako egzekucja, każdy gracz widzi **EGZEKUCJA**, a gracz straconego ucznia dowiaduje się o tym także prywatnie. Werdykt wydany po Zakończ Class Trial jest wykonywany od razu (*Wyrok zapadł wobec postaci imiona. Egzekucja odbywa się od razu.*), a pytanie Zakończ Class Trial wymienia, kto zostanie stracony. Reset sezonu usuwa wyrok, który jeszcze czeka. Jeśli wyroku nie da się wykonać, moduł ci to zgłasza: oznacz wtedy tę śmierć ręcznie w oknie Uczniowie.

Jeśli któryś krok się nie uda albo GM wydający werdykt wyjdzie, konsola mówi, gdzie werdykt się zatrzymał, a **Dokończ werdykt** robi resztę, nie powtarzając tego, co już zrobione. Wykonuje się w przeglądarce GM-a, który wydał werdykt, dopóki jest połączony, a inaczej w przeglądarce głównego GM-a - w przeglądarce innego GM-a konsola mówi, kogo poprosić, a Enter niczego tam nie naciska - i żadnemu ocalałemu nie daje drugiego Level Upa ani nie wysyła drugiej karty.

#### Level Upy

Level Upy ocalałych przychodzą w jednym oknie na twoim kliencie, **Level Upy klasy**: wiersz na ucznia z liczbą wyborów, każdy z **Wybiera gracz** albo **Wybieram ja** (wybór gracza jest zaznaczony, gdy jego gracz jest połączony). **Przyznaj** - pierwszy przycisk i domyślny, więc Enter robi to samo - wykonuje wiersze, a **Wszyscy: wybierają gracze** oddaje każdy Level Up jego graczowi; zamknięcie okna robi to samo, tyle że uczeń, którego nikt nie gra, nie dostaje wtedy nic.

Gracz dowiaduje się o tym i wybiera na własnym arkuszu, gdzie przycisk Level Up świeci się na złoto. Twoje Level Upy otwierają się tu jeden po drugim, a każdy mówi, dla kogo jest. Level Up daje trzy opcje: +1 do statystyki, +1 do doświadczenia albo nowe doświadczenie na +2. Punkt w **Head** podnosi też maksimum Sanity o 1, a punkt w **Body** albo **Leg** maksimum Health o 1, w tym samym zapisie. Ucznia, którego nikt nie gra, wybierasz ty; Level Upa, którego dla niego nie wybierzesz, nikt nie dostaje, a ty dowiadujesz się o tym: przyznaj go wtedy przyciskiem Level Up na arkuszu ucznia.

Level Up można też przyznać z arkusza postaci, gdzie decydujesz, co zostało zdobyte (Standard albo Reinforced) i czy wybierasz ty, czy gracz. Oferty się sumują, więc postać może mieć więcej niż jedną; na arkuszu twój przycisk Level Up pokazuje, ile ich czeka, a jego menu cofa jedną (**Cofnij ofertę**), co gasi przycisk gracza. Cofnięcie jest odmawiane, a ty się o tym dowiadujesz, dopóki Level Up tej postaci jest zapisywany. Wybór statystyki albo doświadczenia, którego postać nie ma, jest odrzucany, gracz się o tym dowiaduje, a oferta zostaje. Oferty przetrwają zmianę głównego GM-a, a reset sezonu, który czyści rozwój postaci, je wycofuje.

**Level Upy wzięte według starszej zasady.** Świat, który je ma, dostaje jednorazową poprawkę, gdy wczyta go główny GM. Okno wymienia, co poprawić, a ty zaznaczasz każdą zmianę, którą chcesz wprowadzić (sekcja 22.15).

#### Koniec rozprawy

Z podpiętą salą rozpraw Zakończ Class Trial pyta o pokój z jednej listy wszystkich pokoi każdej sceny z pokojami, najpierw szkolnych, a jedynym innym przyciskiem jest Anuluj, więc rozprawa nie kończy się bez pokoju. Stół przechodzi na scenę tego pokoju, tokeny utworzone przez moduł w sali zostają usunięte, twoje ukryte, a żyjący uczniowie, którzy brali udział, trafiają w losowe miejsca w pokoju, tak samo jak wszyscy zbierają się przy odkryciu ciała. Monocub idzie z nimi, a zmarli i Monokuma zostają. Przenoszona, przeprowadzana i wymieniana jest tylko obsada: uczeń niezaznaczony w obsadzie (sekcja 15.1), zostaje tam, gdzie stoi, i nic niżej go nie wymienia.

Żyjący uczeń, którego token stoi na innej scenie z pokojami, też przychodzi: moduł kopiuje ten token do pokoju i usuwa stary (sekcja 22.15). Uczniowi z tokenami na dwóch takich scenach przenosi ten, który moduł czyta jako miejsce, gdzie uczeń stoi, a ty dowiadujesz się, że drugi zostaje. Żyjący uczeń, którego nie da się przenieść, zostaje tam, gdzie stał, a ty dowiadujesz się, kto to: to uczeń stojący tylko na scenie bez pokoi, uczeń gracza stojący tylko w sali albo taki, którego tokenu nie dało się skopiować lub usunąć.

Dowiadujesz się też o każdym żyjącym uczniu, który kończy z tokenem w pokoju i drugim na scenie innej niż sala, oraz o uczniu, którego starego tokenu nie dało się usunąć, a kopii nie dało się też cofnąć: taki uczeń stoi podwójnie, więc usuń token, którego nie chcesz. Powrót przerwany między kopią a usunięciem moduł zgłasza GM-om, gdy następny GM wczyta świat (sekcja 22.15). Żadna inna droga wyjścia z rozprawy nikogo nie przenosi.

#### Tryby rozprawy

Obok debaty trzy przyciski wyboru trybu otwierają tryby na głosie debaty: **Testimony**, **Panic Round** i **Closing Argument**. Każdy z nich otwiera się, gdy trwa Class Trial, a nie trwa żadne Objection ani runda; pozostałe trzy to tryby stref z sekcji 15.2. Te trzy działają na głosie debaty, pod tym samym paskiem i z tym samym zegarem na każdym ekranie. Każdy tryb mówi, kto może mówić, przedstawiać i wnosić Objection, a tabela niżej obejmuje też tryby stref z sekcji 15.2.

| Tryb | Kto mówi | Jak długo | Przedstaw | OBJECTION! |
|---|---|---|---|---|
| Otwarta dyskusja (bez trybu) | wszyscy | - | wszyscy | nikt: nie ma głosu do przejęcia |
| Nonstop Debate | wszyscy | twój budżet | wszyscy | każdy, w tego, kto mówi |
| Objection, potem rebuttal | wnoszący; potem tych dwoje | 60 s, potem 120 s | wszyscy | nie w minucie Objection; w rebuttalu w jedno z tych dwojga |
| Testimony | po jednym uczestniku, po kolei | proponowane 60 s na turę, od 30 do 120 s | mówca | w mówcę |
| Panic Round | po jednym uczestniku, po kolei | 15 s na turę (od 12 uczestników proponowane 10 s), od 10 do 15 s | mówca | nikt |
| Closing Argument | mówca, którego zatwierdzisz, wybierzesz albo któremu dasz mówić dalej | 300 s | mówca | w mówcę, każdy poza nim |
| Straw Poll | wszyscy | 45 s | wszyscy | nikt |
| Logic Dive | wszyscy | 60 s na pytanie | wszyscy | nikt |
| Scrum Debate | mówcy obozów, na zmianę | 45 s, 120 s, potem tury od 20 do 40 s | mówca | nikt |

Testimony i Panic Round to rundy. Ich okno proponuje sekundy na turę z tabeli wyżej, dla Testimony 60 s przy stole każdej wielkości, wpisywane od nowa przy każdym starcie. Okno losuje kolejność (**Wylosuj nową kolejność** i **W górę** zmieniają ją przed **Zacznij**, nigdy potem) i w trakcie wpisywania pokazuje długość całej rundy. Przy starcie kolejność zostaje ustalona spośród uczestników rozprawy i już się nie zmienia: zmarły uczeń nie dostaje tury, tak samo jak śmierć, której nikt nie znalazł.

Mówca widzi *Twoja tura (n s)* z **Gotowe** i **Pasuję** i tylko on słyszy dźwięk swojej tury; każdy ekran podaje, kto mówi, a panel zdarzeń, kto następny. Pas jest ogłaszany (*name pasuje.*), mówca, którego gracz nie jest połączony, pasuje od razu, a runda kończy się zdaniem *Tryb Testimony dobiegł końca.* (albo Panic Round). Runda idzie dalej, nawet gdy twoja zakładka przeglądarki jest w tle. W Testimony Objection trafia tylko w mówcę i ma wymianę debaty (60 + 120 s, z wtrąceniami); po niej runda idzie dalej od następnego mówcy, a przerwany mówca nie odzyskuje reszty tury, chyba że w tej wymianie naciśniesz **Oddalenie**, które oddaje mu resztę jego tury. Panic Round nie ma Objection, a -/+ jej paska to 5 s. **Pomiń** przechodzi do następnego mówcy, **Zakończ ten tryb** (*Zakończ rundę*) kończy rundę, a **Z powrotem do debaty** w rundzie odmawia. +30 s może przeciągnąć turę ponad najdłuższą, bo ta granica obowiązuje tylko przy starcie.

Closing Argument jest raz na rozprawę; druga rozprawa rozdziału i Final Trial mają własny, a potem jego przycisk jest wyszarzony: *Ta rozprawa miała już swój Closing Argument.* Przez **30 sekund** każdy uczestnik jest pytany, czy podsumuje sprawę (**Podsumuję** albo **Ktoś inny**); gracze widzą tylko, ilu się zgłosiło, a ty widzisz nazwiska. Gdy minie 30 s albo naciśniesz Pomiń, losuje się jeden zgłoszony: *Wylosowano: name. Zgłoszeni: names.*, z **Zatwierdź mówcę** i **Wybierz kogoś innego** (najpierw zgłoszeni, potem reszta uczestników, a kto już mówił, ma dopisek *Już po wypowiedzi w Closing Argument*). Gracze czytają *GM zatwierdza mówcę.*, a karta mówi tylko, kto wygłasza Closing Argument, nigdy tego, że wynik losowania został zmieniony. Gdy nikt się nie zgłosi, konsola mówi: *Nikt się nie zgłosił. GM wybiera mówcę albo przechodzi do głosowania.*

Mówca ma **300 sekund**. Każdy inny uczestnik może wnieść wobec niego Objection w dowolnej sekundzie, a mówcy nie chroni nikt poza tobą. Objection ma wymianę debaty, podczas której zegar mówcy stoi; potem decydujesz, *Kto kontynuuje Closing Argument?*: mówca, z sekundami, które miał w chwili Objection, albo ktoś, kto wniósł Objection w tej wymianie, z nowymi 300 s (*name kontynuuje Closing Argument (time).*). Wobec tego, kto mówi dalej, znów można wnieść Objection.

**Pasuję** wylosowanego albo wybranego mówcy w jego pierwszych 30 sekundach oddaje ci wybór; później Pasuję, **Gotowe** i koniec czasu kończą Closing Argument (*Closing Argument dobiegł końca.*, a następnym krokiem jest głosowanie). **Pomiń** oddaje ci wybór, **Zakończ ten tryb** kończy Closing Argument, w wymianie bez decyzji, a kończy go też otwarcie głosowania. **Wznów Closing Argument** daje ostatniemu mówcy resztę jego czasu, a **Oddalenie** w jego wymianie oddaje mówcy czas, który miał w chwili Objection. Za ostatnie słowo nikt nie dostaje Hope.

**Przedstaw, tryb po trybie.** Przedstaw jest darmowe w każdym trybie; kto może je nacisnąć, mówi kolumna tabeli wyżej, a gdy w trybie z mówcą głos ma ktoś inny, przycisk w wierszu jest wyszarzony: *Teraz dowody może przedstawiać tylko name.* Okno Przedstaw daje **Pokaż z wynikiem mojego Analyze**, gdy taki wynik jest; bez niego karta i każda kopia pokazują Truth Bullet jako nigdy nieanalizowany, bez odczytu i bez typu, jaki się okazał. Każdy uczestnik poza przedstawiającym dostaje na arkusz kopię tak, jak ją pokazano, za darmo i raz na Truth Bullet (*who przedstawia dowód name. Kopia, taka jak na karcie czatu, jest już na twoim arkuszu.*). Bez połączonego GM-a Przedstaw jest odrzucane. Wybór Truth Bulletu do Objection daje ten sam wybór z wynikiem albo bez i nie robi kopii. W trakcie Class Trial wiersz Truth Bulletu nie ma przycisku Podziel się kopią; wraca on po rozprawie.

**OBJECTION! na kafelku głosu.** Przycisk jest na kafelku głosu każdego gracza, obok mikrofonu; poza Class Trial jest wyszarzony: *Objection możesz wnieść tylko podczas Class Trial.* Wiersz rozprawy na HUD ma go tylko tam, gdzie nie ma kafelka głosu (bez LiveKit albo z wyłączonym kafelkiem). Tabliczka kafelka mówi *ma głos* przy uczniu, który go trzyma.

**Ujawnienie Monokumy**: sekcja konsoli *Brakujące Key Remnanty* wymienia Key Remnanty tego rozdziału, których nie ma żaden żywy uczeń: zaplanowane miejsce, którego Remnantu nikt nie znalazł, miejsce opisane, ale nigdy niepostawione (albo takie, którego Remnant wymazano), i Remnant postawiony poza planem. Lista stoi pod linią *Do ujawnienia: n*, która liczy Key Remnanty, za które otwarcie rozprawy pobrało opłatę, minus już ujawnione; tę liczbę zapisano przy pobraniu opłaty. **Ujawnij** najpierw pyta, co przeczytają gracze (miejsce bez Remnantu prosi, żebyś to wpisał), a ponad tę liczbę pyta: *Za ten Key Remnant nie pobrano Despair. Ujawnić mimo to?* Domyślny jest Anuluj, więc Enter niczego nie ujawnia.

Ujawnienie daje każdemu uczestnikowi kopię tak jak znalezisko, ale nie Monocubowi ani zmarłym: typ Key, tekst dla graczy, bez analizy, a Analyze w rozprawie odczytuje ją za zwykłą cenę. Pokazuje im jej Remnant i mówi każdemu *Monokuma ujawnia Key Remnant, którego nie udało ci się znaleźć.* z dźwiękiem. Ujawnienie nic nie kosztuje, a każdy Key Remnant ujawnia się raz.

Podczas Final Trial działa ta sama debata i to samo głosowanie; tylko werdykt należy do Masterminda (sekcja 8): przycisk werdyktu w konsoli otwiera **Werdykt Final Trial**, a ten werdykt zamyka zapis rozprawy i zdejmuje flagę Final Trial. Żadna droga nie daje Final Trial zwykłego werdyktu. Jego lista wymienia każdego ucznia, także Blackened, po opcji **Nikogo nie wskazano**, i otwiera się na uczniu wskazanym przez liczenie, żywym czy martwym; wybrać można każdego z nich, a zmarli są oznaczeni. Tak jak zwykły werdykt, zapada raz na rozprawę: drugi werdykt Final Trial zostaje odrzucony, także wtedy, gdy pierwszy jest jeszcze wydawany. Jego egzekucja wysyła tę samą kartę **EGZEKUCJA**, z imieniem straconego ucznia. Jeśli któryś z jego kroków się nie uda (karta, flaga, egzekucja, Level Upy, które czekały, wybór Masterminda) albo jego GM wyjdzie, konsola mówi, gdzie się zatrzymał, a **Dokończ werdykt** wykonuje pozostałe kroki i przyznaje to, co czekało, raz.

**Schemat sprawy na rozprawie.** Prawa część konsoli pokazuje schemat rozdziału z Mapy, tylko do odczytu. Przesuwasz go, ciągnąc środkowym przyciskiem myszy albo ciągnąc puste miejsce, kółkiem przybliżasz, a pod schematem są - + i Dopasuj do widoku. Przed rozprawą to sam schemat. W trakcie rozprawy każdy wniosek, kontra i rozwiązanie ma przycisk zaznaczenia: naciśnij go, gdy klasa tam dojdzie. Odkryte jest tylko to, co zaznaczone, a zaznaczać może każdy GM. Zaznaczenia dotyczą tylko bieżącej rozprawy, więc druga rozprawa w rozdziale zaczyna bez nich. Węzeł z trybem rozprawy (Nonstop Debate, Testimony, Panic Round, Closing Argument) ma też przycisk startu tego trybu, wyszarzony, gdy trwa inny tryb. Przedstawione Remnanty są oznaczone. Wniosek dostaje znak podpowiedzi, gdy uczniowie inni niż sprawca przedstawili ponad połowę tego, na czym stoi; podpowiedź to nie zaznaczenie. Przedstawiony Truth Bullet bez Remnantu za sobą nie daje podpowiedzi, a linia nad schematem podaje, ile było takich Truth Bulletów.

**Pokaż podsumowanie.** Po werdykcie ten przycisk pokazuje, co dostaną gracze: Remnanty ze schematu, które ktoś znalazł, zaznaczone wnioski i kontry, a rozwiązanie tylko wtedy, gdy klasa zagłosowała dobrze. Nic więcej nie wychodzi. **Wyślij wszystkim** publikuje podsumowanie raz na rozprawę, a **Zamknij** nic nie wysyła. Po werdykcie Pokaż podsumowanie jest następnym krokiem konsoli, dopóki podsumowanie nie wyjdzie; potem przycisk brzmi **Podsumowanie wysłane**. Przed werdyktem i w Final Trial przycisk jest wyszarzony.

### 15.1 Sala rozpraw

Rozprawa może się odbywać na osobnej scenie, ustawianej raz na sezon w części **Sceny** Ustawień sezonu; otwiera ją wiersz Listy kontrolnej sezonu *Szkoła i sala rozpraw są podpięte*.

- **Zbuduj salę** jako zwykłą scenę. Twój token jest w niej potrzebny tylko dla Monokumy, którego tokenu moduł nigdy nie tworzy, i dla każdego, kogo chcesz mieć we własnym miejscu; resztę tokenów tworzy moduł. Każdy token, który stawiasz, połącz z jego postacią: nakładkę zmarłego i kontrolę gracza moduł czyta z postaci, a ta część wymienia token niepołączony. Sala nie ma pokoi: region oznaczony tam jako pokój nie jest czytany jako pokój, a ta część o nim ostrzega. Ruch w sali nie wywołuje mgły, odkrycia ani limitu ruchu i nie zostawia Remnantu.
- **Podepnij ją raz**: w polu **Szkoła** wybierz scenę, na której toczy się sezon, a w polu **Sala rozpraw** salę. Muszą to być dwie sceny i **Zapisz** czeka, aż będą. Póki trwa Class Trial, sali rozpraw nie da się podpiąć, zmienić ani odpiąć: najpierw zakończ rozprawę, a do tego czasu **Zapisz** czeka.
- **Obsada sali**: włącz, kto bierze udział (**Bierze udział**, przełącznik na postać), tutaj albo w oknie Zacznij Class Trial. **Token w sali** oznacza postać, której token stawiasz tam ręcznie; taki token jest pokazywany lub ukrywany, nigdy nie usuwany. Dopóki nie zmienisz przełącznika, udział biorą Monokuma i każdy uczeń, którego gra gracz, także zmarli i Monocuby (zmarli pod nakładką zmarłego i nieruchomi), a uczeń, którego nikt nie gra (postać testowa), nie bierze. Drugi token tej samej postaci, który postawisz, zostaje ukryty, a ta część go wymienia. Wybór obowiązuje tylko w tym sezonie.
- **Sala na kafelku pokoju**: podczas Class Trial kafelek pokoju każdego gracza pokazuje salę rozpraw z tym, co wpiszesz tu w polach **Nazwa**, **Zdjęcie** i **Opis**, a bez nazwy pokazuje *Class Trial*. Widzą to wszyscy, więc nie wpisuj w nazwie, zdjęciu ani opisie sali niczego tajnego. Zdjęcie podlega zasadom zdjęcia pokoju (sekcja 9.1): innej ścieżki moduł nie zapisuje, a ty dostajesz o tym wiadomość.
- **Przygotuj salę**: gdy to pole jest zaznaczone, **Zapisz** wyłącza mgłę eksploracji Foundry i widzenie tokenów, a włącza światło globalne, żeby każdy widział całą salę. Dwa kolejne pola czyszczą playlistę sali i, przy włączonym Proximity Voice Chat, wyłączają go w sali. Przygotowanie jest wyłączone, dopóki go nie zaznaczysz; póki podpięta sala ma włączone widzenie tokenów, wyłączone światło globalne albo włączoną mgłę eksploracji, ta część to mówi, a wejście w rozprawę szepcze to GM-om.
- **Tokeny modułu trwają jedną rozprawę.** Gdy rozprawa się otwiera, każda zaznaczona postać bez twojego tokenu w sali dostaje token połączony z postacią, z wyglądem jej tokenu w szkole (obrazek, rozmiar, obrót i przezroczystość), a gdy w szkole takiego tokenu nie ma, z wyglądem jej tokenu prototypowego, zawsze ustawiony tak, by nie obracał się przy ruchu. Staje tam, gdzie ostatnio stał w sali, a jeśli takiego miejsca nie ma, na okręgu wokół środka sceny. Gdy rozprawa się kończy, te tokeny zostają usunięte, ich miejsca zapamiętane w sali, a twoje ukryte. Twoje są pokazywane i ukrywane, nigdy przesuwane ani usuwane, a twój token zastępuje utworzony. Zostaw na mapie sali miejsce na dwie strefy z sekcji 15.2, każdą dość dużą na token każdego żyjącego ucznia; strefa to region nieoznaczony jako pokój.

**Każda droga do Class Trial przenosi stół do sali**: Zacznij Class Trial, Edytuj kampanię, wybór fazy w panelu GM-a i wywołania konsoli, które ustawiają fazę. Sala zostaje aktywowana, więc Foundry przenosi tam każdą połączoną przeglądarkę, także GM-ów, a tokeny zaznaczonych postaci zostają utworzone albo pokazane. Każda droga wyjścia (Zakończ Class Trial, koniec rozdziału, ten sam wybór fazy i te same wywołania, reset sezonu) usuwa tokeny modułu, ukrywa twoje i zabiera stół z powrotem: Zakończ Class Trial do pokoju wybranego w tym oknie (sekcja 15, krok 5), a każda inna droga do szkoły albo, gdy szkoła nie jest podpięta, na scenę, która była aktywna przy otwarciu rozprawy; bez żadnej z nich stół zostaje w sali, a ty dostajesz o tym wiadomość. Przed tym wszystkim każda droga oprócz resetu sezonu wykonuje wyrok, który zostawił werdykt (sekcja 15, krok 4), więc straceni giną w sali, a zbierani są tylko żyjący. Bez podpiętej sali rozprawa otwiera się tam, gdzie jest stół.

Zaznaczonego Monokumę bez tokenu w sali albo postać, której tokenu moduł nie zdołał utworzyć, moduł zgłasza GM-om przy otwarciu rozprawy. Gracz, który wciąż się ładował, gdy sala została aktywowana, trafia tam, gdy pierwszy raz narysuje mu się mapa, a ten, który ładował się, gdy stół opuszczał salę, przechodzi na scenę, do której poszedł stół. Jeśli gracz ukryje albo odkryje token z obsady sali, moduł cofa to do stanu, w jakim ostatnio zostawił go GM, a GM-owie dostają jedną wiadomość na każdą cofniętą zmianę. Token ucznia, który gracz utworzy w sali, zostaje ukryty, a GM-owie dostają o tym wiadomość. Token, który gracz tam usunie, moduł tworzy ponownie przy następnym otwarciu, dopóki jego postać jest zaznaczona (usunięty token Monokumy nie wraca), a GM-owie dostają o tym wiadomość.

W trwającej rozprawie konsola mówi, na której scenie jest stół, i daje jedno przejście, które nie zmienia fazy: **Pokaż salę rozpraw**, gdy stół jest gdzie indziej, i **Wróć do szkoły**, gdy jest w sali. Tokeny modułu są usuwane przy wyjściu i tworzone ponownie, w ich miejscach, przy powrocie, a twoje ukrywane i pokazywane.

### 15.2 Strefy sali: Straw Poll, Logic Dive i Scrum Debate

**Strefa A i Strefa B.** Część Sceny w Ustawieniach sezonu wybiera dwa regiony sali rozpraw na strefy, **Strefa A** i **Strefa B** (regiony nieoznaczone jako pokoje). Część Sceny, raport scen i dalsze sprawdzenia Listy kontrolnej sezonu ostrzegają, gdy sala nie ma stref, gdy wybrano tylko jedną albo jej region zniknął, gdy obie wskazują ten sam region, gdy strefy nachodzą na siebie i gdy nie pokrywają części sali; o sali bez siatki, której nie da się sprawdzić na czas, też mówią. Strefy liczą się tylko w trzech trybach stref. Poza nimi sala nadal nie jest niczyim miejscem, a ruch tokenu między strefami nigdy nie jest przejściem: nie jest odmawiany ani płatny, nie zmienia mgły i nie zostawia Remnantu.

**Kto gdzie stoi.** Każdy uczestnik (jeden uczeń na połączonego gracza, bez Monocuba, bez zmarłych) jest po tej stronie, której strefa zawiera środek jego tokenu w sali. Token na linii, którą obejmują obie strefy, albo poza obiema nie jest po żadnej stronie. Uczestnik bez tokenu w sali dostaje okno wyboru strony. Stanowisko tokenu to miejsce, w którym stał, gdy tryb stref się zaczął; tokeny zaczynają na swoich stanowiskach, a **gracz, który się nie ruszy, odpowiada strefą, w której leży jego stanowisko**, więc powiedz to przed liczeniem. Gdy tryb stref się kończy, każdy token wraca na stanowisko.

**Start trybu.** **Straw Poll**, **Logic Dive** albo **Scrum Debate** w wyborze trybu konsoli otwiera okno **Strefy sali** na tym trybie. Tryby stref można zacząć, gdy trwa Class Trial, a nie trwa inny tryb, a bez stref są wyszarzone. Pytanie mieści do 200 znaków, każda odpowiedź do 80, a teza Scrum Debate do 120. Środek konsoli pokazuje pytanie, odpowiedź każdej strefy i kto w niej stoi. Pasek dodaje **Policz teraz** do Pomiń, -30 s, +30 s i Zakończ ten tryb, a w Logic Dive także **Pomiń pytanie**; o każdym naciśnięciu stół się dowiaduje. Tryby stref grają muzykę debaty i nie ma w nich Objection.

**Straw Poll.** Pytanie i dwie odpowiedzi, 45 s, żeby każdy stanął w strefie, potem jedno liczenie (zegar albo **Policz teraz**). Dwie trzecie policzonych po jednej stronie to **Finding**, a karta mówi *Klasa uważa: odpowiedź. (Strefa A n, Strefa B n)*. Mniej to *Klasa jest podzielona: Strefa A n, Strefa B n. Scrum Debate może to rozstrzygnąć.*, a Scrum Debate staje się następnym krokiem konsoli. Moduł nigdy sam nie zaczyna Scrum Debate.

**Logic Dive.** Zestaw od 1 do 5 pytań, które piszesz wcześniej w oknie **Zestawy Logic Dive...**; to okno widzą tylko GM-owie, a gracze widzą każde pytanie i jego dwie odpowiedzi, nigdy to, która jest dobra. Imię ucznia w pytaniu daje ostrzeżenie, bo żadne pytanie w strefach nie powinno pytać, kto to zrobił. Każde pytanie trwa 60 s i kończy się wcześniej, gdy wszyscy stoją po jednej stronie (po 10 s) albo po **Policz teraz**; wynik widać przez 5 s, a potem rozstrzyga zwykła większość. Dobra odpowiedź prowadzi do następnego pytania, a ostatnia dobra daje Finding zestawu. **Zła odpowiedź albo remis, także 0:0, kończy zestaw i niczego nie ujawnia.** **Pomiń pytanie** idzie dalej bez zapisanej odpowiedzi; **Zakończ ten tryb** zapamiętuje pytanie, na którym stanął, i następnym razem zestaw zaczyna się tam. Każdy zestaw można zagrać ponownie, a okno ostrzega, gdzie i jak się skończył.

**Scrum Debate.** Pytanie i dwie odpowiedzi, opcjonalna teza, a potem trzy fazy:

- **Strony**: 45 s na ustawienie obozów. **Strony wybrane** (Pomiń na pasku) kończy tę fazę wcześniej, +30 s ją wydłuża, a uczeń, który na końcu Stron nie stoi w żadnej strefie, nie bierze udziału w Scrum.
- **Narada obozów**: 120 s, w których każdy obóz rozmawia we własnym pokoju głosowym, więc członkowie Strefy A słyszą tylko Strefę A, a członkowie Strefy B tylko Strefę B; ty, zmarli i każdy spoza obozów zostajecie w pokoju rozprawy. **Zakończ naradę** kończy ją wcześniej, a +30 s ją wydłuża. Bez LiveKit AVClient albo z wyłączonym **Głos osobno w każdym pokoju** faza działa tylko jako zegar, a ty dostajesz jeden szept, że głosy nie są rozdzielone.
- **Debata**: wszyscy wracają do pokoju rozprawy, a obozy mówią na zmianę, mniejszy pierwszy, mówcy każdego obozu po kolei. Tur jest dwa razy tyle, ile osób ma większy obóz na końcu Narady, a każda trwa 300 s podzielone przez liczbę tur, między 20 a 40 s (obozy 3 i 2 dostają 6 tur po 40 s, obozy 4 i 3 dostają 8 tur po 37,5 s). Każdy może w każdej chwili przejść na drugą stronę, a następny mówca obozu jest brany z obozu takiego, jaki jest wtedy. Mówca może dodać krótką tezę.

Obóz pusty na końcu Stron albo Narady, albo w trakcie tur, kończy Scrum, a odpowiedź drugiego obozu staje się Finding. Po ostatniej turze obozy się o tym dowiadują, a decyzja należy do ciebie. Zakończ ten tryb albo koniec rozprawy w każdej fazie przywraca wszystkie głosy do pokoju rozprawy.

**Findings (n)** w konsoli wylicza Findings. Możesz dodać Finding, edytować go lub usunąć (Finding mieści do 240 znaków) i oznaczyć **Monokuma potwierdza**; każde naciśnięcie to publiczna karta. Lista jest na karcie otwarcia głosowania.

### 15.3 Wejście do rozprawy i cut-in werdyktu

Każdy ekran przy stole odtwarza krótkie sekwencje na cały ekran:

- **Wejście.** Gra, gdy faza zmienia się na Class Trial: przez Zacznij Class Trial, debatę otwartą poza rozprawą albo wywołanie konsoli, które ustawia fazę (sekcja 15.1). Ekran zamyka się na około sekundę i stoi na nim tytuł: **CLASS TRIAL** z linią rozdziału. W Stained Glass kurtynę zamykają nowe szybki tego samego rodzaju: każda wysuwa się w swoim rozmiarze zza krawędzi szkła obok, najpierw zewnętrzne, a zamknięta kurtyna to jedno cięcie kurtyny; otwiera się tak samo na cięcie rozprawy. W Monokuma Legacy zamykają się i otwierają dwie czarne klapy z czerwoną krawędzią. Razem 3,4 sekundy.
- **Wyjście.** Gra, gdy Zakończ Class Trial (albo ekran końca rozdziału) zabiera stół z powrotem do Daily Life: ekran zamyka się w kolorze pory dnia, stoi na nim **KONIEC ROZPRAWY** z *Rozdział N · Powrót do szkoły* i otwiera się na szkołę. Trwa 3,4 sekundy, a jedyny dźwięk to dźwięk karty Zakończ Class Trial. Jeśli to samo Zakończ otwiera też następny poranek, plansze dnia przychodzą po wyjściu.
- **Edytuj kampanię nie odtwarza żadnej.** Zmiana fazy na Class Trial albo z niego w Edytuj kampanię lub w Ustawieniach sezonu tylko zmienia kolor kurtyny i zegara.
- **Cut-in werdyktu.** Odtwarza go twoja karta werdyktu (sekcja 15, krok 4): portret i imię skazanego, głosy tak, jak je policzono, pieczątka (**WINNY**, gdy klasa trafiła, **NIEWINNY**, gdy nie trafiła) i zdanie wyroku z karty; gdy nikt nie jest skazany, nie ma portretu ani pieczątki. Trwa 3,7 sekundy.

Esc pomija sekwencję, która gra, tylko na tym ekranie. Przy ograniczonym ruchu stoi zamiast niej nieruchoma klatka: zamknięta kurtyna z tytułem przez 1,5 s, a przy werdykcie jego ostatnia klatka przez 3 s. Ustawienia gry (kafelek **Ustawienia gry** w panelu GM-a) mają **Sekwencje na cały ekran**, domyślnie włączone; gdy je wyłączysz, nic nie gra na żadnym ekranie, kurtyna tylko zmienia kolor, a dźwięki grają dalej (sekcja 17).

Ekran, który wczyta się w ciągu 10 minut od zdarzenia (gracz, który dołącza późno, albo przeładowana przeglądarka), raz odtwarza najnowszą sekwencję, która go ominęła: wejście, cut-in werdyktu albo planszę początku dnia, z przełącznikiem, Esc i ograniczonym ruchem jak wyżej. Po 10 minutach nic nie odtwarza i pokazuje stół takim, jaki jest. Planszy końca dnia nie odtwarza się później.

---
## 16. Koniec rozdziału i reset sezonu

### 16.1 Zakończ rozdział

**Zakończ rozdział** to jeden ekran z polami wyboru, a przy każdym polu okno najpierw liczy, czego ono dotyczy. Znajdziesz go na dole **Edytuj kampanię** (w osobnym oknie albo na górze Ustawień sezonu), w linii Dalej i na konsoli Class Trial, na konsoli dopiero po zastosowaniu werdyktu.

- **Ujawnij prawdziwe typy i odczyty Truth Bulletów**: każdy Truth Bullet pokazuje, czym naprawdę jest, razem z odczytem, tak jak zrobiłby to Analyze. Pole liczy, co ujawni, a gdy nie ma czego ujawnić, jest odznaczone i wyszarzone. Faint zostaje nieodczytany, a każdy Final, Faint czy nie, pokazuje swój rodzaj bez odczytu; oba można przeanalizować w następnym rozdziale. Nieprzeanalizowanego Truth Bulletu bez zapisanego prawdziwego typu nie da się ujawnić, a ostrzeżenie w oknie mówi, kto go trzyma: zabierz mu go i daj taki z jego typem w Daj / zabierz przedmioty.
- **Zbierz Truth Bullets** zabiera uczniom ich Truth Bullets; Faint i Final zostają.
- **Wyczyść Faint Remnanty** zdejmuje je z map, a Reinforced Remnanty i wszystko, co powiązano ze zbrodnią, zostają. W rozdziale z morderstwem śmierć ofiary powiązała ze zbrodnią każdy Remnant rozdziału, o którym nikt nie zdecydował, więc to pole zostawia też szum Daily Life tego rozdziału, dopóki nie ustawisz mu **Powiązany ze zbrodnią** na **Nie** w Investigation.
- **Zdejmij z mapy Key Remnanty tego rozdziału** usuwa Key Remnanty postawione w tym rozdziale.
- **Zamknij Class Trial i przywróć wszystkich do Daily Life** zamyka rozprawę i przywraca wszystkich do Daily Life, gdy Class Trial wciąż trwa.
- **Przejdź do rozdziału** N, **Licz to jako sesję** N i **Otwórz następny rozdział rankiem dnia** N to trzy pola: pierwsze przechodzi do następnego rozdziału, drugie do następnej sesji, a trzecie do kolejnego ranka, dzień później, z odnowionymi akcjami i Search Tokenami.

Następny rozdział zaczyna się od zera. Plan Key Remnantów przechowuje wiersze osobno dla każdego rozdziału, więc następny otwiera się z pustym planem; rejestr Blackened jest prowadzony osobno dla każdego rozdziału i w następnym zaczyna pusty, a żadna karta ciała nie przechodzi do następnego rozdziału. Przesunięcie rozdziału albo sesji w trakcie Investigation kończy Investigation, a następny rozdział otwiera się w Daily Life. Jeśli rozprawa trwa, a ty odznaczysz pole rozprawy i zaznaczysz następny ranek, ranek otworzy się w tej rozprawie, zgodnie z twoim wyborem.

O śmierci, której nikt nie znalazł, okno nic nie mówi i niczego o niej nie ogłasza: jeśli stół ma o niej wiedzieć, najpierw ujawnij ją ręcznie (sekcja 13.4). Notka w oknie mówi, czy w tym rozdziale postawiono Final Truth Remnant, a jeśli nie, gdzie go postawić.

**Rozdział 6 jest ostatnim w sezonie:** tam pole następnego rozdziału startuje odznaczone i mówi o tym ostrzeżenie. Zamiast przechodzić do 7, zresetuj sezon (sekcja 16.2).

Rozdział może zakończyć tylko główny GM: w przeglądarce innego GM-a okno się nie otwiera i mówi, kogo poprosić. Okno pamięta rozdział, sesję, dzień i fazę, przy których je otwarto. Jeśli któreś z nich się zmieni, zanim zatwierdzisz, nic się nie dzieje, a GM-owie dostają prośbę, żeby otworzyć okno ponownie. Zmienić je może Edytuj kampanię, pora dnia przechodząca w nowy dzień, inny koniec rozdziału, otwarcie albo zamknięcie Class Trial i rozpoczęcie Investigation.

Kroki wykonują się jeden po drugim. Krok, który się nie uda, jest wymieniony w ostrzeżeniu, a reszta i tak się wykonuje, z wyjątkiem następnego ranka, który czeka, gdy nie udało się zamknąć rozprawy. Faza jest odczytywana ponownie przed każdym krokiem: Class Trial otwarty albo Investigation rozpoczęte w trakcie końca rozdziału zatrzymuje go w tym miejscu. To, co się wykonało, zostaje, a GM-owie dowiadują się, które z zaznaczonych przez ciebie kroków się nie wykonały.

Koniec rozdziału, który się zatrzymał, zostaje zapamiętany razem z tym, co wykonał. Zatrzymuje się, gdy krok się nie udał, faza się zmieniła, karta przeglądarki GM-a zamknęła się w połowie albo przeglądarka innego GM-a stała się przeglądarką głównego GM-a. Mówi o nim linia Dalej, a **Zakończ rozdział** zamiast formularza pyta: **Dokończ koniec rozdziału**, **Porzuć resztę** albo **Anuluj**. **Dokończ koniec rozdziału** wykonuje tylko kroki jeszcze niewykonane i przechodzi do rozdziału, sesji i ranka, od których koniec się zaczął, plus jeden, więc każde z nich przesuwa się raz, niezależnie od tego, ile razy go naciśniesz. Działa u głównego GM-a, po powrocie do fazy, w której koniec się zatrzymał. **Porzuć resztę** zostawia te kroki niewykonane i wymienia je na karcie GM-ów. Dopóki koniec nie zostanie dokończony albo porzucony, żaden nowy koniec rozdziału się nie zaczyna.

### 16.2 Zresetuj sezon

**Zresetuj sezon** to czerwony przycisk na dole okna **Ustawienia sezonu**: wymazuje sezon i zachowuje obsadę. Okno wymienia dokładnie, co znika, z liczbami, w 30 grupach do zaznaczenia w pięciu sekcjach. Domyślnie wszystkie są zaznaczone; odznacz grupę, a reset jej nie ruszy. Moduł zapamiętuje odznaczone grupy i przy następnym resecie są one znowu odznaczone.

| Sekcja | Co znika |
| --- | --- |
| **Sprawa** | Remnanty na mapach i to, co zabrano z każdego ciała; Truth Bullets i klucz odpowiedzi; incydent razem z deklaracjami złożonymi w ciemności; rozprawa, jej postęp i głosowanie; plan Key Remnantów; Search Tokeny; które pokoje odkryła każda postać; znalezione ciało, które czeka na odpowiedź |
| **Obsada** | śmierci i Monocuby, także śmierci, których nikt nie znalazł; każdy noszony albo schowany przedmiot; każdy awans i to, co kupił, oraz Level Upy czekające na klasę; budżet akcji, odnowiony, i odpoczynki każdego ucznia; notatki przed sesją; które skrytki znalazł każdy uczeń |
| **Plansza** | projekty, razem z tym, kto buduje każdą pułapkę i co ją uruchamia; Mastermind; kto zna które tajne przejście (kto znał je na starcie sezonu, zna je znowu), tajne przejścia zbudowane w projektach i każdy wyłom (każda ściana najpierw wraca na miejsce, a zamek jej pokoju przestaje być wyważony); obowiązujące Despair Calls; Motive; zasady killing game; drzwi, z powrotem do stanu z otwarcia sezonu; ustawianie w Eclipse razem z przejściami; zwołane zgromadzenie |
| **Dziennik** | każda karta, którą napisał moduł, i każdy wątek komunikatora; reszta dziennika czatu |
| **Świat** | pule Despair do zera, razem z tym, co są winne, i Hope z powrotem do 2; podział uczniów między Monokumy w Despair Flow; Overflow i jego licznik; zegar na rozdział 1, dzień 1, rano, z odnowionymi akcjami wszystkich, licznikiem sezonu o jeden dalej i zdjętą flagą Final Trial, a z nim runda gotowości i zatrzymany koniec rozdziału |

Gdy znika podział między Monokumy, każdy uczeń zasila pierwszą pulę, dopóki nie podzielisz klasy ponownie; prosi o to wiersz listy kontrolnej sezonu *Każdego ucznia pilnuje Monokuma*. *Plan Key Remnantów*, odznaczony, zachowuje tylko wiersze rozdziału, w którym był sezon.

Każda grupa zabiera ze sobą to, co mówi jej etykieta, a także to, co z niej przechowują GM-owie (sekcja 14.8). *Śmierci i Monocuby* przywracają każdemu uczniowi pełne Health i Sanity, *Co nosi obsada* oddaje klucz każdej sypialni jej właścicielowi, a *Level Upy* zabierają doświadczenia dodane przez Level Up (o starszym startowym arkuszu mówi sekcja 22.16). *Wciąż obowiązujące Despair Calls* zabierają każdy Call uzbrojony na rzut, *Skrytki, które każdy uczeń już znalazł* otwierają na nowo każdą ukrytą skrytkę, grupa *Naprawy, projekty i ich Countdowny* zdejmuje każdy token projektu ze wszystkich scen, a *Znalezione ciało, które czeka na odpowiedź* czyści zapis, które ciała znaleziono.

Grupy wykonują się jedna po drugiej, najpierw incydent. Trwający incydent zostaje porzucony bez zamykania: nikt nie ginie ani nie trafia do rejestru Blackened, żadne narzędzie się nie psuje i żadna karta nie jest wysyłana. Grupa, która się nie uda, jest wymieniona na karcie raportu, a reszta i tak się wykonuje. Reset, który się nie skończył, zostaje zapamiętany; tak się dzieje, gdy grupa się nie udała, głównym GM-em został inny GM albo karta przeglądarki GM-a zamknęła się w połowie. Następne **Zresetuj sezon** mówi o tym i otwiera się z zaznaczonymi tylko grupami, których nie dokończył, a reset uruchomiony z tego zapisu zostawia zapamiętane wyjątki bez zmian. Gdy zegar ruszy się z miejsca, w którym ten reset go zostawił, czyli minie pora dnia albo zacznie się dzień, sesja, rozdział lub sezon, zapis nie jest proponowany i okno otwiera się jak zwykle.

Po resecie rozdział 1 poprzedniego sezonu nie jest brany za rozdział 1 nowego sezonu, bo Remnanty, Motive, Final Truth, sekcja zwłok i milczenie Monocuba o zbrodni mają oznaczenie swojego sezonu. Linia Dalej, plan Key Remnantów i jego opłata oraz linia sekcji zwłok czytają tylko te z tego sezonu. Trzy zapisy są czytane tylko po rozdziale, więc gdy ich grupa jest odznaczona, przechodzą do rozdziału o tym samym numerze w nowym sezonie: postęp rozprawy i jej głosowanie (*Postęp Class Trial i jego głosowanie*), zdrada wciąż dostępna (*Incydent*) i Truth Bullet zablokowany przez nieudane Analyze (*Truth Bullety w ekwipunku obsady*).

**Dokąd trafiają tokeny obsady** daje trzy wybory: zostają tam, gdzie stoją, każdy uczeń idzie do własnej sypialni przypisanej w Ustawieniach pokoi albo wszyscy idą do jednego pokoju. Domyślnie zostają na miejscu, a wybór nie jest zapamiętywany. Ekran każdego gracza, którego uczeń się przenosi, przesuwa się na ten token. Token przenosi się tylko na mapie, na której narysowano jego pokój; uczeń bez sypialni albo bez tokenu na tej mapie zostaje na miejscu, a raport go wymienia. Ciało zostaje tam, gdzie upadło. To, dokąd trafiają tokeny, nie jest grupą, bo reset bez niczego zaznaczonego się nie uruchamia; gdy nie udało się przenieść całej obsady, raport mówi, żeby przenieść ją ręcznie. Na karcie raportu to, dokąd wysłano tokeny, ma własną linię zamiast miejsca wśród wyczyszczonych grup.

**Co zostaje:** obsada z nazwiskami, portretami i Ultimate, mapy, pokoje i ich właściciele, zespół Monokum i nazwy ich pul oraz nazwa kampanii.

**Historia powiadomień**, którą prowadzi każda przeglądarka (sekcja 18), kończy się z sezonem tylko przy resecie, który czyści zegar, incydent, własne karty tego modułu albo resztę dziennika czatu. Taki reset czyści historie wszystkich kont tego świata, od razu w otwartej przeglądarce, a w każdej innej przy następnym wczytaniu świata. Reset bez żadnej z tych czterech grup nie czyści żadnej historii.

Sezon może zresetować tylko główny GM (sekcja 6.3): inny GM dowiaduje się, kto nim jest, i nic się nie dzieje. Okno wymienia każdego GM-a, który nie jest połączony. Przeglądarka GM-a trzyma swoją kopię sprawy (sekcja 14.8), dopóki znów nie otworzy świata, a przeglądarka, której nie było, usuwa to, co trzymały wyczyszczone grupy, przy pierwszym wczytaniu, czy ktoś inny jest połączony, czy nie. Jeśli coś z tego może ci się jeszcze przydać, najpierw zrób kopię sprawy. Jeśli głównym GM-em zostanie inny GM, gdy okno jest otwarte, **Zresetuj sezon** niczego nie resetuje i mówi, kto jest teraz głównym GM-em. Jeśli GM połączy się, gdy reset już ruszył, reset zatrzymuje się przy następnym kroku: to, co się wykonało, zostaje, a nic dalej się nie wykonuje, także tokeny obsady i zegar. Błąd i raport wymieniają, czego nie wykonano i kto jest teraz głównym GM-em, żeby dało się to dokończyć kolejnym resetem.

> [!CAUTION]
> Potwierdzasz, wpisując **RESET** wielkimi literami, tak jak w oknie. Nic innego niczego nie resetuje, a resetu nic nie cofnie.

---

## 17. Dźwięk i efekty

> [!NOTE]
> **Moduł nie zawiera żadnych dźwięków.** Pliki są twoje, a zdarzenie bez pliku jest ciche.

Okno **Dźwięk** (Teraz > Dźwięk) ma dla GM-a trzy zakładki: **Odtwarzanie**, **Muzyka** i **Efekty**.

- **Odtwarzanie** puszcza w pętli utwór z playlisty o nazwie „Situational” i wstrzymuje to, co grało, a **Wyłącz utwór** przywraca to, co grało. Jeśli świat nie ma playlisty dokładnie o tej nazwie, przycisk ją tworzy. Dopasowanie jest po nazwie, więc playlistę o prawie tej samej nazwie moduł ignoruje.
- **Muzyka** przypisuje jedną playlistę każdemu stanowi gry. Zakładka zaczyna się jednym zdaniem, a uwagi o kolejności są zwinięte pod **Jak działa kolejność**.
- **Efekty** mają jeden wiersz na zdarzenie, pod jego kategorią. Wiersz przyjmuje plik albo kilka plików rozdzielonych `|`, losowanych tak, że ten sam nigdy nie gra dwa razy z rzędu, a obok pola pliku stoi **Wybierz**. W kolumnie **Sprawdź lub wyczyść** przycisk **Test** gra plik wiersza, a **Wyczyść** opróżnia wiersz i zostawia zdarzenie ciche. Test, który nie może zagrać, mówi dlaczego i co zrobić, na przykład *To zdarzenie nie ma jeszcze pliku. Wybierz go w kolumnie Plik.*

**Muzyka podąża za stanem gry** to przełącznik na górze zakładki Muzyka, wyłączony, dopóki go nie włączysz. Gdy jest włączony, wygrywa pierwszy stan, który obowiązuje, w tej kolejności, a to, co gra u głównego GM-a, słyszą wszyscy.

| Kolejność | Stan | Uwagi |
| --- | --- | --- |
| 1 | Gra wstrzymana | |
| 2 | Eclipse (okno ustawiania) | |
| 3 | Objection | Losowy utwór na każde przejęcie głosu, od razu; rebuttal zachowuje tę samą muzykę, a Objection ma tę muzykę w każdym trybie rozprawy |
| 4 | Debata | |
| 5 | Dyskusja | Muzykę dyskusji grają też Testimony, Panic Round i Closing Argument |
| 6 | Znaleziono ciało (cisza, o ile nie przypisano) | Domyślnie cisza, a poprzednia muzyka jest wstrzymana; cisza zatrzymuje też utwór puszczony ręcznie |
| 7 | Investigation | |
| 8 | Każda z pięciu pór dnia | |

Wiersz morderstwa stoi poza tą kolejnością, niezależnie od przełącznika. Gra jeden utwór ze swojej playlisty, ten sam dla wszystkich w incydencie, i tylko w przeglądarkach uczestników incydentu i GM-ów, żeby nikt inny nie dowiedział się z muzyki, że trwa morderstwo; budowniczy pułapki, który jest gdzie indziej, nie słyszy nic. Tam wiersz morderstwa ucisza muzykę pokoju do końca incydentu: gracz słyszy, jak muzyka pokoju się wstrzymuje i potem wraca tam, gdzie stanęła, a GM słyszy ją ściszoną. Utwór gra na kanale Muzyka z własną głośnością, więc każdy gracz słyszy go przy swojej głośności muzyki. Utwór, który się nie wczytuje, zostawia muzykę pokoju, a następny incydent próbuje go znowu. Gdy wiersz jest pusty, w incydencie gra dalej to, co grało.

**Każda zmiana zapisuje się od razu:** okno Dźwięk nie ma przycisku Zastosuj, wiersz Muzyki pokazuje *Zapisywanie...*, potem *Zapisano* (albo *Nie zapisano. Zajrzyj do konsoli.*), a każda zakładka kończy się jednym **Zamknij**. Przypisanie jest zapisane w świecie, więc może je zmienić każdy GM, a muzyka stołu idzie za zmianą w ciągu kilku sekund. Dwóch GM-ów zapisujących w tej samej chwili różne wiersze zachowuje oba. Gdy okno jest otwarte na ekranach dwóch GM-ów, otwórz je ponownie, żeby zobaczyć zmiany drugiego GM-a. Playlista „Situational” jest źródłem utworów tylko dla zakładki Odtwarzanie i żaden wiersz Muzyki jej nie oferuje.

Dwa suwaki głośności ustawia każda przeglądarka osobno; są w oknie ustawień pod zębatką (sekcja 18), a dla graczy także w oknie *Dźwięk*. Suwak *Dźwięk* jest dla efektów i pokazuje zwykły procent. Suwak *Muzyka* to ta sama głośność playlist, którą ma Foundry, rysowana na skali Foundry, więc powinien pokazywać tę samą liczbę co suwak playlist w Foundry. GM znajduje przełącznik całego stołu **Różnicuj dźwięki, które słychać często** w zakładce Efekty, przy objaśnieniu znaczka *zmienny*: dźwięk, który słychać często, brzmi wtedy za każdym razem trochę inaczej.

Katalog według kategorii:

| Kategoria | Zdarzenia |
|---|---|
| **Bezpieczeństwo** | safeword: gra niezależnie od suwaka *Dźwięk*, przy głośności interfejsu Foundry gracza, gdy już kliknął w stronę |
| **Interfejs** | otwieranie i zamykanie okien, przyciski, otwarcie czatu |
| **Czat** | wiadomość wysłana, odebrana, gracz woła GM-a, Hope Call, Despair Call, nowa zasada, Motive, zgromadzenie |
| **Świat** | odkryty pokój, wejście do pokoju, odrzucone przejście, poznane tajne przejście, wyłamana ściana, wydana akcja, ukończony projekt, krytyk, przeszukanie bez wyniku, nieudane Observe, zauważony tajny projekt, nieudany albo zauważony sabotaż, złamane narzędzie, kradzież, początek i koniec Eclipse, odpalenie Overflow |
| **Incydent** | śmierć, gaśnięcie po śmierci, znalezione ciało, nieudane sprzątanie, Breakdown, Wounded, zmiana Monocuba, Monocub się wtrąca, Confusion, twoja tura w incydencie albo w rundzie rozprawy, znaleziony Truth Bullet, rozpoznany dowód, nieudana analiza, plansza początku dnia, plansza końca dnia, błysk szyb na początku Investigation, tytuł Class Trial, otwarcie debaty, Objection, rebuttal, Overrule, start Panic Round, otwarcie Closing Argument, Ujawnienie Monokumy, wynik Straw Poll, dobre i złe odpowiedzi w Logic Dive, wejście do strefy, otwarcie głosowania, wynik głosowania, cut-in werdyktu (jego stempel), egzekucja, podsumowanie sprawy, koniec rozprawy, Level Up |

Odbiorcy każdego zdarzenia są ustaleni w katalogu. Śmierć słyszą tylko GM-owie i uczestnicy, a gracz ofiary słyszy zamiast niej gaśnięcie, albo dźwięk samej śmierci, dopóki gaśnięcie nie ma pliku. Znalezione ciało słyszą wszyscy, a osobno także jeden gracz, raz na każde ciało, gdy jego uczeń wejdzie do pokoju, w którym leży ciało. Rebuttal słyszy cały stół, raz, gdy się zaczyna, niezależnie od tego, czy minęła minuta Objection, czy otwierasz go ty.

**Dźwięki sekwencji** (sekcja 15.3, a plansze dnia w sekcji 4) to pięć wierszy *Incydent*, a każdy słyszy cały stół: **Początek dnia** i **Koniec dnia** brzmią, gdy wznosi się każda z plansz, **Błysk szyby** przy każdym błysku Investigation (jest oznaczony *zmienny*), **Start rozprawy**, gdy pojawia się tytuł rozprawy, a **Cut-in werdyktu**, gdy spada stempel werdyktu. Gdy **Sekwencje na cały ekran** są wyłączone, obie plansze i błysk milczą, a błysk milczy też przy ograniczonych animacjach; tytuł rozprawy i stempel werdyktu grają nawet wtedy. **Wynik głosowania** gra przy karcie z liczeniem głosów, a cut-in werdyktu to osobny wiersz.

**Krytyk** gra przy krytyku, gdy jego powiadomienie wjeżdża cięciem. Powiadomienie o krytycznym wyniku akcji jest jedyną kartą, która wjeżdża cięciem, i zaczyna się od wyniku zapisanego słowami, od glifu krytyka oraz tego, kto rzucał i jaką akcją; karty rzutów na czacie wchodzą zwyczajnie.

Przeglądarka nie gra niczego, dopóki ktoś w nią nie kliknie, a moduł takie dźwięki porzuca zamiast kolejkować. Wywołania konsoli, które mówią, co porzucono i czemu dźwięk nie zagrał, są w sekcji 20.

---

## 18. Okno ustawień, motywy i ustawienie Język

Zębatka w prawym dolnym rogu (**Ustawienia**) otwiera **Ustawienia DRPG**; to samo okno otwiera przycisk **Ustawienia DRPG** w Configure Settings Foundry. Wszystko w nim dotyczy tylko tej przeglądarki i jest to to samo okno dla GM-a i gracza, poza przełącznikiem **Szczegółowe logi w konsoli** w sekcji **Techniczne**, który widać tylko w oknie GM-a. Przełączniki całego stołu są w ustawieniach gry, za kafelkiem Ustawienia gry panelu GM-a (sekcja 1.3), a przełącznik muzyki i **Różnicuj dźwięki, które słychać często** są w oknie Dźwięk (sekcja 17).

Po lewej stoi lista sekcji: **Wygląd**, **Efekty i dostępność**, **Dźwięk i głos** i **Techniczne**, a po prawej wybrana sekcja. **Zapisz zmiany** zapisuje twoje zmiany, a **Anuluj** zostawia je niezapisane. **Dźwięk i głos** ma dwa suwaki głośności i **Dźwięki komunikatora**, a gdy świat ma głos, także mikrofon, wyjście dźwięku, tryb zawsze włączony albo push to talk i jego klawisz, z przyciskiem do Configure Controls Foundry. Suwaki i ustawienia głosu działają od razu, gdy je zmieniasz. Reszta:

| Ustawienie | Szczegóły |
|---|---|
| **Język** | English albo Polski, osobno w każdej przeglądarce, domyślnie English, celowo niezależnie od języka samego Foundry; zmiana prosi o przeładowanie, a nazwy z gry, takie jak Truth Bullet, zostają po angielsku |
| **Motyw** | *Stained Glass* (obecny wygląd: czarne, pęknięte szkło wzdłuż krawędzi ekranu, kolor w spoinach) albo *Monokuma Legacy* (wcześniejszy wygląd), który ma przełącznik **Czcionka pikselowa** |
| **Skala interfejsu** | od 80% do 140%; dotyczy czcionki i paneli modułu |
| **Puls szkła**, **Nazwa stanu za zegarem** i **Szkło rozmywa mapę** | w motywie Stained Glass |
| **Ograniczone animacje** i **Wysoki kontrast** | w obu motywach; każde z nich włącza się też samo, gdy prosi o to ustawienie systemu operacyjnego |

Przełączniki drugiego motywu zostają na swoim miejscu, wyszarzone, a powód podaje ich dymek.

> [!TIP]
> **Szkło rozmywa mapę** to najdroższy efekt motywu i pierwsza rzecz do wyłączenia, gdy interfejs się przycina. Jak zmierzyć, ile na tej maszynie kosztuje ten i każdy inny efekt motywu, mówi sekcja 20.

Dwa paski Foundry nie są częścią ekranu w żadnym motywie. Gracz nie ma ani paska bocznego, ani sterowania sceną: jego token dalej zaznacza się i przeciąga na warstwie Tokens, a moduł nie zmienia żadnego skrótu klawiszowego Foundry, ale z paskiem odchodzi rysowanie, notatki na mapie i przycisk celowania. Gracz w ogóle nie widzi czatu: tego, co tam napiszesz - poza postacią albo przez /roll innego modułu - nie czyta żaden gracz; to, co moduł mówi graczowi, dociera do niego jako karta powiadomienia albo w komunikatorze.

GM ma oba, w dwóch oknach modułu: w oknie **Narzędzia Foundry** jest pasek boczny (czat, zakładka Sceny i pozostałe katalogi), a w oknie **Narzędzia mapy** sterowanie sceną. Przycisk z białym kowadłem nad książką, **Otwórz lub zamknij narzędzia Foundry**, otwiera oba okna i oba zamyka; czerwony przycisk GM-a stoi obok, nad zębatką. Okno przeciągasz za pasek tytułu: ta przeglądarka pamięta, gdzie je zostawiasz, i trzyma je w całości na ekranie i z dala od przycisków w rogu, także po zmianie rozmiaru okna przeglądarki. Strzałka Foundry u dołu paska kart zwęża Narzędzia Foundry do samych kart i rozszerza je z powrotem.

Wszystko, co otwiera zakładkę paska bocznego, najpierw otwiera Narzędzia Foundry, także **Shift+C** Foundry. **Escape** zostaje przy Foundry: zamyka okna i menu Foundry i zwalnia zaznaczenie tak jak bez modułu, a dwa okna zamyka dopiero wtedy, gdy nie zostało nic z Foundry do zamknięcia. Zamknięcie Narzędzi Foundry zwija pasek boczny, a wtedy Foundry pokazuje powiadomienia czatu.

Przełącznik świata **Okna modułu dla paska bocznego i sterowania sceną Foundry** w ustawieniach gry, domyślnie włączony, jest drogą powrotu do układu Foundry. Gdy go wyłączysz, po przeładowaniu pasek boczny i sterowanie sceną GM-a stoją tam, gdzie stawia je Foundry, szkło znów tnie się wokół nich, a przycisku Narzędzi Foundry nie ma. Rozwinięty czat GM-a leży wtedy nad przyciskami w rogu, które zostają na swoich miejscach, i zwija się w rytmie, w jakim się wysuwa, a gdy włączone są **Ograniczone animacje**, zwija się od razu. Ekran gracza jest taki sam przy włączonym i wyłączonym przełączniku.

Moduł, który nie wystartował, zdejmuje ze strony swoje arkusze stylów, więc zakładka Sceny, nawigacja scen i pasek makr znów należą do Foundry (sekcja 1). Gdy moduł działa, nawigacja scen Foundry i pasek makr są ukryte na każdym ekranie, także u GM-a: sceny przełącza się z zakładki Sceny, a makra uruchamia z katalogu makr (Macro Directory). Tracker walki Foundry (jego zakładka na pasku bocznym i okno, które się z niej wysuwa) oraz wyświetlacz efektów Daggerheart też są ukryte na każdym ekranie; stan nadal widać na ikonach statusu tokenu i na arkuszu.

**Szkło i okna.** W motywie Stained Glass nowa faza albo pora dnia obraca szkło: nowy kolor przychodzi od środka w około 1,2 sekundy, a spoiny raz błyskają. Tam, gdzie panele muszą się przesunąć (faza, która przesuwa panel, panel, który się pojawia albo znika), szyby jadą w całości na nowe miejsca, razem z teksturą. Nowa pora dnia nigdy nie tnie szkła od nowa, z muzyką ani bez niej. Gdy włączone są **Ograniczone animacje**, szkło od razu przyjmuje stan końcowy.

Powiadomienia samego Foundry (ostrzeżenie, błąd) stoją pod szkłem na ciemnej płytce z kolorową kreską po lewej, pod paskiem Despair, a nie na nim. Kafelek akcji, którego uczeń teraz nie może użyć albo na który go nie stać, ma pod szkłem jeden wygląd, ciemny z przerywaną krawędzią, bez względu na koszt; w motywie Monokuma Legacy kafelki mają wygląd tego motywu. Okno, na które gra czeka (rzut, Observe, deklaracja akcji, decyzja, głosowanie, Level Up, pytania rozprawy), zostaje nad arkuszem postaci, który na nie zachodzi, także po kliknięciu arkusza albo jego przerysowaniu. Pozostałe okna modułu, panel GM-a też, wychodzą na wierzch tak jak okna Foundry, więc zmiana Hope, która przerysowuje arkusz, nie wyciąga panelu GM-a nad okno, w którym pracujesz.

**Pory dnia.** W motywie Stained Glass pora dnia daje szkłu kolor, kolor pory: po jednym stopniu spokojnej skali na Rano, Południe, Popołudnie, Wieczór i Noc. Faza zajmuje miejsce pory, dopóki trwa: Investigation ma niebieski, Class Trial kolor Despair, a Eclipse swój fiolet, i każdy ekran przy stole ma ten sam kolor. Wyjątek: dopóki trwa incydent, ekrany osób, które w nim są, mają czerwień incydentu zamiast pory i fazy; to zabójca, ofiara, każdy, kto wszedł, i każdy GM, ale nie zabójca z pułapki. Kolor zmienia się razem z zegarem, z obrotem szkła. W motywie Monokuma Legacy pora niczego nie barwi: krawędź zegara i linia fazy mają kolor fazy, a linie na mapie są w kolorze Bone.

**Kolory.** W motywie Stained Glass kolor znaczy jedno. Złoto to Hope i nic innego. Ramka fokusu i zaznaczony wiersz mają kolor uwagi, Bone. Kolor pory jest ozdobą na szkle, ramkach, nagłówkach i liniach mapy i nigdy nie stoi na kontrolce ani na karcie; gdzie stoi, a gdzie nigdy, wymienia sekcja 22.18. W motywie Monokuma Legacy wszystko to ma swoje kolory.

Na wąskim ekranie panele modułu stoją w jednej kolumnie u góry, a plansza pod nią zostaje widoczna i da się na niej grać: nie zakrywa jej żadna szyba, a szkło stoi tylko wzdłuż pasków i przy przyciskach w rogu. Pasek stanu i zasobnik projektów gracza stoją tam przed paskiem Despair, a panele GM-a mają zwykłą kolejność. Gdy kolumna jest dłuższa niż miejsce na nią, przewija się, a jej dół gaśnie, póki niżej jest coś jeszcze. Lista graczy GM-a to jedna linia u dołu ekranu, na lewo od przycisków w rogu; gracz na wąskim ekranie nie ma listy graczy.

**Zwijanie okna.** Dwukrotne kliknięcie paska tytułu okna zwija je do paska, a kolejne rozwija z powrotem. To gest samego Foundry i działa w oknach modułu (panel GM-a, okna otwierane z jego kafelków, okno opisu pokoju), w arkuszach postaci i w oknach innych modułów; krótkie okno z jednym pytaniem, na przykład potwierdzenie, się nie zwija, tak jak nie zwijają się takie okna samego Foundry. Kafelek wciśnięty, gdy jego okno jest zwinięte, rozwija je z powrotem. Okno komunikatora zwinięte do paska nie oznacza wiadomości jako przeczytanej, dopóki go nie rozwiniesz.

Książka otwiera podręczniki w grze, w języku modułu. Stoi pod komunikatorem w prawym dolnym rogu, przy samej krawędzi ekranu, i jest tej samej wielkości co zębatka po jej lewej. Ulotka ucznia i Podręcznik gracza są dla wszystkich, a ten Podręcznik GM tylko dla GM-ów.

Kliknięcie dowolnego stałego panelu (zegara, paska Despair, paska stanu, zasobnika projektów) otwiera okno, które tłumaczy, czym jest i jak stoją sprawy, a każdemu użytkownikowi pokazuje tylko to, co panel już mu pokazuje. W zasobniku projektów każdy projekt to jeden wiersz, z nazwą i licznikiem w jednej linii. Zasobnik GM-a jest na bieżąco. Zasobnik gracza pokazuje każdy projekt w stanie, w jakim któraś z jego postaci ostatnio widziała go w pokoju projektu, na bieżąco, gdy któraś tam stoi, i **?** tam, gdzie ta przeglądarka projektu nie widziała; projekt albo naprawa zrobione od ostatniej wizyty gracza pojawiają się dopiero po następnej. Minus i plus GM-a mówią, co robią, gdy wskażesz je kursorem, a gdy wierszy jest więcej niż pięć, lista się przewija, a jej dół gaśnie.

Powiadomienia to karty, na których pojawiają się wyniki, odmowy i ogłoszenia; GM dostaje te skierowane do stołu albo do niego. Powiadomienie zostaje, dopóki czytający go nie zamknie: zwykłe kliknięciem w dowolne miejsce na nim, przyklejone przyciskiem X. Samo zamyka się tylko karta „Czekamy na GM-a…”, gdy przyjdzie odpowiedź. Najnowsze ląduje na górze i spycha starsze w dół. Stos pokazuje 2 powiadomienia na kafelku Stained Glass i 4 w motywie Monokuma Legacy; gdy jest ich więcej, starsze czekają pod spodem za plakietką „+N” i wracają, w miarę jak karty są zamykane. Kliknięcie w „+N” zamyka naraz wszystkie karty poza przyklejonymi. Scena dowodów Class Trial na środku mapy pokazuje dwa i zachowuje kolejność przybycia, więc Objection czyta się po przedstawieniu, na które odpowiada. O tym, czy karty stoją nad oknami, decyduje motyw: w motywie Stained Glass kafelek powiadomień stoi pod każdym oknem, jakąkolwiek kartę pokazuje, więc okno przeciągnięte na kafelek zasłania jego karty, a w motywie Monokuma Legacy każda karta stoi nad oknami.

Powiadomienia, które narysuje przeglądarka GM-a, zostają w jej oknie **Historia powiadomień**, tak jak przeglądarka gracza zachowuje jego. Otwiera je przycisk ze stosem kart w prawym dolnym rogu kafelka powiadomień (w motywie Monokuma Legacy na komputerze pod zegarem, także bez kart; na wąskim ekranie w prawym dolnym rogu najniższej karty, gdy jakaś karta jest na ekranie), a także skrót klawiszowy, nieprzypisany, dopóki stół go nie wybierze, oraz `game.drpg.openNotices()`. Trzyma to, co pokazała ci ta przeglądarka, u GM-a najwyżej 150 najnowszych (u gracza 250) i 40 od jednego nadawcy, do resetu sezonu, który czyści zegar, incydent, własne karty tego modułu albo resztę dziennika czatu (sekcja 16). Okno je filtruje: **Wszystkie**, **Dla ciebie** i **Niewykonane** na górze, a **Ogłoszenia**, **Od graczy**, **Dowody** i **Komunikator** w **Więcej filtrów**; każdy filtr pokazuje, ile zawiera, a filtr bez żadnego jest wyszarzony. Karta, którą moduł wycofa, na przykład prośby otwarcia incydentu, gdy ten idzie dalej, albo kryzys, który cofniesz, znika wtedy także z historii każdej przeglądarki. Zanim udostępnisz ekran, wyczyść historię przyciskiem **Wyczyść**, a na wspólnym komputerze najpierw przeczytaj sekcję 19.

---

## 19. Safeword

Każdy arkusz postaci ma w lewym dolnym rogu przycisk safeword, podpisany słowem stołu; ustawia się je w Ustawieniach sezonu, a puste pole oznacza domyślne „Safe Word”. To samo robi skrót klawiszowy, nieprzypisany, dopóki stół go nie wybierze. Nacisnąć może każdy: gracz, GM, zmarły, Monocub, Widz. Każda z tych dróg najpierw pyta *Zatrzymać scenę?*: **Zatrzymaj scenę**, domyślny (Enter), robi naraz trzy rzeczy, a **Anuluj** niczego nie wysyła.

1. Gra się zatrzymuje. Pauzę może włączyć tylko przeglądarka głównego GM-a, więc jakiś GM musi być połączony.
2. Wszyscy widzą tę samą kartę „SCENA ZATRZYMANA” i słyszą dźwięk safeword, niezależnie od swojego suwaka *Dźwięk*, przy głośności własnego suwaka interfejsu Foundry i dopiero wtedy, gdy od wczytania strony kliknęli w nią gdziekolwiek, bo wcześniej przeglądarka niczego nie gra. Kartę dostaje na pewno każdy.
3. Każdy GM dostaje przyklejoną notkę z informacją, kto to wywołał, a jeśli naciśnięto przycisk na arkuszu, także z którego pokoju. Notka zostaje w oknie **Historia powiadomień** tego GM-a jak każde inne powiadomienie, w granicach z sekcji 18.

Nikomu innemu nie mówi się, kto to był. Naciśnięcie gracza prosi przeglądarkę głównego GM-a o wystawienie karty, więc nie ma na niej imienia żadnego gracza. Gdy żaden GM nie jest połączony, kartę wystawia przeglądarka wołającego: jej nagłówek nie pokazuje imienia, ale zapis karty podaje wołającego jako autora, jak każda karta wystawiona przez przeglądarkę gracza (sekcja 1.6). Tak samo jest z naciśnięciem, na które przeglądarka żadnego GM-a nie odpowie w ciągu trzech sekund, na przykład gdy GM jest połączony, ale przeładowuje stronę: kartę wystawia wtedy przeglądarka wołającego, a jego własna karta mu to mówi. GM, którego przeglądarka nie słuchała, nie dowiaduje się, kto to wywołał, a gra staje tylko wtedy, gdy przeglądarka głównego GM-a zobaczy, że karta przyszła; jeśli twoja jeszcze się ładowała, zatrzymaj grę ręcznie. Gracz, który naciśnie znowu w ciągu minuty od karty, nie wystawia nowej, a ta, która już jest, zostaje. Panel zdarzeń trzyma kartę „Scena zatrzymana”, bez imienia, tak długo, jak gra stoi na pauzie.

> [!CAUTION]
> Nie ma pola powodu ani celu: scena jest zatrzymywana, a nikt nie składa oskarżenia. Wyjaśnijcie sprawę z tą osobą, potem wznówcie od punktu, na który wszyscy się zgodzą.

Na wspólnym komputerze każde konto tego świata, które zaloguje się w tej przeglądarce, może z konsoli przeczytać historie innych kont z okna **Historia powiadomień**, także tę notkę i karty zabójcy. Gdy historie zapełnią miejsce przeglądarki, historia konta zalogowanego teraz zostaje tylko do zamknięcia jego strony, a okno to mówi (sekcja 22.19). Reset sezonu, który czyści zegar, incydent, własne karty tego modułu albo resztę dziennika czatu, czyści wszystkie historie (sekcja 16.2), a reset bez żadnej z tych czterech grup nie czyści żadnej. Na wspólnym komputerze wyczyść więc historię, zanim oddasz komputer albo udostępnisz ekran.

**Notatka przed sesją** w komunikatorze to druga połowa safeword: siedem pytań, na które gracz odpowiada przed każdą sesją. Pytają, czy zamierza zabić, czy jest otwarty na śmierć, czy zgadza się na tortury swojej postaci, czy jest otwarty na romans, o triggery, o to, jak chce grać, i o duży projekt, który planuje. Pierwsze cztery to granice. Czytaj notatki, zanim zdecydujesz o zgodzie na morderstwo. Treść notatki widzą tylko GM-owie i jej autor: przeglądarka żadnego innego gracza ich nie ma, a notatka zapisana, gdy żaden GM nie jest online, czeka w przeglądarce autora, aż któryś się połączy.

---

## 20. Rozwiązywanie problemów

Każde wywołanie z tej sekcji jest pod `game.drpg` w konsoli przeglądarki (F12), a argument aktora przyjmuje dokument, id albo nazwę.

### 20.1 Jeden raport dla tego, kto ci pomaga

`game.drpg.diagnose()` otwiera okno ze wszystkim, co ta przeglądarka potrafi sprawdzić, jako jeden tekst, i zwraca ten sam tekst, więc makro też go ma. **Kopiuj raport** kopiuje raport do schowka: wklej go tam, gdzie ktoś ci pomaga. Każde wywołanie `diagnose...()` poniżej to jedna część tego raportu osobno.

Tekst raportu jest po angielsku, jak konsola, a jego części idą w tej kolejności: The contract with Foundry, Daggerheart and the modules; Data migration; Failures since this page loaded; Silenced warnings; Dice; Dice look; Despair; Styles; Windows; Truth Bullets; GM stores; Voice; Characters; Scenes; Fog; Room visibility; Token frames; Windows that keep themselves true; Music; Sound effects; Private cards; Traps. W przeglądarce gracza części czytające to, co wolno wiedzieć tylko GM-om (Despair, Truth Bullets, GM stores, Characters, Scenes, Room visibility, Music i Traps), są wymienione i mówią *Tę część raportu sprawdza tylko przeglądarka GM-a.* Nic z tego, co należy do GM-ów, nie trafia do raportu gracza.

Okno raportu wylicza też ostrzeżenia, które ta przeglądarka wyciszyła, każde po swoim id z przyciskiem **Pokaż znowu**. Moduł ma tylko jedno ostrzeżenie, które da się wyciszyć: ostrzeżenie, że Daggerheart jest nowszy od wersji, na której moduł testowano, a wyciszenie dotyczy tej jednej wersji.

### 20.2 Zestaw testów regresji

| Wywołanie | Co robi |
|---|---|
| `game.drpg.runTests()` | uruchamia regresje źródła i niezmienniki tylko do odczytu; jest bezpieczne w trakcie gry, a na końcu sprawdza, czy nic w świecie się nie ruszyło, i mówi, co się ruszyło, także wtedy, gdy w trakcie coś zrobił gracz |
| `game.drpg.runTests({ tier: 2 })` | dokłada scenariusze, a te zapisują, więc tier 2 uruchamiaj tylko na kopii świata; najpierw pyta, w oknie, które podaje nazwę świata, z Anuluj jako pierwszym i domyślnym przyciskiem |
| `game.drpg.runTests({ tier: 0 })` | czyta wyłącznie własne źródło modułu |

> [!CAUTION]
> **Tier 2 zapisuje**: otwiera incydenty, zabija uczniów i resetuje sezony na próbnych danych, które sam tworzy i usuwa, więc nigdy nie uruchamiaj go w świecie, w którym ktoś gra. Jest odrzucany, gdy incydent jest otwarty, a drugie uruchomienie na tym samym kliencie jest odrzucane, dopóki pierwsze trwa. Scenariusz, któremu świat nie daje dość ludzi albo pokoi, jest pomijany i mówi, czego światu brakuje.

Wynik to licznik „passed, failed, skipped”, a po nim po jednej linii `ok`, `FAIL`, `skip` albo `red` na każdy test. Gdy testy oznaczone tak, że mają nie przechodzić aż do wydania wskazanego etapu, zawiodły zgodnie z oznaczeniem, licznik kończy się dopiskiem „, N red until a later stage”. Skip to test, który powiedział, czego brakuje środowisku, i nigdy nie jest wynikiem, który wyszedł źle.

### 20.3 Wywołania według objawu

**Mgła i widoczność.**

| Wywołanie | Co robi |
|---|---|
| `diagnoseFog()` | mgła wygląda źle u gracza: uruchom je na kliencie gracza, bo mgła GM-a jest lżejsza i odsłania każdy pokój znaleziony przez klasę, więc nie pokaże problemu gracza; mówi, która z podobnych do siebie przyczyn zaszła: wyłączone ustawienie, brak nazwanych regionów, niezamontowana warstwa, wszystkie pokoje już odkryte albo nieprzygotowana scena |
| `diagnoseScenes()` | wymienia sceny z pokojami i to, czy każda jest gotowa; `prepareScenes()` naprawia je wszystkie |
| `whyBlack()` | wymienia, co warstwa mgły ma na ekranie, gdy obraz jest zły |
| `checkRegions()` | sprawdza pokoje sceny na ekranie i wypisuje, od najpoważniejszych: pokój, którego kształtu nie da się odczytać, dwa nachodzące na siebie pokoje, granicę odchodzącą od ścian, pokój bez wyjścia, region bez nazwy, pokój z nazwą nadaną przez Foundry, pokój, którego części różnią się brakiem prywatności, właścicielem albo wysokością, nazwany region, który nie jest pokojem (i dlaczego), oraz narożniki poza siatką samej mapy; na scenie o kilku piętrach sprawdza każde piętro osobno i podaje je w kolumnie `floor` (kolumna `level` to waga ustalenia: error, warning albo info) |
| `doorwayReport()` | tłumaczy każdy odcinek granicy bieżącego pokoju |
| `fogPeek()` | chowa mgłę na kilka sekund |
| `fogAnimations(false)` | wyłącza animację odsłaniania w trakcie sesji |
| `seedDiscovery()` | zapisuje pokój, w którym każda postać już stoi |
| `diagnoseVisibility()` | token z innego pokoju jest widoczny: uruchom je na kliencie, który się skarży, a wyjaśni, czemu token widać |

**Despair i kości.**

| Wywołanie | Co robi |
|---|---|
| `diagnoseDespair()` i `diagnoseDice()` | czytają Despair i kości |
| `diagnoseCharacters()` | daje raport ustawienia obsady |
| `diagnoseDiceLook()` | kości wyglądają inaczej na dwóch ekranach: każdy uruchamia je w swojej przeglądarce i odczytuje ono tylko tę przeglądarkę, czyli jej wersje Dice So Nice i Daggerhearta, wyświetlanie, preset Hope i Despair, brakujące nazwy i kości ostatniego rzutu, a u GM-a także ustawienia Dice So Nice każdego użytkownika i to, czy mają wygląd stołu; gracz kopiuje tekst z dołu okna i wysyła go GM-owi, a GM otwiera to samo także przyciskiem **Otwórz wygląd kości** na dole okna **Lista kontrolna sezonu** i w części **Foundry i moduły** okna **Dziennik debugowania** (Diagnostyka) |
| `diagnoseDiceLook({ test: true })` | robi to samo co `diagnoseDiceLook()`, a do tego rzuca kość Hope i kość Despair tylko na tym ekranie |

Despair, który nie dochodzi, to zwykle brak połączonego głównego GM-a, wyłączone **Rzuty dają Despair** albo rzut reakcji. Gdy przez przeładowanie przeglądarka głównego GM-a nie dowie się, czyj był rzut, rzut liczy się jednej żyjącej postaci rzucającego, a gdy rzucający nie ma żyjącej postaci, rzut nie daje Despair.

**Inne narzędzia.**

| Wywołanie | Do czego |
|---|---|
| `diagnoseVoice()`, `diagnoseSfx()`, `testSfx()` i `diagnoseMusic()` | głos, efekty dźwiękowe i muzyka |
| `diagnoseTruthBullets()` | czy Truth Bullety i ich klucz odpowiedzi się zgadzają |
| `diagnosePatches()` | czy każde nadpisanie jest tam, gdzie moduł się go spodziewa (sekcja 20.4) |
| `diagnoseWindows()` i `diagnoseStyles()` | ucięte okno albo źle wyglądający arkusz |
| `traceClicks()` | kliknięcie, które nic nie robi |
| `fileSizes()` | hostowany świat, który zdaje się serwować stare pliki |
| `openTimes()` | okno, które wolno się otwiera: każde okno otwarte na tej stronie od jej wczytania, jego pierwsze otwarcie wobec mediany kolejnych, mierzone od kliknięcia do wyrenderowania i do klatki, która je pokazuje; `{ reset: true }` zapomina odczytane otwarcia |
| `perf()` | motyw, który się przycina; także to, ile trwała droga rzutów, które losowała twoja przeglądarka, w ostatnich pięćdziesięciu losowaniach, w których brała udział: od pakietu do odpowiedzi tutaj, od prośby do startu kości, który przychodzi przed odpowiedzią, i od prośby do pokazania kości u gracza |
| `fps({ toChat: false })` | stół, który laguje: pięć sekund liczby klatek (środkowa klatka, najwolniejsza dwudziesta część, ile klatek trwało ponad 33 i ponad 50 ms), co moduł w tym czasie zrobił i ile kosztuje każdy z jego efektów, wyłączany po kolei na mniej więcej sekundę i przywracany; mapa jest wyłączana na końcu i na tę sekundę stoi. Naraz działa tylko jedno uruchomienie, a `counters()` czyta same liczniki modułu. Jak czytać `fps()`: sekcja 20.6 |
| `a11y()` | kontrolki, których czytnik ekranu nie umie nazwać |
| `relayGuard()` | czy strażnik przekaźnika GM-a w Daggerheart działa (`state: "ok"`) i czego odmówił w tej sesji |
| `rollFlags()` | rzuty graczy wylosowane w ostatniej półgodzinie (tak daleko, jak sięga Reroll), w których okno rzutu podało statystykę, doświadczenie, premię albo kości, jakich nie dała lista przeglądarki GM-a, która je wylosowała, albo pominęło premię lub kość przewagi, które ta lista dała, oraz rzuty, które czekały na statystykę, której żaden GM nie wybrał; o każdym takim rzucie GM-owie dostali szept, gdy go wylosowano, każdy policzono tak, jak daje lista, a linia może kończyć się tym, co GM policzył |
| `sheetWrites()` | zmiany, które przeglądarki graczy zrobiły na swoich uczniach w ostatniej dobie, a przeglądarka głównego GM-a cofnęła, zgłosiła albo wpisała na listę, albo zostawiła, bo miały pokrycie: kto i na którym uczniu, powód, który podała zmiana, każde pole przed i po, co zwrot wziął z wcześniej zapłaconego oraz jak i przez kogo rozstrzygnięto zgłoszoną zmianę; do tego wiersze `refused`, `forged` i `rewrite` (co odrzucono, sfałszowano albo cofnięto i ile razy) oraz przyrost z przekaźnika pokryty własnym rzutem gracza |
| `publicRoll(formula, { flavor })` | jedyny rzut, który czytają wszyscy, gdy rzuty są wymuszone jako prywatne, na przykład remis w głosowaniu albo loteria Monokumy; tylko dla GM-a i uruchamiany z makra, bo panel nie ma na niego kafelka |
| **Dziennik debugowania** w panelu (Diagnostyka) | narzędzie do zgłoszeń błędów: jego przycisk **Kopiuj do schowka** daje to, czego potrzebuje zgłoszenie błędu |

**Naprawy.** `resetAllActions()` dla zepsutego przejścia zegara, a także `ruleOnParkedMurder(killerId, true)`, `applyChapterEnd({...})`, `setMotive(null)`, `refreshMusic()`, `repaintFog()` i `resetAllVoice()`.

### 20.4 Umowa z Foundry, Daggerheart i modułami

Moduł sięga w wielu miejscach w kod, który nie jest jego: Foundry, Daggerheart i innych modułów. Każde takie miejsce jest wierszem jednego rejestru, a `diagnosePatches()` go wylicza. Przy każdym wczytaniu przeglądarka głównego GM-a odczytuje każdy wiersz jako *ok*, *nieudane* albo *nieznane*. Nieznane znaczy, że nic tu nie potrafiło tego stwierdzić, i jest ostrzeżeniem, nigdy zaliczeniem. Nic nie jest zapisywane do świata.

Gdy wiersz zawodzi, moduł robi to, co jego plik zawsze robił bez tego miejsca, a ty dostajesz jedno powiadomienie, które zostaje, dopóki go nie zamkniesz, z każdym zawodzącym miejscem, jego plikiem i funkcją oraz tym, co stół dostaje zamiast tego. Miejsce, które zawiedzie później w tym samym wczytaniu (pierwszy arkusz postaci, scena z piętrami otwarta później), dostaje własne powiadomienie, a żadne miejsce nie jest wymienione dwa razy w jednym wczytaniu. Część **Foundry i moduły** w oknie **Dziennik debugowania** (Diagnostyka) i raport pokazują te same linie. Wiersze strzegące zaufania (strażnik przekaźnika GM-a w Daggerheart, losowanie rzutu, to, co gracz może przeczytać o rzucie) mają własne komunikaty i własne rozwiązania zastępcze, a taki wiersz, gdy zawiedzie, nigdy nie łagodzi kontroli.

Żeby naprawić zawodzący wiersz, zaktualizuj Danganronpa RPG albo napisz autorowi modułu, jakich wersji Foundry i Daggerheart używasz, i dołącz raport (sekcja 20.1). Niektóre miejsca da się odczytać tylko przy stole (czas życia powiadomienia, wyciszenie i głośność klienta głosu); zostają *nieznane*, dopóki ktoś ich nie sprawdzi.

Powiadomienie podaje przy każdym miejscu, co stół dostaje zamiast tego, a cały rejestr, wiersz po wierszu, jest w sekcji 22.20.

### 20.5 Migracja danych i API makr

Migracja danych działa sama przy wczytaniu, w przeglądarce głównego GM-a, ilekroć zmieniła się zainstalowana wersja, a na świecie już aktualnym nic nie robi. Ręcznie to `game.drpg.migrate()`, a `game.drpg.migrate({ force: true })` uruchamia ją niezależnie od tego, czy wersja się zmieniła, i jest naprawą, gdy dane świata ewidentnie nie są aktualne. Uruchomiona drugi raz niczego nie zmienia. `game.drpg.migrationStatus()` mówi, co by zrobiła, i niczego nie zapisuje. `migrate1_2_0` to jej nazwa z aktualizacji 1.2.0, ta sama funkcja zachowana jako alias: wołaj `migrate()`.

**API makr.** Makro woła wszystko pod `game.drpg`, z argumentami aktora jak wyżej. Nazwa, która nie jest ani id, ani nazwą żadnego aktora, daje ostrzeżenie z nazwą wywołania i podanym słowem, a nazwa wspólna dwóm aktorom też ostrzega i działa na pierwszym. `tools/api-surface.json` w repozytorium modułu wylicza każdy klucz `game.drpg` z jego rodzajem, a test pilnuje, żeby żywy obiekt zgadzał się z tym plikiem. Klucz znika z `game.drpg` dopiero po co najmniej jednym wydaniu pod starą nazwą jako alias. Obecne aliasy podaje `tools/api-surface.json`; *bez terminu* znaczy, że nie wyznaczono wydania, w którym stara nazwa zniknie, a alias *bez terminu* zostaje, dopóki jakieś wydanie nie powie inaczej.

| Stara nazwa | Teraz | Zostaje do |
|---|---|---|
| `migrate1_2_0` | `migrate` | 1.3.1 |
| `advanceFloorNow` | `skipStep` | bez terminu |
| `extendFloor` | `adjustTime` | bez terminu |
| `endFloor` | `endMode` | bez terminu |
| `exportLedger` | `backupCase` | bez terminu |
| `importLedger` | `restoreCase` | bez terminu |
| `isSilenced` | `isCrimeSilenced` | bez terminu |
| `musicDialog` | `soundDialog` | bez terminu |
| `currentRoom` | `roomOfActor` | bez terminu |

### 20.6 Gdy stół laguje

Zmierz, zanim cokolwiek zmienisz, na komputerze GM-a i na najsłabszym komputerze gracza, i odeślij jeden blok z każdego komputera.

1. Zanotuj przeglądarkę i to, czy rysuje na karcie graficznej (`chrome://gpu`, „Canvas: Hardware accelerated”), rozmiar ekranu i powiększenie strony, *Performance Mode* i *Maximum Framerate* Foundry (ustawienia rdzenia), motyw, ilu graczy jest połączonych i ile tokenów i Remnantów stoi na scenie. DevTools -> Rendering -> „Frame Rendering Stats” pokazuje liczbę klatek na żywo.
2. Wszyscy stoją w miejscu, a jeden gracz stoi w pokoju i wszystko inne jest pod mgłą. W konsoli uruchom `await game.drpg.perf()`, potem `await game.drpg.fps({ toChat: false })`; raport `perf()` przychodzi do ciebie szeptem. Skopiuj to, co oba wywołania wypiszą.
3. W oknie ustawień zmieniaj po jednym ustawieniu i za każdym razem odczytuj liczbę klatek: wyłącz **Szkło rozmywa mapę** i **Puls szkła** (w sekcji **Efekty i dostępność**), wyłącz **Nazwa stanu za zegarem** (w sekcji **Wygląd**), włącz **Ograniczone animacje** (w sekcji **Efekty i dostępność**), a potem przełącz motyw na **Monokuma Legacy** (w sekcji **Wygląd**). Zanotuj liczbę przy każdym i przywróć każdy przełącznik.
4. Gdy inny gracz przechodzi przez trzy pokoje, uruchom `await game.drpg.whySlow()`, potem jeszcze raz `fps()`. `whySlow()` wypisuje tylko klatki dłuższe niż 50 ms, więc pusta lista przy niskiej liczbie klatek znaczy, że kosztuje rysowanie, poza skryptem modułu.
5. Na komputerze GM-a, przy największej liczbie postawionych Remnantów, powtórz krok 2: GM widzi każdy pierścień.
6. Głos: GM włącza **Szczegółowe logi w konsoli** (sekcja **Techniczne** w oknie zębatki, tylko u GM-a). Jeden gracz, w którego oknie nie ma ustawienia **Szczegółowe logi w konsoli**, wpisuje w konsoli `game.settings.set("danganronpa-rpg", "debug", true)`, a `false` wyłącza je z powrotem. GM i ten gracz ustawiają konsolę na Verbose. Po zerwaniu dźwięku skopiujcie każdą linię zaczynającą się od „Voice:” razem z godziną i napiszcie, czy ktoś przechodził przez drzwi albo stał w przejściu lub na korytarzu, czy trwało Eclipse i czy to samo konto było otwarte w drugim oknie. Na czas tej próby wyłącz proximity-voice-chat.

**Token przeciągany przez pokoje.** Gdy gracz przeciąga własny token przez pokój i do następnego, uruchom w tej samej chwili `await game.drpg.fps({ seconds: 5 })` w przeglądarce przeciągającego, w przeglądarce gracza, który tylko patrzy, i w swojej, a potem odeślij trzy wyniki z motywem, w którym każdy powstał. Czytaj linie opisane niżej oraz pracę modułu w czasie przeciągania: zmiany `refreshToken.*`, `visibility.applyAll.tokens`, `visibility.sightRefresh` i `visibility.myRooms.walk`. Liczby modułu w zestawie testów są liczone na modelu i nie są czasami klatek; tylko `fps()` przy stole mówi, czy przeciąganie idzie płynniej, więc niższej liczby nie bierz za wyższą liczbę klatek.

Nie wiadomo, czy lag przy przeciąganiu i migoczące krawędzie przycisków Stained Glass (kafelki panelu GM-a, przyciski w stopce) zniknęły; uwagi techniczne są w sekcji 22. Odeślij wynik `fps()` od przeciągającego, od patrzącego i z przeglądarki GM-a, a dla krawędzi, która nadal znika albo migocze, napisz, który to element, jaki był motyw, rozmiar ekranu i powiększenie strony, i dołącz zrzut ekranu.

**Jak czytać `fps()` i co wyłączyć.** Pierwsze linie to ekran, motyw i obserwowane okno czasu: policzone klatki, liczba klatek na sekundę, środkowa klatka i najwolniejsza dwudziesta część w milisekundach oraz ile klatek trwało ponad 33 ms (poniżej 30 na sekundę) i ponad 50 ms. Klatka przy 60 Hz ma 16,7 ms. *On the canvas now* liczy filtry stojące na mapie. Poświata pierścieni i obrysu pokoju jest rysowana raz i przechowywana jako obrazek (*Seams' light drawn once*), jeden na każdy kształt ramki, niezależnie od tego, ile tokenów go używa, a rozmycie w spoczynku wymienia z nazwy to, co nadal jest rysowane w każdej klatce. *Foundry's own filters* liczy filtry na mapie, które nie należą do modułu (widzenie, oświetlenie i maski Foundry, filtry innych modułów); `fps()` je odczytuje i nigdy ich nie wyłącza. *The module's work* to to, co moduł zrobił w tym oknie czasu, na sekundę: w spoczynku w motywie Stained Glass jest to sam puls szkła, a krok innego gracza dodaje jedno odświeżenie jego tokenu na każdego z czterech słuchaczy modułu (`refreshToken.*`) i żadnego dla pozostałych tokenów na scenie. *Each held alone* wyłącza jeden efekt na 60 klatek albo jedną sekundę, co skończy się pierwsze, i znowu mierzy klatki; poświatę obrysu i poświatę pierścieni wstrzymuje każdą dwa razy, jako żywy filtr i jako obrazek narysowany raz. Linia z największym *ms less* to efekt, który na tej maszynie kosztuje najwięcej, a linia *the canvas* to cała mapa: duża oszczędność na niej i mała gdzie indziej znaczy, że kosztuje własne rysowanie Foundry. Wyłączaj w tej kolejności, po jednym i tylko w tej przeglądarce, w oknie ustawień zębatki: najpierw **Szkło rozmywa mapę**, potem **Puls szkła** i **Nazwa stanu za zegarem**, potem włącz **Ograniczone animacje**, a na końcu wybierz motyw **Monokuma Legacy**. Dalej warto sprawdzić *Performance Mode* i *Maximum Framerate* Foundry oraz przyspieszenie sprzętowe przeglądarki. Dwa odczyty tego samego stanu na jednej maszynie różnią się o kilka milisekund: uruchom `fps()` dwa razy i czytaj oba wyniki razem.

### 20.7 Częste pułapki

| Objaw | Przyczyna i naprawa |
|---|---|
| *Gracze widzą czarny ekran.* | Scena ma pokoje, ale widzenie Foundry jest wciąż włączone; w oknie **Lista kontrolna sezonu** wiersz pokoi wymienia każdą taką scenę. Uruchom `prepareScenes()` w przeglądarce głównego GM-a: gdy **Pokoje decydują, co widzą gracze** jest włączone, przełącza ono od razu każdą scenę z pokojami na widzenie modułu. |
| *„Rano · ECLIPSE” i morderstwa są ciągle odrzucane.* | Zegar edytowano w trakcie Eclipse. Zakończ Eclipse przyciskiem odtwarzania na HUD. |
| *Nikt nie dostał akcji z powrotem.* | Akcje wracają, gdy Eclipse się otwiera, a nie gdy zegar się przesuwa. Dla granicy bez Eclipse użyj przycisku **Pomiń Eclipse** na panelu albo zaznacz **Odnów też akcje i Search Tokeny** w **Edytuj kampanię**. Nigdy nie używaj obu naraz. |
| *Search nigdy nie daje tego, co jest w moich tabelach.* | Moduł rozpoznaje pulę Tier po kategorii i Tierze, które zapisał na niej instalator albo zakładka **Pule Tier**, albo po nazwie w kształcie `DRPG <kategoria> - Tier n`: twórz ją na zakładce **Pule Tier** albo instaluj z edytora. Pule pokoi trzeba wskazać w oknie **Ustawienia pokoi**, a własne tabele pokoju mają pierwszeństwo przed pulami Tier. |
| *Przycisk Odtwórz nic nie robi.* | Nie ma playlisty o dokładnej nazwie „Situational”. Tworzy ją przycisk **Utwórz playlistę „Situational”** na zakładce **Odtwarzanie**. |
| *Cisza przez pierwsze minuty sesji.* | Przeglądarka nie została jeszcze kliknięta; `diagnoseSfx()` liczy, co porzucono. |
| *Panel mówi, że debata jest otwarta, a rozdział się skończył.* | Rozprawa trwa dalej, choć jej rozdział się skończył. Naciśnij **Zakończ Class Trial** w konsoli Class Trial; ekran końca rozdziału ma pole, które zakończy rozprawę za ciebie. |
| *Despair Call albo decyzja nic nie zrobiły.* | Przy dwóch GM-ach zapisuje główny. Sprawdź, który połączony pełny Gamemaster jest głównym (najniższe id użytkownika), i zajrzyj do okna **Dziennik debugowania**. |
| *Gracz dostaje wiadomość, że zmiana w Daggerheart nie została wykonana, bo tę zmianę gra zostawia GM-owi.* | Jego funkcja Daggerhearta poprosiła o coś, co ta gra zostawia GM-owi, na przykład obszar na mapie, nowe odliczanie albo Health innego ucznia. Ostrzeżenie na twoim ekranie mówi, o co poprosiła; zrób to ręcznie. |
| *Koszt Daggerhearta nie został naliczony graczowi, gdy GM przeładowywał stronę.* | Przy dwóch GM-ach zmiany Daggerhearta za graczy robi tylko główny, a zmiana wysłana w chwilach wokół jego przeładowania może przepaść. Ustaw ją ręcznie. |
| *Czat mówi, że Daggerheart poprosił o zmianę od nadawcy, którego Foundry nie wskazało.* | Każda taka zmiana jest odrzucana. Jeśli Hope, Sanity albo Fear graczy przestają się ruszać przy rzutach, to dlatego: daj znać autorowi modułu, z wynikiem `game.drpg.relayGuard()`. |
| *Zmiana gracza na jego arkuszu wróciła do poprzedniej wartości albo pyta o nią karta.* | Moduł nie zna niczego, co by ją pokrywało (sekcja 6.3); `game.drpg.sheetWrites()` pokazuje, co i dlaczego. Jeśli to była twoja decyzja, ustaw wartość samodzielnie: zmian GM-a nic nie ocenia. |
| *Drzwi zostają zamknięte po resecie sezonu.* | Reset przywraca kolumnę **Zamknięte na start** z zakładki **Drzwi**. |
| *Po aktualizacji na ekranie zostaje „migracja danych zatrzymała się w pół drogi”.* | Krok, który przenosi dane świata do magazynu GM-ów, nie mógł ich odczytać z powrotem (sekcja 1.5) i zostawił świat bez zmian. Szczegóły są w konsoli; przy następnym wczytaniu świata próba się powtarza, w przeglądarce głównego GM-a. |
| *Powiadomienie mówi, że coś, na czym Danganronpa RPG polega w Foundry, Daggerheart lub innym module, nie jest takie, jakiego ta wersja oczekuje.* | Przyczyna i naprawa są w umowie (sekcja 20.4): powiadomienie wymienia każde miejsce i to, co stół dostaje zamiast tego, a nic więcej nie przepada. Zaktualizuj moduł albo wyślij jego autorowi raport (`game.drpg.diagnose()`, potem **Kopiuj raport**). |
| *Stół nie widzi śmierci.* | Śmierć ofiary trwającego incydentu moduł wstrzymuje dla GM-ów, dopóki ciało nie zostanie znalezione (sekcja 13.4). Żeby śmierć stała się znana, ustaw ofiarę na **Nie żyje** w oknie **Uczniowie**. |

---

## 21. Lista kontrolna sesji

**Przed sesją**
- Otwórz **Ustawienia sezonu > Lista kontrolna sezonu**: każdy wiersz, który nie jest opcjonalny, powinien być zaptaszkowany, także wiersz pokoi (żadnej sceny z czarnym ekranem), a w dalszych sprawdzeniach pod wierszami nie powinno nic zostać (żadnego arkusza, który gracz może przeczytać).
- **Ustawienia pokoi**: sprawdź, czy sypialnie mają właścicieli, a drzwi są takie, jak trzeba, czy Rest jest dozwolony we właściwych pokojach, czy tabele Search oraz dobre i złe miejsca są ustawione i czy Search Tokeny są uzupełnione.
- **Despair Flow**: sprawdź, czy każdy uczeń jest pilnowany, a pule nazwane, i czy próg Overflow i efekty, z których Overflow losuje, są takie, jak chcesz.
- Sprawdź, czy tabele przedmiotów są zainstalowane, a w każdej torbie leżą przedmioty startowe.
- W oknie Dźwięk sprawdź, czy playlisty są przypisane (i czy istnieje „Situational”), czy pliki efektów są przypisane i czy głośność jest dobra w twojej przeglądarce.
- Przeczytaj notatki przed sesją w komunikatorze. Potwierdź safeword ze stołem.
- Jeśli w tej sesji morderstwo jest prawdopodobne, naszkicuj plan Key Remnantów; jeśli rozdział potrzebuje Final Truth Remnantu, postaw go.
- Sprawdź zegar: właściwy rozdział, dzień, sesja, pora dnia i faza.

**Każda pora dnia**
- Obserwuj linię **Dalej** i **Zostały akcje** na swoim pasku stanu: widać tam, kto ma jeszcze akcje.
- Szybko rozstrzygaj karty w komunikatorze: Experience, Ultimate, Dynamic Actions, propozycje, cele Observe, przerobione Remnanty, zgłoszenia Direct Murder i alarmy pułapek.
- Gdy wszyscy skończą, zacznij Eclipse, co odnawia akcje, pozwól graczom się ustawić i zakończ Eclipse, co przesuwa zegar. Gdy zapalą się światła, rozstrzygnij czekające zgłoszenia morderstw.
- Wydawaj Despair jak Monokuma: stół poznaje każdy Despair Call poza Bounty.

**Gdy trwa morderstwo**
- Doprowadź incydent do końca, zanim zrobisz cokolwiek innego. Dokończ prozę, którą podają ci karty.
- Pozwól zabójcy sprzątać, dopóki scena jest ciepła. Postaw pozostałe Key Remnanty (ekran po incydencie je liczy).
- Gdy ciało zostanie znalezione, wybierz, które Faint Remnanty należą do sprawy, rozpocznij Investigation, gdy pokój będzie gotowy, i wydaj sekcję zwłok.

**Investigation**
- Trzymaj otwarte okno **Investigation** na Remnantach, na tym, ile z postawionych Key Remnantów znaleziono, i na **Kto co ma**. Celuj w krąg od 2 do 4 podejrzanych.
- Dawaj wskazówki, które należą się za krytyki. Zacznij rozprawę, gdy klasa jest gotowa, wiedząc, ile wyniesie opłata za Key Remnanty.

**Class Trial**
- Start, dyskusja, debaty otwierane wedle potrzeby i zamykane; głosowanie, przypomnienie spóźnialskim, liczenie; werdykt; Level Upy; koniec rozdziału.

**Po**
- Po rozprawie koniec rozdziału: ujawnij, zbierz, wyczyść, następny rozdział, następna sesja, następny ranek.
- Po sesji **Zrób kopię** sprawy (panel GM-a, **Diagnostyka**, **Sprawa**) i trzymaj plik tam, gdzie żaden gracz go nie otworzy: klucze odpowiedzi, Remnanty, Mastermind, budujący pułapki i ich wyzwalacze, plan Key Remnantów, notatki i śmierci, których nikt nie znalazł, są przechowywane tylko w przeglądarkach GM-ów.
- Skopiuj Dziennik debugowania, jeśli coś nie działało. Zapisz, czego potrzebuje następny rozdział.

---

## 22. Dodatek: uwagi techniczne

Dodatek zbiera to, czego sekcje powyżej nie mówią czytelnikowi przy stole: pliki i funkcje stojące za regułą, konsolę, to, co przechowuje każda przeglądarka, i to, kiedy reguła się zmieniła. Każda część podaje sekcję, do której należy.

### 22.0 Przed sekcją 1

Plik reguł, o którym mówi notka na początku, to `scripts/config.mjs`. Kilka liczb jest zdefiniowanych obok kodu, który je stosuje: 4 kroki w 10 sekund z notki o Fear to `FEAR_STEPS_NOTED` i `RECENT_MS` w `scripts/relay-guard.mjs`, a budżety historii powiadomień to `BUDGET` w `scripts/notice-history.mjs`.

### 22.1 Instalacja i zależności

**Wymagane moduły.** Lista wymaganych modułów to `relationships.requires` w `module.json`; czyta ją też okno modułów samego Foundry, a `scripts/requirements.mjs` odczytuje ją z powrotem. Powody w oknie to `DRPG.Requirements.reason.<id>` w plikach językowych. Okno mówi językiem modułu zapisanym w tej przeglądarce; gdy go nie ma, językiem Foundry, jeśli moduł go dostarcza, a w przeciwnym razie po angielsku. Moduł, który nie wystartował, zdejmuje też ze strony własne arkusze stylów (`removeModuleStyles`) i dlatego pasek skrótów, nawigacja scen i lista graczy stoją tam, gdzie rysuje je Foundry.

**Nowszy Daggerheart.** `announceNewerSystem` (`scripts/requirements.mjs`) ostrzega każdego GM-a przy każdym wczytaniu, dopóki system jest nowszy niż sprawdzona wersja, i uruchamia próbę łatek, żeby okno wymieniło miejsce, które moduł zmienia albo na którym polega, a którego nie znaleziono. Pole *Nie wspominaj o ... więcej na tym komputerze* ucisza ostrzeżenie dla tej wersji w tej przeglądarce (ustawienie klienta `systemWarningSilenced`), a **Pokaż znowu** w części Silenced warnings raportu diagnostycznego to cofa.

**Linia Dalej.** Linię buduje `scripts/gm-panel.mjs`. Pierwszy wiersz do zrobienia to `firstOutstandingStep` (`scripts/season-setup.mjs`), który pomija wiersze opcjonalne i te, których moduł nie może dokończyć. Sezon liczy się jako rozpoczęty (`seasonUnderway`), gdy zegar opuści pierwszą porę dnia swojego pierwszego dnia albo gdy granica odnowi uczniów; `refilledFor` zapisuje pierwsze Eclipse. **Od czego zacząć** pokazuje się raz w każdej przeglądarce, a pilnuje tego ustawienie klienta `startHereShown`.

**Co moduł wymusza.** Wymuszane ustawienia to `ENFORCED` i `FOUNDRY_WRITES` w `scripts/enforced.mjs`. Wygląd kości to dwa ustawienia świata czytane razem przez `diceLookChoice` w `settings.mjs`: `forceDiceLook` jest włączone albo wyłączone, a wyłączone znaczy własny wygląd każdego gracza, zaś `diceLookKind` mówi, który wygląd, domyślnie `dsn`. To, czyj jest wygląd, ustala `diceLookSource` (`scripts/dice-look.mjs`, `scripts/dice-sync.mjs`). Historia wersji: wygląd Hope i Despair na Daggerheart 2.9 i starszym jest od 1.2.98; trzy wybory, *Wszyscy: Daggerheart* i własne kolory Daggerhearta na 2.10 i nowszym są od 1.2.112, a w 1.2.112 dawny przełącznik świata stał się wyborem Dice So Nice (włączony) albo własnym wyglądem każdego gracza (wyłączony); wyglądy Gamemastera z Dice Roles w Dice So Nice i powrót wyglądu wybranego dla roli do wyglądu tej roli przyszły w składanej wersji 1.2.113. Wygląd, który wciąż od razu zmienia się z powrotem, zostaje taki, jaki jest, przez minutę (`FUSE_WINDOW_MS`, 60000 ms), a potem jest cofany przy najbliższej zmianie albo przy najbliższym rzucie; pierwszy rzut po tej minucie jeszcze go pokazuje, a główny GM dostaje o tym wiadomość raz.

**Konta graczy.** Dopasowuje je `scripts/user-match.mjs`, od 1.2.79. Dopasowywane są tylko konta graczy (Gracz albo Zaufany gracz), nigdy konto GM-a ani Asystenta GM-a. Dopasowuje przeglądarka głównego GM-a: przy swoim starcie, gdy użytkownik się połączy i gdy powstanie albo zmieni nazwę użytkownik lub uczeń. Ucznia dwóch graczy moduł obsługuje od 1.2.83; odczytano to w kodzie i w harnessie, a współwłaściciel i obserwator przy prawdziwym stole nie są zmierzeni (S01-33).

**Aktualizacja z wersji sprzed 1.2.63.** Dwie wersje przeniosły to, co wolno wiedzieć tylko GM-om, z danych świata do magazynu trzymanego osobno dla każdego świata w przeglądarce każdego GM-a: 1.2.63 sprawę (sekcja 14), a 1.2.64 kolejne rzeczy znane tylko GM-om (niżej). 1.2.63 czyta magazyn, który wcześniejsze wersje trzymały w przeglądarce, i nigdy go nie zapisuje. Jeśli chcesz mieć też kopię danych samej przeglądarki, otwórz świat w przeglądarce każdego GM-a i wklej poniższy kod do konsoli (F12): zapisuje do jednego pliku każdy klucz `danganronpa-rpg.` tej przeglądarki i zwraca, ile ich zapisał. Ten plik zawiera każdy klucz odpowiedzi, który ta przeglądarka trzyma, ze wszystkich światów, które otwierała: trzymaj go tam, gdzie żaden gracz go nie otworzy, jak kopię sprawy.

```
(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith("danganronpa-rpg.")) o[k] = localStorage.getItem(k); } foundry.utils.saveDataToFile(JSON.stringify(o), "application/json", `drpg-browser-${game.world.id}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`); return Object.keys(o).length; })()
```

Świat skopiowany przed aktualizacją otwiera się z tą samą sprawą co oryginał w przeglądarce, która grała w oba, bo stary magazyn w przeglądarce nie mówił, którego świata jest; każda kopia bierze więc wiersze pasujące do jej własnych aktorów, scen i przedmiotów. Od pierwszego wczytania każdy świat trzyma już swoją. Nie sprawdzono jeszcze przy stole, czy Duplicate World w Foundry nadaje kopii własny identyfikator świata ani od czego to zależy.

**Aktualizacja z wersji sprzed 1.2.64.** 1.2.64 wyjmuje z danych świata kolejne rzeczy, które wolno znać tylko GM-om, i przenosi je do tego samego magazynu: kto buduje każdą pułapkę, co ją uruchamia i kto sabotował projekt; zgłoszenia Direct Murder złożone w ciemności i przejścia trwającego Eclipse; plan Key Remnantów; notatki graczy przed sesją; to, jak doszło do trwającego incydentu; licznik Overflow; to, co zabrano z każdego ciała; i to, z którego Remnantu pochodzi każdy Truth Bullet. Usuwa z danych świata zakładkę Rerolla i fakty z karty Search, przywraca neutralną nazwę i neutralny obrazek na tokenach Remnantów, które wcześniejsze wersje nazwały, i przenosi do sprawy klucze odpowiedzi, które wciąż zostały na tokenach starych Remnantów. Dzieje się to raz, w przeglądarce głównego GM-a, chwilę po pierwszym wczytaniu 1.2.64.

**Prośby z przeglądarek graczy.** Odmowa prośby gracza trafia do dziennika w przeglądarce głównego GM-a. Kilka odmów trafia tylko do dziennika i nikt się o nich nie dowiaduje, bo nikt na nie nie czeka: wśród nich zgłoszenie dla pułapek, dopytanie o oferty Level Up i szukanie podłożonego przedmiotu przy Search. Prośba Daggerhearta rodzaju, którego moduł w ogóle nie zna, jest odnotowana bez nazwy. Od 1.2.67 kości akcji gracza i statystyki klikniętej na arkuszu rzuca przeglądarka głównego GM-a, od 1.2.68 to, co rzut dodaje, ustala ona sama, i również od 1.2.68 zmianę, którą przeglądarka gracza robi na jego własnym uczniu, sprawdza przeglądarka głównego GM-a. `game.drpg.rollFlags()` wymienia to, co okno rzutu dołożyło, a czego nie policzono; od 1.2.69 nazywa tam też kość, którą okno pokazuje o innych ściankach, w innej liczbie albo z własnym modyfikatorem, a takiej kości nigdy się nie rzuca. Od 1.2.69 przeglądarka GM-a zapisuje trzy rodzaje wierszy (`refused`, `forged` i `rewrite`), które `game.drpg.sheetWrites()` wymienia obok zapisów. Wiadomości, którą przeglądarka gracza napisała z flagą, jaką pisze tylko przeglądarka GM-a, żadna przeglądarka nie czyta jako rzutu losowanego; nigdy nie jest przyznana ani nie jest rzutem Rerolla.

**Co przechowuje każda przeglądarka.** Od 1.2.111 obrazkiem na tokenie projektu jest ikona projektu w zasobniku, także u tajnego projektu. Wybór przyjęto 13.11.2026: ikona i tak jest w danych świata o projektach, więc token nie dodaje nowej informacji, tylko drugie miejsce, z którego da się ją odczytać.

Lista niżej podaje szczegółowo, co czat wciąż mówi od 1.2.65, i na ile każdą rzecz zmierzono.

- Zasłanianie zmierzono w harnessie testowym dla przedmiotu użytego w walce, Calla kupionego dla uczestnika i kart postronnego.
- **Kto utworzył rzut albo kartę.** Foundry zapisuje w dokumencie rzutu i karty użytkownika, którego przeglądarka go stworzyła. Od 1.2.67 rzut gracza (akcji, a także statystyki klikniętej na arkuszu) rzuca przeglądarka głównego GM-a i to ona pisze jego wiadomość: w harnessie testowym przeglądarka postronnego trzyma rzut otwarcia zabójcy z GM-em jako autorem. Rzucający nadal widzi rzut jako swój: jego kości spadają na jego ekranie w jego wyglądzie (przy jednym wyglądzie dla stołu w wyglądzie tego jednego pełnego Gamemastera, w którym rzucają wszyscy gracze, a przy własnym wyglądzie każdego gracza w jego własnych kolorach), bez Dice So Nice gra zamiast tego dźwięk kości, a rzucający czyta wynik. GM widzi kości w tym samym wyglądzie, póki w pokoju rzucającego stoi któryś z Monokum tego GM-a (od 1.2.98); Monokuma, którego GM-a nie da się wskazać, nie wpuszcza nikogo, a nie da się go wskazać, gdy jest kilku pełnych Gamemasterów, nie ustawiono puli i żaden z nich nie jest jedynym wskazanym właścicielem. Kartę czyta każdy GM tak czy inaczej. Uczestnicy incydentu widzą każdy rzut incydentu, a nikt inny nic z niego. Zmierzone na modelu Dice So Nice w harnessie testowym, nie przy stole.
- **Rzut bez połączonego GM-a.** Rzut wykonany, gdy nie jest połączony żaden GM, albo na Daggerheart, którego rzutów moduł nie losuje, rzuca przeglądarka gracza i taki rzut nazywa tego gracza jak dawniej; o Daggerheart, którego rzutów moduł nie losuje, dostajesz informację raz na wersję. Gdy nie jest połączony żaden GM, akcja jest odrzucana, zanim gracz za nią zapłaci, a każdy inny rzut dostaje znacznik i niczego nie rusza, dopóki GM go nie przyzna (sekcja 6, główny GM).
- **Prywatna karta w trakcie incydentu.** Prywatną kartę, którą przeglądarka gracza wystawiłaby w trakcie incydentu, wystawia na jej prośbę przeglądarka głównego GM-a, więc i jej autorem jest GM: w harnessie testowym przeglądarka postronnego trzyma karty walki (użyty przedmiot, zepsute narzędzie) i wiadomość gracza do GM-a z GM-em jako autorem. Gdy nie jest połączony żaden GM, karta nie zostaje wystawiona, a gracz dostaje informację, że żaden GM nie jest połączony. Każda inna karta, którą wystawia przeglądarka gracza, zasłonięta czy nie, ma autora ustawionego tak samo; to reguła Foundry, niemierzona karta po karcie.
- **Zasłonięta karta i szept do GM-ów.** Zmierzono je dla pokwitowania pułapki: przeglądarka postronnego trzyma je jako kartę bez wątku i bez gracza, bez jej słów.
- **Formuła rzutu.** Odczytana w kodzie, niezmierzona.
- **Własny reroll Daggerhearta** od 1.2.67 znika z menu czatu gracza. Kości, które przeglądarka gracza i tak przepisze (własnym rerollem Daggerhearta na karcie albo z konsoli), przeglądarka głównego GM-a przywraca, a GM-owie dostają o tym wiadomość, raz na wiadomość i gracza (odczytane z kodu); wiersz `rewrite` w `game.drpg.sheetWrites()` mówi, kto przepisał. Przepisanie z konsoli zmierzono w harnessie testowym, menu i rerolla na karcie nie, bo harness nie uruchamia logu czatu Daggerhearta. Rzutu rzuconego, zanim wczytała się przeglądarka głównego GM-a, nie da się przywrócić, można o nim tylko powiedzieć, a kości 3D takiego przepisania mogą jeszcze spaść na każdym ekranie, zanim zostanie cofnięte (niemierzone). Reroll modułu pokazuje swoje kości tylko rzucającemu, GM-om i, w walce incydentu, jej uczestnikom.
- **Aktywność użytkownika w Foundry**: to sprawa samego Foundry, niemierzona tutaj.
- **Statystyka kliknięta na arkuszu** na twoją prośbę zachowuje kartę Daggerhearta, którą pisze przeglądarka GM-a: karta nikogo nie nazywa i idzie szeptem do GM-ów, a poza nimi czytać ją może tylko przeglądarka rzucającego (zmierzone w harnessie testowym). Wszędzie, gdzie się ją czyta, jej nagłówek pokazuje postać rzucającego, jej portret i imię; w przeglądarce, która nie wie już, czyj to był rzut (po przeładowaniu), nikogo, a nigdy GM-a. Nagłówek zmierzono na modelu nagłówka Daggerhearta w harnessie testowym, nie przy stole.
- **Rzut, którego moduł nie rzucił**, czyli własne rzuty przedmiotów Daggerhearta, zachowuje kartę Daggerhearta i jej nadawcę i idzie szeptem do GM-ów i gracza tej postaci (odczytane w kodzie, niemierzone).
- Meddle Monocuba od 1.2.67 rzuca przeglądarka GM-a, gdy już sprawdzi cel. Karta Meddle jest kartą modułu, wystawioną przez przeglądarkę gracza Monocuba w imieniu Monocuba, i widzi ją pokój, jak każdy rzut Monocuba. Meddle, którego przeglądarka GM-a odmówi, niczego nie rzuca i nie wystawia karty, a gracz Monocuba dowiaduje się, że go odrzucono (odczytane w kodzie; odmowa zmierzona w harnessie testowym).
- **Log czatu zapisany przed 1.2.65, którego nie mogło przepisać jego pierwsze wczytanie.** Pierwsze wczytanie 1.2.65 przepisuje stare rzuty i prywatne karty modułu tak, jak pisze się je dziś. To, co dziś jest zasłonięte, zostaje zasłonięte (pokwitowania pułapki, karta przerobionego Remnantu, karty Confusion, informacja o Loaded Die, zużyte albo zepsute narzędzie, pokwitowanie Hope Calla, pora dnia ogłoszona w czasie incydentu), a lista rzutu traci pozostałych graczy incydentu. Przepisanie zostawia szept, który ma słowa w swoim dokumencie (szepty modułu sprzed czasu, gdy trzymał prywatne słowa poza dokumentem, i każdy szept, który nie jest modułu), publiczną kartę 1.2.64 o końcu naprawy tajnego projektu, starą kartę zasłanianego rodzaju rozpoznawaną tylko po słowach, gdy przeglądarka głównego GM-a już ich nie trzyma albo trzyma je w innym języku, rzut Monocuba oraz pozostałe prywatne karty wystawione w czasie incydentu (przedmiot użyty w walce, Call uzbrojony na uczestniku), dziś zasłaniane dlatego, że trwa incydent, a stara karta nie zapisuje, czy trwał. Zasłonięta karta wątku zachowuje miejsce w wątku tylko w przeglądarkach połączonych przy tym wczytaniu; gdzie indziej jej słowa zostają w logu czatu. Zmierzone w harnessie testowym dla pokwitowania, karty Confusion i rzutu z walki, nie na logu prawdziwego świata.

### 22.2 Lista kontrolna sezonu

Ustawienia sezonu i Lista kontrolna sezonu to `scripts/season-setup.mjs` (`openSeasonSetup`, `openSeasonChecklist`), a wiersze to `steps()`. Pola Edytuj kampanię i to, co zapisuje ich Zastosuj, to `campaignRows` i `applyCampaignForm` w `gm-campaign.mjs`; uruchamia je też Zapisz w Ustawieniach sezonu.

Od E101 Lista kontrolna sezonu mieści to, co mieściła Kontrola przed sezonem, której przycisk do E101 stał pod wierszami. Części tego raportu o obsadzie i scenach stały się wierszami (postaci bez gracza to wiersz `npcs`, widzenie Foundry na scenie to wiersz `rooms`), a umowa raportu z Foundry i linia konsoli o wyglądzie kości przeszły do **Foundry i moduły** w Dzienniku debugowania (`openFoundryReport`). Wiersz Pliki dźwiękowe zniknął w E101, punkt 2. Od E101 F4 okno kafelka otwiera się przed Ustawieniami sezonu i ich nie zamyka.

Zakres rozdziału to `CHAPTERS_PER_SEASON` w `config.mjs` (6), a domyślną wartość safeword podaje `DEFAULT_SAFEWORD` w `settings.mjs`. Liczby startowe to `STARTING` w `config.mjs` (Health 4, Sanity 6, Hope 2 z 6, 2 doświadczenia po +2, `startingItemTier` 2), a rozkład statystyk to `TRAIT_ARRAY`. **Nadaj zasoby startowe** uruchamia `initCharacter` dla każdego ucznia, którego maksymalne Health albo maksymalne Sanity jest niższe niż w `STARTING` (`needsStartingResources` w `character.mjs`), więc maksimum podniesione przez Level Up zostaje nietknięte.

**Otwórz** w wierszu *Co najmniej jeden Monokuma* otwiera od E101, punkt 6, okno Uczniowie; do tego czasu ustawiało Monokumę przez Despair Flow. **Oznacz jako Monokumę** stoi od 1.2.101 w nagłówku arkusza postaci i nie ma go już w menu listy aktorów. *Każdy ma Ultimate* czyta flagę Ultimate, a *Każdy coś nosi* liczy `carriableCategories()` z `inventory.mjs`.

*Każdego ucznia pilnuje Monokuma* pyta o każdy przydział z osobna (`explicitPool`). Podział Despair Flow to ustawienie świata, które czyta przeglądarka każdego gracza, i dlatego jedyny uczeń ustawiony na „- nikt -” rzuca się w oczy. *Mastermind zasila pulę Despair* jest rysowany jako krzyżyk tylko wtedy, gdy zachodzi `mastermindUnpooled()` z `mastermind.mjs`, a sprawdzenie sprawy (`game.drpg.gmStoreHealth()`, `game.drpg.diagnoseGmStores()`) też wymienia wiersz Masterminda.

Sugestia progu Overflow to `overflowSuggestion` w `overflow.mjs`: 12 plus połowa żyjących uczniów, zaokrąglone i ograniczone do `OVERFLOW.range` (od 6 do 60); domyślny próg to `OVERFLOW.threshold`. *Dość pokoi dla obsady* to `roomCensus` z `vault-store.mjs` wobec `roomsWantedFor`, czyli liczby żyjących uczniów razy `ROOMS_PER_PLAYER` (1,5), zaokrąglonej w górę. **To jest pokój** i **Bez prywatności** są od E101, punkt 4, kolumnami zakładki Pokoje w Ustawieniach pokoi; do tego czasu stały na zakładce Drzwi.

*Mapa ma pokoje*: granica to `UNCOVERED_LIMIT_PCT` (10), czytana na najgorszym piętrze sceny o kilku piętrach. Błędy ostatniego **Sprawdź pokoje na tej scenie** ta przeglądarka trzyma do przeładowania, a scena, której nigdy nie sprawdzono, nie ma zapisanych błędów. Widzenie Foundry to `sceneVisionReady` z `fog.mjs` (od E101, punkt 2). Na scenie, która nie jest mapą z pokojami, wiersze czytają szkołę (`homeScene` z `rooms.mjs`). *O każdym nazwanym regionie zdecydowano: pokój albo nie* czyta `unmarkedRegions` z `rooms.mjs`; od 1.2.74 region jest pokojem tylko wtedy, gdy oznaczył go GM.

*Kursor GM-a jest prywatny*: **Ukryj kursor GM-ów** zabiera dwóm rolom GM-a uprawnienie core `SHOW_CURSOR`, odczytywane tak, jak Foundry stosuje swoje uprawnienia. *Sekret serwera głosu* to `liveKitSecretWarning` z `voice.mjs`, a `game.drpg.diagnoseVoice()` mówi to samo; ten wiersz jest `external`, więc `firstOutstandingStep` na niego nie czeka.

Wiersze Pierwszej sesji to grupa `FIRST_SESSION`. Wiersz sali wchłonął w E101, punkt 2, wiersz *Sala rozpraw i jej tokeny*, a bez podpiętej sceny rozprawa odbywa się tam, gdzie jest stół, jak przed 1.2.74. Wiersz ustawień Foundry jest rysowany tylko wtedy, gdy zachodzi `foundryGivenBack()` z `enforced.mjs`. **Otwórz** przy Dice So Nice jest proponowane tylko tam, gdzie ten Foundry ma `foundry.applications.sidebar.apps.ModuleManagement`. Wiersz Dice So Nice ma ptaszek, gdy `dice-so-nice` jest aktywny (`diceSoNice` w `season-setup.mjs`), a skoro `module.json` wymaga `dice-so-nice`, a `requirementsMet` zatrzymuje moduł bez niego, ten wiersz może mieć tylko ptaszek, póki moduł działa.

Granice zdjęć pokoi to `ROOM_IMAGE_LIMITS` w `config.mjs` (4096 px na boku, 8 MB i 8 s na wczytanie zdjęcia, `probeMs`). **Otwórz wygląd kości** uruchamia `diagnoseDiceLook()` (od 1.2.98).

### 22.3 Panel GM-a

Panel to `scripts/gm-panel.mjs`, okno Uczniowie `gm-students.mjs`, a Edytuj kampanię `gm-campaign.mjs`. Liczbę w stanie gry daje `actingStudents` z `monokuma.mjs`. Tabela żyjącej obsady, która stała w stanie gry, to od E49 A2 dwie kolumny okna Uczniowie.

Linia Dalej to `nextStep` w `gm-panel.mjs`, jej przyciski to `NEXT_GO`, a kroki, które nie są kafelkami, to `EXTRA_ACTIONS`. To, czy sezon ruszył, mówi `seasonUnderway`. Wiersz, który nazywa linia Dalej, to `firstOutstandingStep` z `season-setup.mjs`, oceniany na szkole (`homeScene`). Ciało znalezione przez dwóch świadków, które czeka na twoje słowo, jest krokiem od 1.2.113.

**Pomiń Eclipse** uruchamia `nextTimeOfDay` z `boundary.mjs`, a potem `advanceTimeOfDay({ resetActions: true })` z `clock.mjs`; od E49 A3 stoi w każdej fazie (`advanceHtml`). Podsumowanie pory dnia otwiera się też dla konsolowych `game.drpg.setTimeOfDay` i `advanceTimeOfDay` (`summaryWindow` w `day-summary.mjs`).

Kafelek Morderstwo otwiera tracker incydentu podczas Eclipse od E47-C3. Kafelek Ustawienia gry czyta uprawnienie Foundry `SETTINGS_MODIFY`. **Napraw głos** to `resetAllVoice` z `voice.mjs`, uruchamiane w przeglądarce głównego GM-a. **Foundry i moduły** jest od E101 przyciskiem Dziennika debugowania: to `openFoundryReport` z `season-setup.mjs`, a jego umowa to `runContract` z `patches.mjs`; od E101 mówi też, jak odczytać wygląd kości w innej przeglądarce.

W oknie Uczniowie lista **Stan** zapisuje same flagi stanu, a kolumna **Zrób** wykonuje prawdziwy krok. Widzowie są od E92 C1 osobną grupą w oknie Uczniowie, a przyciski arkusza i Przedmioty od E92 własną kolumną. **Zwróć ostatnie przejście** (E17 C3) czyta `crossingStore` GM-ów, a zwrot wykonuje główny GM. **Wycisz teraz** (E72 C8) to `silenceDeadNow` z `incident-store.mjs`.

### 22.4 Zegar

Zegar to `scripts/clock.mjs`, pory dnia to `TIMES_OF_DAY` w `config.mjs`, a fazy to `PHASES`. Zmiana pory dnia to `applyTimeOfDayChange`, w kolejności z sekcji 4. Moduł odnawia granicę raz (`refilledFor`). Notka o Wounded to `DRPG.Clock.woundedNote`, szeptana GM-om razem z kartą pory dnia.

Cofnięcie to `rewindTimeOfDay`. Jest odrzucane, gdy trwa Eclipse, bo Eclipse stoi przed następną porą dnia i nie ma się do czego cofać. To, co dała granica, jest przechowywane przez `TAKE_BACK_MS` (5 minut) i najwyżej `TAKE_BACK_DEPTH` (4) granic wstecz. Pięć minut to liczba z projektu, przy stole jeszcze niesprawdzona.

Edytuj kampanię to też osobne okno, otwierane z konsoli (`game.drpg.editClock()`, `openClockDialog` z `gm-campaign.mjs`), z **Zastosuj** w miejscu Zapisz. To, czy zmiana odwołuje zgromadzenie, rozstrzyga `correctsTheHour`.

Progi HUD to `TIMING.elapsedMarksMinutes` (15 i 30). Minuty są dokładne co do minuty, bo przeglądarka głównego GM-a notuje czas co minutę, póki gra idzie (`CLOCK_BEAT_MS`, `beatClock` w `hud-elapsed.mjs`). Ta notatka jest zapisana w przeglądarce głównego GM-a i dlatego inny komputer albo przeglądarka z wyczyszczonymi danymi liczy od ostatniej zmiany zegara. Przez dwie sesje przy stole jeszcze niesprawdzone: LIVE-E17-01.

Pasek utworu pod liniami zegara zostaje na swoim miejscu z muzyką i bez niej (jako pusta linia, gdy ta przeglądarka niczego nie gra), więc start i koniec utworu nie zmieniają ani wysokości zegara, ani cięcia kurtyny. Od 1.2.101, zmierzone w przeglądarce, jeszcze nie przy stole: LIVE-E23-02, LIVE-E23-09. Od 1.2.101 licznik *Zostały akcje* znika, gdy trwa incydent, a panel zdarzeń ma jeden rozmiar.

Obroty zegara i plansze dnia są od 1.2.109. Numer dnia i sesja zmieniają się na końcu porannego Eclipse jak dotąd. Jeszcze niesprawdzone przy stole: czas klatki plansz z Dice So Nice i kurtyną (LIVE-E94-01), gracz dołączający w środku dnia (LIVE-E94-02), plansze w trakcie trwającego incydentu (LIVE-E94-03) i kierunki obrotów na prawdziwym v14 (LIVE-E62-01).

### 22.5 Akcje i budżety

Źródła: `ACTIONS`, `ACTION_GRID` (kolejność kafelków), `STARTING`, `STATES`, `INFILTRATE`, `REST`, `SABOTAGE_CONCEAL`, `DYNAMIC_THRESHOLDS`, `CRITICAL`, `OBSERVE_DC`, `OBSERVE_FAIL_STRESS`, `ANALYZE_DC`, `PRICE_CHAINS` i `TIMING` w `config.mjs`; `scripts/actions.mjs`.

Budżet to `STARTING.actions` (2). Akcję traconą przez Wounded zabiera się tylko w fazach, które wymienia `STATES.wounded.actionsLostIn` (`dailyLife`, `investigation`), a odczytuje ją `actionBudget` z `actions.mjs` z fazy zegara; stan Wounded, jego plakietka i ikona zostają w każdej fazie. Monocub nie traci akcji przez ranę (`actionBudget` czyta `FLAGS.monocub`). Panic to stan paniki z Overflow (`by: 1`, `floor: 1`), a jego dolna granica 1 obowiązuje tylko wtedy, gdy trwa zaciemnienie. Budżet jest wyliczany, nigdy przechowywany: `resetActionsFor` zapisuje budżet i jego maksimum przy każdym odnowieniu, więc leczenie w ciągu dnia widać dopiero przy następnym odnowieniu. Kolejność, w jakiej płaci się cenę, to `spendAction` i `takeMove` z `nextCrossingPrice` w `actions.mjs` (Free Move, zbankowane przejście, Burst, akcja; D113). Zbankowany Burst (`FLAGS.freeActionGrants`) pokrywa jedno całe użycie, zanim pójdzie jakakolwiek akcja.

Liczby Search to `ACTIONS.search.thresholds` i `critical.tierBonus` (`searchTier` w `action-search.mjs`). DC Observe to `OBSERVE_DC`, a porażka Observe to `OBSERVE_FAIL_STRESS` (1 Sanity). DC Analyze to `ANALYZE_DC`; dalsze liczby Analyze to `hintThresholds`, `stashThreshold` i `passageThreshold`, a cena Analyze w rozprawie to `PRICE_CHAINS.analyze` (akcja, potem 1 Hope, potem 1 Sanity), której kroki po pierwszym obowiązują tylko w Class Trial. Liczby Palm to `ACTIONS.palm` (`threshold`, `unseen`, `plant`, `frisk`, `rummage`), a zegary Frisk to `TIMING.friskAnswerMs` (60 s) i `TIMING.friskForceMs` (30 s). Podłożenie do pełnych kieszeni jest próbą i zostaje zapłacone (`palm.mjs`, D42; D091). Cena Tamper to `PRICE_CHAINS.tamper` z `tamperPriceSkip` w `cleanup.mjs`. Wiersze Infiltrate to `INFILTRATE`, liczby projektów `ACTIONS.project`, a liczby Sabotage `ACTIONS.sabotage` (`simpleRepair` 2), z ukrywaniem `SABOTAGE_CONCEAL` (Shadow 16, `despairPenalty` -1). Pasma Dynamic to `DYNAMIC_THRESHOLDS`, odpoczynki `REST`, a Hope za krytyk `CRITICAL.hope` (2).

Propozycja statystyki to `trait-ruling.mjs`, a **Statystyki graczy bez zatwierdzania** to ustawienie świata `autoApproveTraits`.

Uszkodzenie z Sabotage nakłada klient GM-a. Gdy żaden GM nie potwierdzi na czas, wynik rzutu zostaje, ale projekt może nie zostać uszkodzony.

Od 1.2.101 zapas na arkuszu postaci: `reserveView` z `character.mjs` to jeden pomocnik, który czytają arkusz, panel zdarzeń, tracker, paski tokenu i arkusz drużyny, a rysuje go `sheet.mjs`. Pole zapasu zapisuje to, co ubyło, `max - n`. Przy wyłączonym *Zablokuj graczom zasoby na arkuszu* audyt GM-ów traktuje to, co wpisze gracz, jak każdą jego zmianę Health albo Sanity: leczenie trafia na listę w `game.drpg.sheetWrites()` i zostaje, a rana zostaje bez wiersza (sekcja 6.3). Sprawdzenia przy stole: kropki rysowane tak samo przy włączonych i wyłączonych kropkach Daggerhearta (LIVE-E24-02), dwa pola HUD tokenu wyłączone dla wszystkich, odczytane z Foundry v13 z pamięci (LIVE-E24-01), i przełączniki arkusza drużyny wyłączone dla graczy (LIVE-E24-03).

Plakietki Breakdown i Wounded są od 1.2.104 publiczne na arkuszu i od tego czasu żaden token nie rysuje ikony żadnego z tych stanów. Nakładka śmierci wciąż rysowana na tokenie to sprawdzenie przy stole LIVE-E95-05, a karta rzutu, która nigdy nie nazywa Breakdown, to sprawdzenie przy stole LIVE-E24-10 (zmierzone bez przeglądarki, bez rysowanej karty). Audyt GM-ów, który nazywa Breakdown, to szept i `rollFlags` rzutu.

Ikony stanów to `STATES` i `DEAD_ICON` w `config.mjs`, `icons/state-*.svg` i `ownDeadIcon` w `states.mjs`. Ikona śmierci jest modułu tylko wtedy, gdy ustawienie Automation Daggerhearta dla ikony śmierci ma wartość domyślną. Zmiana tego ustawienia działa od razu, bez przeładowania, dla nowych znaczników śmierci: czaszka modułu przy wartości domyślnej, a w przeciwnym razie własna ikona GM-a; znacznik, który już jest na tokenie, zachowuje swój obraz (sprawdzenie przy stole, LIVE-E24-13). Efekty Breakdown i Wounded, które świat już ma, dostają nowe obrazy, gdy główny GM wczyta świat: przeglądarka głównego GM-a nakłada je raz na wczytanie. Efekt śmierci, który token już ma, zachowuje nagrobek, z którym powstał. Efektów niepowiązanego tokenu to nie obejmuje, a uczniowie modułu są powiązani.

Pozostałe części arkusza: każda część, którą arkusz dodaje, jest rysowana we własnym kroku, więc gdy jedna zawiedzie, pozostałe nadal się rysują; główny GM dostaje powiadomienie o nieudanej części raz na wczytanie, a błąd jest w konsoli (F12). Zapis, który nadpisałby czyjąś Przeszłość, jest od 1.2.101 wychwytywany (`DRPG.Sheet.biographyChanged`). Przedmioty zmarłego ucznia i Monocuba nie mają przycisków przedmiotów (D15). Jedna bramka, pięć arkuszy: każda część, którą moduł dodaje do arkusza postaci, najpierw pyta, czyj to arkusz i kto patrzy, i od 1.2.101 rysuje to, na co odpowiedź pozwala (`sheetMode` w `sheet.mjs`). Arkusz, który nie miga: gdy zapis zmienia tylko Health, Sanity albo Hope, każda przeglądarka, która ma arkusz otwarty, wpisuje zmianę na miejscu, u piszącego i u wszystkich innych: paski albo kropki z ich wierszami, romby Hope oraz Calle i kafelki, których cena się ruszyła, a okno nie jest przy takim zapisie rysowane od nowa. Wszystko inne w zapisie (przedmiot, flaga, maksimum Hope) rysuje arkusz od nowa, a zapis, który blokada albo Overflow tnie do zera, nie rysuje niczego i nie psuje następnego rysowania. Od 1.2.101; sprawdzenie przy stole LIVE-E45-01, a pozostałe to LIVE-E45-02 i LIVE-E45-03.

### 22.6 Hope Calls i Despair Calls

Źródła: `HOPE_CALLS`, `DESPAIR_CALLS` i `MOTIVE` w `config.mjs`; `MOTIVE` ma `minTimesOfDay` 1, `maxTimesOfDay` 10 i `defaultTimesOfDay` 3. Blokady to `callBarred` i `hopeCallRefusal` w `calls.mjs`.

Kupno Calla, który zmienia rzut: przeglądarka głównego GM-a pobiera Hope i uzbraja Call. Bez połączonego GM-a prośba jest odrzucana przed zapłatą; tę odmowę odczytano w kodzie i zmierzono dla Search, nie dla Calla. Rzut losowany przez przeglądarkę głównego GM-a stosuje tylko Calle, które GM-owie mają uzbrojone. Rzut rzucony w przeglądarce gracza, bez połączonego GM-a albo na Daggerheart, którego rzutów moduł nie losuje, zużywa tam Calle, które pokazuje jego okno; to odczytano w kodzie.

Talent (E72): Experience albo Ultimate uzbrojony przed aktualizacją nadal działa, a każdy zachowuje własny klucz. Resolve kosztuje od 1.2.104 2 Hope, a przed 1.2.104 kosztował 3.

Reroll: przeglądarka GM-a, który go wykonuje, obsługuje Hope, kości, wiadomość, cofnięcie i powtórkę. Drugi Reroll postaci jest odrzucany, dopóki trwa pierwszy, w przeglądarce każdego GM-a. Reroll rzutu, który ta przeglądarka wylosowała, rzuca te same kości i to, co policzyła, nigdy to, co podało okno rzutu.

Experience i Ultimate: zgodę trzyma przeglądarka głównego GM-a i tylko z nią uzbraja Call. Od 1.2.83 karta wystawiona przez głównego GM-a, który już wyszedł, znów przyjmuje zgodę, gdy przeglądarka gracza zapyta nowego głównego.

Bounty: od 1.2.113 Monocuby dowiadują się, że wygasło.

Uzbrojone Calle: przy rzucie, który losuje przeglądarka GM-a, decyduje lista tej przeglądarki (od 1.2.68). Obowiązuje tam reguła z sekcji 6.2: utrudniający Call liczy się, gdy okno go podaje, niezależnie od tego, kiedy go uzbrojono, oraz gdy uzbrojono go ponad minutę przed rzutem, czy okno go pokazuje, czy nie. Od 1.2.69 premia, którą uzbraja Call, jest wpisywana w pole premii okna, a okno nigdy nie wysyła liczby, której przeglądarka GM-a nie trzyma. Zmierzone w harnessie testowym na zastępczym oknie; na własnym oknie Daggerhearta to sprawdzenie przy stole, LIVE-E33-09, jeszcze niewykonane.

Decyzje, karty i komunikator (sekcja 6.3): przyciski karty są tylko dla GM-a i są sprawdzane ponownie, gdy naciśnięcie dotrze, więc podrobione kliknięcie nic nie daje. Pliki to `scripts/call-gm.mjs`, `gm-bridge.mjs`, `bridge-wire.mjs`, `bridge-table.mjs`, `bridge-runs-acts.mjs`, `bridge-runs-records.mjs`, `bridge-asks.mjs` i `messenger.mjs`. Przeglądarka każdego GM-a ma własne znaczniki przeczytania, a jako nieprzeczytane u GM-a, który je wysłał, liczą się karty mostu w wątku gracza. Od 1.2.83: pytanie w ogóle nie zostaje wysłane bez połączonego GM-a; jedna decyzja na kartę; prywatna karta, której gracz nie dostał. Przeglądarka GM-a trzyma linie karty dla każdego czytelnika obok własnej kopii i dlatego linia napisana dla jednego gracza wraca tak, jak była napisana.

Przeglądarka innego GM-a prosi przeglądarkę głównego GM-a o jego zapisy: pip albo strzałkę paska Despair; ustawienie, napełnienie albo opróżnienie puli; przyznanie, odebranie albo nazwanie puli; Despair wlany przez Feed the Overflow; punkt zdjęty z powrotem z Overflow; i sprawdzenie Overflow przy zmianie pory dnia. To sprawdzenie podaje sprawdzaną porę dnia, więc główny nie uzbraja niczego na inną, a gdy główny nie odpowiada, biegnie w przeglądarce pytającego GM-a.

Rzuty wykonane, gdy nie był połączony żaden GM: statystyka z arkusza jest od 1.2.69 rzucana jako reakcja. Wiadomości, którą przeglądarka gracza napisała z flagami GM-a, nie ma na karcie i nigdy nie jest przyznana; od 1.2.69 to wiersz `forged` w `game.drpg.sheetWrites()`.

Co gracz zapisuje na własnym arkuszu (od 1.2.68): od 1.2.69 `game.drpg.sheetWrites()` trzyma też trzy rodzaje wierszy z sekcji 1.6, `refused`, `forged` i `rewrite`. Kolumna `what` mówi, czego odmówiono, co podrobiono albo co przywrócono, a kolumna `times` liczy ten sam wiersz `refused` albo `forged` od tego samego gracza w ciągu pół minuty. Przyrost Hope, który przekaźnik Daggerhearta uznaje za własny rzut gracza, którego przeglądarka GM-a nie losowała, zostaje na wierszu `covered`. Call zdjęty ręcznie jest przywracany tylko wtedy, gdy po jego uzbrojeniu nie było rzutu gracza dotyczącego tego ucznia; rzut, który konsola gracza wyśle wcześniej, liczy się jako taki rzut i jest na czacie do twojego wglądu. Listą wiersza Na liście z sekcji 6.3 jest `game.drpg.sheetWrites()`.

*Zablokuj graczom zasoby na arkuszu*: pozostałe pola pasków w HUD tokenu wyłączone dla graczy to sprawdzenie przy stole LIVE-E29-02, jeszcze niewykonane. Kropki tylko do odczytu na arkuszu drużyny to LIVE-E24-03, a pola Health i Sanity ucznia wyłączone dla wszystkich to LIVE-E24-01.

### 22.7 Pule Despair, przydziały i overflow

Kod to `scripts/despair.mjs`, `scripts/despair-award.mjs`, `scripts/assignments.mjs`, `scripts/overflow.mjs` i `OVERFLOW` w `config.mjs`. Limit puli to `STARTING.despairMax` (12).

Punkt Despair z rzutu przyznaje wyłącznie przeglądarka głównego GM-a, gdy włączone jest ustawienie **Rzuty dają Despair** (`despairFromRolls`). Podział uczniów to ustawienie świata `gmAssignments`, które dostaje przeglądarka każdego gracza, i dlatego Mastermind ustawiony na **- nikt -** rzuca się w oczy.

Kto jest Monokumą, ustawia się od E101 w kolumnie **Rola** okna Uczniowie.

Despair z zamiany czeka jako wiersz magazynu GM-ów `despairOwed` i jest płacony przy następnej porze dnia. Czeka, bo Hope odbiorcy to dane aktora, które ma każda przeglądarka (sekcja 1), a spadek puli dawcy w tej samej chwili połączyłby jedno z drugim. Dług widać na ekranie GM-a (przygaszone czaszki, podpowiedź, *(2 do spłaty)* w oknie Despair i komunikat dającego) od zgłoszenia właściciela z 13.11.2026 na 1.2.112.

Despair ponad pełną pulę parował, zanim powstało Overflow. Od 1.2.64 licznik Overflow trzymają GM-owie (sekcja 14), więc konsola gracza nie przeczyta z niego więcej, niż pokazuje ekran. Świat trzyma tylko to, co GM zmienił względem domyślnych wartości `config.mjs`: próg oraz włączenie i wielkość każdego efektu (`on`, `by`), dzięki czemu domyślne wartości późniejszej aktualizacji dalej docierają do świata. Pięć stanów akcji w pokojach (od Lockdown do Power cut) dołączyło do losowania później, zaznaczonych; wcześniej każdy z ośmiu starszych efektów wypadał 1 raz na 8, a odznaczenie tych pięciu zachowuje tamto losowanie.

**Wyczyść overflow** wykonuje przeglądarka głównego GM-a, którykolwiek GM go naciśnie; gdy główny GM nie jest połączony, czyści GM, który nacisnął.

### 22.8 Monokuma, Monocuby i Mastermind

Kod: `scripts/monokuma.mjs`, `scripts/spectator.mjs`, `scripts/spectator-dead.mjs`, `scripts/body-tile.mjs`, `scripts/monocub.mjs` z `MONOCUB` w `config.mjs`, `scripts/mastermind.mjs` i `scripts/verdict.mjs`. Monokuma to aktor postaci z flagą `FLAGS.monokuma`.

Od 1.2.101 **Oznacz jako Monokumę** stoi w nagłówku arkusza i nie ma go już w menu prawego przycisku na liście aktorów. **Poza klasą** (`FLAGS.notInClass`) jest od 1.2.101, rola Widza od 1.2.109, a zmarli jako Widzowie od E62.

Od 1.2.113 uczeń, którego w chwili śmierci nie ma żaden gracz, nie dostaje Widza. Widzowie, których NPC dostał przed 1.2.113, zostają, dopóki GM ich nie usunie: usuń blady token takiego Widza tam, gdzie leży ciało, a potem jego postać w katalogu Aktorów. Okno Uczniowie pokazuje taką postać z Rolą „Widz zmarłego ucznia”. Od 1.2.113 egzekucja gra dźwięk egzekucji, a potem końca rozprawy.

Kafelek ciała jest od 1.2.113 kładziony całkiem przezroczysty, a kafelki położone przed 1.2.113 stają się przezroczyste raz, gdy GM wczyta świat. Harness bez przeglądarki nie ma canvasu, więc kafelka ciała przy stole jeszcze nie widziano; nie widziano tam też tworzenia i zabierania Widza (wskrzeszenie, dwóch GM-ów naraz, token Monocuba) ani tego, czy ściana zatrzymuje przeciągnięcie Widza.

`game.drpg.monocubDialog()` otwiera okno Uczniowie. To, co nosił Monocub, zostaje przy jego ciele (decyzja D15). Od 1.2.69 zdolności Monocuba to jedna tabela, `MONOCUB.abilities` w config.mjs, o pięciu wierszach: Confusion (klucz `meddle`), Redeem, Ask for Hope, Tinker i Ghost Bet. Mają jednego wykonawcę (`game.drpg.performCubAbility`), jedno okno wyboru i jedną akcję mostu (`monocub.ability`): przeglądarka głównego GM-a najpierw sprawdza blokady ruchu, cel i limity, dopiero potem bierze akcję i Hope, rzuca 2d12 i punktuje, więc Monocub dowiaduje się o odmowie i nic go ona nie kosztuje (od E72). Kolejna zdolność to jeden wiersz i jedna funkcja rozstrzygająca (odczytane z kodu).

Od 1.2.65 Call, który uzbraja Confusion, czeka tylko w przeglądarkach GM-ów i gracza celu.

To, kto jest Mastermindem, jest zapisane w magazynie GM-ów, tylko w przeglądarkach GM-ów, i synchronizuje się między GM-ami.

### 22.9 Pokoje, regiony, mgła i odkrywanie, ruch, głos

**Oznaczanie pokoi (9.1).** Pierwsze wczytanie 1.2.74 oznaczyło raz, scena po scenie, każdy nazwany region bez zachowań, którego nie utworzył gracz, i szepnęło GM-owi, co oznaczyło, co pominęło i dlaczego (*Oznaczone pokoje*). Region narysowany później oznaczają GM-owie. Zmianę oznaczenia przez gracza ocenia przeglądarka głównego GM-a, według własnego zapisu oznaczenia.

**Pokoje i kawałki (9.1).** Zakładka Pokoje ma od E101 kolumnę Bez prywatności, która do E101 stała na zakładce Drzwi. Kolumna Zepsute jest na zakładce Drzwi od E74.

**Zmiana nazwy (9.1).** Przeniesienie po zmianie nazwy wykonuje przeglądarka głównego GM-a. Nazwa, którą przemianowany kawałek porzucił, jest zapisana na samym kawałku, więc GM, który połączy się między zmianami nazw kawałków pokoju albo zostanie między nimi głównym GM-em, odczytuje je tak samo jak GM, który widział pierwszą; główny GM zdejmuje ten zapis z kawałków, gdy pokój zostanie przeniesiony.

**Skrytki w sypialniach (9.1).** Od 1.2.91 sypialnia daje swojemu właścicielowi otwartą skrytkę każdą zwykłą drogą, także konsolowym `setVaultRoom`, a Zastosuj na zakładce Skrytki nie kasuje już skrytki, którą to samo Zastosuj chwilę wcześniej utworzyło. Przy pierwszym wczytaniu 1.2.91 główny GM dostał jeden raport, *Skrytki w sypialniach*, z sypialniami (po scenach, z ich właścicielami), które nie miały skrytki swojego właściciela i dostały otwartą; świat, w którym każda sypialnia miała już swoją skrytkę, nie dostał raportu. Robiła to tylko przeglądarka głównego GM-a i dzieje się to raz: skrytkę, którą GM usunął celowo, usuwa się znowu na zakładce Skrytki, a przy następnym wczytaniu nie wraca.

**Konsola i pokoje na kilku scenach (9.1).** Konsolowe `setStash`, `setVaultRoom` i `setRestRoom` bez sceny biorą pierwszą scenę z pokojem o tej nazwie; `placeRemnant` i `applySceneVisionMode` bez sceny nic nie robią i to mówią, a `createProject` odrzuca pokój, którego nie ma żadna scena, i mówi dlaczego.

**Search Tokeny (9.1).** Liczba Search Tokenów na pokój to `ROOMS.searchTokensPerRoom` w `scripts/config.mjs` (3), edytowalna w ustawieniach. Search gracza czeka 5 sekund (`TIMING.searchTokenAckMs`) na odpowiedź przeglądarki GM-a, zanim token wróci.

**Kafelek pokoju (9.1).** Rysuje go `scripts/room-tile.mjs`, a dane Ustawień pokoi trzyma `scripts/room-setup.mjs`.

**Mgła (9.2).** Pliki to `scripts/fog.mjs`, `fog-geometry.mjs`, `fog-doorways.mjs`, `fog-reveal.mjs` i `fog-diagnostics.mjs`. Odkrycia zapisuje główny GM; pełny zapis zostaje w przeglądarkach GM-ów (sekcja 14), a przeglądarka każdego gracza trzyma tylko wiersze jego własnych postaci. `game.drpg.prepareScenes()` przygotowuje wszystkie sceny z pokojami naraz i pamięta, co zmieniło, więc `restoreSceneVisionMode` może przywrócić scenę do poprzedniego stanu. Gdy scena dostaje w trakcie gry swój pierwszy pokój, przeglądarka głównego GM-a przygotowuje ją tak, jak zrobiłoby to `prepareScenes()`. Zmiany zachowań regionu to X3 i X4 scenariusza 66, a teleport wyłączony w miejscu to jego X7. Widoczność tokenów to `scripts/visibility.mjs`.

**Napis regionu (9.2).** Jest od 1.2.94. Własne napisy Daggerhearta nad tokenami wstrzymuje wiersz umowy `no-scrolling-text` (sekcja 20). Moduł sprawdza, czy jakikolwiek pokazany token stoi tam, gdzie rysuje się napis. Odczytane w kodzie modułu i na zastępczym zachowaniu w harnessie testowym; przy stole LIVE-E51-05, jeszcze niewykonane.

**Ruch (9.3).** To `scripts/movement.mjs`. Odmowy zapadają w przeglądarce tego, kto rusza tokenem, a przeglądarka głównego GM-a ocenia każde wejście gracza jeszcze raz. Przejście uruchamia też strażnika pułapek. Cena przejścia, którą oddaje Zwróć ostatnie przejście, to własny wydatek ruchu, który przeglądarka gracza zrobiła w ciągu 5 sekund od przejścia; czy to się sprawdza przy stole, jeszcze nie wiadomo. Przycisk arkusza w wierszu okna Uczniowie jest od 1.2.104.

**Piętra (9.4).** Gdy własny test trafienia Foundry odrzuca punkt we wszystkich pokojach, moduł sięga po kształt każdego pokoju na tym piętrze, a po obejmujący go prostokąt tylko tam, gdzie kształtu nie da się zapytać; nigdy po pokój na innym piętrze i nigdy po tę część prostokąta pokoju w kształcie litery L, której pokój nie zajmuje. Scena z piętrami bez regionu schodów jest oceniana po obrysach pokoi, jak przed 1.2.74. `checkRegions()` sprawdza każde piętro osobno i podaje je w kolumnie `floor` (sekcja 20). To, co moduł wie o Levels, jest jego odczytaniem v14, zmierzonym na modelu z harnessu testowego, a jeszcze nie przy stole. Sprawdzenia przy stole: jakie piętra dostaje nowo narysowany region, czy Foundry pozwala graczowi oglądać piętro, na którym nie ma tokenu, i ile kosztuje jedna zmiana piętra (`game.drpg.perf()`).

**Głos (9.5).** To `scripts/voice.mjs`, ustawienie **Głos osobno w każdym pokoju** (`voiceEnabled`) i LiveKit AVClient. Każdy zmapowany pokój jest pokojem breakout LiveKit. Podczas Eclipse przeglądarka każdego gracza wychodzi z głosu. Blokady mikrofonów w rozprawie zapisuje przeglądarka głównego GM-a. Czy avclient-livekit przestaje i znów zaczyna nadawać bez przeładowania, sprawdzono tylko na jego zastępniku w harnessie, nie przy stole (LIVE-E70-04). Zmarli rozmawiają na kanale głosowym Widzów od E62.

**Głos po przeładowaniu (9.5).** Dopóki przeglądarka GM-a nie odczytała jeszcze incydentu (zaraz po przeładowaniu), gracz, którego uczeń zginął w tym rozdziale i który pyta o swój pokój, dostaje go od razu, a żywy gracz, który wejdzie do pokoju, w którym leży uczeń zmarły w tym rozdziale, nie dostaje nic, dopóki go nie odczyta. Wstrzymywane są tylko te pokoje: uczeń zmarły we wcześniejszym rozdziale (albo sezonie) jest umieszczany od razu tak jak po incydencie, a żywy gracz, który wejdzie do pokoju, w którym stoi token tego ucznia, dostaje ten pokój. Strona, która się ładuje przy włączonym głosie osobno w każdym pokoju, czeka w pokoju tylko dla siebie, aż przeglądarka głównego GM-a powie, do którego pokoju należy; gdy żaden GM nie jest połączony, dołącza do pokoju głównego (odczytane z kodu i z testów, jeszcze nie przy stole). Wszystkie reguły głosu odczytano z kodu i uruchomiono w harnessie; przy stole jeszcze ich nie słyszano.

**Podsłuch pod drzwiami i Echoes (9.5).** Są od 1.2.113. Przeglądarka głównego GM-a przenosi głos słuchającego i zapisuje blokadę (`scripts/eavesdrop-gm.mjs`); blokada schodzi 4 sekundy po powrocie głosu (`EAVESDROP_GRACE_MS`). Echoes też jest odczytywane w przeglądarce głównego GM-a (`scripts/echoes-gm.mjs`). Oba uruchomiono w harnessie, jeszcze nie przy stole (LIVE-E69-03, LIVE-E69-06).

**Pole drzwi albo korytarz (9.5).** Są obsługiwane od 1.2.89; wcześniej token gracza poza każdym pokojem trafiał do pokoju głównego, tak jak wciąż trafia tam token Monokumy. Przeglądarka głównego GM-a pamięta pokój, z którego przyszedł token, do przeładowania albo do chwili, gdy przestanie być główną, a przeglądarka GM-a, która zostaje główną, zaczyna od pokoju głównego (uruchomione w harnessie). Linia każdego połączenia w Dzienniku debugowania mówi, ile połączeń zrobiła ta strona. **Napraw głos** uruchamia `resetAllVoice` w `scripts/voice.mjs`, tylko w przeglądarce głównego GM-a. `game.drpg.voicePlan()` wypisuje, dokąd każdy zostałby wysłany, bez mikrofonu i bez nikogo innego połączonego, więc większość testu głosu to minuta jednej osoby. Diagnoza głosu z 9.5 to `game.drpg.diagnoseVoice()`, która podaje też linię o sekrecie serwera głosu.

**Kafelek głosu (9.5).** To `scripts/voice-tile.mjs`, od 1.2.77. Czy zablokowanego gracza nadal słychać, gdy próbuje ze swojej przeglądarki, nie sprawdzono jeszcze przy stole (LIVE-E78-06). To, co pokaże tylko stół (słyszaną mowę, dźwięk z ukrytego doku po przeładowaniu, skutek blokady, zerwane połączenie), to LIVE-E78-01 do LIVE-E78-10 w audycie, niezmierzone tutaj. To, co czyta ostrzeżenie o sekrecie serwera głosu, pochodzi z kodu tamtego modułu, nie od stołu: typy serwera, które daje avclient-livekit 0.6.8, i wpisany sekret przy każdym typie poza Tavern.

**Tajne przejścia (9.6).** To `scripts/passages-gm.mjs` i `passages.mjs`. 16 z Find Passage to `ACTIONS.analyze.passageThreshold`. Przeglądarka głównego GM-a rozstrzyga tunel tak jak drzwi i przesuwa token, dlatego tunel potrzebuje połączonego GM-a. Czy Foundry oznacza własny teleport GM-a jako teleport, nie sprawdzono jeszcze przy stole v14. `game.drpg.passages.log()` zapisuje każde pokazanie, nadanie, odebranie, zamknięcie i otwarcie, od najnowszego, i trzyma ostatnie 200. Przy sekretnych drzwiach Foundry przeglądarka głównego GM-a ustawia sekretne drzwi, które zmienił gracz, z powrotem tak, jak GM ostatnio je zostawił (to pamiętają same drzwi; drzwi, których żaden GM jeszcze nie zmieniał, tak, jak stały, kiedy przeglądarka GM-a pierwszy raz je zastała), a te zmienione, kiedy nie był połączony żaden GM, zaraz po połączeniu się GM-a, wymieniając ich scenę na ekranie GM-a. `game.drpg.passages.audit()` w konsoli głównego GM-a wypisuje ruchy przez ścianę od wczytania jego przeglądarki, najnowsze 1000 wierszy, a ten sam ruch powtórzony w ciągu pół minuty liczy się w jednym wierszu.

### 22.10 Przedmioty

Pliki źródłowe przedmiotów to `config.mjs ITEM_*`, `scripts/inventory.mjs`, `tables.mjs`, `tables-pools.mjs`, `tables-editor.mjs`, `gm-items.mjs`, `handover.mjs`, `vault.mjs`, `vault-store.mjs`, `stash-reach.mjs`, `palm.mjs` i `use-items.mjs`. Kolumna wytrzymałości to `ITEM_DURABILITY`, Tool w ręku to `TOOL_IN_HAND`, pojemność skrytki to `VAULT_LIMIT`, liczby Palm to `ACTIONS.palm`, a zabieranie z ciała to `LOOT`: pasma jego Remnantu to `LOOT.bands`, a osłona Shadow to `LOOT.cover`.

Przedmiot utworzony ręcznie albo pochodzący ze świata starszego niż Tiery nie ma zapisanego Tieru i liczy się jako Tier 0.

Sprawdzenie kluczy (10.3) działa przy wczytaniu świata u głównego GM-a i przy Zastosuj w Ustawieniach pokoi. Gdy własny klucz właściciela nazywa pokój, który nigdzie nie jest sypialnią, sprawdzenie kieruje ten klucz na jego sypialnię, zamiast dawać mu drugi, o ile to klucz, który dostał do własnej sypialni (kopia cudzego klucza nosi imię swojego właściciela), to jego jedyny taki klucz, a ta sypialnia jest jedyną jego, do której nie ma klucza; w przeciwnym razie powstaje nowy klucz, a stary zostaje do usunięcia przez ciebie. Klucz w skrytce liczy się jako posiadany: właściciel nie dostaje drugiego, a klucz do tego pokoju, który ukradnie albo zabierze z ciała, nie jest mu kopiowany. Gdy właściciel ma więcej niż jeden klucz do własnej sypialni, to samo sprawdzenie zostawia jeden (noszony przed schowanym w skrytce, potem najstarszy), resztę zabiera i mówi ci o tym na ekranie. Kopii jego klucza u innych uczniów nie rusza.

Typ Remnantu, który zostawia wyrzucony przedmiot (Tamper albo Prep), zapisuje przeglądarka GM-a, nie gracza. Zapis przekazania idzie przez klienta GM-a, który ponownie sprawdza pokój.

Sypialnia dana komuś innemu przez `game.drpg.setVaultRoom` zabiera klucze starego właściciela i kopie jego kluczy tak samo jak Ustawienia pokoi. Właściciel może mieć więcej niż jeden klucz do własnej sypialni sprzed 1.2.88 albo z dwóch nadań dwóch GM-ów naraz; oba przypadki naprawia sprawdzenie kluczy przy wczytaniu u głównego GM-a i przy Zastosuj w Ustawieniach pokoi.

Od 1.2.112 Search nigdy nie sięga do skrytki. Właściciel skrytki dowiaduje się po powrocie, że ktoś do niej sięgnął: sięgnięcie, które coś zabrało, gdy właściciel stał gdzie indziej, znaczy skrytkę w rejestrze GM-ów, a od 1.2.113 właściciel dowiaduje się o tym, którędykolwiek stanie w tym pokoju. `game.drpg.inspectVaults()` pokazuje ci zawartość każdej skrytki.

Odpowiedź na prośbę o Frisk jest odbierana tak jak odpowiedzi na inne prośby. Gdy odpowiedź zostawia prośbę otwartą, a robi to odmowa albo brak odpowiedzi przy włączonym zmuszaniu, GM-owie czekają, aż przeglądarka przeszukującego potwierdzi, że ją ma; gdy potwierdzenie nie przyjdzie w zwykłym czasie, prośba kończy się tak, jak zakończyłoby ją **Odpuść** przeszukującego, a GM-owie dostają o tym wiadomość. Odpowiedź, która kończy prośbę, nie potrzebuje potwierdzenia.

O tym, czy zabranie z ciała potrzebuje rzutu na Shadow, decyduje odczyt pokoju w przeglądarce GM-a, nie u zabierającego. Zapis użycia albo skrytki zmarłego ucznia z przeglądarki gracza jest cofany.

### 22.11 Projekty i pułapki

Pliki źródłowe projektów i pułapek to `scripts/projects.mjs`, `projects-secrecy.mjs`, `projects-ui.mjs`, `projects-tray.mjs`, `traps.mjs` oraz `PROJECT_SCALE`, `TRAP_TRIGGERS`, `TRAP_MODIFIERS` i `INDIRECT_MURDER` w `config.mjs`. Sześć rodzajów z 11.2 to `PASSAGE_PRESETS` w `passages-gm.mjs`.

`game.drpg.setProjectMeta(countdownId, data)` poprawia wiersz projektu z konsoli albo z makra i działa tylko u GM-a. Zmiana zachodzi u głównego GM-a, w tej samej kolejce, przez którą idzie każda inna zmiana projektu, a tajne pola i tak trafiają do magazynu GM-ów; funkcja zwraca wiersz projektu taki, jak czyta go ta przeglądarka po wykonaniu zmiany.

Projekt zapisany bez statystyki to projekt sprzed 1.2.66. Opisy przyszły w 1.2.99: projekt sprzed 1.2.99 nie ma opisu, dopóki nie otworzysz jego okna edycji. Od 1.2.99 token projektu jest bez przezroczystości, a od 1.2.111 nosi ikonę projektu z zasobnika.

Przeglądarka głównego GM-a pilnuje, by tokeny projektów zgadzały się z projektami, po każdej zmianie projektu; idzie też za przesunięciem tokenu i przywraca brakujący. Token projektu, którego już nie ma, znika przy każdym rysowaniu mapy głównego GM-a, a raz zniknął, gdy świat pierwszy raz wczytał 1.2.73, a GM dostał wtedy informację, ile ich zniknęło. O jawnym projekcie zatwierdzonym przed 1.2.88 proponujący dowiedział się raz, przy najbliższym wczytaniu u głównego GM-a.

To, co robi projekt z 11.2, gdy jego pasek się zapełni, dzieje się w przeglądarce głównego GM-a, która przedtem ocenia cel jeszcze raz. Karta propozycji wskazuje cel tak, jak zaproponowała go przeglądarka budującego: pokój za ścianą przez jego miejsce wśród pokoi za ścianami, a przejście, wyłom albo przedmiot przez jego id. Od 1.2.113 karta dla ucznia, który odkrył tajny projekt przez Observe, czeka w przeglądarkach GM-ów, aż któraś z postaci tego gracza będzie w pokoju projektu.

Wyłamana ściana zachowuje swoje id, a jej dziura i kopia to ściany, które ma każda przeglądarka. Karta dla właściciela sypialni o wyważonych drzwiach pochodzi z linii prywatności 1 (13.11.2026).

„Mniej więcej 4 do 5 akcji” na karcie pułapki to `indirectCostText` w `murder-ui.mjs`. Koszt jednej pracy to najniższe pasmo `ACTIONS.project.thresholds` (+1) plus `INDIRECT_MURDER.concealIntent.aloneBonus` (+1): przy najmniejszych skalach części wychodzi ceil(4/2) + ceil(3/2) = 4, a przy największych ceil(6/2) + ceil(4/2) = 5.

Pułapka, która zadziałała, sama się rozbraja, żeby pułapka w ruchliwym pokoju, choćby w holu, nie wysyłała dwudziestu kart na sesję. Tytuł alarmu pułapki, „Decyzja do podjęcia”, to jedyna linia karty, którą ma jej kopia w każdej przeglądarce. To, że podłożony przedmiot jest zatruty, jest zapisane w rejestrze twojej przeglądarki, nigdy na przedmiocie. Search może jeszcze prosić o podłożony przedmiot do 120 s po wydaniu swojego Search Tokenu; wydany podłożony przedmiot czeka 120 s, zanim zostanie uznany za dostarczony (`TIMING.plantWindowMs`), a na odpowiedź głównego GM-a na samą prośbę jest 5 s (`TIMING.plantRequestMs`).

Projekt to Countdown Daggerhearta, a Countdowny są ustawieniem świata, które ma każda przeglądarka: nazwa każdego projektu, jego postęp i własność, która mówi, kto może go widzieć; ta wersja nie przenosi Countdownów. Własny zapis modułu o każdym projekcie, też dane świata, mówi, jaki ma pokój, czy jest tajny, czy jest morderstwem pośrednim, jaką ma statystykę i ikonę, jaki ma token na mapie i czy jest sabotowany i naprawiany. Od 1.2.64 resztę zapisu projektu przechowują GM-owie (sekcja 14).

### 22.12 Eclipse

Pliki źródłowe Eclipse to `scripts/eclipse.mjs`, `ECLIPSE_MOVES` i `ECLIPSE_FREE_PLACEMENT`: `ECLIPSE_MOVES` to 2 przejścia, a `ECLIPSE_FREE_PLACEMENT` to dowolne ustawienie w nocnym Eclipse. Czas na cofnięcie przy Zakończ bez przesuwania zegara to `TAKE_BACK_MS` w `clock.mjs`, 5 minut.

Czekające zgłoszenie Direct Murder, którego karta zaginęła, rozstrzygasz z konsoli przez `game.drpg.ruleOnParkedMurder(killerId, true)` (sekcja 20.3).

Z konsoli `startEclipse`, `endEclipse` i `advanceTimeOfDay` nikogo nie pytają, tak samo Edytuj kampanię i cofanie. Zegar przesunięty przez `startEclipse`, `endEclipse` albo `advanceTimeOfDay` kończy otwartą rundę, a rundę zapisuje główny GM.

Karta zgłoszenia idzie szeptem do GM-ów z tytułem, który nic nie mówi, bo karta w wątku zabójcy powiedziałaby każdej przeglądarce, kto coś zgłosił. Od 1.2.64 zgłoszenia należą do GM-ów od chwili złożenia do zapalenia świateł. Przejścia też liczą GM-owie: przeglądarka głównego GM-a ocenia każde według limitu i wystawia jego kartę, a przeglądarka każdego gracza trzyma tylko licznik własnych postaci. Przejście, które przeglądarka głównego GM-a widzi, choć nikt o nie nie pytał, też się liczy.

### 22.13 Silnik morderstwa od początku do końca

Silnik morderstwa jest w `scripts/murder.mjs`, `incident-store.mjs`, `murder-rules.mjs`, `murder-ui.mjs`, `cleanup.mjs` i `chapter.mjs` i czyta `MURDER_OPENING`, `INCIDENT`, `CRISIS_ACTIONS`, `CLEANUP` i `INDIRECT_MURDER` z `config.mjs`. Minimum 3 Key Remnantów to `KEY_REMNANTS.minimum`, a drenaż to `INCIDENT.drain`. Rzut otwarcia jest proponowany ponownie `TIMING.openingAttempts` razy (`throwOpeningRoll` w `murder-rules.mjs`), a potem GM-owie dostają „{name} odmawia rzutu otwarcia” (`DRPG.Murder.openingDeclined`). Ponowna prośba z trackera czeka na kliencie `TIMING.reaskCooldownMs`.

Zabójca za „?” jest od 1.2.113. Maskę zakłada przeglądarka głównego GM-a, zanim zostanie zapisany Stage 5: jedna flaga na każdym tokenie mówi tylko, że jest zamaskowany, a to, jak zabójca wyglądał, trzymają tylko zapisy GM-ów i to wraca dokładnie. Żadna kopia obsady poza kopią zabójców nie ma zabójcy, przeglądarka innego gracza zamyka arkusz zabójcy, a mikrofon trzyma własna blokada modułu, która nie rusza blokady założonej przez GM-a samodzielnie i oddaje dokładnie to, co zapisała. Dokument tokenu trzyma swojego aktora, więc gracz, który otworzy konsolę przeglądarki, nadal ustali, kto jest pod „?”. Maskę uruchomiono w harnessie, jeszcze nie przy stole (LIVE-E69-05).

**Kto widzi otwarcie i kości.** Komunikat o nieudanym otwarciu trafia do GM-a, którego przeglądarka je policzyła. W Direct Murder przeglądarka ofiary nie ma niczego z incydentu, gdy zabójca rzuca. Kości uczestników pokazuje im nawzajem przeglądarka głównego GM-a.

**Ceny Stage 6.** Własny Stage 6 zabójcy kosztuje `RESOLUTION_STRESS_COST` (1 Sanity) za próbę. Cena kafelka Tamper to `PRICE_CHAINS.tamper` z pominiętym krokiem Sanity (`tamperPriceSkip` w `cleanup.mjs`). Ciepła scena to `CLEANUP.freshScene`, zniżka 3, która kończy się z Investigation albo z fazą rozprawy i działa tylko przy trwającym incydencie albo nieznalezionym ciele z tego rozdziału (jej `onlyWith`); u GM-a liczy tylko te nieznalezione ciała, o których może wiedzieć któryś z graczy rzucającego, żeby okno gracza i wynik GM-a czytały jedną liczbę (`freshSceneBonus`, `unfoundBodyIn`). Minimum 8 to `CLEANUP.minDc`. Zasięg Move the Body to `CLEANUP.actions.moveBody.rooms`, 2 pokoje przy krytyku i 1 pokój przy każdym innym trafieniu, a czyta go `applyMoveBody` w `cleanup.mjs` przez `bodyReach` i `bodyLanding`; żaden pokój na żadnej z dwóch list nie jest sypialnią i żadne ciało nie jest przenoszone przez sypialnię. Zwrot za krytyk przy Misleading Trail i Move the Body to ich `refundStress.critical` (1), oddawany jako krok, który zapłacił, a zwrot za krytyk przy rzucie osłony to `CLEANUP.conceal.refundStress.critical` (1 Sanity, `concealFromWitnesses`).

**Orzeczenia i odmowy przy przeróbce.** Orzeczenie Asystenta GM-a o przeróbce zapada w przeglądarce głównego GM-a i jest zapisywane jako jego. Próba Stage 6, którą odrzuca przeglądarka GM-ów, oddaje to, co kosztowała.

**Co się psuje.** Dopóki ciało nie zostanie znalezione, moduł trzyma w przeglądarkach GM-ów spis narzędzi do sprzątania, które każdy zabójca miał na sobie przy próbach sprzątania.

Spośród graczy ofertę zdrady trzyma w przeglądarce tylko ten, komu ją złożono.

Pytanie przy odkryciu ciała jest od 1.2.113. Odkrycie odbywa się w przeglądarce głównego GM-a, a czekające odkrycie przetrwa przeładowanie i wraca jako pytanie, gdy wczyta się przeglądarka głównego GM-a. Moduł zapisuje, które ciała znaleziono, dlatego ciało znalezione w tym rozdziale jest ogłaszane raz.

Od 1.2.64 śmierć jest wstrzymana do znalezienia ciała: zapisuje się w magazynie GM-ów, a dopóki ciało jest nieznalezione, żadna flaga deceased nie jest zapisywana. Przeglądarka każdego użytkownika, który o niej wie, trzyma śmierci, o których może wiedzieć, i żadnych innych. Ujawnienie zapisuje flagę deceased z rozdziałem, dniem i porą dnia zabójstwa. To, że rozprawa liczy zabójcę tylko za znaną śmierć, zmierzono przez tier 2 zestawu testów w harnessie bez przeglądarki, a przypadek późniejszego rozdziału też w harnessie bez przeglądarki; żadnego z nich nie sprawdzono jeszcze przy stole.

Dźwięk znalezienia dla tego, kto wchodzi, jest od 1.2.113. Główny GM wysyła go tylko graczom tej postaci, a pakiet wymienia sam dźwięk i nic więcej; GM-owie pamiętają po przeładowaniu, kto go już słyszał. Przy prawdziwym stole jeszcze go nie słyszano (LIVE-E113-01).

**Samotny znalazca.** Znacznik śmierci u samotnego znalazcy rysuje moduł na tym jednym ekranie; harness bez przeglądarki nie ma canvasu, więc przy stole jeszcze tego nie widziano.

### 22.14 Investigation

Kod Investigation to `scripts/remnants.mjs`, `investigation.mjs`, `truth-bullets.mjs`, `observe.mjs` i `analyze.mjs`, a mapa sprawy to `case-map.mjs`, `case-schema.mjs` i `case-realize.mjs`; liczby to `REMNANT_TYPES`, `KEY_REMNANTS`, `OBSERVE_DC` i `ANALYZE_DC` w `config.mjs`. Liczby Key Remnantów z 14.4 to `KEY_REMNANTS` (prepared 5, minimum 3, scale, suspectRange 2 do 4), a liczby z rzutu otwarcia to `MURDER_OPENING.killer.keyRemnants` (5 z Hope, 4 z Despair, 3 przy krytyku). Tabela Observe to `OBSERVE_DC`, Neutral i Final czyta się przez `OBSERVE_TYPE_ALIAS`, 18 tajnego projektu to `PROJECT_OBSERVE.dc` (Hidden w kolumnie Prep), a 1 Sanity za pudło to `OBSERVE_FAIL_STRESS`. Tabela Analyze to `ANALYZE_DC`, a Autopsy wydany jako Neutral czyta kolumnę Key przez `ANALYZE_TYPE_ALIAS`; 14 i 18 wskazówki to `ACTIONS.analyze.hintThresholds`, 16 Find Stash to `stashThreshold`, 16 Find Passage to `passageThreshold`, cena w rozprawie to `PRICE_CHAINS.analyze`, a wiersze zamknięte w Class Trial to `ANALYZE_TRIAL_FILTER` w `action-analyze.mjs`.

Własne Remnanty trwającego incydentu powstają nieukryte, żeby ekrany jego graczy mogły je narysować tylko im; gdy incydent się zamyka, moduł znów ukrywa te, których nikt nie skopiował. Od 1.2.64 nazwa i obrazek, które nadajesz Remnantowi, nigdy nie są zapisywane na tokenie, który ma każda przeglądarka: ekrany, którym wolno wiedzieć więcej, rysują Remnant na własnej kopii mapy, twój z danych sprawy, a ekran znalazcy z jego własnego Truth Bulletu. Rysuje to moduł na każdym ekranie; harness bez przeglądarki nie ma canvasu, więc przy stole jeszcze tego nie widziano. Świat zaktualizowany do 1.2.64 ukrył raz, przy pierwszym wczytaniu, Remnanty incydentów zamkniętych przed nim, których nikt nie skopiował; incydent, który wtedy trwał, zachował swoje.

Trzy stany powiązania ze zbrodnią są od 1.2.71; do 1.2.71 Niepowiązany i nierozstrzygnięty były jedną wartością. Świat zaktualizowany do 1.2.71 czyta każde stare Niepowiązany raz jako nierozstrzygnięte, także z tokenu sprzed 1.2.63 i z tego, co oddaje Reroll starszego sprzątania: oznacz w nim swoje fałszywe tropy jeszcze raz.

Każda lista w oknie Investigation to tabela nie szersza niż okno, w obu motywach; długi nagłówek kolumny w Kto co ma zajmuje dwie linie, stopka stoi zawsze w dwóch rzędach, a okno ma jeden rozmiar, cokolwiek pokazuje. **Usuń** w wierszu Remnantów jest od 1.2.99, a na Mapie od 1.2.107. Rząd narzędzi Mapy zapisuje od razu do sprawy GM-ów, nigdy przez Zapisz. Od 1.2.113 panel GM-a nie wymienia zaplanowanych Remnantów: zaplanowany Remnant stawiasz z jego węzła na Mapie.

Observe i Analyze są oceniane na kliencie GM-a, bo trudność jest właśnie tym, co rzut kupuje, a okno opisu otwiera się w przeglądarce tego GM-a. Deklaracje Observe czekające na rzut zostają tylko w przeglądarce głównego GM-a. Zaplanowane Autopsy wychodzi z przeglądarki głównego GM-a, gdy zostanie ogłoszone odkrycie ciała, i tam też pada pytanie, czy otworzyć podgląd realizacji.

Gdy któraś z przeglądarek GM-ów dołącza, przeglądarki GM-ów wymieniają się kopiami sprawy pole po polu: wygrywa nowsza decyzja, usunięcie też.

Od 1.2.63 przeglądarki GM-ów trzymają: klucz odpowiedzi każdego Truth Bulletu; prawdziwy typ i odczyt każdego Remnantu; kto jest Mastermindem i gdzie jest jego kryjówka; obsadę trwającego incydentu i Blackened każdego rozdziału; który podłożony przedmiot należy do której pułapki i co czeka w którym pokoju; oferowane Level Upy; które pokoje odkryła każda postać. Od 1.2.64 także: kto buduje każdą pułapkę, jej warunek i wyzwalacz, oraz kto sabotował projekt (sekcja 11); zgłoszenia Direct Murder w ciemności i to, kto ile razy przeszedł w Eclipse (sekcja 12); plan Key Remnantów, rozdział po rozdziale; notatki graczy przed sesją (sekcja 19); to, jak doszło do incydentu (pułapka, śmierć z własnej ręki ofiary, jak się skończył); śmierci, których nikt jeszcze nie znalazł (sekcja 13.4); Reinforced Level Upy czekające na klasę (sekcja 15); licznik Overflow i Despair, który każda pula jest winna za zamiany na Hope (sekcja 7); to, co zabrano z każdego ciała, i jego Remnant (sekcja 10); oraz to, z którego Remnantu pochodzi każdy Truth Bullet. Od 1.2.65 także Confusion uzbrojone na postaci, a jeszcze nierzucone (sekcja 8). Od 1.2.66 także: stan walki trwającego incydentu (runda, czyja strona działa, co jest utrudnione, zablokowane albo zużyte; sekcja 13.2); statystykę wybraną do jego otwarcia; darmową próbę sprzątania, którą dał krytyczny Finishing Blow; trzy ostatnie tury z trackera; to, kto wszedł do walki i z niej wyszedł; zdradę zgłoszoną w Eclipse; oraz to, które narzędzia do sprzątania zabójcy mieli na sobie przy próbach sprzątania, dopóki ciało nie zostanie znalezione (sekcja 13.3). Świat trzyma tylko to, że incydent trwa, i na jakim jest etapie. Darmową próbę sprzątania mają też przeglądarki jej zabójców, więc uderzający widzi ją jako darmową. Od 1.2.111 przeglądarki GM-ów trzymają także nazwę tajnego projektu i to, kto o nim wie (sekcja 11). Okno przywracania wymienia każdy magazyn, który trzyma, nazwami z `DRPG.Case.store`.

Przeglądarka gracza trzyma to, czy jest on Mastermindem, a jeśli nim jest, to gdzie jest kryjówka; w incydencie, w którym bierze udział, jego obsadę, która obejmuje to, jak doszło do incydentu: każde imię w nim oprócz budowniczego pułapki po stronie ofiary. Ofertę zdrady trzyma tylko przeglądarka trzeciej osoby, której ją złożono, i ta ją zachowuje; z późniejszego incydentu, który nie jest jej, przeglądarka gracza nie trzyma niczego do końca dnia. Nigdy nie trzyma zapisu, według którego Reroll akcji kryzysowej ją cofa, a który czyta tylko GM. Trzyma Level Upy oferowane własnym postaciom gracza i pokoje, które te postacie odkryły. Od 1.2.64 także to, ile razy jego własne postacie przeszły w trwającym Eclipse, jego własną notatkę przed sesją, śmierci, o których wie, i to, z którego Remnantu pochodzi każdy z jego własnych Truth Bulletów. Od 1.2.65 także Confusion uzbrojone na jego własnej postaci. Od 1.2.66 obsada incydentu obejmuje jego walkę (rundę, czyja strona działa, co jest utrudnione, zablokowane albo zużyte) u tych, którzy w niej walczyli, ale nie u budowniczego pułapki, który wraca na Stage 6 bez niej. Przeglądarka gracza nigdy nie trzyma liczby Key Remnantów, statystyki otwarcia, darmowej próby sprzątania (tę mają jej zabójcy), ostatnich tur ani tego, kto wszedł do walki i z niej wyszedł: to zostaje u GM-ów. Zakładka Rerolla (ostatni rzut i to, co zrobił) zostaje w przeglądarce, która rzucała, bez kopii u nikogo innego i bez kopii zapasowej.

Kontrola zdrowia działa, gdy przeglądarka głównego GM-a otwiera świat; od 1.2.64 liczy też morderstwo pośrednie, którego zabójcy, warunku i wyzwalacza ta przeglądarka nie ma. Aktualizacja do 1.2.64 zostawia na tokenie, do decyzji GM-a, awans Faint Prep, przeciw któremu stanęła późniejsza poprawka, i flagi bez wiersza w rejestrze, do którego by je przeniosła, i mówi o tym na ekranie, gdy tak się stanie. Z konsoli o sprawie raportują `game.drpg.gmStoreStatus()` i `game.drpg.gmStoreHealth()`, a `game.drpg.backupCase()` i `game.drpg.restoreCase()` to **Zrób kopię** i **Przywróć z pliku**; `exportLedger()` i `importLedger()` to ich stare nazwy, zachowane jako aliasy.

### 22.15 Class Trial

Kod Class Trial to `scripts/trial-floor.mjs`, `trial-floor-ui.mjs`, `trial.mjs`, `vote.mjs`, `trial-progress.mjs`, `verdict.mjs` i `level-up.mjs`, a liczby rozprawy to `TRIAL` w `config.mjs`. Czas Class Trial w konsoli liczy minuty według zegara serwera, a zegar debaty też, więc gracz, którego komputer ma źle ustawiony zegar, widzi te same sekundy co ty.

Konsola otwiera się na 1280 pikseli szerokości (mniej na węższym ekranie) i na całą wysokość ekranu, 8 pikseli od jego góry. Jej układ zmierzono w przeglądarce przy 1366x768 i 1920x1080 w obu motywach; w Foundry przy stole czeka on jeszcze na sprawdzenie na żywo.

Listę zmarłych rozprawy tworzy przeglądarka głównego GM-a i ona ustawia blokady mikrofonów zmarłych. `game.drpg.setClock`, które przestawia fazę na rozprawę, o nic nie pyta, nawet o drugą rozprawę.

Debata: budżet poniżej 30 sekund przekazany do `game.drpg` też trwa 30 i jest zapamiętany jako 30. `game.drpg.objectionLog()` wymienia wszystko, co przedstawiono w tym rozdziale, pogrupowane według pytania debaty, a Objection oddalone przez GM-a jest tam opisane jako oddalone przez GM-a. Celem Objection jest mówca, którego słyszy pokój głosowy przeglądarki głównego GM-a, cokolwiek dzieje się z własnym pokojem głosowym gracza; gdy przeglądarka głównego GM-a nie ma pokoju głosowego, cel wskazuje gracz. Sfałszowane Objection też jest odrzucane: Objection wniesione w imieniu martwego ucznia jest odrzucane w przeglądarce głównego GM-a, a gracz, którego sfałszowane Objection odrzucono, dostaje o tym wiadomość.

**Pomiń** wykonuje się w przeglądarce głównego GM-a, którykolwiek GM go naciśnie, więc naciśnięcie w chwili, gdy zegar sam przesuwa debatę dalej, nie przesuwa jej drugi raz, a naciśnięcie, które dotrze do głównego GM-a, gdy debata już przesunęła się dalej, niczego nie przesuwa i mówi ci o tym. Każdy inny przycisk paska też wykonuje się w przeglądarce głównego GM-a: konsola innego GM-a prosi głównego o działanie przycisku. Każdy przycisk paska GM-a jest też funkcją `game.drpg`: `skipStep()`, `adjustTime(seconds)`, `overruleObjection()`, `endMode()`, `returnToDebate()` - a starsze `advanceFloorNow()`, `extendFloor()` i `endFloor()` zostają.

Karty do głosowania trafiają do głównego GM-a, który sprawdza każdą, zanim ją zapisze, a do otwarcia następnego głosowania trzymają je tylko przeglądarki GM-ów (sekcja 14). **Zamknij i policz** wykonuje się w przeglądarce głównego GM-a, którykolwiek GM je naciśnie.

Werdykt jest zapisywany do zapisu rozprawy w świecie przed czymkolwiek innym, a potem wykonywany krok po kroku. Z konsoli rozprawę kończą i jej wyrok wykonują `game.drpg.setPhase` i `game.drpg.setClock`. Od 1.2.64 Reinforced Level Up dla Blackened po błędnym głosowaniu czeka w magazynie GM-ów, a wyrok Final Trial też czeka w magazynie GM-ów, nie w świecie.

Od 1.2.97 przyznawany wiersz trafia do magazynu GM-ów, zanim zostanie zapisany jego Level Up, więc GM, który wyjdzie między Level Upem wiersza a zapisem, który go odnotowuje, nie zostawia już tego wiersza do przyznania jeszcze raz. Dokończ werdykt uznaje wiersz za przyznany, gdy przybyło jego ofert (zmierzone bez przeglądarki, nie przy stole) albo jego awansów (wiersz, który wybiera GM, odczytany w kodzie). Jedna luka zostaje otwarta, odczytana w kodzie i niezmierzona: w chwili, gdy GM werdyktu się rozłącza, GM, który przejmuje jego wykonanie, może nacisnąć Dokończ werdykt, zanim dotrze ostatni zapis pierwszego.

Trzy opcje Level Upa to `LEVEL_UP_OPTIONS`, a wzrosty, które daje punkt statystyki, to `LEVEL_UP_TRAIT_RESOURCES`. Przeglądarka głównego GM-a sprawdza wybór gracza z ofertą i z arkuszem takim, jaki mają GM-owie, i zapisuje go raz. Oferty Level Upów trzyma przeglądarka każdego GM-a, dlatego przetrwają zmianę głównego GM-a. Przed tą zasadą Level Up dawał też +1 Health i +1 Sanity, a dziś nie są to już jego opcje. Level Up gracza wybrany, gdy cofnięcie tej oferty jest zapisywane, jest odmawiany jako zajęty, a drugie cofnięcie tej samej postaci w tym czasie jest odmawiane własnymi słowami w przeglądarce głównego GM-a i w przeglądarce GM-a, który poprosił o pierwsze (to odczytane w kodzie), a w przeglądarce każdego innego GM-a jako zajęte.

Raz na świat, gdy główny GM wczytuje świat, otwiera się okno o Level Upach wziętych według starszej zasady. Wymienia uczniów, których maksymalne Health albo Sanity jest wyższe niż na starcie (4 i 6), a każdy punkt ponad start liczy jako dawny wybór +1; wymienia też punkty Head, Body albo Leg z tego sezonu, które niczego nie podniosły. Zaznacz każdą zmianę, którą chcesz zrobić: cofnięty wybór daje uczniowi punkt statystyki do rozdania, dawny punkt dostaje swój wzrost, a wszystko, czego nie zaznaczysz, zostaje. Maksimum podniesione ręcznie wygląda jak dawny wybór, więc sprawdź listę. **Anuluj** pyta znowu następnym razem. Uczeń, którego nie ma żaden gracz, nie dostaje oferty: daj mu punkty własnym Level Upem.

Kopia tokenu, którą moduł przenosi do pokoju, zachowuje flagi starego tokenu, jego ukrycie i jego miejsce w walce. Spośród żywych uczniów, którzy zostali z tokenem w pokoju i drugim gdzie indziej, ci, których każdy token w pokoju jest ukryty, a jeden gdzie indziej odkryty, są wymienieni w osobnej linii, bo ten odkryty widzi ich gracz. Kopia nosi znak wskazujący token, z którego powstała, dopóki tamten token nie zniknie, i po tym znaku następne wczytanie u GM-a znajduje powrót przerwany między nimi przez zamknięcie przeglądarki GM-a.

Turę, której czas minął, kończą też przeglądarki uczestników, dlatego runda idzie dalej, nawet gdy karta przeglądarki GM-a jest w tle. `game.drpg.startTestimony({ seconds, order })` i `game.drpg.startPanicRound({ seconds, order })` zaczynają rundę z konsoli.

`game.drpg.startClosing()`, `confirmClosingSpeaker()`, `pickClosingSpeaker(actorId)`, `continueClosing(actorId)` i `resumeClosing()` robią to samo co konsola, u każdego GM-a. To, kto się zgłosił i kogo wylosowano, trzymają przeglądarki GM-ów, nigdy dane świata.

Kartę i kopie Przedstaw tworzy przeglądarka głównego GM-a, więc bez połączonego GM-a Przedstaw jest odrzucane.

„Do ujawnienia” to liczba samej opłaty, zapisana przy jej pobraniu i nigdy nie liczona od nowa. `game.drpg.missingKeys()` i `game.drpg.revealMissingKey(slot, { text, beyondPaid })` robią z konsoli to samo co Ujawnij Monokumy i działają u każdego GM-a.

Werdykt Final Trial ma własne okno: `game.drpg.verdictDialog()` i `game.drpg.applyVerdict()` też otwierają to okno, więc żadna droga nie daje Final Trial zwykłego werdyktu. Zatrzymuje się i jest dokańczany tak jak zwykły werdykt (od 1.2.97).

#### Sala rozpraw (sekcja 15.1)

Kod sali rozpraw to `scripts/trial-scene.mjs`. Z konsoli fazę, a więc wejście stołu do sali i wyjście z niej, ustawiają `game.drpg.setPhase` i `game.drpg.setClock`. Obsadę sali trzymają przeglądarki GM-ów. Przed 1.2.74 każda rozprawa otwierała się tam, gdzie był stół. To, że straceni giną w sali, zanim stół z niej wyjdzie, odczytano w kodzie, a przy stole sprawdza to LIVE-E70-06. Przeglądarka gracza, która wciąż się wczytuje, gdy sala zostaje aktywowana, przenosi się tam sama raz, gdy pierwszy raz narysuje mapę, a taka, która wczytuje się, gdy stół wychodzi z sali, przenosi się na scenę, na którą poszedł stół.

`game.drpg.showCourtroom()` i `game.drpg.showSchool()` działają tak samo jak **Pokaż salę rozpraw** i **Wróć do szkoły**, `game.drpg.trialSceneReport()` podaje podpięte sceny, tokeny obsady odkryte teraz w sali, tokeny, które moduł tam utworzył, i ostrzeżenia zakładki, a `game.drpg.openTrialCast()` otwiera zakładkę.

Kilka rzeczy o sali czeka jeszcze na sprawdzenie przy stole: czy Foundry v14 pozwala graczowi zmienić, czy jego własny token jest ukryty, gdzie ląduje przeglądarka, która wczytywała się podczas aktywacji, jak sala rysuje się z Isometric Perspective, czy Foundry v14 tworzy token z prototypu postaci tak, jak prosi o to moduł, i ile przy stole kosztuje tworzenie i usuwanie tokenów obsady.

#### Strefy sali (sekcja 15.2)

`game.drpg.startStrawPoll`, `startLogicDive`, `startScrumDebate`, `countNow`, `skipQuestion`, `findings`, `addFinding`, `editFinding`, `deleteFinding` i `confirmFinding` robią to samo co przyciski konsoli.

Kilka rzeczy o strefach sali czeka jeszcze na sprawdzenie przy stole: regiony z dziurami i Levels w v14, ruch tuż przed liczeniem na prawdziwym serwerze, strefy narysowane na canvasie i przeładowanie GM-a w trakcie pytania (LIVE-E73-01 do LIVE-E73-04).

#### Wejście i cut-in werdyktu (sekcja 15.3)

Kod sekwencji to `scripts/sequence.mjs`, `glass.mjs` i `glass-close.mjs`. Od 1.2.112 ekran, który się spóźni, odtwarza najnowszą sekwencję, która go ominęła (wybór właściciela).

Ruchu i kosztu wejścia w prawdziwym Foundry przy 1366x768 i 1920x1080 w obu motywach, jako GM i jako gracz, nie sprawdzono jeszcze przy stole; zmierzono je w headless Chromium na harnessie szkła (LIVE-E61-01). Skrótu mikrofonu, gdy sekwencja zakrywa kafelek głosu, też nie sprawdzono jeszcze przy stole (LIVE-E61-08).

### 22.16 Koniec rozdziału i reset sezonu

**Koniec rozdziału.** Wykonuje go tylko przeglądarka głównego GM-a, żeby rozdział liczyła raz jedna przeglądarka. Od 1.2.97 koniec, który się zatrzymał, zostaje zapamiętany razem z tym, co wykonał; taki koniec oraz jego Dokończ koniec rozdziału i Porzuć resztę zmierzono w harnessie bez przeglądarki, a przy stole jeszcze ich nie sprawdzono. Z konsoli `game.drpg.finishChapterEnd()` dokańcza zatrzymany koniec, a `game.drpg.finishChapterEnd({ drop: true })` porzuca resztę.

Od 1.2.97 reset zapisuje, dokąd doszedł. Zapis niedokończonego resetu zmierzono w harnessie bez przeglądarki dla grupy, która się nie udała; pozostałe dwa przypadki, czyli inny GM, który został głównym, i strona GM-a zamknięta w połowie, odczytano w kodzie. To, że zapis nie jest proponowany, gdy zegar ruszył dalej, zmierzono w harnessie bez przeglądarki dla jednej pory dnia dalej.

**Oznaczenia sezonu.** Zapisy oznaczone rozdziałem (Remnanty, Motive, Final Truth, sekcja zwłok i milczenie Monocuba o zbrodni) mają też oznaczenie sezonu. Sekcja albo milczenie zapisane przed 1.2.73 nie mają oznaczenia sezonu i liczą się jako ten rozdział, dopóki rozdział się nie skończy (zmierzone przez tier 2 zestawu testów). Postęp rozprawy i jej głosowanie, zdrada wciąż w ofercie i Truth Bullet zablokowany przez nieudane Analyze są czytane tylko po rozdziale (odczytane w kodzie).

**Starszy startowy arkusz.** Startowy arkusz zapisany przed 1.2.73 nie odróżnia doświadczenia z Level Upa od twojego, dlatego grupa *Level Upy* traktuje starszy startowy arkusz osobno: taki, który zapisał doświadczenia, zabiera każde, którego nie zapisał, także te dopisane przez ciebie ręcznie, a taki, który nie zapisał żadnych, zostawia je wszystkie; raport wymienia te doświadczenia.

**Reset i przeglądarki GM-ów.** Reset zapisuje w zegarze, kiedy się odbył, dla każdej grupy, którą wyczyścił. Przeglądarka GM-a, której nie było, przy pierwszym wczytaniu porównuje ten zapis zegara ze swoją kopią sprawy i usuwa to, co trzymały wyczyszczone grupy. Inny GM staje się głównym, gdy połączy się z niższym identyfikatorem użytkownika niż GM, który otworzył okno. To, że GM, który połączy się, gdy reset już ruszył, zatrzymuje go, zmierzono w harnessie bez przeglądarki, a przy stole jeszcze tego nie sprawdzono.

### 22.17 Dźwięk i efekty

Kod dźwięku to `scripts/music.mjs`, `music-states.mjs`, `music-play.mjs`, `murder-music.mjs`, `sfx.mjs`, `sfx-play.mjs` i `sound*.mjs`, a działa z `SFX_CATEGORIES`, `SFX_EVENTS`, `SFX_SLIDERS` i `SITUATIONAL_PLAYLIST` z `config.mjs`.

**Wiersz morderstwa.** Gdy gra wiersz morderstwa, przeglądarka gracza wstrzymuje muzykę pokoju i wznawia ją tam, gdzie stanęła, a przeglądarka GM-a ścisza ją i pozwala jej grać dalej, bo to przeglądarka GM-a przesuwa playlisty stołu. Przeglądarka, w której od wczytania nikt nie kliknął, zaczyna utwór morderstwa przy pierwszym kliknięciu, i nie zaczyna go wcale, gdy incydent już się skończył.

**Zapisywanie.** Od 1.2.94 każda zmiana w ustawieniach dźwięku zapisuje się od razu, a muzyka głównego GM-a idzie za nią mniej więcej dwie sekundy po ostatniej zmianie: kilka zmian z rzędu to jedno przejście (zmierzone w harnessie testowym z drugim GM-em; dwóch prawdziwych GM-ów tego nie mierzyło). GM, który odpina wiersz albo przywraca jego poprzednią playlistę w ciągu mniej więcej czterech sekund od zmiany tego wiersza przez innego GM-a, zobaczy, że wybór tamtego GM-a wraca raz, bo druga przeglądarka nie odróżni odpiętego wiersza od dwóch zapisów w tej samej chwili; kolejna zmiana tego wiersza już zostaje. Gdy okno jest otwarte na ekranach dwóch GM-ów, listy u drugiego pokazują stary wybór, dopóki nie otworzy okna ponownie. Stan przypisany do playlisty „Situational” przed 1.2.94 przeglądarka głównego GM-a odpina przy wczytaniu świata, bez ostrzeżenia.

**Suwaki.** Od 1.2.94 suwak *Muzyka* rysuje się na własnej skali Foundry dla głośności playlist (tej z `AudioHelper`); skalę odczytano z typów `AudioHelper`, a przy stole v14 jeszcze jej nie porównano. **Różnicuj dźwięki, które słychać często** stosuje `SFX_VARIATION`: tempo szybsze albo wolniejsze najwyżej o 14%, nigdy poniżej 0,5, i niewielkie zmiany głośności (0,18).

**Historia.** Dźwięki sekwencji przyszły w 1.2.109, a do 1.2.109 wynik głosowania nazywał się *Werdykt*. Od 1.2.105 powiadomienie o krytycznym wyniku akcji jest jedyną kartą, która wjeżdża cięciem.

**Diagnoza.** `game.drpg.diagnoseSfx()` liczy porzucone dźwięki i wymienia, co jest przypisane, wyciszone albo już zawiodło; `game.drpg.testSfx(key)` mówi, czemu dźwięk nie zagrał; `game.drpg.diagnoseMusic()` wypisuje każdy stan, czy obowiązuje i do czego jest przypisany.

### 22.18 Okno ustawień, motywy i ustawienie Język

Okno zębatki to `scripts/settings-window.mjs`, paski Foundry to `scripts/foundry-windows.mjs`, książka to `scripts/handbooks.mjs`, renderowana z `docs/handbooks`, powiadomienia to `scripts/popup.mjs`, a Historia powiadomień to `scripts/notice-history.mjs`. Na wąskim ekranie lista graczy GM-a to `#players` z Foundry.

**Narzędzia Foundry i szkło.** Otwarcie ani zamknięcie Narzędzi Foundry nigdy nie tnie szkła od nowa, tak samo otwarcie i zamknięcie Narzędzi mapy oraz strzałka Foundry u dołu paska bocznego.

**Gdzie jest kolor pory.** W motywie Stained Glass kolor pory jest na szybach i ich spoinach, na kurtynie i na ekranie pauzy; na liniach zegara (nie na jego przyciskach); na ramkach kafelka pokoju i kafelka głosu; na przyciskach w rogu i na paskach samego Foundry; na nagłówkach, ramkach i paskach przewijania okien i na krawędzi podpowiedzi; na nagłówkach tabel i wierszu pod kursorem; na tytule, ramce i narzędziach zasobnika projektów; na krawędzi pola i pola wyboru w spoczynku; na krawędzi powiadomień i ramce komunikatora; na linii Dalej i znaczku fazy w panelu GM-a; na nagłówkach arkusza postaci i jego znacznikach akcji; a na mapie na obrysie pokoju, świetle w drzwiach, znakach tajnych przejść i linijce tokenu. Nigdy nie ma go na kartach panelu zdarzeń, kafelkach akcji i Calli, przyciskach i zakładkach paneli i arkusza, paskach stanu, polu i polu wyboru z fokusem, przyciskach zegara ani na paskach sekcji panelu GM-a.

**Historia powiadomień i pełna pamięć.** Gdy inny magazyn modułu znajdzie pamięć tej przeglądarki pełną, Historia powiadomień ustępuje: najpierw odchodzą historie innych światów, potem starsza połowa historii tego świata, a do końca sesji historia trzyma o połowę mniej.

**Jeszcze niepotwierdzone przy stole.** Kilku rzeczy o oknie ustawień i szkle nie potwierdzono jeszcze przy stole. Co robi dla gracza każdy skrót na prawdziwym płótnie, nie jest jeszcze potwierdzone (LIVE-E77-11). To, że dwa okna nigdy nie tną szkła od nowa, zmierzono w przeglądarce na zastępczym pasku bocznym (LIVE-E77-02), a strzałkę paska bocznego, która też go nie tnie (od 1.2.79), zmierzono tak samo (LIVE-E79-15). To, że Shift+C najpierw otwiera Narzędzia Foundry, odczytał projekt z kodu Foundry 14, a obok innych modułów tego nie zmierzono (LIVE-E77-10). Nie potwierdzono jeszcze powiadomień czatu Foundry po zamknięciu Narzędzi Foundry (LIVE-E77-06), drogi powrotu przełącznika świata do układu Foundry (LIVE-E77-17), tego, czy Foundry v14 ładuje jeszcze arkusz stylów modułu, gdy moduł odmówił startu (LIVE-E13-11), ani tego, jak płynny jest obrót szkła przy stole, z planszą rysowaną pod nim (LIVE-E23-01). Powiadomienia Foundry pod paskiem Despair zmierzono w przeglądarce na zastępczym elemencie (LIVE-E23-08), a okno, na które gra czeka, stojące nad arkuszem, odczytano na modelu okien Foundry w harnessie (LIVE-E23-04). Zwijanie rozwiniętego czatu GM-a nie jest jeszcze potwierdzone (LIVE-E23-06), wąski ekran zmierzono na stronie harnessu (LIVE-E23-03, LIVE-E23-07), a przewijanej listy zasobnika projektów z prawdziwymi ikonami jeszcze nie potwierdzono (LIVE-E23-12).

**Historia.** Szkło i okna oraz wąski ekran są takie, jak opisano, od 1.2.101, a spoiny błyskają tak jasno jak dotąd. Pory dnia i Kolory są od 1.2.105, a obu list miejsc, w których kolor pory jest i w których go nie ma, pilnuje R3412. Zwijanie okna działa od 1.2.99; do 1.2.99 moduł blokował je we wszystkich oknach. Lista zasobnika projektów przewija się przy więcej niż pięciu wierszach od 1.2.101, a od 1.2.113 zasobnik gracza pokazuje projekt taki, jaki ostatnio widziano. Od 1.2.99 o tym, czy karty powiadomień stoją nad oknami, decyduje motyw.

**Pomiar motywu.** `game.drpg.perf()` mówi, ile **Szkło rozmywa mapę** kosztuje na tej maszynie, a `game.drpg.fps()`, ile obok niego kosztuje każdy z efektów motywu (sekcja 20).

### 22.19 Safeword

Kod safeword to `scripts/safeword.mjs`. `game.drpg.safeword()` naciska safeword z konsoli i przechodzi przez to samo okno *Zatrzymać scenę?*. Na odpowiedź przeglądarki GM-a na naciśnięcie gracza czeka się `TIMING.safewordAnswerMs` (3 sekundy). Drugie naciśnięcie gracza w ciągu `TIMING.safewordRepeatMs` (60 sekund) od karty trafia do dziennika, ale nie jest wysyłane ponownie, a notka GM-a od tego samego nadawcy w tej minucie jest pokazywana, ale nie trafia drugi raz do Historii powiadomień. Od 1.2.64 treść notatki przed sesją widzą tylko GM-owie i jej autor.

Na wspólnym komputerze Historia powiadomień każdego konta tego świata jest w jednej wartości pamięci przeglądarki. Historia innego konta nigdy nie jest przycinana, żeby zrobić miejsce: gdy historie tego świata zapełnią udział przeglądarki, ustępuje tylko historia konta zalogowanego teraz.

### 22.20 Rozwiązywanie problemów

Rejestr umowy to `scripts/patches.mjs`, a `diagnosePatches()` go wylicza. Od E101 linie umowy pokazuje **Foundry i moduły** w Dzienniku debugowania; do E101 były częścią Kontroli przed sezonem, a od E101 Kontrola przed sezonem to dalsze sprawdzenia pod wierszami Listy kontrolnej sezonu.

Co stół dostaje zamiast tego, wiersz po wierszu. Ustawienie albo flaga, które moduł wymusza, ma wiersz o nazwie `held-` z jego id, a jego opis to opis jego rodzaju: `held-flag`, `held-permissions`, `held-rtc` albo `held-setting`; `held-automation` i `held-dice-look` mają własne opisy:

| Wiersz | Co stół dostaje zamiast tego |
|---|---|
| `critical-rule` | krytyk zostaje przy liczbach samego Daggerheart |
| `roll-dialog-context` | to, co wymusza Call, jest wpisywane do okna rzutu dopiero po jego otwarciu, jak dotąd |
| `roll-draw` | rzuty są wykonywane w przeglądarce samego gracza, jak w 1.2.66 |
| `roll-marks-move-context` | znaczniki modułu na rzucie giną: rzut akcji wygląda jak rzut statystyką z arkusza, a kość Loaded Die nie jest ładowana |
| `roll-outcome-evaluated` | rzut akcji nie ma wyniku tam, gdzie moduł go czyta, więc akcja się nie odbywa |
| `dice-random-uniform` | nic nie zastępuje generatora losowego Foundry |
| `no-scrolling-text` | napisy nad tokenami unoszą się tak, jak rysuje je Foundry |
| `window-close` | okna zamykają się bez wyjścia i dźwięku z modułu |
| `window-await-transition` | okno bez trwającego przejścia czeka przed zamknięciem na własne opóźnienie Foundry |
| `livekit-toasts` | własne powiadomienia avclient-livekit pokazują się obok powiadomień modułu |
| `iso-refresh-state` | własne nadpisanie Isometric Perspective działa, gdy token jest edytowany |
| `chat-notify` | zasłonięta karta może zapalić kartę Czatu na każdym ekranie |
| `chat-content-visible` | gracz, który rzucał, nie przeczyta rzutu, który wylosował GM |
| `sheet-render-guard` | arkusz postaci przerysowuje się przy każdej zmianie zasobu, tak jak rysuje go Foundry |
| `passages-move` | żaden token nie przejdzie tajnym przejściem w tej przeglądarce, a GM jest o tym informowany przy każdym wczytaniu |
| `selection-drag-rectangle` | ramka przeciągania zostaje pomarańczowa, jak w Foundry |
| `selection-controlled-colour` | ramki tokenów zostają pomarańczowe, jak w Foundry |
| `countdown-row-menu` | menu wiersza projektu jest menu Daggerheart: widać Reveal i Hide, a Delete usuwa tylko odliczanie |
| `countdown-update` | Daggerheart przesuwa swoje odliczania poza kolejką projektów, a zmiana projektu zrobiona w tej samej chwili może przepaść |
| `door-controls` | każdy znacznik drzwi jest pokazywany tak, jak pokazuje go Foundry |
| `token-ruler` | linijka ruchu żetonu zostaje w kolorze, który daje jej Foundry albo inny moduł |
| `actions-resource` | postać nie ma zasobu Akcji |
| `sidebar-calls` | własne wywołania Foundry ani nie pokazują, ani nie ustawiają okna narzędzi Foundry |
| `relay-guard` | prośby z Daggerheart gracza, których moduł nie przejrzał, są odrzucane w przeglądarce GM-a, a GM-owie dostają o tym wiadomość raz na wersję; gdzie strażnik nie może stanąć wcale, przekaźnik nie jest strzeżony, a GM-owie są o tym informowani przy każdym wczytaniu |
| `region-included-in-level` | region, który nie wskazuje żadnego piętra, liczy się jako leżący na każdym piętrze; region, który o swoje piętro odpowiada błędem, jest czytany według pięter, które wskazuje |
| `hook-duality-configured` | kość Free Critical nie jest ładowana |
| `hook-roll-dialog-render` | okno rzutu otwarcia nie jest oznaczone jako okno otwarcia |
| `hook-character-sheet-render` | arkusz postaci jest rysowany tak, jak rysuje go Daggerheart |
| `hook-character-sheet-close` | obserwator zamkniętego arkusza patrzy na odłączony element aż do przeładowania strony |
| `hook-countdowns-render` | taca odliczań jest rysowana tak, jak rysuje ją Daggerheart, a HUD nie jest przerysowywany razem z nią |
| `hook-dice-so-nice-ready` | wyglądy kości nie są porządkowane |
| `hook-dice-so-nice-message` | Dice So Nice rzuca taki rzut na każdym ekranie, w kolorach GM-a |
| `hook-dice-so-nice-roll-start` | każda kość Hope i Despair rysuje się w wyglądzie, który nadał jej Daggerheart osoby rzucającej, a raport wyglądu kości nie wymienia żadnego rzutu widzianego w tej przeglądarce |
| `hook-livekit-initialized` | pokoje głosowe, kafel głosu i mówcy rozprawy nie podążają za klientem głosu |
| `hook-image-popout-header` | okno zdjęcia pokoju pokazuje przycisk udostępniania Foundry i każdy, który doda moduł |
| `token-bars-reserve` | paski na żetonach uczniów rosną, gdy uczeń traci punkty, jak rysuje je Daggerheart, a inny gracz widzi pasek Sanity |
| `state-icons-off-token` | ikony Breakdown i Wounded są widoczne na każdym żetonie, dla każdego |
| `dead-icon-own` | nakładka zmarłego to nagrobek z Daggerheart |
| `hook-party-sheet-render` | arkusz drużyny liczy, co każdy członek stracił, jak rysuje go Daggerheart, i pokazuje Sanity każdego członka każdemu graczowi |
| `user-permission-broadcast-audio` | niczyj mikrofon nie jest blokowany: przycisk GM-a mówi dlaczego, rozprawa również |
| `rtc-client-keys` | klucz, którego Foundry już nie trzyma, jest czytany jako domyślny (bez wyciszenia, pełna głośność, widoczny), a zapis do niego niczego nie zmienia |
| `push-to-talk-key` | wiersz o mówieniu na przycisk nie podaje klawisza |
| `av-config-menu` | przytrzymywane pola nie są wyszarzone w oknie; ich wartości i tak są przytrzymywane |
| `chat-delete-options` | wpis w historii może zostać po wycofaniu jego karty albo zniknąć przy Wyczyść czat |
| `notifications-lifetime` | historia trzyma własny czas, cokolwiek robią powiadomienia Foundry |
| `tooltip-clean-html` | słowa podpowiedzi w historii mogą się różnić od tego, co pokazała podpowiedź Foundry |
| `client-setting-sync-write` | ostatnich powiadomień sprzed przeładowania może brakować w historii |
| `livekit-room-events` | kafel głosu i mówcy rozprawy nie pokazują, kto mówi, i nie śledzą, kto dołącza ani wychodzi |
| `livekit-participant-user` | uczestnik, którego rozmowa nie potrafi nazwać, jest pominięty w kaflu głosu i wśród mówców rozprawy |
| `livekit-attach-audio` | wyciszony tu mówca może znów być słyszany, gdy LiveKit podepnie jego dźwięk od nowa |
| `voice-modes` | tryb, którego kafel nie zna, jest pokazywany jako otwarty mikrofon |
| `livekit-connected-users` | stan pokoju jest czytany tylko z pokoju rozmowy |
| `scene-controls-activate` | warstwa zostaje taka, jaka była |
| `chat-notifications` | przy zamkniętym oknie powiadomienia czatu mogą się nie pokazać, a pole czatu może zostać ukryte |
| `escape-dismiss-order` | Escape może zamknąć okna przed własnymi krokami Foundry albo nigdy |
| `focus-chat` | klawisz czatu może ustawić kursor w polu ukrytego okna |
| `image-popout-options` | okno zdjęcia może pokazywać tytuł i przyciski Foundry |
| `sheet-anchors` | to, co moduł dodaje w miejscu, którego nie znajduje, nie jest tam rysowane, a reszta arkusza jest rysowana jak zwykle |
| `foundry-rails` | pasek, którego nie znaleziono po jego identyfikatorze, zostaje tam, gdzie stawia go Foundry, poza oknem modułu |
| `interface-theme` | okna nie noszą klasy motywu, a paski w środku przejmują motyw strony |
| `camera-popout-id` | mówca z wyskakującej kamery nie jest znajdowany i liczy się jako niesłyszalny |
| `mic-audio-anchor` | mówca, którego elementu nie znaleziono, liczy się jako niesłyszalny |
| `held-flag` | flaga konta zostaje taka, jaka jest, i system czyta ją w tym stanie |
| `held-permissions` | uprawnienia zostają takie, jakie ma świat |
| `held-rtc` | dok nie jest przytrzymywany: każda przeglądarka zachowuje własny dok i okna |
| `held-setting` | ustawienie nie jest przytrzymywane: zostaje takie, jakie ma każda przeglądarka |
| `held-automation` | nic nie jest wyłączane: automaty Vulnerable i Defeated z Daggerheart działają obok automatów modułu |
| `held-dice-look` | żaden wygląd nie jest przytrzymywany: kości każdego gracza zachowują własny wygląd |

**Wersje wywołań.** `perf()` od 1.2.69 pokazuje też, ile trwała droga rzutu, który losowała twoja przeglądarka, a od 1.2.82 krok „asked to dice started”. `fps()` i `counters()` są od 1.2.89. `sheetWrites()` od 1.2.69 pokazuje wiersze refused, forged i rewrite oraz przyrost z przekaźnika pokryty własnym rzutem gracza. `publicRoll(formula, { flavor })` jest od 1.2.69, a jego kafelek w panelu GM-a usunięto w 1.2.98 (odczytane w kodzie).

**Czyj był rzut.** Od 1.2.65 rzut, który rzuca moduł, nie nazywa nikogo w swoim dokumencie (sekcja 1), a przeglądarka głównego GM-a dowiaduje się, czyj był, od przeglądarki rzucającego. Co się liczy, gdy ta wiadomość przepadnie przy przeładowaniu, mówi sekcja 20.3.

**Historia API makr.** Nazwa, która nie jest ani id, ani nazwą żadnego aktora, kiedyś nic nie robiła w API makr, a teraz ostrzega. Nazwa wspólna dla dwóch aktorów przed ostrzeżeniem działała na pierwszego i nadal na niego działa. `migrate1_2_0` zostaje co najmniej do 1.3.1.

**fps() i światło rysowane raz.** Od 1.2.89 poświata pierścieni i obrysu pokoju jest rysowana raz i przechowywana jako obrazek, i to liczy *Seams' light drawn once*. **Szkło rozmywa mapę** stoi pierwsze w kolejności wyłączania, bo w przeglądarce rysującej bez karty graficznej zajmowało większość czasu klatki we własnym pomiarze modułu.

**Co zmieniło 1.2.91.** Odczyt tokenu przeciąganego przez pokoje jest od 1.2.91. Ruch własnego tokenu gracza w obrębie pokoi, w których już stoi, każe teraz w przeglądarce przeciągającego ponownie sprawdzać mniej tokenów, tak samo `sightRefresh` w trakcie ruchu, w każdej przeglądarce. Policzono to w testach modułu na modelu przeciągania; nie zmierzono tego przy stole i nie wiadomo, czy lag zniknął. 1.2.91 zmieniło też wspólne wycięcie przycisków w Stained Glass (kafelki panelu GM-a, przyciski w stopce), tak by nie zasłaniało już ramki; sprawdzono to tylko w Chromium bez karty graficznej i nie wiadomo, czy migoczące krawędzie zniknęły.

### 22.21 Lista kontrolna sesji

**Co przechowują tylko przeglądarki GM-ów.** Klucze odpowiedzi, Remnanty i Mastermind są przechowywane tylko w przeglądarkach GM-ów, a od 1.2.64 także budujący pułapki i ich wyzwalacze, plan Key Remnantów, notatki i śmierci, których nikt nie znalazł; dlatego plik kopii sprawy trzymaj tam, gdzie żaden gracz go nie otworzy.
