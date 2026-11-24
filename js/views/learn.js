/* Nauka: gotowość na XTB, moje zasady, krótkie lekcje z ćwiczeniami w Replay */
(function (TT) {
  "use strict";
  TT.views = TT.views || {};
  var E = TT.esc;

  function replayTrades() { return TT.store.all("trade").filter(function (t) { return t.source === "replay"; }); }
  function prog(n, goal) { return { n: Math.min(n, goal), goal: goal, done: n >= goal }; }

  /* auto = funkcja zwracająca postęp ćwiczenia; bez auto — użytkownik zaznacza sam */
  var LESSONS = [
    { id: "candles", title: "1. Świeca — co mówi jeden słupek",
      text: "Każda świeca to jeden okres (np. 1 godzina). <b>Zielona</b>: cena na koniec była wyżej niż na początku. <b>Czerwona</b>: niżej. Gruba część to cena otwarcia i zamknięcia, cienkie „knoty” to najwyższa i najniższa cena w tym czasie. Długi knot oznacza, że cena tam dotarła, ale ją odepchnięto.",
      task: "Otwórz Wykres na EURUSD, interwał 1h. Najedź na 3 świece i odczytaj w lewym górnym rogu O (otwarcie), H (max), L (min), C (zamknięcie)." },
    { id: "trend", title: "2. Trend — w którą stronę idzie rynek",
      text: "Trend wzrostowy to coraz wyższe dołki i szczyty, spadkowy — coraz niższe. Najprostsza zasada dla początkującego: <b>graj z trendem</b> (w trendzie wzrostowym szukaj BUY, w spadkowym SELL). Pod prąd jest trudniej i częściej kończy się stratą.",
      task: "Na wykresie 4h wybierz narzędzie „Linia trendu” (lewy pasek) i połącz 2 kolejne dołki albo szczyty. Czy trend jest wzrostowy, spadkowy, czy go nie ma?" },
    { id: "levels", title: "3. Wsparcie i opór — gdzie cena się zatrzymuje",
      text: "<b>Wsparcie</b> to poziom, od którego cena już kilka razy odbiła w górę. <b>Opór</b> — od którego odbiła w dół. Ludzie pamiętają te ceny, więc często znów tam reagują. Gdy poziom zostanie przebity, bywa, że wsparcie zamienia się w opór (i odwrotnie).",
      task: "Narzędziem „Linia pozioma” zaznacz na wykresie 1h jedno wsparcie i jeden opór — miejsca, gdzie cena zawracała co najmniej 2 razy." },
    { id: "sl", title: "4. Stop loss — gdzie go postawić",
      text: "SL stawiasz tam, gdzie Twój pomysł okazuje się błędny — <b>nie</b> „o tyle, ile mi pasuje”. Przy BUY zwykle trochę poniżej wsparcia albo ostatniego dołka, przy SELL trochę powyżej oporu lub szczytu. Nigdy nie przesuwaj SL dalej, gdy cena idzie przeciw Tobie.",
      task: "Zrób 10 transakcji w Replay, każdą z ustawionym SL.",
      auto: function () { return prog(replayTrades().filter(function (t) { return t.sl != null; }).length, 10); } },
    { id: "rr", title: "5. Zysk do ryzyka — dlaczego TP ma być dalej niż SL",
      text: "Jeśli ryzykujesz 100 $, a celujesz w 200 $, to masz zysk do ryzyka 1:2. Wtedy wystarczy, że trafisz <b>co trzecią</b> transakcję, żeby wyjść na zero. Przy 1:0,5 musiałbyś wygrywać 2 z 3 — to bardzo trudne. Dlatego zasada: min. 1:1,5.",
      task: "Zrób 10 transakcji w Replay z TP co najmniej 1,5 raza dalej niż SL.",
      auto: function () { return prog(replayTrades().filter(function (t) { return t.sl != null && t.tp != null && Math.abs(t.tp - t.entry) >= 1.5 * Math.abs(t.entry - t.sl) - 1e-9; }).length, 10); } },
    { id: "size", title: "6. Wielkość pozycji — ryzykuj 1%, nie „ile wpadnie”",
      text: "Najpierw decydujesz, ile możesz stracić (np. 1% konta), potem wyznaczasz SL, a dopiero na końcu liczysz ilość. Bliski SL = większa ilość, daleki SL = mniejsza. Dzięki temu każda strata boli tak samo i 10 strat z rzędu nie zabiera konta.",
      task: "Na stronie Start wpisz w kalkulatorze swoje saldo, wejście i SL dla dowolnej pary. Potem użyj „Przed wejściem” (przycisk u góry) 3 razy.",
      auto: function () { return prog(TT.store.all("precheck").length, 3); } },
    { id: "news", title: "7. Newsy — kiedy lepiej nie handlować",
      text: "Przy ważnych danych (stopy procentowe, inflacja CPI, zatrudnienie NFP) cena potrafi w sekundę przeskoczyć o kilkadziesiąt pipsów, a SL może się wykonać po gorszej cenie (poślizg). Początkujący: <b>nie otwieraj pozycji 30 min przed i po</b> takich danych.",
      task: "Otwórz Kalendarz ekonomiczny, ustaw tylko ważne wydarzenia i znajdź najbliższe dane dla USD. O której są?" },
    { id: "psych", title: "8. Głowa — największy wróg to Ty sam",
      text: "Najczęstsze błędy: <b>odgrywanie się</b> po stracie (większa pozycja, „żeby odrobić”), wchodzenie z nudów, przesuwanie SL, zamykanie zysków za wcześnie ze strachu. Dlatego masz Moje zasady: po 2 stratach z rzędu — koniec na dziś. To nie kara, to ochrona konta.",
      task: "Odpuść przynajmniej 1 transakcję w „Przed wejściem” (przycisk „Odpuszczam”), gdy checklista nie przejdzie. Umiejętność niewchodzenia to połowa sukcesu.",
      auto: function () { return prog(TT.store.all("precheck").filter(function (p) { return p.decision === "skip"; }).length, 1); } }
  ];

  function lessonState() { return Object.assign({ id: "lessons", done: {} }, TT.store.get("lessons") || {}); }
  function isDone(l, st) { if (l.auto) return l.auto().done || !!st.done[l.id]; return !!st.done[l.id]; }
  TT.lessonsProgress = function () { var st = lessonState(); var d = LESSONS.filter(function (l) { return isDone(l, st); }).length; return { done: d, total: LESSONS.length }; };

  TT.views.learn = {
    render: function (root) {
      var r = TT.rules.get(), st = lessonState(), open = TT.local.get("lessonOpen", null);
      var lp = TT.lessonsProgress();
      if (!open) { var first = LESSONS.find(function (l) { return !isDone(l, st); }); open = first ? first.id : null; }
      var fields = [
        ["maxTradesDay", "Max transakcji dziennie", "Więcej = zwykle gorsze decyzje. Na start 2–3."],
        ["maxLossesInRow", "Stop po tylu stratach z rzędu", "Po tylu stratach kończysz na dziś. Na start 2."],
        ["maxDailyLossPct", "Max strata dziennie (% konta)", "Gdy przekroczysz — koniec na dziś."],
        ["maxRiskPct", "Max ryzyko na transakcję (% konta)", "Ile maksymalnie tracisz przy SL. Na start 1%."],
        ["minRR", "Minimalny zysk do ryzyka (1 : x)", "TP ma być co najmniej tyle razy dalej niż SL."],
        ["newsBufferMin", "Bez wejść przed ważnymi newsami (min)", "Ile minut przed danymi nie otwierasz pozycji."]
      ];
      root.innerHTML = '<div class="page"><div class="page-head"><h1>Nauka i zasady</h1><span class="sub">lekcje: ' + lp.done + " / " + lp.total + "</span></div>" +
        '<div class="grid g2" style="align-items:start">' +
        '<div class="card"><h3>Czy jestem gotowy na XTB?</h3>' + TT.readinessHtml(false) + "</div>" +
        '<div class="card"><h3>Moje zasady</h3><p class="explain" style="margin-top:0">Ustal je raz, na spokojnie. Terminal pilnuje ich za Ciebie: pokazuje ostrzeżenie w panelu po prawej i sprawdza je w „Przed wejściem”.</p><div class="form-grid">' +
        fields.map(function (f) { return '<label class="field"><span>' + f[1] + '</span><input class="inp" data-r="' + f[0] + '" value="' + E(r[f[0]]) + '"><small class="muted" style="font-size:11px">' + f[2] + "</small></label>"; }).join("") +
        '</div><div style="margin-top:10px;display:flex;gap:8px"><button class="btn primary" id="r-save">Zapisz zasady</button><button class="btn" id="r-check">Przed wejściem — sprawdź transakcję</button></div></div>' +
        '<div class="card" style="grid-column:1/-1"><h3>Lekcje (5 minut każda)</h3><div class="meter" style="margin-bottom:10px"><div class="trk"><div class="fill" style="width:' + (lp.done / lp.total * 100) + '%"></div></div></div>' +
        LESSONS.map(function (l) {
          var d = isDone(l, st), p = l.auto ? l.auto() : null;
          return '<details class="lesson"' + (open === l.id ? " open" : "") + ' data-l="' + l.id + '"><summary>' + (d ? '<b class="pos">✓</b> ' : '<span class="muted">○</span> ') + E(l.title) + (p ? ' <span class="muted" style="font-size:11px;margin-left:6px">' + p.n + "/" + p.goal + "</span>" : "") + "</summary>" +
            '<div class="lesson-body"><p>' + l.text + '</p><div class="note"><b>Ćwiczenie:</b> ' + E(l.task) + "</div>" +
            '<div style="margin-top:8px;display:flex;gap:8px;align-items:center">' +
            (l.id === "sl" || l.id === "rr" ? '<button class="btn small" data-replay>Otwórz Replay</button>' : "") +
            (l.id === "news" ? '<button class="btn small" data-goto="econ">Kalendarz ekonomiczny</button>' : "") +
            (l.id === "size" ? '<button class="btn small" data-goto="start">Kalkulator</button>' : "") +
            (l.id === "candles" || l.id === "trend" || l.id === "levels" ? '<button class="btn small" data-goto="chart">Otwórz wykres</button>' : "") +
            (l.auto ? '<span class="muted" style="font-size:12px">Zalicza się samo po wykonaniu ćwiczenia' + (p.done ? " ✓" : "") + "</span>"
              : '<button class="btn small' + (d ? "" : " primary") + '" data-done="' + l.id + '">' + (d ? "Cofnij zaliczenie" : "Zrobione ✓") + "</button>") +
            "</div></div></details>";
        }).join("") + "</div></div></div>";

      root.querySelector("#r-save").onclick = function () {
        var nr = TT.rules.get();
        root.querySelectorAll("[data-r]").forEach(function (i) { var v = TT.num(i.value); if (v !== null && v >= 0) nr[i.dataset.r] = v; });
        TT.rules.save(nr); TT.toast("Zasady zapisane");
      };
      root.querySelector("#r-check").onclick = TT.precheck;
      root.querySelectorAll("details.lesson").forEach(function (d) { d.addEventListener("toggle", function () { if (d.open) TT.local.set("lessonOpen", d.dataset.l); }); });
      root.querySelectorAll("[data-done]").forEach(function (b) { b.onclick = function () { var s = lessonState(); s.done[b.dataset.done] = !s.done[b.dataset.done]; TT.store.put("settings", s); }; });
      root.querySelectorAll("[data-goto]").forEach(function (b) { b.onclick = function () { TT.app.go(b.dataset.goto); }; });
      root.querySelectorAll("[data-replay]").forEach(function (b) { b.onclick = function () { TT.app.go("chart"); TT.chart.startReplay(); }; });
    }
  };
})(window.TT);
