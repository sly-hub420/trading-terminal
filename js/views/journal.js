/* Dziennik transakcji + formularz transakcji */
(function (TT) {
  "use strict";
  TT.views = TT.views || {};
  var E = TT.esc;

  /* ---------- formularz transakcji (używany w dzienniku i w modalu) ---------- */
  TT.tradeForm = function (trade, opts) {
    opts = opts || {};
    var t = Object.assign({ side: "long", tags: [], mistakes: [], images: [], rating: 0 }, trade || {});
    if (!t.accountId) { var cur = TT.store.currentAccount(); t.accountId = cur !== "all" ? cur : (TT.store.accounts()[0] || {}).id; }
    var st = TT.store.settings();
    var el = document.createElement("div");
    var accOpts = TT.store.accounts().map(function (a) { return '<option value="' + a.id + '"' + (a.id === t.accountId ? " selected" : "") + ">" + E(a.name) + " (" + a.currency + ")</option>"; }).join("");
    var setups = st.setups.slice(); if (t.setup && setups.indexOf(t.setup) < 0) setups.push(t.setup);
    function chips(list, sel, name) { return list.map(function (x) { return '<span class="chip' + (sel.indexOf(x) >= 0 ? " on" : "") + '" data-chip="' + name + '" data-v="' + E(x) + '">' + E(x) + "</span>"; }).join(""); }
    var H = TT.help, v = function (x) { return E(x == null ? "" : x); };
    if (!t.entryTime && !t.exitTime) t.entryTime = t.exitTime = new Date().toISOString();
    el.innerHTML =
      '<div class="form-grid">' +
      '<label class="field"><span>Konto</span><select class="inp" name="accountId">' + accOpts + "</select></label>" +
      '<label class="field"><span>Symbol (np. EURUSD, USDJPY, GOLD)</span><input class="inp" name="symbol" value="' + E(t.symbol || TT.chart.symbol) + '" style="text-transform:uppercase"></label>' +
      '<div class="field full"><span>Co zrobiłeś?</span><input type="hidden" name="side" value="' + t.side + '"><div class="side-btns">' +
      '<button type="button" class="buy' + (t.side === "long" ? " on" : "") + '" data-side="long">BUY — kupiłem (cena ma rosnąć)</button>' +
      '<button type="button" class="sell' + (t.side === "short" ? " on" : "") + '" data-side="short">SELL — sprzedałem (cena ma spadać)</button></div></div>' +
      '<label class="field"><span>Ilość ' + H("qty") + '</span><input class="inp" name="qty" value="' + v(t.qty) + '" placeholder="np. 10000 albo 0.1 lota"></label>' +
      '<label class="field"><span>Cena wejścia</span><input class="inp" name="entry" value="' + v(t.entry) + '" placeholder="po ile kupiłeś/sprzedałeś"></label>' +
      '<label class="field"><span>Stop loss ' + H("sl") + '</span><input class="inp" name="sl" value="' + v(t.sl) + '"></label>' +
      '<label class="field"><span>Take profit ' + H("tp") + '</span><input class="inp" name="tp" value="' + v(t.tp) + '"></label>' +
      '<div class="full" data-preview></div>' +
      '<label class="field"><span>Cena wyjścia (zamknięcia)</span><input class="inp" name="exit" value="' + v(t.exit) + '" placeholder="pusta = pozycja jeszcze otwarta"></label>' +
      '<label class="field"><span>Zysk / strata ' + H("pnl") + '</span><input class="inp" name="pnl" value="' + v(t.pnl) + '" style="font-weight:600" placeholder="liczy się samo z cen"></label>' +
      '<label class="field full"><span>Dlaczego wszedłem? Co poszło dobrze, co źle?</span><textarea class="inp" name="notes" placeholder="np. Cena odbiła od poziomu z wczoraj, ustawiłem SL pod dołkiem. Wyszedłem za wcześnie, bo się bałem.">' + E(t.notes || "") + "</textarea></label>" +
      "</div>" +
      '<details class="more"' + (TT.beginner() ? "" : " open") + '><summary>Więcej pól (opcjonalnie): czas, opłaty, setup, tagi, błędy, zrzuty ekranu</summary><div class="form-grid" style="margin-top:8px">' +
      '<label class="field"><span>Czas wejścia</span><input class="inp" type="datetime-local" name="entryTime" value="' + TT.toLocalInput(t.entryTime) + '"></label>' +
      '<label class="field"><span>Czas wyjścia</span><input class="inp" type="datetime-local" name="exitTime" value="' + TT.toLocalInput(t.exitTime) + '"></label>' +
      '<label class="field"><span>Ryzyko w kwocie ' + H("risk") + '</span><input class="inp" name="risk" value="' + v(t.risk) + '" placeholder="liczy się z SL, jeśli puste"></label>' +
      '<label class="field"><span>Opłaty / prowizja</span><input class="inp" name="fees" value="' + v(t.fees) + '"></label>' +
      '<label class="field"><span>Setup (rodzaj zagrania)</span><select class="inp" name="setup"><option value="">—</option>' + setups.map(function (s) { return '<option' + (s === t.setup ? " selected" : "") + ">" + E(s) + "</option>"; }).join("") + "</select></label>" +
      '<div class="field"><span>Jak oceniasz swoje wykonanie?</span><div class="stars">' + [1, 2, 3, 4, 5].map(function (i) { return '<button type="button" data-star="' + i + '" class="' + (i <= (t.rating || 0) ? "on" : "") + '">★</button>'; }).join("") + "</div></div>" +
      '<div class="field full"><span>Tagi</span><div>' + chips(st.tags, t.tags || [], "tags") + "</div></div>" +
      '<div class="field full"><span>Błędy, które popełniłem</span><div>' + chips(st.mistakes, t.mistakes || [], "mistakes") + "</div></div>" +
      '<div class="field full"><span>Zrzuty ekranu</span><div class="paste-zone" tabindex="0" data-paste>📋 Zrób zrzut (Win+Shift+S) i wciśnij <b>Ctrl+V</b> w tym oknie — albo <label class="link">wybierz plik<input type="file" accept="image/*" data-file hidden></label></div></div>' +
      '<div class="full" data-shots>' + TT.shots.html(t.images) + "</div>" +
      '<label class="field full"><span>Albo link ze snapshotu TradingView (po jednym w linii)</span><textarea class="inp" name="images" style="min-height:44px">' + E((t.images || []).join("\n")) + "</textarea></label>" +
      "</div></details>";
    TT.shots.hydrate(el);
    function addShot(file) {
      if (!file || !/^image\//.test(file.type)) return;
      var zone = el.querySelector("[data-paste]"); zone.classList.add("busy");
      TT.shots.upload(file).then(function (ref) {
        var ta = f("images"); ta.value = (ta.value.trim() ? ta.value.trim() + "\n" : "") + ref;
        var box = el.querySelector("[data-shots]"); box.innerHTML = TT.shots.html(ta.value.split(/\n/).map(function (x) { return x.trim(); }).filter(Boolean)); TT.shots.hydrate(box);
        TT.toast("Zrzut dodany — zapisz transakcję");
      }).catch(function (e) { TT.toast(e.message || String(e), true); }).finally(function () { zone.classList.remove("busy"); });
    }
    el.addEventListener("paste", function (e) {
      var items = (e.clipboardData || {}).items || [];
      for (var i = 0; i < items.length; i++) if (items[i].kind === "file" && /^image\//.test(items[i].type)) {
        e.preventDefault(); var d = el.querySelector("details.more"); if (d) d.open = true; addShot(items[i].getAsFile()); return;
      }
    });
    el.querySelector("[data-file]").onchange = function () { addShot(this.files[0]); this.value = ""; };
    var rating = t.rating || 0;
    el.querySelectorAll("[data-star]").forEach(function (b) {
      b.onclick = function () { rating = +b.dataset.star === rating ? 0 : +b.dataset.star; el.querySelectorAll("[data-star]").forEach(function (x) { x.classList.toggle("on", +x.dataset.star <= rating); }); };
    });
    el.querySelectorAll("[data-chip]").forEach(function (c) { c.onclick = function () { c.classList.toggle("on"); }; });
    var f = function (n) { return el.querySelector('[name="' + n + '"]'); };
    /* kierunek: duże przyciski BUY / SELL */
    el.querySelectorAll("[data-side]").forEach(function (b) {
      b.onclick = function () { f("side").value = b.dataset.side; el.querySelectorAll("[data-side]").forEach(function (x) { x.classList.toggle("on", x === b); }); recalc(true); };
    });
    /* podgląd na żywo: ile ryzykuję do SL, ile mogę zarobić do TP, wynik z ceny wyjścia */
    var pnlTouched = false;
    f("pnl").oninput = function () { pnlTouched = f("pnl").value.trim() !== ""; };
    ["qty", "entry", "exit", "sl", "tp", "symbol", "fees"].forEach(function (n) { f(n).addEventListener("input", function () { recalc(true); }); });
    function recalc(auto) {
      var box = el.querySelector("[data-preview]");
      var long = f("side").value === "long", q = TT.num(f("qty").value), en = TT.num(f("entry").value), sl = TT.num(f("sl").value), tp = TT.num(f("tp").value), ex = TT.num(f("exit").value);
      var sym = f("symbol").value, cur = /USD/.test(sym.toUpperCase()) ? "USD" : (TT.store.currencyOf(f("accountId").value) || "USD");
      var money = function (n) { var c = TT.fxValue(sym, n, en); return c.label ? TT.money(c.value, "", {}) + " " + c.label : TT.money(c.value, cur); };
      var warn = [], cells = [];
      if (en !== null && sl !== null) {
        if (long && sl >= en) warn.push("Przy BUY stop loss musi być PONIŻEJ ceny wejścia.");
        if (!long && sl <= en) warn.push("Przy SELL stop loss musi być POWYŻEJ ceny wejścia.");
      }
      if (en !== null && tp !== null) {
        if (long && tp <= en) warn.push("Przy BUY take profit musi być POWYŻEJ ceny wejścia.");
        if (!long && tp >= en) warn.push("Przy SELL take profit musi być PONIŻEJ ceny wejścia.");
      }
      var riskAmt = null, rewAmt = null;
      if (q !== null && en !== null && sl !== null) { riskAmt = Math.abs(en - sl) * q; cells.push('<div><div class="lbl">Stracisz, jeśli trafi SL</div><div class="val neg">−' + money(riskAmt) + "</div></div>"); }
      if (q !== null && en !== null && tp !== null) { rewAmt = Math.abs(tp - en) * q; cells.push('<div><div class="lbl">Zarobisz, jeśli trafi TP</div><div class="val pos">+' + money(rewAmt) + "</div></div>"); }
      if (riskAmt && rewAmt) { var rr = rewAmt / riskAmt; cells.push('<div><div class="lbl">Zysk do ryzyka ' + TT.help("rr") + '</div><div class="val ' + (rr >= 1.5 ? "pos" : rr < 1 ? "neg" : "") + '">1 : ' + rr.toFixed(1) + "</div></div>"); if (rr < 1) warn.push("Możesz zarobić mniej, niż ryzykujesz — przy takim układzie trzeba wygrywać bardzo często."); }
      if (en !== null && sl === null && !t.id) warn.push("Brak stop lossa — zawsze ustawiaj SL, zanim wejdziesz w transakcję.");
      box.innerHTML = (cells.length ? '<div class="preview-box">' + cells.join("") + "</div>" : "") + (warn.length ? '<div class="explain" style="color:var(--orange);margin-top:6px">⚠ ' + warn.join("<br>⚠ ") + "</div>" : "");
      if (auto && !pnlTouched && q !== null && en !== null && ex !== null) {
        var raw = (long ? ex - en : en - ex) * q;
        var conv = TT.fxValue(sym, raw, ex);
        f("pnl").value = Math.round((conv.value - (TT.num(f("fees").value) || 0)) * 100) / 100;
      }
    }
    recalc(false);
    el.read = function () {
      var out = Object.assign({}, t);
      out.accountId = f("accountId").value;
      out.symbol = f("symbol").value.trim().toUpperCase();
      out.side = f("side").value;
      ["qty", "entry", "exit", "sl", "tp", "risk", "fees", "pnl"].forEach(function (k) { out[k] = TT.num(f(k).value); });
      out.entryTime = TT.fromLocalInput(f("entryTime").value);
      out.exitTime = TT.fromLocalInput(f("exitTime").value) || out.entryTime;
      if (!out.entryTime) out.entryTime = out.exitTime;
      out.setup = f("setup").value;
      out.rating = rating;
      out.tags = [].map.call(el.querySelectorAll('[data-chip="tags"].on'), function (c) { return c.dataset.v; });
      out.mistakes = [].map.call(el.querySelectorAll('[data-chip="mistakes"].on'), function (c) { return c.dataset.v; });
      out.notes = f("notes").value;
      out.images = f("images").value.split(/\n/).map(function (s) { return s.trim(); }).filter(Boolean);
      if (!out.source) out.source = "manual";
      if (!out.symbol) return { error: "Podaj symbol" };
      if (!out.exitTime) return { error: "Podaj datę wejścia lub wyjścia" };
      if (out.pnl === null) {
        if (out.qty !== null && out.entry !== null && out.exit !== null) out.pnl = Math.round((TT.fxValue(out.symbol, (out.side === "long" ? out.exit - out.entry : out.entry - out.exit) * out.qty, out.exit).value - (out.fees || 0)) * 100) / 100;
        else return { error: "Podaj zysk/stratę albo ilość, cenę wejścia i cenę wyjścia" };
      }
      if (out.risk === null && out.qty !== null && out.entry !== null && out.sl !== null) out.risk = Math.round(TT.fxValue(out.symbol, Math.abs(out.entry - out.sl) * out.qty, out.entry).value * 100) / 100;
      return out;
    };
    return el;
  };

  TT.editTrade = function (trade) {
    var form = TT.tradeForm(trade);
    var foot = [{ label: "Anuluj" }];
    if (trade && trade.id) foot.unshift({ label: "Usuń", cls: "danger", onClick: function () { TT.shots.remove(trade.images); TT.store.remove(trade.id); TT.toast("Usunięto transakcję"); } });
    foot.push({ label: "Zapisz", cls: "primary", onClick: function () {
      var r = form.read(); if (r.error) { TT.toast(r.error, true); return false; }
      TT.store.put("trade", r); TT.toast("Zapisano transakcję");
    } });
    TT.modal({ title: trade && trade.id ? "Edytuj transakcję" : "Nowa transakcja", body: form, wide: true, foot: foot });
  };

  /* ---------- widok dziennika ---------- */
  var filt = { q: "", side: "", res: "", src: "" };
  var selId = null;
  TT.views.journal = {
    title: "Dziennik",
    render: function (root) {
      var acc = TT.store.currentAccount(), cur = TT.store.currencyOf(acc);
      var all = TT.store.trades().slice().reverse();
      var list = all.filter(function (t) {
        if (filt.q && (t.symbol + " " + (t.setup || "") + " " + (t.notes || "") + " " + (t.tags || []).join(" ")).toUpperCase().indexOf(filt.q.toUpperCase()) < 0) return false;
        if (filt.side && t.side !== filt.side) return false;
        if (filt.res === "win" && !(t.pnl > 0)) return false;
        if (filt.res === "loss" && !(t.pnl < 0)) return false;
        if (filt.src && t.source !== filt.src) return false;
        return true;
      });
      var s = TT.stats.compute(list.slice().reverse());
      if (selId && !list.some(function (t) { return t.id === selId; })) selId = null;
      if (!selId && list.length) selId = list[0].id;
      root.innerHTML =
        '<div class="page" style="display:flex;flex-direction:column">' +
        '<div class="page-head"><h1>Dziennik transakcji</h1><span class="sub">' + list.length + " transakcji · netto <b class='" + TT.cls(s.net) + "'>" + TT.money(s.net, cur, { plus: true }) + "</b> · win rate " + TT.pct(s.winRate, 0) + "</span>" +
        '<span class="spacer" style="flex:1"></span>' +
        '<input class="inp" id="j-q" placeholder="Szukaj: symbol, setup, tag, notatka" style="width:240px" value="' + E(filt.q) + '">' +
        '<select class="inp" id="j-side" style="width:110px"><option value="">Buy + Sell</option><option value="long">Tylko Buy</option><option value="short">Tylko Sell</option></select>' +
        '<select class="inp" id="j-res" style="width:120px"><option value="">Wszystkie</option><option value="win">Zyskowne</option><option value="loss">Stratne</option></select>' +
        '<select class="inp" id="j-src" style="width:130px"><option value="">Każde źródło</option><option value="manual">Ręczne</option><option value="tradingview">TradingView</option><option value="xtb">XTB</option><option value="replay">Replay</option><option value="legacy">P/L Ledger</option></select>' +
        '<button class="btn" onclick="TT.app.go(\'settings\')">Import</button><button class="btn primary" id="j-new">' + TT.icon("plus", 16) + " Nowa</button></div>" +
        '<div class="split" style="flex:1;min-height:0"><div class="list">' + table(list, cur) + '</div><div class="detail card" id="j-detail"></div></div></div>';
      ["side", "res", "src"].forEach(function (k) { var x = root.querySelector("#j-" + k); x.value = filt[k]; x.onchange = function () { filt[k] = x.value; TT.views.journal.render(root); }; });
      var q = root.querySelector("#j-q");
      q.oninput = function () { filt.q = q.value; clearTimeout(q._t); q._t = setTimeout(function () { TT.views.journal.render(root); var n = root.querySelector("#j-q"); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 250); };
      root.querySelector("#j-new").onclick = function () { TT.editTrade(null); };
      root.querySelectorAll("tbody tr").forEach(function (tr) {
        tr.onclick = function () { selId = tr.dataset.id; root.querySelectorAll("tbody tr").forEach(function (x) { x.classList.toggle("sel", x === tr); }); detail(root); };
        tr.ondblclick = function () { var t = TT.store.get(tr.dataset.id); if (t) TT.chart.showTrade(t); };
      });
      detail(root);
    }
  };

  function table(list, cur) {
    if (!list.length) return '<div class="empty">Brak transakcji. Zaimportuj historię z TradingView / XTB albo dodaj ręcznie.</div>';
    return '<table class="tv"><thead><tr><th>Data</th><th>Symbol</th><th>Typ</th><th class="r">Ilość</th><th class="r">Wejście</th><th class="r">Wyjście</th><th class="r">P/L</th><th class="r">R</th><th>Setup</th><th>Ocena</th></tr></thead><tbody>' +
      list.map(function (t) {
        var r = TT.stats.rMultiple(t), c = TT.store.currencyOf(t.accountId);
        return '<tr data-id="' + t.id + '"' + (t.id === selId ? ' class="sel"' : "") + "><td>" + TT.fmtDateTime(t.exitTime || t.entryTime) + "</td><td><b>" + E(t.symbol) + '</b></td><td><span class="side-tag ' + t.side + '">' + TT.sideLabel(t.side) + "</span></td>" +
          '<td class="r">' + (t.qty == null ? "—" : +t.qty) + '</td><td class="r">' + TT.price(t.entry) + '</td><td class="r">' + TT.price(t.exit) + '</td><td class="r ' + TT.cls(t.pnl) + '"><b>' + TT.money(t.pnl, c, { plus: true }) + "</b></td>" +
          '<td class="r ' + TT.cls(r) + '">' + (r === null ? "—" : r.toFixed(2) + "R") + "</td><td>" + E(t.setup || "") + '</td><td style="color:#ff9800">' + "★".repeat(t.rating || 0) + "</td></tr>";
      }).join("") + "</tbody></table>";
  }

  function detail(root) {
    var box = root.querySelector("#j-detail"), t = selId ? TT.store.get(selId) : null;
    if (!t) { box.innerHTML = '<div class="empty">Wybierz transakcję z listy</div>'; return; }
    var form = TT.tradeForm(t);
    box.innerHTML = '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px"><b style="font-size:15px;color:var(--text-strong)">' + E(t.symbol) + '</b><span class="side-tag ' + t.side + '">' + TT.sideLabel(t.side) + '</span><span class="' + TT.cls(t.pnl) + '" style="font-weight:600">' + TT.money(t.pnl, TT.store.currencyOf(t.accountId), { plus: true }) + '</span><span style="flex:1"></span><button class="btn small" data-chart>Pokaż na wykresie</button></div>';
    box.appendChild(form);
    var bar = document.createElement("div");
    bar.style.cssText = "display:flex;gap:8px;margin-top:12px";
    bar.innerHTML = '<button class="btn primary" data-save>Zapisz</button><span style="flex:1"></span><button class="btn danger" data-del>Usuń</button>';
    box.appendChild(bar);
    box.querySelector("[data-chart]").onclick = function () { TT.chart.showTrade(t); };
    bar.querySelector("[data-save]").onclick = function () { var r = form.read(); if (r.error) return TT.toast(r.error, true); TT.store.put("trade", r); TT.toast("Zapisano"); };
    bar.querySelector("[data-del]").onclick = function () { TT.confirm("Usunąć transakcję?", t.symbol + " " + TT.fmtDateTime(t.exitTime), function () { TT.store.remove(t.id); selId = null; }); };
  }
})(window.TT);
