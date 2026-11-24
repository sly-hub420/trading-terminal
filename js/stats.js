/* Statystyki tradingowe */
(function (TT) {
  "use strict";
  var date = function (t) { return new Date(t.exitTime || t.entryTime); };

  TT.stats = {
    rMultiple: function (t) {
      if (t.risk && t.risk > 0) return t.pnl / t.risk;
      if (t.sl && t.entry && t.qty && t.entry !== t.sl && t.exit) {
        var riskPerUnit = Math.abs(t.entry - t.sl);
        var move = t.side === "long" ? t.exit - t.entry : t.entry - t.exit;
        return move / riskPerUnit;
      }
      return null;
    },

    compute: function (trades) {
      var s = { count: trades.length, net: 0, grossWin: 0, grossLoss: 0, wins: 0, losses: 0, be: 0, fees: 0,
        best: null, worst: null, maxWinStreak: 0, maxLossStreak: 0, maxDD: 0, maxDDPct: null, rSum: 0, rCount: 0,
        longNet: 0, longCount: 0, longWins: 0, shortNet: 0, shortCount: 0, shortWins: 0, avgHoldMin: null };
      var streakW = 0, streakL = 0, eq = 0, peak = 0, holdSum = 0, holdN = 0;
      var byDay = {}, byWeekday = [0, 0, 0, 0, 0, 0, 0].map(function () { return { net: 0, n: 0, w: 0 }; }),
        byHour = {}, bySymbol = {}, bySetup = {}, byMistake = {}, equity = [];
      trades.forEach(function (t) {
        var p = +t.pnl || 0;
        s.net += p; s.fees += +t.fees || 0;
        if (p > 0) { s.wins++; s.grossWin += p; streakW++; streakL = 0; }
        else if (p < 0) { s.losses++; s.grossLoss += -p; streakL++; streakW = 0; }
        else { s.be++; }
        s.maxWinStreak = Math.max(s.maxWinStreak, streakW); s.maxLossStreak = Math.max(s.maxLossStreak, streakL);
        if (!s.best || p > s.best.pnl) s.best = t;
        if (!s.worst || p < s.worst.pnl) s.worst = t;
        eq += p; peak = Math.max(peak, eq); s.maxDD = Math.max(s.maxDD, peak - eq);
        var d = date(t);
        equity.push({ time: d.getTime(), value: eq, pnl: p });
        var dk = TT.dayKey(d);
        (byDay[dk] = byDay[dk] || { net: 0, n: 0, w: 0, l: 0 });
        byDay[dk].net += p; byDay[dk].n++; if (p > 0) byDay[dk].w++; else if (p < 0) byDay[dk].l++;
        var wd = (d.getDay() + 6) % 7; byWeekday[wd].net += p; byWeekday[wd].n++; if (p > 0) byWeekday[wd].w++;
        var hd = t.entryTime ? new Date(t.entryTime) : d; var h = hd.getHours();
        (byHour[h] = byHour[h] || { net: 0, n: 0, w: 0 }); byHour[h].net += p; byHour[h].n++; if (p > 0) byHour[h].w++;
        add(bySymbol, t.symbol || "?", p);
        add(bySetup, t.setup || "(brak setupu)", p);
        (t.mistakes || []).forEach(function (m) { add(byMistake, m, p); });
        if (t.side === "short") { s.shortNet += p; s.shortCount++; if (p > 0) s.shortWins++; } else { s.longNet += p; s.longCount++; if (p > 0) s.longWins++; }
        var r = TT.stats.rMultiple(t); if (r !== null && isFinite(r)) { s.rSum += r; s.rCount++; }
        if (t.entryTime && t.exitTime) { holdSum += (new Date(t.exitTime) - new Date(t.entryTime)) / 60000; holdN++; }
      });
      var decided = s.wins + s.losses;
      s.winRate = decided ? s.wins / decided * 100 : null;
      s.profitFactor = s.grossLoss ? s.grossWin / s.grossLoss : (s.grossWin ? Infinity : null);
      s.avgWin = s.wins ? s.grossWin / s.wins : null;
      s.avgLoss = s.losses ? -s.grossLoss / s.losses : null;
      s.expectancy = s.count ? s.net / s.count : null;
      s.avgR = s.rCount ? s.rSum / s.rCount : null;
      s.rr = s.avgWin && s.avgLoss ? s.avgWin / Math.abs(s.avgLoss) : null;
      s.avgHoldMin = holdN ? holdSum / holdN : null;
      var days = Object.keys(byDay);
      s.tradingDays = days.length;
      s.greenDays = days.filter(function (k) { return byDay[k].net > 0; }).length;
      s.bestDay = null; s.worstDay = null;
      days.forEach(function (k) {
        if (!s.bestDay || byDay[k].net > byDay[s.bestDay].net) s.bestDay = k;
        if (!s.worstDay || byDay[k].net < byDay[s.worstDay].net) s.worstDay = k;
      });
      s.byDay = byDay; s.byWeekday = byWeekday; s.byHour = byHour; s.bySymbol = bySymbol; s.bySetup = bySetup; s.byMistake = byMistake; s.equity = equity;
      return s;
    },

    /* reguły konta prop: zwraca stan konta, wykorzystanie limitów i status */
    prop: function (acc, trades) {
      var p = acc.prop || {}, start = +acc.startBalance || 0;
      var amt = function (v) { if (v === null || v === undefined || v === "") return null; var s = String(v).trim(); if (/%$/.test(s)) return start * parseFloat(s) / 100; return TT.num(s); };
      var target = amt(p.target), dailyLoss = amt(p.dailyLoss), maxDD = amt(p.maxDD);
      var bal = start, peak = start, minFloorGap = Infinity, violated = [], byDay = {};
      trades.forEach(function (t) {
        bal += +t.pnl || 0;
        var dk = TT.dayKey(date(t)); byDay[dk] = (byDay[dk] || 0) + (+t.pnl || 0);
        if (p.ddType === "trailing") peak = Math.min(Math.max(peak, bal), maxDD !== null ? start + maxDD : Infinity);
        var floor = maxDD !== null ? (p.ddType === "trailing" ? peak : start) - maxDD : null;
        if (floor !== null) minFloorGap = Math.min(minFloorGap, bal - floor);
      });
      var floorNow = maxDD !== null ? (p.ddType === "trailing" ? peak : start) - maxDD : null;
      if (floorNow !== null && minFloorGap < 0) violated.push("Max drawdown");
      var worstDay = 0, worstDayKey = null;
      Object.keys(byDay).forEach(function (k) { if (byDay[k] < worstDay) { worstDay = byDay[k]; worstDayKey = k; } });
      if (dailyLoss !== null && -worstDay > dailyLoss) violated.push("Dzienny limit straty (" + TT.fmtDate(worstDayKey) + ")");
      var todayPnl = byDay[TT.dayKey(new Date())] || 0;
      var profit = bal - start;
      var paid = (acc.payouts || []).reduce(function (a, x) { return a + (+x.amount || 0); }, 0);
      var days = Object.keys(byDay).length;
      var minDays = +p.minDays || 0;
      var passed = !violated.length && target !== null && profit >= target && days >= minDays;
      var split = p.split ? TT.num(p.split) / 100 : 1;
      var withdrawable = Math.max(0, profit - (acc.prop && acc.prop.phase === "funded" ? paid / (split || 1) : 0));
      var payoutEst = withdrawable * split;
      var payoutLimit = amt(p.payoutLimit);
      if (payoutLimit !== null) payoutEst = Math.min(payoutEst, payoutLimit);
      return {
        start: start, balance: bal, profit: profit, target: target, dailyLoss: dailyLoss, maxDD: maxDD, floor: floorNow,
        ddUsed: floorNow !== null ? Math.max(0, (p.ddType === "trailing" ? peak : start) - bal) : null,
        todayPnl: todayPnl, worstDay: worstDay, days: days, minDays: minDays, violated: violated, passed: passed,
        paid: paid, payoutEst: payoutEst, fee: TT.num(p.fee) || 0
      };
    }
  };
  function add(map, k, p) { (map[k] = map[k] || { net: 0, n: 0, w: 0 }); map[k].net += p; map[k].n++; if (p > 0) map[k].w++; }
})(window.TT);
