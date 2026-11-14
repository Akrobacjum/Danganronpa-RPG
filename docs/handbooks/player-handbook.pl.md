# Danganronpa RPG - Podręcznik gracza

*Dla uczniów killing game. Moduł w wersji 1.2.112, zbudowany na Daggerheart dla Foundry VTT v14.*

To cała gra widziana z miejsca gracza: co znaczą liczby na arkuszu, ile kosztuje akcja, co kupuje Hope, co się dzieje, gdy ktoś ginie, i co nacisnąć. Każda liczba tutaj jest liczbą modułu; tam, gdzie decyzja należy do człowieka, napisano "GM decyduje". Jak moduł działa od środka, opisuje rozdział 17.

> [!NOTE]
> Nazwy własne gry piszemy wielką literą: Hope, Despair, Sanity, Truth Bullet, Remnant, Blackened, Class Trial, Daily Life, Eclipse, Mastermind, Monokuma, Monocub, nazwy Calli i akcji, Ultimate, Key Remnant.

Niektóre nazwy gry pojawiają się, zanim wyjaśni je ich rozdział. Oto każda w jednej linijce:

- **Hope** to to, co zarabiają twoje dobre rzuty i co wydajesz na Hope Calle, drobne przysługi kupowane z arkusza (rozdział 5). **Despair** karmią twoje złe rzuty: to pieniądze Monokumy, wydawane na Despair Calle przeciw tobie (rozdział 6).
- **Monokuma** to gospodarz killing game, grany przez GM-a, a każdy Monokuma ma własną pulę Despair (rozdział 6). **Monocub** to postać, którą gracz zmarłego ucznia może grać dalej, z własnymi kafelkami (rozdział 13).
- **Remnant** to to, co czyn zostawia w pokoju, żeby inni mogli to znaleźć: dowód w tej grze (rozdział 8). W pięciu nazwach akcji zostało starsze słowo na Remnant i ono też znaczy Remnant: Erase a Trace, Reshape a Trace, Secure a Trace, Hide the Traces i Follow My Traces. **Key Remnant** to Remnant, który GM-owie umieszczają, żeby sprawę dało się rozwiązać (rozdział 8).
- **Truth Bullet** to twoja kopia Remnantu i jedyna rzecz, którą możesz przedstawić na rozprawie (rozdział 8).
- Blackened to uczeń, który popełnił morderstwo w tym rozdziale i którego klasa musi wskazać w Class Trial (rozdział 12). Mastermind to uczeń, który potajemnie zbudował killing game (rozdział 12, Final Trial).
- Morderstwo toczy się jako incydent, czyli scena rozgrywana w turach (rozdział 10). Incydent ma akcje kryzysowe: ruchy osób, które w nim utknęły.
- **Tier** przedmiotu mówi, jak dobrze spełnia on swoje zadanie, w skali od 0 do 3 (rozdział 7).
- Doświadczenie to coś, czego twoja postać się nauczyła albo co przeżyła, nazwane kilkoma słowami, z premią obok; Hope Call Talent dodaje tę premię do jednego rzutu (rozdział 5). **Level Up** to nagroda, którą rozdaje GM: każdy ocalały dostaje Level Up, gdy klasa wskaże Blackened, a Level Up może podnieść doświadczenie albo dodać nowe (rozdział 12).

---

## 1. Kim jesteś

Jesteś **Ultimate**: tym jednym, w czym ta postać jest najlepsza, wpisanym pod jej imieniem na arkuszu. Ten tytuł mówi, kim jest twoja postać. Twój Ultimate działa też przez Hope Call **Talent** (rozdział 5): gdy pasuje do twojego następnego rzutu, a GM to zatwierdzi, ten rzut ma przewagę.

Portret zmienia GM: kliknięcie go na twoim arkuszu niczego nie otwiera.

### Statystyki

Sześć cech Daggerheart nosi tu inne nazwy. Na arkuszu widzisz te statystyki:

| Statystyka | Skrót | Czym jest | Do czego służy |
|---|---|---|---|
| **Leg** | LEG | Szybkość fizyczna | Projects, bieg, akcje kryzysowe |
| **Body** | BOD | Siła fizyczna | Projects, walka, przenoszenie ciężarów, zmuszanie kogoś do pokazania kieszeni |
| **Hand** | HAN | Zręczność i precyzja | Search, Palm, Projects, akcje kryzysowe |
| **Eye** | EYE | Spostrzegawczość i zauważanie rzeczy | Search, Observe, wyczucie pułapki |
| **Shadow** | SHA | Ukrywanie się i szósty zmysł | Listen, Tamper, pozostanie niezauważonym, zacieranie Remnantów |
| **Head** | HEA | Łączenie faktów | Analyze, Projects, wyczucie pułapki |

Przy tworzeniu postaci rozkład to **+2, +1, +1, 0, 0, -1**, a rozkładasz go, jak chcesz.

### Zasoby startowe

| Zasób | Start | Maksimum |
|---|---|---|
| Health | 4 | 4 (rośnie z Level Upami) |
| Sanity | 6 | 6 (rośnie z Level Upami) |
| Hope | 2 | 6 |
| Akcje na porę dnia | 2 | - |
| Free Move na porę dnia | 1 | - |
| Doświadczenia | 2, po +2 każde | - |
| Przedmiot startowy | jeden przedmiot Tier 2 powiązany z twoim Ultimate, uzgodniony z GM-em | - |

Twoje liczby zmieniają się w grze: przez wydaną akcję, rzut, Rest, użyty przedmiot, Call, Level Up. Pokazują je kropki na twoim arkuszu, na arkuszu drużyny i na twoim tokenie, a kliknięcie kropek niczego nie zmienia.

Jeśli mimo to zmienisz liczbę na arkuszu ręcznie, zmiana zostaje sprawdzona. Gdy GM ma włączone **Zablokuj graczom zasoby na karcie**, a tak jest domyślnie, statystyka, maksimum albo Hope, których nic w grze nie tłumaczy, wracają od razu i dostajesz o tym wiadomość; utrata Health, Sanity albo akcji zostaje, a zysk, którego nic w grze nie tłumaczy, trafia do GM-ów, którzy decydują. Gdy blokada jest wyłączona, taka zmiana zostaje, a GM-owie widzą ją na swojej liście.

### Dwa stany, których nie chcesz

| Stan | Kiedy | Efekt |
|---|---|---|
| **Breakdown** | Sanity się skończyło | utrudnienie na każdym rzucie, dopóki nie wróci trochę Sanity |
| **Wounded** | Health się skończyło | o jedną akcję mniej na porę dnia w Daily Life i w Investigation, dopóki nie wróci trochę Health; w Class Trial nie tracisz przez to akcji |

> [!NOTE]
> Breakdown i Wounded włączają się same w chwili, gdy zapas się skończy; stan, który Daggerheart nakłada za brak Sanity, i jego Death Move są wyłączone. Poza morderstwem nic w tym module nie zabija cię za spadek Health do zera; w morderstwie ofiara, której nie zostało ani Health, ani Sanity, umiera (rozdział 10). Zabić cię może tylko człowiek; o ofierze morderstwa klasa dowiaduje się dopiero, gdy ktoś znajdzie ciało albo GM ujawni tę śmierć.

### Co mówi twój arkusz

- **Co zostało.** Pod każdym z dwóch pasków arkusz mówi, ile zostało, a obok, ile może być najwięcej: **3 / 4** dla Health, **6 / 6** dla Sanity. Nietknięty uczeń ma dwa pełne paski, a pasek skraca się, gdy cię ranią. Przy włączonym **Zablokuj graczom zasoby na karcie** twój arkusz nie ma pola na tę liczbę; przy wyłączonym pole jest, a wpisujesz w nie, ile ci zostało. Dwa paski twojego tokenu czyta się tak samo, pełne u nietkniętego ucznia, i na tokenie nie da się w nie wpisać liczby.
- **Sanity jest tylko twoje.** Inny gracz, który otworzy twój arkusz albo przeczyta twój wiersz na arkuszu drużyny, widzi twoje Health i **?** w miejscu Sanity, a twój token nie pokazuje innym graczom paska Sanity. Ty i GM-owie widzicie i Health, i Sanity. Sanity jest ukryte tylko na ekranie (rozdział 17).
- **Rzut w Breakdown.** Dodatkowa kość na karcie rzutu nazywa się **Disadvantage**, a karta nikomu nie mówi nic więcej o przyczynie. Przyczynę podają ci twoje własne okno rzutu i odprawa akcji kryzysowej; inny gracz nie przeczyta jej na karcie.
- **Breakdown i Wounded są na twoim arkuszu, dla wszystkich.** Kto otworzy twój arkusz, widzi pod twoim Health i Sanity plakietkę, gdy jesteś w Breakdown albo Wounded. Inny gracz, który zobaczy plakietkę Breakdown, wie więc, że twoje Sanity się skończyło, choć nie zna jego liczby. Żaden token nie pokazuje żadnej z tych ikon, także twój; nakładka śmierci nadal jest rysowana na tokenie.
- **Twoja przeszłość.** Część biograficzna twojego arkusza ma pole z podpisem **Przeszłość**, na to, kim twoja postać była przed killing game. Zapisuje się samo, gdy z niego wyjdziesz, przełączysz się na inną zakładkę albo zamkniesz arkusz; arkusz, którego nie możesz edytować, pokazuje je tylko do odczytu, a arkusz innego gracza w ogóle nie ma Przeszłości (rozdział 3, Co widzisz). Jeśli ktoś inny zmienił twoją Przeszłość, gdy pisałeś, dowiadujesz się o tym raz, a twój tekst zostaje w polu; kolejne kliknięcie poza polem zapisuje twój tekst w miejsce tamtego.
- **Twój arkusz nadąża za grą.** Gdy zmieniają się twoje liczby albo twoje rzeczy, twój otwarty arkusz to pokazuje, a to, co właśnie piszesz, zostaje po odświeżeniu arkusza.
- **Arkusz zmarłego ucznia** zostaje jako zapis, z pieczęcią **Nie żyje**, a nagłówek nadal pokazuje Hope, akcje i Move. Przy przedmiotach nie ma przycisków do użycia, wyrzucenia, przekazania, udostępnienia ani schowania, nie ma też Przedstaw ani Analyze. Arkusz mówi, co czeka zmarłych w Class Trial: twój mikrofon jest wyłączony i nie dostajesz karty do głosowania. Gdzie trafia twój głos poza rozprawą, mówi rozdział 13.

### Rzuty

Każda akcja to rzut dwoistości z Daggerheart: kość Hope i kość Despair (obie d12) plus twoja statystyka. Wyższa kość decyduje, czy rzut wypada z Hope, czy z Despair, a para takich samych to **krytyk**.

- Rzut **z Hope** daje ci 1 Hope.
- Rzut **z Despair** zasila pulę Despair Monokumy, który cię pilnuje (rozdział 6). Stąd bierze się jego waluta: z twojego pecha i twojego ryzyka.
- **Krytyk** daje 2 Hope i nic więcej; inaczej niż w czystym Daggerheart nie przywraca Sanity.

Okno rzutu jest dla graczy zablokowane: kości, statystyka, przewaga, doświadczenia i premie biorą się z akcji, z Calla, za który zapłaciłeś, z miejsca, w którym stoisz, albo od GM-a. Zmieniasz tylko to, co akcja pozwala ci wybrać.

Kości rzutu akcji i statystyki klikniętej na arkuszu rzuca za ciebie GM, a spadają na twoim ekranie jako twój rzut. Jeśli chwilę nie ruszają, powiadomienie mówi *GM rzuca twoimi kośćmi.*, dopóki nie ruszą. Do twojej sumy liczy się to, co do kości dodają twoja akcja, twoje Calle, miejsce, w którym stoisz, i GM. Gra pomija wszystko inne, co dołożysz w oknie rzutu, a także kość, którą okno pokazuje o innych ściankach albo w innej liczbie; twoja własna karta mówi, co się policzyło, a co nie.

Twój wygląd kości ustala GM. Twoje kości nie mają własnych efektów specjalnych: jedyne efekty na nich to te, które GM oznaczy jako globalne. Wygląd, który wybierzesz w Dice So Nice, dla siebie albo na swojej postaci, wraca do wyglądu GM-a; ustawienia wyświetlania i wydajności zostają twoje. Przy **Wszyscy: Daggerheart** twoje kości Hope, Despair, przewagi i utrudnienia mają kolory samego Daggerheart. Dopiero gdy GM ustawi **Wygląd kości przy stole** na **Każdy gracz własny**, wygląd znów ustawiasz sam.

Kliknij statystykę na arkuszu, gdy GM poprosi cię o rzut poza akcją. To rzut reakcji: nie daje Hope i nie zasila Despair, cokolwiek pokażą kości.

### Jeśli jesteś Widzem

GM może zrobić z twojej postaci **Widza**: oglądasz i nie grasz. Nie masz akcji, Hope, Calli ani Level Upów, a gra nigdzie cię nie wlicza. Inni gracze nie widzą twojego tokenu, a twój mikrofon jest wyłączony. **Porozmawiaj z Widzami** na twoim kafelku głosu pozwala ci rozmawiać z innymi Widzami, a ten sam przycisk, teraz **Wróć do swojego pokoju**, cię cofa; jeśli GM wyłączył kafelek głosu, tego przycisku nie ma. Ruszasz się, przeciągając token, bez kosztu. Widzisz każdy pokój, który klasa odkryła, tokeny wszystkich i każdy projekt, także tajny, z jego opisem, w każdym pokoju. Na koniec dnia plansza końca dnia pokazuje ci tylko swój nagłówek i nastrój szkoły. Nie masz czatu.

Gdy twoja postać zginie, oglądasz tak samo, z własnym Widzem: ma imię i obrazy twojej postaci i stoi tam, gdzie leży twoje ciało. Możesz go przeciągnąć dokądkolwiek, bez kosztu, a inni gracze go nie widzą. Nadal widzisz tylko to, co widzi zmarły uczeń. Jeśli zostaniesz Monocubem, jego token stanie się twoim Monocubem.

W chwili twojej śmierci szkło na twoim ekranie szarzeje, z dźwiękiem Gaśnięcia; przy egzekucji szarzeje od razu, a dźwięk egzekucji słyszysz razem ze wszystkimi. Szkło zostaje szare, dopóki nie żyjesz, i rozświetla się znowu, gdy zostaniesz Monocubem albo wrócisz do życia. Szare szkło widać tylko na twoim ekranie.

---

## 2. Czas

### Dzień, sesja, rozdział

Jedna sesja to jeden dzień w fikcji, a dzień to pięć pór dnia: Rano, Południe, Popołudnie, Wieczór, Noc. Każda pora dnia odnawia twoje dwie akcje, Free Move i Search Tokeny każdego pokoju. Gdy kończy się Noc, zaczyna się nowy dzień.

Kanoniczny rozdział to pięć sesji: trzy Daily Life, jedna sesja **Investigation** i jedna sesja **Class Trial**, a morderstwo przychodzi zwykle w trzeciej sesji Daily Life. GM może rozciągnąć rozdział, gdy morderstwa jeszcze nie było. Sezon to sześć rozdziałów; sezon modułowy to krótszy sezon, który GM może wybrać zamiast niego, i ma jeden rozdział.

Trzy fazy:

| Faza | Czym jest |
|---|---|
| **Daily Life** | Żyjecie w zamkniętym miejscu, z dwiema akcjami na porę dnia. Dopóki nikt nie znajdzie ciała, to ta część, w której decydujesz, komu ufasz. |
| **Investigation** | Znaleziono ciało. W Investigation używasz Observe i Analyze, żeby zbierać Truth Bullety. To, czego nikt nie znajdzie, kosztuje Despair, a na rozprawie Monokuma może to ujawnić. |
| **Class Trial** | Wszyscy są w sali i jedno z was to zrobiło. Na Class Trial składają się Testimony, Objection i na koniec głosowanie. |

### Eclipse

Przed każdą porą dnia gasną światła. Ten czas na ustawienie tokenów to **Eclipse**:

- Podczas Eclipse nikt nie widzi na ekranie cudzych tokenów, w żadnym pokoju. Głos jest wtedy wyłączony dla wszystkich graczy: nikogo nie słyszysz i nikt nie słyszy ciebie, dopóki nie wrócą światła.
- W Eclipse ustawiasz swój token najwyżej o 2 przejścia między połączonymi pokojami, a drzwi i przerwy w ścianach wciąż obowiązują. Token przesunięty ponad limit wraca na miejsce. Wyjątkiem jest Eclipse przed Nocą: wybierasz dowolny pokój na mapie. Akcja pokoju może dać ci więcej przejść na najbliższe Eclipse, a jej wiersz mówi, ile.
- Twoje akcje są już odnowione, gdy Eclipse się zaczyna, ale podczas Eclipse wydajesz je tylko na **Direct Murder**. Calli nie użyjesz, dopóki nie zapali się światło.
- Gdy kończy się pora dnia, z Eclipse albo bez, na środku ekranu otwiera się karta z podsumowaniem tego, co w niej zrobiłeś: co znalazłeś i co zostawiłeś. Otwiera się raz na każdą porę dnia, gdy zegar się obróci, a gdy gra plansza końca dnia, podsumowanie Wieczoru jest jej częścią.
- Eclipse to jedyny moment pełnej osłony w grze i zwykle tu zaczyna się morderstwo. Nie jest częścią dnia: zegar nie rusza, dopóki GM nie zakończy Eclipse.

**Zanim zegar się przesunie**, GM może zapytać, czy już kończysz. Okno mówi, co GM chce zrobić: zacząć Eclipse, zakończyć je albo zakończyć tę porę dnia, i ma przyciski **Gotowe** i **Jeszcze chwila**. **Jeszcze chwila** mówi GM-owi, że potrzebujesz trochę więcej czasu, a okno zostaje potem z samym **Gotowe**. Gdy wszyscy gracze odpowiedzą **Gotowe**, gra rusza dalej sama; GM może też ruszyć wcześniej. Okno zamyka się, gdy GM rusza dalej albo postanawia jeszcze chwilę poczekać. Jeśli zamkniesz je sam, na ekranie zostaje karta, dopóki GM czeka; kliknij ją, żeby odpowiedzieć.

Zaciemniona pora dnia (Overflow, rozdział 6) może zmniejszyć liczbę przejść albo odebrać wolny wybór pokoju.

### Chwile na cały ekran

Kilka chwil wypełnia na kilka sekund każdy ekran. Esc pomija taką chwilę, a przy ograniczonych animacjach widzisz nieruchomą klatkę. GM może wyłączyć te chwile dla całego stołu (**Sekwencje na cały ekran**), ale dźwięki rozprawy i werdyktu grają wtedy nadal.

- **Wejście do Class Trial.** Ekran zasłania się napisem **CLASS TRIAL** i odsłania salę rozpraw.
- **Koniec Class Trial.** Ekran zasłania się napisem **KONIEC ROZPRAWY** i odsłania szkołę.
- **Werdykt.** Portret skazanego ucznia, głosy i pieczątka: **WINNY**, gdy klasa trafiła, **NIEWINNY**, gdy się pomyliła.
- **Obroty zegara.** Kurtyna obraca się, gdy zmienia się pora dnia. Investigation zaczyna się błyskami szyb, a ogłoszenie ciała sprawia, że kurtyna migocze.
- **Koniec dnia.** Plansza końca dnia pojawia się, gdy zapada Noc albo kończy się rozdział. Pokazuje, co zrobiłeś tego dnia, co widziała szkoła i nastrój szkoły: Spokój, Niepokój albo Na krawędzi. Zostaje w twojej historii powiadomień.
- **Początek dnia.** Plansza początku dnia pojawia się, gdy zaczyna się nowy dzień, i pokazuje dzień i wszystkich na swoich miejscach; zmarli są wyszarzeni, z podpisem „pamiętamy”. Jeśli GM napisał zdanie na poranek, plansza je pokazuje.

Jeśli dołączysz albo odświeżysz stronę w ciągu 10 minut od wejścia do Class Trial, werdyktu albo planszy początku dnia, najnowsza z tych chwil, której jeszcze nie widziałeś, zagra dla ciebie raz. Pozostałe chwile, które minęły przed twoim dołączeniem, cię omijają.

---

## 3. Ruch i widzenie

### Pokoje

Szkoła narysowana jest jako pokoje. Ruch, Search, Listen, to, kto cię słyszy, i każdy incydent: wszystko to rozstrzyga się według pokoju, w którym stoi twój token.

| Ruch | Koszt |
|---|---|
| Ruch wewnątrz własnego pokoju | za darmo, zawsze |
| Pierwsze przejście do połączonego pokoju o tej porze dnia | twój **Free Move** |
| Każde kolejne przejście | **1 akcja** za każde |
| Po schodach w górę lub w dół do innego pokoju | przejście jak każde inne; zmiana piętra na klatce schodowej to ruch wewnątrz własnego pokoju |
| Przejście, gdy masz darmowe przejście (kupione Hope Callem Sprint, wybiegane Dashem albo dane przez akcję pokoju z Facilities) | to darmowe przejście |
| Przejście, gdy nie masz już Free Move ani darmowego przejścia, a masz Burst | twój **Burst**, zanim pójdzie akcja |

Ruszasz się, przeciągając token, a koszt ruchu płacisz, gdy dotrzesz. Briefing Move mówi, czym zapłacisz za wejście do następnego pokoju: Free Move, darmowe przejście, twój Burst albo akcję. Przejście, którego nie masz czym opłacić, zostaje odrzucone, a token wraca.

Zawraca cię:

| Przyczyna | Szczegóły |
|---|---|
| pokój, który **nie łączy się** z twoim | odmowa wymienia tylko te sąsiednie pokoje, w których już byłeś |
| **piętro**, na które schody z twojego pokoju nie prowadzą | na mapie ze schodami tylko one zabiorą cię w górę lub w dół |
| **zamknięte drzwi** | GM zamknął pokój |
| **zapieczętowany pokój** | Despair Call Behind Closed Doors, na jedną porę dnia |
| **Przykuty** przez Despair Call Chained | nie wyjdziesz z pokoju do końca pory dnia |
| **cudza sypialnia** | gdy nie masz do niej klucza |
| twoja postać **nie żyje** | ciało zostaje tam, gdzie upadło |
| **morderstwo**, w którym bierzesz udział, dopóki trwa | nikt nie wychodzi z incydentu, dopóki nie pozwoli mu akcja kryzysowa: Survive, Escape Together, Finishing Blow albo Averted Eyes, jeśli tylko wszedłeś w trakcie |
| **Class Trial** w toku | nikt nie opuszcza sali rozpraw |

Ruch, który któraś z tych przyczyn zatrzymuje, cofa twój token tam, gdzie ostatnio stał, a ty dowiadujesz się, która zasada cię zawróciła. GM może też oddać ci ostatnie przejście (**Zwróć ostatnie przejście**): token wraca tam, gdzie stał, a koszt przejścia do ciebie wraca.

GM może wyłączyć cenę przejść; wtedy to, które pokoje się łączą, razem ze schodami, ocenia sam poza Eclipse.

**Tajne przejścia.** Niektóre ściany kryją tajne przejście. Gdy twoja postać je zna, twój token przechodzi przez ten odcinek ściany jak przez drzwi, a ten krok to przejście jak każde inne; dla wszystkich innych to ściana. Tajnym przejściem wejdziesz do cudzej sypialni bez klucza, ale zamknięte drzwi, zapieczętowany pokój, Chained, trwające morderstwo i Class Trial nadal cię przy nim zawracają. Mastermind zna każde tajne przejście.

Twój arkusz wypisuje znane ci przejścia pod **Znane tajne przejścia**: nazwa przejścia pokazuje je na mapie, a **droga zamknięta** obok niej znaczy, że z miejsca, w którym stoisz, się nie otwiera. **Pokaż tajne przejście** pokazuje je innemu uczniowi w tym samym pokoju, który od tej chwili też może nim przechodzić; nie kosztuje to akcji, a GM-owie się o tym dowiadują. GM może też dać ci tajne przejście, a niektóre znasz od startu sezonu; reset sezonu zostawia ci tylko te, które znałeś od startu. Tajne przejście może też zbudować projekt (Secret Passage, rozdział 4). Gdy GM ujawni przejście, zna je każdy uczeń, dopóki GM go znów nie utajni.

Niektóre przejścia to tunel lub schody między dwoma pokojami, na jednym piętrze lub dwóch: koniec w twoim pokoju jest oznaczony "Tajne przejście do:" i nazwą pokoju, do którego prowadzi. Przeciągnij token na znacznik tego końca, żeby przejść, albo stań na znaczniku lub na polu obok niego i naciśnij **Przejdź** obok niego pod **Znane tajne przejścia**: tak czy inaczej kosztuje to tyle, co drzwi, a wychodzisz przy dalszym końcu, na jego piętrze. To, co zawraca cię przy drzwiach, zawraca cię i tu, tymi samymi słowami, a zawrócenie nic nie kosztuje. Wszyscy widzą, jak twój token przechodzi, tak jak widzą każdy ruch tokenu.

Gdy GM ustawił tunel w jedną stronę, pisze o tym pod jego nazwą: drugim końcem, oznaczonym "Tajne przejście z:" i nazwą pokoju, z którego prowadzi, nie wejdziesz. Przejście w ścianie nie ma przycisku: lista podpowiada pod nim, żeby przejść przez przerwę w ścianie.

### Co widzisz

- Pokój, w którym jesteś, jest w pełnym kolorze. Pokoje, w których już byłeś, prześwitują zza zasłony. Reszta szkoły tonie we mgle, dopóki do niej nie wejdziesz: każda postać odkrywa pokój raz, wchodząc do niego. Podczas Eclipse nawet pokój, w którym stoisz, jest tylko za zasłoną.
- Na mapie o kilku piętrach widzisz jedno piętro naraz. Przyciski **Piętra** obok HUD proponują piętra, na których stoi twoja postać, i każde piętro z pokojem, który odkryłeś, od najniższego. Odkryty pokój wygląda tak samo na każdym piętrze - za zasłoną, bez nikogo, kogo widzisz - a pokój, w którym nigdy nie byłeś, na każdym piętrze zostaje we mgle.
- Widzisz ikony drzwi tych pokoi, które widzisz: tego, w którym stoisz, i tych, w których już byłeś. Innych ikon drzwi nie widzisz.
- Widzisz tylko osoby stojące w twoim pokoju. Nikogo innego dla ciebie na mapie nie ma.
- **Kafelek pokoju** stoi pod zegarem, a gdy ekran nie zostawia tam miejsca, na prawo od powiadomień. Pokazuje pokój, w którym stoi twoja własna postać, nigdy inny: jego nazwę, jego Search Tokeny z liczbą przeszukań, które zostały (**2/3 przeszukań**), **Możesz tu pracować nad projektem**, gdy jest w nim projekt, nad którym możesz pracować, oraz zdjęcie i opis pokoju od GM-a.
- Opis pokoju jest schowany za małą strzałką w prawym górnym rogu kafelka: **Czytaj dalej** rozwija go nad zdjęciem, a **Zwiń opis** zwija z powrotem. Kliknij zdjęcie, żeby zobaczyć je w dużym rozmiarze, tylko na swoim ekranie.
- Podczas Class Trial kafelek pokazuje salę rozpraw: nazwę, zdjęcie i opis od GM-a albo "Class Trial". Na wąskim ekranie kafelek jest jednym wierszem stosu: małe zdjęcie (kliknij je, żeby zobaczyć duże), nazwa, Search Tokeny i przycisk **Opis**, który otwiera opis w oknie.
- Zegar w lewej kolumnie da się kliknąć: tłumaczy fazę, porę dnia i to, gdzie jesteś, a jeśli GM napisał opis pokoju, wypisuje go.
- Arkusz innego gracza otwiera się ocenzurowany (rozdział 1, Co mówi twój arkusz): imię, portret, Ultimate, Health, to, co trzyma w ręku, i ile ma doświadczeń. Nic więcej. Hope i Sanity innego ucznia to **?**, bez maksimum.

### Głos

Gdy włączone jest **Głos osobno w każdym pokoju**, każdy pokój jest osobnym kanałem głosowym. Słyszysz tych, którzy stoją z tobą w pokoju, a twój głos idzie za tokenem w chwili, gdy ten wejdzie do innego pokoju. Gdy stoisz w drzwiach albo na korytarzu, który nie jest pokojem, zostajesz w kanale pokoju, z którego przyszedłeś, dopóki nie wejdziesz do innego pokoju, więc przejście przez drzwi zmienia twój kanał raz, a kto wyjdzie tak z twojego pokoju, też zostaje w twoim kanale. Gdy kończy się Eclipse (rozdział 2), wracasz do kanału pokoju, w którym stoi twój token. Podczas Class Trial wszyscy są w jednym pokoju głosowym, także zmarli, gdziekolwiek stoi ich token (rozdział 12). Monokuma, który wejdzie do twojego pokoju, słyszy cię jak każdy inny, a ty go widzisz.

**Kafelek głosu** to mały kafelek, który zastępuje dok kamer Foundry, gdy jesteś w głosie. Pod Stained Glass jest szybą witrażu przy prawej krawędzi, pod tacką Projects; pod Monokuma Legacy stoi przy prawej krawędzi, nad przyciskami w rogu; na wąskim ekranie jest w rzędzie obok kafelka pokoju. Pokazuje portret i imię osoby, która właśnie mówi w twoim kanale głosowym, i nikogo spoza niego, a chwilę po tym, jak ktoś przestanie mówić, gaśnie. Razem z dokiem znikają jego obrazy z kamer, jakość połączenia i okna wyskakujące; jeśli GM wyłączy kafelek, dok wraca.

Gdy nikt nie mówi, kafelek mówi jednym słowem, w jakim stanie jest twój głos. Wskaż słowo, żeby zobaczyć całe zdanie.

| Słowo | Kiedy |
|---|---|
| **Połączono** | jesteś w głosie |
| **Łączenie** | dołączasz, przechodzisz do innego kanału albo połączenie wraca |
| **Rozłączono** | głos się zerwał; karta **Głos rozłączony** mówi wtedy, że trwa ponowne łączenie, a gdy pomoże tylko przeładowanie, każe nacisnąć F5 |
| **Eclipse** | trwa Eclipse |
| **Zablokowano** | GM zablokował twój mikrofon |
| **Osobne okno** | głos działa w osobnym oknie |

Na kafelku są dwa przyciski. Przycisk mikrofonu wycisza i włącza tylko twój mikrofon; to samo robi klawisz w sterowaniu Foundry, gdy go przypiszesz. Wygląd tego przycisku mówi, w jakim stanie jest mikrofon.

| Mikrofon | Co znaczy |
|---|---|
| przekreślony | wyciszony, przez ciebie |
| przekreślony, z małą kłódką | wyciszony przez GM-a: **GM zablokował twój mikrofon.** |
| szary i przekreślony | trzyma go gra podczas Eclipse, a powód stoi pod mikrofonem; kliknięcie niczego wtedy nie zmienia i mówi ci dlaczego |
| z małą kropką | nie jesteś połączony z głosem albo głos działa w osobnym oknie |
| świeci | twój mikrofon niesie twój głos |
| z napisem **PTT** | tryb naciśnij, aby mówić: przytrzymaj klawisz, żeby mówić |

Monocub zachowuje mikrofon podczas Eclipse i dostaje informację, że do powrotu światła nikt go nie słyszy. W kanale zmarłych mikrofon zostaje twój: wyciszasz go i włączasz sam, a linijka pod nim mówi, gdzie jesteś.

Głośnik pokazuje, ile innych osób jest w twoim kanale, licząc każdą, która cię słyszy, mówiącą czy nie, i otwiera **Kogo słyszysz**: każdą z tych osób z suwakiem głośności i **Wycisz u siebie: *imię*** (potem **Znów słuchaj: *imię***), a na górze **Wycisz wszystkich u siebie**. Te ustawienia działają tylko u ciebie; inni przy stole niczego nie zauważą. Escape albo kliknięcie obok zamyka listę.

> [!TIP]
> Żeby dowiedzieć się, kto jest za ścianą, bez wchodzenia, użyj **Listen** (rozdział 4, Infiltrate).

### Search Tokens

Każdy pokój ma na porę dnia pewną liczbę przeszukań, czyli **Search Tokens**: domyślnie 3, a GM ustawia od 0 do 10. Każde Search wydaje jeden Search Token. Przeszukany do cna pokój jest przeszukany dla wszystkich, dopóki zegar się nie przesunie, a HUD mówi, ile zostało tam, gdzie stoisz. Jeśli Search kończy się komunikatem *Przeszukanie nie zostało policzone.*, zachowujesz akcję, a pokój zachowuje token. Pokój, który GM zapieczętował, mówi ci, że nie da się go przeszukać, a akcję zachowujesz.

---

## 4. Akcje

Masz **2 akcje** na porę dnia (1, gdy jesteś Wounded, w Daily Life i w Investigation). Siatka akcji na arkuszu ma dziesięć kafelków.

Każda akcja otwiera jedno okno o tym samym układzie:

- Po lewej jest briefing: koszt, statystyki, na które się rzuca, pokój, w którym jesteś, liczby, z którymi zmierzy się rzut (wyliczone dla ciebie, tak jak teraz stoisz), i wszystko, co będzie cię kosztować Sanity. **Szczegóły**, pod opisem akcji, rozwija i zwija te linie mniejszym tekstem. W Observe liczby stoją pod nagłówkiem *Progi*, a ostrzeżenie Tamper, że ktoś patrzy, zostaje nad Szczegółami i jest zawsze widoczne.
- Po prawej są wybory, każdy z podpisem w jednym zdaniu. Ile kosztuje próba, ile trzeba wyrzucić i co robi krytyk albo pudło, mówi część tego rozdziału o danej akcji. Gdy rzut wymienia kilka statystyk, pod wyborami wybierasz statystykę, którą proponujesz, i możesz w jednej linii napisać, jak to robisz.
- Przyciski są na dole.

W menu kryzysowym pełny opis wybranej akcji stoi na górze lewej kolumny, pod briefingiem, razem z kosztem, statystykami, na które się rzuca, i tym, co robi pudło. Gdy rzut ma liczbę do przebicia, mówi ją tytuł okna rzutu (*przebij 15*), a karta wyniku powtarza ją obok sumy (*potrzeba 15*); okno rzutu Palm podaje też statystykę (*Palm - Hand, przebij 12*). Observe i Analyze, które identyfikuje Truth Bullet, nie podają żadnej liczby (rozdział 8).

> [!NOTE]
> Kafelek ze znakiem GM-a przekazuje decyzję człowiekowi: twój rzut i prośba trafiają do twojego wątku w komunikatorze i czekasz na decyzję.
> W oknie czerwony wiersz albo przycisk działa tak samo: trafia do GM-a, a ty czekasz na odpowiedź.
> Na liście w oknie taki wiersz ma ten sam mały znak **GM** co kafelek, w prawym górnym rogu; czerwony jest przycisk, który trafia do GM-a.

### Search - Eye, 1 akcja

Przeszukujesz pokój w poszukiwaniu tego, co nazwiesz, i wydajesz na to jeden z Search Tokenów pokoju. Gdy rzucasz na Eye, nie musisz nikogo pytać. Każda inna statystyka (Head, Body, Hand, Leg albo Shadow, zależnie od tego, jak szukasz) jest twoją propozycją: wybierz ją w oknie i, jeśli chcesz, dopisz linię o tym, jak szukasz. GM zatwierdza ją, zmienia na inną statystykę albo odmawia na karcie w twoim wątku. Dopóki GM nie odpowie, nic nie płacisz.

| Rzut | Wynik |
|---|---|
| poniżej 8 | nic nie znaleziono |
| 8+ | przedmiot Tier 0: losowa, z pozoru bezużyteczna rzecz |
| 12+ | Tier 1 |
| 18+ | Tier 2 |
| krytyk | o jeden Tier lepiej, niż mówi rzut; krytyk poniżej 8 i tak znajduje przedmiot Tier 1 |

O co możesz prosić:

| Prosisz o | Znaczenie |
|---|---|
| *Coś, co mnie poskłada* | leczący przedmiot użytkowy |
| *Coś na nerwy* | uspokajający przedmiot użytkowy |
| *Coś, czym da się zabić* | narzędzie zbrodni |
| *Coś do sprzątania* | narzędzie do sprzątania |
| *Coś do pracy* | narzędzie |
| *Coś konkretnego* | opisz to, a GM orzeknie, co naprawdę tu było |

Znajdujesz to, co ma pokój. Najpierw liczy się to, co GM umieścił w pokoju, więc możesz znaleźć coś innego, niż prosisz, albo niższy Tier, ale nigdy wyższy, niż wywalczył twój rzut. Niektóre pokoje sprzyjają danej kategorii, a inne w niej przeszkadzają; okno rzutu mówi ci, gdy pokój sprzyja temu, o co prosisz, albo w tym przeszkadza. Search losuje tylko z pokoju i nigdy nie sięga do czyjejś skrytki, otwartej ani ukrytej.

> [!WARNING]
> Wzięcie narzędzia zbrodni albo narzędzia do sprzątania **zostawia Prep Remnant** w pokoju. Ten Remnant zdradza, że ktoś tu zbierał narzędzia, i im lepsze znalezisko, tym jest głośniejszy: Hidden przy znalezisku Tier 0, Subtle przy Tier 1, Evident przy Tier 2, Obvious przy krytyku. Zwykłe narzędzie nie zostawia Remnantu, chyba że znaleziona rzecz może też służyć jako narzędzie zbrodni albo narzędzie do sprzątania.

### Observe - Eye, 1 akcja

Szukasz dowodów. Trafienie kopiuje Remnant do twojego ekwipunku jako Neutral Truth Bullet i zostawia oryginał na miejscu dla innych. Pudło kosztuje cię 1 Sanity. Krytyk dodatkowo rozpoznaje rodzaj Remnantu i daje ci solidną podpowiedź od GM-a, zapisaną tylko na twojej kopii: kto znajdzie ten Remnant po tobie, jej nie przeczyta. Każdy Remnant masz najwyżej w jednej kopii, a druga nigdy nie powstaje: Observe pomija Remnant, który już masz, i taki, który GM wciąż ci opisuje po wcześniejszym Observe.

Wybierasz, jak patrzysz:

| Sposób | Cel |
|---|---|
| Rozejrzyj się za czymkolwiek | to, co najłatwiej zauważyć w tym pokoju; w pokoju, w którym nie ma nic takiego, GM decyduje, co widzisz |
| Spójrz poza oczywiste | najtrudniejsza rzecz tutaj i to, czego w tym pokoju w ogóle nie powinno być; gdy nie ma tu nic takiego, decyduje GM |
| Follow My Traces | wracasz własną drogą i znajdujesz to, co po sobie zostawiłeś |
| Skup wzrok | powiedz, czego szukasz; GM decyduje, na czym zatrzyma się twój wzrok |
| Zbadaj punkt zainteresowania | coś, co nie jest Remnantem: osoba, maszyna, pogoda; GM rozstrzyga |

Dowiadujesz się, co znalazłeś, ale nigdy, jaka była trudność. Remnanty powiązane ze zbrodnią są zawsze pokazywane jako pierwsze. *Spójrz poza oczywiste* może też wyciągnąć tajny projekt w pokoju (18+ albo krytyk), a znalezienie go wtajemnicza cię w niego. Od tej chwili widzisz jego postęp taki, jaki był przy twojej ostatniej wizycie w jego pokoju, a gdy projekt zostanie ukończony, dowiadujesz się o tym przy pierwszej wizycie po jego ukończeniu.

### Analyze - Head, 1 akcja

Cztery rzeczy za jednym kafelkiem:

- **Zidentyfikuj Truth Bullet.** Zamienia Neutral Truth Bullet w jego prawdziwą kategorię. **Porażka blokuje ten Truth Bullet dla ciebie do końca rozdziału**; kopii, którą przekażesz komuś innemu, twoja porażka nie wiąże.
- **Poproś o wskazówkę.** Gdy nie masz w ręku żadnego dowodu, poproś GM-a o wskazówkę, gdzie szukać. 14+ daje subtelną podpowiedź ("jesteś daleko od celu"), 18+ bezpośrednią ("przeszukaj pomieszczenie z basenem"), a krytyk pozwala GM-owi zadać ci jedno pytanie ("czy ofiara naprawdę zginęła w tym pokoju?"). Poniżej 14 nie dostajesz pomocy.
- **Find Stash.** 16+ albo krytyk otwiera przed tobą jedną skrytkę w tym pokoju. GM się o tym dowiaduje, a właściciel nie.
- **Find Passage.** 16+ albo krytyk otwiera przed tobą jedno tajne przejście tego pokoju, którego jeszcze nie znasz: odcinek jego ściany albo koniec tunelu, na twoim piętrze. Poniżej 16 albo gdy żadnego nie ma, twoja karta mówi "Nie znajdujesz tu tajnego przejścia." GM-owie widzą tę samą kartę.

W Class Trial otwarty jest tylko wybór Zidentyfikuj Truth Bullet (rozdział 12).

### Projects - statystyka projektu, 1 akcja

Projekty to powolna gra: wiele akcji przez wiele pór dnia. To też jedyna rzecz, która może zmienić zakończenie.

| Rzut | Postęp |
|---|---|
| poniżej 12 | brak |
| 12+ | +1 |
| 18+ | +2 |
| krytyk | +2, a akcja wraca |

| Skala | Potrzebny postęp |
|---|---|
| Trywialny | 3 |
| Standardowy | 4 |
| Złożony | 6 |
| Desperacki | 8 |

- Projekt ma swój pokój i pracować nad nim może tylko ten, kto w tym pokoju stoi.
- Propozycja projektu (**Zaproponuj projekt**) nie kosztuje akcji i wysyła kartę do GM-a. Projekt powstaje dopiero wtedy, gdy GM zatwierdzi propozycję, a przed zatwierdzeniem może zmienić skalę, pokój albo brzmienie. **Szerokie okna projektów**, w sekcji Wygląd okna **Ustawienia DRPG** (zębatka w prawym dolnym rogu), otwiera okno Zaproponuj projekt szerzej na twoim ekranie; to ustawienie jest domyślnie włączone.
- **Opis.** Propozycja musi go mieć: do 1000 znaków, w których twoimi słowami mówisz, czym jest projekt. Gdy wybierzesz projekt ustalonego rodzaju, w polu staje nazwa tego rodzaju i możesz ją zmienić. GM czyta opis na karcie i może go zmienić przed zatwierdzeniem; potem zmieniają go już tylko GM-owie. Każdy, kto zna projekt, czyta jego opis na karcie jego tokenu.
- Projekt wymaga jednej statystyki, nadanej przy tworzeniu, i każdy rzut na nim bierze właśnie ją: twój i sabotażysty.
- Narzędzie trzymane w ręku pomaga w rzucie (rozdział 7, W ręku).
- **Projekty, które zmieniają ścianę, zamek albo przedmiot.** W oknie **Zaproponuj projekt** pole **Rodzaj** daje sześć rodzajów obok **Własny projekt**, każdy z ustaloną statystyką i rozmiarem, i proponuje je tylko tam, gdzie da się je zrobić:
  - **Secret Passage** (Hand, Złożony 6, zawsze tajny): przejście przez ścianę pokoju, w którym stoisz, do pokoju za nią, nazwanego tak, jak go znasz. Odcinek ściany wybiera GM. Gdy projekt jest ukończony, znasz to przejście ty i ci, którym wcześniej udostępniłeś projekt.
  - **Breach the Wall** (Body, Złożony 6): wyłom w tej ścianie, który wszyscy widzą i przez który każdy przejdzie. Dopóki ściana nie zostanie naprawiona, zamek pokoju za nią i drzwi jego sypialni nikogo nie zatrzymują, a pieczęć na nim jest zdjęta do końca pory dnia; Chained wciąż cię trzyma, a sala rozpraw zostaje zamknięta. Osoby w obu pokojach dostają o tym wiadomość, a twoje imię poznają tylko wtedy, gdy stoisz przy wyłomie; pokoje obok słyszą łomot.
  - **Seal the Passage** (Hand, Złożony 6): zamyka przejście, które znasz i które ma jedną stronę w twoim pokoju, dla wszystkich, którzy je znają. GM może je znów otworzyć.
  - **Close the Breach** (Body, Złożony 6): ściana znów jest cała.
  - **Repair an item** (Hand; Trywialny 3 dla Tier 0 albo 1, Złożony 6 dla Tier 2 albo 3): jeden twój zepsuty albo zużyty przedmiot użytkowy albo narzędzie, noszone albo w skrytce, znów jest cały. Jeśli Tier przedmiotu wzrośnie przed końcem naprawy, naprawa może wymagać większej skali, a GM dostaje o tym wiadomość.
  - **Repair the Lock** (Hand, Trywialny 3): zamek wyłamany przez Force the Door albo przez wyłom, w drzwiach pokoju, w którym stoisz. Gdy projekt zostanie ukończony, zamek znów trzyma, dla wszystkich.

  GM zatwierdza projekt ściany, przejścia, zamka albo przedmiotu jak każdą propozycję i sprawdza go jeszcze raz, gdy jest ukończony: jeśli ściana, przejście, zamek albo przedmiot nie są już tym, czym były, nic się nie dzieje, a GM dowiaduje się dlaczego. Reroll rzutu, który ukończył Secret Passage, wyłom, zamknięcie przejścia albo naprawę zamka, cofa je.
- Niektóre projekty są tajne: wiedzą o nich tylko osoby, które nad nimi pracują. Jeśli tajnego projektu nie widzisz, nie ma go na twojej liście.
- Projekt przypisany do pokoju stoi też na mapie jako token z ikoną projektu z tacki Projects, a z młotkiem, gdy projekt nie ma ikony; token nigdy nie pokazuje nazwy projektu. Jawny projekt pojawia się u ciebie, gdy twoja postać już stała w jego pokoju albo stoi w nim teraz, a u proponującego od chwili, gdy GM go zatwierdzi (mówi ci o tym prywatna karta); pozostali gracze widzą go dopiero wtedy, gdy ich własna postać tam była. Tajny projekt widzą tylko wtajemniczeni. Kliknij token dwukrotnie, by zobaczyć jego kartę.
- **Sabotage** (ten sam kafelek, statystyka projektu): psujesz projekt w pokoju, w którym stoisz, tak że wymaga projektu naprawy. 12+ daje prostą naprawę (2 postępu), 18+ złożoną (6), a krytyk desperacką (8). Przy świadkach najpierw rzucasz Shadow przeciw 16, by zamaskować, co robisz; porażka cię nie zatrzymuje, znaczy tylko, że wszyscy patrzyli. Gdy maskowanie się uda, ale z Despair, twój rzut na Sabotage dostaje 1 mniej.

> [!WARNING]
> Sabotage **zawsze zostawia Remnant**, nawet przy porażce: Faint Prep Remnant, tym głośniejszy, im lepiej poszedł sabotaż (Hidden przy pudle, Subtle przy 12+, Evident przy 18+, Obvious przy krytyku). Przy rzucie z Despair wszyscy w pokoju widzą, że to ty.

### Dynamic Action - dowolna statystyka, 1 akcja

Dynamic Action to cokolwiek, byle opisane szczegółowo. Opisując ją, możesz zaproponować statystykę; GM ustala trudność i statystykę albo odmawia, a wtedy akcja zostaje przy tobie. Okno rzutu mówi, jaką liczbę trzeba przebić, a wynik równy progowi już wystarcza. Przy sukcesie twoja karta mówi "Sukces - GM zdecyduje, co daje ci wynik Tier N.", a GM dostaje kartę, na której tworzy dla ciebie przedmiot, daje ci jakiś albo odpowiada ci, gdy sukces nie jest przedmiotem. Progi Dynamic Action są łagodniejsze niż w akcjach uniwersalnych, celowo, jako nagroda za pomysł:

| Trudność | Przebij | Tier przedmiotu, który może dać | Remnant, który zostawia |
|---|---|---|---|
| Trywialne - każdy by to zrobił | 8 | Tier 0 | Obvious |
| Wymaga wprawy | 13 | Tier 1 | Evident |
| Obce większości ludzi | 16 | Tier 2 | Subtle |
| Wymaga bardzo niszowej wiedzy | 19 | Tier 3 | Hidden |

> [!IMPORTANT]
> Skala jest odwrócona celowo: im łatwiejsza rzecz, tym głośniejszy Remnant.

### Facilities - odpoczynek, 1 albo 2 akcje, albo akcja pokoju

Okno kafelka **Facilities** ma najpierw dwa odpoczynki, bez rzutu, a po nich to, co oferuje pokój, w którym stoisz.

| | Short Rest | Long Rest |
|---|---|---|
| Koszt | 1 akcja | 2 akcje |
| Wybierz | 1 z trzech | 2 z trzech |
| Jak często | raz na porę dnia | raz na sesję |
| Gdzie | w pokojach, które oznaczył GM | w pokojach, które oznaczył GM |

| Opcja | Long | Short |
|---|---|---|
| Sleep | przywraca całe Health | przywraca połowę brakującego Health, zaokrągloną w górę |
| Meal | przywraca całe Sanity | przywraca połowę brakującego Sanity, zaokrągloną w górę |
| Breath | daje 2 Hope | daje 1 Hope |

Okno wycenia oba odpoczynki wobec tego, co masz, i wymienia pokoje, które pozwalają na każdy z nich.

Akcja pokoju ustawiona przez GM-a to rzut na statystykę i próg z jej wiersza i kosztuje akcję; gdy ktokolwiek użyje jej o tej porze dnia, także nieudanym rzutem, jest wyszarzona dla wszystkich aż do następnej. Akcja ukończonego projektu nie wymaga rzutu i kosztuje akcję, chyba że GM ustawił, że nic nie kosztuje; zostawia Subtle Remnant oznaczony jako Faint, tak jak akcja samego pokoju, i masz ją raz na każdą porę dnia. Jej wiersz mówi, który projekt ją daje i jak długo działa. Despair Overflow może na porę dnia wyłączyć akcje w pokojach (Lockdown, Power cut), podrożyć je (Toll), utrudnić (Jitters) albo zabrać Short Rest (Insomnia).

### Infiltrate: Listen - Shadow, 1 akcja

Okno kafelka **Infiltrate** wymienia jego akcje jedna pod drugą: najpierw Listen, potem Echoes, Tail Someone, Dash, Shut the Door, Force the Door, Pick the Lock i Keep Watch. Każdą opisuje osobna część tego rozdziału, niżej.

Listen ustala, kto jest w sąsiednim pokoju, bez decyzji GM-a. Pokój wybierasz przed rzutem, a odpowiedź przychodzi jako karta, którą czytasz tylko ty i GM-owie. Gdy twój pokój nie ma sąsiadów, Listen jest wyszarzony, a obok stoi powód.

| Rzut | Wynik |
|---|---|
| poniżej 14 | niczego się nie dowiadujesz |
| 14+ | czy ktoś jest w tym pokoju i ile osób |
| 18+ | kto jest w tym pokoju, z imienia |
| krytyk | kto jest w każdym sąsiednim pokoju, z imienia |

Sąsiedni pokój, w którym nigdy nie byłeś, nazywa się *Nieodkryty pokój 1*, *Nieodkryty pokój 2* i tak dalej, na liście wyboru i w odpowiedzi. Listen mówi ci, kto jest za drzwiami, ale nigdy, jaki pokój za nimi leży.

**Podsłuch pod drzwiami.** Gdy **Głos osobno w każdym pokoju** jest włączony, a Listen da 14 lub więcej, po jego karcie twój głos przechodzi na kanał głosowy pokoju, którego słuchasz. Podsłuchując pod drzwiami, słyszysz ten pokój, a twój mikrofon jest wyłączony, dopóki nie przestaniesz, więc nikt tam cię nie słyszy. Nikt w tym pokoju nie dostaje wiadomości, ale liczba na głośniku ich kafelka głosu liczy wszystkich na kanale, także ciebie.

**Przestań słuchać** na twoim kafelku głosu przenosi cię z powrotem na kanał twojego pokoju, a mikrofon wraca kilka sekund później. Podsłuch kończy się też, gdy wyjdziesz z pokoju, z którego słuchasz (krok w jego obrębie albo w drzwi się nie liczy), gdy kończy się pora dnia, przy Eclipse, incydencie albo Class Trial i gdy zginiesz. Ponowny podsłuch tego samego pokoju o tej samej porze dnia nie kosztuje akcji ani rzutu. Gdy osobny głos w każdym pokoju jest wyłączony, Listen daje tylko kartę.

### Echoes - bez rzutu, 1 akcja

Echoes znajduje najbliższy pokój, w którym stoi żywy uczeń innego gracza, licząc przejścia: drzwi, schody i tunele, które znasz. Karta podaje pokój, nawet taki, w którym nigdy nie byłeś, ale nigdy nie mówi, kto tam jest ani ile osób; spośród pokoi w tej samej odległości jeden jest wybierany losowo. Nie liczą się twój pokój, ciała, Monokuma, Monocub, Widz, ukryty token ani postać GM-a. Echoes nie działa w czasie Eclipse (wiersz jest wtedy przekreślony z powodem), incydentu ani Class Trial. Gdy nie ma kogo znaleźć, karta mówi "Echoes: nikogo nie słychać."

### Tail Someone - Shadow, potem Leg albo Shadow, 1 akcja

Idziesz za uczniem, który stoi w twoim pokoju. Proponujesz statystykę drugiego rzutu, Leg albo Shadow, a GM wybiera ją na karcie; nic nie płacisz, dopóki GM nie odpowie. Potem są dwa rzuty. Przy Shadow 15 lub więcej cel cię nie zauważa; poniżej od razu dostaje twoje imię, a śledzenie i tak trwa. Drugi rzut nie ma liczby do przebicia: jego wynik to to, co Dash celu musi przebić, żeby cię zgubić (niżej).

Dopóki śledzenie trwa, za każdym razem, gdy cel przejdzie do innego pokoju i postoi tam około dwóch sekund, dostajesz kartę: *{name} przechodzi do: {room}.* Przy krytyku w drugim rzucie karta mówi też, kto tam jest, poza Eclipse. Podczas Eclipse karty wciąż przychodzą, ale podają tylko pokoje.

Śledzenie kończy się kartą, gdy nie jesteś ani w pokoju, który cel opuścił, ani w tym, do którego doszedł (gubisz trop), gdy kończy się dzień, gdy zostanie ogłoszone znalezienie ciała albo gdy cel użyje Dash z wynikiem wyższym niż twój drugi rzut; krytyczne śledzenie przerywa tylko krytyczny Dash. Kończy się bez karty, gdy któreś z was zginie albo zacznie się incydent. Prowadzisz jedno śledzenie naraz, a nowe zastępuje stare. Śledzenia nie da się zacząć w Eclipse, w Investigation ani w Class Trial.

### Shut the Door - Body, 1 akcja

Barykadujesz od środka pokój, w którym stoisz, a siłą barykady jest twój rzut na Body. Działa to w pokoju, który ma najwyżej dwoje drzwi dających się otworzyć, i we własnej sypialni, ale nie w cudzej. Dopóki zostajesz w środku, nikt nie wejdzie drzwiami, choć tajne przejście, wyłom albo tunel wciąż przepuszcza. Barykada znika, gdy wyjdziesz z pokoju, gdy kończy się pora dnia i gdy zaczyna się Eclipse. Pokój pokazuje, że jest zabarykadowany, ale nigdy przez kogo; osoby stojące z tobą w pokoju widzą, jak to robisz. Shut the Door zostawia Subtle Remnant oznaczony jako Faint. Kogoś, kto próbuje wejść drzwiami z zewnątrz, słyszą wszyscy w środku, bez imienia, a taka osoba może drzwi wyważyć (niżej).

### Force the Door - Body, 1 akcja

Przy drzwiach z twojego pokoju do sąsiedniego rzucasz raz na Body przeciw wszystkiemu, co je trzyma, naraz, a drzwi ustępują tylko wtedy, gdy rzut pokona to wszystko. Barykada wymaga więcej niż jej siła (remis ją utrzymuje); zamek (GM-a albo sypialni) i pieczęć wymagają 18 lub więcej; krytyk otwiera wszystko. Wyważony zamek zostaje zepsuty, dopóki ktoś go nie naprawi (Repair the Lock, w części o Projects), a wyważona pieczęć znika do końca swojej pory dnia. Osoby w twoim pokoju zawsze widzą, kto to był, jakikolwiek byłby rzut. Wyważone drzwi, a także pudło z Despair, są głośne: pokoje obok jednego i drugiego pokoju słyszą *Łomot z: {room}.* bez imienia, a osoby w pokoju za drzwiami widzą, kto to był. Każda próba przy drzwiach, które coś trzyma, zostawia Remnant: Evident, gdy było głośno, a w przeciwnym razie Subtle. Właściciel sypialni, który tego nie widział, dostaje wiadomość, że drzwi wyważono, gdy następnym razem wejdzie do tej sypialni, albo od razu, jeśli w niej jest. Force the Door nie wolno użyć w trakcie Class Trial ani wtedy, gdy jesteś Chained.

### Pick the Lock - Shadow, potem Hand, 1 akcja

Pick the Lock to dwa rzuty przy zamkniętych albo zapieczętowanych drzwiach z twojego pokoju do sąsiedniego; barykady nie da się otworzyć wytrychem. Najpierw rzut na Shadow: przy 16 lub więcej nikt w pokoju za drzwiami nie widzi, kto to był, a osoby w twoim pokoju widzą to zawsze, jakikolwiek byłby rzut. Potem rzut na Hand: 15 lub więcej albo krytyk otwiera drzwi tylko dla ciebie. Możesz wtedy wejść do tego pokoju, tymi drzwiami albo innymi, i zostać w nim, dopóki z niego nie wyjdziesz; dla wszystkich innych zamek zostaje zamknięty. Wejście, z którego nie skorzystasz o tej porze dnia, przepada.

Jeśli otworzysz zamek z wynikiem poniżej 18 albo spudłujesz z Despair, właściciel sypialni dowiaduje się, że ktoś był przy jego zamku: od razu, jeśli jest w tej sypialni, a w przeciwnym razie, gdy następnym razem do niej wejdzie. Przy 18 lub więcej właściciel nigdy się nie dowie. Jeśli właściciel cię widział, dostaje tylko kartę z twoim imieniem. Próba zostawia Remnant: Hidden przy 18 lub więcej albo przy krytyku, Subtle poniżej 18 albo przy pudle z Hope, Evident przy pudle z Despair.

### Keep Watch - Body, 1 akcja

Przy rzucie na Body 12 lub więcej czuwasz przez nadchodzące Eclipse nad pokojem, w którym stoisz, gdy się ono zaczyna. Keep Watch używasz przed Eclipse, ale nie w jego trakcie i nie przed nocnym Eclipse. Gdy Eclipse się zaczyna, dowiadujesz się, kto jest w pokoju, z imienia; przez całe Eclipse dowiadujesz się, kto wchodzi i kto wychodzi, z imienia, ale nigdy skąd ani dokąd; a na koniec Eclipse, ile osób weszło i wyszło. Przez całe Eclipse zostajesz na posterunku. Porażka z Despair kosztuje 1 Sanity. Gdy czuwasz z wynikiem 18 lub więcej albo krytycznym, trudniej cię zaskoczyć: kto otwiera na tobie morderstwo, rzuca na otwarcie z jedną kością utrudnienia, a jego okno nie mówi dlaczego. Gracz, który zgodził się, by jego postać była ofiarą morderstwa, nie używa Keep Watch, żeby tego uniknąć.

### Dash - Leg, 1 akcja

Dash to rzut na Leg, który daje darmowe przejścia do końca pory dnia, wydawane jak Free Move.

| Rzut | Darmowe przejścia |
|---|---|
| poniżej 12 | żadne |
| 12+ | 2 |
| 18+ | 3 |
| krytyk | 4 |

### Palm - Hand, 1 akcja

Palm to ręka w czyjejś kieszeni, w jedną albo w drugą stronę, albo tylko spojrzenie do środka. Dwa niezależne rzuty: **Hand** decyduje, czy się udało, a **Shadow**, czy ktoś cię zauważył.

| | Weź coś | Zostaw coś | Frisk (ukradkiem) |
|---|---|---|---|
| Udaje się (Hand) | 12+ | 8+ | 10+ |
| Niezauważony (Shadow) | 15+ | 13+ | 15+ |

Cztery wyniki, a ciekawe są te niedopasowane: przyłapany z niczym albo okradziony przez kogoś, kogo nie zauważyłeś. Gdy cię zauważą, dowiadują się, czyja to była ręka i co wziąłeś albo zostawiłeś, a wszyscy inni w pokoju widzą, czyja to była ręka; przy Despair na twoim rzucie Shadow widzą też, co wziąłeś albo zostawiłeś. Bierzesz to, co wyjdzie, a krytyk pozwala ci wybrać. Limity noszenia wciąż obowiązują (rozdział 7), a jedna akcja Palm przenosi jedną sztukę ze stosu, czyli z kilku takich samych rzeczy trzymanych w jednym wierszu. Coś, co zostawiasz komuś z pełnymi kieszeniami, zostaje u ciebie: dostajesz o tym wiadomość, a oni nie dowiadują się niczego, czy cię zauważyli, czy nie. Coś, co bierzesz, gdy nie masz już miejsca, żeby to nieść, trafia do twojej skrytki, a gdy nie masz skrytki, zostaje u nich. Palm nigdy nie sięga do skrytki. Palm odrzucony, zanim kości zostaną odczytane (cel wyszedł, zaczął się Class Trial), oddaje ci akcję; zostawienie czegoś w pełnych kieszeniach było próbą i ta akcja przepada.

**Zobacz, co nosi** (Frisk) niczego nie zabiera. Kosztuje 1 akcję i robisz go jawnie albo ukradkiem.

**Jawnie** prosisz tę osobę, żeby pokazała kieszenie; o to samo możesz poprosić każdego ucznia raz na porę dnia, a ponowna prośba oddaje ci akcję. Jeśli się zgodzi, widzisz to, co miała przy sobie w chwili prośby: przekazanie czegoś dalej w czasie namysłu tego nie ukryje. Jeśli odmówi albo nie odpowie w ciągu 60 sekund, możesz ją zmusić, chyba że GM to wyłączył: potrzebujesz **Body 12+**, a rzut musi zapaść w ciągu 30 sekund. Wszyscy w pokoju i tak to widzą. Gdy kieszenie zostaną opróżnione, pokazane albo przeszukane siłą, każdy w pokoju widzi, co w nich jest, tak jak ty. Jeśli gracza tej postaci nie ma, nikt nie odpowiada; za postać bez gracza odpowiada GM.

**Ukradkiem** Frisk to dwa rzuty kradzieży bez kradzieży: najpierw Shadow, 15+, żeby nikt cię nie zauważył, potem Hand, 10+, żeby dobrze się przyjrzeć. Jeśli ta osoba to zauważy, wie, że to ty, i wiedzą to też wszyscy inni w pokoju. To, co ta osoba ma przy sobie, wiesz tylko ty.

Jeśli prośba w ogóle nie może do tej osoby trafić, akcja wraca. Widzisz to, co jest w kieszeniach, ale nigdy Truth Bullet ani skrytki. Ciała nie przeszukasz przez Frisk: przejrzyj jego arkusz.

### Tamper - Shadow, 1 akcja

Trzy rzeczy za kafelkiem. Próba kosztuje **1 akcję**, nigdy Sanity: bez akcji nie użyjesz Tamper, dopóki akcje nie wrócą. Sanity może kosztować cię dopiero przyłapanie (ostrzeżenie niżej). Prób w jednej porze dnia może być dowolnie wiele, a każda kosztuje osobno. Wyjątkiem jest sprzątanie zabójcy po własnym morderstwie, za które płacisz zamiast tego Sanity (rozdział 10).

**Erase a Trace.** Wymazujesz jeden Remnant w tym pokoju, o którym wiesz: taki, którego kopię masz jako Truth Bullet, albo Remnant walki, w której bierzesz udział. Każdy inny, kto go znalazł i jest gdzie indziej, ma go dalej na mapie, przygaszony, dopóki któraś z jego postaci nie stanie znów w tym pokoju. Im łatwiej Remnant zobaczyć, tym trudniej go usunąć:

| Widoczność | Wymaga |
|---|---|
| Hidden | 9 |
| Subtle | 12 |
| Evident | 15 |
| Obvious | 18 |

Każdy z tych progów jest o 3 niższy, gdy zabójstwo jest świeże: trwa incydent albo ciało z tego rozdziału leży tam, gdzie nikt go jeszcze nie znalazł, dopóki ciało nie zostanie znalezione albo nie zacznie się Investigation. Narzędzie do sprzątania w ręku daje przewagę i obniża próg o swój Tier. Po wszystkich ulgach (narzędzie, świeża scena, 3 za przeróbkę) żadna próba nie wymaga mniej niż 8.

| Wynik | Co się dzieje |
|---|---|
| Czysty sukces | Remnant znika |
| Krytyk | Remnant znika, a koszt próby wraca. Możesz też zamiast tego zostawić Remnant na miejscu tak, żeby wyglądał na coś innego: przeróbkę, której pasmo wybierasz; jeśli GM nie dopuści twojej wersji, Remnant i tak znika |
| Sukces z Despair | Remnant znika, ale zostawiasz własny Tamper Remnant |
| Porażka | Remnant zostaje, a obok przybywa Tamper Remnant (Subtle przy Hope, Evident przy Despair) |

Remnantów Reinforced nie da się usunąć.

**Reshape a Trace.** Zostawiasz jeden z tych samych Remnantów na miejscu i sprawiasz, że wygląda na coś innego: piszesz, jak się nazywa i jak wygląda, jedno i drugie (nazwa do 60 znaków, wygląd do 400 znaków). Wymaga o 3 mniej niż jego wymazanie, a cokolwiek napiszesz, Remnant staje się Tamper Remnantem: przyznaje, że ktoś przy nim majstrował, i kłamie o całej reszcie. GM pozwala twojej wersji zostać albo jej nie dopuszcza; do tego czasu Remnant wygląda tak jak przedtem, a niedopuszczona wersja i tak kosztuje to, co kosztowała próba. Krytyk dodatkowo sprawia, że Remnant jest o jedno pasmo trudniejszy do zauważenia, i oddaje to, co kosztowała próba. Kopie, które inni już mają, zachowują słowa, z jakimi je znaleziono; kto znajdzie Remnant później, czyta twoje.

**Misleading Trail.** Zostawiasz Prep Remnant wskazujący na kogoś innego. Wymaga 15, a krytyk dodatkowo oddaje to, co kosztowała próba. Porażka z Hope i tak go podkłada, jako Hidden, Faint Remnant, którego pewnie nikt nie znajdzie; porażka z Despair nie podkłada nic.

> [!WARNING]
> Jeśli ktoś inny jest w pokoju, najpierw rzucasz Shadow przeciw **16**, by zamaskować, co robisz, a przyłapanie kosztuje Sanity: 1 przy sukcesie z Despair, 1 przy porażce, 2 przy porażce z Despair. Krytyk w tym rzucie oddaje ci 1 Sanity. Briefing ostrzega, ile osób patrzy. Możesz też najpierw przejść do pustego pokoju.

### Direct Murder - 1 akcja, GM decyduje

Zabójstwo twarzą w twarz, uzgodnione wcześniej z GM-em i <ins>za zgodą gracza ofiary</ins>. Zgłosić je możesz tylko **podczas Eclipse**, jedynego momentu, w którym możesz być z kimś sam na sam. Wydajesz akcję bez względu na wynik. Jeśli GM odmówi, dowiesz się od razu; w przeciwnym razie nikt, nawet ty, nie wie, jak poszło, dopóki Eclipse się nie skończy i pokój się nie uspokoi. Jeśli zostaniesz z tą osobą sam na sam, a GM pozwoli, otwiera się incydent (rozdział 10), chyba że inne zabójstwo otworzyło go wcześniej.

### Move - za darmo, potem 1 akcja

Move to nie kafelek: przeciągasz swój token (rozdział 3).

---

## 5. Hope i Hope Calls

Masz najwyżej **6** Hope. Hope wraca, gdy rzuty idą po twojej myśli (+1 z Hope, +2 przy krytyku), i z Breath przy Rest. Wydajesz go na **Hope Calls**, z arkusza postaci.

| Call | Koszt | Co robi |
|---|---|---|
| **Support** | 1 | Inny uczeń w twoim pokoju dostaje przewagę na swój następny rzut i dowiaduje się, że Support jest od ciebie. Kto ma już niewykorzystany Support, nie dostanie drugiego, a ty zachowujesz wtedy swój Hope. |
| **Talent** | 1 | Piszesz, jak jedno z twoich doświadczeń albo twój Ultimate pasuje do następnego rzutu, a w jego oknie wybierasz, które z nich. Doświadczenie dodaje swoją wartość, Ultimate daje przewagę. GM zgadza się albo odmawia, a płacisz tylko przy zgodzie. |
| **Contribution** | 2 | Od razu +1 postępu do projektu w twoim pokoju, który nie jest ukończony ani zamrożony, bez akcji i bez rzutu na projekt. Przy projekcie morderstwa (rozdział 9) Contribution rzuca też na Hide the Traces, jak praca nad nim. |
| **Sprint** | 2 | Jeszcze jedno przejście między pokojami o tej porze dnia, bez płacenia za nie akcją. |
| **Reroll** | 3 | Robisz Reroll swojej ostatniej akcji (niżej). |
| **Resolve** | 2 | Na jeden rzut wybierasz dowolną statystykę i nikogo nie pytasz, także gdy akcja wymienia kilka statystyk. |
| **Burst** | 4 | Twoja następna akcja jest w całości za darmo, ile by nie kosztowała. Dotyczy to też przejścia i Long Rest. |
| **Relief** | 4 | Od razu bierzesz Short Rest, w dowolnym pokoju: bez akcji, bez oznaczonego pokoju i bez zużywania Short Rest z tej pory dnia. Breath jest w nim wyszarzony, bo oddałby mniej Hope, niż kosztuje Relief. Jeśli wycofasz się z wyboru, co przywrócić, zapłacony Hope wraca do ciebie. |
| **Loaded Die** | 6 | Przy twoim następnym rzucie akcji jedna z dwóch kości, losowo, jest ustawiona na 12, a druga jest rzucana; rzut statystyką z arkusza go nie używa ani nie zużywa. Wynik jest bardzo wysoki, a krytyk wypada tylko wtedy, gdy rzucona kość też pokaże 12. Gdy ustawiona jest kość Despair, rzut wychodzi z Despair. Jeśli kość nie zadziała, dowiadujesz się o tym, a Call wraca do ciebie na następny rzut. |
| **Bribe** | 1 | Proponujesz Monocubowi 1 Hope za przysługę, którą ustalicie między sobą. Płacisz tylko wtedy, gdy Monocub przyjmie, a zapłata trafia do jego sakiewki. Propozycja, na którą nikt nie odpowiedział, wygasa wraz z następną porą dnia. Nikt inny nie dowiaduje się o Bribe. |

**Reroll** cofa poprzedni wynik: Remnant, przedmiot i Sanity, które przyniósł rzut, odchodzą razem z nim. Stara karta zostaje, z przekreślonym wynikiem, a linia pod jej nagłówkiem podaje stary i nowy wynik. Rzut po Rerollu liczy to, co GM policzył za pierwszym razem. Niektóre rzeczy jednak zostają: ręka, która już była w kieszeni, trop, który już podłożono, i Remnant, na którym GM coś zapisał albo który ktoś już znalazł. Na akcji kryzysowej, która kogoś zabiła, nie da się zrobić Rerolla: śmierć zostaje. Reroll sprzątania albo Analyze, których pierwszej próby nie da się już cofnąć, jest odrzucany, tak samo jak Reroll rzutu, którego nie ma już na czacie. Reroll odrzucony albo niemożliwy do zrobienia nic nie kosztuje.

Reroll Find Passage albo Find Stash szuka jeszcze raz nowymi kośćmi, w pokoju, w którym padł rzut, i tylko wtedy, gdy wciąż tam stoisz; inaczej Reroll wraca do ciebie w całości. Gdy nowy wynik jest wyższy, znajduje najwyżej raz. Gdy jest niższy, skrytka, którą otworzył, zostaje otwarta, a przejście, które znalazł tylko ten rzut, przepada.

Call, który wpływa na rzut (Support, Talent, Resolve i Loaded Die), czeka na twój następny rzut, a liczy się też rzut statystyką z arkusza; Call jest zużyty w chwili, gdy rzucasz. Loaded Die czeka na twój następny rzut akcji. Rzut, który tylko towarzyszy akcji, nie zużywa Calla: tak jest z rzutem Palm, żeby zostać niezauważonym, z rzutem otwarcia i z rzutem na ukrycie zamiaru.

Call nałożony na ciebie po otwarciu okna rzutu nie wchodzi do tego rzutu: okno to mówi, a Call czeka na twój następny rzut. Wyjątkiem jest Call, który ci utrudnia (utrudnienie albo ujemna premia): jeśli nałożono go ponad minutę przed rzutem, liczy się, nawet jeśli okno otworzyło się wcześniej, a okno go wtedy nie pokazuje.

Sprint i Burst zamiast czekać na rzut idą do zapasu i trwają do końca pory dnia. Class Trial, który zaczyna się o tej porze dnia, zostawia je w zapasie (rozdział 12).

> [!IMPORTANT]
> Nikt nie wydaje Hope Calli podczas Eclipse. Nie wydaje ich też ten, kogo Monokuma uciszył (Silence), ani nikt, gdy Silence z Overflow zaciemnia porę dnia.

---

## 6. Despair - druga strona

Każdy twój rzut zakończony Despair zasila pulę Monokumy, który cię pilnuje, chyba że GM wyłączył ustawienie **Rzuty dają Despair**. Pula mieści **12**, a stan każdej puli widać na każdym ekranie, także twoim, na pasku **Pule Despair** u góry.

### Despair Calls - co Monokuma może ci zrobić

| Call | Koszt | Efekt |
|---|---|---|
| Obstacle | 1 | Utrudnienie na twój rzut. |
| Approval | 1 | Przewaga na twój rzut. Tak, czasem Monokuma pomaga. |
| Fuel a Monocub | 1 | 1 Despair zamienia się w 1 Hope dla Monocuba, żeby mógł użyć Confusion. |
| Feed the Overflow | 1 | Wlewa Despair do Overflow, które zaciemnia świat. |
| Behind Closed Doors | 2 | Pieczętuje pokój na jedną porę dnia. |
| Paranoia | 2 | Tracisz 2 Sanity. |
| Chained | 3 | Nie możesz opuścić swojego pokoju do końca pory dnia. Stół nie dowiaduje się, w którym pokoju; ty tak. |
| Game Integrity | 3 | Odejmuje projektowi 2 postępu. Przy tajnym projekcie tylko ci, którzy o nim wiedzą, dowiadują się, któremu, i ile ma postępu. |
| Patronage | 3 | Dodaje projektowi 2 postępu. Przy tajnym projekcie tylko ci, którzy o nim wiedzą, dowiadują się, któremu, i ile ma postępu. |
| Pain | 4 | Tracisz 2 Health. |
| Silence | 4 | Nie możesz wydawać Hope Calli do końca pory dnia. |
| Contraband | 4 | Niszczy dowolny jeden przedmiot. |
| Public Announcement | 6 | Wszyscy zostają wezwani do jednego pokoju na początek następnej pory dnia. Macie czas do tej pory, a to, gdzie będziesz, gdy się zacznie, zależy od ciebie. |
| Motive | 6 | Żądanie, termin w porach dnia i cena zignorowania go, ogłoszone wszystkim słowo w słowo. Odliczanie wisi na panelu zdarzeń. |
| New Rule | 9 | Jedna nowa zasada killing game, wybrana przez Monokumę. Zasady lądują na zakładce **Zasady** każdego arkusza. |
| Bounty | 1 | Tajne, tylko dla Monocubów i GM-ów: jeden Hope dla pierwszego Monocuba, którego Confusion przeszkodzi wskazanemu uczniowi. Despair jest pobierany o następnej porze dnia. |

### Overflow

Despair zdobyty ponad pełną pulę nie przepada: zbiera się w jednym wspólnym liczniku. Gdy licznik sięgnie progu (domyślnie **20**, a GM może go zmienić), w szkole robi się gorzej na **jedną porę dnia**: spośród zaciemnień, które GM wrzucił do kapelusza, losowane jest **jedno**. Wielkości w tabeli są domyślne i GM też może je zmienić.

| Zaciemnienie | Na jedną porę dnia |
|---|---|
| Darkness | o 1 przejście mniej w Eclipse; Eclipse z dowolnym ustawianiem zostaje przy zwykłych 2 przejściach |
| Shift | o 1 Search Token mniej w każdym pokoju |
| Panic | o 1 akcję mniej dla każdego, niezależnie od Wounded |
| Despair | w ogóle nie zdobywa się Hope; wydawanie wciąż działa |
| Silence | żadnych Hope Calli, u nikogo |
| Fog | bez Free Move: przejścia kosztują akcje jak zwykle |
| Rot | każdy przedmiot z więcej niż jednym punktem wytrzymałości traci jeden (jednorazowo, nic się nie psuje) |
| Earthquake | każdy projekt jeszcze nieukończony i niezamrożony traci 1 postępu (jednorazowo) |
| Lockdown | żadnych akcji w pokojach; odpoczynki wciąż działają |
| Insomnia | bez Short Rest; Long Rest wciąż działa |
| Toll | każda akcja w pokoju kosztuje 1 akcję więcej; akcja projektu, która nic nie kosztuje, kosztuje 1 |
| Jitters | akcję pokoju ustawioną przez GM-a rzuca się z utrudnieniem |
| Power cut | żadnych akcji z ukończonych projektów; akcje pokoi ustawione przez GM-a wciąż działają |

Żadne zaciemnienie nie zejdzie ci poniżej 1 akcji, 1 przejścia w Eclipse ani 1 Search Tokenu, a pokój, któremu GM nie dał żadnego Search Tokenu, nadal nie ma żadnego. Zamiast licznika widzisz "?". Werdykt rozprawy opróżnia licznik, ale zaciemnienie ogłoszone w trakcie rozprawy i tak przychodzi, o następnej porze dnia.

---

## 7. Rzeczy

### Tier i wytrzymałość

| Tier | Użytkowy | Narzędzie zbrodni / do sprzątania | Wytrzymałość narzędzia albo broni |
|---|---|---|---|
| 0 | losowy, z pozoru bezużyteczny przedmiot, otwarty na kreatywne użycie; orzeka GM | losowy, z pozoru bezużyteczny przedmiot | jednorazowy |
| 1 | przywraca 1 Health (leczący) albo 1 Sanity (uspokajający) | przeznaczony do czegoś innego, ale się nada | 1 |
| 2 | przywraca 2 Health albo 2 Sanity, zależnie od rodzaju | częściowo przeznaczony do tej roboty | 2 |
| 3 | przywraca 3 Health albo 3 Sanity, zależnie od rodzaju | zrobiony wyłącznie do tej roboty | 3 |

**Wytrzymałość:** każdy rzut z Despair wykonany z użyciem narzędzia kosztuje je jeden punkt, niezależnie od tego, czy praca się udała, a gdy punkty się skończą, narzędzie dostaje stan **Zepsuty**. Narzędzie albo broń z Tier 0 to rzecz jednorazowa: psuje ją pierwszy rzut, w którym jej użyjesz, jakkolwiek by wypadł (z Hope, z Despair albo krytyk), a jej wiersz pokazuje **Jednorazowy** zamiast kropek. Przedmiotu użytkowego używa się raz, bez względu na Tier: użycie go psuje albo zabiera jedną sztukę ze stosu, a zużyty też jest Zepsuty.

> [!WARNING]
> Zepsuty przedmiot zostaje w ekwipunku, na swoim miejscu, bezużyteczny, i wciąż jest dowodem. Masz dwa wyjścia i żadne nie kosztuje akcji: **wyrzuć** go (rzut na Shadow decyduje, jak widoczny będzie Remnant, a Remnant zostaje w pokoju) albo schowaj w **skrytce**. W czasie Class Trial nie da się go wyrzucić: przycisk jest wtedy wyszarzony, a jego podpowiedź mówi *W czasie Class Trial nie można niczego wyrzucić.*

### Kategorie i ile możesz nosić

| Kategoria | Limit | Uwagi |
|---|---|---|
| **Użytkowe** | 3 | Leczące przywracają Health, uspokajające przywracają Sanity. Używasz ich z wiersza w ekwipunku, bez akcji. |
| **Sprzęt**: narzędzia zbrodni, narzędzia do sprzątania, narzędzia | 2 wspólne miejsca | Schowane może być tylko **jedno**: gdy nosisz dwa, jedno jest w ręku. |
| **Truth Bullets** | brak | Dowody. Truth Bullet to twoja wiedza, więc nie trafia do żadnej szuflady. |
| **Klucze do pokoi** | brak | Klucz otwiera jedną sypialnię. |

Przedmiot może służyć też jako inna kategoria (śrubokręt w narzędziach, który jest też narzędziem zbrodni) i wciąż zajmuje jedno miejsce.

> [!IMPORTANT]
> **W ręku.** Sprzęt liczy się tylko wzięty do ręki: w incydencie, przy sprzątaniu i przy pracy nad projektem liczy się tylko to, co trzymasz. W ręku jest zawsze najwyżej jedna rzecz, a gdy bierzesz jedną, pozostałe odkładasz; wzięcie do ręki nie kosztuje akcji. Narzędzie w ręku daje przewagę przy pracy nad projektem i sabotażu i obniża próg o swój Tier. Narzędzie do sprzątania w ręku robi to samo przy sprzątaniu, poza Move the Body, gdzie obniża próg o swój Tier, ale nie daje przewagi. Tier narzędzia zbrodni wyznacza jego obrażenia (rozdział 10, Jeśli jesteś zabójcą).

**Przekazywanie.** Możesz dać coś każdemu w swoim pokoju. Przy **Przekaż** oddajesz rzecz na dobre i obowiązuje limit odbiorcy. Przy Truth Bullecie albo kluczu możesz zamiast tego wybrać **Podziel się kopią**: macie go wtedy oboje, a kopii Truth Bulletu nie wiąże żadna twoja nieudana analiza. Ani przekazanie, ani dzielenie się kopią nie kosztuje akcji i żadne z nich nie działa podczas Eclipse.

### Sypialnie, klucze, skrytki

- Każdy uczeń ma jedną sypialnię. **Drzwi są zamknięte** dla wszystkich poza właścicielem, a każdy inny potrzebuje **klucza**. Masz własny klucz i przez **Podziel się kopią** możesz dać komuś jego kopię, zachowując swój. Nikt nie ma dwóch kluczy do tych samych drzwi. Klucz otwiera swoje drzwi temu, kto go trzyma: zdjęty komuś przez Palm, wyjęty ze skrytki albo zabrany z ciała działa jak podarowany. Drzwi otwiera tylko klucz w twoim ręku, a ten w skrytce nie otwiera niczego.
- Gdy GM daje sypialnię komuś innemu, klucze jej starego właściciela przepadają, a razem z nimi każda kopia, którą dostał ktoś inny; jeśli tracisz klucz, dostajesz o tym wiadomość. W Investigation sypialnia kogoś, o czyjej śmierci wiadomo, stoi otworem.
- Twoja sypialnia ma **skrytkę**. Skrytka mieści **3** rzeczy, a żeby coś włożyć albo wyjąć, musisz stać w pokoju; jedynym wyjątkiem jest to, co do ciebie trafia, gdy masz pełne ręce. Truth Bulletów nie da się schować.
- **Otwarta** skrytka to szuflada: każdy stojący w pokoju może ją przejrzeć za darmo i wziąć z niej jedną rzecz, raz na porę dnia. Skrytka twojej sypialni jest otwarta, dopóki nie zbudowano do niej schowka, czyli projektu, który zatwierdza GM.
- Skrytkę, która jest **ukryta**, trzeba najpierw znaleźć, a znajduje ją tylko Analyze **Find Stash** na 16+ albo krytyk. To otwiera ją przed tobą na dobre i odtąd przeglądasz ją jak otwartą. Jeśli GM usunie skrytkę, ci, którzy ją znaleźli, zapominają o niej.
- Gdy ktoś częstuje się z twojej skrytki, nic nie jest ogłaszane. Gdy następnym razem wejdziesz do tego pokoju, dowiesz się, że ktoś był w twojej skrytce, ale nigdy kto ani kiedy. Dowiadujesz się raz, choćby zdarzyło się to kilka razy, i tylko wtedy, gdy coś zniknęło, a nigdy o tym, co wzięto, gdy stałeś w pokoju.
- Twoje drzwi wyważone, zamek otwierany nieostrożnie, ściana przebita do sypialni albo zamek naprawiony, gdy byłeś gdzie indziej: dowiadujesz się o tym, gdy następnym razem wejdziesz do sypialni, w jednej karcie, ile by tego było, i nigdy nie wiesz kto. Jeśli jesteś w sypialni, gdy to się dzieje, dowiadujesz się od razu; jeśli widziałeś, jak to się dzieje, dostajesz tylko kartę z imieniem sprawcy.
- GM może dać ci skrytkę w innym pokoju. Nie dostajesz z nią klucza do tego pokoju.
- Miałeś pełne ręce, gdy coś do ciebie trafiło: znalezione, ukradzione, wyjęte ze skrytki albo zabrane z ciała? Trafia wtedy do twojej skrytki, tej z sypialni, jeśli ją masz, gdziekolwiek stoisz i jakkolwiek pełna już jest, a ty dostajesz o tym wiadomość. Gdy nie masz żadnej skrytki, rzecz w ogóle do ciebie nie dociera. Coś, co ktoś ci podaje ponad limit, zostaje odrzucone, tak samo jak coś, co ktoś próbuje wsunąć ci do pełnych kieszeni: zostaje u tego, kto próbował, a ty nie dowiadujesz się niczego. Ze stosu przenosi się naraz tylko jedną sztukę.

---

## 8. Remnanty i dowody

### Remnanty

**Remnant** to to, co czyn zostawia na mapie. Zostawia go większość tego, co robisz w pokoju: Search, który znajduje narzędzie zbrodni albo narzędzie do sprzątania, Dynamic Action, sabotaż, praca nad projektem morderstwa, wyrzucenie czegoś, przeszukanie kieszeni ciała, walka i sprzątanie. To, jak trudno go zobaczyć, to jego **widoczność**: Obvious, Evident, Subtle albo Hidden. Niektóre Remnanty są **Reinforced** i nikt nie może ich usunąć.

Remnant pojawia się na twojej mapie <ins>dopiero wtedy, gdy masz skopiowany z niego Truth Bullet</ins>; Remnanty walki, w której bierzesz udział, widać od chwili, gdy powstają. Tylko na twoim ekranie nosi nazwę i obrazek twojej kopii, a sam Remnant ma jedną neutralną nazwę. Nosi znak zapytania, dopóki twoja kopia nie zostanie przeanalizowana, a potem ikonę tego, co go zostawiło: Search, Dynamic Action, projektu, sabotażu, samej walki, sprzątania, wyrzuconej rzeczy, przeszukanego ciała albo ręki samego GM-a. Jego ramka przybiera kolor tego, czym według twojej kopii jest.

| Remnant | Co znaczy |
|---|---|
| **Key Remnant** | Stawiany przez GM-ów, żeby sprawa dała się rozwiązać. Nieusuwalny. |
| Prep Remnant | Zostawiony przy przygotowaniu morderstwa albo zbieraniu narzędzi. |
| Incident Remnant | Zostawiony podczas konfrontacji albo śmierci ofiary. |
| Tamper Remnant | Zostawiony przy zacieraniu: zbyt czysta plama, rzecz odłożona odrobinę nie tak. |
| Faint Remnant | Wątpliwy związek ze sprawą. Faint to też znacznik, który mogą nosić inne Remnanty. |
| Autopsy Remnant | Stan ciała. Wydawany na początku Investigation, bez rzutu. |
| Final Truth Remnant | Jeden na rozdział. Wskazuje Masterminda. Nieusuwalny. |

**Faint jako oznaczenie.** Prep Remnant, który zostawia Search znajdujący narzędzie zbrodni albo narzędzie do sprzątania, jest Faint, tak samo jak ten po sabotażu, Dynamic Action, pracy nad projektem morderstwa albo nieudanym Misleading Trail; Faint jest też Tamper Remnant, który zostawia sprzątanie. GM czyści Remnant oznaczony jako Faint, chyba że jest powiązany z morderstwem. Truth Bullet z Faint Remnantu zostaje u ciebie po końcu rozdziału, nieodczytany, i wciąż można go przeanalizować.

### Truth Bullets

**Truth Bullet** to to, co daje Observe: kopia Remnantu w twoim ekwipunku, pod **Truth Bullets**. Większość przychodzi jako Neutral: jeszcze nie wiesz, jaki to rodzaj Remnantu, i taki Truth Bullet wymaga Analyze. Key albo Final Truth pokazuje swój rodzaj w chwili podniesienia, ale to, co mówi, wciąż czeka na Analyze. W pełni odczytany przychodzi tylko Autopsy.

Karta Truth Bulletu pokazuje:

- nazwę,
- opis, który dostał znalazca,
- jaki to rodzaj Remnantu według twojej wiedzy (Faint dopiero po rozpoznaniu),
- jak widoczny był oryginał (Obvious, Evident, Subtle albo Hidden),
- rozdział,
- pokój, w którym go podniosłeś,
- *Analiza na nic*, gdy twoja analiza się na nim w tym rozdziale nie powiodła.

Truth Bullety możesz grupować według **Rozdziału** albo **Lokacji**. Truth Bullet to jedyna rzecz, którą możesz przedstawić w Class Trial.

Arkusz nie pozwala zmienić nazwy, obrazka ani opisu przedmiotu, bo to, jak rzecz się nazywa, jest częścią dowodu. Zmiana zrobiona mimo to zostaje i jest zapisywana dla GM-ów, a na Truth Bullecie zostaje cofnięta.

### Jak czytać drabinę trudności

Przy Observe i przy Analyze, które identyfikuje Truth Bullet, nigdy nie widzisz trudności, z którą mierzy się twój rzut, ale kształt drabiny nie jest tajemnicą. Każda komórka podaje cztery liczby, po jednej na każdą widoczność oryginału, w kolejności Obvious / Evident / Subtle / Hidden.

| Oryginalny Remnant | Observe (żeby zauważyć) | Analyze (żeby odczytać) |
|---|---|---|
| Key Remnant, Final Truth | 6 / 9 / 12 / 15 | 6 / 9 / 12 / 15 |
| Prep, Incident, Tamper | 9 / 12 / 15 / 18 | 12 / 15 / 18 / 21 |
| Faint | 12 / 15 / 18 / 21 | 8 / 12 / 15 / 18 |
| Coś z Daily Life | 8 / 12 / 18 / 21 | - |

Analyze nie ma drabiny Daily Life: Truth Bullet odczytuje się w wierszu tego, czym naprawdę jest. Na wierszu Daily Life nie jest też liczony żaden rzut: żaden Remnant nie jest tego rodzaju. To drabina, którą briefing Observe pokazuje, gdy za tym, na co patrzysz, nie stoi żaden Remnant, a orzeka o niej GM.

Faint Remnant trudno zauważyć, ale gdy już go masz, łatwo go odczytać; Prep Remnant łatwo podnieść i trudno odczytać.

---

## 9. Pułapki i projekty, które zabijają

**Morderstwo pośrednie** buduje się jako projekty, tajne dla wszystkich poza budującym i GM-ami: *Prepare the Weapon* (Standardowy albo Złożony, 4-6 postępu, może wymagać konkretnego pokoju) i *Set the Trap* (Trywialny albo Standardowy, 3-4 postępu, zawsze wymaga konkretnego pokoju). Zaplanuj łącznie około **7-10 postępu**: tyle dają obie części w najmniejszej i największej skali.

Praca nad projektem morderstwa, gdy ktoś inny jest w pokoju, dodaje **rzut Shadow przeciw 16**, żeby ukryć zamiar. Przy sukcesie możesz swobodnie kłamać, a sukces z Despair daje też projektowi +1 postępu ponad to, co daje twój rzut na nim. Przy porażce pozostali dostają ogólny opis ("grzebie przy probówkach"): wszyscy w pokoju dowiadują się, że czymś się tam zajmujesz, ale nie poznają nazwy projektu. W samotności nie rzucasz na to niczego, a projekt zyskuje +1 postępu ponad twój rzut. Każda akcja przy projekcie morderstwa, także Contribution (rozdział 5), rzuca Shadow na Hide the Traces, a ten rzut decyduje, jaki Remnant zostawia akcja:

| Rzut Shadow | Remnant, który zostawia |
|---|---|
| poniżej 12 | Obvious |
| 12+ | Evident |
| 18+ | Subtle |
| krytyk | Hidden |

Ukończona pułapka czeka na warunek: ktoś sam w pokoju, ktoś wchodzi, udany Search w tym pokoju, ktoś odpoczywa, szuka skrytki albo tajnego przejścia (przy trafieniu i przy pudle), pracuje nad wskazanym projektem albo go sabotuje, albo używa podłożonego przedmiotu. Te warunki gra zauważa sama, a własnego warunku budującego wypatruje GM. Pułapkę można ustawić tak, żeby działała tylko po zmroku (Wieczór, Noc albo każde Eclipse), a domyślnie nigdy nie działa na budującego. To GM decyduje, czy odpaliła.

**Podłożony przedmiot** umieszcza GM: dla pułapki, która na niego czeka, zapisuje, czym jest ten przedmiot i w jakim pokoju czeka. Znajduje go pierwszy udany Search w tym pokoju, a przedmiot przychodzi jako to, czego szukał znalazca. Odpala tylko dla kogoś, kto <ins>szukał przedmiotu użytkowego i potem go użył</ins>.

> [!TIP]
> Jeśli to ty wchodzisz w pułapkę, dostajesz rzut: zobacz rozdział 10.

---

## 10. Morderstwo

Ta część mówi, co graczowi wolno wiedzieć o morderstwie. Dopóki nikt nie znajdzie ciała, to, kto komu co robi, zostaje sprawą uczestników incydentu.

Gdy rzut wymienia więcej niż jedną statystykę, proponujesz jedną: wybierasz ją w oknie pod wyborami i, jeśli chcesz, dopisujesz linijkę o tym, jak twoja postać to robi. GM zatwierdza twoją propozycję, zmienia ją na inną statystykę z listy albo odmawia, na karcie w twoim wątku. Dopóki GM nie odpowie, nic nie płacisz, a odmowa nic nie kosztuje.

Po zmianie twoje okno mówi, na co ją zmieniono, i daje do wyboru rzut albo *Rezygnuję (nic nie schodzi)*; w walce rezygnacja znowu otwiera menu kryzysowe. Okno rzutu otwiera się wtedy z tym, co ustalił GM, i nie możesz tego zmienić. Z uzbrojonym Hope Callem Resolve wybierasz statystykę w oknie rzutu i nikogo nie pytasz. W Daily Life GM może przepuszczać propozycje do Search i do projektu bez kliknięcia; karta mówi wtedy *Zatwierdzone automatycznie.*

### Rzut otwarcia

Każde morderstwo ma dokładnie jeden rzut otwarcia, a jego rodzaj decyduje, kto nim rzuca. Rzutu otwarcia nie da się pominąć: jeśli zamkniesz jego okno, otwiera się ponownie, do 3 razy, a gdy otworzyło się 3 razy, GM dostaje o tym wiadomość.

**Direct Murder:** rzuca zabójca, Body albo Hand przeciw **8**, nocą z przewagą; morderstwo zgłoszone podczas nocnego Eclipse otwiera się nocą. Gdy zgłaszasz Direct Murder podczas Eclipse, okno pyta *Którą statystykę proponujesz?*: Body albo Hand, domyślnie Body, a pod spodem jest twoja linijka o tym, jak to robisz. GM odpowiada na jednej karcie: pozwala na twoją propozycję, zmienia ją na drugą albo odmawia. Do zapalenia świateł nic nie słyszysz; rzut otwarcia wykonujesz potem na statystyce, na którą GM pozwolił, bez drugiego okna i bez rezygnacji.

**Zdrada** to zwrócenie się przeciw zabójcy po incydencie, w którym brałeś udział (Jeśli wejdziesz w trakcie, niżej). Potwierdzenie zdrady pyta o to samo, a poza Eclipse jej okno ma też *Jak to robisz? (opcjonalnie)*. O zdradzie GM rozstrzyga w chwili rzutu otwarcia, a ty czytasz *GM rozstrzyga o statystyce zaproponowanej do twojego rzutu otwarcia.* Bez propozycji wybiera GM: dowiadujesz się o tym i masz napisać w swoim wątku, jak się do tego zabierasz. Czuwanie ofiary z wynikiem 18 lub więcej albo krytycznym może dołożyć do twojego otwarcia kość utrudnienia (rozdział 4, Keep Watch).

**Za „?”.** Direct Murder, którego otwarcie udaje się z Hope albo jest krytykiem, ukrywa zabójcę. Ofiara i wszyscy inni widzą token zabójcy jako „?” bez imienia, a ofiara dowiaduje się tylko, że ktoś na nią rusza. Okno arkusza zabójcy otwarte u innego gracza się zamyka. Zabójca opuszcza kanał głosowy pokoju i trafia do cichego kanału tylko dla siebie: niczego nie słyszy i nikt go nie słyszy. GM i Widz widzą, kto to jest.

Jako zabójca dostajesz pytanie **Zostać w ukryciu?** Po **Ujawnij się** wszyscy znów widzą twój token i imię, a twój głos wraca do pokoju. **Zostań w ukryciu** trzyma „?” do końca pory dnia, a **Ujawnij się** zostaje do tego czasu na twoim kafelku głosu.

| Rzut zabójcy | Co się dzieje |
|---|---|
| Porażka | Nic się nie dzieje, a ofiara nigdy się nie dowie, że czegoś próbowano. Akcja jest wydana; możesz spróbować znowu o innej porze dnia. |
| Sukces z Hope | Incydent się zaczyna, a sprawa ma 5 Key Remnantów. |
| Sukces z Despair | Incydent się zaczyna, ofiara od razu traci całe Sanity i dostęp do Role Reversal na ten incydent, a sprawa ma 4 Key Remnanty. |
| Krytyk | Incydent się zaczyna, a sprawa ma najmniej Key Remnantów: 3. |

Ofiara nie widzi niczego, gdy zabójca rzuca: żadnej karty, muzyki ani niczego na panelu zdarzeń. Gdy rzut się uda, od razu dowiaduje się, że incydent się zaczął i kto na nią rusza; gdy zabójca jest ukryty za „?”, dowiaduje się tylko, że ktoś na nią rusza. Przy porażce ofiara niczego się nie dowiaduje.

**Morderstwo pośrednie (pułapka):** rzuca **ofiara**, Eye albo Head przeciw **20**, nocą tak samo jak za dnia; którą z dwóch, wybiera GM. Sama prośba o rzut jest ostrzeżeniem: słyszysz, że GM przygotowuje dla ciebie rzut, a okno nosi tytuł "Coś tu nie gra".

| Rzut ofiary | Co się dzieje |
|---|---|
| Sukces z Hope | Coś jest nie tak z tym pokojem i nie masz pojęcia dlaczego. Wydaj swój Free Move, jeśli jeszcze go masz. Przeżywasz. |
| Sukces z Despair | Rozgryzasz, co tu zastawiono, i możesz powiedzieć innym. Projekt, który za tym stoi, zostaje aktywny. |
| Krytyk | Dostrzegasz pułapkę i wiesz, czyje ręce ją zbudowały. |
| Porażka | Niczego nie zauważasz i pułapka się zamyka. |

Przy każdym sukcesie pułapka się nie zamyka, czy miałeś jeszcze Free Move, czy nie. Twoja próba dostrzeżenia pułapki zostawia Evident Remnant, a GM decyduje, co dzieje się dalej.

Przy śmierci z własnej ręki rzuca się jak zabójca, a potem od razu przechodzi do sprzątania.

### Jeśli jesteś ofiarą

Incydent toczy się na tury i zaczynasz ty. Każdy inny kafelek na twoim arkuszu gaśnie, a **Broń się** otwiera twoje akcje kryzysowe; gdy nie jest twoja tura, ten kafelek jest przygaszony. Wybierz akcję, a zobaczysz, ile kosztuje, na co się rzuca, kto wybiera statystykę i co robi porażka; **Rzuć** wysyła ją dalej. Gdy akcja wymienia kilka statystyk, twoja propozycja trafia najpierw do GM-a. Hope Calle wciąż działają.

Sam z pułapką rzucasz każdą akcję kryzysową z przewagą, a każda tura jest twoja: nikt nie działa przeciw tobie, a każda tura, którą kończysz, wraca do ciebie.

> [!WARNING]
> Od drugiej tury każda tura kosztuje cię **1 Sanity** w Direct Murder i **2**, gdy jesteś sam z pułapką: najpierw Sanity, dopóki się nie skończy, potem Health.

Gdy wiersz mówi, że porażka „kosztuje 1 dodatkowo”, to 1 punkt więcej zabrany temu, kto nie trafił: z Sanity, a gdy jego Sanity się skończy, z Health.

| Akcja kryzysowa | Rzut | Co robi |
|---|---|---|
| **Leave a Clue** | Hand / Leg / Shadow, 12 | Przy trafieniu zostawia na miejscu Remnant powiązany ze zbrodnią, który ma pomóc innym: Evident z Hope, Subtle z Despair, Obvious i Reinforced przy krytyku, a krytyk zachowuje ci turę. Porażka z Hope daje przewagę przy twojej następnej próbie Leave a Clue. Wobec pułapki: Body / Hand / Leg, z Hope Remnant jest Reinforced, a krytyk zostawia dwa Remnanty. |
| **Secure a Trace** | Hand / Leg / Shadow, 15 | Przy trafieniu zostawia na miejscu **Reinforced** Remnant powiązany ze zbrodnią, więc zabójca go nie usunie: Evident z Hope, Subtle z Despair, Obvious przy krytyku, a krytyk zachowuje ci turę. Porażka z Hope daje przewagę przy twojej następnej próbie Secure a Trace. Wobec pułapki: Body / Hand / Leg, a krytyk zostawia dwa Remnanty. |
| **Self-Defense** | Hand / Leg / Body, 18 | Walczysz. Trafienie z Hope otwiera Survive i Role Reversal, z Despair tylko Role Reversal; krytyk otwiera oba, na dobre zatrzymuje utratę punktów co turę, zachowuje ci turę i pozwala wziąć jedno z nich w tej turze bez rzutu. Przy trafieniu i przy pudle zostawia Evident Remnant. Broń w ręku daje przewagę. Trafienie zużywa Self-Defense na ten incydent, pudło nie; trafienie, które otworzyłoby tylko Role Reversal, którego nie możesz wziąć, też go nie zużywa i możesz spróbować znowu. Porażka z Despair kosztuje 1 dodatkowo. |
| **Survive** | Leg, 18 | Wycofujesz się: trafienie kończy incydent i zatrzymuje utratę punktów co turę. Z Despair dostajesz też podpowiedź, kto jest zabójcą; krytyk daje tę podpowiedź i nietykalność na ten i następny rozdział. Każda porażka kosztuje 1 dodatkowo. Wymaga najpierw Self-Defense. |
| **Role Reversal** | Hand / Leg / Body, 15 | Przy trafieniu ty i zabójca zamieniacie się stronami, a Health i Sanity traci odtąd zabójca. Z Hope albo przy krytyku odzyskujesz też całe Health i Sanity; krytyk od razu zabija zabójcę i zostawia Incident Remnant (Evident, Reinforced). Broń w ręku daje przewagę. Porażka z Despair kosztuje 1 dodatkowo. Wymaga najpierw Self-Defense. Nie działa wobec pułapki ani wtedy, gdy ktoś już dołączył do zabójcy. |
| **Use an Item** | Hand, 15 | Wciśnij przycisk użycia przy przedmiocie na arkuszu. Trafienie z Hope albo krytyk używa przedmiotu, a krytyk zachowuje ci turę; trafienie z Despair go nie używa. Każde trafienie zostawia Remnant. Porażka z Despair kosztuje 1 dodatkowo. Przedmiot Tier 0 czeka na decyzję GM-a i nie jest zużyty, dopóki GM nie zdecyduje. |

Survive i Role Reversal to akcje rozstrzygnięcia: każda kosztuje **1 Sanity** zamiast akcji, a gdy Sanity się skończy, **1 Health**. Pozostałe akcje kryzysowe nie kosztują akcji. Nic, co zrobi zabójca, nie zdejmie z mapy Reinforced Remnantu.

> [!CAUTION]
> Ofiara, której skończą się i Health, i Sanity, umiera.

### Jeśli jesteś zabójcą

Twoje akcje w tym samym incydencie są za kafelkiem **Akcje kryzysowe**.

| Akcja | Rzut | Co robi |
|---|---|---|
| Strike | Hand / Leg / Body, 15 | Trafienie zdejmuje ofierze 1 Health i 1 Sanity i zostawia Remnant: Hidden z Hope, Subtle z Despair. Krytyk zdejmuje oba punkty z jednego zapasu, który wybierzesz, Health albo Sanity, i nie zostawia Remnantu. Porażka z Despair wciąż zdejmuje 1 Sanity i zostawia Evident Remnant. |
| Pin Them Down | Body, 12 | Utrudnienie na Leave a Clue i Survive ofiary przez jej 2 najbliższe tury; krytyk zamiast tego blokuje obie te akcje. Z Despair trafienie zostawia Subtle Remnant, a pudło Evident Remnant. |
| Keep Your Distance | Leg, 12 | Utrudnienie na Secure a Trace i Role Reversal ofiary przez jej 2 najbliższe tury; krytyk zamiast tego blokuje obie te akcje. Z Despair trafienie zostawia Subtle Remnant, a pudło Evident Remnant. |
| Attack with a Weapon | Body / Hand / Leg, 15 | Zdejmuje 1 + połowę Tier broni (w górę) Health, a krytyk 1 + cały Tier. Remnanty broni stają się powiązane ze zbrodnią. Bez broni w ręku rzucasz z utrudnieniem; jeśli nie nosisz żadnej broni, przy trafieniu chwytasz coś pod ręką jako improwizowaną broń: Tier 2 z Hope albo przy krytyku, Tier 1 z Despair. Przedmiot Tier 0 GM ocenia od 0 do 2. Trafienie z Despair zostawia Subtle Remnant, a pudło z Despair Evident Remnant. |
| Finishing Blow | Body / Leg / Hand | Próg to pięciokrotność Health, które zostało ofierze, a 0, gdy nie ma już Health. Trafienie kończy incydent. Z Despair Finishing Blow zostawia Evident Remnant, przy trafieniu i przy pudle; krytyk z Despair sprawia, że twoja pierwsza próba sprzątania nie kosztuje Sanity, udana czy nie. |
| Use an Item | Hand, 15 | Działa tak samo jak u ofiary. |

Finishing Blow to też akcja rozstrzygnięcia: kosztuje 1 Sanity, a gdy Sanity się skończy, 1 Health.

Akcja wymierzona w drugą stronę wymaga o 1 więcej, gdy ta strona jest silna: Strike, Attack with a Weapon i Pin Them Down, gdy Body ofiary to +1 lub więcej; Keep Your Distance, gdy Leg ofiary to +1 lub więcej; Self-Defense i Role Reversal, gdy Body zabójcy to +1 lub więcej; Survive i Escape Together, gdy Leg zabójcy to +1 lub więcej. Kafelek to mówi, na przykład "Pobij 16 (+1 za Body ofiary)". Rzuty otwarcia nigdy się tak nie zmieniają.

Po incydencie przychodzi sprzątanie. Twój kafelek Tamper wymienia teraz każdy Remnant w pokoju, w którym stoisz, twój i każdego innego. Na własnej scenie próba nie kosztuje akcji, tylko **1 Sanity**. Usuwanie, przerabianie i Misleading Trail rzucają Shadow i nikogo nie pytasz.

| Opcja | Rzut i co robi |
|---|---|
| **Erase a Trace** | tabela Tamper w rozdziale 4 |
| **Reshape a Trace** | o 3 niżej niż usuwanie; nadajesz Remnantowi nową nazwę i opisujesz go jako coś niewinnego, a GM zatwierdza twoje słowa, zanim trafią na Remnant. Przerobiony Remnant zawsze kończy jako Tamper Remnant; krytyk czyni go o jedno pasmo trudniejszym do zauważenia i oddaje to, co próba kosztowała. |
| **Misleading Trail** | 15; krytyk oddaje to, co próba kosztowała |
| **Move the Body** | Body, 16. Przed rzutem wybierasz pokój połączony z pokojem ciała albo pokój dwa dalej, nigdy do sypialni ani przez sypialnię. Trafienie przenosi tam ciało i zawsze zostawia Evident Remnant; do pokoju dwa dalej dociera tylko krytyk, a każde inne trafienie zostawia ciało w pokoju pomiędzy. Krytyk dodatkowo oddaje to, co próba kosztowała, a porażka zostawia ciało tam, gdzie jest. |

Udany Misleading Trail albo udane przeniesienie ciała od razu kładzie na twój arkusz Truth Bullet Remnantu, który zostawiło, jakbyś go znalazł, z dopiskiem *Znasz ten Remnant: jest na twoim arkuszu.* Porażka nie daje ci Truth Bulletu, usunięty ani przerobiony Remnant też nie, a Reroll tego rzutu zabiera Truth Bullet.

Narzędzie do sprzątania w ręku pomaga (rozdział 7, W ręku). Gdy w pokoju są świadkowie, najpierw wykonujesz ten sam rzut maskowania Shadow-16 co przy każdym Tamper, z tym samym kosztem Sanity za przyłapanie (rozdział 4); Move the Body nie rzuca na maskowanie.

> [!WARNING]
> Każde narzędzie zbrodni, którym zamachnąłeś się w walce, zostaje zniszczone, gdy zamyka się incydent, który doszedł do sprzątania; Finishing Blow nie jest zamachem. Każde narzędzie do sprzątania, którego użyłeś przy próbie sprzątania, zostaje zniszczone, gdy znajdzie się ciało twojej ofiary, nawet jeśli od tamtej pory je odłożyłeś; to, które schowałeś do skrytki, ocaleje. Jeśli nie sprzątałeś, zniszczone zostaje narzędzie do sprzątania, które masz wtedy w ręku. Oba zostają w ekwipunku jako zepsute dowody.

### Jeśli wejdziesz w trakcie

Wejście do pokoju, w którym trwa Direct Murder, daje ci jeden wybór, który nie kosztuje akcji; w pułapce nie ma nikogo, komu można by przeszkodzić. Czwarta osoba wchodząca do pokoju odwołuje incydent: nikt nie ginie, ale rany zostają.

| Wybór | Rzut | Co robi |
|---|---|---|
| Escape Together | Leg, 15 | Trafienie wyprowadza was oboje i kończy incydent; z Hope albo przy krytyku ofiara odzyskuje Health i Sanity, a krytyk daje wam obojgu nietykalność na ten i następny rozdział. Przy porażce wychodzisz tylko ty i już nie wracasz. Zostawia Incident Remnant: Obvious z Hope, Evident z Despair, Subtle przy porażce, a przy krytyku żadnego. |
| Double Role Reversal | bez rzutu | Ty i ofiara razem zwracacie się przeciw zabójcy i stajecie się stroną zabójców; od tej pory to wy rozgrywacie jej tury. Zabójca staje się ofiarą i nie może wziąć Role Reversal. Nikt nie zostaje uleczony. Zostawia Evident Remnant. |
| Partners in Crime | bez rzutu | Stajesz po stronie zabójcy i od tej pory rozgrywasz tury po stronie zabójców. Ofiara nie może już wziąć Role Reversal i raczej stąd nie wyjdzie. Zostawia Subtle Remnant. |
| Averted Eyes | bez rzutu | Wychodzisz, nie bierzesz udziału i już nie wracasz. Nie zostawia po tobie Remnantu. |

Escape Together kosztuje tyle co akcje rozstrzygnięcia ofiary: 1 Sanity, a gdy twoje Sanity się skończy, 1 Health. Trzy wybory bez rzutu nic nie kosztują. Use an Item nie należy do twoich wyborów.

Jeśli incydent zostawi ciało, możesz potem zwrócić się przeciw zabójcy, czyli go zdradzić: jeśli stanąłeś po jego stronie albo, w Direct Murder, jeśli zostałeś i niczego nie wybrałeś. Nie możesz, jeśli odszedłeś albo próbowałeś Escape Together, i nigdy jako trzecia osoba po stronie ofiary pułapki. Oferta trwa do końca dnia, z Investigation włącznie, ale nie podczas Class Trial.

Poza Eclipse to jedyne zabójstwo, które nie wymaga wcześniejszego zgłoszenia. W Eclipse zgłaszasz je jak każdą akcję w nim: kosztuje akcję i otwiera się, gdy Eclipse się skończy. Jeśli nie może się otworzyć, gdy przyjdzie jego czas, dowiesz się dlaczego i zachowasz ofertę, póki trwa dzień.

> [!NOTE]
> Moduł sam nakłada obrażenia i Remnanty, prowadzi tury i wykonuje zamianę stron przy Role Reversal, razem z Health i Sanity, które ona przywraca. Resztę tego, co obiecują te tabele, załatwia GM: zabójstwo z krytycznego Role Reversal, Health i Sanity przywracane przez Escape Together, każdą nietykalność i podpowiedź z Survive o tym, kto jest zabójcą.

### Następny poranek

Ktoś znajduje ciało. Ciało zostaje znalezione w chwili, gdy w pokoju z nim stanie dwoje uczniów, a przynajmniej jedno z nich nie należy do zabójców, ale nigdy podczas Eclipse. GM decyduje wtedy, kiedy je ogłosić, i może też ogłosić je ręcznie. Sami zabójcy, wciąż sprzątając, mogą stać nad ciałem i go nie znaleźć. Zmarli nie są świadkami, Monocub też nie.

Po ogłoszeniu wszyscy są wzywani na miejsce, a ekran każdego przesuwa się tam na token jego własnej postaci. Ciało jest ogłaszane raz: późniejsze przejście obok niego, werdykt ani koniec rozprawy nie ogłaszają go ponownie. Gdy ciało czeka na swoje Investigation, gra toczy się dalej i nadal możesz działać, ale żadne Eclipse nie zacznie się, dopóki GM nie otworzy Investigation. Śmierć z własnej ręki to zabójstwo jak każde inne, a klasa ma do dyspozycji tylko to, co zostało na miejscu.

Dopóki ktoś nie znajdzie ciała, GM-owie zachowują śmierć dla siebie: stół się o niej nie dowiaduje, a nic na ciele o niej nie mówi. Ci, którzy byli w incydencie, wiedzą. Jeśli natkniesz się na ciało, gdy w pokoju nie ma nikogo innego, dowiadujesz się prywatnie, co znalazłeś, i tylko twój ekran pokazuje je jako ciało; nikt inny się nie dowiaduje, bo jeden świadek to jeszcze nie odkrycie. Gdy jest tam ktoś jeszcze, dowiadujesz się tego samego i tego, że nic nie zostanie ogłoszone, dopóki GM nie zdecyduje.

Za każdym razem, gdy twoja postać wchodzi do pokoju, w którym leży ciało, słyszysz dźwięk znalezienia: raz przy każdym ciele, bez względu na to, czy ktoś jest z tobą, przed ogłoszeniem czy po nim, na swoim ekranie i na niczyim innym. Możesz wtedy przeszukać kieszenie ciała, tak jak ci, którzy byli w incydencie (rozdział 11). Truth Bullet ciała, który mówi, czyje to było ciało, przychodzi, gdy śmierć zostanie ujawniona.

---

## 11. Investigation

- Każdy żyjący uczeń dostaje bez rzutu **Autopsy Truth Bullet** z godziną odkrycia, przyczyną śmierci i tym, co pokazuje ciało.
- Remnanty na mapie badasz przez **Observe**, to, co zbierzesz, przez **Analyze**, a kopię dajesz osobom w twoim pokoju przez **Podziel się kopią**. Remnanty powiązane ze zbrodnią są pokazywane pierwsze.
- GM-owie przygotowali do tej sprawy **Key Remnanty**: nigdy więcej niż 5 i nigdy mniej niż 3, a im lepiej poszedł rzut otwarcia zabójcy, tym jest ich mniej (rozdział 10); sprawa pułapki ma ich 5. Razem zawężają podejrzanych do grupy od 2 do 4 osób; trop zawęża krąg, ale nigdy nie wskazuje nazwiska.
- **Ciało** można przeszukać i nie kosztuje to akcji: otwórz arkusz zmarłego ucznia i wciśnij **Take from the Body** pod tym, co miał przy sobie. Okno pokazuje jego rzeczy obok opisu akcji; zaznacz, co bierzesz, i wciśnij **Weź**.
- Każde zabranie to jeden rzut na **Hand**: przy każdym zabraniu liczy się tylko pierwszy rzut, a gdy zabranie zostanie odrzucone, bo wyszedłeś z pokoju, jego rzut czeka na następną próbę. Im niższy wynik, tym łatwiej znaleźć Remnant, który zostawiasz: poniżej 12 jest Evident, od 12 do 17 Subtle, od 18 albo przy krytyku Hidden.
- Dostajesz samą rzecz i Truth Bullet, który zapisuje, co wziąłeś i od kogo. Na ciele zostaje jeden Remnant mówiący, że ktoś przeszukał kieszenie, ile by rzeczy z niego wyszło; kolejne zabrania mogą ten Remnant uczynić łatwiejszym do znalezienia, nigdy trudniejszym.
- Gdy w pokoju jest ktoś jeszcze, nawet ktoś, kogo twój ekran nie pokazuje, rzucasz też **Shadow** przeciw 16, żeby nikt nie zauważył. Pudło mówi pozostałym w pokoju i GM-om, że przeszukałeś kieszenie ciała, a przy Despair także, co zabrałeś. Rzut na Shadow nie kosztuje Sanity.
- Śledczy i zabójcy jednakowo mogą użyć **Tamper** (rozdział 4). Zbyt czysta plama to dowód sprzątania.
- Key Remnant, którego nikt nie znajdzie, kosztuje Despair. W Class Trial Monokuma może go ujawnić wszystkim uczestnikom jako znaleziony Key Remnant, z rodzajem i tekstem, do Analyze jak zwykle.

> [!WARNING]
> Klasa powinna znaleźć cztery Key Remnanty albo wszystkie, gdy sprawa ma ich mniej niż cztery. Każdy brakujący Key Remnant, liczony poniżej czterech, jest wart **3 Despair** dla każdego Monokumy: sprawa z pięcioma Key Remnantami, z których znaleziono trzy, kosztuje 3, a sprawa z trzema, wszystkimi znalezionymi, nie kosztuje nic. Za znaleziony liczy się tylko ten, który ma żyjący uczeń.

---

## 12. Class Trial

Wszyscy są w jednej sali i nikt jej nie opuszcza. Class Trial zaczynasz z odnowionymi akcjami, jak na początku pory dnia: Wounded nie odbiera ci w nim żadnej akcji, ale zaciemnienie Panic wciąż zabiera swoją jedną (rozdział 6). Rozprawa nie kończy pory dnia, a Sprint albo Burst w zapasie zostaje w zapasie. Na arkuszu otwarte jest tylko Analyze, do tego Hope Calle i twoje przedmioty. W Class Trial Analyze tylko identyfikuje Truth Bullety, bez wskazówki, bez ukrytej skrytki i bez przejścia, i kosztuje **1 akcję**, a gdy akcji zabraknie, **1 Hope**, a gdy nie ma i tego, **1 Sanity**.

Gdy GM przygotował salę rozpraw, początek rozprawy przenosi tam twój ekran, a jej koniec zabiera cię z powrotem do szkoły: żyjących, którzy brali udział, do pokoju, który wybierze GM. GM wybiera, kto bierze udział. Na czas rozprawy token twojej postaci staje w sali, a potem zostaje z niej usunięty.

Na czas rozprawy wszyscy są w jednym pokoju głosowym, także zmarli, a zasada stołu brzmi: **umarli słuchają, ale nie mówią w rozprawie**: moduł wyłącza mikrofon gracza zmarłego ucznia, gdy rozprawa się otwiera, i oddaje go, gdy się kończy - także przy śmierci, której nikt nie znalazł, więc mikrofon, który milknie, mówi stołowi, że ktoś zginął. Twój kafelek głosu mówi dlaczego. Monocub mówi tylko w otwartej dyskusji, gdy nie trwa żaden tryb, a słucha w każdym trybie, od głosowania i przez całą rozprawę w sprawie własnej śmierci; kafelek mówi, kiedy może mówić, a kiedy tylko słucha. Uczeń skazany werdyktem mówi do końca rozprawy. Moduł wycisza tylko zmarłych, a tego, kto mówi w danym trybie, pilnuje stół.

Class Trial otwiera się **otwartą dyskusją**: mówią wszyscy i nikt nie wnosi objection, a Truth Bullet można za darmo **Przedstawić** z ekwipunku. Trafia na stół jako karta dla wszystkich, z twoim komentarzem, i nikomu nie zabiera głosu. Na kartę trafia tylko to, co sam widzisz. Zaznacz **Pokaż z wynikiem mojego Analyze**, żeby pokazać, co odczytało twoje Analyze; bez zaznaczenia karta pokazuje dowód jako nigdy nieanalizowany, bez odczytu i bez rodzaju, który wyszedł z analizy. Każdy inny uczestnik dostaje na arkusz kopię, tak jak ją pokazano, za darmo i raz. Dowiadujesz się, kiedy dowód trafił na stół. W Class Trial Truth Bullet nie ma Podziel się kopią: dowody przechodzą z rąk do rąk przez Przedstaw. Martwy uczeń ani nie przedstawia dowodów, ani nie wnosi objection.

Gdy sala jest gotowa się spierać, GM otwiera **Nonstop Debate**, z pytaniem, jeśli GM je poda, widocznym na karcie Class Trial i na kartach debaty. Zegar Nonstop Debate to budżet GM-a, domyślnie **180 sekund**; po przekroczeniu zegar robi się czerwony i nic więcej się nie dzieje. Wewnątrz debaty przerywasz przyciskiem **OBJECTION!** na swoim kafelku głosu, a gdy kafelka głosu nie ma, w wierszu rozprawy na HUD-zie; poza Class Trial przycisk jest wyszarzony, *Objection możesz wnieść tylko podczas Class Trial.* Objection kosztuje tyle co Analyze (1 akcja, inaczej 1 Hope, inaczej 1 Sanity) i płacisz w chwili naciśnięcia. Zyskujesz za nie głos, żeby spierać się z tym, co padło; Objection nie daje Hope ani niczego innego. Każdy tryb, tak jak otwiera go GM albo zaczyna Objection, opisuje tabela niżej, a trzy tryby, w których odpowiadasz tokenem, są w części Strefy sali.

| Tryb | Kto mówi | Jak długo | Kto wnosi objection | Kto przedstawia dowody |
|---|---|---|---|---|
| Nonstop Debate | wszyscy | budżet GM-a | każdy, w tego, kto mówi | wszyscy |
| OBJECTION | tylko wnoszący | 60 sekund | nikt | wszyscy |
| Rebuttal | wnoszący i osoba, w którą wymierzono Objection | 120 sekund, potem głos się zamyka i Class Trial wraca do otwartej dyskusji | każdy, ale tylko wobec jednej z dwóch osób, które mają głos | wszyscy |
| Testimony | po jednym uczestniku, w kolejności ustalonej przez GM-a | proponowane 60 sekund na turę; GM może ustawić od 30 do 120 | każdy inny, tylko w mówcę | tylko mówca |
| Panic Round | po jednym uczestniku, po kolei | 15 sekund na turę (10 od 12 uczestników) | nikt | tylko mówca |
| Closing Argument | mówca, którego GM zatwierdzi albo wybierze | 300 sekund | każdy inny, tylko w mówcę | mówca, a gdy ktoś wniesie w niego Objection, dwie osoby tej wymiany |

Nie wybierasz, komu zaprzeczasz: Objection trafia w tego, kto mówi teraz (liczy się mniej więcej sekunda mowy), a gdy nikt nie mówi, w ostatniego gracza, który mówił w tej rozprawie; nigdy w GM-a, Monocuba, ucznia, którego śmierć ogłoszono, ani w ciebie czy innego twojego ucznia. Przycisk podaje tę osobę, zanim go naciśniesz; jeśli nikt jeszcze nie mówił, mówi to i nic nie jest pobierane. Gdy moduł nie słyszy, kto mówi, po naciśnięciu sam wybierasz, komu zaprzeczasz. Potem wybierasz Truth Bullet: masz na to **30 sekund**, odliczanych w oknie. Dopóki Truth Bullet nie trafi na stół, karta Objection mówi, że czeka; 60 sekund zaczyna się, gdy trafi. Jeśli zamkniesz okno albo czas minie, Objection przepada, jego karta o tym mówi, a koszt nie wraca. Gdy twoje Objection przejmuje głos, dowiadujesz się, ile kosztowało. Karta Objection stoi nad każdym oknem, dopóki jej nie klikniesz.

GM może przekierować trwające Objection na kogoś innego. GM może też użyć przycisku **Oddalenie** wobec najnowszego Objection, na przykład naciśniętego przez pomyłkę albo niezwiązanego z tym, co mówi mówca: jego karta dostaje pieczątkę **Objection oddalone przez GM-a**, to, co zapłaciłeś, zostaje zapłacone, a rozprawa wraca tam, gdzie była, z czasem, jaki wtedy miała. Pasek GM-a może też pominąć turę, odjąć albo dodać pół minuty (w Panic Round 5 sekund), zakończyć tryb albo wrócić do debaty, a każdą z tych rzeczy widać na ekranie (karta albo *GM: +30 s* na karcie Class Trial). Na każdym ekranie zegar podaje tryb, a karta Class Trial na panelu zdarzeń pokazuje tryb, kto ma głos (w rebuttalu także, komu odpowiada) i ile zostało czasu.

GM może też otworzyć trzy tryby, w których mówi jedna osoba naraz. W **Testimony** i **Panic Round** każdy uczestnik mówi po kolei: w twojej turze okno mówi *Twoja tura (n s)*; **Gotowe** kończy twoją turę, a **Pasuję** oddaje ją następnemu mówcy. Ekrany podają, kto mówi i kto następny; jeśli w swojej turze nie jesteś połączony, tura przechodzi dalej. Gdy mówi ktoś inny, słuchasz. Po Objection w Testimony runda idzie dalej od następnego mówcy. Dowody przedstawia tylko mówca (*Teraz dowody może przedstawiać tylko name.*).

W **Closing Argument** najpierw gra pyta cię, czy podsumujesz sprawę: odpowiadasz **Podsumuję** albo **Ktoś inny** i masz na to 30 sekund. Spośród zgłoszonych losowany jest jeden, a GM go zatwierdza albo wybiera kogoś innego. Mówca ma 300 sekund. Jeśli to ty jesteś mówcą, **Pasuję** w pierwszych 30 sekundach oddaje wybór GM-owi, a później kończy Closing Argument; **Gotowe** też go kończy. Gdy ktoś wniesie Objection wobec mówcy, do końca tej wymiany dowody przedstawiają tylko jej dwie osoby, a ekran mówi *Teraz dowody mogą przedstawiać tylko name i name.* Po wymianie GM decyduje, kto mówi dalej: mówca, z czasem, który mu został, albo ktoś, kto wniósł Objection, z nowymi 300 sekundami. Closing Argument odbywa się raz na rozprawę i kończy się przed głosowaniem, a ostatnie słowo w nim nie daje Hope.

### Głosowanie

Każdy żyjący gracz dostaje **kartę do głosowania**, jedną na osobę, niezależnie od tego, ilu uczniów grasz; uczeń, którego gra tylko GM, nie dostaje żadnej. Nie dostają jej Monocub ani zmarli, także ci, których śmierci nikt jeszcze nie znalazł. Jeśli połączysz się w trakcie głosowania, twoja karta przychodzi, gdy wczytuje się gra. Głosuj na tego, kto twoim zdaniem jest **Blackened**, czyli uczniem, który zabił; możesz głosować na siebie, na Monokumę i na zmarłych. Nikt nie widzi twojego głosu: trafia tylko do GM-ów, a publikowane są tylko sumy. **Twój głos oddany.** znaczy, że GM go zapisał, a gdy widzisz *Żaden GM nie ma jeszcze twojego głosu. Trafi do GM-a, gdy tylko się połączy.*, głos wyjdzie, gdy tylko połączy się GM. Jeśli zamkniesz kartę bez głosu, twój głos się nie liczy; jeśli chcesz zagłosować, poproś GM-a, żeby wysłał kartę jeszcze raz.

> [!IMPORTANT]
> Skazanie wymaga **więcej niż połowy** wydanych kart - dla każdego nazwiska, gdy głosowanie pyta o więcej niż jedno. **Remis liczy się jak błędny głos**, chyba że stół to rozstrzygnie.

| Wynik | Co się dzieje |
|---|---|
| **Trafnie** | Blackened zostaje stracony, gdy rozprawa się kończy. Każdy ocalały dostaje **Level Up** (wybierz 1). |
| **Błędnie** | Stracony zostaje oskarżony, gdy rozprawa się kończy. Blackened pozostaje anonimowy i w grze, z **Reinforced Level Upem** (wybierz 3) i jedną nową zasadą własnego wyboru, a każdy Monokuma napełnia swoją pulę Despair. |

W jednym rozdziale może być dwóch Blackened, bo zwrócenie się przeciw zabójcy może zostawić dwa ciała (rozdział 10); głosowanie musi wskazać <ins>wszystkich</ins>.

Potem wszyscy widzą jedną kartę, **WERDYKT**: kto jest skazany albo że nikt, i czy klasa trafiła; nigdy nie wymienia Blackened, którego klasa nie wskazała. Werdykt nikogo nie zabija: wyrok jest wykonywany, gdy rozprawa się kończy, a wszyscy widzą wtedy kartę **EGZEKUCJA**. Jeśli to twoja postać, dowiadujesz się o tym także prywatnie.

### Level Up

GM decyduje, kto wybiera każdy Level Up. Jeśli wybierasz ty, dowiadujesz się o tym, a przycisk **Level Up** na twoim arkuszu się zapala: naciśnij go i wybierz. Możesz mieć ich więcej niż jeden, a każdy czeka, aż go wykorzystasz albo GM go cofnie. Wybór, którego twój arkusz nie przyjmie, na przykład doświadczenie, którego twoja postać nie ma, jest odrzucany; dowiadujesz się o tym, a Level Up zostaje twój.

| Opcja |
|---|
| Zwiększ jedną statystykę o +1; punkt w Head podnosi też twoje maksimum Sanity o 1, a punkt w Body albo Leg twoje maksimum Health o 1 |
| Zwiększ jedno doświadczenie o +1 |
| Dodaj nowe doświadczenie warte +2 |

Przy Reinforced Level Upie tę samą opcję można wziąć więcej niż raz. Reinforced Level Up czeka na następny Level Up klasy, a jego właściciel dowiaduje się o tym prywatnie: wybiera go razem z Level Upem klasy, gdy głosowanie trafnie wskaże Blackened, albo przy werdykcie Final Trial. Przepada, jeśli właściciel wcześniej zginie.

Jeśli kiedyś wziąłeś jako Level Up +1 Health albo +1 Sanity, GM może wyrównać twój arkusz (rozdział 17).

### Strefy sali

W **Straw Poll**, **Logic Dive** albo **Scrum Debate** odpowiadasz tym, gdzie stoi twój token w sali rozpraw. Strefy to **Strefa A** i **Strefa B**, każda nazwana swoją odpowiedzią: przesuń token do wybranej. Jeśli się nie ruszysz, odpowiadasz strefą, w której leży twoje stanowisko. Token na linii między strefami albo poza obiema nie liczy się po żadnej stronie. Bez tokenu w sali dostajesz okno wyboru strony. W żadnym z tych trzech trybów nikt nie wnosi objection. Gdy tryb się kończy, twój token wraca na stanowisko.

| Tryb | Jak zapada rozstrzygnięcie | Kto przedstawia dowody |
|---|---|---|
| Straw Poll | dwie trzecie klasy po jednej stronie to **Finding**: *Klasa uważa: ...* | wszyscy |
| Logic Dive | na każde pytanie odpowiada większość; zła odpowiedź albo remis kończą zestaw, a dobrej odpowiedzi nie widać; zestaw z dobrymi odpowiedziami do końca jest rozwiązany i może dać Finding | wszyscy |
| Scrum Debate | trzy fazy: w fazie **Strony** wybierasz strefę; w fazie **Narada obozów** twój obóz rozmawia we własnym pokoju głosowym, a ty nie słyszysz nikogo innego (HUD mówi, z którym obozem się naradzasz); potem debata, z powrotem w pokoju rozprawy, gdzie obozy mówią na zmianę. Każdy może w każdej chwili przejść na drugą stronę. Obóz, który się opróżni, kończy debatę, a odpowiedź drugiego obozu staje się Finding; po ostatniej turze obozy dostają wiadomość, ale żaden Finding nie powstaje | tylko mówca |

Finding to coś, co klasa ustaliła. Rozprawa prowadzi listę Findings: GM może dodać, zmienić albo usunąć Finding na karcie, którą widzą wszyscy, a karta otwierająca głosowanie wymienia Findings.

### Final Trial

Ktoś wśród was mógł zbudować to miejsce. **Final Truth Remnanty**, po jednym na rozdział i nieusuwalne, wskazują Masterminda. Wskażcie go w Final Trial, a killing game dobiega końca. Wskażcie niewłaściwą osobę, a nikt nowy nie zostaje stracony; klasa widzi wtedy, że gra nigdy nie była tym, na co wyglądała.

---

## 13. Śmierć i to, co po niej

- Zmarli nie wykonują akcji i nie wydają Hope. Zachowujesz arkusz; gdzie trafia twój głos, mówi punkt niżej, a w Class Trial słuchasz (rozdział 12).
- Twój głos po śmierci w incydencie: dopóki ten incydent trwa, zostajesz w pokoju swojej śmierci. Do Widzów przechodzisz, gdy tylko incydent się skończy, ktoś znajdzie twoje ciało, wejdzie tam żywy uczeń spoza incydentu albo GM przeniesie twój głos; poza incydentem dzieje się to od razu. Potem rozmawiasz z Widzami, czy twoja śmierć jest znana, czy nie: żywi cię nie słyszą, ty słyszysz Widzów i innych zmarłych, a mikrofon zostaje twój. Na Class Trial wracasz do pokoju głównego razem ze wszystkimi i słuchasz (rozdział 12). Jako Monocub mówisz jak Monocub.
- Twoje **Truth Bullety przepadają razem z tobą**, gdy twoja śmierć wyjdzie na jaw, chyba że GM je zachowa. Wszystko inne zostaje przy ciele do znalezienia, tak jak było: zmarli niczego nie używają, nie biorą do ręki, nie wyrzucają, nie chowają ani nie wyjmują, a rzeczy Monocuba też należą do jego ciała.
- Przeszukanie ciała działa tak, jak opisuje rozdział 11: **Take from the Body** jest na arkuszu ciała, wymaga rzutu Hand i zostawia Remnant. Musisz stać w jego pokoju i żyć, a w czasie Class Trial ani Eclipse nie da się tego zrobić; dopóki ciała nikt nie znalazł, mogą to zrobić tylko ci, którzy wiedzą o śmierci. Rzecz, której nie możesz wziąć, jest w oknie wyszarzona, z powodem obok: nie jesteś tam, gdzie trzeba, albo nosisz już najwięcej rzeczy tego rodzaju i nie masz skrytki. Okno zamyka się, gdy naciśniesz **Weź**. Jeśli **Weź** niczego nie zabierze, okno mówi tylko dlaczego, na przykład że wyszedłeś z pokoju albo ktoś inny wziął to pierwszy; otwórz okno ponownie, żeby zobaczyć, co możesz wziąć teraz.
- Jeśli zginiesz w incydencie, nikt inny się nie dowie, dopóki ktoś nie znajdzie twojego ciała albo GM tego nie ujawni: twój arkusz pokazuje cię jako martwego, z *Nikt jeszcze nie znalazł twojego ciała.* Do tego czasu stół może brać cię za żywego, ale w Class Trial twój mikrofon jest wyłączony jak każdego zmarłego ucznia i nie dostajesz karty do głosowania, więc po milczącym mikrofonie i brakującej karcie stół dowiaduje się, że ktoś zginął. Level Up za trafny werdykt nadal dostajesz i ty, jak każdy uczeń, którego stół uważa za żywego.
- Ciało zostaje tam, gdzie upadło, i zabójca może je przenieść. Zmarli nie liczą się jako obecni w pokoju, więc nie są świadkami i nic nie przekazują.
- GM może zakończyć rozdział, ujawniając, czym naprawdę był każdy Truth Bullet, zbierając Truth Bullety i czyszcząc Faint Remnanty; gdy zbiera Truth Bullety, Faint i Final Truth zostają.

### Gra Monocubem

Gdy twoja śmierć stanie się jawna dla stołu, GM-owie mogą cię zaprosić do dalszej gry jako **Monocub**. Okno pokazuje ci Zasadę Monocuba, *Nigdy nie mówisz żywym tego, co wiedzą tylko zmarli: kto cię zabił, jak, ani co widzisz od teraz.*, i to, co grozi za jej złamanie: za pierwszym razem rozmowa z GM-em, za drugim odebranie roli Monocuba, za trzecim opuszczenie gry. **Przyjmuję Zasadę** robi z ciebie Monocuba; **Nie teraz** zamyka zaproszenie, a GM-owie się o tym dowiadują. Monocub to ta sama postać z tym samym arkuszem, a jego panel akcji staje się **Confusion**, **Redeem**, **Ask for Hope**, **Tinker** i **Ghost Bet**. Ruszasz się, przeciągając token, jak dotąd; kafelka Move nie ma.

- Zaczynasz z 0 Hope, z pełnym Health i Sanity, i masz tyle akcji co żyjący, niezraniony uczeń; Wounded nigdy nie odbiera Monocubowi akcji. Twoje rzuty widzą wszyscy, którzy stoją w twoim pokoju.
- **Poruszasz się swobodnie.** Przejście do połączonego pokoju nie kosztuje cię akcji ani Free Move, także podczas Eclipse. Do pokoju, w którym trwa morderstwo, nie wejdziesz, a odmowa mówi tylko *Teraz nie możesz tego zrobić.* Dwie stopy na twoim arkuszu i pasku stanu zawsze pokazują Move jako dostępny.
- **Widzisz każdy pokój, który znalazła klasa**, nie wiedząc, kto który znalazł; tego, co znalazł Mastermind, wśród nich nie ma.
- **Confusion** kosztuje **1 akcję i 1 Hope**, a twój Hope bierze się z tego, że Monokuma zamienia w niego Despair (Fuel a Monocub), albo z ruchów niżej. To goły rzut 2d12, bez statystyki. Wybierz kogoś w swoim pokoju i pomóż albo przeszkódź przy jego następnym rzucie (zobacz tabelę poniżej). Cel dowiaduje się, że coś go uspokoiło albo rozproszyło, nigdy kto, ale wszyscy w twoim pokoju widzą, że rzucasz, więc mogą się domyślić, że to ty. Ruch, którego odmówiono, nic cię nie kosztuje: odmowa Confusion mówi *Confusion ich nie dosięga. Nie tracisz akcji ani Hope.*
- **Jeden uczeń, dwa ruchy dziennie.** Uczeń może być celem jednego ruchu Monocuba na porę dnia i dwóch na dzień gry, licząc wszystkie Monocuby przy stole; ruch nieudany też się liczy.
- **Redeem** nic nie kosztuje i daje ci +1 Hope, raz na dzień gry; nie przy pełnym Hope i nie wtedy, gdy trwa zaciemnienie Despair (rozdział 6). Gdy możesz go użyć, panel zdarzeń mówi *Redeem czeka*.
- **Ask for Hope** nic nie kosztuje: GM-owie dostają kartę i dają ci 1 albo 2 Hope albo odpowiadają *Nie teraz*. Masz jedno Ask for Hope naraz; możesz poprosić znowu, gdy GM odpowie, albo o następnej porze dnia, i nie przy pełnym Hope.
- **Tinker** kosztuje **1 akcję i 1 Hope**: to Confusion wymierzone w projekt. Potrzebujesz jawnego, nieukończonego projektu w twoim pokoju, nad którym o tej porze dnia pracował żywy uczeń; 12 lub więcej przesuwa go o krok do przodu (Pomóż) albo do tyłu (Przeszkódź), nigdy aż do ukończenia, a krytyk oddaje ci Hope. Pokój widzi, że rzucasz i w którą stronę, nigdy przy czym.
- **Twoja sakiewka.** Hope, który płaci ci Bribe, Bounty albo Ghost Bet, trafia do sakiewki trzymanej dla ciebie przez GM-ów. Sakiewka liczy się razem z Hope z arkusza do limitu, płacisz najpierw z niej, a twój panel ją pokazuje.
- **Bribe** to propozycja żywego ucznia: 1 Hope za przysługę, którą ustalicie między sobą. Przyjmujesz ją albo odrzucasz w oknie lub na swoim panelu; Hope trafia do sakiewki tylko wtedy, gdy przyjmiesz, a propozycja bez odpowiedzi wygasa wraz z następną porą dnia. Nikt inny się o niej nie dowie. Przyjęty Bribe sprawia, że twoje następne Confusion albo Tinker o tej porze dnia jest ruchem na zlecenie, który kosztuje tylko akcję.
- **Bounty** to tajemnica GM-ów: jeden Hope dla pierwszego Monocuba, którego Confusion przeszkodzi wskazanemu uczniowi i trafi. Twój panel pokazuje otwarte Bounty; wygasają wraz z następną porą dnia.
- **Ghost Bet** nic nie kosztuje: wskaż ucznia, którego według ciebie skaże werdykt. Trafny werdykt na tę osobę płaci do twojej sakiewki 4 Hope, jeśli postawisz przed ogłoszeniem ciała, 3 po nim, 2 w rozprawie przed głosowaniem i 1 w trakcie głosowania; po jego zamknięciu nie stawiasz. Do werdyktu stawiasz jeden zakład; nie możesz stawiać, dopóki trwa twoja własna sprawa, ani wtedy, gdy jesteś świadkiem zbrodni. Karta nie nazywa nikogo poza twoim własnym wyborem.
- Kafelek, którego teraz nie da się użyć, jest przygaszony i mówi dlaczego, na przykład *Redeem wykorzystany dziś. Wraca jutro.*, *Masz pełne Hope.* albo *Twoje Ask for Hope wciąż czeka na GM-a.* W Eclipse i w Class Trial Confusion, Tinker, Redeem i Ask for Hope są zamknięte; Ghost Bet nie.
- Gdy zginiesz, a twoja śmierć stanie się jawna dla stołu, twój token zostaje tam, gdzie leży, jako twoje ciało, ze znacznikiem śmierci i twoim imieniem nad nim ("Ciało: imię"), i to, co miałeś przy sobie, przeszukuje się przy nim; jako Monocub odchodzisz od niego. Każde ciało znika, gdy kończy się Class Trial; potem to, co miałeś przy sobie, przeszukuje się obok twojego tokenu.
- Monocub, który stoi w pokoju morderstwa, gdy do niego dochodzi albo gdy wejdzie tam w jego trakcie, zostaje **świadkiem zbrodni**: musi milczeć o morderstwie do końca rozdziału. Jego Confusion wciąż działa.
- Po błędnym werdykcie Monocub, którego śmierci dotyczyła sprawa, i każdy świadek zbrodni tego rozdziału dostaje kartę: do następnej rozprawy nie używaj swoich ruchów na korzyść ani na szkodę sprawcy, jego projektów, Bribe ani Ghost Bet. Karta nikogo nie nazywa.

| Rzut Confusion | Pomóż | Przeszkódź |
|---|---|---|
| 11+ | +1 | -1 |
| 16+ | przewaga | utrudnienie |
| krytyk | oddaje mu akcję | marnuje mu akcję |

Gdy krytyk nie ma czego zmienić, bo cel ma wszystkie akcje albo nie ma już żadnej do stracenia, karta o tym mówi.

Same Monokumy to strona GM-a: nie mają akcji ani Hope, przechodzą przez ściany i zamknięte drzwi i wydają Despair tam, gdzie ty wydajesz Hope.

---

## 14. Komunikator i prośby o decyzję

Największy z trzech przycisków w prawym dolnym rogu, ten na górze, otwiera **Czat z GM-em**: jeden wątek, w którym rozmawiasz ze wszystkimi GM-ami. W grze nie ma kanału tekstowego między graczami, a rozmowa w pokoju to głos.

Wszystko, o czym musi zdecydować człowiek, trafia do tego wątku: Observe na punkt zainteresowania, podpowiedź z Analyze, Dynamic Action, propozycja projektu, Search na coś konkretnego, Call Talent i przedmiot Tier 0, którego chcesz użyć kreatywnie. Widzisz swój rzut, własne słowa i decyzję, gdy przyjdzie.

**Przeczytana dopiero, gdy patrzysz.** Wiadomość liczy się jako przeczytana tylko wtedy, gdy okno jest na wierzchu, na zakładce **Czat**, a gra jest tą kartą przeglądarki, na którą patrzysz. Wiadomość, która przyjdzie, gdy okno leży pod innym albo jest zwinięte do paska tytułu, gdy jest na zakładce **Notatka** albo gdy jesteś na innej karcie przeglądarki, pokazuje swoją kartę i zostaje nieprzeczytana, dopóki nie wysuniesz okna na wierzch albo nie otworzysz go ponownie.

**Gdy wiadomość nie wyjdzie.** Zostaje w polu. Wiadomość odrzucona, zanim wyszła, bo jest za długa albo żaden GM nie jest online, mówi tylko dlaczego. Ta, która nie wyszła, mówi: "Nie udało się wysłać wiadomości. Nadal jest w polu, więc możesz wysłać ją jeszcze raz." Jeśli wiadomość mówi "Wiadomość mogła już trafić do rozmowy. Sprawdź to, zanim wyślesz ją jeszcze raz; tekst nadal jest w polu.", GM-owie mogą ją mimo to mieć, więc zanim wyślesz ją jeszcze raz, najpierw zajrzyj do wątku. Wiadomość, którą GM usunie, znika też z twojego otwartego okna.

**Pytanie, na które czekasz** (Call Talent, Dynamic Action, statystyka z kilku, które rzut wymienia, i Observe na punkt zainteresowania), mówi na swojej karcie, do kiedy jest otwarte, w twojej strefie czasowej ("Otwarta do 21:40."): 5 minut dla Calla i 3 dla pozostałych. Jeśli Calla albo Dynamic Action nie przyjmie żaden GM, od razu dowiadujesz się, że GM nie odpowiedział, zamiast czekać do końca karty. Jeśli nikt nie odpowie przed czasem karty, karta kończy się u wszystkich słowami "Nikt nie odpowiedział na czas. Możesz zapytać jeszcze raz." i nic nie zostaje wydane. Odpowiedź, której GM udzieli po czasie karty, nie zostaje zachowana, więc zapytaj jeszcze raz, jeśli nadal chcesz ją dostać. Trudność, która kończy się "Odpowiedział: ... - odbiór niepotwierdzony.", obowiązuje, więc wtedy nie pytaj jeszcze raz. Jeśli przeładujesz stronę w trakcie czekania, karta i tak skończy się o swoim czasie.

**Karty prywatne.** Kartę tylko dla ciebie, na przykład odpowiedź z Listen, znalezisko albo linię decyzji, czytają GM-owie i każdy gracz, który jest właścicielem twojej postaci, ale nigdy gracz, który ją tylko obserwuje. Tak samo jest z prywatnymi rzutami twojej postaci. Pytanie, które zadajesz i na które czekasz (cztery powyżej), ląduje w twoim własnym wątku. Jeśli nie było cię, gdy przyszła karta prywatna, jej treść wraca później, a karta, której treść nie może wrócić, mówi o tym.

Komunikator ma też zakładkę **Notatka**: tu zapisujesz plany na sesję, żeby GM-owie przeczytali je przed jej początkiem. Czytają ją tylko GM-owie, a nikt inny z graczy jej nie widzi. Dopóki notatka jest pusta, **Użyj szablonu** wstawia do pola jego pytania. Jeśli GM zmienił notatkę, odkąd masz ją otwartą, **Zapisz** zachowuje twój tekst i mówi ci o tym; zapisz jeszcze raz, żeby twój tekst zastąpił tekst GM-a. Jeśli twoja notatka mówi "Notatka jest zapisana i trafi do GM-ów, gdy tylko któryś z nich się połączy.", jest zapisana dokładnie w twojej wersji i dotrze do GM-ów później, w miejsce tego, co GM w międzyczasie zmienił. Szablon zadaje 7 pytań:

- czy planujesz zabić i jak,
- czy dopuszczasz śmierć swojej postaci,
- czy dopuszczasz tortury,
- czy dopuszczasz romans,
- jakie masz triggery,
- jakie masz cele,
- jakich projektów zmieniających grę chcesz spróbować.

> [!TIP]
> Pierwsze cztery pytania to twoje granice, a "Bez zmian" to pełna odpowiedź.

---

## 15. Safeword

W lewym dolnym rogu arkusza postaci jest przycisk ze słowem: **Safe Word**, chyba że twój stół wybrał własne. Ten przycisk albo klawisz, który twój stół może przypisać w ustawieniach sterowania Foundry, otwiera okno z pytaniem *Zatrzymać scenę?*: **Zatrzymaj scenę** albo klawisz Enter zatrzymuje scenę, a **Anuluj** niczego nie wysyła.

Gra się zatrzymuje, a każdy GM dowiaduje się, kto wcisnął, i z którego pokoju, jeśli gra wie, gdzie stoi twoja postać. Wszyscy widzą tę samą kartę: scena jest zatrzymana, GM to przejmie, a gra wznowi się od punktu, na który wszyscy się zgodzą. Na karcie nie ma imienia żadnego gracza. Dopóki gra stoi na pauzie, panel zdarzeń mówi, że scena jest zatrzymana. Drugie wciśnięcie w ciągu minuty nie wystawia drugiej karty, bo zostaje pierwsza. Wszyscy słyszą też dźwięk safeword, niezależnie od suwaka **Dźwięk**, ale to kartę na pewno zobaczy każdy.

Gdy żaden GM nie jest online, nic nie zatrzyma gry, a kartę wysyła twój własny ekran. Tak samo dzieje się, gdy żaden GM nie odpowie na czas, a twoja własna karta dodaje wtedy "Żaden GM nie odpowiedział na czas, więc kartę wysłał sam twój ekran. GM-owie mogą nie wiedzieć, że to ty, a gra mogła się nie zatrzymać. Zawołaj GM-a na kanale tekstowym." W obu przypadkach zawołaj GM-a na kanale tekstowym twojego stołu poza grą, bo GM-owie mogą nie wiedzieć, że to ty, a GM być może będzie musiał zatrzymać grę ręcznie. Karta wysłana z twojego ekranu też nie pokazuje imienia, ale inny gracz, który zajrzy do zapisów gry, może się dowiedzieć, że to ty.

> [!CAUTION]
> Nie musisz tego uzasadniać ani teraz, ani później. Nie ma pola na powód. Pozostali dowiadują się tylko, że scena stanęła.

---

## 16. Wskazówki do interfejsu

Są dwa motywy: **Stained Glass** i **Monokuma Legacy**. Zaczynasz ze Stained Glass. Pod każdym z nich kilka rzeczy stoi w innym miejscu, a przełączasz je w oknie ustawień.

**HUD** (lewa kolumna) pokazuje nazwę kampanii, rozdział, dzień, fazę i porę dnia, ile minut gry ma już ta pora dnia, i pasek utworu z tytułem utworu, który słyszysz; gdy nic nie gra, pasek jest pusty. Pauza, przeładowanie i przerwa między sesjami nie dodają minut, a podczas Eclipse i Class Trial linii minut nie ma. Pokój, w którym stoisz, jest na kafelku pokoju pod HUD-em (rozdział 3).

Podczas Eclipse linia fazy podaje jego nazwę, na przykład *Eclipse (Noc)*. Podczas Class Trial w miejscu pory dnia stoi tryb rozprawy: Dyskusja, Debata, Objection, Rebuttal, Testimony, Panic Round, Closing Argument, Straw Poll, Logic Dive albo Scrum Debate, a to, kto ma głos, widać na panelu zdarzeń (rozdział 12). Gdy gra stoi na pauzie, na każdym ekranie w miejscu nazwy kampanii stoi **Wstrzymano**, dopóki gra nie ruszy; własny napis Foundry na środku ekranu i przygaszenie zostają. Kliknij linię fazy, by dostać wyjaśnienie, gdzie jesteśmy, i opis twojego pokoju.

**Przyciski Foundry** nie stoją na ekranie gracza: nie ma paska bocznego, więc nie ma też paska sterowania sceną po lewej, a razem z nim odchodzą rysowanie, notatki na mapie i przycisk celowania. Swój token zaznaczasz i przeciągasz jak dotąd, a moduł nie zmienia żadnego skrótu klawiszowego Foundry.

**Pasek tytułu okna**: dwukrotne kliknięcie zwija okno do paska tytułu, a kolejne rozwija je z powrotem, jak wszędzie w Foundry. Zwinięte okno zachowuje to, co w nim było, a przycisk, który je otworzył, otwiera je ponownie. Krótkie okno z jednym pytaniem, na przykład potwierdzenie, nie zwija się. Okno, które czeka na twoją odpowiedź (rzut, Observe, deklaracja akcji, głosowanie, Level Up albo pytania Class Trial), zostaje nad arkuszem postaci, także gdy klikniesz arkusz albo gdy on się przerysuje; pozostałe okna wychodzą na wierzch tak, jak wyciąga je Foundry. Pole tekstowe, w którym piszesz, rośnie nad swoim oknem, by zmieścić tekst, najwyżej do 60% wysokości ekranu, i wraca na miejsce, gdy z niego wyjdziesz albo naciśniesz Escape.

**Panel zdarzeń** (pod wierszami Despair) pokazuje to, co dzieje się teraz: Motive z odliczaniem i ceną zignorowania, zwołane zgromadzenie, trwające zaciemnienie, znalezione ciało, tryb Class Trial, mówcę i pozostały czas, otwarte głosowanie i zatrzymaną scenę. Karty samego morderstwa widzą tylko jego uczestnicy. Panel ma jeden rozmiar, cokolwiek pokazuje, a karta dłuższa od niego przewija się w środku.

**Pasek stanu** (po prawej, nad zasobnikiem projektów) pokazuje pozostałe akcje, twój Move i twój Hope. Wiersz Move to zawsze dwie stopy. Poza Eclipse pierwsza stopa to Free Move tej pory dnia, pełna, dopóki go masz, a druga, stopa Eclipse, jest przygaszona. Podczas Eclipse dwie stopy to jego przejścia: pierwsza jest pełna, dopóki zostało ci jedno przejście, a druga, dopóki zostały dwa. Przy ustawianiu, w którym możesz wybrać dowolny pokój, obie stopy są pełne, a trzecie przejście z akcji pokoju też widać jako dwie pełne stopy; wskaż wiersz kursorem, by zobaczyć liczbę. Przejścia Monocuba nic nie kosztują, więc jego pierwsza stopa jest zawsze pełna; podczas Eclipse pełne są obie, a jego akcje mówią *Tylko ustawianie.* Pasek martwego ucznia to jeden wiersz: **Nie żyje**. To, co masz w zapasie ze Sprint albo Burst, widać na arkuszu, w linii nad siatką akcji. Kliknij pasek, by dostać wyjaśnienie.

**Zasobnik projektów** (po prawej, pod paskiem stanu) wymienia projekty, o których wiesz. Zanim jakiś się pojawi, i tak pokazuje swój tytuł i wiersz **Na razie brak projektów.** Każdy projekt to jeden wiersz, z nazwą i licznikiem w jednej linii; gdy jest ich więcej niż pięć, lista się przewija, a jej dół gaśnie, póki niżej są kolejne. Licznik zmienia się na bieżąco, póki któraś z twoich postaci stoi w pokoju projektu; poza nim wiersz pokazuje licznik taki, jaki któraś z nich ostatnio tam widziała, a projekt założony albo naprawa zaczęta od tamtej pory pojawia się, gdy któraś z nich znów będzie w tym pokoju. Projekt, o którym wiesz, ale którego żadna z twoich postaci nie widziała jeszcze w jego pokoju, pokazuje **?**.

**Wiersze Despair** pokazują każdą pulę i to, jak jest pełna, a pod pulami jest Overflow: zamiast licznika widzisz "?", a obok liczbę, przy której odpala. Kliknij wiersze Despair, by dowiedzieć się, czym jest Despair.

**Na wąskim ekranie** (tablet, telefon, wąskie okno) bloki modułu stoją w jednej kolumnie u góry, w kolejności: zegar, kafelek pokoju z kafelkiem głosu po prawej, twój pasek stanu i zasobnik projektów, wiersze Despair i panel zdarzeń. Plansza pod kolumną zostaje widoczna i da się na niej grać. Gdy kolumna jest dłuższa niż miejsce na nią, przewija się, a jej dół gaśnie, póki niżej jest coś jeszcze.

**Twój arkusz:**
- *Akcje* - dziesięć kafelków, Hope Calle poniżej; pod Stained Glass kafelek, którego teraz nie możesz użyć albo na który cię nie stać, jest ciemny i ma przerywaną krawędź, bez względu na koszt; podczas incydentu kafelek Direct Murder staje się **Broń się** dla ofiary i **Akcje kryzysowe** dla pozostałych i je otwiera; arkusz Monocuba pokazuje kafelki Monocuba, bez kafelka Move, a Monocub przeciąga swój token.
- *Ekwipunek* - użytkowe, sprzęt (z przyciskiem, którym bierzesz go do ręki), Truth Bullety (możesz je przeanalizować, przedstawić albo podzielić się kopią, a pogrupować według **Rozdziału** albo **Lokacji**), klucze do pokoi i twoja skrytka, gdy stoisz w tym pokoju.
- *Zasady* - stałe zasady Monokumy, dla wszystkich, cały czas.
- Safeword w lewym dolnym rogu (rozdział 15) i Level Up, gdy ci przysługuje.

**Komunikator** (rozdział 14) stoi nad dwoma pozostałymi przyciskami w rogu i ma dwie zakładki: **Czat**, twój wątek Czatu z GM-em, i **Notatka**, czyli twoja notatka przed sesją.

**Książka**, pod komunikatorem w prawym dolnym rogu, otwiera podręczniki w grze, czyli ten **Podręcznik gracza** i **Ulotkę ucznia**, w języku wybranym dla modułu. Książka otwiera się na podręczniku czytanym ostatnio, a spis treści po lewej przenosi do dowolnego rozdziału.

**Karty powiadomień:** wyniki twoich akcji przychodzą jako karty powiadomień, a karta zostaje, dopóki jej nie zamkniesz: kliknięciem w nią, a przy dowodach i innych kartach, które trzeba przeczytać, przyciskiem X. Pod Stained Glass karty stoją pod każdym oknem, więc okno przeciągnięte na nie je zasłania; pod Monokuma Legacy stoją nad oknami. Najnowsza ląduje na górze i spycha starsze w dół; gdy nie mieszczą się wszystkie, reszta czeka pod spodem za "+N" obok przycisku zamknięcia, a zamknięcie karty przywraca następną. Kliknięcie w "+N" zamyka naraz wszystkie karty poza tymi, które trzeba przeczytać. Karta "czekamy na GM-a" zamyka się sama, gdy przyjdzie odpowiedź. Krótkie komunikaty samego Foundry, na przykład ostrzeżenie, stoją pod Stained Glass na ciemnej płytce pod wierszami Despair.

**Zamkniętą kartę przeczytasz jeszcze raz:** przycisk ze stosem kart w prawym dolnym rogu kafelka powiadomień otwiera okno **Historia powiadomień**. Pod Monokuma Legacy na komputerze ten przycisk stoi pod zegarem, także gdy na ekranie nie ma żadnej karty, a na wąskim ekranie w prawym dolnym rogu najniższej karty, gdy jakaś karta jest na ekranie. Historię otwiera też klawisz w ustawieniach sterowania Foundry, gdy go przypiszesz. Historia trzyma powiadomienia, które pokazała ci ta przeglądarka, także karty o morderstwie: najnowsze, najwyżej 250, i najwyżej 40 od jednego nadawcy. Powiadomienia zostają do resetu sezonu, który czyści zegar, incydent, karty tego modułu albo resztę dziennika czatu, a karta, którą moduł wycofa, znika i z historii. Gdy historia przestaje zapisywać, jej okno o tym mówi.

Okno historii pokazuje jako przyciski **Wszystkie**, **Dla ciebie** i **Niewykonane**, a pozostałe filtry (**Ogłoszenia**, **Od graczy**, **Dowody** i **Komunikator**) są pod **Więcej filtrów**. Każdy filtr pokazuje, ile powiadomień trzyma, a pole wyszukiwania znajduje powiadomienie po tytule i treści. **Wyczyść** w tym oknie opróżnia historię: zrób to, zanim udostępnisz ekran. Inne konto zalogowane w tej przeglądarce może przeczytać twoją historię, więc na wspólnym komputerze wyczyść ją, zanim oddasz komputer.

**Okno ustawień:** zębatka w prawym dolnym rogu otwiera **Ustawienia DRPG**, twoje własne ustawienia; inni przy stole niczego nie zauważą. GM ma to samo okno, a otwiera je też przycisk **Otwórz ustawienia DRPG** w Configure Settings Foundry. Wybierz sekcję po lewej; linia pod każdym ustawieniem mówi, co ono zmienia, a **Zapisz zmiany** zapisuje ustawienia. Głośność i głos działają od razu, gdy je przesuwasz, a nie dopiero po **Zapisz zmiany**.
- **Wygląd**: **Język** to English albo Polski dla okien, kart i arkusza modułu, osobno od języka Foundry; działa po przeładowaniu, a nazwy gry zostają po angielsku w obu językach. **Motyw** to **Stained Glass** albo **Monokuma Legacy**; pod Stained Glass szkło zmienia kolor z każdą nową fazą albo porą dnia, a z włączonym ustawieniem **Ograniczone animacje** od razu przyjmuje nowy stan. **Skala interfejsu** ma zakres od 80% do 140%, **Nazwa stanu za zegarem** jest tylko pod Stained Glass, a **Szerokie okna projektów** otwiera okna projektów szerzej.
- **Efekty i dostępność**: **Czcionka pikselowa**, **Puls szkła**, **Szkło rozmywa mapę**, **Ograniczone animacje** i **Wysoki kontrast**. Czcionka pikselowa jest tylko pod Monokuma Legacy, puls szkła i rozmycie mapy tylko pod Stained Glass, a ograniczone animacje i wysoki kontrast są pod oboma motywami i każde z nich włącza się też samo, gdy prosi o to system operacyjny.
- **Dźwięk i głos**: **Dźwięki komunikatora**, głośność **Dźwięk** i **Muzyka** oraz ustawienia głosu. Gdy jesteś w głosie, są tu twój **Mikrofon**, twoje **Wyjście dźwięku**, **Tryb mikrofonu** (**Zawsze włączony** albo **Naciśnij, aby mówić**) i klawisz mówienia (**Zmień klawisz**). Jeśli lista nie ma mikrofonu, pozwól przeglądarce go używać i otwórz okno ponownie.

**Gdy ekran się przycina**, zmieniaj te ustawienia w oknie ustawień po jednym: najpierw wyłącz **Szkło rozmywa mapę**, potem **Puls szkła** i **Nazwa stanu za zegarem**, potem włącz **Ograniczone animacje**, a na końcu spróbuj motywu **Monokuma Legacy**. Każde z nich zmienia tylko twój ekran. Jeśli GM zapyta, jak szybko działa twój ekran, kroki są w rozdziale 17.

> [!NOTE]
> **Rzuty są prywatne:** każdy twój rzut widzą tylko GM-owie i ty. Ekran GM-a pokazuje, jak padają twoje kości, tylko gdy w twoim pokoju stoi Monokuma tego GM-a; wynik i tak dociera do każdego GM-a. Nikt nie widzi cudzych kości, z trzema wyjątkami. Rzut w incydencie widzą jego uczestnicy, z kośćmi, wynikiem i tym, jaka to akcja, od chwili, gdy incydent się zaczyna, do jego końca. Budowniczy pułapki do nich nie należy: nie widzi żadnych kości ani kart incydentu, także karty akcji, która go kończy. Wynik rzutu otwarcia poznaje tylko strona, która rzuca (zabójcy w Direct Murder, ofiara pułapki), a rzut sprzątania widzi tylko ten, kto go wykonuje. Rzuty Monocuba, łącznie z Confusion, widzą wszyscy w jego pokoju. Jedyny rzut, który czytają wszyscy, to rzut publiczny, który wykonuje GM, na przykład remis w głosowaniu albo loteria Monokumy.

---

*Ktoś niedługo zrobi coś strasznego. Zdecyduj, komu ufasz.*

---

## 17. Dodatek: uwagi techniczne

Ten dodatek zbiera to, czego rozdziały powyżej nie mówią graczowi przy stole: kod, który stoi za zasadą, konsolę, to, co trzyma każda przeglądarka, i to, kiedy zasada się zmieniła. Każda część nosi numer rozdziału, do którego należy, więc na przykład 17.12 zbiera uwagi do rozdziału 12, a rozdział, do którego nie ma nic do dodania, nie ma tu swojej części. "Jeszcze nie sprawdzono przy stole" znaczy, że zachowanie sprawdzono dotąd tylko bez prawdziwego stołu w Foundry.

### 17.1 Kim jesteś

**Twój arkusz.** To kropki samego modułu i wyglądają tak samo, czy kropki Daggerheart są włączone, czy wyłączone. Jeszcze nie sprawdzono przy stole, że kropki na twoim arkuszu, na arkuszu drużyny i na twoim tokenie są tylko do czytania, ani że wyglądają tak samo na ekranie z włączonymi kropkami Daggerheart i na ekranie bez nich (LIVE-E24-02). Zmianę zrobioną na twoim arkuszu, gdy nie jest połączony żaden GM, sprawdza się, gdy któryś wróci. Trafienie, leczenie, wydany albo dany Hope zmieniają liczby na twoim otwartym arkuszu tam, gdzie stoją, na twoim ekranie i u każdego, kto ma go otwartego; wszystko inne, na przykład przedmiot, który dostajesz, rysuje arkusz od nowa. Jeszcze nie sprawdzono przy stole, czy twój arkusz nie przerysowuje się przy trafieniu, leczeniu, wydanym albo danym Hope (LIVE-E45-01).

**Twoja Przeszłość.** Samo otwarcie pola niczego nie zapisuje. Jeśli ktoś inny zapisze twoją Przeszłość w trakcie twojego pisania, twoja następna próba zapisu niczego nie zapisze, tylko powie ci o tym; dopiero kolejna zapisze twój tekst w miejsce tamtego.

**Co może przeczytać inny gracz.** Jeszcze nie sprawdzono przy stole, że inny gracz widzi **?** w miejscu twojego Sanity (LIVE-E24-01), że nie widzi paska Sanity na twoim tokenie (LIVE-E24-03), że karta rzutu w Breakdown ukrywa przed nim przyczynę (LIVE-E24-10) ani że żaden token nie pokazuje ikony Breakdown ani Wounded (LIVE-E95-05). Twoje Sanity jest ukryte tylko na ekranach: Foundry wysyła dane twojej postaci do każdej przeglądarki, a gracz, który otworzy konsolę przeglądarki, może je przeczytać. Pisze o tym podręcznik GM-a, sekcja 1.

**Kto rzuca twoimi kośćmi.** Gdy połączony jest GM, kości rzutu akcji i statystyki klikniętej na arkuszu rzuca przeglądarka GM-a i to ona liczy, co dodaje się do kości. Gdy kości nie ruszą w ciągu 600 ms od twojej prośby, pojawia się powiadomienie *GM rzuca twoimi kośćmi.*

**Gdy nie jest połączony żaden GM**, akcja czeka: po jej wciśnięciu dowiadujesz się, że rzut akcji czeka na GM-a, i nic nie płacisz. Każdy inny rzut nadal się wykonuje, a statystyka z arkusza zawsze jest reakcją; karta takiego rzutu mówi, że rzucono go bez połączonego GM-a i że GM go zobaczy. Taki rzut nie rusza Hope, Sanity ani Despair, dopóki GM, gdy wróci do stołu, go nie przyzna, a reakcja, także statystyka, nie rusza niczego nawet wtedy.

**Token Widza.** Czy ściany zatrzymują token Widza, jeszcze nie sprawdzono przy stole.

**Szare szkło.** W chwili śmierci szkło szarzeje fragment po fragmencie. Szkło straconego ucznia szarzeje od razu, a jego gracz słyszy dźwięk egzekucji razem ze wszystkimi; tak jest od 1.2.113.

### 17.2 Czas

**Eclipse.** Gdy nie jest połączony żaden GM, przejście podczas Eclipse jest odrzucane.

**Chwile na cały ekran** są odtwarzane od 1.2.109.

### 17.3 Ruch i widzenie

**Zawrócenie.** Token upuszczony z paska bocznego Foundry do pokoju, który zawróciłby jego ucznia, jest usuwany; ekran gracza nie ma paska bocznego (rozdział 16).

**Tajne przejścia.** Pokazanie tajnego przejścia i przejście przez tunel albo schody wymagają połączonego GM-a.

**Kafelek pokoju.** Gdy tę samą postać ma dwóch graczy, kafelek pokoju na ekranie jednego z nich może pokazać ruch przez kilka punktów trasy z opóźnieniem mniej więcej półtorej sekundy.

**Kogo słyszysz.** To, co ustawisz w **Kogo słyszysz**, pamięta ta przeglądarka.

Token, który Search zabiera z **Search Tokens** pokoju, potwierdza przeglądarka GM-a. Odpowiedź, która nie przyjdzie w ciągu 5 sekund, jest spóźniona, a Search ze spóźnioną odpowiedzią nie jest liczone.

### 17.4 Akcje

*Spójrz poza oczywiste* od 1.2.113 pokazuje postęp znalezionego tajnego projektu taki, jaki był przy twojej ostatniej wizycie w jego pokoju, i mówi ci o jego ukończeniu przy pierwszej wizycie po nim. Od 1.2.99 propozycja projektu musi mieć **Opis**. Podsłuch pod drzwiami, nowy w 1.2.113, to przeniesienie twojego głosu po Listen z wynikiem 14 lub więcej. Remnant wymazany przez Tamper zostaje przygaszony na mapie każdego innego, kto go znalazł, dopóki któraś z jego postaci nie stanie znów w tym pokoju; to też nowość 1.2.113. Projekt zatwierdzony przed 1.2.88 pokazywał swój token proponującemu dopiero od najbliższego wczytania u GM-a. Starszy projekt, zrobiony, zanim projekty miały własną statystykę, przed pierwszym rzutem prosi cię o propozycję jednej; GM zatwierdza ją albo zmienia na karcie, a ona zostaje statystyką projektu.

**Okno akcji** ma ten sam rozmiar, czy jego Szczegóły są rozwinięte, czy zwinięte, a następne okno akcji otwiera się tak, jak zostawiłeś poprzednie.

**Limit odpoczynków** liczy się w obrębie rozdziału: nowy rozdział otwiera znowu oba odpoczynki, jakikolwiek byłby dzień i sesja.

**Szerokie okna projektów** to ustawienie twojej własnej przeglądarki: zmienia okna projektów tylko w przeglądarce, w której je ustawisz.

Na Echoes i Dash odpowiada przeglądarka GM-a: znajduje pokój dla Echoes, rzuca kośćmi Dash i daje jego przejścia. Gdy nie jest połączony żaden GM, Echoes i Dash nic nie kosztują i nic nie robią.

Jawny Frisk czeka na GM-a. Jeśli GM wyjdzie albo przeładuje grę, gdy czekasz na odpowiedź, prośba się kończy i akcja wraca do ciebie: od razu, gdy prośbę przejmie inny GM, a bez innego GM-a, gdy skończy się twoje czekanie, nieco ponad minutę po prośbie.

### 17.5 Hope i Hope Calls

Call, który wpływa na rzut (Support, Talent, Resolve, Loaded Die), kupuje się w przeglądarce GM-a i to ona pobiera za niego Hope: bez połączonego GM-a nie da się go kupić i nic nie zostaje wydane. To, że bez GM-a Calla się nie kupuje, odczytano z kodu; dla Calla tego nie zmierzono.

Reroll robi przeglądarka GM-a i to ona pobiera Hope; bez połączonego GM-a Reroll się nie odbywa i nic nie zostaje wydane.

Call, który ci utrudnia, to utrudnienie albo ujemna premia. Nałożony ponad minutę przed rzutem, który rzuca przeglądarka GM-a, liczy się w tym rzucie, czy okno rzutu go wymienia, czy nie. `HOSTILE_GRACE` to 60 000 ms (`config.mjs`), Calle, które utrudniają, liczy `roll-draw.mjs` `hostileCalls`, a do rzutów, które nie wydają Calla, należą rzuty `remember: false` z `action-pipeline.mjs` `rollTrait` i `roll-draw.mjs` `SPENDS_NO_CALL` (Palm, otwarcie morderstwa).

Karta GM-ów, która prosi o zgodę na Talent, czeka na odpowiedź najwyżej 5 minut; to `TIMING.hopeCallRulingMs`, w `call-gm.mjs` `askHopeCallByCard`.

Loaded Die nie działa, gdy ustawienie kości przy stole pomija kość, którą ustawia; Call Loaded Die wraca wtedy do ciebie na następny rzut, a szept to mówi.

### 17.6 Despair - druga strona

Monokuma wybiera Bounty wewnątrz kafelka Fuel a Monocub na własnym arkuszu, bo Bounty nie ma własnego kafelka; miejsce Bounty to `config.mjs` `DESPAIR_CALLS.bounty.inside`.

### 17.9 Pułapki i projekty, które zabijają

Search może jeszcze poprosić o przedmiot podłożony w pokoju do 120 sekund po wydaniu swojego Search Tokenu, a przekazany podłożony przedmiot czeka tyle samo, aż zostanie uznany za dostarczony; to okno to `TIMING.plantWindowMs`, w `search-tokens.mjs`. Na odpowiedź głównego GM-a na tę prośbę czeka się 5 sekund (`TIMING.plantRequestMs`).

### 17.10 Morderstwo

Zabójca za „?” to nowość 1.2.113 (E69 C8). Gracz, który otworzy konsolę przeglądarki, nadal może odczytać, do której postaci należy token „?”, bo token zachowuje postać, którą przedstawia.

To, co bierzesz z ciała, przechodzi między dwoma arkuszami, a te dwa arkusze może odczytać przeglądarka każdego gracza.

Okno rzutu otwarcia zamknięte bez rzutu otwiera się znowu najwyżej `TIMING.openingAttempts` razy (3). Move the Body przenosi ciało o tyle pokoi, ile mówi `CLEANUP.actions.moveBody.rooms` (1 pokój przy trafieniu, 2 przy krytyku), a odczytuje to `cleanup.mjs` `bodyLanding`.

### 17.12 Class Trial

**W kogo trafia Objection.** Mówcę odczytuje się z pokoju głosowego przeglądarki głównego GM-a: ktoś liczy się jako mówiący, gdy przez 1 sekundę zostaje na liście aktywnych mówców LiveKit. Gdy przeglądarka GM-a nie ma pokoju głosowego, naciśnięcie pyta wnoszącego, komu zaprzecza, cokolwiek robi jego własny pokój głosowy. To przeglądarka głównego GM-a rozstrzyga, czy Objection dostaje głos, a gdy go dostaje, wnoszący dowiaduje się o cenie. Jak szybko to nadąża za prawdziwą mową, jeszcze nie sprawdzono przy stole.

**Liczby rozprawy.** Domyślny budżet debaty to 180 sekund i nigdy nie jest krótszy niż 30. Objection dostaje 60 sekund, Rebuttal 120, a wybór Truth Bulletu do Objection 30. Pasek GM-a przesuwa zegar o 30 sekund, zegar Panic Round o 5, a napis GM: ... pokazuje przez 10 sekund. Testimony proponuje 60 sekund na turę, a tura może mieć od 30 do 120 sekund; Panic Round daje 15 sekund na turę, a od 12 uczestników 10. Closing Argument daje 30 sekund na zgłoszenie się i 300 sekund na mówcę, odbywa się raz na rozprawę, a Pasuję w pierwszych 30 sekundach oddaje wybór z powrotem. Straw Poll ma 45 sekund. Logic Dive daje 60 sekund na pytanie i zamyka je wcześniej, gdy po 10 sekundach wszyscy stoją po jednej stronie, a potem przez 5 sekund pokazuje, ilu stoi po każdej stronie; zestaw ma od 1 do 5 pytań. Scrum Debate daje 45 sekund na Strony, 120 sekund na naradę i budżet 300 sekund dzielony na tury od 20 do 40 sekund. Pytanie debaty i pytanie strefy mają najwyżej 200 znaków, odpowiedź 80, a teza Scrum Debate 120. Closing Argument nie płaci Hope ostatniemu głosowi.

**Akcje w rozprawie.** Rozprawa odnawia każdemu akcje, nie kończąc pory dnia, a Sprint i Burst w zapasie zostają w nim przez całą rozprawę. Od 1.2.110 Wounded zabiera akcję tylko w Daily Life i w Investigation, więc akcje rozprawy są pełnym budżetem także dla ucznia w stanie Wounded; zaciemnienie Panic nadal zabiera jedną akcję.

**Mikrofony.** Gdy rozprawa się otwiera, przeglądarka głównego GM-a wypisuje każdego zmarłego ucznia, także takiego, którego śmierci nikt nie znalazł, i nigdy Monocuba; graczowi każdego z nich zabiera uprawnienie Broadcast Audio w Foundry i oddaje je, gdy rozprawa się kończy. Linijki Monocuba na kafelku głosu (otwarta dyskusja, tryb, od głosowania, jego własna sprawa) są tylko informacją: moduł nigdy nie trzyma mikrofonu Monocuba.

**Głosowanie.** Głos trafia tylko do przeglądarek GM-ów. Dopóki nie jest połączony żaden GM, twoja przeglądarka trzyma twój głos i wysyła go, gdy GM się połączy, a do tego czasu czytasz "Żaden GM nie ma jeszcze twojego głosu. Trafi do GM-a, gdy tylko się połączy.". Jeśli połączysz się w trakcie głosowania, twoja karta przychodzi, gdy wczytuje się przeglądarka.

**Migracja Level Upów.** Do 1.2.110 Level Up dawał do wyboru także +1 Health i +1 Sanity. W świecie, w którym uczniowie je wzięli, GM może raz wyrównać każdy arkusz do nowej zasady: te wybory zostają cofnięte, a gracz dostaje tyle samo punktów statystyki do rozdania, razem z tym, co one dają.

### 17.13 Śmierć i to, co po niej

**Głos zmarłych.** To przeglądarka głównego GM-a decyduje, kiedy głos zmarłego ucznia wychodzi z pokoju, w którym zginął: od razu, gdy zmarły nie bierze udziału w trwającym incydencie, a w przeciwnym razie, gdy ktoś znajdzie ciało, gdy GM naciśnie **Wycisz teraz** albo gdy w tym samym pokoju stanie żywy uczeń spoza incydentu. Od 1.2.112 głos trafia wtedy do pokoju głosowego Widzów.

**Zabieranie z ciała.** Okno Take from the Body sprawdza wszystko na nowo, dopóki jest otwarte, gdy ruszasz się ty, ciało albo zegar. Strona GM-a odmawia wzięcia, gdy biorący wyszedł z pokoju albo gdy ktoś inny wziął to pierwszy; wzięcie nie zabiera niczego, gdy żaden GM nie odpowiedział albo gdy nie grasz żadną postacią, a wtedy czytasz *Nie masz w tej grze postaci, która mogłaby to dostać.*

**Ruchy Monocuba.** Strona GM-a sprawdza blokady ruchu Monocuba, jego cenę i cel, zanim pobierze cenę: nic nie płacisz, dopóki strona GM-a nie wykona ruchu, a ruch, którego odmówi, nic nie kosztuje. Confusion, Redeem, Ask for Hope i Tinker są zablokowane w Eclipse i w Class Trial; jedyną blokadą Ghost Bet jest zamknięcie głosowania, a to, ile Ghost Bet płaci (4, 3, 2 albo 1), odczytuje się z chwili, w której postawiono zakład. Ask for Hope bez odpowiedzi blokuje następne tylko do końca swojej pory dnia. Monocub, którego nie wpuszcza pokój trwającego morderstwa, dostaje tę samą odmowę, jaką może dostać każde przejście, bo ta odmowa nie mówi niczego, czego świat już nie pokazuje.

### 17.14 Komunikator i prośby o decyzję

Gdy nie jest połączony żaden GM, nic, co wysyłasz do GM-ów, nie zostaje opublikowane: czytasz "Żaden GM nie jest połączony.", a to, co akcja kosztowała, wraca do ciebie.

W trakcie incydentu twoją wiadomość w Czacie z GM-em publikuje za ciebie przeglądarka GM-a. Gdy jej odpowiedź nie przyjdzie na czas albo przyjdzie bez karty, czytasz "Wiadomość mogła już trafić do rozmowy. Sprawdź to, zanim wyślesz ją jeszcze raz; tekst nadal jest w polu.", a wiadomość może mimo to być w wątku.

Przeglądarka GM-a musi przyjąć Call albo Dynamic Action w ciągu 8 sekund. Karta Calla jest otwarta 5 minut, a karta pozostałych pytań 3 minuty. Jeśli GM przeładuje stronę albo stery przejmie inny GM, gdy czekasz, twoja przeglądarka zadaje pytanie jeszcze raz, najwyżej 3 razy, a pytanie zostaje przy swojej jednej karcie.

Treść karty prywatnej trafia do przeglądarek, które mogą ją czytać, i nie jest przechowywana na serwerze. Przeglądarka, której nie było, i druga przeglądarka tego samego gracza dostają treść z powrotem od przeglądarki GM-a, gdy połączony jest GM. Karta, której treści nie ma żadna przeglądarka GM-a, brzmi "Prywatna karta. Jej treść nie dotarła do tej przeglądarki." Każda przeglądarka trzyma treść swoich ostatnich 500 kart prywatnych.

Wątek Czatu z GM-em należy do jednego konta: pytanie, na które czekasz, ląduje w twoim własnym wątku, a pozostałe karty do GM-a o postaci lądują w wątku jednego z jej właścicieli.

Notatka jest przechowywana we własnym magazynie GM-ów i nie trafia na konto gracza. Jej zapis przechodzi przez głównego GM-a, a notatka zapisana, gdy żaden GM nie jest online, czeka w twojej przeglądarce, aż połączy się GM.

### 17.15 Safeword

Domyślne słowo to "Safe Word"; świat, w który grano już, zanim słowo stało się ustawieniem, zachowuje MISIUBOMBO.

Kartę publiczną wystawia przeglądarka głównego GM-a, więc nie ma na niej imienia żadnego gracza, a grę zatrzymać może tylko przeglądarka GM-a. Gdy żaden GM nie jest połączony, kartę wystawia twoja przeglądarka. Gdy GM jest połączony, twoje wciśnięcie czeka 3 sekundy na kartę GM-a, a gdy ta nie przyjdzie, na przykład gdy GM przeładowuje stronę, kartę wystawia jednak twoja przeglądarka, a twoja własna karta dodaje "Żaden GM nie odpowiedział na czas, więc kartę wysłał sam twój ekran. GM-owie mogą nie wiedzieć, że to ty, a gra mogła się nie zatrzymać. Zawołaj GM-a na kanale tekstowym."; GM, którego strona jeszcze się ładowała, musi wtedy zatrzymać grę ręcznie. Karta wystawiona przez przeglądarkę gracza ukrywa swój nagłówek, ale jej zapis podaje tego gracza jako autora, a konsola ten zapis przeczyta.

Karta dla GM-ów podaje pokój: z arkusza pokój postaci tego arkusza, a z klawisza w ustawieniach sterowania Foundry i z `game.drpg.safeword()` w konsoli pokój twojej własnej postaci. Karta nie podaje pokoju, gdy wciska GM albo gracz z dwiema postaciami, z których żadna nie jest przypisana.

Kartę gracza główny GM publikuje raz na 60 sekund: drugie wciśnięcie w ciągu 60 sekund trafia do dziennika i nie zostaje opublikowane ponownie. Gdy żaden GM nie jest połączony, twoja przeglądarka publikuje każde wciśnięcie.

Dźwięk safeword to jedyny dźwięk, który pomija ustawienia głośności: gra na pełnej głośności, cokolwiek mówi suwak Dźwięk, podlega głośności interfejsu Foundry i zabrzmi dopiero wtedy, gdy od wczytania strony gracz kliknął w nią gdziekolwiek.

### 17.16 Wskazówki do interfejsu

Wiersza **Na razie brak projektów.** w zasobniku projektów jeszcze nie sprawdzono przy stole. Wiersz **?** jest od 1.2.113: to, czy projekt widziano w jego pokoju, liczy każda przeglądarka osobno, więc projekt widziany tylko z innej przeglądarki pokazuje tu **?**.

Gdy nic nie gra, pasek utworu w HUD zostaje pustą linią, żeby zegar nie zmieniał wysokości. Przycisk książki stoi przy samej krawędzi ekranu i ma wielkość zębatki po jego lewej. Pod Stained Glass obrót szkła przynosi nowy kolor od środka w około 1,2 sekundy i raz błyska spoinami, a tam, gdzie panele muszą się przesunąć, szyby jadą w całości na nowe miejsca, razem z teksturą.

Rzutu publicznego, który wykonuje GM (remis w głosowaniu, loteria Monokumy), jeszcze nie sprawdzono przy stole.

Historia powiadomień jest trzymana w pamięci tej przeglądarki, osobno dla każdego konta na niej: najwyżej 250 wpisów dla gracza i najwyżej 40 od jednego nadawcy. Gdy w przeglądarce zabraknie miejsca albo historie innych kont zapełnią swój udział, zostaje mniej wpisów albo zapis staje, a okno historii mówi, kiedy stanął.

Gdy GM zapyta, jak szybko działa twój ekran, stań w miejscu, otwórz konsolę (F12), wpisz `await game.drpg.fps({ toChat: false })` i skopiuj to, co wypisze po mniej więcej dwudziestu sekundach. W czasie pomiaru szkło i każdy z efektów mapy wyłączają się najwyżej na sekundę i wracają same, a na końcu mapa stoi przez sekundę.
