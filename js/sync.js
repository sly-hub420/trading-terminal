/* Synchronizacja z Supabase (ten sam projekt i to samo konto co Lodówka+).
   Model: tabela trading_docs (user_id, id, kind, data, deleted, updated_at), RLS = tylko własne wiersze.
   Konflikty: wygrywa nowsza wersja (updated_at). */
(function (TT) {
  "use strict";
  var SUPABASE_URL = "https://uctjvyzdqwmgwaoxtbwb.supabase.co";
  var SUPABASE_KEY = "sb_publishable_YfCG5DQsJbV5TFddC5-frg_qKTNaoin"; // klucz publiczny (publishable) — bezpieczny w przeglądarce, dostęp chroni RLS

  var sb = null, user = null, timer = null, busy = false, again = false, status = "local", lastError = "";
  var statusListeners = [];

  function setStatus(s, err) {
    status = s; lastError = err || "";
    statusListeners.forEach(function (fn) { fn(status, lastError); });
  }
  function lastPullKey() { return "lastPull." + (user ? user.id : "anon"); }

  var Y = TT.sync = {
    client: function () { return sb; },
    user: function () { return user; },
    status: function () { return status; },
    onStatus: function (fn) { statusListeners.push(fn); fn(status, lastError); },

    init: function () {
      if (!window.supabase || !window.supabase.createClient) { setStatus("err", "Nie wczytano biblioteki Supabase (brak internetu?)"); return; }
      sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, storageKey: "tt-auth", autoRefreshToken: true } });
      sb.auth.getSession().then(function (r) {
        user = r.data.session ? r.data.session.user : null;
        if (user) { setStatus("ok"); Y.syncNow(); } else setStatus("local");
      });
      sb.auth.onAuthStateChange(function (ev, session) {
        var prev = user ? user.id : null;
        user = session ? session.user : null;
        if (user && prev !== user.id) {
          if (TT.local.get("owner", null) !== user.id) { TT.store.markAllDirty(); TT.local.set("owner", user.id); }
          Y.syncNow();
        }
        if (!user) setStatus("local");
        TT.store.emit("auth");
      });
      window.addEventListener("focus", function () { if (user) Y.syncNow(); });
      setInterval(function () { if (user) Y.syncNow(); }, 60000);
    },

    signIn: function (email, password) { return sb.auth.signInWithPassword({ email: email, password: password }); },
    signUp: function (email, password) { return sb.auth.signUp({ email: email, password: password }); },
    signOut: function () { return sb.auth.signOut(); },

    schedule: function () {
      if (!user) return;
      clearTimeout(timer);
      timer = setTimeout(Y.syncNow, 1500);
    },

    syncNow: async function () {
      if (!sb || !user) return;
      if (busy) { again = true; return; }
      busy = true; setStatus("busy");
      try {
        // 1) wyślij lokalne zmiany
        var dirty = TT.store.dirtyDocs();
        for (var i = 0; i < dirty.length; i += 400) {
          var chunk = dirty.slice(i, i + 400);
          var rows = chunk.map(function (d) {
            return { user_id: user.id, id: d.id, kind: d.kind, data: d.data, deleted: !!d.deleted, updated_at: d.updated_at };
          });
          var up = await sb.from("trading_docs").upsert(rows, { onConflict: "user_id,id" });
          if (up.error) throw up.error;
          TT.store.markClean(chunk);
        }
        // 2) pobierz zmiany z innych urządzeń (z 10-min zapasem na różnice zegarów)
        var since = TT.local.get(lastPullKey(), null);
        var startedAt = new Date().toISOString();
        var from = 0, page = 1000, all = [];
        while (true) {
          var q = sb.from("trading_docs").select("id,kind,data,deleted,updated_at").order("updated_at", { ascending: true }).range(from, from + page - 1);
          if (since) q = q.gt("updated_at", new Date(new Date(since).getTime() - 600000).toISOString());
          var res = await q;
          if (res.error) throw res.error;
          all = all.concat(res.data || []);
          if (!res.data || res.data.length < page) break;
          from += page;
        }
        TT.store.mergeRemote(all);
        TT.local.set(lastPullKey(), startedAt);
        TT.local.set("lastSyncAt", new Date().toISOString());
        setStatus("ok");
      } catch (e) {
        console.error("sync", e);
        setStatus("err", e.message || String(e));
      } finally {
        busy = false;
        if (again) { again = false; Y.syncNow(); }
      }
    },

    /* stare dane z P/L Ledgera zapisane w Lodówka+ (tabela pnl_state) */
    fetchLegacyPnl: async function () {
      if (!sb || !user) return null;
      var r = await sb.from("pnl_state").select("data").eq("user_id", user.id).maybeSingle();
      if (r.error || !r.data) return null;
      var raw = r.data.data && r.data.data.pnlTrackerTrades;
      try { return typeof raw === "string" ? JSON.parse(raw) : raw; } catch (e) { return null; }
    }
  };
})(window.TT);
