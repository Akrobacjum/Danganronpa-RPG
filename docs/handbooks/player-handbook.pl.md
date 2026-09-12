# Danganronpa RPG - Podręcznik gracza

*Dla uczniów killing game. Moduł w wersji 1.2.43, zbudowany na Daggerheart dla Foundry VTT v14.*

To cała gra widziana z twojego krzesła: co znaczą liczby na arkuszu, ile kosztuje akcja, co kupuje Hope, co się dzieje, gdy ktoś ginie, i co kliknąć. Każda liczba tutaj jest liczbą modułu; tam, gdzie decyzja należy do człowieka, napisano "GM decyduje".

Nazwy własne gry zostają po angielsku przy każdym stole i w każdym języku: Hope, Despair, Sanity, Truth Bullet, Remnant, Blackened, Class Trial, Daily Life, Eclipse, Mastermind, Monokuma, Monocub, nazwy Calli, nazwy akcji, Ultimate, Key Remnant, Vault, Stash.

---

## 1. Kim jesteś

Jesteś **Ultimate** - tym jednym, w czym ta postać jest najlepsza, wpisanym pod jej imieniem na arkuszu. Tytuł to postać. Twój Ultimate jest też Hope Callem (rozdział 5): gdy naprawdę stosuje się do tego, co próbujesz zrobić, kupuje przewagę.

### Statystyki

Sześć cech Daggerheart nosi tu inne nazwy. Na arkuszu widzisz:

| Statystyka | Skrót | Czym jest | Do czego służy |
|---|---|---|---|
| **Leg** | LEG | Szybkość | Projekty, bieg, akcje kryzysowe |
| **Body** | BOD | Siła fizyczna | Projekty, walka, przenoszenie ciężarów |
| **Hand** | HAN | Zręczność i precyzja | Search, Palm, Projekty, akcje kryzysowe |
| **Eye** | EYE | Spostrzegawczość i zauważanie rzeczy | Search, Observe, wyczucie pułapki |
| **Shadow** | SHA | Ukrywanie się i szósty zmysł | Listen, Tamper, pozostanie niezauważonym, zacieranie śladów |
| **Head** | HEA | Łączenie faktów | Analyze, Projekty, wyczucie pułapki |

Przy tworzeniu postaci rozkład to **+2, +1, +1, 0, 0, -1**, rozłożony, jak chcesz.

### Zasoby startowe

| Zasób | Start | Maksimum |
|---|---|---|
| Health | 4 | 4 (rośnie z Level Upami) |
| Sanity | 6 | 6 (rośnie z Level Upami) |
| Hope | 2 | 6 |
| Akcje na porę dnia | 2 | - |
| Free Move na porę dnia | 1 | - |
| Doświadczenia | 2, po +2 każde | - |
| Przedmiot startowy | jeden przedmiot Tier 2 powiązany z twoim Ultimate, uzgodniony z GMem | - |

### Dwa stany, których nie chcesz

| Stan | Kiedy | Efekt |
|---|---|---|
| **Breakdown** | każdy punkt Sanity zaznaczony | utrudnienie na każdym rzucie, dopóki nie wróci trochę Sanity |
| **Wounded** | każdy punkt Health zaznaczony | o jedną akcję mniej na porę dnia, dopóki ktoś cię nie poskłada |

Oba włączają się same w chwili, gdy pasek się zapełni; Vulnerable i Death Move z Daggerheart są wyłączone. Nic w tym module nie zabija cię za zejście do zera Health. Śmierć to coś, co robi ci człowiek, i jest ogłaszana.

### Rzuty

Każda akcja to rzut dwoistości z Daggerheart: kość Hope i kość Despair (obie d12) plus twoja statystyka. Wyższa kość decyduje o kolorze wyniku, para takich samych to **krytyk**.

- Rzut **z Hope** daje ci 1 Hope.
- Rzut **z Despair** zasila pulę Despair Monokumy, który cię pilnuje. Stąd bierze się jego waluta - z twojego pecha i twojego ryzyka.
- **Krytyk** daje 2 Hope i nic więcej (nie oczyszcza tu Sanity, inaczej niż w czystym Daggerheart).

Okno rzutu jest dla graczy zablokowane: kości, statystyka, przewaga, doświadczenia i premie biorą się z akcji, z Calla, za który zapłaciłeś, z miejsca, w którym stoisz, albo od GMa. Ruszasz tylko to, co akcja pozwala ci wybrać.

---

## 2. Czas

### Dzień, sesja, rozdział

Jedna sesja to jeden dzień w fikcji, a dzień to pięć **pór dnia**: **Rano, Południe, Popołudnie, Wieczór, Noc**. Każda pora dnia odnawia twoje dwie akcje, Free Move i Search Tokens każdego pokoju. Gdy kończy się Noc, dzień się zmienia.

Kanoniczny rozdział to pięć sesji: trzy **Daily Life** (trzecia zwykle niesie morderstwo), jedna **Investigation**, jedna **Class Trial**. GM może rozciągnąć rozdział, gdy morderstwa jeszcze nie było. Sezon to sześć rozdziałów; sezon modułowy to jeden.

Trzy fazy:

| Faza | Czym jest |
|---|---|
| **Daily Life** | Żyjecie w zamkniętym miejscu. Dwie akcje na porę dnia. Nikt jeszcze nie zginął w tym rozdziale - to ta część, w której decydujesz, komu ufasz. |
| **Investigation** | Znaleziono ciało. Observe i Analyze, by budować Truth Bullets. Czego nie znajdziesz, tego nie będziesz mieć. |
| **Class Trial** | Wszyscy są w sali i jedno z was to zrobiło. Zeznania, Objections i wreszcie głosowanie. |

### Eclipse

Przed każdą porą dnia gasną światła. To okno ustawiania to **Eclipse**:

- Nikt nie widzi cudzego tokenu, w żadnym pokoju. Każdy gracz jest we własnym kanale głosowym.
- Ustawiasz swój token: do **2 przejść między połączonymi pokojami**, drzwi i przejścia wciąż obowiązują. Wyjątkiem jest **Eclipse przed Nocą** - wybierasz **dowolny pokój na mapie**.
- Twoje akcje są już odnowione, gdy Eclipse się otwiera, ale nic ich nie wydaje poza **Direct Murder**. Żadnych Calli, dopóki nie zapali się światło.
- Otwiera ci się karta z podsumowaniem poprzedniej pory dnia - co znalazłeś, co zostawiłeś.
- Eclipse to jedyny moment pełnej osłony w grze i zwykle tu zaczyna się morderstwo. Nie jest częścią dnia: zegar nie rusza, dopóki GM go nie zakończy.

Zaciemniona pora dnia (overflow, rozdział 6) może odjąć przejść albo zabrać dowolne ustawianie.

---

## 3. Ruch i widzenie

### Pokoje

Szkoła narysowana jest jako pokoje. Wszystko - ruch, Search, Listen, to, kto cię słyszy, każdy incydent - rozstrzyga się według pokoju, w którym stoi twój token.

| Ruch | Koszt |
|---|---|
| Ruch wewnątrz własnego pokoju | zawsze za darmo |
| Pierwsze przejście do połączonego pokoju o tej porze dnia | twój **Free Move** |
| Każde kolejne przejście | **1 akcja** za każde |
| Przejście kupione Hope Callem Sprint | za darmo |

Przeciągnij token; koszt naliczany jest, gdy dotrzesz. Przejście, którego nie masz czym opłacić, zostaje odrzucone, a token wraca.

Zawraca cię:

- pokój, który **nie łączy się** z twoim (odmowa wymienia pokoje, do których dojdziesz),
- **zamknięte drzwi** (GM zamknął pokój),
- **zapieczętowany pokój** (Despair Call Behind Closed Doors, na jedną porę dnia),
- **Chained** z Despair Calla (nie wyjdziesz z pokoju do końca pory dnia),
- **cudza sypialnia**, gdy nie masz do niej klucza,
- **śmierć** - ciało zostaje tam, gdzie upadło.

### Co widzisz

- Pokój, w którym jesteś, jest w pełnym kolorze. Pokoje, w których już byłeś, prześwitują zza zasłony. Reszta szkoły tonie we mgle, dopóki do niej nie wejdziesz - pokój odkrywa się wejściem, raz, per postać.
- Widzisz tylko osoby stojące w twoim pokoju. Nikogo innego dla ciebie na mapie nie ma.
- Zegar u góry ekranu da się kliknąć: tłumaczy fazę, porę dnia, gdzie jesteś, i wypisuje opis pokoju, jeśli GM go napisał.
- Karta innego gracza otwiera się ocenzurowana: imię, portret, Health, Sanity i to, co trzyma w rękach. Nic więcej.

### Głos i podsłuchiwanie

Z włączonym głosem per pokój każdy pokój jest własnym kanałem: słyszysz tylko tych, którzy stoją z tobą w pokoju, a twój klient głosowy idzie za tokenem w chwili, gdy przekroczy granicę pokoju. Podczas Eclipse każdy gracz jest sam we własnym kanale. GM może podsłuchiwać dowolny pokój jako wyciszony słuchacz - zakładaj, że Monokuma może słuchać.

Żeby dowiedzieć się, kto jest za ścianą, bez wchodzenia, użyj **Listen** (rozdział 4).

### Search Tokens

Każdy pokój ma pewną liczbę **Search Tokenów** na porę dnia (domyślnie 3; GM ustawia od 0 do 10). Każde Search wydaje jeden. Przeszukany do cna pokój jest przeszukany dla wszystkich, dopóki zegar się nie przesunie. HUD mówi, ile zostało tam, gdzie stoisz.

---

## 4. Akcje

Masz **2 akcje** na porę dnia (1, gdy jesteś Wounded). Siatka akcji na arkuszu ma dziesięć kafelków. Kafelek ze znakiem GMa oddaje ruch człowiekowi: twój rzut i prośba trafiają do twojego wątku w komunikatorze i czekasz na decyzję.

Opis każdej akcji pokazuje jej koszt, statystyki, którymi rzuca, pokój, w którym jesteś, i wszystko, co będzie kosztować Sanity.

### Search - Eye albo Hand, 1 akcja

Przeszukujesz pokój pod kątem tego, co nazwiesz. Wydaje jeden z Search Tokenów pokoju.

| Rzut | Wynik |
|---|---|
| poniżej 8 | nic nie znaleziono |
| 8+ | przedmiot Tier 0 - losowa, z pozoru bezużyteczna rzecz |
| 12+ | Tier 1 |
| 18+ | Tier 2 |
| krytyk | o jeden Tier więcej, niż mówi rzut |

O co możesz prosić: *coś, co mnie poskłada* (użytkowy leczący), *coś na nerwy* (użytkowy uspokajający), *coś, czym da się zabić* (narzędzie zbrodni), *coś do sprzątania* (narzędzie do sprzątania), *coś do pracy* (narzędzie) albo *coś konkretnego* - opisz to, a GM orzeknie, co naprawdę tu było.

Wzięcie narzędzia zbrodni albo narzędzia do sprzątania **zostawia Prep Remnant** w pokoju - ślad, że ktoś tu zbierał narzędzia. Narzędzie nie zostawia nic, chyba że to, co się znajdzie, jest też bronią. Niektóre pokoje to dobre miejsca, by szukać danej kategorii, a niektóre złe; okno rzutu mówi, gdy miejsce zmienia twój rzut. Jeśli ktoś ukrył w pokoju skrytkę, Search może ją wyciągnąć, z karą.

### Observe - Eye, 1 akcja

Szukasz dowodów. Sukces kopiuje Remnant do twojego ekwipunku jako **Neutral Truth Bullet** i zostawia oryginał na miejscu dla innych. Porażka kosztuje **1 Sanity**. Krytyk dodatkowo rozpoznaje rodzaj śladu i daje solidną podpowiedź od GMa.

Wybierasz, jak patrzysz:

| Sposób | Cel |
|---|---|
| Rozejrzyj się za czymkolwiek | to, co najłatwiej zauważyć w tym pokoju - rozstrzygają kości |
| Spójrz poza oczywiste | najtrudniejsza rzecz tutaj - rozstrzygają kości |
| Podążaj za własnymi śladami | wróć po własnych śladach i znajdź to, co zostawiłeś |
| Skup wzrok | powiedz, czego szukasz; GM decyduje, na czym zatrzyma się twój wzrok |
| Zbadaj punkt zainteresowania | coś, co nie jest śladem - osoba, maszyna, pogoda; GM rozstrzyga |

Dowiadujesz się, co znalazłeś, nigdy jak trudne to było. Ślady powiązane ze zbrodnią pokazywane są zawsze jako pierwsze.

### Analyze - Head, 1 akcja

Trzy rzeczy za jednym kafelkiem:

- **Zidentyfikuj Truth Bullet.** Zamienia Neutral Truth Bullet w jego prawdziwą kategorię. **Porażka blokuje ten bullet dla ciebie do końca rozdziału** - przekaż kopię komuś innemu, jego kopii twoja porażka nie wiąże.
- **Skup się na konkretnej sprawie.** Brak dowodów w ręku? Poproś GMa, by cię gdzieś skierował. 14+ kupuje subtelną podpowiedź ("jesteś daleko od celu"), 18+ bezpośrednią ("przeszukaj pomieszczenie z basenem"), krytyk pozwala im zadać ci jedno pytanie ("czy ofiara naprawdę zginęła w tym pokoju?"). Poniżej 14 - bez pomocy.
- **Znajdź ukrytą skrytkę.** 16+ otwiera przed tobą jedną skrytkę w tym pokoju. GM się dowiaduje; właściciel nie.

### Projekty - Hand, Body, Leg albo Head, 1 akcja

Powolna gra: wiele akcji przez wiele pór dnia i jedyna rzecz, która może zmienić to, jak to się skończy.

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

- Projekt mieszka w pokoju. Pracować nad nim może tylko ten, kto tam stoi.
- **Zaproponowanie projektu** wysyła kartę do GMa. Nic nie istnieje, dopóki GM nie zatwierdzi, a wcześniej może zmienić skalę, pokój albo brzmienie.
- Projekt może wymagać konkretnej statystyki; inaczej wybierasz sam.
- **Narzędzie w ręku** daje przewagę i zdejmuje swój Tier z każdego progu rzutu.
- Niektóre projekty są tajne dla osób, które nad nimi pracują. Jeśli któregoś nie widzisz, nie ma go na twojej liście.
- **Sabotage** (ten sam kafelek, te same statystyki): psujesz projekt w pokoju, w którym stoisz, tak by wymagał projektu naprawy. 12+ prosta naprawa, 18+ złożona, krytyk - naprawa o ukrytej trudności. **Zawsze zostawia ślad**, nawet przy porażce, a rzut z Despair pokazuje cię pokojowi. Przy świadkach najpierw rzucasz Shadow przeciw 16, by zamaskować, co robisz; porażka cię nie zatrzymuje, tylko wszyscy patrzyli.

### Akcja dynamiczna - dowolna statystyka, 1 akcja

Cokolwiek, byle opisane szczegółowo. GM ustala trudność i statystykę albo odmawia (nic nie wydano). Progi akcji dynamicznych są łagodniejsze niż standardowych, celowo, jako nagroda za pomysł:

| Trudność | Zakres | Tier przedmiotu, który może dać | Ślad, który zostawia |
|---|---|---|---|
| Trywialne - każdy by to zrobił | 8-12 | Tier 0 | Obvious |
| Wymaga wprawy | 13-15 | Tier 1 | Evident |
| Obce większości ludzi | 16-18 | Tier 2 | Subtle |
| Wymaga bardzo niszowej wiedzy | 19-21 | Tier 3 | Hidden |

Skala jest odwrócona celowo: im łatwiejsza rzecz, tym głośniejszy ślad.

### Rest - bez rzutu, 1 albo 2 akcje

| | Short Rest | Long Rest |
|---|---|---|
| Koszt | 1 akcja | 2 akcje |
| Wybierz | 1 z trzech | 2 z trzech |
| Jak często | raz na porę dnia | raz na sesję |
| Gdzie | pokoje, które GM oznaczył | pokoje, które GM oznaczył |

| Opcja | Long | Short |
|---|---|---|
| Sen | przywraca całe Health | przywraca połowę Health |
| Posiłek | przywraca całe Sanity | przywraca połowę Sanity |
| Oddech | daje 2 Hope | daje 1 Hope |

Okno wycenia oba wobec tego, co masz, i wymienia pokoje, które na każdy pozwalają.

### Listen - Shadow, 1 akcja

Ustal, kto jest w sąsiednim pokoju. GM niepotrzebny.

| Rzut | Wynik |
|---|---|
| poniżej 14 | niczego się nie dowiadujesz |
| 14+ | wybierz jeden pokój; dowiedz się, czy ktoś tam jest i ile osób |
| 18+ | wybierz jeden pokój; zobacz tokeny wszystkich, którzy tam są |
| krytyk | zobacz każdy token gracza we wszystkich sąsiednich pokojach |

### Palm - Hand, 1 akcja

Ręka w czyjejś kieszeni, w obie strony. Dwa niezależne rzuty: **Hand** decyduje, czy się udało, **Shadow** - czy zauważyli.

| | Weź coś | Zostaw coś |
|---|---|---|
| Udaje się (Hand) | 10+ | 8+ |
| Niezauważony (Shadow) | 15+ | 13+ |

Cztery wyniki, a ciekawe są te niedopasowane: przyłapany z niczym albo okradziony przez kogoś, kogo nie zauważyłeś. Bierzesz, co wyjdzie; krytyk pozwala wybrać. Ich limit noszenia wciąż obowiązuje - pełna kieszeń zostaje pełna. Palm nigdy nie sięga do skrytki.

### Tamper - Shadow, 1 akcja

Dwie rzeczy za kafelkiem:

- **Zatrzyj ślady.** Wymaż jeden ślad, który *ty* zostawiłeś w tym pokoju. Im łatwiej go zobaczyć, tym trudniej usunąć: **Hidden 9, Subtle 12, Evident 15, Obvious 18**. Narzędzie do sprzątania w ręku daje przewagę i zdejmuje swój Tier z progu. Czysty sukces usuwa ślad. Sukces z Despair usuwa go, ale zostawia własny Tamper Remnant. Porażka zostawia ślad i dokłada obok Tamper Remnant (Subtle przy Hope, Evident przy Despair). Reinforced ślady nie schodzą nigdy.
- **Mylny trop.** Zostaw Prep Remnant wskazujący na kogoś innego. Wymaga **15**. Podkłada coś tak czy inaczej - porażka z Hope zostawia Hidden, Faint ślad, którego pewnie nikt nie znajdzie; porażka z Despair nie podkłada nic.

Jeśli ktoś inny jest w pokoju, najpierw rzucasz Shadow przeciw **16**, by zamaskować, co robisz, a przyłapanie kosztuje Sanity: 1 przy sukcesie z Despair, 1 przy porażce, 2 przy porażce z Despair. Opis akcji ostrzega, ile osób patrzy. Wejście najpierw do pustego pokoju to realna alternatywa.

### Direct Murder - 1 akcja, GM decyduje

Zabójstwo twarzą w twarz, uzgodnione wcześniej z GMem i za zgodą gracza ofiary. Zgłosić je można tylko **podczas Eclipse** - jedynego momentu, w którym możesz być z kimś sam na sam. Akcja przepada niezależnie od tego, czy się uda, a jak poszło, nie wie nikt - nawet ty - dopóki Eclipse się nie skończy i pokój się nie uspokoi. Jeśli skończysz z nią sam na sam, a GM pozwoli, incydent się otwiera (rozdział 8).

### Move - za darmo, potem 1 akcja

Nie kafelek, po prostu przeciągasz token. Zobacz rozdział 3.

---

## 5. Hope i Hope Calls

Hope jest twój. Masz najwyżej **6**. Wraca, gdy rzuty idą po twojej myśli (+1 z Hope, +2 na krytyku), z Oddechu przy Rest i z użytkowego Tier 3. Wydajesz go na **Hope Calls**, z arkusza:

| Call | Koszt | Co robi |
|---|---|---|
| **Support** | 1 | Daj innemu graczowi przewagę na jeden rzut. Musicie być w tym samym pokoju. |
| **Experience** | 1 | Dodaj poziom doświadczenia do rzutu, do którego to doświadczenie naprawdę się stosuje. Czeka na GMa - piszesz, co zamierzasz, a Hope pobierane jest tylko przy zgodzie. |
| **Ultimate** | 1 | Przewaga na rzut, do którego twój Ultimate naprawdę się stosuje. Czeka na GMa tak samo. |
| **Contribution** | 2 | +1 postępu do projektu, nad którym trwa praca w pokoju, w którym jesteś. |
| **Sprint** | 2 | Jeszcze jedno przejście między pokojami o tej porze dnia, bez płacenia akcją. |
| **Reroll** | 3 | Przerzuć ostatnią akcję. Cofa poprzedni wynik - ślad, przedmiot, Sanity idą razem z nim. Niektóre rzeczy zostają: ręka, która już była w kieszeni, trop, który już podłożono. |
| **Resolve** | 3 | Na jeden rzut sam wybierz, którą statystykę dodać. |
| **Burst** | 4 | Twoja następna akcja nic nie kosztuje - cała akcja, ile by nie kosztowała. |
| **Relief** | 4 | Weź Short Rest od razu: bez akcji, bez oznaczonego pokoju i nie zużywa tego z tej pory dnia. |
| **Loaded Die** | 6 | Przy następnym rzucie jedna kość jest ustawiona na 12, a druga rzucana. Bardzo wysoki wynik, a krytyk tylko, jeśli i ta druga wypadnie 12. |

Call wpływający na rzut czeka na twój następny rzut i jest zużyty w chwili rzutu. Sprint i Burst idą do zapasu i trwają do końca pory dnia. Nikt nie wydaje Hope Calli podczas Eclipse, gdy Monokuma go uciszył (Silence) ani gdy Silence z overflow zaciemnia porę dnia.

---

## 6. Despair - druga strona

Każdy twój rzut zakończony Despair zasila pulę Monokumy, który cię pilnuje. Pula mieści **12**. Ile w niej jest, wiedzą GMowie - ty widzisz, że pule istnieją, nie jak są pełne.

### Despair Calls - co Monokuma może ci zrobić

| Call | Koszt | Efekt |
|---|---|---|
| Obstacle | 1 | Utrudnienie na twój rzut. |
| Approval | 1 | Przewaga na twój rzut. Tak, czasem pomaga. |
| Fuel a Monocub | 1 | 1 Despair zamienia się w 1 Hope dla Monocuba, by mógł użyć Confusion. |
| Feed the Overflow | 1 | Wlewa Despair do overflow, który zaciemnia świat. |
| Behind Closed Doors | 2 | Pieczętuje pokój na jedną porę dnia. |
| Paranoia | 2 | Tracisz 2 Sanity. |
| Pain | 3 | Tracisz 2 Health. |
| Chained | 3 | Nie możesz opuścić pokoju do końca pory dnia. |
| Game Integrity | 3 | Odejmuje 2 postępu projektowi. |
| Patronage | 3 | Dodaje 2 postępu projektowi. |
| Silence | 4 | Nie możesz wydawać Hope Calli do końca pory dnia. |
| Contraband | 4 | Niszczy dowolny jeden przedmiot. |
| Public Announcement | 6 | Wszyscy wezwani do jednego pokoju na początek następnej pory dnia. Macie czas do tej pory; gdzie będziecie, gdy się zacznie, zależy od was. |
| Motive | 6 | Żądanie, termin w porach dnia i cena zignorowania go - ogłoszone wszystkim słowo w słowo. Odliczanie wisi na HUD. |
| New Rule | 9 | Jedna nowa zasada killing game wybrana przez Monokumę. Zasady lądują na zakładce Zasady każdego arkusza. |

### Overflow

Despair zdobyty ponad pełną pulę nie znika - zbiera się w jednym wspólnym liczniku. Gdy licznik sięgnie progu (domyślnie **20**; GM może go przestroić), szkoła robi się gorsza na **jedną porę dnia**, a z kapelusza GMa losowana jest **jedna** rzecz:

| Zaciemnienie | Na jedną porę dnia |
|---|---|
| Darkness | o 1 przejście mniej w Eclipse; Eclipse z dowolnym ustawianiem cofa się do dwóch pokoi |
| Shift | o 1 Search Token mniej w każdym pokoju |
| Panic | o 1 akcję mniej dla każdego, ponad Wounded |
| Despair | nie zdobywa się w ogóle Hope - wydawanie wciąż działa |
| Silence | żadnych Hope Calli, u nikogo |
| Fog | brak Free Move - przejścia kosztują akcje jak zwykle |
| Rot | każdy przedmiot z więcej niż jednym punktem wytrzymałości traci jeden (jednorazowo, nic się nie łamie) |
| Earthquake | każdy projekt traci 1 postępu (jednorazowo) |

Żadne z nich nie zejdzie ci poniżej jednej akcji ani jednego Search Tokena. Zamiast licznika widzisz "?"; werdykt Class Trialu go opróżnia.

---

## 7. Rzeczy

### Tier i wytrzymałość

| Tier | Użytkowy | Narzędzie zbrodni / do sprzątania | Wytrzymałość |
|---|---|---|---|
| 0 | losowy, z pozoru bezużyteczny przedmiot - otwarty na kreatywne użycie; GM orzeka | losowy, z pozoru bezużyteczny przedmiot | 1 |
| 1 | przywraca 1 Health (leczący) albo 1 Sanity (uspokajający) | przeznaczony do czegoś innego, ale się nada | 1 |
| 2 | przywraca 2 Health albo 2 Sanity, zależnie od rodzaju | częściowo przeznaczony do tej roboty | 2 |
| 3 | przywraca 2 Health **albo** 2 Sanity - do wyboru - plus 2 Hope | zrobiony wyłącznie do tej roboty | 3 |

**Wytrzymałość:** każdy rzut z Despair wykonany z użyciem narzędzia kosztuje je jeden punkt, niezależnie od tego, czy praca się udała. Na zerze jest **Zepsute**: zostaje w ekwipunku, na swoim miejscu, bezużyteczne - i wciąż jest dowodem. Dwa wyjścia: **wyrzuć** (rzut na Shadow decyduje, jak widoczny będzie ślad, a ślad zostaje w pokoju) albo schowaj w **skrytce**. Zużyty użytkowy też jest Zepsuty.

### Kategorie i ile nosisz

| Kategoria | Limit | Uwagi |
|---|---|---|
| **Użytkowe** | 3 | Leczące przywracają Health, uspokajające oczyszczają Sanity. Używasz z wiersza w ekwipunku. |
| **Ekwipunek**: narzędzia zbrodni, narzędzia do sprzątania, narzędzia | 2 wspólne miejsca | Tylko **jedno** może być schowane - noszenie dwóch znaczy, że jedno jest w ręku. |
| **Truth Bullets** | brak | Dowody. To, co wiesz, nie rzecz w szufladzie. |
| **Klucze do pokoi** | brak | Otwiera jedną sypialnię. |

Przedmiot może służyć też jako inna kategoria (śrubokręt w narzędziach, który jest też narzędziem zbrodni) i wciąż zajmuje jedno miejsce.

**W ręku.** Ekwipunek liczy się tylko wzięty do ręki: w incydencie, przy sprzątaniu i przy pracy nad projektem liczy się tylko to, co trzymasz. W ręku jest zawsze najwyżej jedna rzecz; wzięcie jednej odkłada pozostałe. Narzędzie w ręku daje przewagę przy pracy nad projektem i sabotażu i zdejmuje swój Tier z progu. Narzędzie do sprzątania w ręku robi to samo przy sprzątaniu. Tier narzędzia zbrodni to jego obrażenia.

**Przekazywanie.** Każdemu w tym samym pokoju: **Przekaż** (opuszcza cię na dobre; obowiązuje jego limit) albo, przy Truth Bullecie, **Podziel się kopią** (macie oboje, a jego kopii nie wiąże żadna twoja nieudana analiza). Bez akcji.

### Sypialnie, klucze, skrytki

- Jeden uczeń, jedna sypialnia. **Drzwi są zamknięte** dla wszystkich poza właścicielem; każdy inny potrzebuje **klucza**. Masz własny klucz i możesz dać komuś kopię - właściciel zachowuje swój.
- Twoja sypialnia ma **skrytkę**. Skrytka mieści **3** rzeczy, a żeby coś włożyć albo wyjąć, musisz stać w pokoju. Truth Bulletów nie da się schować.
- **Otwarta** skrytka to szuflada: każdy stojący w pokoju może ją przejrzeć za darmo i wziąć jedną rzecz. Skrytka w twojej sypialni jest otwarta, dopóki nie zbudowano do niej schowka (projekt, który zatwierdza GM).
- **Ukrytą** skrytkę trzeba najpierw znaleźć: Search w pokoju z karą albo Analyze *Znajdź ukrytą skrytkę* na 16+. Gdy z twojej skrytki coś zniknie, dowiadujesz się, że ktoś ją ruszał - nigdy kto.
- GM może dać ci skrytkę w innym pokoju. Nie daje ona klucza do tego pokoju.
- Miałeś pełne ręce, gdy coś znalazłeś? Trafia do twojej skrytki, jeśli stoisz w tym pokoju.

---

## 8. Ślady i dowody

### Remnants

**Remnant** to ślad na mapie. Większość tego, co robisz w pokoju, jakiś zostawia: wzięcie broni, sabotaż, praca nad projektem, wyrzucenie czegoś, walka, sprzątanie. To, jak trudno go zobaczyć, to jego **widoczność**: Obvious, Evident, Subtle, Hidden. Niektóre są **Reinforced** - nikt nie może ich usunąć.

| Remnant | Co znaczy |
|---|---|
| **Key Remnant** | Stawiany przez GMów, by sprawa dała się rozwiązać. Nieusuwalny. Staje się Truth Bulletem rozpoznanym w chwili podniesienia. |
| Prep Remnant | Zostawiony przy przygotowaniu morderstwa albo zbieraniu narzędzi. |
| Incident Remnant | Zostawiony podczas konfrontacji albo śmierci ofiary. |
| Tamper Remnant | Zostawiony przez majstrowanie - zbyt czysta plama, rzecz odłożona odrobinę nie tak. |
| Faint Remnant | Wątpliwy związek ze sprawą. Czyszczony przez GMa, chyba że powiązany z morderstwem. |
| Autopsy Remnant | Stan ciała. Wydawany na początku Investigation, bez rzutu. |
| Final Truth Remnant | Jeden na rozdział. Wskazuje Masterminda. Nieusuwalny. |

### Truth Bullets

**Truth Bullet** to to, co daje Observe: kopia Remnantu w twoim ekwipunku, pod Truth Bullets. Większość przychodzi jako **Neutral** - jeszcze nie wiesz, jaki to rodzaj śladu - i wymaga Analyze. Key, Autopsy i Final Truth przychodzą rozpoznane. Karta Truth Bulleta pokazuje nazwę, opis, który dostał znalazca, jak trudno było zauważyć oryginał (nikły, skromny, mocny albo głęboki trop), rozdział i to, czy twoja analiza się na nim nie powiodła. To jedyna rzecz, którą możesz przedstawić w Class Trialu.

Nie da się zmienić nazwy ani opisu przedmiotu. To, jak rzecz się nazywa, jest częścią dowodu.

### Drabina trudności

Przy rzucie nigdy nie widzisz trudności, ale kształt drabiny nie jest tajemnicą:

| Oryginalny ślad | Observe (żeby zauważyć) | Analyze (żeby odczytać) |
|---|---|---|
| Key Remnant | 6 / 9 / 12 / 15 | bez rzutu |
| Prep, Incident, Tamper | 9 / 12 / 15 / 18 | 12 / 15 / 18 / 21 |
| Faint | 12 / 15 / 18 / 21 | 8 / 12 / 15 / 18 |
| Coś z Daily Life | 8 / 12 / 18 / 21 | 8 / 12 / 18 / 21 |

Kolumny to Obvious / Evident / Subtle / Hidden. Wątpliwy ślad trudno zauważyć, a w ręku jest oczywisty; przygotowany łatwo podnieść i trudno odczytać.

---

## 9. Pułapki i projekty, które zabijają

**Morderstwo pośrednie** buduje się jako projekty, tajne dla wszystkich poza budującym i GMami - *Przygotuj broń* (Standardowy albo Złożony, 4-6 postępu, może wymagać konkretnego pokoju) i *Zastaw pułapkę* (Trywialny albo Standardowy, 3-4 postępu, zawsze wymaga konkretnego pokoju). Zaplanuj około 6 postępu łącznie.

Praca nad takim projektem, gdy ktoś inny jest w pokoju, dodaje **rzut Shadow przeciw 16**, by ukryć zamiar: sukces i możesz swobodnie kłamać; porażka i pozostali dostają ogólny opis ("grzebie przy probówkach"). W samotności projekt po prostu zyskuje +1. Każda akcja projektu rzuca też Shadow, by ukryć ślady: poniżej 12 zostaje Obvious ślad, 12+ Evident, 18+ Subtle, krytyk Hidden.

Ukończona pułapka czeka na warunek - ktoś sam w pokoju, ktoś wchodzi, przeszukuje, odpoczywa, szuka skrytki, pracuje nad wskazanym projektem albo go sabotuje, używa podłożonego przedmiotu - opcjonalnie tylko po zmroku (Wieczór, Noc albo każdy Eclipse), i nigdy budujący. Moduł pilnuje; GM decyduje, czy odpaliła.

**Podłożony przedmiot** przychodzi jako to, czego szukał znalazca. Odpala tylko dla kogoś, kto szukał przedmiotu użytkowego i potem go użył.

Jeśli to ty wchodzisz w pułapkę, zobacz następny rozdział - dostajesz rzut.

---

## 10. Morderstwo

Poniżej to, co graczowi wolno wiedzieć. Kto co komu robi, to sprawa incydentu, nie twoja, dopóki nie znajdzie się ciało.

### Rzut otwarcia

Jest dokładnie jeden, a rodzaj morderstwa decyduje, czyj.

- **Direct Murder:** rzuca zabójca (Body albo Hand, przeciw 8; przewaga nocą). Przy porażce nic się nie dzieje, a ofiara nigdy się nie dowie, że cokolwiek próbowano. Przy sukcesie incydent się zaczyna. Z Despair ofiara od razu traci całe Sanity i dostęp do Role reversal na ten incydent. Na krytyku ofiara dowiaduje się, kto ją atakuje.
- **Morderstwo pośrednie (pułapka):** rzuca **ofiara** (Eye albo Head, przeciw **20**; utrudnienie nocą). Sama prośba o rzut jest ostrzeżeniem. **Hope:** coś jest nie tak z tym pokojem - Free Move i żadnego pojęcia dlaczego; wydaj go, a przeżyjesz. **Despair:** rozgryzasz, co tu zastawiono, i możesz powiedzieć innym. **Krytyk:** dostrzegasz pułapkę i wiesz, czyje ręce ją zbudowały. **Porażka:** niczego nie zauważasz, pułapka się zamyka.
- Śmierć z własnej ręki używa rzutu zabójcy i przeskakuje od razu do sprzątania.

### Jeśli jesteś ofiarą

Incydent toczy się na tury. **Zaczynasz ty**, a każda tura cię kosztuje: 1 Sanity w Direct Murder, 2, gdy jesteś sam z pułapką - Sanity, dopóki się nie skończy, potem Health. Twoje akcje kryzysowe są na arkuszu w zakładce Akcje. Hope Calle wciąż działają.

| Akcja kryzysowa | Rzut | Co robi |
|---|---|---|
| **Zostaw trop** | Hand / Leg / Shadow, 12 | Zostawia ślad, który ma pomóc innym (Evident przy Hope, Subtle przy Despair, Obvious i Reinforced na krytyku - i zachowujesz turę). Porażka z Hope daje przewagę przy następnej próbie. Wobec pułapki: Hand / Leg / Body, Hope zostawia Reinforced ślad, krytyk dwa. |
| **Zabezpiecz ślad** | Hand / Leg / Shadow, 15 | Zabierz coś zabójcy i zamień to w ślad powiązany z jego tożsamością. Ten sam kształt co wyżej. |
| **Self-defence** | Hand / Leg / Body, 18 | Walczysz. Jedna próba. Hope otwiera Survive i Role reversal, Despair tylko Role reversal, krytyk zatrzymuje drenaż i pozwala wziąć jedno z nich w tej turze bez rzutu. Przedmiot nadający się na broń daje przewagę. Porażka z Despair kosztuje 1 dodatkowo. |
| **Survive** | Leg, 18 | Wycofujesz się. Incydent się kończy i drenaż ustaje. Despair dodaje podpowiedź, kto to był; krytyk daje też nietykalność na ten i następny rozdział. Porażka kosztuje 1 dodatkowo. Wymaga najpierw Self-defence. |
| **Role reversal** | Hand / Leg / Body, 15 | Przechylasz szalę i zostajesz zabójcą. Hope przywraca też całe Health i Sanity; krytyk zabija ich od razu. Wymaga najpierw Self-defence. |
| **Użyj przedmiotu** | Hand, 15 | Wciśnij *użyj* przy przedmiocie. Działa na krytyku albo sukcesie z Hope; sukces z Despair zostawia ślad i nic więcej. |

Survive i Role reversal to akcje rozstrzygnięcia: kosztują **1 Sanity** zamiast akcji, a gdy Sanity się skończy - **1 Health**. Ofiara, której skończą się i Health, i Sanity, umiera. Nic, co zrobi zabójca, nie zdejmie z mapy Reinforced śladów.

### Jeśli jesteś zabójcą

Twoja strona tego samego stołu:

| Akcja | Rzut | Co robi |
|---|---|---|
| Strike | Hand / Leg / Body, 15 | 1 Health i 1 Sanity z nich; krytyk kładzie oba znaczniki tam, gdzie wybierzesz. Porażka z Despair wciąż zdejmuje 1 Sanity i zostawia Evident ślad. |
| Pin them down | Body, 12 | Dwie tury utrudnienia na Zostaw trop i Survive. |
| Keep your distance | Leg, 12 | Dwie tury utrudnienia na Zabezpiecz ślad i Role reversal. |
| Atak bronią | Body / Hand / Leg, 15 | Obrażenia 1 + połowa Tier broni (w górę); 1 + cały Tier na krytyku. Bez broni: utrudnienie, a sukces wyrywa improwizowaną broń (Tier 2 przy Hope, Tier 1 przy Despair). Przedmiot Tier 0 ocenia GM. |
| Finishing blow | Body / Leg / Hand | Próg to pięciokrotność ich pozostałego Health - za darmo przy 0. Kończy incydent; krytyk daje darmową akcję przy sprzątaniu. |
| Użyj przedmiotu | Hand, 15 | Jak u ofiary. |

Potem **sprzątanie**. Widzisz teraz ślady, które zostawiłeś, i możesz wydać **1 Sanity** na próbę: **Usuń ślad** (tabela Tamper, rozdział 4), **Przerób ślad** (o trzy niżej niż usuwanie - nazwij go inaczej i opisz jako coś niewinnego; zawsze kończy jako Tamper Remnant, a krytyk go wycisza i oddaje Sanity), **Mylny trop** (15) albo **Przenieś ciało** (Body, 16 - jeden pokój przy Hope albo Despair, dwa na krytyku; zawsze zostawia Evident ślad, a sypialni nigdy nie ma na liście). Tej nocy, na własnej scenie, nie kosztuje to akcji. Narzędzie do sprzątania w ręku daje przewagę i zdejmuje swój Tier z progu. Świadkowie w pokoju oznaczają ten sam rzut maskowania Shadow-16 i to samo Sanity za przyłapanie. Narzędzie zbrodni, którym się zamachnąłeś, zostaje zniszczone, gdy sprzątanie się zamyka; narzędzie do sprzątania - gdy znajdzie się ciało. Oba zostają w ekwipunku jako zepsute dowody.

### Jeśli na to wchodzisz

Wejście do pokoju, w którym trwa incydent, daje ci **jeden darmowy wybór**:

| Wybór | Rzut | Co robi |
|---|---|---|
| Escape together | Leg, 15 | Oboje wychodzicie; Hope przywraca ofierze Health i Sanity, krytyk dodaje nietykalność na ten i następny rozdział. Przy porażce wychodzisz tylko ty. |
| Double role reversal | bez rzutu | Ty i ofiara razem zwracacie się przeciw napastnikowi. To on staje się ofiarą. |
| Partners in crime | bez rzutu | Stajesz po stronie napastnika. Ofiara raczej stąd nie wyjdzie. |
| Averted eyes | bez rzutu | Wychodzisz i nie bierzesz udziału. Nie zostawia po tobie śladu. |

Gdy się przyłączyłeś i przeżyłeś, możesz potem **zwrócić się przeciw partnerowi** - jedyne zabójstwo, które nie wymaga wcześniejszego zgłoszenia. Czwarta osoba wchodząca do pokoju odwołuje incydent: nikt nie ginie, rany zostają.

### Następny poranek

Ktoś znajduje ciało. GM je ogłasza, wszyscy wezwani są na miejsce, gra staje tam, dopóki nie zacznie się Investigation. Śmierć z własnej ręki to zabójstwo jak każde inne - klasa ma tylko scenę.

---

## 11. Investigation

- Każdy żyjący uczeń dostaje **Autopsy Truth Bullet** - godzina odkrycia, przyczyna śmierci, to, co pokazuje ciało. Bez rzutu.
- **Observe** na śladach na mapie, **Analyze** na tym, co zbierzesz, **Podziel się kopią** z osobami w twoim pokoju. Ślady powiązane ze zbrodnią pokazywane są pierwsze.
- GMowie przygotowali do tej sprawy **Key Remnants** - najwyżej pięć, nigdy mniej niż trzy, i im lepiej poszedł rzut otwarcia zabójcy, tym jest ich mniej. Razem zawężają podejrzanych do dwóch do czterech osób; trop zawęża krąg, nigdy nie wskazuje nazwiska. Każdy Key Remnant poniżej czterech, którego nie znajdziecie, jest wart 3 Despair dla każdego Monokumy.
- **Ciało** można przeszukać: otwórz arkusz zmarłego ucznia i wciśnij *Weź* przy tym, co mieli przy sobie. Staje się twoim Truth Bulletem - i zostawia ślad, że ktoś przeszedł przez kieszenie.
- Śledczy i zabójcy jednakowo mogą użyć **Tamper**. Zbyt czysta plama to dowód sprzątania.
- Czego nie znajdziesz, tego nie będziesz mieć w Class Trialu.

---

## 12. Class Trial

Wszyscy w jednej sali. Class Trial otwiera się **otwartą dyskusją**: mówią wszyscy, a Truth Bullet można **Przedstawić** z ekwipunku - trafia na stół jako karta dla wszystkich, z twoim komentarzem, i nikomu nie zabiera głosu. Na kartę trafia tylko to, co sam widzisz.

Gdy sala jest gotowa się spierać, GM otwiera **Nonstop Debate**. Debata ma zegar (budżet GMa, domyślnie 180 sekund; przekroczenie zmienia go na czerwony i nic więcej). Wewnątrz debaty przedstawienie Truth Bulleta staje się **OBJECTION**:

| Tryb | Kto mówi | Jak długo |
|---|---|---|
| Nonstop Debate | wszyscy | budżet GMa |
| OBJECTION | tylko wnoszący | 60 sekund |
| Rebuttal | wnoszący i osoba, którą wskazał | 120 sekund, potem samo wraca do debaty |

Wskazujesz, komu zaprzeczasz. Nikt nie wnosi objection, gdy trwa cudze; każdy może wciąć się w rebuttal, ale tylko wobec jednej z dwóch osób, które już mają głos. HUD pokazuje tryb, kto ma głos i ile zostało, na każdym ekranie. Ciszy pilnuje stół, nie oprogramowanie.

### Głosowanie

Każdy żyjący gracz dostaje **kartę do głosowania**. Głosujesz na tego, kto twoim zdaniem jest **Blackened**: możesz głosować na siebie, na Monokumę i na zmarłych. Nikt nie widzi twojego głosu; publikowane są tylko sumy. Skazanie wymaga **więcej niż połowy** wydanych kart. **Remis liczy się jak błędny głos**, chyba że stół to rozstrzygnie.

| Wynik | Co się dzieje |
|---|---|
| **Trafnie** | Blackened zostaje stracony. Każdy ocalały dostaje **Level Up** (wybierz 1). |
| **Błędnie** | Stracony zostaje oskarżony. Blackened pozostaje anonimowy i w grze z **Reinforced Level Up** (wybierz 3) i jedną nową zasadą własnego wyboru, a każdy Monokuma napełnia pulę Despair. |

Rozdział może wydać dwóch Blackened (zdrada zostawia dwa ciała); głosowanie musi wskazać wszystkich.

### Level Up

| Opcja |
|---|
| Zwiększ Health o +1 |
| Zwiększ Sanity o +1 |
| Zwiększ jedną statystykę o +1 |
| Zwiększ jedno doświadczenie o +1 |
| Dodaj nowe doświadczenie warte +2 |

Przy Reinforced Level Up to samo można wziąć więcej niż raz.

### Final Trial

Ktoś wśród was mógł zbudować to miejsce. **Final Truth Remnants** - jeden na rozdział, nieusuwalne - wskazują Masterminda. Wskażcie go w Final Trialu, a killing game dobiega końca. Wskażcie niewłaściwą osobę, a nikt nowy nie ginie; klasa po prostu widzi, że gra nigdy nie była tym, na co wyglądała.

---

## 13. Śmierć i to, co po niej

- Zmarli nie wykonują akcji i nie wydają Hope. Zachowujesz arkusz i głos przy stole.
- Twoje **Truth Bullets giną razem z tobą**, noszone i schowane jednakowo. Wszystko inne zostaje przy ciele do znalezienia.
- Ciało zostaje tam, gdzie upadło, i zabójca może je przenieść. Zmarli nie liczą się jako obecni w pokoju: nie są świadkami, nie przekazują.
- GM może zakończyć rozdział, ujawniając, czym naprawdę był każdy Truth Bullet, zbierając je (Faint i Final Truth zostają) i czyszcząc Faint ślady.

### Gra Monocubem

Gdy skończy się twój własny Class Trial, możesz dołączyć do GMów jako **Monocub**. Ten sam aktor, ten sam arkusz; panel akcji staje się **Move** i **Confusion**.

- Masz tyle akcji co żyjący uczeń i widzisz tylko własny pokój.
- **Confusion** kosztuje **1 akcję i 1 Hope**, a twój Hope istnieje tylko dlatego, że Monokuma zamienił w niego Despair (Fuel a Monocub). To goły rzut 2d12, bez statystyki. Wybierz kogoś w swoim pokoju i pomóż albo przeszkódź przy jego następnym rzucie: 12+ daje +1 albo -1, 16+ przewagę albo utrudnienie, krytyk oddaje mu akcję albo ją marnuje. Dowiadują się, że coś uspokoiło ich rękę albo ich rozproszyło, nigdy kto.
- Monocub, który natknie się na miejsce zbrodni, jest zobowiązany do milczenia o nim do końca rozdziału. Confusion wciąż działa.

Same Monokumy - strona GMa - nie mają akcji ani Hope, przechodzą przez ściany i zamknięte drzwi i wydają Despair tam, gdzie ty wydajesz Hope.

---

## 14. Komunikator i prośby o decyzję

Przycisk w prawym dolnym rogu otwiera **Czat z GMem**: jeden wątek między tobą a każdym GMem. Nie ma kanału tekstowego między graczami - rozmowa w pokoju to głos.

Wszystko, co potrzebuje człowieka, ląduje w tym samym wątku: Observe na punkt zainteresowania, podpowiedź z Analyze, akcja dynamiczna, propozycja projektu, Search na coś konkretnego, Calle Experience i Ultimate, przedmiot Tier 0, którego chcesz użyć kreatywnie. Widzisz swój rzut, własne słowa i decyzję, gdy przyjdzie. Jeśli żaden GM nie odpowie, nic nie zostaje wydane.

Komunikator ma też zakładkę **Notatka**: twoje plany na sesję, dla GMów, do przeczytania przed nią. Szablon zadaje siedem pytań - czy planujesz zabić i jak, czy jesteś otwarty na śmierć, na tortury, na romans, twoje triggery, twoje cele i projekty zmieniające grę, których chcesz spróbować. Pierwsze cztery to granice, nie wyzwanie. "Bez zmian" to pełna odpowiedź.

---

## 15. Safeword

W lewym dolnym rogu karty postaci jest przycisk ze słowem - **MISIUBOMBO**, chyba że twój stół wybrał własne. Wciśnij, a scena staje. Gra się zatrzymuje, każdy GM dowiaduje się, kto wcisnął i z którego pokoju, a wszyscy widzą tę samą kartę: scena zatrzymana, GM to przejmie, gra wznowi się od punktu, na który wszyscy się zgodzą.

Nie musisz tego uzasadniać, ani teraz, ani później. Nie ma pola na powód. Nikomu innemu nie mówi się, kto wcisnął - tylko że scena stanęła.

---

## 16. Wskazówki do interfejsu

**HUD** (lewa kolumna): nazwa kampanii, rozdział, dzień, faza i pora dnia. Niesie też odliczanie Motive, wezwanie na zgromadzenie, "Znaleziono ciało", a podczas Class Trialu tryb i jego zegar. Kliknij, by dostać wyjaśnienie, gdzie jesteśmy, i opis twojego pokoju.

**Pasek stanu** (po prawej, nad zasobnikiem projektów): pozostałe akcje, czy Free Move wciąż jest, twój Hope, przejścia Eclipse, gdy trwa, i to, co masz w zapasie ze Sprint albo Burst. Kliknij, by dostać wyjaśnienie.

**Wiersze Despair** pokazują, że pule istnieją, nigdy jak są pełne. Kliknij, by dowiedzieć się, czym jest Despair.

**Twój arkusz:**
- *Akcje* - dziesięć kafelków, Hope Calle poniżej; tutaj akcje kryzysowe podczas incydentu; tutaj Move i Confusion jako Monocub.
- *Ekwipunek* - użytkowe, ekwipunek (z *weź do ręki*), Truth Bullets (Analyze, Przedstaw, Podziel się kopią), klucze do pokoi i twoja skrytka, gdy stoisz w tym pokoju.
- *Zasady* - stałe zasady Monokumy, dla wszystkich, cały czas.
- *Notatka* i *Czat* - notatka przed sesją i Czat z GMem.
- Safeword, w lewym dolnym rogu. Level Up, gdy go zdobyłeś.

**Karty i wyskakujące okna:** wyniki twoich akcji przychodzą jako karty, które same znikają. Dziennik czatu je zachowuje. Podczas Eclipse otwiera ci się podsumowanie pory dnia.

**Okno Wygląd:** zębatka w prawym dolnym rogu otwiera ustawienia, które należą do tej przeglądarki - nikt inny nie widzi ani nie słyszy różnicy:
- **Język** - English albo Polski dla okien, kart i arkusza modułu. Celowo osobno od języka Foundry. Działa po przeładowaniu. Nazwy własne zostają po angielsku w obu.
- **Motyw** - Stained Glass (obecny wygląd) albo Monokuma Legacy (z przełącznikiem czcionki pikselowej).
- **Skala interfejsu** (80% do 140%), **puls szkła**, **nazwa stanu za zegarem**, **ograniczone animacje**, **dźwięki komunikatora** oraz głośność **Dźwięk** i **Muzyka**.

**Rzuty są prywatne:** każdy twój rzut jest szeptany do ciebie i do GMów. Nikt nie widzi cudzych kości.

---

*Ktoś niedługo zrobi coś strasznego. Zdecyduj, komu ufasz.*
