/* Lokalny magazyn dokumentów (localStorage) — źródło prawdy offline; sync.js wysyła/pobiera z Supabase */
(function (TT) {
  "use strict";
  var KEY = "tt.docs.v1";
  var docs = {};
  var listeners = [];
  var saveTimer = null;

  function load() {
    try { docs = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) { docs = {}; }
  }
  function persist() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try { localStorage.setItem(KEY, JSON.stringify(docs)); }
      catch (e) { TT.toast("Nie udało się zapisać danych lokalnie (pełna pamięć przeglądarki?)", true); }
    }, 50);
  }
  function emit(reason) { listeners.forEach(function (fn) { try { fn(reason); } catch (e) { console.error(e); } }); }

  var S = TT.store = {
    onChange: function (fn) { listeners.push(fn); },
    emit: emit,
    raw: function () { return docs; },
    get: function (id) { var d = docs[id]; return d && !d.deleted ? d.data : null; },
    all: function (kind) {
      var out = [];
      for (var id in docs) { var d = docs[id]; if (d.kind === kind && !d.deleted) out.push(d.data); }
      return out;
    },
    /* zapis lokalny + oznaczenie do wysłania */
    put: function (kind, data, silent) {
      if (!data.id) data.id = TT.uid(kind.slice(0, 2) + "_");
      docs[data.id] = { id: data.id, kind: kind, data: data, updated_at: new Date().toISOString(), deleted: false, dirty: true };
      persist();
      if (!silent) emit(kind);
      if (TT.sync) TT.sync.schedule();
      return data;
    },
    putMany: function (kind, list) {
      var now = new Date().toISOString();
      list.forEach(function (data) {
        if (!data.id) data.id = TT.uid(kind.slice(0, 2) + "_");
        docs[data.id] = { id: data.id, kind: kind, data: data, updated_at: now, deleted: false, dirty: true };
      });
      persist(); emit(kind);
      if (TT.sync) TT.sync.schedule();
    },
    remove: function (id) {
      var d = docs[id];
      if (!d) return;
      docs[id] = { id: id, kind: d.kind, data: {}, updated_at: new Date().toISOString(), deleted: true, dirty: true };
      persist(); emit(d.kind);
      if (TT.sync) TT.sync.schedule();
    },
    /* używane przez sync */
    dirtyDocs: function () { var out = []; for (var id in docs) if (docs[id].dirty) out.push(docs[id]); return out; },
    markClean: function (list) { list.forEach(function (d) { var cur = docs[d.id]; if (cur && cur.updated_at === d.updated_at) cur.dirty = false; }); persist(); },
    mergeRemote: function (rows) {
      var changed = false;
      rows.forEach(function (r) {
        var cur = docs[r.id];
        var rt = new Date(r.updated_at).getTime();
        if (cur && new Date(cur.updated_at).getTime() >= rt) return; // lokalna wersja nowsza lub ta sama
        docs[r.id] = { id: r.id, kind: r.kind, data: r.data || {}, updated_at: new Date(rt).toISOString(), deleted: !!r.deleted, dirty: false };
        changed = true;
      });
      if (changed) { persist(); emit("remote"); }
      return changed;
    },
    markAllDirty: function () { for (var id in docs) docs[id].dirty = true; persist(); },
    replaceAll: function (obj) { docs = obj || {}; persist(); emit("all"); }
  };

  /* ---------- wygodne akcesory domenowe ---------- */
  S.accounts = function () {
    return S.all("account").sort(function (a, b) { return (a.createdAt || "").localeCompare(b.createdAt || ""); });
  };
  S.account = function (id) { return S.get(id); };
  S.settings = function () {
    return S.get("settings") || {
      id: "settings",
      setups: ["Breakout", "Pullback", "Reversal", "Range", "News"],
      tags: ["A+", "Trend", "Kontra-trend", "Sesja Londyn", "Sesja NY"],
      mistakes: ["FOMO", "Za wczesne wyjście", "Przesunięty SL", "Overtrading", "Brak planu", "Revenge trade"]
    };
  };
  S.saveSettings = function (s) { s.id = "settings"; S.put("settings", s); };

  /* aktualnie wybrane konto: "all" albo id konta (lokalnie na urządzeniu) */
  S.currentAccount = function () { return TT.local.get("account", "all"); };
  S.setCurrentAccount = function (id) { TT.local.set("account", id); emit("account-select"); };

  S.tradeDate = function (t) { return t.exitTime || t.entryTime; };
  S.trades = function (f) {
    f = f || {};
    var acc = f.accountId === undefined ? S.currentAccount() : f.accountId;
    var from = f.from ? +new Date(f.from) : null, to = f.to ? +new Date(f.to) : null;
    return S.all("trade").filter(function (t) {
      if (acc && acc !== "all" && t.accountId !== acc) return false;
      if (acc === "all" && f.excludeBacktest !== false) {
        var a = S.get(t.accountId); if (a && a.type === "backtest") return false;
      }
      var d = +new Date(S.tradeDate(t));
      if (from !== null && d < from) return false;
      if (to !== null && d > to) return false;
      if (f.symbol && t.symbol !== f.symbol) return false;
      return true;
    }).sort(function (a, b) { return new Date(S.tradeDate(a)) - new Date(S.tradeDate(b)); });
  };
  S.currencyOf = function (accId) {
    if (accId && accId !== "all") { var a = S.get(accId); return a ? a.currency : "USD"; }
    var curs = {}; S.accounts().forEach(function (a) { if (a.type !== "backtest") curs[a.currency] = 1; });
    var k = Object.keys(curs); return k.length === 1 ? k[0] : "";
  };

  S.ensureDefaults = function () {
    if (!S.accounts().length) {
      S.put("account", { id: "acc_tv_paper", name: "TradingView Paper", type: "paper", broker: "TradingView", currency: "USD", startBalance: 100000, createdAt: new Date().toISOString() }, true);
    }
  };

  load();
})(window.TT);
