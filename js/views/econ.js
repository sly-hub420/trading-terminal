/* Kalendarz ekonomiczny i wykres Live — oficjalne, darmowe widżety TradingView do osadzania */
(function (TT) {
  "use strict";
  TT.views = TT.views || {};

  function embed(root, script, config) {
    root.innerHTML = "";
    var wrap = document.createElement("div");
    wrap.className = "tradingview-widget-container";
    wrap.style.cssText = "height:100%;width:100%";
    var inner = document.createElement("div");
    inner.className = "tradingview-widget-container__widget";
    inner.style.cssText = "height:100%;width:100%";
    wrap.appendChild(inner);
    var s = document.createElement("script");
    s.src = script; s.async = true; s.type = "text/javascript";
    s.text = JSON.stringify(config);
    wrap.appendChild(s);
    root.appendChild(wrap);
  }

  TT.views.econ = {
    title: "Kalendarz ekonomiczny",
    render: function (root) {
      var countries = TT.local.get("econCountries", "us,eu,gb,jp,de,pl,cn,ch,ca,au");
      var imp = TT.local.get("econImportance", "0,1");
      root.innerHTML = '<div style="display:flex;flex-direction:column;height:100%"><div class="page-head" style="padding:14px 18px 0"><h1>Kalendarz ekonomiczny</h1><span class="sub">dane: TradingView</span><span style="flex:1"></span>' +
        '<div class="seg" id="ec-imp"><button data-v="1"' + (imp === "1" ? ' class="active"' : "") + '>Tylko ważne</button><button data-v="0,1"' + (imp === "0,1" ? ' class="active"' : "") + '>Średnie+</button><button data-v="-1,0,1"' + (imp === "-1,0,1" ? ' class="active"' : "") + ">Wszystkie</button></div>" +
        '<input class="inp" id="ec-c" style="width:260px" value="' + TT.esc(countries) + '" title="Kody krajów, po przecinku"></div><div id="ec-w" style="flex:1;min-height:0;padding:10px 14px 14px"></div></div>';
      embed(root.querySelector("#ec-w"), "https://s3.tradingview.com/external-embedding/embed-widget-events.js",
        { colorTheme: "dark", isTransparent: true, width: "100%", height: "100%", locale: "pl", importanceFilter: imp, countryFilter: countries });
      root.querySelectorAll("#ec-imp button").forEach(function (b) { b.onclick = function () { TT.local.set("econImportance", b.dataset.v); TT.views.econ.render(root); }; });
      root.querySelector("#ec-c").onchange = function () { TT.local.set("econCountries", this.value.replace(/\s/g, "").toLowerCase()); TT.views.econ.render(root); };
    }
  };

  TT.views.live = {
    title: "Live",
    render: function (root) {
      var tf = { "1m": "1", "5m": "5", "15m": "15", "1h": "60", "4h": "240", "1D": "D" }[TT.chart.tf] || "15";
      var sym = TT.chart.symbol;
      if (sym.indexOf(":") < 0) { var r = TT.chart.resolveSource(sym); sym = r.src === "binance" ? "BINANCE:" + r.sym : r.sym.replace("/", ""); }
      root.innerHTML = '<div id="tv-live" style="height:100%"></div>';
      embed(root.querySelector("#tv-live"), "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js", {
        autosize: true, symbol: sym, interval: tf, timezone: "Europe/Warsaw", theme: "dark", style: "1", locale: "pl",
        allow_symbol_change: true, hide_side_toolbar: false, calendar: false, details: true, withdateranges: true, backgroundColor: "#131722", gridColor: "rgba(42,46,57,0.6)"
      });
    }
  };
})(window.TT);
