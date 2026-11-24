/* Powłoka aplikacji: górny pasek, narzędzia, prawy panel, nawigacja, dolny panel */
(function (TT) {
  "use strict";
  var E = TT.esc;
  var RAIL = [
    ["start", "Start — instrukcja, kalkulator, słowniczek"], ["learn", "Nauka, moje zasady, gotowość na XTB"], ["chart", "Wykres"], ["live", "Wykres TradingView (Live)"], ["journal", "Dziennik"], ["calendar", "Kalendarz P/L"], ["analytics", "Analityka"],
    ["prop", "Prop firmy i konta"], ["econ", "Kalendarz ekonomiczny"], ["ai", "Raporty AI"], ["sep"], ["settings", "Ustawienia i import"]
  ];
  var TOOLS = [["cursor", "Kursor"], ["trend", "Linia trendu — kliknij 2 punkty na wykresie"], ["hline", "Linia pozioma — kliknij poziom ceny (np. wsparcie/opór)"], ["fib", "Zniesienie Fibonacciego"], ["measure", "Pomiar — kliknij 2 punkty"], ["sep"],
    ["undo", "Cofnij ostatni rysunek"], ["eraser", "Usuń wszystkie rysunki"], ["eye", "Pokaż/ukryj rysunki"], ["markers", "Pokaż/ukryj transakcje"]];
  var DEFAULT_WATCH = ["FX:EURUSD", "FX:USDJPY", "FX:GBPUSD", "OANDA:XAUUSD", "BINANCE:BTCUSDT", "BINANCE:ETHUSDT"];

  var A = TT.app = {
    view: TT.local.get("view", "start"),
    bottomTab: TT.local.get("bottomTab", "trades"),
    bottomScope: TT.local.get("bottomScope", "symbol"),

    go: function (view) {
      document.getElementById("side").classList.remove("m-open");
      if (A.view === "analytics" && view !== "analytics") TT.views.analytics.destroy();
      A.view = view; TT.local.set("view", view);
      var isChart = view === "chart";
      document.getElementById("view-chart").classList.toggle("hidden", !isChart);
      document.getElementById("view-page").classList.toggle("hidden", isChart);
      document.getElementById("workspace").classList.toggle("no-tools", !isChart);
      A.renderRail(); A.renderPage(); A.renderTopbar();
    },
    renderPage: function () {
      if (A.view === "chart") { A.renderBottom(); return; }
      var v = TT.views[A.view];
      var root = document.getElementById("view-page");
      if (v) v.render(root);
    },

    renderRail: function () {
      var beg = TT.beginner();
      document.getElementById("rail").innerHTML = RAIL.filter(function (r) { return !(beg && r[0] === "prop"); }).map(function (r) {
        if (r[0] === "sep") return '<div class="tool-sep" style="flex:1;background:none"></div>';
        return '<button class="rail-btn' + (A.view === r[0] ? " active" : "") + '" data-go="' + r[0] + '" data-tip="' + r[1] + '">' + TT.icon(r[0], 22) + "</button>";
      }).join("") + '<button class="rail-btn" id="side-toggle" data-tip="Panel boczny">' + TT.icon("side", 22) + "</button>";
      document.querySelectorAll("[data-go]").forEach(function (b) { b.onclick = function () { A.go(b.dataset.go); }; });
      document.getElementById("side-toggle").onclick = function () { var s = document.getElementById("side"); if (window.matchMedia("(max-width: 800px)").matches) { s.classList.remove("collapsed"); s.classList.toggle("m-open"); return; } s.classList.toggle("collapsed"); TT.local.set("sideCollapsed", s.classList.contains("collapsed")); };
    },

    renderTools: function () {
      var hidden = TT.local.get("hideDrawings", false);
      var beg = TT.beginner();
      document.getElementById("tools").innerHTML = TOOLS.filter(function (t) { return !(beg && (t[0] === "fib" || t[0] === "measure")); }).map(function (t) {
        if (t[0] === "sep") return '<div class="tool-sep"></div>';
        var on = TT.chart.tool === t[0] || (t[0] === "eye" && hidden) || (t[0] === "markers" && !TT.chart.showMarkers);
        var ic = t[0] === "markers" ? "target" : t[0] === "undo" ? "down" : t[0];
        return '<button class="tool-btn' + (on ? " active" : "") + '" data-tool="' + t[0] + '" data-tip="' + t[1] + '">' + TT.icon(ic, 22).replace(t[0] === "undo" ? "<svg" : "<svgx", '<svg style="transform:rotate(90deg)"') + "</button>";
      }).join("");
      document.querySelectorAll("[data-tool]").forEach(function (b) {
        b.onclick = function () {
          var t = b.dataset.tool;
          if (t === "eraser") { TT.confirm("Usunąć rysunki?", "Wszystkie rysunki na " + TT.chart.symbol + " zostaną usunięte.", TT.chart.clearDrawings); return; }
          if (t === "undo") { TT.chart.undoDrawing(); return; }
          if (t === "eye") { TT.local.set("hideDrawings", !hidden); TT.chart.renderDrawings(); A.renderTools(); return; }
          if (t === "markers") { TT.chart.showMarkers = !TT.chart.showMarkers; TT.chart.renderMarkers(); A.renderTools(); return; }
          TT.chart.setTool(t);
        };
      });
    },

    renderTopbar: function () {
      var tfb = document.getElementById("tf-buttons");
      tfb.innerHTML = Object.keys(TT.chart.TF).map(function (k) { return '<button class="tb-btn' + (k === TT.chart.tf ? " active" : "") + '" data-tf="' + k + '">' + TT.chart.TF[k].label + "</button>"; }).join("");
      tfb.querySelectorAll("[data-tf]").forEach(function (b) { b.onclick = function () { if (A.view !== "chart" && A.view !== "live") A.go("chart"); TT.chart.tf = b.dataset.tf; if (A.view === "live") { TT.local.set("tf", TT.chart.tf); A.renderPage(); A.renderTopbar(); } else TT.chart.load(null, b.dataset.tf); }; });
      var R = TT.chart.replay;
      document.getElementById("btn-replay").classList.toggle("active", R.active || R.picking);
      document.getElementById("btn-live").classList.toggle("active", A.view === "live");
      var sel = document.getElementById("account-select"), cur = TT.store.currentAccount();
      sel.innerHTML = '<option value="all">Wszystkie konta</option>' + TT.store.accounts().map(function (a) { return '<option value="' + a.id + '"' + (a.id === cur ? " selected" : "") + ">" + E(a.name) + "</option>"; }).join("");
      sel.value = cur;
      var u = TT.sync.user(), btn = document.getElementById("btn-auth");
      btn.textContent = u ? (u.email || "Konto").split("@")[0] : "Zaloguj";
      btn.className = u ? "tb-btn" : "tb-btn accent";
      if (u && !A._newsFor) { A._newsFor = u.id; TT.news.load(); }
    },

    renderSide: function () {
      var side = document.getElementById("side");
      var acc = TT.store.currentAccount(), cur = TT.store.currencyOf(acc);
      var watch = TT.local.get("watchlist", DEFAULT_WATCH);
      var traded = {}; TT.store.trades().slice(-200).forEach(function (t) { traded[t.symbol] = (traded[t.symbol] || 0) + t.pnl; });
      var n = new Date(), sod = new Date(n.getFullYear(), n.getMonth(), n.getDate()), sow = TT.startOfWeek(n), som = new Date(n.getFullYear(), n.getMonth(), 1);
      var sum = function (from) { return TT.store.trades({ from: from }).reduce(function (a, t) { return a + (+t.pnl || 0); }, 0); };
      var all = TT.store.trades(), s30 = TT.stats.compute(TT.store.trades({ from: new Date(n.getTime() - 30 * 86400000) }));
      var bal = null;
      if (acc !== "all") { var a = TT.store.account(acc); if (a) bal = (+a.startBalance || 0) + all.reduce(function (x, t) { return x + (+t.pnl || 0); }, 0); }
      var cn = TT.chart.norm(TT.chart.symbol);
      side.innerHTML = '<div class="side-head"><span>Lista obserwowanych</span><button class="icon-btn" id="wl-add" title="Dodaj symbol">' + TT.icon("plus", 16) + "</button></div>" +
        '<div class="side-body">' + watch.map(function (s) {
          var p = Object.keys(traded).filter(function (k) { return TT.chart.norm(k) === TT.chart.norm(s); }).reduce(function (a, k) { return a + traded[k]; }, 0);
          return '<div class="wl-row' + (TT.chart.norm(s) === cn ? " active" : "") + '" data-sym="' + E(s) + '"><span class="wl-sym">' + E(s.split(":").pop()) + ' <span class="muted" style="font-weight:400;font-size:11px">' + E(s.indexOf(":") > 0 ? s.split(":")[0] : "") + "</span></span>" +
            '<span class="num ' + TT.cls(p) + '" style="font-size:12px">' + (p ? TT.compact(p) : "") + '</span><button class="icon-btn" data-rm="' + E(s) + '" title="Usuń">' + TT.icon("close", 12) + "</button></div>";
        }).join("") +
        TT.rules.statusHtml() + TT.news.sideHtml() +
        '<div class="side-sec"><h4>' + (acc === "all" ? "Wszystkie konta" : E((TT.store.account(acc) || {}).name)) + "</h4>" +
        (bal !== null ? '<div class="kv"><span>Saldo</span><b>' + TT.money(bal, cur) + "</b></div>" : "") +
        '<div class="kv"><span>Dziś</span><b class="' + TT.cls(sum(sod)) + '">' + TT.money(sum(sod), cur, { plus: true }) + "</b></div>" +
        '<div class="kv"><span>Ten tydzień</span><b class="' + TT.cls(sum(sow)) + '">' + TT.money(sum(sow), cur, { plus: true }) + "</b></div>" +
        '<div class="kv"><span>Ten miesiąc</span><b class="' + TT.cls(sum(som)) + '">' + TT.money(sum(som), cur, { plus: true }) + "</b></div>" +
        '<div class="kv"><span>Win rate 30 dni</span><b>' + TT.pct(s30.winRate, 0) + "</b></div>" +
        '<div class="kv"><span>Profit factor 30 dni</span><b>' + (s30.profitFactor === null ? "—" : s30.profitFactor === Infinity ? "∞" : s30.profitFactor.toFixed(2)) + "</b></div></div>" +
        '<div class="side-sec"><h4>Ostatnie transakcje</h4>' + (all.slice(-8).reverse().map(function (t) {
          return '<div class="wl-row" data-trade="' + t.id + '" style="padding:5px 0;grid-template-columns:1fr auto"><span><b>' + E(t.symbol.split(":").pop()) + '</b> <span class="side-tag ' + t.side + '">' + TT.sideLabel(t.side) + '</span><br><span class="muted" style="font-size:11px">' + TT.fmtDateTime(t.exitTime) + '</span></span><span class="num ' + TT.cls(t.pnl) + '">' + TT.money(t.pnl, TT.store.currencyOf(t.accountId), { plus: true }) + "</span></div>";
        }).join("") || '<div class="muted">Brak transakcji</div>') + "</div>" + TT.readinessHtml(true) + "</div>";
      TT.news.renderBanner();
      side.querySelectorAll("[data-sym]").forEach(function (r) { r.onclick = function (e) { if (e.target.closest("[data-rm]")) return; if (A.view !== "chart") A.go("chart"); TT.chart.load(r.dataset.sym); }; });
      side.querySelectorAll("[data-rm]").forEach(function (b) { b.onclick = function () { TT.local.set("watchlist", watch.filter(function (x) { return x !== b.dataset.rm; })); A.renderSide(); }; });
      side.querySelectorAll("[data-trade]").forEach(function (r) { r.onclick = function () { var t = TT.store.get(r.dataset.trade); if (t) TT.chart.showTrade(t); }; });
      side.querySelector("#wl-add").onclick = function () {
        TT.modal({ title: "Dodaj do listy", body: '<label class="field"><span>Symbol (np. FX:EURUSD, OANDA:XAUUSD, BINANCE:SOLUSDT, AAPL)</span><input class="inp" id="wl-in" style="text-transform:uppercase"></label>',
          onOpen: function (m) { var i = m.el.querySelector("#wl-in"); i.value = TT.chart.symbol; setTimeout(function () { i.select(); }, 20); },
          foot: [{ label: "Anuluj" }, { label: "Dodaj", cls: "primary", onClick: function () { var v = document.getElementById("wl-in").value.trim().toUpperCase(); if (v && watch.indexOf(v) < 0) { watch.push(v); TT.local.set("watchlist", watch); A.renderSide(); } } }] });
      };
    },

    renderBottom: function () {
      var tabs = document.getElementById("bp-tabs"), body = document.getElementById("bp-body"), bottom = document.getElementById("bottom");
      var collapsed = TT.local.get("bottomCollapsed", false);
      bottom.classList.toggle("collapsed", collapsed);
      tabs.innerHTML = [["trades", "Lista transakcji"], ["summary", "Podsumowanie wyników"]].map(function (t) { return '<button class="bp-tab' + (A.bottomTab === t[0] ? " active" : "") + '" data-bt="' + t[0] + '">' + t[1] + "</button>"; }).join("") +
        '<span style="flex:1"></span>' + (A.bottomTab === "trades" ? '<div class="seg"><button data-sc="symbol" class="' + (A.bottomScope === "symbol" ? "active" : "") + '">Ten symbol</button><button data-sc="all" class="' + (A.bottomScope === "all" ? "active" : "") + '">Wszystkie</button></div>' : "") +
        '<button class="icon-btn" id="bp-col" title="Zwiń/rozwiń">' + TT.icon(collapsed ? "up" : "down", 16) + "</button>";
      tabs.querySelectorAll("[data-bt]").forEach(function (b) { b.onclick = function () { A.bottomTab = b.dataset.bt; TT.local.set("bottomTab", A.bottomTab); if (collapsed) TT.local.set("bottomCollapsed", false); A.renderBottom(); }; });
      tabs.querySelectorAll("[data-sc]").forEach(function (b) { b.onclick = function () { A.bottomScope = b.dataset.sc; TT.local.set("bottomScope", A.bottomScope); A.renderBottom(); }; });
      tabs.querySelector("#bp-col").onclick = function () { TT.local.set("bottomCollapsed", !collapsed); A.renderBottom(); };
      if (collapsed) { body.innerHTML = ""; return; }
      var list = A.bottomScope === "symbol" ? TT.chart.symbolTrades() : TT.store.trades();
      if (A.bottomTab === "summary") {
        var s = TT.stats.compute(list), cur = TT.store.currencyOf(TT.store.currentAccount());
        body.innerHTML = '<div style="padding:12px"><div class="tiles">' + TT.tile("Wynik netto", TT.money(s.net, cur, { plus: true }), TT.cls(s.net)) + TT.tile("Transakcje", s.count) + TT.tile("Win rate", TT.pct(s.winRate, 1)) +
          TT.tile("Profit factor", s.profitFactor === null ? "—" : s.profitFactor === Infinity ? "∞" : s.profitFactor.toFixed(2)) + TT.tile("Max drawdown", TT.money(-s.maxDD, cur), "neg") + TT.tile("Średni R", s.avgR === null ? "—" : s.avgR.toFixed(2) + "R") + "</div></div>";
        return;
      }
      list = list.slice().reverse();
      if (!list.length) { body.innerHTML = '<div class="empty">Brak transakcji' + (A.bottomScope === "symbol" ? " na " + E(TT.chart.symbol) : "") + ". Dodaj ręcznie (+ u góry) albo zaimportuj w Ustawieniach.</div>"; return; }
      body.innerHTML = '<table class="tv"><thead><tr><th>#</th><th>Typ</th><th>Symbol</th><th>Wejście</th><th class="r">Cena</th><th>Wyjście</th><th class="r">Cena</th><th class="r">Ilość</th><th class="r">P/L</th><th class="r">R</th><th>Setup</th><th>Konto</th></tr></thead><tbody>' +
        list.map(function (t, i) {
          var r = TT.stats.rMultiple(t), a = TT.store.account(t.accountId) || {};
          return '<tr data-id="' + t.id + '"' + (t.id === TT.chart.selectedTradeId ? ' class="sel"' : "") + '><td class="muted">' + (list.length - i) + '</td><td><span class="side-tag ' + t.side + '">' + TT.sideLabel(t.side) + "</span></td><td><b>" + E(t.symbol) + "</b></td><td>" + TT.fmtDateTime(t.entryTime) + '</td><td class="r">' + TT.price(t.entry) + "</td><td>" + TT.fmtDateTime(t.exitTime) + '</td><td class="r">' + TT.price(t.exit) +
            '</td><td class="r">' + (t.qty == null ? "—" : +t.qty) + '</td><td class="r ' + TT.cls(t.pnl) + '"><b>' + TT.money(t.pnl, a.currency, { plus: true }) + '</b></td><td class="r">' + (r === null ? "—" : r.toFixed(2)) + "</td><td>" + E(t.setup || "") + '</td><td class="muted">' + E(a.name || "") + "</td></tr>";
        }).join("") + "</tbody></table>";
      body.querySelectorAll("tr[data-id]").forEach(function (tr) {
        tr.onclick = function () {
          var t = TT.store.get(tr.dataset.id);
          if (TT.chart.norm(t.symbol) === TT.chart.norm(TT.chart.symbol) && !TT.chart.replay.active) {
            TT.chart.selectedTradeId = t.id; TT.chart.renderMarkers(); TT.chart.renderTradeLines();
            var et = Date.parse(t.entryTime) / 1000, xt = Date.parse(t.exitTime) / 1000, pad = TT.chart.TF[TT.chart.tf].sec * 50;
            var firstBar = TT.chart.bars[0];
            if (firstBar && et >= firstBar.time) TT.chart.chart.timeScale().setVisibleRange({ from: TT.chart.shift(et - pad), to: TT.chart.shift(xt + pad) });
            else TT.chart.showTrade(t);
            A.renderBottom();
          } else TT.chart.showTrade(t);
        };
        tr.ondblclick = function () { TT.editTrade(TT.store.get(tr.dataset.id)); };
      });
    }
  };

  /* ---------- start ---------- */
  function boot() {
    TT.store.ensureDefaults();
    if (TT.local.get("sideCollapsed", false)) document.getElementById("side").classList.add("collapsed");
    TT.chart.init(document.getElementById("chart"));
    A.renderRail(); A.renderTools(); A.renderTopbar(); A.renderSide();
    A.go(A.view);
    TT.chart.load(TT.chart.symbol, TT.chart.tf);

    var si = document.getElementById("symbol-input");
    si.value = TT.chart.symbol;
    si.onkeydown = function (e) { if (e.key === "Enter") { si.blur(); if (A.view !== "chart" && A.view !== "live") A.go("chart"); if (A.view === "live") { TT.chart.symbol = si.value.toUpperCase().trim(); TT.local.set("symbol", TT.chart.symbol); A.renderPage(); } else TT.chart.load(si.value); } };
    si.onfocus = function () { si.select(); };
    document.getElementById("account-select").onchange = function () { TT.store.setCurrentAccount(this.value); };
    document.getElementById("btn-new-trade").onclick = function () {
      var p = TT.local.get("lastPrecheck", null);
      if (p && p.at && Date.now() - p.at < 12 * 3600000) { TT.local.set("lastPrecheck", null); TT.editTrade({ symbol: p.symbol, side: p.side, qty: p.qty, entry: p.entry, sl: p.sl, tp: p.tp, risk: p.riskAmt ? Math.round(p.riskAmt * 100) / 100 : null, notes: p.reason }); }
      else TT.editTrade(null);
    };
    document.getElementById("btn-check").onclick = TT.precheck;
    document.getElementById("btn-auth").onclick = TT.authModal;
    document.getElementById("btn-replay").onclick = function () { if (A.view !== "chart") A.go("chart"); TT.chart.startReplay(); };
    document.getElementById("btn-live").onclick = function () { A.go(A.view === "live" ? "chart" : "live"); };

    TT.sync.onStatus(function (st, err) {
      var b = document.getElementById("sync-badge");
      var map = { local: ["", "Lokalnie"], ok: ["ok", "Zsynchronizowano"], busy: ["busy", "Synchronizacja…"], err: ["err", "Błąd sync"] };
      b.querySelector(".sync-dot").className = "sync-dot " + map[st][0];
      b.querySelector(".txt").textContent = map[st][1];
      b.title = err || "";
    });

    var rerender = null;
    TT.store.onChange(function (reason) {
      clearTimeout(rerender);
      rerender = setTimeout(function () {
        A.renderTopbar(); A.renderSide();
        if (A.view === "chart") { A.renderBottom(); TT.chart.renderMarkers(); TT.chart.renderTradeLines(); if (reason === "remote") TT.chart.renderDrawings(); }
        else if (A.view !== "live" && A.view !== "econ") A.renderPage();
      }, 30);
    });

    document.addEventListener("keydown", function (e) {
      if (e.target.matches("input, textarea, select")) return;
      var R = TT.chart.replay;
      if (R.active && e.key === "ArrowRight") { e.preventDefault(); TT.chart.stepReplay(); }
      else if (R.active && e.key === " ") { e.preventDefault(); TT.chart.togglePlay(); }
      else if (e.key === "Escape") TT.chart.setTool("cursor");
      else if (e.altKey && e.key.toLowerCase() === "h") TT.chart.setTool("hline");
      else if (e.altKey && e.key.toLowerCase() === "t") TT.chart.setTool("trend");
      else if (e.altKey && e.key.toLowerCase() === "f") TT.chart.setTool("fib");
    });

    TT.sync.init();
    setTimeout(function () { TT.news.load(); }, 2500);
    setInterval(function () { TT.news.load(); }, 30 * 60000);
    TT.fx.usdpln();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})(window.TT);
