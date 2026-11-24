/* Raporty AI (Claude) — tygodniowe/miesięczne podsumowania dziennika + pytania do własnych danych.
   Klucz API trzymany tylko lokalnie na tym urządzeniu (nie trafia do Supabase). */
(function (TT) {
  "use strict";
  TT.views = TT.views || {};
  var E = TT.esc;
  var MODEL = "claude-opus-5-5";
  var busy = false;

  var SYSTEM = "Jesteś doświadczonym coachem tradingowym i analitykiem dziennika transakcji. Piszesz po polsku, konkretnie i bez lania wody. " +
    "Analizujesz wyłącznie dane z dziennika użytkownika: wyniki, setupy, tagi, błędy, notatki i samopoczucie. " +
    "Skupiasz się na procesie, dyscyplinie, zarządzaniu ryzykiem i powtarzalnych wzorcach — nie dajesz rekomendacji kupna ani sprzedaży konkretnych instrumentów. " +
    "Opieraj każdy wniosek na liczbach lub cytatach z notatek; jeśli danych jest za mało na wniosek, powiedz to wprost.";

  function periods() {
    var n = new Date(), sow = TT.startOfWeek(n), som = new Date(n.getFullYear(), n.getMonth(), 1);
    var prevW = new Date(sow); prevW.setDate(prevW.getDate() - 7);
    return {
      tw: { label: "Ten tydzień", from: sow, to: n },
      pw: { label: "Poprzedni tydzień", from: prevW, to: new Date(sow.getTime() - 1) },
      tm: { label: "Ten miesiąc", from: som, to: n },
      pm: { label: "Poprzedni miesiąc", from: new Date(n.getFullYear(), n.getMonth() - 1, 1), to: new Date(som.getTime() - 1) },
      d90: { label: "Ostatnie 90 dni", from: new Date(n.getTime() - 90 * 86400000), to: n }
    };
  }

  function context(from, to) {
    var acc = TT.store.currentAccount(), cur = TT.store.currencyOf(acc) || "waluta konta";
    var trades = TT.store.trades({ from: from, to: to }), s = TT.stats.compute(trades);
    var lines = trades.map(function (t) {
      var r = TT.stats.rMultiple(t);
      return [TT.fmtDateTime(t.entryTime), "→", TT.fmtDateTime(t.exitTime), t.symbol, t.side, "P/L " + (Math.round(t.pnl * 100) / 100),
        r !== null ? "R " + r.toFixed(2) : "", t.setup ? "setup: " + t.setup : "", (t.tags || []).length ? "tagi: " + t.tags.join(", ") : "",
        (t.mistakes || []).length ? "błędy: " + t.mistakes.join(", ") : "", t.rating ? "ocena " + t.rating + "/5" : "", t.notes ? "notatka: " + t.notes.replace(/\s+/g, " ").slice(0, 400) : ""
      ].filter(Boolean).join(" | ");
    });
    var notes = TT.store.all("daynote").filter(function (n) { var d = new Date(n.day); return d >= new Date(TT.dayKey(from)) && d <= to && (n.text || n.mood); })
      .sort(function (a, b) { return a.day.localeCompare(b.day); })
      .map(function (n) { return n.day + (n.mood ? " [" + n.mood + "]" : "") + ": " + (n.text || "").replace(/\s+/g, " ").slice(0, 600); });
    var prop = TT.store.accounts().filter(function (a) { return a.type === "prop" && (acc === "all" || a.id === acc); }).map(function (a) {
      var r = TT.stats.prop(a, TT.store.trades({ accountId: a.id }));
      return a.name + ": saldo " + r.balance.toFixed(2) + ", zysk " + r.profit.toFixed(2) + (r.target !== null ? " / cel " + r.target.toFixed(2) : "") + (r.violated.length ? ", NARUSZONE: " + r.violated.join(", ") : "");
    });
    var summary = "Okres: " + TT.fmtDate(from) + " – " + TT.fmtDate(to) + "\nKonto: " + (acc === "all" ? "wszystkie (bez backtestu)" : (TT.store.account(acc) || {}).name) + ", waluta: " + cur +
      "\nTransakcje: " + s.count + ", wynik netto: " + s.net.toFixed(2) + ", win rate: " + TT.pct(s.winRate) + ", profit factor: " + (s.profitFactor === null ? "—" : s.profitFactor === Infinity ? "∞" : s.profitFactor.toFixed(2)) +
      ", śr. zysk: " + (s.avgWin || 0).toFixed(2) + ", śr. strata: " + (s.avgLoss || 0).toFixed(2) + ", max DD: " + s.maxDD.toFixed(2) + ", śr. R: " + (s.avgR === null ? "—" : s.avgR.toFixed(2)) +
      ", dni handlowe: " + s.tradingDays + " (na plusie " + s.greenDays + "), opłaty: " + s.fees.toFixed(2);
    return { count: s.count, text: "<podsumowanie>\n" + summary + "\n</podsumowanie>\n\n<transakcje>\n" + (lines.join("\n") || "(brak)") + "\n</transakcje>\n\n<notatki_dnia>\n" + (notes.join("\n") || "(brak)") + "\n</notatki_dnia>" + (prop.length ? "\n\n<konta_prop>\n" + prop.join("\n") + "\n</konta_prop>" : "") };
  }

  async function ask(userText) {
    var key = TT.local.get("anthropicKey", "");
    if (!key) throw new Error("Dodaj klucz API Anthropic w Ustawieniach.");
    var res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "server-side-fallback-2026-07-01",
        "anthropic-dangerous-direct-browser-access": "true"
      },
      body: JSON.stringify({
        model: MODEL, max_tokens: 16000,
        output_config: { effort: "medium" },
        fallbacks: "default",
        system: SYSTEM,
        messages: [{ role: "user", content: userText }]
      })
    });
    var j = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error((j.error && j.error.message) || ("Błąd API " + res.status));
    if (j.stop_reason === "refusal") throw new Error("Model odmówił odpowiedzi na to zapytanie.");
    var text = (j.content || []).filter(function (b) { return b.type === "text"; }).map(function (b) { return b.text; }).join("\n").trim();
    if (j.stop_reason === "max_tokens") text += "\n\n_(odpowiedź ucięta — limit długości)_";
    return text;
  }

  TT.views.ai = {
    title: "Raporty AI",
    render: function (root) {
      var P = periods(), sel = TT.local.get("aiPeriod", "pw");
      var reports = TT.store.all("report").sort(function (a, b) { return (b.createdAt || "").localeCompare(a.createdAt || ""); });
      var openId = TT.local.get("aiOpen", reports[0] && reports[0].id);
      var open = reports.find(function (r) { return r.id === openId; }) || reports[0];
      var hasKey = !!TT.local.get("anthropicKey", "");
      root.innerHTML = '<div class="page"><div class="page-head"><h1>Raporty AI</h1><span class="sub">Claude analizuje dziennik: wyniki, setupy, błędy, notatki</span></div>' +
        (hasKey ? "" : '<div class="note" style="margin-bottom:12px;color:var(--orange)">Najpierw dodaj klucz API Anthropic w <a href="#" onclick="TT.app.go(\'settings\');return false">Ustawieniach</a>. Koszt jednego raportu to zwykle kilka–kilkanaście groszy.</div>') +
        '<div class="grid" style="grid-template-columns:300px minmax(0,1fr);align-items:start">' +
        '<div><div class="card" style="margin-bottom:12px"><h3>Nowy raport</h3><label class="field"><span>Okres</span><select class="inp" id="ai-p">' +
        Object.keys(P).map(function (k) { return '<option value="' + k + '"' + (k === sel ? " selected" : "") + ">" + P[k].label + "</option>"; }).join("") + '</select></label><p class="muted" style="font-size:12px">Konto: ' +
        E(TT.store.currentAccount() === "all" ? "wszystkie" : (TT.store.account(TT.store.currentAccount()) || {}).name) + ' (zmień u góry)</p><button class="btn primary" id="ai-gen" style="width:100%;justify-content:center"' + (busy ? " disabled" : "") + ">" + (busy ? "Generuję…" : "Generuj raport") + "</button></div>" +
        '<div class="card" style="margin-bottom:12px"><h3>Zapytaj o swoje dane (90 dni)</h3><textarea class="inp" id="ai-q" placeholder="np. W które godziny tracę najwięcej? Czy przesuwam SL?" style="min-height:70px"></textarea><button class="btn" id="ai-ask" style="margin-top:8px;width:100%;justify-content:center"' + (busy ? " disabled" : "") + ">Zapytaj</button></div>" +
        '<div class="card"><h3>Historia</h3>' + (reports.length ? reports.map(function (r) {
          return '<div class="wl-row' + (open && r.id === open.id ? " active" : "") + '" data-r="' + r.id + '" style="grid-template-columns:1fr auto;padding:7px 4px"><span><b>' + E(r.title) + '</b><br><span class="muted" style="font-size:11px">' + TT.fmtDateTime(r.createdAt) + '</span></span><button class="icon-btn" data-del="' + r.id + '">' + TT.icon("trash", 14) + "</button></div>";
        }).join("") : '<div class="muted">Brak raportów</div>') + "</div></div>" +
        '<div class="card" id="ai-out" style="min-height:300px">' + (open ? "<h3>" + E(open.title) + "</h3>" + TT.md(open.text) : '<div class="empty">Wygeneruj pierwszy raport — dostaniesz podsumowanie, mocne strony, powtarzające się błędy i 3 zadania na kolejny okres.</div>') + "</div></div></div>";
      root.querySelector("#ai-p").onchange = function () { TT.local.set("aiPeriod", this.value); };
      root.querySelectorAll("[data-r]").forEach(function (el) { el.onclick = function (e) { if (e.target.closest("[data-del]")) return; TT.local.set("aiOpen", el.dataset.r); TT.views.ai.render(root); }; });
      root.querySelectorAll("[data-del]").forEach(function (b) { b.onclick = function () { TT.store.remove(b.dataset.del); }; });
      root.querySelector("#ai-gen").onclick = function () {
        var p = P[root.querySelector("#ai-p").value], ctx = context(p.from, p.to);
        if (!ctx.count) { TT.toast("Brak transakcji w tym okresie", true); return; }
        run(root, p.label + " (" + TT.fmtDate(p.from) + "–" + TT.fmtDate(p.to) + ")", ctx.text +
          "\n\nNapisz raport z tego okresu w markdownie, z sekcjami: ## Podsumowanie (3–4 zdania z liczbami), ## Co działało, ## Błędy i powtarzające się wzorce, ## Psychologia i dyscyplina, ## Ryzyko, ## 3 zadania na kolejny okres (konkretne i mierzalne).");
      };
      root.querySelector("#ai-ask").onclick = function () {
        var q = root.querySelector("#ai-q").value.trim(); if (!q) return;
        var p = P.d90, ctx = context(p.from, p.to);
        run(root, "Pytanie: " + q.slice(0, 60), ctx.text + "\n\nPytanie użytkownika: " + q + "\nOdpowiedz zwięźle, w markdownie, opierając się na danych powyżej.");
      };
    }
  };

  async function run(root, title, prompt) {
    busy = true; TT.views.ai.render(root);
    root.querySelector("#ai-out").innerHTML = '<div class="empty">Claude analizuje dziennik… (zwykle 20–60 s)</div>';
    try {
      var text = await ask(prompt);
      var rep = TT.store.put("report", { title: title, text: text, createdAt: new Date().toISOString(), account: TT.store.currentAccount() }, true);
      TT.local.set("aiOpen", rep.id);
    } catch (e) { TT.toast(e.message, true); }
    busy = false;
    if (TT.app.view === "ai") TT.views.ai.render(root);
  }
})(window.TT);
