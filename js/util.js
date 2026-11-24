/* Wspólne narzędzia: formatowanie, daty, modal, toast, ikony */
window.TT = window.TT || {};
(function (TT) {
  "use strict";

  TT.esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  TT.uid = function (prefix) {
    return (prefix || "") + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  };
  TT.num = function (v) {
    if (v === null || v === undefined || v === "") return null;
    if (typeof v === "number") return isFinite(v) ? v : null;
    var s = String(v).trim().replace(/\s/g, "").replace(/[^\d,.\-+eE]/g, "");
    if (/,\d+$/.test(s) && s.indexOf(".") >= 0 && s.lastIndexOf(",") > s.lastIndexOf(".")) s = s.replace(/\./g, "").replace(",", ".");
    else if (/^-?\d+,\d+$/.test(s)) s = s.replace(",", ".");
    else s = s.replace(/,/g, "");
    var n = parseFloat(s);
    return isFinite(n) ? n : null;
  };

  var CUR_SYM = { USD: "$", EUR: "€", GBP: "£", PLN: " zł" };
  TT.money = function (n, cur, opts) {
    if (n === null || n === undefined || isNaN(n)) return "—";
    opts = opts || {};
    var sign = n < 0 ? "−" : (opts.plus && n > 0 ? "+" : "");
    var abs = Math.abs(n);
    var body = abs.toLocaleString("pl-PL", { minimumFractionDigits: opts.dec === 0 ? 0 : 2, maximumFractionDigits: opts.dec === 0 ? 0 : 2 });
    var sym = cur === undefined ? "" : (CUR_SYM[cur] || (cur ? " " + cur : ""));
    if (sym === "$" || sym === "€" || sym === "£") return sign + sym + body;
    return sign + body + sym;
  };
  TT.compact = function (n) {
    if (n === null || isNaN(n)) return "—";
    var a = Math.abs(n), s = n < 0 ? "−" : "+";
    if (a >= 1e6) return s + (a / 1e6).toFixed(1) + "M";
    if (a >= 1e4) return s + (a / 1e3).toFixed(1) + "k";
    if (a >= 100) return s + a.toFixed(0);
    return s + a.toFixed(2);
  };
  TT.pct = function (n, dec) { return n === null || n === undefined || isNaN(n) ? "—" : n.toFixed(dec === undefined ? 1 : dec) + "%"; };
  TT.price = function (n) {
    if (n === null || n === undefined || isNaN(n)) return "—";
    var a = Math.abs(n), d = a >= 1000 ? 2 : a >= 10 ? 3 : 5;
    return Number(n).toFixed(d).replace(/0+$/, "").replace(/\.$/, "");
  };
  TT.cls = function (n) { return n > 0 ? "pos" : n < 0 ? "neg" : ""; };

  /* ---- daty (wszystko jako ISO w UTC, wyświetlanie lokalnie) ---- */
  TT.pad = function (n) { return String(n).padStart(2, "0"); };
  TT.dayKey = function (d) {
    d = d instanceof Date ? d : new Date(d);
    return d.getFullYear() + "-" + TT.pad(d.getMonth() + 1) + "-" + TT.pad(d.getDate());
  };
  TT.fmtDate = function (iso) {
    if (!iso) return "—";
    var d = new Date(iso);
    return TT.pad(d.getDate()) + "." + TT.pad(d.getMonth() + 1) + "." + d.getFullYear();
  };
  TT.fmtDateTime = function (iso) {
    if (!iso) return "—";
    var d = new Date(iso);
    return TT.fmtDate(iso) + " " + TT.pad(d.getHours()) + ":" + TT.pad(d.getMinutes());
  };
  TT.toLocalInput = function (iso) {
    if (!iso) return "";
    var d = new Date(iso);
    return d.getFullYear() + "-" + TT.pad(d.getMonth() + 1) + "-" + TT.pad(d.getDate()) + "T" + TT.pad(d.getHours()) + ":" + TT.pad(d.getMinutes());
  };
  TT.fromLocalInput = function (v) { if (!v) return null; var d = new Date(v); return isNaN(d) ? null : d.toISOString(); };
  /* Parsuje daty z eksportów: ISO, "dd.mm.yyyy hh:mm(:ss)", "yyyy-mm-dd hh:mm:ss", Date, numer seryjny Excela */
  TT.parseAnyDate = function (v) {
    if (v === null || v === undefined || v === "") return null;
    if (v instanceof Date) return isNaN(v) ? null : v;
    if (typeof v === "number") { // Excel serial (dni od 1899-12-30), czas lokalny
      var ms = Math.round((v - 25569) * 86400000);
      var u = new Date(ms);
      return new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate(), u.getUTCHours(), u.getUTCMinutes(), u.getUTCSeconds());
    }
    var s = String(v).trim();
    var m = s.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})[ T,]*(\d{1,2})?:?(\d{2})?:?(\d{2})?/);
    if (m) return new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
    var d = new Date(s);
    return isNaN(d) ? null : d;
  };
  TT.startOfWeek = function (d) { var x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); var wd = (x.getDay() + 6) % 7; x.setDate(x.getDate() - wd); return x; };
  TT.MONTHS = ["Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec", "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"];
  TT.WD = ["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"];

  /* ---- lokalne ustawienia (tylko to urządzenie, nie są synchronizowane) ---- */
  TT.local = {
    get: function (k, def) { try { var v = localStorage.getItem("tt.local." + k); return v === null ? def : JSON.parse(v); } catch (e) { return def; } },
    set: function (k, v) { try { localStorage.setItem("tt.local." + k, JSON.stringify(v)); } catch (e) {} }
  };

  /* ---- tryb początkującego (domyślnie włączony) ---- */
  TT.beginner = function () { return TT.local.get("beginner", true); };
  TT.sideLabel = function (side) { return side === "short" ? "SELL" : "BUY"; };

  /* słowniczek — krótkie wyjaśnienia „po ludzku”, pokazywane w dymkach ⓘ i na stronie Start */
  TT.GLOSSARY = {
    buy: ["Buy (kupno)", "Zakładasz, że cena WZROŚNIE. Zarabiasz, gdy cena idzie w górę."],
    sell: ["Sell (sprzedaż)", "Zakładasz, że cena SPADNIE. Zarabiasz, gdy cena idzie w dół. Nie musisz mieć instrumentu — to normalne na CFD i forex."],
    sl: ["Stop loss (SL)", "Cena, przy której pozycja zamyka się sama ze stratą. To Twój bezpiecznik — ustawiaj go ZAWSZE, zanim wejdziesz."],
    tp: ["Take profit (TP)", "Cena, przy której pozycja zamyka się sama z zyskiem. Plan, ile chcesz zarobić."],
    qty: ["Ilość / wolumen", "Jak dużą pozycję otwierasz. W TradingView forex podaje się w jednostkach (10 000 = 0,1 lota), w XTB w lotach (1 lot = 100 000 jednostek waluty)."],
    lot: ["Lot", "Standardowa wielkość na forexie: 1 lot = 100 000 jednostek waluty bazowej, 0,1 lota (mini) = 10 000, 0,01 (mikro) = 1 000. Na złocie 1 lot = 100 uncji."],
    pnl: ["Zysk / strata", "Ile zarobiłeś albo straciłeś na transakcji, już po opłatach."],
    winRate: ["Skuteczność (win rate)", "Jaki procent transakcji kończy się zyskiem. 50% = co druga wygrana. Sama w sobie niewiele mówi — liczy się też, ile zarabiasz vs. tracisz."],
    rr: ["Zysk do ryzyka (R:R)", "Ile możesz zarobić w porównaniu z tym, ile ryzykujesz. 1:2 = ryzykujesz 100 zł, żeby zarobić 200 zł. Przy 1:2 wystarczy wygrywać ~34% transakcji, żeby wychodzić na plus."],
    risk: ["Ryzyko na transakcję", "Kwota, którą stracisz, jeśli zadziała stop loss. Popularna zasada dla początkujących: max 1% konta na jedną transakcję."],
    r: ["R (wielokrotność ryzyka)", "Wynik mierzony w jednostkach ryzyka. +2R = zarobiłeś 2× tyle, ile ryzykowałeś. −1R = trafił stop loss."],
    profitFactor: ["Profit factor", "Suma zysków podzielona przez sumę strat. Powyżej 1 = zarabiasz, poniżej 1 = tracisz. 1,5+ to już dobry wynik."],
    expectancy: ["Średni wynik na transakcję", "Ile średnio zarabiasz (albo tracisz) na jednej transakcji. Jeśli jest na plusie, Twój sposób grania ma sens w dłuższym okresie."],
    drawdown: ["Największy spadek (drawdown)", "Największa strata od szczytu konta do dołka. Pokazuje, jak bolesne potrafią być złe serie."],
    spread: ["Spread", "Różnica między ceną kupna i sprzedaży — ukryty koszt każdej transakcji. Dlatego zaraz po otwarciu pozycja jest lekko na minusie."],
    pip: ["Pips", "Najmniejszy typowy ruch na forexie: 0,0001 dla EURUSD, 0,01 dla par z JPY (np. USDJPY)."],
    paper: ["Paper trading", "Handel na wirtualnych pieniądzach (np. w TradingView). Idealny do nauki — ćwicz tu, zanim wpłacisz prawdziwe pieniądze do XTB."],
    replay: ["Replay", "Odtwarzanie historii wykresu świeca po świecy. Ćwiczysz wejścia z SL i TP tak, jakby rynek działał na żywo — bez ryzyka."],
    news: ["Ważne dane makro", "Publikacje typu stopy procentowe, inflacja (CPI), rynek pracy (NFP). W tych minutach cena potrafi gwałtownie skakać i omijać stop lossy — początkującym lepiej wtedy nie mieć otwartych pozycji."],
    candle: ["Świeca", "Jeden słupek na wykresie = ruch ceny w danym czasie (np. 15 min). Zielona: cena wzrosła, czerwona: spadła. Knoty pokazują najwyższą i najniższą cenę."]
  };
  /* kwota w walucie kwotowanej pary forex → USD (gdy się da). label = waluta, gdy nie da się przeliczyć */
  var FX = ["USD", "EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "NZD", "PLN", "SEK", "NOK", "HUF", "CZK", "TRY", "ZAR", "MXN"];
  TT.fxValue = function (symbol, amount, price) {
    var s = String(symbol || "").toUpperCase(); if (s.indexOf(":") >= 0) s = s.split(":")[1]; s = s.replace("/", "");
    if (!/^[A-Z]{6}$/.test(s)) return { value: amount, label: "" };
    var b = s.slice(0, 3), q = s.slice(3);
    if (FX.indexOf(b) < 0 || FX.indexOf(q) < 0 || q === "USD") return { value: amount, label: "" };
    if (b === "USD" && price) return { value: amount / price, label: "" };
    return { value: amount, label: q };
  };
  TT.help = function (key) {
    var g = TT.GLOSSARY[key]; if (!g) return "";
    return '<span class="help" tabindex="0" data-help="' + TT.esc(g[0] + " — " + g[1]) + '">i</span>';
  };

  /* ---- toast ---- */
  TT.toast = function (msg, isErr) {
    var root = document.getElementById("toast");
    var el = document.createElement("div");
    el.className = "toast" + (isErr ? " err" : "");
    el.textContent = msg;
    root.appendChild(el);
    setTimeout(function () { el.remove(); }, isErr ? 6000 : 3000);
  };

  /* ---- modal ---- */
  TT.modal = function (opts) {
    var root = document.getElementById("modal-root");
    var back = document.createElement("div");
    back.className = "modal-back";
    back.innerHTML = '<div class="modal ' + (opts.wide ? "wide" : "") + '"><div class="modal-head"><h2>' + TT.esc(opts.title) +
      '</h2><button class="icon-btn" data-x>' + TT.icon("close") + '</button></div><div class="modal-body"></div>' +
      (opts.foot ? '<div class="modal-foot"></div>' : "") + "</div>";
    var body = back.querySelector(".modal-body");
    if (typeof opts.body === "string") body.innerHTML = opts.body; else if (opts.body) body.appendChild(opts.body);
    if (opts.foot) {
      var foot = back.querySelector(".modal-foot");
      opts.foot.forEach(function (b) {
        var btn = document.createElement("button");
        btn.className = "btn " + (b.cls || "");
        btn.textContent = b.label;
        btn.onclick = function () { if (b.onClick && b.onClick(api) === false) return; if (!b.keepOpen) api.close(); };
        foot.appendChild(btn);
      });
    }
    var api = {
      el: back, body: body,
      close: function () { back.remove(); document.removeEventListener("keydown", onKey); if (opts.onClose) opts.onClose(); }
    };
    function onKey(e) { if (e.key === "Escape") api.close(); }
    document.addEventListener("keydown", onKey);
    back.querySelector("[data-x]").onclick = api.close;
    back.addEventListener("mousedown", function (e) { if (e.target === back) api.close(); });
    root.appendChild(back);
    if (opts.onOpen) opts.onOpen(api);
    return api;
  };
  TT.confirm = function (title, text, onYes, yesLabel) {
    TT.modal({ title: title, body: "<p>" + TT.esc(text) + "</p>", foot: [{ label: "Anuluj" }, { label: yesLabel || "Usuń", cls: "danger", onClick: onYes }] });
  };

  TT.loadScript = function (src) {
    return new Promise(function (resolve, reject) {
      if (document.querySelector('script[src="' + src + '"]')) return resolve();
      var s = document.createElement("script");
      s.src = src; s.onload = resolve; s.onerror = function () { reject(new Error("Nie udało się wczytać " + src)); };
      document.head.appendChild(s);
    });
  };

  /* prosty renderer markdownu dla raportów AI (tekst jest najpierw escapowany) */
  TT.md = function (src) {
    var lines = TT.esc(src || "").split(/\r?\n/), out = [], inList = false;
    function inline(s) { return s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/(^|[^*])\*(?!\s)(.+?)\*/g, "$1<em>$2</em>").replace(/`(.+?)`/g, "<code>$1</code>"); }
    lines.forEach(function (l) {
      var m;
      if ((m = l.match(/^\s*[-*•]\s+(.*)/)) || (m = l.match(/^\s*\d+[.)]\s+(.*)/))) {
        if (!inList) { out.push("<ul>"); inList = true; }
        out.push("<li>" + inline(m[1]) + "</li>"); return;
      }
      if (inList) { out.push("</ul>"); inList = false; }
      if ((m = l.match(/^(#{1,3})\s+(.*)/))) out.push("<h" + m[1].length + ">" + inline(m[2]) + "</h" + m[1].length + ">");
      else if (l.trim()) out.push("<p>" + inline(l) + "</p>");
    });
    if (inList) out.push("</ul>");
    return '<div class="md">' + out.join("") + "</div>";
  };

  /* zrzut TradingView: https://www.tradingview.com/x/AbCd123/ -> bezpośredni PNG */
  TT.imageUrl = function (url) {
    var m = String(url || "").match(/tradingview\.com\/x\/([A-Za-z0-9]+)/);
    if (m) return "https://s3.tradingview.com/snapshots/" + m[1].charAt(0).toLowerCase() + "/" + m[1] + ".png";
    return url;
  };

  /* ---- ikony (SVG, rysowane w stylu cienkiej linii) ---- */
  var P = {
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M20 20H3"/>',
    live: '<path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/>',
    journal: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    analytics: '<path d="M4 20V14M9 20V9M14 20v-8M19 20V5"/>',
    prop: '<path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z"/><path d="M9 12l2 2 4-4"/>',
    econ: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 3 2.5 15 0 18M12 3c-2.5 3-2.5 15 0 18"/>',
    ai: '<path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M18 15l.9 2.1L21 18l-2.1.9L18 21l-.9-2.1L15 18l2.1-.9z"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    cursor: '<path d="M5 3l14 8-6 1.5L10 19z"/>',
    cross: '<path d="M12 3v18M3 12h18"/>',
    trend: '<path d="M4 19L20 5"/><circle cx="4" cy="19" r="1.6"/><circle cx="20" cy="5" r="1.6"/>',
    hline: '<path d="M3 12h18"/><circle cx="12" cy="12" r="1.6"/>',
    ray: '<path d="M5 17L21 8"/><circle cx="5" cy="17" r="1.6"/>',
    fib: '<path d="M3 5h18M3 9h18M3 13h18M3 19h18"/><path d="M5 19L19 5" stroke-dasharray="2 2"/>',
    rect: '<rect x="4" y="6" width="16" height="12" rx="1"/>',
    eraser: '<path d="M7 21h10M5.5 14.5l7-7 5 5-7 7H8z"/><path d="M12.5 7.5l3-3 5 5-3 3"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    magnet: '<path d="M6 3v8a6 6 0 0 0 12 0V3h-4v8a2 2 0 0 1-4 0V3z"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    side: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/>',
    up: '<path d="M6 15l6-6 6 6"/>',
    down: '<path d="M6 9l6 6 6-6"/>',
    target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>',
    start: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3 2 9 2 12 0v-5"/><path d="M22 9v6"/>',
    learn: '<path d="M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4z"/><path d="M20 4h-6a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h7z"/>',
    calc: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h2M12 12h2M16 12h0M8 16h2M12 16h2M16 16h0"/>'
  };
  TT.icon = function (name, size) {
    return '<svg viewBox="0 0 24 24" width="' + (size || 18) + '" height="' + (size || 18) + '" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + (P[name] || "") + "</svg>";
  };
})(window.TT);
