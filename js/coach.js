/* „Trener”: moje zasady dnia, gotowość na XTB, newsy makro, kurs USD/PLN, checklista przed wejściem */
(function (TT) {
  "use strict";
  var E = TT.esc;

  /* ================= ZASADY ================= */
  var DEFAULT_RULES = { id: "rules", maxTradesDay: 3, maxLossesInRow: 2, maxDailyLossPct: 3, maxRiskPct: 1, minRR: 1.5, newsBufferMin: 30 };
  TT.rules = {
    get: function () { return Object.assign({}, DEFAULT_RULES, TT.store.get("rules") || {}); },
    save: function (r) { r.id = "rules"; TT.store.put("settings", r); },
    /* konto bazowe do liczenia % (wybrane konto albo pierwsze konto paper) */
    baseAccount: function () {
      var cur = TT.store.currentAccount();
      if (cur !== "all") return TT.store.account(cur);
      return TT.store.accounts().find(function (a) { return a.type === "paper"; }) || TT.store.accounts()[0];
    },
    balance: function (acc) {
      if (!acc) return null;
      return (+acc.startBalance || 0) + TT.store.trades({ accountId: acc.id }).reduce(function (s, t) { return s + (+t.pnl || 0); }, 0);
    },
    /* ocena jednego dnia (domyślnie dziś) */
    evalDay: function (day, trades) {
      var r = TT.rules.get();
      day = day || new Date();
      var from = new Date(day.getFullYear(), day.getMonth(), day.getDate()), to = new Date(from.getTime() + 86400000 - 1);
      var list = trades ? trades.filter(function (t) { var d = new Date(t.exitTime || t.entryTime); return d >= from && d <= to; }) : TT.store.trades({ from: from, to: to });
      var pnl = list.reduce(function (s, t) { return s + (+t.pnl || 0); }, 0);
      var streak = 0; for (var i = list.length - 1; i >= 0 && list[i].pnl < 0; i--) streak++;
      var acc = TT.rules.baseAccount(), bal = TT.rules.balance(acc) || 0;
      var startBal = bal - pnl, lossPct = startBal > 0 && pnl < 0 ? -pnl / startBal * 100 : 0;
      var breaches = [];
      if (r.maxTradesDay && list.length > r.maxTradesDay) breaches.push("więcej niż " + r.maxTradesDay + " transakcji");
      if (r.maxLossesInRow && streak >= r.maxLossesInRow) breaches.push(streak + " straty z rzędu");
      if (r.maxDailyLossPct && lossPct >= r.maxDailyLossPct) breaches.push("dzienna strata " + lossPct.toFixed(1) + "%");
      var stop = breaches.length > 0 || (r.maxTradesDay && list.length >= r.maxTradesDay);
      return { count: list.length, pnl: pnl, streak: streak, lossPct: lossPct, breaches: breaches, stop: stop, rules: r,
        reason: breaches.length ? "Złamana zasada: " + breaches.join(", ") : (stop ? "Wykorzystałeś limit " + r.maxTradesDay + " transakcji na dziś" : "") };
    },
    /* krótki status do panelu bocznego */
    statusHtml: function () {
      var e = TT.rules.evalDay(), r = e.rules;
      var cls = e.stop ? "bad" : e.count ? "ok" : "info";
      return '<div class="side-sec"><h4>Moje zasady — dziś <a href="#" onclick="TT.app.go(\'start\');return false" style="float:right;text-transform:none;letter-spacing:0">zmień</a></h4>' +
        (e.stop ? '<div class="note" style="color:var(--red);border-color:rgba(242,54,69,.4);margin-bottom:6px">⛔ ' + E(e.reason) + ". Na dziś koniec — wróć jutro z czystą głową.</div>" : "") +
        '<div class="kv"><span>Transakcje</span><b class="' + (e.count >= r.maxTradesDay ? "neg" : "") + '">' + e.count + " / " + r.maxTradesDay + "</b></div>" +
        '<div class="kv"><span>Straty z rzędu</span><b class="' + (e.streak >= r.maxLossesInRow ? "neg" : "") + '">' + e.streak + " / " + r.maxLossesInRow + "</b></div>" +
        '<div class="kv"><span>Strata dnia</span><b class="' + (e.lossPct >= r.maxDailyLossPct ? "neg" : "") + '">' + e.lossPct.toFixed(1) + "% / " + r.maxDailyLossPct + "%</b></div>" +
        '<button class="btn small primary" style="width:100%;justify-content:center;margin-top:8px" onclick="TT.precheck()">✓ Sprawdź przed wejściem</button>' +
        '<span class="badge ' + cls + '" style="display:none"></span></div>';
    }
  };

  /* ================= GOTOWOŚĆ NA XTB ================= */
  TT.readiness = function () {
    var paperIds = TT.store.accounts().filter(function (a) { return a.type === "paper"; }).map(function (a) { return a.id; });
    var trades = TT.store.all("trade").filter(function (t) { return paperIds.indexOf(t.accountId) >= 0 && !t.open; })
      .sort(function (a, b) { return new Date(a.exitTime || a.entryTime) - new Date(b.exitTime || b.entryTime); });
    var last = trades.slice(-50), s = TT.stats.compute(last);
    var days = trades.length ? (Date.now() - new Date(trades[0].exitTime || trades[0].entryTime)) / 86400000 : 0;
    var withSl = trades.length ? trades.filter(function (t) { return t.sl != null || t.risk; }).length / trades.length * 100 : 0;
    var acc = TT.store.accounts().find(function (a) { return a.type === "paper"; });
    var start = acc ? +acc.startBalance || 0 : 0;
    var ddPct = start ? s.maxDD / start * 100 : null;
    // dni ze złamanymi zasadami w ostatnich 30 dniach
    var since = Date.now() - 30 * 86400000, dayMap = {};
    trades.forEach(function (t) { var d = new Date(t.exitTime || t.entryTime); if (d.getTime() >= since) dayMap[TT.dayKey(d)] = d; });
    var bad = Object.keys(dayMap).filter(function (k) { return TT.rules.evalDay(dayMap[k], trades).breaches.length; }).length;
    var C = [
      { label: "Co najmniej 50 transakcji na paper", val: trades.length + " / 50", p: Math.min(1, trades.length / 50) },
      { label: "Co najmniej 2 miesiące praktyki", val: Math.floor(days) + " / 60 dni", p: Math.min(1, days / 60) },
      { label: "Stop loss zapisany w 90% transakcji", val: trades.length ? withSl.toFixed(0) + "%" : "—", p: trades.length < 10 ? 0 : Math.min(1, withSl / 90), hint: "Uzupełnij SL w dzienniku przy importowanych transakcjach." },
      { label: "Średni wynik na transakcję na plusie (ostatnie 50)", val: s.count ? TT.money(s.expectancy, acc ? acc.currency : "", { plus: true }) : "—", p: s.count && s.expectancy > 0 ? 1 : 0 },
      { label: "Profit factor min. 1,2 (ostatnie 50)", val: s.profitFactor === null ? "—" : s.profitFactor === Infinity ? "∞" : s.profitFactor.toFixed(2), p: s.profitFactor === null ? 0 : Math.min(1, s.profitFactor / 1.2) },
      { label: "Największy spadek max 10% konta", val: ddPct === null || !s.count ? "—" : ddPct.toFixed(1) + "%", p: trades.length < 10 || ddPct === null ? 0 : ddPct <= 10 ? 1 : Math.max(0, 1 - (ddPct - 10) / 10) },
      { label: "Max 2 dni ze złamanymi zasadami (30 dni)", val: trades.length ? bad + " dni" : "—", p: trades.length < 10 ? 0 : bad <= 2 ? 1 : 0 }
    ];
    C.forEach(function (c) { c.ok = c.p >= 1; });
    var done = C.filter(function (c) { return c.ok; }).length;
    return { criteria: C, done: done, total: C.length, pct: C.reduce(function (a, c) { return a + c.p; }, 0) / C.length * 100 };
  };
  TT.readinessHtml = function (compact) {
    var R = TT.readiness();
    var bar = '<div class="meter"><div class="top"><span class="muted">Spełnione warunki</span><b>' + R.done + " / " + R.total + '</b></div><div class="trk"><div class="fill" style="width:' + R.pct.toFixed(0) + "%;background:" + (R.done === R.total ? "var(--green)" : "var(--blue)") + '"></div></div></div>';
    if (compact) return '<div class="side-sec"><h4>Gotowość na XTB</h4>' + bar + "</div>";
    return bar + R.criteria.map(function (c) {
      return '<div class="kv" style="padding:5px 0"><span>' + (c.ok ? '<b class="pos">✓</b> ' : '<span class="muted">○</span> ') + E(c.label) + (c.hint && !c.ok ? '<br><span class="muted" style="font-size:11px">' + E(c.hint) + "</span>" : "") + '</span><b class="' + (c.ok ? "pos" : "") + '">' + E(c.val) + "</b></div>";
    }).join("") + (R.done === R.total ? '<div class="insight" style="margin-top:10px">Wszystkie warunki spełnione 🎉 Możesz rozważyć start w XTB — z małą kwotą i dalej z tymi samymi zasadami.</div>'
      : '<div class="explain">Warunki to dobra praktyka, nie gwarancja. Liczą się tylko konta typu „Paper / demo”.</div>');
  };

  /* ================= NEWSY MAKRO ================= */
  var CUR_OF = { XAU: "USD", XAG: "USD", GOLD: "USD", SILVER: "USD", US500: "USD", US100: "USD", US30: "USD", SPX: "USD", NDX: "USD", DJI: "USD", DE40: "EUR", DAX: "EUR", UK100: "GBP", JP225: "JPY", OIL: "USD", "OIL.WTI": "USD" };
  TT.news = {
    events: function () { var c = TT.local.get("news", null); return c ? c.events || [] : []; },
    load: async function (force) {
      var c = TT.local.get("news", null);
      if (!force && c && Date.now() - new Date(c.at).getTime() < 30 * 60000) return;
      var sb = TT.sync.client(); if (!sb || !TT.sync.user()) return;
      try {
        var r = await sb.functions.invoke("econ-news");
        if (r.error || !r.data || !r.data.events) return;
        TT.local.set("news", { at: new Date().toISOString(), events: r.data.events });
        TT.app && TT.app.renderSide(); TT.news.renderBanner();
      } catch (e) { /* brak sieci — zostają stare dane */ }
    },
    currencies: function (symbol) {
      var s = String(symbol || "").toUpperCase(); if (s.indexOf(":") >= 0) s = s.split(":")[1]; s = s.replace("/", "").replace(/\.(US|UK|DE|PL)$/, "");
      if (/^[A-Z]{6}$/.test(s)) return [s.slice(0, 3), s.slice(3)].map(function (c) { return c === "XAU" || c === "XAG" ? "USD" : c; });
      if (CUR_OF[s]) return [CUR_OF[s]];
      return ["USD"];
    },
    /* ważne wydarzenia dla symbolu w oknie [teraz - before, teraz + after] minut */
    forSymbol: function (symbol, afterMin, beforeMin) {
      var cur = TT.news.currencies(symbol), now = Date.now();
      return TT.news.events().filter(function (e) {
        var t = new Date(e.time).getTime();
        return e.impact === "High" && (cur.indexOf(e.currency) >= 0 || e.currency === "All") && t >= now - (beforeMin || 0) * 60000 && t <= now + afterMin * 60000;
      });
    },
    upcoming: function (hours) {
      var now = Date.now();
      return TT.news.events().filter(function (e) { var t = new Date(e.time).getTime(); return e.impact === "High" && t >= now - 15 * 60000 && t <= now + hours * 3600000; })
        .sort(function (a, b) { return new Date(a.time) - new Date(b.time); });
    },
    inMin: function (e) { var m = Math.round((new Date(e.time).getTime() - Date.now()) / 60000); return m >= 0 ? "za " + (m >= 60 ? Math.floor(m / 60) + " h " + (m % 60) + " min" : m + " min") : (-m) + " min temu"; },
    sideHtml: function () {
      if (!TT.sync.user()) return '<div class="side-sec"><h4>Ważne dane makro ' + TT.help("news") + '</h4><div class="muted" style="font-size:12px">Zaloguj się, żeby widzieć nadchodzące newsy.</div></div>';
      var list = TT.news.upcoming(24).slice(0, 6);
      return '<div class="side-sec"><h4>Ważne dane makro (24 h) ' + TT.help("news") + '</h4>' + (list.length ? list.map(function (e) {
        var near = Math.abs(new Date(e.time).getTime() - Date.now()) < 60 * 60000;
        return '<div class="kv" style="align-items:flex-start;gap:8px"><span><b class="' + (near ? "neg" : "") + '">' + E(e.currency) + "</b> " + E(e.title) + '</span><span class="muted" style="white-space:nowrap;font-size:11px">' + TT.pad(new Date(e.time).getHours()) + ":" + TT.pad(new Date(e.time).getMinutes()) + "<br>" + TT.news.inMin(e) + "</span></div>";
      }).join("") : '<div class="muted" style="font-size:12px">Brak ważnych publikacji w najbliższych 24 h.</div>') + "</div>";
    },
    renderBanner: function () {
      var el = document.getElementById("news-banner"); if (!el) return;
      var hits = TT.news.forSymbol(TT.chart.symbol, 60, 15);
      if (!hits.length) { el.classList.add("hidden"); return; }
      var e = hits[0];
      el.innerHTML = "⚠ <b>" + E(e.currency) + " — " + E(e.title) + "</b> " + TT.news.inMin(e) + ". Cena może gwałtownie skakać i omijać stop lossy — lepiej nie otwierać teraz pozycji.";
      el.classList.remove("hidden");
    }
  };
  setInterval(function () { TT.news.renderBanner(); }, 60000);

  /* ================= KURS USD/PLN (NBP) ================= */
  TT.fx = {
    usdpln: async function () {
      var c = TT.local.get("usdpln", null);
      if (c && c.day === TT.dayKey(new Date())) return c;
      try {
        var r = await fetch("https://api.nbp.pl/api/exchangerates/rates/a/usd/?format=json");
        var j = await r.json();
        c = { day: TT.dayKey(new Date()), rate: j.rates[0].mid, date: j.rates[0].effectiveDate };
        TT.local.set("usdpln", c);
      } catch (e) { /* offline — użyj starego */ }
      return c;
    }
  };

  /* ================= CHECKLISTA PRZED WEJŚCIEM ================= */
  function kindOf(symbol) {
    var s = String(symbol || "").toUpperCase(); if (s.indexOf(":") >= 0) s = s.split(":")[1];
    if (/^(XAU|GOLD)/.test(s)) return "gold";
    if (/^[A-Z]{6}$/.test(s) && /USD$/.test(s)) return "xxxusd";
    if (/^USD[A-Z]{3}$/.test(s)) return "usdxxx";
    return "other";
  }
  TT.precheck = function () {
    var acc = TT.rules.baseAccount(), r = TT.rules.get(), day = TT.rules.evalDay();
    var bal = TT.rules.balance(acc), cur = acc ? acc.currency : "USD";
    var lastPx = TT.chart.bars.length ? TT.chart.bars[TT.chart.bars.length - 1].close : "";
    var st = { side: "long" };
    var body = document.createElement("div");
    body.innerHTML =
      '<p class="muted" style="margin-top:0">Wypełnij to <b>zanim</b> klikniesz BUY/SELL w TradingView. Ilość policzę tak, żeby przy stop lossie stracić najwyżej <b>' + r.maxRiskPct + "%</b> konta (" + E(acc ? acc.name : "") + ", saldo " + TT.money(bal, cur) + ").</p>" +
      '<div class="form-grid">' +
      '<label class="field"><span>Symbol</span><input class="inp" name="symbol" value="' + E(TT.chart.symbol) + '" style="text-transform:uppercase"></label>' +
      '<div class="field"><span>Kierunek</span><div class="side-btns"><button type="button" class="buy on" data-s="long">BUY</button><button type="button" class="sell" data-s="short">SELL</button></div></div>' +
      '<label class="field"><span>Cena wejścia</span><input class="inp" name="entry" value="' + E(lastPx ? TT.price(lastPx) : "") + '"></label>' +
      '<label class="field"><span>Stop loss ' + TT.help("sl") + '</span><input class="inp" name="sl"></label>' +
      '<label class="field"><span>Take profit ' + TT.help("tp") + '</span><input class="inp" name="tp"></label>' +
      '<label class="field"><span>Ilość (puste = policzę za Ciebie)</span><input class="inp" name="qty"></label>' +
      '<label class="field full"><span>Dlaczego wchodzisz? (jedno zdanie)</span><input class="inp" name="reason" placeholder="np. odbicie od wsparcia z wczoraj, trend wzrostowy na 1h"></label>' +
      '<label class="field full" style="flex-direction:row;align-items:center;gap:8px;text-transform:none"><input type="checkbox" name="calm" style="width:16px;height:16px"> <span style="text-transform:none;letter-spacing:0;font-size:13px;color:var(--text)">Jestem spokojny — nie odgrywam się po stracie i nie wchodzę z nudów</span></label>' +
      "</div><div data-res style='margin-top:12px'></div>";
    var f = function (n) { return body.querySelector('[name="' + n + '"]'); };
    var result = null;
    function check() {
      var sym = f("symbol").value.trim().toUpperCase(), long = st.side === "long";
      var en = TT.num(f("entry").value), sl = TT.num(f("sl").value), tp = TT.num(f("tp").value), q = TT.num(f("qty").value);
      var items = [], kind = kindOf(sym), units = null, riskAmt = null, rr = null;
      var slOk = en !== null && sl !== null && (long ? sl < en : sl > en);
      items.push([slOk, "Stop loss ustawiony po właściwej stronie", sl === null ? "Wpisz stop loss." : slOk ? "" : (long ? "Przy BUY SL musi być poniżej wejścia." : "Przy SELL SL musi być powyżej wejścia.")]);
      if (slOk) {
        var dist = Math.abs(en - sl), riskTarget = bal * r.maxRiskPct / 100;
        var conv = function (amtQuote) { return TT.fxValue(sym, amtQuote, en).value; }; // w USD
        var perUnit = conv(dist);
        var rate = cur === "PLN" ? (TT.local.get("usdpln", {}).rate || null) : 1;
        if (rate) {
          units = q !== null ? q : Math.floor(riskTarget / rate / perUnit * 100) / 100;
          if (kind === "xxxusd" || kind === "usdxxx") units = q !== null ? q : Math.floor(riskTarget / rate / perUnit);
          riskAmt = units * perUnit * rate;
          var pct = bal ? riskAmt / bal * 100 : 0;
          items.push([pct <= r.maxRiskPct + 0.01, "Ryzyko max " + r.maxRiskPct + "% konta", "Przy SL stracisz " + TT.money(riskAmt, cur) + " (" + pct.toFixed(2) + "%)."]);
        } else items.push([false, "Ryzyko max " + r.maxRiskPct + "% konta", "Brak kursu USD/PLN — sprawdź internet."]);
      }
      if (slOk && tp !== null) {
        var tpOk = long ? tp > en : tp < en;
        rr = tpOk ? Math.abs(tp - en) / Math.abs(en - sl) : 0;
        items.push([tpOk && rr >= r.minRR, "Zysk do ryzyka min. 1 : " + r.minRR, tpOk ? "Masz 1 : " + rr.toFixed(1) + "." : "Take profit jest po złej stronie."]);
      } else items.push([false, "Take profit ustawiony (min. 1 : " + r.minRR + ")", "Wpisz take profit."]);
      var news = TT.news.forSymbol(sym, r.newsBufferMin, 10);
      if (TT.sync.user()) items.push([!news.length, "Brak ważnych newsów w ciągu " + r.newsBufferMin + " min", news.length ? news[0].currency + " — " + news[0].title + " " + TT.news.inMin(news[0]) + "." : ""]);
      else items.push([null, "Ważne newsy", "Zaloguj się, żebym mógł to sprawdzić — albo zajrzyj do Kalendarza ekonomicznego."]);
      items.push([!day.stop, "Zgodnie z moimi zasadami dnia", day.stop ? day.reason + "." : "Dziś " + day.count + "/" + r.maxTradesDay + " transakcji, " + day.streak + " strat z rzędu."]);
      items.push([f("reason").value.trim().length >= 10, "Wiem, dlaczego wchodzę", ""]);
      items.push([f("calm").checked, "Jestem spokojny", ""]);
      var ok = items.every(function (i) { return i[0] !== false; });
      var size = "";
      if (units !== null && slOk) {
        if (kind === "xxxusd" || kind === "usdxxx") size = "<b>" + Number(units).toLocaleString("pl-PL") + "</b> jednostek w TradingView = <b>" + (Math.floor(units / 1000) / 100).toFixed(2) + " lota</b> w XTB";
        else if (kind === "gold") size = "<b>" + units + " uncji</b> w TradingView = <b>" + (Math.floor(units) / 100).toFixed(2) + " lota</b> w XTB";
        else size = "<b>" + units + "</b> szt.";
      }
      body.querySelector("[data-res]").innerHTML =
        '<div style="border:1px solid var(--border-2);border-radius:6px;padding:8px 12px">' + items.map(function (i) {
          return '<div class="kv" style="padding:4px 0;align-items:flex-start"><span>' + (i[0] === true ? '<b class="pos">✓</b>' : i[0] === false ? '<b class="neg">✗</b>' : '<span class="muted">?</span>') + " " + E(i[1]) + (i[2] ? '<br><span class="muted" style="font-size:11px">' + E(i[2]) + "</span>" : "") + "</span></div>";
        }).join("") + "</div>" +
        (size ? '<div class="note" style="margin-top:8px;color:var(--text)">Ilość: ' + size + "</div>" : "") +
        '<div class="insight" style="margin-top:8px;margin-bottom:0;' + (ok ? "" : "background:var(--red-soft);border-color:rgba(242,54,69,.4)") + '">' +
        (ok ? "<b>✓ Wszystko OK — możesz wejść.</b> Pamiętaj, żeby w TradingView ustawić dokładnie ten SL i TP." : "<b>✗ Jeszcze nie wchodź.</b> Popraw punkty oznaczone ✗ — albo odpuść tę transakcję. Odpuszczenie słabej okazji to też dobra decyzja.") + "</div>";
      result = { ok: ok, symbol: sym, side: st.side, entry: en, sl: sl, tp: tp, qty: units, reason: f("reason").value.trim(), riskAmt: riskAmt, rr: rr };
    }
    body.querySelectorAll("[data-s]").forEach(function (b) { b.onclick = function () { st.side = b.dataset.s; body.querySelectorAll("[data-s]").forEach(function (x) { x.classList.toggle("on", x === b); }); check(); }; });
    body.addEventListener("input", check); body.addEventListener("change", check);
    TT.fx.usdpln().then(check);
    TT.modal({ title: "Checklista przed wejściem", body: body, wide: true, onOpen: check, foot: [
      { label: "Zamknij" },
      { label: "Odpuszczam tę transakcję", onClick: function () { if (result) TT.store.put("precheck", Object.assign({ time: new Date().toISOString(), decision: "skip" }, result), true); TT.toast("Zapisane — dobra decyzja też się liczy"); } },
      { label: "Wchodzę", cls: "primary", onClick: function () {
        if (!result || !result.ok) { TT.toast("Checklista nie jest zaliczona — popraw punkty z ✗", true); return false; }
        TT.store.put("precheck", Object.assign({ time: new Date().toISOString(), decision: "enter" }, result), true);
        TT.local.set("lastPrecheck", Object.assign({ at: Date.now() }, result));
        TT.toast("OK! Otwórz pozycję w TradingView z tym SL i TP. Po zamknięciu dodaj ją przyciskiem + (dane się podpowiedzą).");
      } }
    ] });
  };
})(window.TT);

/* Zrzuty ekranu: Ctrl+V w formularzu transakcji -> kompresja -> Supabase Storage (prywatny bucket) */
(function (TT) {
  "use strict";
  var BUCKET = "trading-shots", urlCache = {};
  function compress(file) {
    return new Promise(function (res, rej) {
      var img = new Image(), u = URL.createObjectURL(file);
      img.onload = function () {
        var s = Math.min(1, 1600 / Math.max(img.width, img.height)), c = document.createElement("canvas");
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(u);
        c.toBlob(function (b) { b ? res(b) : rej(new Error("Nie udało się przetworzyć obrazka")); }, "image/jpeg", 0.85);
      };
      img.onerror = function () { rej(new Error("To nie jest obrazek")); };
      img.src = u;
    });
  }
  TT.shots = {
    upload: async function (file) {
      var sb = TT.sync.client(), u = TT.sync.user();
      if (!sb || !u) throw new Error("Zaloguj się, żeby zapisywać zrzuty ekranu (trzymane są w chmurze).");
      var blob = await compress(file);
      var path = u.id + "/" + Date.now() + "-" + Math.random().toString(36).slice(2, 7) + ".jpg";
      var r = await sb.storage.from(BUCKET).upload(path, blob, { contentType: "image/jpeg", upsert: false });
      if (r.error) throw r.error;
      return "sb:" + path;
    },
    html: function (images) {
      return (images || []).map(function (u) {
        if (/^sb:/.test(u)) return '<a target="_blank" data-sbp="' + TT.esc(u.slice(3)) + '"><img class="shot" alt="" data-sbi="' + TT.esc(u.slice(3)) + '"></a>';
        return '<a href="' + TT.esc(u) + '" target="_blank"><img class="shot" src="' + TT.esc(TT.imageUrl(u)) + '" alt=""></a>';
      }).join("");
    },
    hydrate: async function (root) {
      var imgs = root.querySelectorAll("img[data-sbi]"); if (!imgs.length) return;
      var sb = TT.sync.client(); if (!sb || !TT.sync.user()) return;
      for (var i = 0; i < imgs.length; i++) {
        var p = imgs[i].dataset.sbi, c = urlCache[p];
        if (!c || c.exp < Date.now()) {
          var r = await sb.storage.from(BUCKET).createSignedUrl(p, 3600);
          if (r.error || !r.data) continue;
          c = urlCache[p] = { url: r.data.signedUrl, exp: Date.now() + 55 * 60000 };
        }
        imgs[i].src = c.url; imgs[i].parentNode.href = c.url;
      }
    },
    remove: function (images) {
      var sb = TT.sync.client(), paths = (images || []).filter(function (u) { return /^sb:/.test(u); }).map(function (u) { return u.slice(3); });
      if (sb && paths.length) sb.storage.from(BUCKET).remove(paths);
    }
  };
})(window.TT);
