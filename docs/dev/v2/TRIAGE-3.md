# Droga do 2.0 - triage, paczka 3

Napisane 24.11.2026. Pozostałe pozycje `minor` i `nit` ze wszystkich raportów F1 i F2, których nie było w paczkach 1
i 2 (te są w dokumencie planu). Opisy są skrócone; pełny tekst, dowód `plik:linia` i uzasadnienie są w pliku źródłowym
pod tym samym ID (`F1-daily.md`, `F1-calls.md`, `F1-murder.md`, `F1-investigation.md`, `F1-trial.md`, `F1-infra.md`,
`F1-blind-gm.md`, `F1-blind-player.md`, `F2-controls.md`). Wszystko to odczyt kodu, nie pomiar.

Decyzja właściciela z 24.11.2026 (D2-07): rekomendacje przyjęte. Kolumna "Twoja uwaga" jest na wyjątki.
Kolumna "Co zrobić" wynika z klasy: błąd i zły zamiar - poprawić; niejasny - komunikat albo podpowiedź; zostaje - bez zmian.

### Daily Life, zegar, Eclipse (11)

| ID | Co się dzieje | Waga | Klasa | Co zrobić | Twoja uwaga |
| --- | --- | --- | --- | --- | --- |
| DAY-02 | Lewa strzałka cofa porę dnia od razu, bez pytania (prawa pyta, z Anuluj domyślnym), i działa w incydencie przed Stage 6, gdzie Następna pora dnia jest odrzucana właśnie po to, by nie zdradzić ruchu zegara widzom (cofnięcie w 5 ... | minor | błąd | poprawić |  |
| DAY-03 | Eclipse zakończone przez drugiego GM-a osądza Direct Murder inaczej niż u głównego: rejestr legalnych pozycji jest tylko u głównego, więc uczeń postawiony tam, gdzie zasady by go nie wpuściły, liczy się jako świadek albo ofiara ... | minor | zły zamiar | poprawić |  |
| DAY-04 | Przy zapaleniu świateł zgłoszenia Direct Murder są usuwane z magazynu przed osądem; gdy GM, który kończy Eclipse, zamknie przeglądarkę albo przeładuje przy oknie "Otworzyć incydent?", zgłoszenie znika bez śladu, zabójca nie ... | minor | błąd | poprawić |  |
| DAY-05 | Search, którego token w tej samej chwili zabrał inny gracz, kosztuje akcję i nic nie daje, choć gracz widział wolny token (sprawdzenie przed rzutem przepuściło) | minor | zły zamiar | poprawić |  |
| DAY-06 | Gdy jeden GM ma otwartą rundę jednego rodzaju (np. Następna pora dnia), drugi naciska strzałkę Eclipse i dostaje ogólną odmowę bez wskazania, że to inny GM pyta graczy, ani jak dołączyć | minor | niejasny | komunikat albo podpowiedź |  |
| DAY-07 | Gracz czekający na trudność Dynamic Action albo kartę statystyki nie może wycofać prośby: okienko "Czekamy na GM-a…" nie ma przycisku, czeka do 180 s | minor | niejasny | komunikat albo podpowiedź |  |
| DAY-09 | Shut the Door przy cudzej barykadzie w tym samym pokoju jest odrzucany dopiero po rzucie, akcja przepada, a gracz czyta ogólne "Teraz nie możesz tego zrobić." | minor | zły zamiar | poprawić |  |
| DAY-08 | Okno notatki Direct Murder nie ma Anuluj: zamknięcie go krzyżykiem i tak składa zgłoszenie z pustą notatką, po zapłacie | nit | niejasny | komunikat albo podpowiedź |  |
| DAY-10 | Search za postać rzucany przez drugiego GM-a, którego karta "coś konkretnego" nie została wysłana, nie oddaje tokenu pokoju (oddaje tylko główny) | nit | zły zamiar | poprawić |  |
| DAY-11 | Gracz w rundzie "Najpierw gracze" nie ma limitu czasu, a runda GM-a, który został połączony, ale odszedł od komputera, trzyma okna graczy do naciśnięcia przez któregoś GM-a | nit | zostaje | bez zmian |  |
| DAY-12 | Rozłączenie głównego w trakcie prośby gracza (Dynamic, statystyka) nie gubi prośby: gracz ponawia ją u nowego głównego, który odnajduje starą kartę | nit | zostaje | bez zmian |  |

### Rzuty, prośby graczy, Despair (15)

| ID | Co się dzieje | Waga | Klasa | Co zrobić | Twoja uwaga |
| --- | --- | --- | --- | --- | --- |
| CALLS-04 | Gracz przeładował stronę w trakcie czekania: stara karta zostaje z żywymi przyciskami do końca swojego czasu (3/5 min). Główny GM nie reaguje na rozłączenie gracza. | minor | niejasny | komunikat albo podpowiedź |  |
| CALLS-05 | Wybór statystyki idzie od naciskającego GM-a wprost do gracza, bez głównego i bez potwierdzenia odbioru: karta od razu mówi "odpowiada", także gdy gracz już nie czeka (przeładował). | minor | niejasny | komunikat albo podpowiedź |  |
| CALLS-06 | Budżet ponownych pytań (3) przy 2 GM-ach zużywa się 2 na każde przeładowanie głównego (wyjście -> pytanie nowego głównego, powrót -> bridge.gmReady). | minor | błąd | poprawić |  |
| CALLS-07 | Ask for Hope Monocuba: Daj płaci z puli GM-a, który nacisnął, nie z puli Monokumy, z której czerpie Monocub. Drugi GM z pustą pulą dostaje odmowę, karta zostaje otwarta. | minor | niejasny | komunikat albo podpowiedź |  |
| CALLS-08 | Zgoda na Call jest trzymana tylko w pamięci głównego, 60 s. Przeładowanie albo zmiana głównego między zgodą a uzbrojeniem: uzbrojenie odrzucone, gracz prosi od nowa, GM zatwierdza drugi raz. | minor | zostaje | bez zmian |  |
| CALLS-09 | Okno czekania gracza (karta "czeka na decyzję GM-a") nie podaje czasu i nie ma przycisku wycofania prośby; czas jest tylko na karcie w wątku. Gracz nie może sam odwołać prośby, gdy się rozmyśli. | minor | niejasny | komunikat albo podpowiedź |  |
| CALLS-11 | Wybór Remnantu na karcie Observe na drugim GM-ie pokazuje jego własnych kandydatów; pierwsze naciśnięcie może dostać odmowę głównego, dopiero drugie okno pomija odrzucony ślad. | minor | zostaje | bez zmian |  |
| CALLS-13 | Rzut akcji gracza, Reroll, Despair z rzutu, opis znaleziska i każdy onPrimary biegną tylko w przeglądarce głównego. Drugi GM nie przejmuje, dopóki główny jest połączony, choćby wolny (np. karta przeglądarki w tle). | minor | zostaje | bez zmian |  |
| CALLS-10 | Zwrot ceny i Sanity z karty rozstrzygniętej na drugim GM-ie czytają wartości z arkusza, nie znaczniki GM-ów, które trzyma tylko główny: Hope podniesiony konsolą i jeszcze nie cofnięty może tam podnieść zwrot. | nit | zostaje | bez zmian |  |
| CALLS-12 | Ten sam GM naciska tę samą kartę w drugiej kopii (dziennik i komunikator), gdy jego okno decyzji jest otwarte: odmowa z jego własnym imieniem. | nit | niejasny | komunikat albo podpowiedź |  |
| CALLS-14 | Linia "Gracz już nie czekał." jest w podręczniku GM-a opisana jako notka tylko dla GM-ów, ale askNotHeld pisze ją jako główną linię karty, widoczną dla gracza. | nit | niejasny | komunikat albo podpowiedź |  |
| CALLS-15 | Podręcznik gracza cytuje koniec karty "Odpowiedział: ... - odbiór niepotwierdzony.", a karta mówi "{name} odpowiada, ale nie wiadomo, czy odpowiedź dotarła." | nit | błąd | poprawić |  |
| CALLS-16 | Statystyka rzutu i Observe na punkt nie mają zegara "dostałem" (patient): gdy główny jest połączony, ale nie przyjmuje prośby, gracz czeka pełne 3 minuty; Call i Dynamic mówią to po 8 s. | nit | zostaje | bez zmian |  |
| CALLS-17 | Droga 5 z SECOND-GM ("zgoda / trudność, gdy gracz już nie czeka" dawała drugiemu GM-owi DRPG.Bridge.notDone i żywe przyciski): na HEAD drugi GM dostaje to samo co główny (A11). | nit | zostaje | bez zmian |  |
| CALLS-18 | "Ich Hope jest już na maksimum." przy jednym odbiorcy (zamiana Despair w Hope, Ask for Hope). | nit | błąd | poprawić |  |

### Morderstwo, śmierć, Widzowie (11)

| ID | Co się dzieje | Waga | Klasa | Co zrobić | Twoja uwaga |
| --- | --- | --- | --- | --- | --- |
| MURDER-06 | Gdy uczestnik incydentu (rzucający otwarcie, ten, czyja tura, zabójca w Stage 6) się rozłączy, GM-owie nie są o tym informowani. Tracker czeka bez słowa | minor | niejasny | komunikat albo podpowiedź |  |
| MURDER-07 | Ogłoszenie drugiego GM-a odrzucone przez główny z własnego powodu (ciało już ogłoszone, Eclipse, brak pokoju) pokazuje dokładny powód na ekranie głównego, a drugi GM czyta tylko ogólną odmowę | minor | niejasny | komunikat albo podpowiedź |  |
| MURDER-08 | Po ogłoszeniu ciała przez drugiego GM-a pytanie o Faint Prep Remnanty otwiera się u głównego, nie u tego, kto ogłaszał | minor | zły zamiar | poprawić |  |
| MURDER-09 | Pytania "Ofiara wyczerpana, dwóch zabójców: zakończyć?" i "Zabójca nie żyje: zakończyć?" pojawiają się tylko na przeglądarce, która wykryła zmianę (hak updateActor tylko u głównego). Drugi GM ma szept albo nic | minor | zły zamiar | poprawić |  |
| MURDER-10 | Handbook GM-a mówi, że ciało ogłasza tylko główny, a "na ekranie innego GM-a Znaleziono ciało niczego nie ogłasza". Od E128 pełny drugi GM ogłasza przez głównego | minor | błąd | poprawić |  |
| MURDER-11 | Gdy drugi GM rzuca otwarcie za nieobecnego gracza, a ten wraca, główny wysyła mu zaproszenie mimo okna drugiego GM-a. Powstają dwa okna jednego rzutu, a kości drugiego nic nie znaczą | minor | niejasny | komunikat albo podpowiedź |  |
| MURDER-12 | Zamknięcie okna statystyki otwarcia przez GM-a nie wysyła nic: rzucający ma linię "GM wybiera" i czeka bez limitu | minor | niejasny | komunikat albo podpowiedź |  |
| MURDER-14 | Stage 6 nie kończy się sam ani przez zabójcę: zabójca nie ma "skończyłem sprzątać", koniec to Zakończ morderstwo GM-a | minor | niejasny | komunikat albo podpowiedź |  |
| MURDER-13 | Pułapka zauważona przez ofiarę: incydent zostaje na otwarciu, dopóki GM nie naciśnie Zakończ | nit | zostaje | bez zmian |  |
| MURDER-15 | Wynik akcji kryzysowej i Oddaj turę liczą się na przeglądarce GM-a, który kliknął, a wynik otwarcia na głównym. W ścieżce kryzysu nie znalazłem wywołania, które na drugim GM-ie wraca bez skutku | nit | zostaje | bez zmian |  |
| MURDER-16 | Aktor Widza ofiary (imię i obrazy ofiary) powstaje w świecie w chwili śmierci, zanim ktoś znajdzie ciało. Każda przeglądarka go dostaje, a konsola zdradza śmierć | nit | zostaje | bez zmian |  |

### Investigation (11)

| ID | Co się dzieje | Waga | Klasa | Co zrobić | Twoja uwaga |
| --- | --- | --- | --- | --- | --- |
| INV-02 | Okno „Opisz tutaj” na ekranie drugiego GM-a nie zamyka się, gdy główny odpowie pierwszy albo gdy minie zegar. Drugi GM dalej pisze; po naciśnięciu „Przekaż Truth Bullet” słowa przepadają z ogólną odmową. | minor | błąd | poprawić |  |
| INV-03 | Gracz, który wybrał Rozejrzyj się / Spójrz poza oczywiste / Follow My Traces i trafił w nieopisany Remnant, czeka do 3 minut na wynik bez żadnej informacji; | minor | niejasny | komunikat albo podpowiedź |  |
| INV-04 | Główny GM odświeża stronę; drugi GM (na ten czas główny) dostaje Observe i otwiera okno opisu. | minor | błąd | poprawić |  |
| INV-06 | Gdy ciało ogłasza drugi GM, pytanie „Znaleziono ciało. Sprawa tego rozdziału nie została jeszcze zrealizowana...” wyskakuje u głównego, nie u tego, kto ogłosił. | minor | zły zamiar | poprawić |  |
| INV-07 | Opłata za Key Remnanty, gdy rozprawę otwiera drugi GM, idzie prośbą do głównego. Gdy ta prośba nie dojdzie (brak potwierdzenia w 8 s albo odpowiedzi w 180 s), opłata nie jest naliczona, nie powstaje karta z przyciskiem „Pobierz ... | minor | zły zamiar | poprawić |  |
| INV-08 | Analyze odrzucone przez GM-a z innego powodu niż brak klucza (bullet niemożliwy do analizy według kopii GM-ów, bullet zniknął między wyborem a wynikiem) zabiera akcję, a w Class Trial Hope albo Sanity. Zwraca tylko dwa kody. | minor | zły zamiar | poprawić |  |
| INV-12 | Prośby gracza bez ponowienia: observe.resolve (tylko „mam to”, 8 s) i analyze.resolve (odpowiedź, 180 s) nie są wysyłane ponownie nowemu głównemu. | minor | niejasny | komunikat albo podpowiedź |  |
| INV-05 | Komunikat o upływie czasu okna opisu dostaje tylko główny GM. Drugi GM nie wie, że znalezisko wyszło pod domyślną nazwą i że opis trzeba dopisać w oknie Investigation. | nit | zły zamiar | poprawić |  |
| INV-09 | Komunikat o znalezisku dokończonym bez opisu mówi „zamknęło odświeżenie strony” także wtedy, gdy GM zamknął przeglądarkę i nie wrócił. | nit | niejasny | komunikat albo podpowiedź |  |
| INV-10 | Podręcznik gracza mówi, że karta „Observe na punkt zainteresowania” ma czas („Otwarta do ...”, 3 min). W kodzie kartę z czasem ma Skup wzrok; Zbadaj punkt zainteresowania to karta decyzji bez czasu. | nit | błąd | poprawić |  |
| INV-11 | Skup wzrok w pokoju bez nieskopiowanych Remnantów: odpowiedź mostu do przeglądarki gracza brzmi { ok: false, reason: "none" }, a z Remnantami { later: true }. Z konsoli gracz może odczytać, że w pokoju nic nie zostało. | nit | zostaje | bez zmian |  |

### Class Trial, werdykt, koniec rozdziału (9)

| ID | Co się dzieje | Waga | Klasa | Co zrobić | Twoja uwaga |
| --- | --- | --- | --- | --- | --- |
| TRIAL-05 | Linia "następny krok" w konsoli drugiego GM-a mówi, że werdykt dokończyć może tylko główny. Przycisk Dokończ werdykt obok jest jednak aktywny i działa (przez głównego). | minor | błąd | poprawić |  |
| TRIAL-08 | Kroki wejścia do rozprawy i wyjścia z niej (budżet akcji, reset zapisu, głosy zmarłych, opłata za Klucze, zdjęcie ciał, scena sali) wykonuje tylko przeglądarka, która zapisała fazę. | minor | błąd | poprawić |  |
| TRIAL-09 | Objection oczekujące na Truth Bullet, gdy jedyny GM przeładowuje albo traci połączenie: wybór Bulletu gracza jest odrzucany, po powrocie GM-a Objection wygasa, a zapłacona akcja albo Hope przepada. | minor | zły zamiar | poprawić |  |
| TRIAL-10 | Po zmianie głównego GM-a w trakcie rozprawy pamięć "kto ostatnio mówił" jest pusta (trzyma ją tylko pamięć przeglądarki głównego). Objection zaraz po zmianie trafia w mówiącego teraz albo jest odrzucane, gdy nikt nie mówi. | minor | niejasny | komunikat albo podpowiedź |  |
| TRIAL-11 | Wykonawca werdyktu siedzi w oknach Level Upów; nikt inny nie może dokończyć ani przejść dalej. Drugi GM, który wydał werdykt i przeładował stronę, jest jedynym, który może go dokończyć; główny nie widzi przycisku. | minor | zostaje | bez zmian |  |
| TRIAL-14 | Mówca, który się rozłącza, traci turę po 15 s, ale tylko w Testimony, Panic Round, przemowie Closing i turze Scrum. | minor | niejasny | komunikat albo podpowiedź |  |
| TRIAL-13 | Wyciszenie zmarłych na całą rozprawę obejmuje śmierć, której nikt nie znalazł; taki gracz nie dostaje też karty, a karta otwarcia głosowania podaje liczbę rozesłanych kart. | nit | zostaje | bez zmian |  |
| TRIAL-15 | Prośba o zapis rozprawy (trial.record op patch) bez odpowiedzi głównego jest zapisywana lokalnie przez drugiego GM-a. Dwie przeglądarki piszą wtedy ten sam zapis, czyli dokładnie to, czemu przekazanie miało zapobiec. | nit | niejasny | komunikat albo podpowiedź |  |
| TRIAL-16 | Na drugim GM-ie, który wczytał stronę w trakcie głosowania i nie ma jeszcze żadnej karty w kopii, okno proponuje "możesz też zacząć głosowanie od nowa", choć karty są u głównego i liczy je Zamknij i policz. | nit | niejasny | komunikat albo podpowiedź |  |

### Głos, główny GM, panel GM-a (20)

| ID | Co się dzieje | Waga | Klasa | Co zrobić | Twoja uwaga |
| --- | --- | --- | --- | --- | --- |
| PANEL-01 | Narzędzia naprawy są prawie wyłącznie w konsoli (resetAllActions, clearPendingObserves, clearBodyDiscovery, finishChapterEnd, unhide, resetTokens, gmStoreReclaim, repaintFog, refreshMusic, resetAllVoice, migrate({ force: true ... | minor | niejasny | komunikat albo podpowiedź |  |
| PRIM-01 | Nie widać, kto jest głównym GM-em. Wybiera go kod (najmniejsze id połączonego pełnego GM-a), nie stół; nie ma przełącznika. | minor | niejasny | komunikat albo podpowiedź |  |
| PRIM-02 | Rola głównego przechodzi automatycznie i bez słowa: gdy główny wyjdzie, drugi GM nie dostaje żadnej informacji, że od teraz on prowadzi automatykę (głos, losowanie rzutów, audyt arkuszy, mgłę). | minor | zły zamiar | poprawić |  |
| PRIM-03 | Okno, w którym nikt nie jest głównym: po F5 głównego jego userConnected(true) przychodzi wiele sekund przed jego ready. | minor | błąd | poprawić |  |
| PRIM-04 | Sprawdzenie, czy sprawa jest kompletna (klucze odpowiedzi, Remnanty, obsada), biegnie tylko u głównego, tylko przy jego załadowaniu i po przywróceniu. | minor | błąd | poprawić |  |
| PRIM-05 | Reset sezonu wciąż tylko u głównego. 1.2.128 poprawiło tylko to, że okno nie zamyka się przed odmową. Komunikat radzi "zresetuj sezon, gdy będziesz jedynym połączonym GM-em", czyli każe drugiemu GM-owi czekać, aż pierwszy wyjdzie. | minor | zły zamiar | poprawić |  |
| PRIM-06 | Dokończ werdykt działa tylko u GM-a, który dał werdykt (gdy jest połączony). Jeśli werdykt dał drugi GM, główny dostaje odmowę i musi prosić drugiego. Odwrotny kierunek (drugi -> główny) jest od 1.2.128 przekazywany. | minor | zły zamiar | poprawić |  |
| PRIM-07 | Przekazana prośba drugiego GM-a, którą główny odrzuci, mówi tylko "Gra na to nie pozwoliła". Prawdziwy powód jest na ekranie głównego (np. brak LiveKit u głównego dla Napraw głos, powód odmowy Dokończ werdykt). | minor | niejasny | komunikat albo podpowiedź |  |
| PRIM-08 | Dziennik debugowania jest tylko tej przeglądarki. Odmowy i błędy przekazanych prośb oraz cała automatyka (głos, rzuty, audyt) lądują w dzienniku głównego; drugi GM, który się skarży, nie widzi przyczyny. | minor | niejasny | komunikat albo podpowiedź |  |
| PRIM-09 | Safeword: pauzę włącza tylko przeglądarka głównego GM-a, gdy zobaczy kartę. W oknie z PRIM-03 (główny po F5 połączony, ale nie gotowy) gra nie staje, choć drugi GM jest obecny; drugi GM dostaje tylko notkę. | minor | zły zamiar | poprawić |  |
| PRIM-11 | Zmiany Daggerhearta za graczy (przekaźnik) wykonuje tylko główny; zmiana wysłana wokół jego przeładowania może przepaść, podręcznik każe ustawić ją ręcznie. | minor | zostaje / niejasny | bez zmian |  |
| VOICE-02 | Szybkie przejścia A -> B -> C: klient wykonuje każde przypisanie po kolei z kolejki, każde z pokojem zapamiętanym w chwili przyjścia, więc najpierw łączy się do B (słyszy B przez chwilę), potem do C. | minor | błąd | poprawić |  |
| VOICE-03 | Nie ma awaryjnego "wszyscy w jednym pokoju" w miejscu, gdzie GM szuka naprawy. Jedyna droga to wyłączyć Głos osobno w każdym pokoju w Ustawieniach gry; | minor | niejasny | komunikat albo podpowiedź |  |
| VOICE-04 | GM może zablokować albo odblokować mikrofon tylko komuś z własnego kanału głosowego (lista Kogo słyszysz). Mikrofon, który rozprawa zostawiła zablokowany (trialMuteLeft), odblokowuje się tylko po wejściu do kanału tego gracza; | minor | zły zamiar | poprawić |  |
| VOICE-05 | Przy przejęciu roli głównego nowy główny ma pustą pamięć głosu: pierwszy przebieg biegnie dopiero przy najbliższym ruchu tokenu albo po heartbeacie (do 60 s), a token stojący w polu drzwi albo na korytarzu ląduje w pokoju głównym ... | minor | zostaje / niejasny | bez zmian |  |
| VOICE-07 | Eclipse rozłącza wszystkich graczy naraz, a jego koniec łączy wszystkich naraz z różnymi pokojami. Na serwerze Forge to szczyt połączeń w jednej sekundzie. | minor | zostaje | bez zmian |  |
| PRIM-10 | Kroki rozprawy wykonywane u głównego (strefy, Objection kończone przez objectora, krok rundy) odrzucone w chwili zmiany głównego mówią "Tylko w trakcie Class Trial." w trakcie rozprawy. | nit | niejasny | komunikat albo podpowiedź |  |
| VOICE-06 | Reload strony gracza to dwa połączenia: najpierw pokój jednoosobowy (landAloneFirst), potem pokój od głównego. Gdy żaden GM nie jest połączony - pokój główny. | nit | zostaje | bez zmian |  |
| VOICE-08 | To samo konto w dwóch oknach (np. druga karta) - LiveKit rozłącza jedno z nich (DUPLICATE_IDENTITY); moduł z tym nie walczy, a karta każe przeładować, co z kolei wyrzuca drugie okno. | nit | zostaje | bez zmian |  |
| VOICE-09 | Napraw głos na drugim GM-ie: gdy główny nie ma LiveKit, komunikat to ogólne "Gra na to nie pozwoliła" (PRIM-07), a u głównego ten sam przypadek mówi jasno o braku LiveKit. | nit | niejasny | komunikat albo podpowiedź |  |

### Ze ślepych oczekiwań GM-ów (17)

| ID | Co się dzieje | Waga | Klasa | Co zrobić | Twoja uwaga |
| --- | --- | --- | --- | --- | --- |
| EXP-GM-05 | Na karcie decyzji nie widać, że inny GM już ją rozstrzyga. Drugi GM dowiaduje się dopiero po naciśnięciu, z odmowy. | minor | niejasny | komunikat albo podpowiedź |  |
| EXP-GM-06 | GM może ustawić akcje ucznia tylko od 0 do maksimum. Nagrodowej akcji ponad maksimum nie da się dać z interfejsu (jest grantFreeActions, ale bez przycisku). | minor | zły zamiar | poprawić |  |
| EXP-GM-07 | GM rzucający akcję za ucznia nie zostawia znaku "rzucił GM" na karcie ani w Osi czasu; drugi GM tego nie odróżni. | minor | niejasny | komunikat albo podpowiedź |  |
| EXP-GM-08 | Monokuma nie ma narzędzia "ogłoś": do szkoły zostaje czat Foundry, do jednego ucznia wątek, do pokoju tylko głos przez wejście tokenem. | minor | zły zamiar | poprawić |  |
| EXP-GM-09 | Lista kontrolna sezonu nie sprawdza, czy każdy gracz ma ucznia i czy każdy uczeń ma token na scenie szkoły. Karta o niedopasowanych kontach jest cichym szeptem w logu czatu. | minor | niejasny | komunikat albo podpowiedź |  |
| EXP-GM-10 | Remnant usunięty przez zabójcę znika ze sprawy razem z wierszem; w oknie Investigation nie ma śladu, co i kiedy usunięto. Zostaje tylko karta wyniku sprzątania w czacie. | minor | zły zamiar | poprawić |  |
| EXP-GM-11 | Truth Bullet z okna Daj trafia do jednego ucznia albo do wszystkich żyjących; wybranych kilku nie da się zaznaczyć (Autopsy da się). | minor | zły zamiar | poprawić |  |
| EXP-GM-12 | Zły werdykt robi sam: Reinforced Level Up Blackened, pytanie o nową zasadę i napełnienie każdej puli do 12. GM wybiera tylko, kto ginie. | minor | zły zamiar | poprawić |  |
| EXP-GM-13 | Cofnięcia nie pokazują przed wykonaniem, co cofną: lewa strzałka cofa od razu, Stan "Żyje" cofa śmierć po Zastosuj. Opis skutku przychodzi po fakcie. | minor | niejasny | komunikat albo podpowiedź |  |
| EXP-GM-14 | Drugi GM nie dostaje krótkiej informacji, co zmienił pierwszy (dany Truth Bullet, zmiana Stanu, ręczna korekta puli): szepty do GM-ów nie wyskakują, a Oś czasu zbiera tylko wątki i powiadomienia tej przeglądarki. | minor | niejasny | komunikat albo podpowiedź |  |
| EXP-GM-15 | Pula Despair jest jawna dla wszystkich, a rzut otwarcia morderstwa daje punkt Despair jak każdy rzut akcji. Przy świetle po Eclipse, gdy nikt inny nie rzuca, +1 w puli może powiedzieć stołowi, że ktoś rzucał otwarcie. | minor | niejasny | komunikat albo podpowiedź |  |
| EXP-GM-17 | Okno Uczniowie i panel nie pokazują pokoju ucznia ani tego, czy czeka na GM-a; to trzeba składać z mapy i Osi czasu. | minor | zły zamiar | poprawić |  |
| EXP-GM-16 | Wynik rzutu gracza dochodzi do GM-a jako szept w logu czatu, bez karty, a dymki czatu Foundry są ukryte; przy zwiniętym czacie GM ma tylko kości 3D. | nit | niejasny | komunikat albo podpowiedź |  |
| EXP-GM-18 | Po ogłoszeniu ciała faza zostaje Daily Life do Rozpocznij Investigation; to jeden krok więcej, wskazany w linii Dalej. | nit | zostaje | bez zmian |  |
| EXP-GM-19 | Wynik Search, Observe i niezauważenie w Tail liczy moduł z tabel i progów, nie GM. | nit | zostaje | bez zmian |  |
| EXP-GM-20 | Wspólnika nie oznacza GM; wspólnikiem staje się trzecia osoba incydentu z własnego wyboru w Stage 5. | nit | zostaje | bez zmian |  |
| EXP-GM-21 | Podsumowanie sprawy pokazuje dowody, dedukcje i rozwiązanie; nie ma w nim zgonów rozdziału ani przebiegu głosowania. | nit | zostaje | bez zmian |  |

### Ze ślepych oczekiwań graczy (13)

| ID | Co się dzieje | Waga | Klasa | Co zrobić | Twoja uwaga |
| --- | --- | --- | --- | --- | --- |
| EXP-PL-05 | Rany z incydentu widać wszystkim od razu: pasek Health na tokenie i Health na ocenzurowanym arkuszu, a plakietka Breakdown/Wounded na arkuszu każdemu, kto go otworzy. | minor | niejasny | komunikat albo podpowiedź |  |
| EXP-PL-06 | W Eclipse liczy się każde przejście, także powrót: pomyłka przy upuszczeniu tokenu i powrót zużywają oba przejścia | minor | niejasny | komunikat albo podpowiedź |  |
| EXP-PL-07 | Odmowa GM-a na zgłoszenie Direct Murder zabiera akcję | minor | zły zamiar | poprawić |  |
| EXP-PL-08 | GM zmienia nazwę, opis albo odczyt Remnantu, a kopie u graczy zmieniają się bez żadnej wiadomości | minor | niejasny | komunikat albo podpowiedź |  |
| EXP-PL-09 | Gracz nie ma żadnego miejsca na notatki tylko dla siebie: Notatka w komunikatorze czytają GM-owie, a dzienników gracz nie ma (pasek boczny ukryty) | minor | zły zamiar | poprawić |  |
| EXP-PL-10 | Widz (także gracz zmarłego ucznia) nie może odpowiedzieć GM-owi w komunikatorze | minor | zły zamiar | poprawić |  |
| EXP-PL-11 | Ani ogłoszenie ciała, ani start Investigation nie mówią graczowi, co zmienia nowa faza i kiedy się skończy; koniec śledztwa to przycisk GM-a bez zapowiedzi | minor | niejasny | komunikat albo podpowiedź |  |
| EXP-PL-13 | Nowy rozdział nie daje graczowi żadnej karty: co wyzerowano (Despair, odpoczynki, stany), co przeszło (rzeczy, Truth Bullety Faint) | minor | niejasny | komunikat albo podpowiedź |  |
| EXP-PL-14 | Nie ma prywatnej rozmowy dwóch osób w pokoju (głos pokoju słyszą wszyscy obecni, kanału tekstowego między graczami nie ma), a zabójca za "?" siedzi sam w cichym kanale i nie słyszy wspólnika | minor | zostaje | bez zmian |  |
| EXP-PL-15 | Konsola przeglądarki gracza odczytuje tajemnice, które interfejs ukrywa: do kogo należy token "?" i zasłonięty token, ukrytą śmierć (flaga ciała na tokenie), Sanity innych, rzeczy przy ciele | minor | zostaje | bez zmian |  |
| EXP-PL-16 | Karta do głosowania nie mówi, że oddanego głosu nie da się zmienić (drugi głos jest odrzucany jako już oddany) | nit | niejasny | komunikat albo podpowiedź |  |
| EXP-PL-17 | Karta Truth Bulletu nie mówi, czy ktoś inny ma kopię (np. znaleziona razem, podzielona, z Autopsy) | nit | niejasny | komunikat albo podpowiedź |  |
| EXP-PL-18 | Lista dowodów zabójcy zawiera rzeczy, których nie ma nikt inny (Truth Bullet z Misleading Trail i przeniesienia ciała, Remnanty własnego incydentu), więc zerknięcie na jego ekran przy streamie albo zrzucie coś mówi | nit | zostaje | bez zmian |  |

### Milczące kontrolki (z 68 sprawdzonych)

| ID | Co się dzieje | Waga | Klasa | Co zrobić | Twoja uwaga |
| --- | --- | --- | --- | --- | --- |
| CTL-03..CTL-30 | Węzeł mapy sprawy w konsoli Class Trial otwiera okno Investigation, ale nie ma podpowiedzi, a komentarz w kodzie twierdzi, że nic nie otwiera (22 przyciski, jedna sprawa). | minor | Niejasny | podpowiedź i poprawka komentarza |  |
| CTL-34, CTL-60 | "Usuń obrazek" w Room setup jest aktywny, gdy pokój nie ma obrazka. | nit | Niejasny | wyszarzyć przycisk |  |
