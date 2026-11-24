/* Analityka: kafelki, krzywa kapitału, dzienny P/L, rozbicia */
(function (TT) {
  "use strict";
  TT.views = TT.views || {};
  var E = TT.esc;
  var period = TT.local.get("anPeriod", "all");
  var charts = [];
  var PERIODS = { "7": "7 dni", "30": "30 dni", "90": "90 dni", ytd: "Od początku roku", all: "Całość" };

  function range() {
    var n = new Date();
    if (period === "all") return {};
    if (period === "ytd") return { from: new Date(n.getFullYear(), 0, 1) };
    return { from: new Date(n.getTime() - (+period) * 86400000) };
  }

  TT.views.analytics = {
    title: "Analityka",
    destroy: function () { charts.forEach(function (c) { c.remove(); }); charts = []; },
    render: function (root) {
      TT.views.analytics.destroy();
      var acc = TT.store.currentAccount(), cur = TT.store.currencyOf(acc);
      var trades = TT.store.trades(range()), s = TT.stats.compute(trades);
      var M = function (v, o) { return TT.money(v, cur, o); };
      var h = '<div class="page"><div class="page-head"><h1>Analityka</h1><span class="sub">' + (acc === "all" ? "wszystkie konta (bez backtestu)" : E((TT.store.account(acc) || {}).name)) + '</span><span style="flex:1"></span><div class="seg" id="an-seg">' +
        Object.keys(PERIODS).map(function (k) { return '<button data-p="' + k + '" class="' + (k === period ? "active" : "") + '">' + PERIODS[k] + "</button>"; }).join("") + "</div></div>";
      if (!trades.length) { root.innerHTML = h + '<div class="empty">Brak transakcji w tym okresie.</div></div>'; bindSeg(root); return; }
      var beg = TT.beginner();
      h += insight(s, M);
      h += '<div class="tiles">' +
        tileX("Wynik", M(s.net, { plus: true }), TT.cls(s.net), "pnl", "Ile w sumie zarobiłeś/straciłeś w tym okresie.") +
        tileX("Skuteczność", TT.pct(s.winRate, 0), "", "winRate", s.wins + " wygranych, " + s.losses + " przegranych") +
        tileX("Średnia wygrana", s.avgWin ? M(s.avgWin) : "—", "pos", null, "Tyle średnio zarabiasz, gdy transakcja wychodzi.") +
        tileX("Średnia przegrana", s.avgLoss ? M(s.avgLoss) : "—", "neg", null, "Tyle średnio tracisz, gdy nie wychodzi.") +
        tileX("Największy spadek", M(-s.maxDD), "neg", "drawdown", "Najgorsza seria od szczytu do dołka.") +
        tileX("Średnio na transakcję", M(s.expectancy, { plus: true }), TT.cls(s.expectancy), "expectancy", "Na plusie = Twój sposób grania zarabia.") +
        "</div>" +
        '<details class="more" style="margin-bottom:12px"' + (beg ? "" : " open") + '><summary>Zaawansowane statystyki</summary><div class="tiles" style="margin-top:8px">' +
        TT.tile("Win rate", TT.pct(s.winRate, 1)) +
        TT.tile("Profit factor", s.profitFactor === Infinity ? "∞" : s.profitFactor === null ? "—" : s.profitFactor.toFixed(2)) +
        TT.tile("Oczekiwana wartość", M(s.expectancy, { plus: true }), TT.cls(s.expectancy)) +
        TT.tile("Śr. zysk / śr. strata", (s.avgWin ? M(s.avgWin) : "—") + ' <span class="muted" style="font-size:13px">/ ' + (s.avgLoss ? M(s.avgLoss) : "—") + "</span>") +
        TT.tile("Średni R", s.avgR === null ? "—" : s.avgR.toFixed(2) + "R", TT.cls(s.avgR)) +
        TT.tile("Max drawdown", M(-s.maxDD), "neg") +
        TT.tile("Transakcje", s.count + ' <span class="muted" style="font-size:13px">' + s.wins + "W / " + s.losses + "L</span>") +
        TT.tile("Seria W / L", s.maxWinStreak + " / " + s.maxLossStreak) +
        TT.tile("Dni handlowe", s.tradingDays + ' <span class="muted" style="font-size:13px">' + s.greenDays + " na plusie</span>") +
        TT.tile("Opłaty", M(s.fees)) +
        TT.tile("Śr. czas pozycji", s.avgHoldMin === null ? "—" : fmtMin(s.avgHoldMin)) +
        "</div></details>" +
        '<div class="grid g2" style="margin-bottom:12px"><div class="card"><h3>Jak rośnie (lub spada) Twoje konto</h3><div class="mini-chart" id="an-eq"></div><div class="explain">Linia w górę = zarabiasz. Im równiejsza, tym lepiej.</div></div><div class="card"><h3>Wynik każdego dnia</h3><div class="mini-chart" id="an-daily"></div><div class="explain">Zielony słupek = dzień na plusie, czerwony = na minusie.</div></div></div>' +
        '<h3 class="muted" style="font-size:12px;text-transform:uppercase;letter-spacing:.05em;margin:4px 0 8px">Gdzie zarabiasz, a gdzie tracisz</h3><div class="grid g3">' +
        bars("Wg symbolu", s.bySymbol, cur, 10) + bars("Wg setupu", s.bySetup, cur, 10) + bars("Wg dnia tygodnia", toMap(s.byWeekday, TT.WD), cur, 7, true) +
        bars("Wg godziny wejścia", hourMap(s.byHour), cur, 24, true) + bars("Błędy (koszt)", s.byMistake, cur, 10) +
        bars("Buy vs Sell", { "Buy": { net: s.longNet, n: s.longCount, w: s.longWins }, "Sell": { net: s.shortNet, n: s.shortCount, w: s.shortWins } }, cur, 2, true) +
        "</div></div>";
      root.innerHTML = h;
      bindSeg(root);
      drawCharts(root, s);
    }
  };
  function tileX(label, val, cls, helpKey, explain) {
    return '<div class="tile"><div class="lbl">' + label + (helpKey ? TT.help(helpKey) : "") + '</div><div class="val ' + (cls || "") + '">' + val + '</div><div class="hint">' + explain + "</div></div>";
  }
  /* podsumowanie „po ludzku” na podstawie liczb */
  function insight(s, M) {
    var out = [];
    out.push("Masz <b>" + s.count + "</b> transakcji: <b>" + s.wins + "</b> na plusie i <b>" + s.losses + "</b> na minusie (skuteczność <b>" + TT.pct(s.winRate, 0) + "</b>). Łącznie: <b class='" + TT.cls(s.net) + "'>" + M(s.net, { plus: true }) + "</b>.");
    if (s.avgWin && s.avgLoss) {
      var w = s.avgWin, l = Math.abs(s.avgLoss), need = l / (w + l) * 100;
      out.push("Na wygranej zarabiasz średnio <b class='pos'>" + M(w) + "</b>, a na przegranej tracisz <b class='neg'>" + M(l) + "</b>. " +
        (w < l ? "Straty są większe niż zyski — to częsty problem początkujących (za wcześnie zamknięte zyski, za długo trzymane straty). Pilnuj stop lossa i daj zyskom dojść do take profitu."
          : "Zyski są większe niż straty — to dobry znak, trzymaj się tego."));
      out.push("Przy takich kwotach, żeby wyjść na zero, wystarczy skuteczność <b>" + need.toFixed(0) + "%</b> — Ty masz <b>" + TT.pct(s.winRate, 0) + "</b>" + (s.winRate >= need ? ", więc jesteś nad kreską." : ", więc na razie jesteś pod kreską."));
    }
    var mis = Object.keys(s.byMistake).sort(function (a, b) { return s.byMistake[a].net - s.byMistake[b].net; })[0];
    if (mis && s.byMistake[mis].net < 0) out.push("Najdroższy błąd: <b>" + TT.esc(mis) + "</b> — kosztował <b class='neg'>" + M(s.byMistake[mis].net) + "</b>.");
    if (s.count < 20) out.push("<span class='muted'>To jeszcze mało transakcji (mniej niż 20) — wnioski traktuj ostrożnie.</span>");
    return '<div class="insight">' + out.join("<br>") + "</div>";
  }
  function bindSeg(root) {
    root.querySelectorAll("#an-seg button").forEach(function (b) { b.onclick = function () { period = b.dataset.p; TT.local.set("anPeriod", period); TT.views.analytics.render(root); }; });
  }
  function fmtMin(m) { if (m < 60) return Math.round(m) + " min"; if (m < 1440) return (m / 60).toFixed(1) + " h"; return (m / 1440).toFixed(1) + " dni"; }
  function toMap(arr, labels) { var o = {}; arr.forEach(function (v, i) { if (v.n) o[labels[i]] = v; }); return o; }
  function hourMap(h) { var o = {}; Object.keys(h).map(Number).sort(function (a, b) { return a - b; }).forEach(function (k) { o[TT.pad(k) + ":00"] = h[k]; }); return o; }

  function bars(title, map, cur, limit, keepOrder) {
    var keys = Object.keys(map);
    if (!keepOrder) keys.sort(function (a, b) { return Math.abs(map[b].net) - Math.abs(map[a].net); });
    keys = keys.slice(0, limit);
    var max = Math.max.apply(null, keys.map(function (k) { return Math.abs(map[k].net); }).concat([1]));
    return '<div class="card"><h3>' + title + '</h3><div class="bars">' + (keys.length ? keys.map(function (k) {
      var v = map[k], w = Math.abs(v.net) / max * 50;
      return '<div class="row"><span title="' + E(k) + '" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + E(k) + ' <span class="muted">' + v.n + '</span></span><div class="track"><div class="mid"></div><div class="bar" style="' +
        (v.net >= 0 ? "left:50%;width:" + w + "%;background:var(--green)" : "right:50%;width:" + w + "%;background:var(--red)") + '"></div></div><span class="r num ' + TT.cls(v.net) + '" style="text-align:right">' + TT.money(v.net, cur, { plus: true, dec: 0 }) + "</span></div>";
    }).join("") : '<div class="muted">Brak danych</div>') + "</div></div>";
  }

  function mk(el) {
    var c = LightweightCharts.createChart(el, {
      autoSize: true, layout: { background: { type: "solid", color: "#1e222d" }, textColor: "#b2b5be", fontSize: 11 },
      grid: { vertLines: { color: "rgba(42,46,57,0.5)" }, horzLines: { color: "rgba(42,46,57,0.5)" } },
      rightPriceScale: { borderColor: "#2a2e39" }, timeScale: { borderColor: "#2a2e39" }, handleScroll: false, handleScale: false,
      localization: { locale: "pl-PL" }
    });
    charts.push(c); return c;
  }
  function drawCharts(root, s) {
    var days = Object.keys(s.byDay).sort();
    var eq = 0, eqData = [], dData = [];
    days.forEach(function (k) {
      eq += s.byDay[k].net;
      eqData.push({ time: k, value: Math.round(eq * 100) / 100 });
      dData.push({ time: k, value: Math.round(s.byDay[k].net * 100) / 100, color: s.byDay[k].net >= 0 ? "#089981" : "#f23645" });
    });
    var c1 = mk(root.querySelector("#an-eq"));
    var base = c1.addBaselineSeries({ baseValue: { type: "price", price: 0 }, topLineColor: "#089981", topFillColor1: "rgba(8,153,129,0.28)", topFillColor2: "rgba(8,153,129,0.02)",
      bottomLineColor: "#f23645", bottomFillColor1: "rgba(242,54,69,0.02)", bottomFillColor2: "rgba(242,54,69,0.28)", lineWidth: 2 });
    base.setData(eqData); c1.timeScale().fitContent();
    var c2 = mk(root.querySelector("#an-daily"));
    var hist = c2.addHistogramSeries({ priceLineVisible: false });
    hist.setData(dData); c2.timeScale().fitContent();
  }
})(window.TT);
