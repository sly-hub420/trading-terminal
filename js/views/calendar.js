/* Kalendarz P/L z podsumowaniem tygodni i notatkami dnia */
(function (TT) {
  "use strict";
  TT.views = TT.views || {};
  var E = TT.esc;
  var now = new Date();
  var cursor = { y: now.getFullYear(), m: now.getMonth() };

  TT.views.calendar = {
    title: "Kalendarz",
    render: function (root) {
      var acc = TT.store.currentAccount(), cur = TT.store.currencyOf(acc);
      var y = cursor.y, m = cursor.m;
      var first = new Date(y, m, 1), last = new Date(y, m + 1, 0);
      var gridStart = TT.startOfWeek(first);
      var trades = TT.store.trades({ from: gridStart, to: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 7) });
      var monthTrades = trades.filter(function (t) { var d = new Date(t.exitTime || t.entryTime); return d.getMonth() === m && d.getFullYear() === y; });
      var s = TT.stats.compute(trades), ms = TT.stats.compute(monthTrades);
      var notes = {}; TT.store.all("daynote").forEach(function (n) { notes[n.day] = n; });

      var h = '<div class="page"><div class="page-head"><button class="icon-btn" data-nav="-1">' + chev(-1) + '</button><h1 style="min-width:190px;text-align:center">' + TT.MONTHS[m] + " " + y + '</h1><button class="icon-btn" data-nav="1">' + chev(1) + '</button><button class="btn small" data-today>Dziś</button>' +
        '<span style="flex:1"></span></div>' +
        '<div class="tiles">' + tile("Wynik miesiąca", TT.money(ms.net, cur, { plus: true }), TT.cls(ms.net)) + tile("Win rate", TT.pct(ms.winRate, 0)) + tile("Transakcje", ms.count) +
        tile("Dni na plusie", ms.tradingDays ? ms.greenDays + " / " + ms.tradingDays : "—") + tile("Najlepszy dzień", ms.bestDay ? TT.money(ms.byDay[ms.bestDay].net, cur, { plus: true }) : "—", "pos") + tile("Najgorszy dzień", ms.worstDay ? TT.money(ms.byDay[ms.worstDay].net, cur, { plus: true }) : "—", "neg") + "</div>" +
        '<div class="cal">' + TT.WD.map(function (d) { return '<div class="wd">' + d + "</div>"; }).join("") + '<div class="wd">Tydzień</div>';
      var d = new Date(gridStart), todayKey = TT.dayKey(new Date());
      for (var w = 0; w < 6; w++) {
        if (w > 0 && d > last) break;
        var wNet = 0, wN = 0, wDays = 0;
        for (var i = 0; i < 7; i++) {
          var k = TT.dayKey(d), info = s.byDay[k], out = d.getMonth() !== m;
          var cls = "day" + (out ? " out" : "") + (k === todayKey ? " today" : "") + (info ? (info.net > 0 ? " win" : info.net < 0 ? " loss" : "") : "");
          if (info) { wNet += info.net; wN += info.n; wDays++; }
          h += '<div class="' + cls + '" data-day="' + k + '"><div class="dn"><span>' + d.getDate() + "</span>" + (notes[k] ? '<span title="Notatka dnia">✎</span>' : "") + "</div>" +
            (info ? '<div class="dp ' + TT.cls(info.net) + '">' + TT.money(info.net, cur, { plus: true, dec: Math.abs(info.net) >= 1000 ? 0 : 2 }) + '</div><div class="dc">' + info.n + " trans. · " + Math.round(info.w / Math.max(1, info.w + info.l) * 100) + "% WR</div>" : "") + "</div>";
          d.setDate(d.getDate() + 1);
        }
        h += '<div class="week"><div class="wl">Tydzień ' + (w + 1) + '</div><div class="wv ' + TT.cls(wNet) + '">' + (wN ? TT.money(wNet, cur, { plus: true }) : "—") + '</div><div class="wl">' + wDays + " dni · " + wN + " trans.</div></div>";
      }
      h += "</div></div>";
      root.innerHTML = h;
      root.querySelectorAll("[data-nav]").forEach(function (b) { b.onclick = function () { cursor.m += +b.dataset.nav; if (cursor.m < 0) { cursor.m = 11; cursor.y--; } if (cursor.m > 11) { cursor.m = 0; cursor.y++; } TT.views.calendar.render(root); }; });
      root.querySelector("[data-today]").onclick = function () { cursor = { y: now.getFullYear(), m: now.getMonth() }; TT.views.calendar.render(root); };
      root.querySelectorAll("[data-day]").forEach(function (c) { c.onclick = function () { openDay(c.dataset.day); }; });
    }
  };

  function openDay(key) {
    var acc = TT.store.currentAccount();
    var p = key.split("-"), from = new Date(+p[0], +p[1] - 1, +p[2]), to = new Date(+p[0], +p[1] - 1, +p[2], 23, 59, 59);
    var trades = TT.store.trades({ from: from, to: to });
    var s = TT.stats.compute(trades), cur = TT.store.currencyOf(acc);
    var note = TT.store.get("dn_" + key) || { id: "dn_" + key, day: key, text: "", mood: "" };
    var body = document.createElement("div");
    body.innerHTML =
      '<div class="tiles" style="grid-template-columns:repeat(4,1fr)">' + tile("Wynik", TT.money(s.net, cur, { plus: true }), TT.cls(s.net)) + tile("Transakcje", s.count) + tile("Win rate", TT.pct(s.winRate, 0)) + tile("Opłaty", TT.money(s.fees, cur)) + "</div>" +
      (trades.length ? '<table class="tv" style="margin-bottom:14px"><thead><tr><th>Czas</th><th>Symbol</th><th>Typ</th><th class="r">P/L</th><th>Setup</th></tr></thead><tbody>' +
        trades.map(function (t) { return '<tr data-id="' + t.id + '"><td>' + TT.fmtDateTime(t.exitTime).slice(11) + "</td><td><b>" + E(t.symbol) + '</b></td><td><span class="side-tag ' + t.side + '">' + TT.sideLabel(t.side) + '</span></td><td class="r ' + TT.cls(t.pnl) + '">' + TT.money(t.pnl, TT.store.currencyOf(t.accountId), { plus: true }) + "</td><td>" + E(t.setup || "") + "</td></tr>"; }).join("") + "</tbody></table>"
        : '<p class="muted">Brak transakcji tego dnia.</p>') +
      '<div class="form-grid"><label class="field"><span>Samopoczucie / nastawienie</span><select class="inp" name="mood"><option value="">—</option>' +
      ["Skupiony", "Pewny siebie", "Zmęczony", "Zestresowany", "Niecierpliwy", "Po stracie (tilt)"].map(function (x) { return "<option" + (note.mood === x ? " selected" : "") + ">" + x + "</option>"; }).join("") + "</select></label><div></div>" +
      '<label class="field full"><span>Notatka dnia — plan przed sesją, wnioski po</span><textarea class="inp" name="text" style="min-height:140px">' + E(note.text) + "</textarea></label></div>";
    var md = TT.modal({ title: "Dzień " + TT.fmtDate(from), body: body, wide: true, foot: [
      { label: "Dodaj transakcję", onClick: function () { TT.editTrade({ entryTime: new Date(+p[0], +p[1] - 1, +p[2], 12).toISOString(), exitTime: new Date(+p[0], +p[1] - 1, +p[2], 12).toISOString() }); } },
      { label: "Zapisz notatkę", cls: "primary", onClick: function () { note.text = body.querySelector('[name="text"]').value; note.mood = body.querySelector('[name="mood"]').value; TT.store.put("daynote", note); TT.toast("Zapisano notatkę dnia"); } }
    ] });
    body.querySelectorAll("tr[data-id]").forEach(function (tr) { tr.onclick = function () { md.close(); TT.editTrade(TT.store.get(tr.dataset.id)); }; });
  }

  function tile(l, v, c) { return '<div class="tile"><div class="lbl">' + l + '</div><div class="val ' + (c || "") + '">' + v + "</div></div>"; }
  function chev(dir) { return TT.icon(dir < 0 ? "down" : "down").replace("<svg", '<svg style="transform:rotate(' + (dir < 0 ? 90 : -90) + 'deg)"'); }
  TT.tile = tile;
})(window.TT);
