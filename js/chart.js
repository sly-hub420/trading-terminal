/* Wykres (Lightweight Charts od TradingView): dane rynkowe, znaczniki transakcji, rysowanie, replay */
(function (TT) {
  "use strict";
  var LC = window.LightweightCharts;
  var TF = {
    "1m": { sec: 60, binance: "1m", td: "1min", label: "1m" },
    "5m": { sec: 300, binance: "5m", td: "5min", label: "5m" },
    "15m": { sec: 900, binance: "15m", td: "15min", label: "15m" },
    "1h": { sec: 3600, binance: "1h", td: "1h", label: "1h" },
    "4h": { sec: 14400, binance: "4h", td: "4h", label: "4h" },
    "1D": { sec: 86400, binance: "1d", td: "1day", label: "D" }
  };
  var CRYPTO = ["BTC", "ETH", "SOL", "XRP", "BNB", "DOGE", "ADA", "AVAX", "LINK", "DOT", "LTC", "MATIC", "TRX", "SHIB", "TON", "SUI", "PEPE"];
  var FIAT = ["USD", "EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "NZD", "PLN", "SEK", "NOK", "HUF", "CZK", "TRY", "ZAR", "MXN", "XAU", "XAG"];
  var XTB_ALIAS = { GOLD: "XAU/USD", SILVER: "XAG/USD", US500: "SPX", US100: "NDX", US30: "DJI", DE40: "DAX", "OIL.WTI": "WTI/USD", OIL: "BRENT/USD", NATGAS: "NG/USD", BITCOIN: "BINANCE:BTCUSDT", ETHEREUM: "BINANCE:ETHUSDT" };

  var C = TT.chart = {
    TF: TF,
    symbol: TT.local.get("symbol", "FX:USDJPY"),
    tf: TT.local.get("tf", "15m"),
    bars: [], chart: null, candle: null, volume: null,
    tool: "cursor", showMarkers: true, selectedTradeId: null,
    drawSeries: [], drawLines: [], tradeLines: [], pending: null, loadingOlder: false, noMoreOlder: false,
    replay: { active: false, picking: false, idx: 0, playing: false, speed: 2, timer: null, pos: null, posLine: null, full: null }
  };

  C.norm = function (sym) {
    var s = String(sym || "").toUpperCase().trim();
    if (s.indexOf(":") >= 0) s = s.split(":")[1];
    return s.replace(/\.(US|UK|DE|PL|FR)$/, "").replace(/\//g, "");
  };
  // pokazuj czas lokalny; stałe przesunięcie (nie per-świeca), bo przy zmianie czasu letni/zimowy świece by się dublowały
  var TZ_SHIFT = -new Date().getTimezoneOffset() * 60;
  function shift(sec) { return sec + TZ_SHIFT; }
  C.shift = shift;
  function aliasMap() {
    var out = {}, txt = TT.local.get("aliases", "");
    String(txt).split(/[\n,;]/).forEach(function (l) { var m = l.split("="); if (m.length === 2) out[m[0].trim().toUpperCase()] = m[1].trim(); });
    return out;
  }

  /* ---------- źródła danych ---------- */
  function resolveSource(symbol) {
    var raw = String(symbol).toUpperCase().trim();
    var al = aliasMap();
    var base = raw.indexOf(":") >= 0 ? raw.split(":")[1] : raw;
    if (al[raw]) raw = al[raw].toUpperCase(); else if (al[base]) raw = al[base].toUpperCase();
    else if (XTB_ALIAS[base]) raw = XTB_ALIAS[base];
    var exch = raw.indexOf(":") >= 0 ? raw.split(":")[0] : "";
    var s = raw.indexOf(":") >= 0 ? raw.split(":")[1] : raw;
    s = s.replace(/\.(US|UK|DE|PL|FR)$/, "");
    var m = s.match(/^([A-Z0-9]{2,10}?)(USDT|USDC|FDUSD)$/);
    if (exch === "BINANCE" || m) return { src: "binance", sym: s.replace("/", "") };
    var cm = s.replace("/", "").match(/^([A-Z]{2,6})(USD)$/);
    if (cm && CRYPTO.indexOf(cm[1]) >= 0) return { src: "binance", sym: cm[1] + "USDT" };
    if (s.indexOf("/") >= 0) return { src: "td", sym: s };
    if (/^[A-Z]{6}$/.test(s) && FIAT.indexOf(s.slice(0, 3)) >= 0 && FIAT.indexOf(s.slice(3)) >= 0) return { src: "td", sym: s.slice(0, 3) + "/" + s.slice(3) };
    return { src: "td", sym: s };
  }
  C.resolveSource = resolveSource;

  var cache = {};
  async function fetchBars(symbol, tf, endSec) {
    var r = resolveSource(symbol), t = TF[tf];
    var key = r.src + ":" + r.sym + ":" + tf + ":" + (endSec || "now");
    if (cache[key]) return cache[key];
    var bars;
    if (r.src === "binance") {
      var url = "https://api.binance.com/api/v3/klines?symbol=" + encodeURIComponent(r.sym) + "&interval=" + t.binance + "&limit=1000" + (endSec ? "&endTime=" + endSec * 1000 : "");
      var res = await fetch(url);
      if (!res.ok) throw new Error("Binance: brak symbolu " + r.sym);
      var js = await res.json();
      bars = js.map(function (k) { return { time: Math.floor(k[0] / 1000), open: +k[1], high: +k[2], low: +k[3], close: +k[4], volume: +k[5] }; });
    } else {
      var apikey = TT.local.get("tdKey", "");
      if (!apikey) { var e = new Error("NO_KEY"); e.code = "NO_KEY"; throw e; }
      var u = "https://api.twelvedata.com/time_series?symbol=" + encodeURIComponent(r.sym) + "&interval=" + t.td + "&outputsize=1500&timezone=UTC&apikey=" + encodeURIComponent(apikey);
      if (endSec) { var d = new Date(endSec * 1000); u += "&end_date=" + encodeURIComponent(d.toISOString().slice(0, 19).replace("T", " ")); }
      var rr = await fetch(u), j = await rr.json();
      if (j.status === "error") throw new Error("Twelve Data: " + (j.message || "błąd") + " (symbol " + r.sym + ")");
      bars = (j.values || []).map(function (v) {
        var p = v.datetime.length <= 10 ? v.datetime + "T00:00:00Z" : v.datetime.replace(" ", "T") + "Z";
        return { time: Math.floor(Date.parse(p) / 1000), open: +v.open, high: +v.high, low: +v.low, close: +v.close, volume: +(v.volume || 0) };
      }).reverse();
    }
    bars = bars.filter(function (b, i, arr) { return i === 0 || b.time > arr[i - 1].time; });
    cache[key] = bars;
    return bars;
  }

  /* ---------- tworzenie wykresu ---------- */
  C.init = function (el) {
    C.el = el;
    C.chart = LC.createChart(el, {
      autoSize: true,
      layout: { background: { type: "solid", color: "#131722" }, textColor: "#b2b5be", fontSize: 12, fontFamily: "-apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, Ubuntu, sans-serif" },
      grid: { vertLines: { color: "rgba(42,46,57,0.6)" }, horzLines: { color: "rgba(42,46,57,0.6)" } },
      crosshair: { mode: LC.CrosshairMode.Normal, vertLine: { color: "#758696", width: 1, style: 3, labelBackgroundColor: "#363a45" }, horzLine: { color: "#758696", width: 1, style: 3, labelBackgroundColor: "#363a45" } },
      rightPriceScale: { borderColor: "#2a2e39", scaleMargins: { top: 0.1, bottom: 0.2 } },
      timeScale: { borderColor: "#2a2e39", timeVisible: true, secondsVisible: false, rightOffset: 8, barSpacing: 8 },
      localization: { locale: "pl-PL" }
    });
    C.candle = C.chart.addCandlestickSeries({ upColor: "#089981", downColor: "#f23645", borderVisible: false, wickUpColor: "#089981", wickDownColor: "#f23645" });
    C.volume = C.chart.addHistogramSeries({ priceFormat: { type: "volume" }, priceScaleId: "vol", lastValueVisible: false, priceLineVisible: false });
    C.chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    C.chart.subscribeCrosshairMove(legend);
    C.chart.subscribeClick(onClick);
    C.chart.timeScale().subscribeVisibleLogicalRangeChange(function (r) {
      if (r && r.from < 15 && !C.replay.active) loadOlder();
    });
  };

  function precisionFor(bars) {
    var last = bars.length ? bars[bars.length - 1].close : 1;
    var p = last >= 1000 ? 2 : last >= 50 ? 3 : last >= 1 ? 5 : 6;
    return { type: "price", precision: p, minMove: Math.pow(10, -p) };
  }
  function toSeries(bars) {
    return {
      c: bars.map(function (b) { return { time: shift(b.time), open: b.open, high: b.high, low: b.low, close: b.close }; }),
      v: bars.map(function (b) { return { time: shift(b.time), value: b.volume, color: b.close >= b.open ? "rgba(8,153,129,0.45)" : "rgba(242,54,69,0.45)" }; })
    };
  }
  function setData(bars) {
    var s = toSeries(bars);
    C.candle.setData(s.c);
    C.volume.setData(s.v);
  }

  C.msg = function (html) {
    var m = document.getElementById("chart-msg");
    if (!html) { m.classList.add("hidden"); m.innerHTML = ""; return; }
    m.innerHTML = '<div class="box">' + html + "</div>"; m.classList.remove("hidden");
  };

  C.load = async function (symbol, tf, opts) {
    opts = opts || {};
    if (C.replay.active) C.stopReplay();
    C.symbol = (symbol || C.symbol).toUpperCase().trim();
    C.tf = tf || C.tf;
    TT.local.set("symbol", C.symbol); TT.local.set("tf", C.tf);
    document.getElementById("symbol-input").value = C.symbol;
    TT.app && TT.app.renderTopbar();
    C.noMoreOlder = false;
    C.msg('<div class="muted">Ładowanie ' + TT.esc(C.symbol) + "…</div>");
    try {
      var bars = await fetchBars(C.symbol, C.tf, opts.endSec || null);
      if (!bars.length) throw new Error("Brak danych dla " + C.symbol);
      C.bars = bars.slice();
      C.candle.applyOptions({ priceFormat: precisionFor(bars) });
      setData(C.bars);
      C.msg(null);
    } catch (e) {
      C.bars = []; setData([]);
      if (e.code === "NO_KEY") {
        C.msg("<h3>Potrzebny darmowy klucz danych</h3><p class='muted'>Forex, złoto, indeksy i akcje pobieram z Twelve Data (darmowy plan: 800 zapytań dziennie). Krypto (np. BINANCE:BTCUSDT) działa bez klucza.</p>" +
          "<p><button class='btn primary' onclick=\"TT.app.go('settings')\">Dodaj klucz w Ustawieniach</button> <button class='btn' onclick=\"TT.app.go('live')\">Otwórz wykres Live</button></p>");
      } else C.msg("<h3>Nie udało się wczytać wykresu</h3><p class='muted'>" + TT.esc(e.message) + "</p><p class='muted'>Wpisz inny symbol albo dodaj alias w Ustawieniach (np. <code>US100=NDX</code>).</p>");
    }
    C.renderMarkers(); C.renderDrawings(); C.renderTradeLines();
    if (opts.range) C.chart.timeScale().setVisibleRange({ from: shift(opts.range[0]), to: shift(opts.range[1]) });
    else C.chart.timeScale().scrollToRealTime();
    legend(null);
    TT.app && TT.app.renderSide();
  };

  async function loadOlder() {
    if (C.loadingOlder || C.noMoreOlder || !C.bars.length) return;
    C.loadingOlder = true;
    try {
      var first = C.bars[0].time;
      var older = await fetchBars(C.symbol, C.tf, first - 1);
      older = older.filter(function (b) { return b.time < first; });
      if (!older.length) { C.noMoreOlder = true; return; }
      var range = C.chart.timeScale().getVisibleLogicalRange();
      C.bars = older.concat(C.bars);
      setData(C.bars);
      if (range) C.chart.timeScale().setVisibleLogicalRange({ from: range.from + older.length, to: range.to + older.length });
      C.renderMarkers(); C.renderDrawings();
    } catch (e) { C.noMoreOlder = true; }
    finally { C.loadingOlder = false; }
  }

  /* ---------- legenda OHLC ---------- */
  function legend(param) {
    var el = document.getElementById("chart-legend");
    var bar = param && param.seriesData ? param.seriesData.get(C.candle) : null;
    if (!bar && C.bars.length) { var b = C.replay.active ? C.bars[C.replay.idx] : C.bars[C.bars.length - 1]; bar = b; }
    var src = resolveSource(C.symbol);
    var h = '<span class="sym">' + TT.esc(C.symbol) + '</span><span class="muted">· ' + TF[C.tf].label + " · " + (src.src === "binance" ? "Binance" : "Twelve Data") + "</span>";
    if (bar) {
      var up = bar.close >= bar.open, col = up ? "#089981" : "#f23645", chg = bar.open ? (bar.close - bar.open) / bar.open * 100 : 0;
      h += '<span class="ohlc"><b>O</b><span style="color:' + col + '">' + TT.price(bar.open) + '</span> <b>H</b><span style="color:' + col + '">' + TT.price(bar.high) +
        '</span> <b>L</b><span style="color:' + col + '">' + TT.price(bar.low) + '</span> <b>C</b><span style="color:' + col + '">' + TT.price(bar.close) +
        '</span> <span style="color:' + col + '">' + (chg >= 0 ? "+" : "") + chg.toFixed(2) + "%</span></span>";
    }
    if (C.measure) h += '<span class="ohlc" style="color:#7a9bff">' + C.measure + "</span>";
    el.innerHTML = h;
  }
  C.legend = legend;

  /* ---------- transakcje na wykresie ---------- */
  function barIndexAt(sec) {
    var a = C.bars, lo = 0, hi = a.length - 1, ans = -1;
    while (lo <= hi) { var mid = (lo + hi) >> 1; if (a[mid].time <= sec) { ans = mid; lo = mid + 1; } else hi = mid - 1; }
    return ans;
  }
  C.symbolTrades = function () {
    var n = C.norm(C.symbol);
    return TT.store.trades({ excludeBacktest: false }).filter(function (t) { return C.norm(t.symbol) === n; });
  };
  C.renderMarkers = function () {
    if (!C.candle) return;
    if (!C.showMarkers || !C.bars.length) { C.candle.setMarkers([]); return; }
    var lastIdx = C.replay.active ? C.replay.idx : C.bars.length - 1;
    var firstT = C.bars[0].time, lastT = C.bars[lastIdx].time + TF[C.tf].sec;
    var mk = [];
    C.symbolTrades().forEach(function (t) {
      var sel = t.id === C.selectedTradeId;
      var et = t.entryTime ? Date.parse(t.entryTime) / 1000 : null, xt = t.exitTime ? Date.parse(t.exitTime) / 1000 : null;
      if (et !== null && et >= firstT && et < lastT && t.entryTime !== t.exitTime) {
        var i = barIndexAt(et);
        if (i >= 0) mk.push({ time: shift(C.bars[i].time), position: t.side === "long" ? "belowBar" : "aboveBar", color: sel ? "#2962ff" : (t.side === "long" ? "#089981" : "#f23645"),
          shape: t.side === "long" ? "arrowUp" : "arrowDown", text: (t.side === "long" ? "Buy" : "Sell") + (t.qty ? " " + +t.qty : ""), size: sel ? 2 : 1 });
      }
      if (xt !== null && xt >= firstT && xt < lastT) {
        var j = barIndexAt(xt);
        if (j >= 0) mk.push({ time: shift(C.bars[j].time), position: t.side === "long" ? "aboveBar" : "belowBar", color: sel ? "#2962ff" : (t.pnl >= 0 ? "#089981" : "#f23645"),
          shape: "circle", text: TT.compact(t.pnl), size: sel ? 2 : 1 });
      }
    });
    if (C.replay.pos) {
      var k = barIndexAt(C.replay.pos.entryTime);
      if (k >= 0) mk.push({ time: shift(C.bars[k].time), position: C.replay.pos.side === "long" ? "belowBar" : "aboveBar", color: "#ff9800", shape: C.replay.pos.side === "long" ? "arrowUp" : "arrowDown", text: "Replay" });
    }
    mk.sort(function (a, b) { return a.time - b.time; });
    C.candle.setMarkers(mk);
  };
  C.renderTradeLines = function () {
    C.tradeLines.forEach(function (l) { C.candle.removePriceLine(l); }); C.tradeLines = [];
    var t = C.selectedTradeId ? TT.store.get(C.selectedTradeId) : null;
    if (!t || C.norm(t.symbol) !== C.norm(C.symbol)) return;
    function line(price, color, title, style) { if (price === null || price === undefined || price === "" || isNaN(price)) return; C.tradeLines.push(C.candle.createPriceLine({ price: +price, color: color, lineWidth: 1, lineStyle: style, axisLabelVisible: true, title: title })); }
    line(t.entry, "#2962ff", "Wejście", 0);
    line(t.exit, t.pnl >= 0 ? "#089981" : "#f23645", "Wyjście " + TT.compact(t.pnl), 2);
    line(t.sl, "#f23645", "SL", 1);
    line(t.tp, "#089981", "TP", 1);
  };
  /* pokaż konkretną transakcję: załaduj symbol i przewiń do niej */
  C.showTrade = function (t) {
    C.selectedTradeId = t.id;
    var et = Date.parse(t.entryTime || t.exitTime) / 1000, xt = Date.parse(t.exitTime || t.entryTime) / 1000;
    var tf = C.tf, dur = xt - et;
    if (dur > 0) { var best = Object.keys(TF).find(function (k) { return dur / TF[k].sec <= 80; }); if (best && TF[best].sec > TF[tf].sec) tf = best; }
    var pad = TF[tf].sec * 60;
    var end = Math.min(Math.floor(Date.now() / 1000), xt + TF[tf].sec * 300);
    TT.app.go("chart");
    C.load(t.symbol, tf, { endSec: end, range: [et - pad, xt + pad] });
  };

  /* ---------- rysowanie ---------- */
  function drawDocId() { return "dr_" + C.norm(C.symbol); }
  function drawItems() { var d = TT.store.get(drawDocId()); return d ? d.items || [] : []; }
  function saveItems(items) { TT.store.put("drawings", { id: drawDocId(), symbol: C.norm(C.symbol), items: items }, true); }
  C.setTool = function (tool) {
    C.tool = tool; C.pending = null; C.measure = null; clearTemp();
    TT.app && TT.app.renderTools();
  };
  var tempLine = null;
  function clearTemp() { if (tempLine) { C.candle.removePriceLine(tempLine); tempLine = null; } }
  C.renderDrawings = function () {
    if (!C.chart) return;
    C.drawSeries.forEach(function (s) { C.chart.removeSeries(s); }); C.drawSeries = [];
    C.drawLines.forEach(function (l) { C.candle.removePriceLine(l); }); C.drawLines = [];
    if (!C.bars.length || TT.local.get("hideDrawings", false)) return;
    drawItems().forEach(function (it) {
      if (it.type === "hline") {
        C.drawLines.push(C.candle.createPriceLine({ price: it.p1, color: "#2962ff", lineWidth: 1, lineStyle: 0, axisLabelVisible: true, title: "" }));
      } else if (it.type === "fib") {
        [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1].forEach(function (lv) {
          var price = it.p2 + (it.p1 - it.p2) * lv;
          C.drawLines.push(C.candle.createPriceLine({ price: price, color: lv === 0.5 || lv === 0.618 ? "#ff9800" : "#787b86", lineWidth: 1, lineStyle: 2, axisLabelVisible: false, title: String(lv) }));
        });
      } else if (it.type === "trend") {
        var i1 = barIndexAt(it.t1), i2 = barIndexAt(it.t2);
        if (i1 < 0 || i2 < 0 || i1 === i2) return;
        var s = C.chart.addLineSeries({ color: "#2962ff", lineWidth: 2, lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false, autoscaleInfoProvider: function () { return null; } });
        var pts = [{ time: shift(C.bars[i1].time), value: it.p1 }, { time: shift(C.bars[i2].time), value: it.p2 }].sort(function (a, b) { return a.time - b.time; });
        s.setData(pts); C.drawSeries.push(s);
      }
    });
  };
  function clickTimePrice(param) {
    if (!param.point) return null;
    var price = C.candle.coordinateToPrice(param.point.y);
    var idx = param.logical !== undefined ? Math.round(param.logical) : null;
    if (idx === null) return null;
    idx = Math.max(0, Math.min(C.bars.length - 1, idx));
    if (!C.bars[idx]) return null;
    return { idx: idx, time: C.bars[idx].time, price: price };
  }
  function onClick(param) {
    var tp = clickTimePrice(param);
    if (!tp) return;
    if (C.replay.picking) { C.beginReplayAt(tp.idx); return; }
    if (C.tool === "hline") { var items = drawItems(); items.push({ type: "hline", p1: tp.price }); saveItems(items); C.renderDrawings(); C.setTool("cursor"); return; }
    if (C.tool === "trend" || C.tool === "fib" || C.tool === "measure") {
      if (!C.pending) {
        C.pending = tp; clearTemp();
        tempLine = C.candle.createPriceLine({ price: tp.price, color: "#787b86", lineWidth: 1, lineStyle: 3, axisLabelVisible: true, title: "1" });
        return;
      }
      var a = C.pending; clearTemp(); C.pending = null;
      if (C.tool === "measure") {
        var diff = tp.price - a.price, pc = diff / a.price * 100, bars = Math.abs(tp.idx - a.idx);
        C.measure = "Δ " + TT.price(diff) + " (" + (pc >= 0 ? "+" : "") + pc.toFixed(2) + "%) · " + bars + " świec";
        legend(null); C.tool = "cursor"; TT.app.renderTools(); return;
      }
      var it = C.tool === "trend" ? { type: "trend", t1: a.time, p1: a.price, t2: tp.time, p2: tp.price } : { type: "fib", p1: a.price, p2: tp.price };
      var list = drawItems(); list.push(it); saveItems(list); C.renderDrawings(); C.setTool("cursor");
    }
  }
  C.clearDrawings = function () { saveItems([]); C.renderDrawings(); };
  C.undoDrawing = function () { var l = drawItems(); l.pop(); saveItems(l); C.renderDrawings(); };

  /* ---------- Replay / symulator ---------- */
  C.startReplay = function () {
    if (!C.bars.length) { TT.toast("Najpierw załaduj wykres z danymi", true); return; }
    if (C.replay.active || C.replay.picking) { C.stopReplay(); return; }
    C.replay.picking = true;
    document.getElementById("replay-hint").classList.remove("hidden");
    TT.app.renderTopbar();
  };
  C.beginReplayAt = function (idx) {
    var R = C.replay;
    R.picking = false; R.active = true; R.full = C.bars.slice(); R.idx = Math.max(5, idx); R.pos = null;
    document.getElementById("replay-hint").classList.add("hidden");
    setData(C.bars.slice(0, R.idx + 1));
    C.renderMarkers(); renderReplayBar(); legend(null); TT.app.renderTopbar();
  };
  C.stepReplay = function () {
    var R = C.replay;
    if (!R.active) return;
    if (R.idx >= C.bars.length - 1) { pause(); TT.toast("Koniec danych"); return; }
    R.idx++;
    var b = C.bars[R.idx];
    C.candle.update({ time: shift(b.time), open: b.open, high: b.high, low: b.low, close: b.close });
    C.volume.update({ time: shift(b.time), value: b.volume, color: b.close >= b.open ? "rgba(8,153,129,0.45)" : "rgba(242,54,69,0.45)" });
    // SL/TP w replayu
    if (R.pos) {
      var p = R.pos, hitSL = p.sl && (p.side === "long" ? b.low <= p.sl : b.high >= p.sl), hitTP = p.tp && (p.side === "long" ? b.high >= p.tp : b.low <= p.tp);
      if (hitSL) closePos(p.sl, "SL"); else if (hitTP) closePos(p.tp, "TP");
    }
    renderReplayBar(); legend(null);
  };
  function pause() { var R = C.replay; R.playing = false; clearInterval(R.timer); R.timer = null; renderReplayBar(); }
  C.togglePlay = function () {
    var R = C.replay;
    if (R.playing) return pause();
    R.playing = true; R.timer = setInterval(C.stepReplay, 1000 / R.speed); renderReplayBar();
  };
  C.stopReplay = function () {
    var R = C.replay;
    clearInterval(R.timer);
    if (R.posLine) { C.candle.removePriceLine(R.posLine); R.posLine = null; }
    R.active = false; R.picking = false; R.playing = false; R.pos = null;
    document.getElementById("replay-hint").classList.add("hidden");
    document.getElementById("replay-bar").classList.add("hidden");
    if (R.full) { C.bars = R.full; R.full = null; }
    setData(C.bars); C.renderMarkers(); legend(null); TT.app.renderTopbar();
  };
  function backtestAccount() {
    var a = TT.store.accounts().find(function (x) { return x.type === "backtest"; });
    if (!a) a = TT.store.put("account", { name: "Backtest / Replay", type: "backtest", broker: "Replay", currency: "USD", startBalance: 10000, createdAt: new Date().toISOString() });
    return a;
  }
  C.replayOrder = function (side) {
    var R = C.replay, b = C.bars[R.idx];
    var qty = TT.num(document.getElementById("rp-qty").value) || 1;
    var sl = TT.num(document.getElementById("rp-sl").value), tp = TT.num(document.getElementById("rp-tp").value);
    if (R.pos) {
      if (R.pos.side !== side) closePos(b.close, "Ręcznie");
      else TT.toast("Pozycja już otwarta — zamknij ją albo zagraj w przeciwną stronę");
      return;
    }
    R.pos = { side: side, qty: qty, entry: b.close, entryTime: b.time, sl: sl, tp: tp };
    R.posLine = C.candle.createPriceLine({ price: b.close, color: "#ff9800", lineWidth: 1, lineStyle: 0, axisLabelVisible: true, title: (side === "long" ? "BUY " : "SELL ") + qty });
    C.renderMarkers(); renderReplayBar();
  };
  C.replayClose = function () { if (C.replay.pos) closePos(C.bars[C.replay.idx].close, "Ręcznie"); };
  function closePos(price, reason) {
    var R = C.replay, p = R.pos, b = C.bars[R.idx];
    var pnl = (p.side === "long" ? price - p.entry : p.entry - price) * p.qty;
    var acc = backtestAccount();
    TT.store.put("trade", {
      accountId: acc.id, symbol: C.symbol, side: p.side, qty: p.qty, entry: p.entry, exit: price, sl: p.sl, tp: p.tp,
      risk: p.sl ? Math.abs(p.entry - p.sl) * p.qty : null,
      entryTime: new Date(p.entryTime * 1000).toISOString(), exitTime: new Date(b.time * 1000).toISOString(),
      pnl: Math.round(pnl * 100) / 100, fees: 0, source: "replay", notes: "Replay — zamknięcie: " + reason + " (" + TF[C.tf].label + ")", tags: [], mistakes: [], images: []
    });
    if (R.posLine) { C.candle.removePriceLine(R.posLine); R.posLine = null; }
    R.pos = null;
    TT.toast("Zamknięto: " + TT.money(pnl, "USD", { plus: true }) + " (" + reason + ") — zapisano w koncie Backtest");
    C.renderMarkers(); renderReplayBar();
  }
  function renderReplayBar() {
    var R = C.replay, el = document.getElementById("replay-bar");
    if (!R.active) { el.classList.add("hidden"); return; }
    el.classList.remove("hidden");
    var b = C.bars[R.idx], info = "";
    if (R.pos) {
      var open = (R.pos.side === "long" ? b.close - R.pos.entry : R.pos.entry - b.close) * R.pos.qty;
      info = (R.pos.side === "long" ? "BUY" : "SELL") + " " + R.pos.qty + " @ " + TT.price(R.pos.entry) + ' · <span class="' + TT.cls(open) + '">' + TT.money(open, "USD", { plus: true }) + "</span>";
    } else info = '<span class="muted">' + TT.fmtDateTime(new Date(b.time * 1000)) + "</span>";
    var keep = {};
    ["rp-qty", "rp-sl", "rp-tp"].forEach(function (id) { var x = document.getElementById(id); if (x) keep[id] = x.value; });
    el.innerHTML =
      '<button class="tb-btn" title="Zakończ replay" onclick="TT.chart.stopReplay()">' + TT.icon("close") + "</button>" +
      '<button class="tb-btn" title="Play/Pauza (spacja)" onclick="TT.chart.togglePlay()">' + (R.playing ? '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>' : '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 5l12 7-12 7z"/></svg>') + "</button>" +
      '<button class="tb-btn" title="Następna świeca (→)" onclick="TT.chart.stepReplay()"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 5l10 7-10 7zM16 5h3v14h-3z"/></svg></button>' +
      '<select class="top-select" style="height:28px" onchange="TT.chart.setSpeed(this.value)">' + [1, 2, 5, 10].map(function (s) { return '<option value="' + s + '"' + (R.speed === s ? " selected" : "") + ">" + s + "×</option>"; }).join("") + "</select>" +
      '<span class="sep"></span><input id="rp-qty" placeholder="Ilość" title="Ilość"><input id="rp-sl" placeholder="SL" title="Stop loss (cena)"><input id="rp-tp" placeholder="TP" title="Take profit (cena)">' +
      '<button class="btn-buy" onclick="TT.chart.replayOrder(\'long\')">Kup</button><button class="btn-sell" onclick="TT.chart.replayOrder(\'short\')">Sprzedaj</button>' +
      (R.pos ? '<button class="btn small" onclick="TT.chart.replayClose()">Zamknij</button>' : "") +
      '<span class="rb-info">' + info + "</span>";
    Object.keys(keep).forEach(function (id) { document.getElementById(id).value = keep[id]; });
    if (!keep["rp-qty"]) document.getElementById("rp-qty").value = TT.local.get("replayQty", "1");
    document.getElementById("rp-qty").onchange = function () { TT.local.set("replayQty", this.value); };
  }
  C.setSpeed = function (s) { var R = C.replay; R.speed = +s; if (R.playing) { clearInterval(R.timer); R.timer = setInterval(C.stepReplay, 1000 / R.speed); } };
})(window.TT);
