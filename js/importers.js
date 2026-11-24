/* Importy: TradingView Paper Trading (Order History CSV), XTB xStation 5 (XLSX/CSV), stary P/L Ledger */
(function (TT) {
  "use strict";

  /* ---------- CSV ---------- */
  function detectDelimiter(line) {
    var c = (line.match(/,/g) || []).length, s = (line.match(/;/g) || []).length, t = (line.match(/\t/g) || []).length;
    if (t > c && t > s) return "\t"; if (s > c) return ";"; return ",";
  }
  function splitLine(line, d) {
    var out = [], cur = "", q = false;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      if (ch === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
      else if (ch === d && !q) { out.push(cur); cur = ""; }
      else cur += ch;
    }
    out.push(cur);
    return out.map(function (x) { return x.trim(); });
  }
  TT.parseCSVRows = function (text) {
    var lines = text.replace(/^﻿/, "").split(/\r?\n/).filter(function (l) { return l.trim(); });
    if (!lines.length) return [];
    var d = detectDelimiter(lines[0]);
    return lines.map(function (l) { return splitLine(l, d); });
  };

  /* znajdź wiersz nagłówka i zamień tabelę na obiekty */
  function tableToObjects(rows, mustHave) {
    var hi = -1;
    for (var i = 0; i < Math.min(rows.length, 40); i++) {
      var norm = rows[i].map(normKey);
      if (mustHave.every(function (group) { return group.some(function (k) { return norm.indexOf(normKey(k)) >= 0; }); })) { hi = i; break; }
    }
    if (hi < 0) return null;
    var headers = rows[hi].map(function (h) { return String(h == null ? "" : h).trim(); });
    var objs = [];
    for (var r = hi + 1; r < rows.length; r++) {
      var row = rows[r]; if (!row || !row.some(function (c) { return c !== "" && c != null; })) continue;
      var o = {}; headers.forEach(function (h, j) { if (h) o[h] = row[j]; }); objs.push(o);
    }
    return { headers: headers, rows: objs };
  }
  function normKey(k) { return String(k == null ? "" : k).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ł/g, "l").replace(/[^a-z0-9]/g, ""); }
  function pick(row, cands) {
    var keys = Object.keys(row);
    for (var i = 0; i < cands.length; i++) {
      var c = normKey(cands[i]);
      for (var j = 0; j < keys.length; j++) if (normKey(keys[j]) === c) return row[keys[j]];
    }
    return undefined;
  }

  var FIAT = ["USD", "EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "NZD", "PLN", "SEK", "NOK", "DKK", "HUF", "CZK", "TRY", "ZAR", "MXN", "SGD", "HKD", "CNH"];
  function fxInfo(sym) {
    var s = sym.indexOf(":") >= 0 ? sym.split(":")[1] : sym;
    if (!/^[A-Z]{6}$/.test(s)) return null;
    var b = s.slice(0, 3), q = s.slice(3);
    return FIAT.indexOf(b) >= 0 && FIAT.indexOf(q) >= 0 ? { base: b, quote: q } : null;
  }
  /* P/L z TradingView forex jest w walucie kwotowanej — przelicz na USD gdy się da */
  function fxToUsd(sym, pnl, px) {
    var fx = fxInfo(sym);
    if (!fx || fx.quote === "USD") return { pnl: pnl, note: "" };
    if (fx.base === "USD") return { pnl: pnl / px, note: "" };
    return { pnl: pnl, note: "P/L w " + fx.quote + " (para krzyżowa — nie przeliczono na USD)" };
  }

  /* ---------- TradingView Paper Trading: Order History CSV → transakcje (FIFO) ---------- */
  TT.importTradingView = function (text, accountId) {
    var rows = TT.parseCSVRows(text);
    var tbl = tableToObjects(rows, [["Symbol"], ["Side", "Strona"], ["Fill Price", "FillPrice", "Avg Fill Price", "Cena realizacji", "Price"]]);
    if (!tbl) return { error: "Nie rozpoznano pliku. Wyeksportuj „Historię zleceń” (Order History) z panelu Paper Trading w TradingView. Nagłówki w pliku: " + (rows[0] || []).join(" | ") };
    var fills = tbl.rows.map(function (r) {
      var status = pick(r, ["Status"]);
      if (status && !/fill|zrealiz|wykon/i.test(status)) return null;
      var time = TT.parseAnyDate(pick(r, ["Closing Time", "ClosingTime", "Fill Time", "Time", "Placing Time", "PlacingTime", "Czas zamknięcia", "Czas"]));
      var f = {
        symbol: String(pick(r, ["Symbol"]) || "").trim(),
        side: /buy|kup/i.test(pick(r, ["Side", "Strona"]) || "") ? "buy" : "sell",
        qty: TT.num(pick(r, ["Filled Qty", "FilledQty", "Qty", "Quantity", "Ilość"])),
        price: TT.num(pick(r, ["Fill Price", "FillPrice", "Avg Fill Price", "Cena realizacji", "Price"])),
        time: time,
        orderId: String(pick(r, ["Order ID", "OrderID", "ID"]) || ""),
        fee: TT.num(pick(r, ["Commission", "Prowizja"])) || 0
      };
      return f.symbol && f.qty && f.price && f.time ? f : null;
    }).filter(Boolean).sort(function (a, b) { return a.time - b.time; });
    if (!fills.length) return { error: "Brak zrealizowanych zleceń w pliku." };

    var books = {}, trades = [];
    fills.forEach(function (f, idx) {
      if (!f.orderId) f.orderId = f.time.getTime() + "-" + f.price + "-" + idx;
      var book = books[f.symbol] = books[f.symbol] || [];
      var rem = f.qty, part = 0;
      while (rem > 1e-9 && book.length && book[0].side !== f.side) {
        var lot = book[0], q = Math.min(rem, lot.qty);
        var raw = lot.side === "buy" ? (f.price - lot.price) * q : (lot.price - f.price) * q;
        var conv = fxToUsd(f.symbol, raw, f.price);
        var fee = (lot.fee * q / lot.origQty) + (f.fee * q / f.qty);
        trades.push({
          extId: "tv:" + lot.orderId + ":" + f.orderId + ":" + (part++),
          accountId: accountId, symbol: f.symbol, side: lot.side === "buy" ? "long" : "short", qty: q,
          entry: lot.price, exit: f.price, entryTime: lot.time.toISOString(), exitTime: f.time.toISOString(),
          pnl: round(conv.pnl - fee), fees: round(fee), notes: conv.note, source: "tradingview", tags: [], mistakes: [], images: []
        });
        lot.qty -= q; rem -= q;
        if (lot.qty <= 1e-9) book.shift();
      }
      if (rem > 1e-9) book.push({ side: f.side, qty: rem, origQty: f.qty, price: f.price, time: f.time, orderId: f.orderId, fee: f.fee });
    });
    return saveNew(trades, Object.keys(books).filter(function (k) { return books[k].length; }).length);
  };

  /* ---------- XTB xStation 5: raport „Zamknięte pozycje” (XLSX lub CSV) ---------- */
  var XTB_COLS = {
    id: ["Position", "Pozycja", "ID pozycji", "Position ID", "Order", "Zlecenie"],
    symbol: ["Symbol", "Instrument"],
    type: ["Type", "Typ"],
    volume: ["Volume", "Wolumen", "Wielkość"],
    openTime: ["Open time", "Czas otwarcia", "Open Time (UTC)", "Data otwarcia"],
    openPrice: ["Open price", "Cena otwarcia"],
    closeTime: ["Close time", "Czas zamknięcia", "Close Time (UTC)", "Data zamknięcia"],
    closePrice: ["Close price", "Cena zamknięcia"],
    sl: ["SL", "Stop loss"],
    tp: ["TP", "Take profit"],
    commission: ["Commission", "Prowizja"],
    swap: ["Swap", "Punkty swapowe"],
    rollover: ["Rollover"],
    gross: ["Gross P/L", "Gross Profit", "Zysk brutto", "Profit", "Zysk", "P/L"],
    net: ["Net P/L", "Net profit", "Zysk netto"],
    comment: ["Comment", "Komentarz"]
  };
  TT.importXTBRows = function (rows, accountId) {
    var tbl = tableToObjects(rows, [XTB_COLS.symbol, XTB_COLS.openTime, XTB_COLS.closePrice]);
    if (!tbl) return { error: "Nie znaleziono tabeli zamkniętych pozycji. W xStation 5: Historia konta → Zamknięte pozycje → Eksport (Excel). Jeśli dalej nie działa, wyślij mi plik — dopasuję kolumny." };
    var trades = tbl.rows.map(function (r) {
      var g = function (k) { return pick(r, XTB_COLS[k]); };
      var sym = String(g("symbol") || "").trim(); if (!sym || /^(total|suma|razem)/i.test(sym)) return null;
      var openT = TT.parseAnyDate(g("openTime")), closeT = TT.parseAnyDate(g("closeTime"));
      if (!openT || !closeT) return null;
      var comm = TT.num(g("commission")) || 0, swap = (TT.num(g("swap")) || 0) + (TT.num(g("rollover")) || 0);
      var net = TT.num(g("net")), gross = TT.num(g("gross"));
      var pnl = net !== null ? net : (gross || 0) + comm + swap;
      var id = g("id") || (sym + "-" + openT.getTime());
      return {
        extId: "xtb:" + id, accountId: accountId, symbol: sym,
        side: /sell|sprzeda/i.test(g("type") || "") ? "short" : "long",
        qty: TT.num(g("volume")), entry: TT.num(g("openPrice")), exit: TT.num(g("closePrice")),
        sl: TT.num(g("sl")) || null, tp: TT.num(g("tp")) || null,
        entryTime: openT.toISOString(), exitTime: closeT.toISOString(),
        pnl: round(pnl), fees: round(-(comm + swap)), notes: g("comment") ? String(g("comment")) : "", source: "xtb", tags: [], mistakes: [], images: []
      };
    }).filter(Boolean);
    if (!trades.length) return { error: "Nie znaleziono żadnych zamkniętych pozycji w pliku." };
    return saveNew(trades, 0);
  };
  TT.importXTBFile = async function (file, accountId) {
    if (/\.csv$/i.test(file.name)) return TT.importXTBRows(TT.parseCSVRows(await file.text()), accountId);
    await TT.loadScript("https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js");
    var wb = window.XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
    var names = wb.SheetNames.slice().sort(function (a, b) { return score(b) - score(a); });
    function score(n) { return /closed|zamkni/i.test(n) ? 2 : /position|pozycj/i.test(n) ? 1 : 0; }
    var lastErr = null;
    for (var i = 0; i < names.length; i++) {
      var rows = window.XLSX.utils.sheet_to_json(wb.Sheets[names[i]], { header: 1, raw: true, defval: "" });
      var res = TT.importXTBRows(rows, accountId);
      if (!res.error) return res;
      lastErr = res;
    }
    return lastErr;
  };

  /* ---------- stary P/L Ledger ({ "YYYY-MM-DD": [ {id,symbol,side,pnl,notes} ] }) ---------- */
  TT.importLegacy = function (obj, accountId) {
    var trades = [];
    Object.keys(obj || {}).forEach(function (day) {
      (obj[day] || []).forEach(function (t) {
        var m = day.match(/^(\d{4})-(\d{2})-(\d{2})$/); if (!m) return;
        var dt = new Date(+m[1], +m[2] - 1, +m[3], 12, 0, 0).toISOString();
        trades.push({ extId: "legacy:" + t.id, accountId: accountId, symbol: t.symbol, side: t.side === "short" ? "short" : "long",
          pnl: round(+t.pnl || 0), entryTime: dt, exitTime: dt, notes: (t.notes || "").replace(/^Imported from TradingView$/, ""), source: "legacy", tags: [], mistakes: [], images: [] });
      });
    });
    return saveNew(trades, 0);
  };

  function saveNew(trades, openLeft) {
    var existing = {};
    TT.store.all("trade").forEach(function (t) { if (t.extId) existing[t.extId] = 1; });
    var fresh = trades.filter(function (t) { return !existing[t.extId]; });
    if (fresh.length) TT.store.putMany("trade", fresh);
    return { added: fresh.length, skipped: trades.length - fresh.length, open: openLeft };
  }
  function round(n) { return Math.round(n * 100) / 100; }
})(window.TT);
