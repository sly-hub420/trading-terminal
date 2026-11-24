/* Ustawienia: konto i sync, klucze, importy, listy, kopia zapasowa */
(function (TT) {
  "use strict";
  TT.views = TT.views || {};
  var E = TT.esc;

  TT.authModal = function () {
    var u = TT.sync.user();
    if (u) {
      TT.modal({ title: "Konto i synchronizacja", body: "<p>Zalogowano jako <b>" + E(u.email) + "</b>.</p><p class='muted'>Dane terminala synchronizują się z Supabase (to samo konto co Lodówka+). Ostatnia synchronizacja: " + TT.fmtDateTime(TT.local.get("lastSyncAt", null)) + "</p>",
        foot: [{ label: "Synchronizuj teraz", onClick: function () { TT.sync.syncNow(); } }, { label: "Wyloguj", cls: "danger", onClick: function () { TT.sync.signOut(); } }] });
      return;
    }
    var body = '<p class="muted">Zaloguj się tym samym e-mailem i hasłem co w Lodówka+. Dane z tego laptopa zostaną wysłane na konto i będą dostępne na innych urządzeniach.</p>' +
      '<div class="form-grid"><label class="field full"><span>E-mail</span><input class="inp" id="au-e" type="email" autocomplete="username"></label><label class="field full"><span>Hasło</span><input class="inp" id="au-p" type="password" autocomplete="current-password"></label></div><p id="au-err" style="color:var(--red)"></p>';
    TT.modal({ title: "Logowanie", body: body, foot: [
      { label: "Załóż konto", keepOpen: true, onClick: function (m) { go(m, "up"); } },
      { label: "Zaloguj", cls: "primary", keepOpen: true, onClick: function (m) { go(m, "in"); } }
    ], onOpen: function (m) { setTimeout(function () { m.el.querySelector("#au-e").focus(); }, 30); m.el.querySelector("#au-p").onkeydown = function (e) { if (e.key === "Enter") go(m, "in"); }; } });
    async function go(m, mode) {
      var e = m.el.querySelector("#au-e").value.trim(), p = m.el.querySelector("#au-p").value, err = m.el.querySelector("#au-err");
      if (!e || !p) { err.textContent = "Podaj e-mail i hasło"; return; }
      err.textContent = "…";
      var r = mode === "in" ? await TT.sync.signIn(e, p) : await TT.sync.signUp(e, p);
      if (r.error) { err.textContent = r.error.message; return; }
      if (mode === "up" && !r.data.session) { err.textContent = "Sprawdź skrzynkę — potwierdź e-mail, potem się zaloguj."; return; }
      m.close(); TT.toast("Zalogowano — synchronizuję dane");
    }
  };

  TT.views.settings = {
    title: "Ustawienia",
    render: function (root) {
      var st = TT.store.settings(), u = TT.sync.user();
      var accs = TT.store.accounts().filter(function (a) { return a.type !== "backtest"; });
      var curAcc = TT.store.currentAccount();
      var accOpts = function (pref) { return accs.map(function (a) { return '<option value="' + a.id + '"' + (a.id === pref ? " selected" : "") + ">" + E(a.name) + " (" + a.currency + ")</option>"; }).join(""); };
      var tvDefault = (accs.find(function (a) { return /tradingview/i.test(a.broker || "") || a.type === "paper"; }) || accs[0] || {}).id;
      var xtbDefault = (accs.find(function (a) { return /xtb/i.test(a.broker || ""); }) || {}).id;
      root.innerHTML = '<div class="page"><div class="page-head"><h1>Ustawienia i import</h1></div>' +
        '<div class="card" style="margin-bottom:12px;display:flex;align-items:center;gap:14px"><label style="display:flex;align-items:center;gap:10px;cursor:pointer;flex:1"><input type="checkbox" id="st-beg"' + (TT.beginner() ? " checked" : "") + ' style="width:18px;height:18px">' +
        '<span><b style="color:var(--text-strong)">Tryb początkującego</b><br><span class="muted">Prostszy formularz, objaśnienia przy liczbach, schowane zaawansowane narzędzia (prop firmy, Fibonacci, pomiar). Wyłącz, gdy poczujesz się pewnie.</span></span></label></div>' +
        '<div class="grid g2" style="align-items:start">' +

        '<div class="card"><h3>Import transakcji</h3>' +
        '<p><b>TradingView Paper Trading</b><br><span class="muted">Panel handlu → Paper Trading → Historia (History) → ikona eksportu → „Historia zleceń” (Order History) → plik .csv. Zlecenia są łączone FIFO w zamknięte transakcje z wejściem, wyjściem i czasem. Ponowny import tego samego pliku nie zdubluje danych.</span></p>' +
        '<div style="display:flex;gap:8px;margin-bottom:16px"><select class="inp" id="im-tv-acc">' + accOpts(curAcc !== "all" ? curAcc : tvDefault) + '</select><button class="btn primary" id="im-tv">Wybierz CSV</button></div>' +
        '<p><b>XTB xStation 5</b><br><span class="muted">Historia konta → Zamknięte pozycje → wybierz zakres → Eksport (Excel .xlsx). XTB nie ma już publicznego API, więc import jest z pliku.</span></p>' +
        '<div style="display:flex;gap:8px;margin-bottom:16px"><select class="inp" id="im-xtb-acc"><option value="">— wybierz / utwórz konto XTB —</option>' + accOpts(xtbDefault) + '</select><button class="btn primary" id="im-xtb">Wybierz XLSX/CSV</button></div>' +
        '<p><b>Stary P/L Ledger</b><br><span class="muted">Przenosi trejdy z pnl-tracker.html (z tej przeglądarki) i z Lodówka+ (po zalogowaniu).</span></p>' +
        '<div style="display:flex;gap:8px"><select class="inp" id="im-lg-acc">' + accOpts(tvDefault) + '</select><button class="btn" id="im-lg">Przenieś</button></div>' +
        '<input type="file" id="im-file" class="hidden"></div>' +

        '<div class="card"><h3>Konto i synchronizacja</h3>' +
        (u ? "<p>Zalogowano: <b>" + E(u.email) + '</b></p><p class="muted">Ostatnia synchronizacja: ' + TT.fmtDateTime(TT.local.get("lastSyncAt", null)) + '</p><button class="btn" id="st-sync">Synchronizuj teraz</button> <button class="btn danger" id="st-out">Wyloguj</button>'
          : '<p class="muted">Dane są teraz tylko na tym urządzeniu. Zaloguj się kontem z Lodówka+, aby mieć je wszędzie.</p><button class="btn primary" id="st-in">Zaloguj</button>') +
        '<h3 style="margin-top:18px">Dane rynkowe</h3><label class="field"><span>Klucz Twelve Data (forex, złoto, indeksy, akcje)</span><input class="inp" id="st-td" value="' + E(TT.local.get("tdKey", "")) + '" placeholder="darmowy klucz z twelvedata.com"></label>' +
        '<label class="field" style="margin-top:8px"><span>Aliasy symboli (XTB → źródło danych), po jednym w linii</span><textarea class="inp" id="st-al" style="min-height:60px" placeholder="US100=NDX&#10;DE40=DAX">' + E(TT.local.get("aliases", "")) + "</textarea></label>" +
        '<h3 style="margin-top:18px">Raporty AI</h3><label class="field"><span>Klucz API Anthropic (tylko na tym urządzeniu)</span><input class="inp" id="st-ak" type="password" value="' + E(TT.local.get("anthropicKey", "")) + '" placeholder="sk-ant-…"></label>' +
        '<button class="btn primary" id="st-save-keys" style="margin-top:10px">Zapisz</button></div>' +

        '<div class="card"><h3>Listy w dzienniku</h3>' +
        '<label class="field"><span>Setupy (po przecinku)</span><textarea class="inp" id="st-setups" style="min-height:54px">' + E(st.setups.join(", ")) + "</textarea></label>" +
        '<label class="field" style="margin-top:8px"><span>Tagi</span><textarea class="inp" id="st-tags" style="min-height:54px">' + E(st.tags.join(", ")) + "</textarea></label>" +
        '<label class="field" style="margin-top:8px"><span>Błędy</span><textarea class="inp" id="st-mis" style="min-height:54px">' + E(st.mistakes.join(", ")) + "</textarea></label>" +
        '<button class="btn primary" id="st-save-lists" style="margin-top:10px">Zapisz listy</button></div>' +

        '<div class="card"><h3>Konta</h3><p class="muted">Paper (TradingView), realne (XTB), prop firmy i backtest — zarządzasz nimi w zakładce Prop firmy.</p><button class="btn" onclick="TT.app.go(\'prop\')">Zarządzaj kontami</button>' +
        '<h3 style="margin-top:18px">Kopia zapasowa</h3><p class="muted">Pełny eksport wszystkich danych do pliku JSON.</p><button class="btn" id="st-exp">Eksportuj JSON</button> <button class="btn" id="st-imp">Wczytaj kopię</button></div>' +
        "</div></div>";

      root.querySelector("#st-beg").onchange = function () {
        TT.local.set("beginner", this.checked);
        if (!this.checked && TT.chart.tool !== "cursor") TT.chart.setTool("cursor");
        TT.app.renderRail(); TT.app.renderTools();
        TT.toast(this.checked ? "Włączono tryb początkującego" : "Wyłączono tryb początkującego — wszystkie funkcje widoczne");
      };
      var file = root.querySelector("#im-file"), pending = null;
      file.onchange = async function () {
        var f = file.files[0]; file.value = ""; if (!f || !pending) return;
        try { await pending(f); } catch (e) { TT.toast(e.message || String(e), true); }
      };
      function pick(accept, fn) { pending = fn; file.accept = accept; file.click(); }
      function report(r, label) {
        if (!r || r.error) { TT.modal({ title: "Import nieudany", body: "<p>" + E(r ? r.error : "Nieznany błąd") + "</p>", foot: [{ label: "OK" }] }); return; }
        TT.toast(label + ": dodano " + r.added + (r.skipped ? ", pominięto " + r.skipped + " już zaimportowanych" : "") + (r.open ? " · otwarte pozycje: " + r.open : ""));
      }
      root.querySelector("#im-tv").onclick = function () {
        var acc = root.querySelector("#im-tv-acc").value;
        pick(".csv", async function (f) { report(TT.importTradingView(await f.text(), acc), "TradingView"); });
      };
      root.querySelector("#im-xtb").onclick = function () {
        var acc = root.querySelector("#im-xtb-acc").value;
        if (!acc) { var a = TT.store.put("account", { name: "XTB", type: "live", broker: "XTB", currency: "PLN", startBalance: 0, createdAt: new Date().toISOString() }, true); acc = a.id; TT.toast("Utworzono konto XTB (PLN) — saldo początkowe ustaw w Prop firmy → Wszystkie konta"); }
        pick(".xlsx,.xls,.csv", async function (f) { report(await TT.importXTBFile(f, acc), "XTB"); });
      };
      root.querySelector("#im-lg").onclick = async function () {
        var acc = root.querySelector("#im-lg-acc").value, total = { added: 0, skipped: 0 }, found = false;
        try { var loc = JSON.parse(localStorage.getItem("pnlTrackerTrades") || "null"); if (loc) { found = true; var r1 = TT.importLegacy(loc, acc); total.added += r1.added; total.skipped += r1.skipped; } } catch (e) {}
        var remote = await TT.sync.fetchLegacyPnl();
        if (remote) { found = true; var r2 = TT.importLegacy(remote, acc); total.added += r2.added; total.skipped += r2.skipped; }
        if (!found) TT.toast(u ? "Nie znaleziono danych P/L Ledgera" : "Nie znaleziono danych w tej przeglądarce — zaloguj się, aby pobrać je z Lodówka+", true);
        else report(total, "P/L Ledger");
      };
      if (u) {
        root.querySelector("#st-sync").onclick = function () { TT.sync.syncNow(); };
        root.querySelector("#st-out").onclick = function () { TT.sync.signOut(); };
      } else root.querySelector("#st-in").onclick = TT.authModal;
      root.querySelector("#st-save-keys").onclick = function () {
        TT.local.set("tdKey", root.querySelector("#st-td").value.trim());
        TT.local.set("aliases", root.querySelector("#st-al").value);
        TT.local.set("anthropicKey", root.querySelector("#st-ak").value.trim());
        TT.toast("Zapisano");
      };
      var split = function (id) { return root.querySelector(id).value.split(",").map(function (s) { return s.trim(); }).filter(Boolean); };
      root.querySelector("#st-save-lists").onclick = function () { st.setups = split("#st-setups"); st.tags = split("#st-tags"); st.mistakes = split("#st-mis"); TT.store.saveSettings(st); TT.toast("Zapisano listy"); };
      root.querySelector("#st-exp").onclick = function () {
        var blob = new Blob([JSON.stringify({ app: "trading-terminal", exportedAt: new Date().toISOString(), docs: TT.store.raw() }, null, 1)], { type: "application/json" });
        var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "trading-terminal-" + TT.dayKey(new Date()) + ".json"; a.click();
      };
      root.querySelector("#st-imp").onclick = function () {
        pick(".json", async function (f) {
          var j = JSON.parse(await f.text());
          if (!j.docs) throw new Error("To nie jest kopia terminala");
          TT.confirm("Wczytać kopię?", "Obecne dane na tym urządzeniu zostaną zastąpione kopią z " + TT.fmtDateTime(j.exportedAt) + ".", function () {
            TT.store.replaceAll(j.docs); TT.store.markAllDirty(); TT.sync.schedule(); TT.toast("Wczytano kopię");
          }, "Wczytaj");
        });
      };
    }
  };
})(window.TT);
