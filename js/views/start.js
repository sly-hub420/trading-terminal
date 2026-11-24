/* Start: przewodnik dla początkujących, kalkulator wielkości pozycji, słowniczek */
(function (TT) {
  "use strict";
  TT.views = TT.views || {};
  var E = TT.esc;

  var KINDS = {
    xxxusd: "Forex — para kończy się na USD (EURUSD, GBPUSD, AUDUSD)",
    usdxxx: "Forex — para zaczyna się od USD (USDJPY, USDCHF, USDCAD)",
    gold: "Złoto (XAUUSD / GOLD)",
    other: "Akcje, krypto, indeksy (np. AAPL, BTCUSDT)"
  };

  TT.views.start = {
    title: "Start",
    render: function (root) {
      var c = TT.local.get("calc", { bal: 100000, cur: "USD", fx: "", riskPct: 1, kind: "xxxusd", side: "long", entry: "", sl: "", tp: "" });
      root.innerHTML = '<div class="page"><div class="page-head"><h1>Start</h1><span class="sub">jak korzystać z terminala, kalkulator pozycji i słowniczek</span></div>' +
        '<div class="grid g2" style="align-items:start">' +
        (TT.sync.user() ? "" : '<div class="insight" style="grid-column:1/-1;display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin:0"><span style="flex:1;min-width:220px"><b>Zaloguj się</b> tym samym e-mailem co w Lodówce+, żeby mieć te same transakcje na komputerze i telefonie. Bez logowania dane zostają tylko w tej przeglądarce.</span><button class="btn primary" id="st-login">Zaloguj się</button></div>') +

        '<div class="card"><h3>Twój plan nauki — krok po kroku</h3><ol class="steps">' +
        "<li><b>Ćwicz na wirtualnych pieniądzach.</b> W TradingView otwórz panel handlu (na dole) → <i>Paper Trading</i>. Kupujesz i sprzedajesz jak naprawdę, ale bez ryzyka. " + TT.help("paper") + "</li>" +
        "<li><b>Przy każdej transakcji ustaw stop loss i take profit.</b> SL to bezpiecznik, TP to plan zysku. Zanim klikniesz BUY/SELL, policz w kalkulatorze obok, ile kupić, żeby przy SL stracić najwyżej 1% konta.</li>" +
        "<li><b>Zapisuj transakcje tutaj.</b> Najprościej raz w tygodniu: w TradingView wyeksportuj historię zleceń do CSV i wczytaj ją w <a href='#' data-go='settings'>Ustawieniach</a>. Albo dodawaj ręcznie przyciskiem <b>+</b> u góry. Dopisz jedno zdanie: dlaczego wszedłeś.</li>" +
        "<li><b>Raz w tygodniu zrób przegląd.</b> Zajrzyj do <a href='#' data-go='calendar'>Kalendarza</a> (które dni były złe?) i <a href='#' data-go='analytics'>Analityki</a>. Najważniejsze pytanie: czy średni zysk jest większy niż średnia strata?</li>" +
        "<li><b>Ćwicz na historii.</b> Przycisk <b>Replay</b> na górze odtwarza wykres świeca po świecy — możesz w kilka minut przećwiczyć kilkadziesiąt wejść z SL i TP. " + TT.help("replay") + "</li>" +
        "<li><b>Na prawdziwe pieniądze w XTB — dopiero gdy masz powód.</b> Dobra zasada: kilka miesięcy na paper tradingu z wynikiem na plusie i trzymaniem się SL. Potem zacznij od małej kwoty, której stratę zniesiesz spokojnie.</li>" +
        "</ol></div>" +

        '<div class="card"><h3>Kalkulator — ile kupić? ' + TT.help("risk") + '</h3>' +
        '<div class="form-grid">' +
        '<label class="field"><span>Saldo konta</span><input class="inp" data-c="bal" value="' + E(c.bal) + '"></label>' +
        '<label class="field"><span>Waluta konta</span><select class="inp" data-c="cur"><option' + (c.cur === "USD" ? " selected" : "") + '>USD</option><option' + (c.cur === "PLN" ? " selected" : "") + ">PLN</option></select></label>" +
        '<label class="field" data-pln><span>Kurs USD → PLN</span><input class="inp" data-c="fx" value="' + E(c.fx) + '" placeholder="pobieram kurs NBP…"></label>' +
        '<label class="field"><span>Ile % konta ryzykujesz</span><input class="inp" data-c="riskPct" value="' + E(c.riskPct) + '"></label>' +
        '<label class="field full"><span>Instrument</span><select class="inp" data-c="kind">' + Object.keys(KINDS).map(function (k) { return '<option value="' + k + '"' + (k === c.kind ? " selected" : "") + ">" + KINDS[k] + "</option>"; }).join("") + "</select></label>" +
        '<div class="field full"><span>Kierunek</span><div class="side-btns"><button type="button" class="buy' + (c.side === "long" ? " on" : "") + '" data-cs="long">BUY</button><button type="button" class="sell' + (c.side === "short" ? " on" : "") + '" data-cs="short">SELL</button></div></div>' +
        '<label class="field"><span>Cena wejścia</span><input class="inp" data-c="entry" value="' + E(c.entry) + '"></label>' +
        '<label class="field"><span>Stop loss ' + TT.help("sl") + '</span><input class="inp" data-c="sl" value="' + E(c.sl) + '"></label>' +
        '<label class="field"><span>Take profit (opcjonalnie)</span><input class="inp" data-c="tp" value="' + E(c.tp) + '"></label>' +
        "</div><div id='calc-out' style='margin-top:12px'></div></div>" +

        '<div class="card"><h3>Co gdzie jest</h3><dl class="gloss">' +
        place("chart", "Wykres", "Świece z Twoimi transakcjami: strzałka = wejście, kółko = wyjście. Kliknij transakcję na dole, żeby zobaczyć jej SL i TP.") +
        place("journal", "Dziennik", "Lista wszystkich transakcji z notatkami. Kliknij, żeby edytować.") +
        place("calendar", "Kalendarz", "Każdy dzień na zielono (zysk) albo czerwono (strata). Możesz dopisać notatkę dnia.") +
        place("analytics", "Analityka", "Twoje wyniki w liczbach, z wyjaśnieniem, co znaczą.") +
        place("econ", "Kalendarz ekonomiczny", "Kiedy wychodzą ważne dane (np. stopy procentowe). W tych minutach cena może gwałtownie skakać.") +
        place("ai", "Raporty AI", "Claude czyta Twój dziennik i mówi, co robisz dobrze, a co powtarzasz źle.") +
        "</dl></div>" +

        '<div class="card"><h3>Słowniczek</h3><dl class="gloss">' + Object.keys(TT.GLOSSARY).map(function (k) { var g = TT.GLOSSARY[k]; return "<dt>" + E(g[0]) + "</dt><dd>" + E(g[1]) + "</dd>"; }).join("") + "</dl></div>" +
        '<div class="note" style="grid-column:1/-1">Terminal pomaga uczyć się na własnych danych — nie mówi, co kupić ani sprzedać. Handel z dźwignią (forex, CFD w XTB) może szybko zabrać więcej, niż się wydaje; większość początkujących na nim traci. Dlatego najpierw paper trading i małe ryzyko.</div>' +
        "</div></div>";

      var lb = root.querySelector("#st-login"); if (lb) lb.onclick = TT.authModal;
      root.querySelectorAll("[data-go]").forEach(function (a) { a.onclick = function (e) { e.preventDefault(); TT.app.go(a.dataset.go); }; });
      root.querySelectorAll("[data-c]").forEach(function (i) { i.addEventListener("input", calc); i.addEventListener("change", calc); });
      root.querySelectorAll("[data-cs]").forEach(function (b) { b.onclick = function () { c.side = b.dataset.cs; root.querySelectorAll("[data-cs]").forEach(function (x) { x.classList.toggle("on", x === b); }); calc(); }; });
      calc();
      TT.fx.usdpln().then(function (r) {
        var i = root.querySelector('[data-c="fx"]'); if (!r || !i) return;
        i.placeholder = "kurs NBP " + r.date + ": " + r.rate.toFixed(4);
        if (!TT.num(i.value) || c.fxAuto) { i.value = r.rate.toFixed(4); c.fxAuto = true; calc(); }
        i.addEventListener("input", function () { c.fxAuto = false; });
      });

      function calc() {
        root.querySelectorAll("[data-c]").forEach(function (i) { c[i.dataset.c] = i.value; });
        TT.local.set("calc", c);
        root.querySelector("[data-pln]").style.display = c.cur === "PLN" ? "" : "none";
        var out = root.querySelector("#calc-out");
        var bal = TT.num(c.bal), pct = TT.num(c.riskPct), en = TT.num(c.entry), sl = TT.num(c.sl), tp = TT.num(c.tp), fx = c.cur === "PLN" ? TT.num(c.fx) : 1;
        if (!bal || !pct || en === null || sl === null) { out.innerHTML = '<div class="explain">Wpisz saldo, % ryzyka, cenę wejścia i stop loss — policzę, ile kupić.</div>'; return; }
        if (!fx) { out.innerHTML = '<div class="explain">Podaj kurs USD→PLN, bo instrumenty liczą się w dolarach.</div>'; return; }
        var warn = [];
        if (c.side === "long" && sl >= en) warn.push("Przy BUY stop loss musi być PONIŻEJ ceny wejścia.");
        if (c.side === "short" && sl <= en) warn.push("Przy SELL stop loss musi być POWYŻEJ ceny wejścia.");
        if (pct > 2) warn.push("Ryzyko powyżej 2% na transakcję to dużo — kilka strat z rzędu mocno uszczupli konto.");
        var dist = Math.abs(en - sl);
        if (!dist) { out.innerHTML = '<div class="explain" style="color:var(--orange)">Stop loss nie może być równy cenie wejścia.</div>'; return; }
        var riskAcc = bal * pct / 100, riskUsd = riskAcc / fx;
        var units = c.kind === "usdxxx" ? riskUsd * en / dist : riskUsd / dist;
        var rows = [["Maksymalna strata przy SL", TT.money(riskAcc, c.cur), "neg"]];
        if (c.kind === "xxxusd" || c.kind === "usdxxx") {
          var pip = c.kind === "usdxxx" && en > 20 ? 0.01 : 0.0001;
          rows.push(["Odległość do SL", (dist / pip).toFixed(1) + " pipsów", ""]);
          rows.push(["TradingView (ilość)", fmt(Math.floor(units)) + " jednostek", "pos"]);
          rows.push(["XTB (wolumen)", (Math.floor(units / 1000) / 100).toFixed(2) + " lota", "pos"]);
        } else if (c.kind === "gold") {
          rows.push(["TradingView (ilość)", fmt(Math.floor(units * 100) / 100) + " uncji", "pos"]);
          rows.push(["XTB (wolumen)", (Math.floor(units) / 100).toFixed(2) + " lota", "pos"]);
        } else {
          rows.push(["Ilość", fmt(units < 10 ? Math.floor(units * 1000) / 1000 : Math.floor(units)) + " szt.", "pos"]);
          rows.push(["Wartość pozycji", TT.money(units * en, "USD"), ""]);
        }
        if (tp !== null) {
          var rr = Math.abs(tp - en) / dist, ok = c.side === "long" ? tp > en : tp < en;
          if (!ok) warn.push("Take profit jest po złej stronie ceny wejścia.");
          else { rows.push(["Możliwy zysk przy TP", TT.money(riskAcc * rr, c.cur), "pos"]); rows.push(["Zysk do ryzyka", "1 : " + rr.toFixed(1), rr >= 1.5 ? "pos" : rr < 1 ? "neg" : ""]); }
        }
        out.innerHTML = rows.map(function (r) { return '<div class="kv"><span>' + r[0] + '</span><b class="' + r[2] + '">' + r[1] + "</b></div>"; }).join("") +
          (warn.length ? '<div class="explain" style="color:var(--orange)">⚠ ' + warn.join("<br>⚠ ") + "</div>" : "") +
          '<div class="explain">Wynik jest w przybliżeniu (bez spreadu i prowizji). W XTB sprawdź też wymagany depozyt przed otwarciem pozycji. ' + TT.help("lot") + "</div>";
      }
    }
  };
  function fmt(n) { return Number(n).toLocaleString("pl-PL"); }
  function place(view, name, text) { return '<dt><a href="#" data-go="' + view + '">' + name + "</a></dt><dd>" + text + "</dd>"; }
})(window.TT);
