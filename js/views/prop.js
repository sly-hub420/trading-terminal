/* Konta (w tym prop firmy): edytor konta, reguły, wypłaty, koszty */
(function (TT) {
  "use strict";
  TT.views = TT.views || {};
  var E = TT.esc;
  var TYPES = { paper: "Paper / demo", live: "Realne konto", prop: "Prop firma", backtest: "Backtest / replay" };

  TT.editAccount = function (acc, presetType) {
    var a = Object.assign({ type: presetType || "paper", currency: "USD", startBalance: 10000, prop: {}, payouts: [] }, acc || {});
    var p = a.prop || {};
    var body = document.createElement("div");
    function f(n) { return body.querySelector('[name="' + n + '"]'); }
    body.innerHTML =
      '<div class="form-grid">' +
      '<label class="field"><span>Nazwa</span><input class="inp" name="name" value="' + E(a.name || "") + '" placeholder="np. XTB Real, FTMO 100k"></label>' +
      '<label class="field"><span>Typ</span><select class="inp" name="type">' + Object.keys(TYPES).map(function (k) { return '<option value="' + k + '"' + (k === a.type ? " selected" : "") + ">" + TYPES[k] + "</option>"; }).join("") + "</select></label>" +
      '<label class="field"><span>Broker / firma</span><input class="inp" name="broker" value="' + E(a.broker || "") + '" placeholder="XTB, TradingView, FTMO…"></label>' +
      '<label class="field"><span>Waluta konta</span><select class="inp" name="currency">' + ["USD", "PLN", "EUR", "GBP"].map(function (c) { return "<option" + (c === a.currency ? " selected" : "") + ">" + c + "</option>"; }).join("") + "</select></label>" +
      '<label class="field"><span>Saldo początkowe</span><input class="inp" name="startBalance" value="' + E(a.startBalance) + '"></label><div></div>' +
      '<div class="full" data-prop><div class="note" style="margin-bottom:10px">Reguły prop firmy — kwoty w walucie konta albo procent salda początkowego (np. <b>10%</b>).</div><div class="form-grid">' +
      '<label class="field"><span>Etap</span><select class="inp" name="phase">' + [["challenge", "Challenge (faza 1)"], ["verification", "Weryfikacja (faza 2)"], ["funded", "Konto finansowane"]].map(function (o) { return '<option value="' + o[0] + '"' + (p.phase === o[0] ? " selected" : "") + ">" + o[1] + "</option>"; }).join("") + "</select></label>" +
      '<label class="field"><span>Cel zysku</span><input class="inp" name="target" value="' + E(p.target || "") + '" placeholder="10%"></label>' +
      '<label class="field"><span>Dzienny limit straty</span><input class="inp" name="dailyLoss" value="' + E(p.dailyLoss || "") + '" placeholder="5%"></label>' +
      '<label class="field"><span>Maksymalny drawdown</span><input class="inp" name="maxDD" value="' + E(p.maxDD || "") + '" placeholder="10%"></label>' +
      '<label class="field"><span>Typ drawdownu</span><select class="inp" name="ddType"><option value="static"' + (p.ddType !== "trailing" ? " selected" : "") + '>Statyczny (od salda początkowego)</option><option value="trailing"' + (p.ddType === "trailing" ? " selected" : "") + ">Trailing (od szczytu)</option></select></label>" +
      '<label class="field"><span>Min. dni handlowych</span><input class="inp" name="minDays" value="' + E(p.minDays || "") + '" placeholder="4"></label>' +
      '<label class="field"><span>Podział zysku (profit split) %</span><input class="inp" name="split" value="' + E(p.split || "") + '" placeholder="80"></label>' +
      '<label class="field"><span>Limit wypłaty (na cykl)</span><input class="inp" name="payoutLimit" value="' + E(p.payoutLimit || "") + '"></label>' +
      '<label class="field"><span>Opłata za challenge</span><input class="inp" name="fee" value="' + E(p.fee || "") + '"></label>' +
      '<label class="field"><span>Data zakupu</span><input class="inp" type="date" name="bought" value="' + E(p.bought || "") + '"></label>' +
      "</div></div></div>";
    function toggle() { body.querySelector("[data-prop]").style.display = f("type").value === "prop" ? "" : "none"; }
    f("type").onchange = toggle; toggle();
    var foot = [{ label: "Anuluj" }];
    if (a.id) foot.unshift({ label: "Usuń konto", cls: "danger", onClick: function () {
      var n = TT.store.all("trade").filter(function (t) { return t.accountId === a.id; }).length;
      TT.confirm("Usunąć konto „" + a.name + "”?", "Razem z nim zostanie usuniętych " + n + " transakcji. Tego nie da się cofnąć.", function () {
        TT.store.all("trade").forEach(function (t) { if (t.accountId === a.id) TT.store.remove(t.id); });
        TT.store.remove(a.id); if (TT.store.currentAccount() === a.id) TT.store.setCurrentAccount("all");
      });
    } });
    foot.push({ label: "Zapisz", cls: "primary", onClick: function () {
      a.name = f("name").value.trim(); if (!a.name) { TT.toast("Podaj nazwę konta", true); return false; }
      a.type = f("type").value; a.broker = f("broker").value.trim(); a.currency = f("currency").value;
      a.startBalance = TT.num(f("startBalance").value) || 0;
      a.prop = a.type === "prop" ? { phase: f("phase").value, target: f("target").value.trim(), dailyLoss: f("dailyLoss").value.trim(), maxDD: f("maxDD").value.trim(), ddType: f("ddType").value, minDays: f("minDays").value.trim(), split: f("split").value.trim(), payoutLimit: f("payoutLimit").value.trim(), fee: f("fee").value.trim(), bought: f("bought").value } : {};
      if (!a.createdAt) a.createdAt = new Date().toISOString();
      TT.store.put("account", a); TT.toast("Zapisano konto");
    } });
    TT.modal({ title: a.id ? "Edytuj konto" : "Nowe konto", body: body, foot: foot, wide: true });
  };

  function meter(label, used, limit, cur, invert) {
    if (limit === null || limit === undefined) return "";
    var pct = limit ? Math.max(0, Math.min(100, used / limit * 100)) : 0;
    var color = invert ? "var(--green)" : pct > 80 ? "var(--red)" : pct > 50 ? "var(--orange)" : "var(--blue)";
    return '<div class="meter"><div class="top"><span class="muted">' + label + "</span><span><b>" + TT.money(used, cur) + '</b> <span class="muted">/ ' + TT.money(limit, cur) + '</span></span></div><div class="trk"><div class="fill" style="width:' + pct + "%;background:" + color + '"></div></div></div>';
  }

  TT.views.prop = {
    title: "Prop firmy",
    render: function (root) {
      var props = TT.store.accounts().filter(function (a) { return a.type === "prop"; });
      var fees = 0, payouts = 0;
      var cards = props.map(function (a) {
        var tr = TT.store.trades({ accountId: a.id }), r = TT.stats.prop(a, tr), cur = a.currency;
        fees += r.fee; payouts += r.paid;
        var status = r.violated.length ? '<span class="badge bad">NARUSZONE</span>' : r.passed ? '<span class="badge ok">' + (a.prop.phase === "funded" ? "W CELU" : "ZALICZONE") + "</span>" : '<span class="badge info">AKTYWNE</span>';
        return '<div class="card"><div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><b style="font-size:15px;color:var(--text-strong)">' + E(a.name) + "</b>" + status +
          '<span style="flex:1"></span><button class="icon-btn" data-edit="' + a.id + '" title="Edytuj">' + TT.icon("settings", 16) + "</button></div>" +
          '<div class="muted" style="margin-bottom:10px">' + E(a.broker || "") + " · " + ({ challenge: "Challenge", verification: "Weryfikacja", funded: "Finansowane" }[a.prop.phase] || "") + " · start " + TT.money(r.start, cur, { dec: 0 }) + "</div>" +
          '<div class="kv"><span>Saldo</span><b>' + TT.money(r.balance, cur) + '</b></div><div class="kv"><span>Zysk</span><b class="' + TT.cls(r.profit) + '">' + TT.money(r.profit, cur, { plus: true }) + "</b></div>" +
          '<div class="kv"><span>Dziś</span><b class="' + TT.cls(r.todayPnl) + '">' + TT.money(r.todayPnl, cur, { plus: true }) + "</b></div>" +
          (r.target !== null ? meter("Cel zysku", Math.max(0, r.profit), r.target, cur, true) : "") +
          meter("Dzienna strata (dziś)", Math.max(0, -r.todayPnl), r.dailyLoss, cur) +
          meter("Drawdown (" + (a.prop.ddType === "trailing" ? "trailing" : "statyczny") + ")", r.ddUsed || 0, r.maxDD, cur) +
          (r.floor !== null ? '<div class="kv"><span>Poziom zamknięcia konta</span><b class="neg">' + TT.money(r.floor, cur) + "</b></div>" : "") +
          '<div class="kv"><span>Dni handlowe</span><b>' + r.days + (r.minDays ? " / " + r.minDays : "") + "</b></div>" +
          (r.violated.length ? '<div class="note" style="color:var(--red);margin-top:8px">Naruszone: ' + E(r.violated.join(", ")) + "</div>" : "") +
          (a.prop.phase === "funded" ? '<div class="side-sec" style="padding:10px 0 0;margin-top:10px"><h4>Wypłaty</h4><div class="kv"><span>Szacowana wypłata teraz' + (a.prop.split ? " (" + E(a.prop.split) + "%)" : "") + '</span><b class="pos">' + TT.money(r.payoutEst, cur) + "</b></div>" +
            (a.payouts || []).map(function (x, i) { return '<div class="kv"><span>' + TT.fmtDate(x.date) + '</span><span><b>' + TT.money(+x.amount, cur) + '</b> <button class="icon-btn" data-delpay="' + a.id + ":" + i + '">' + TT.icon("trash", 14) + "</button></span></div>"; }).join("") +
            '<button class="btn small" style="margin-top:6px" data-pay="' + a.id + '">+ Zapisz otrzymaną wypłatę</button></div>' : "") +
          '<div style="display:flex;gap:6px;margin-top:10px"><button class="btn small" data-show="' + a.id + '">Transakcje</button></div></div>';
      });
      root.innerHTML = '<div class="page"><div class="page-head"><h1>Prop firmy</h1><span class="sub">pilnowanie reguł, wypłaty i koszty</span><span style="flex:1"></span><button class="btn primary" id="pr-new">' + TT.icon("plus", 16) + " Dodaj konto prop</button></div>" +
        '<div class="tiles">' + TT.tile("Konta prop", props.length) + TT.tile("Wydane na challenge", TT.money(fees, "", { dec: 0 }), fees ? "neg" : "") + TT.tile("Otrzymane wypłaty", TT.money(payouts, "", { dec: 0 }), payouts ? "pos" : "") + TT.tile("Bilans prop", TT.money(payouts - fees, "", { plus: true, dec: 0 }), TT.cls(payouts - fees)) + "</div>" +
        (props.length ? '<div class="grid g3">' + cards.join("") + "</div>" : '<div class="empty">Nie masz jeszcze kont prop. Dodaj challenge (np. FTMO, FundedNext), a terminal będzie pilnował dziennego limitu straty, drawdownu i celu.</div>') +
        '<div class="card" style="margin-top:14px"><h3>Wszystkie konta</h3><table class="tv"><thead><tr><th>Nazwa</th><th>Typ</th><th>Broker</th><th>Waluta</th><th class="r">Start</th><th class="r">Saldo</th><th class="r">Transakcje</th><th></th></tr></thead><tbody>' +
        TT.store.accounts().map(function (a) {
          var tr = TT.store.trades({ accountId: a.id }), net = tr.reduce(function (x, t) { return x + (+t.pnl || 0); }, 0);
          return "<tr><td><b>" + E(a.name) + "</b></td><td>" + TYPES[a.type] + "</td><td>" + E(a.broker || "") + "</td><td>" + a.currency + '</td><td class="r">' + TT.money(a.startBalance, a.currency, { dec: 0 }) + '</td><td class="r ' + TT.cls(net) + '">' + TT.money((+a.startBalance || 0) + net, a.currency) + '</td><td class="r">' + tr.length + '</td><td class="r"><button class="btn small" data-edit="' + a.id + '">Edytuj</button></td></tr>';
        }).join("") + '</tbody></table><button class="btn small" style="margin-top:10px" id="acc-new">+ Nowe konto (paper / realne)</button></div></div>';
      root.querySelector("#pr-new").onclick = function () { TT.editAccount(null, "prop"); };
      root.querySelector("#acc-new").onclick = function () { TT.editAccount(null, "live"); };
      root.querySelectorAll("[data-edit]").forEach(function (b) { b.onclick = function () { TT.editAccount(TT.store.account(b.dataset.edit)); }; });
      root.querySelectorAll("[data-show]").forEach(function (b) { b.onclick = function () { TT.store.setCurrentAccount(b.dataset.show); TT.app.go("journal"); }; });
      root.querySelectorAll("[data-pay]").forEach(function (b) {
        b.onclick = function () {
          var a = TT.store.account(b.dataset.pay);
          TT.modal({ title: "Otrzymana wypłata", body: '<div class="form-grid"><label class="field"><span>Data</span><input class="inp" type="date" id="py-d" value="' + TT.dayKey(new Date()) + '"></label><label class="field"><span>Kwota (' + a.currency + ')</span><input class="inp" id="py-a"></label></div>',
            foot: [{ label: "Anuluj" }, { label: "Zapisz", cls: "primary", onClick: function () { var v = TT.num(document.getElementById("py-a").value); if (!v) { TT.toast("Podaj kwotę", true); return false; } a.payouts = (a.payouts || []).concat([{ date: document.getElementById("py-d").value, amount: v }]); TT.store.put("account", a); } }] });
        };
      });
      root.querySelectorAll("[data-delpay]").forEach(function (b) { b.onclick = function () { var p = b.dataset.delpay.split(":"), a = TT.store.account(p[0]); a.payouts.splice(+p[1], 1); TT.store.put("account", a); }; });
    }
  };
})(window.TT);
