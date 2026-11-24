// Proxy kalendarza ekonomicznego (Forex Factory, bieżący tydzień) dla Trading Terminala.
// Feed nie wysyła nagłówków CORS, więc przeglądarka nie może go pobrać bezpośrednio.
// Wyniki trzymane w pamięci 30 min, żeby nie obciążać źródła.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SRC = "https://nfs.faireconomy.media/ff_calendar_thisweek.json";
const TTL = 30 * 60 * 1000;
let cache: { at: number; body: string } | null = null;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    if (!cache || Date.now() - cache.at > TTL) {
      const r = await fetch(SRC, { headers: { "User-Agent": "Mozilla/5.0 (trading-terminal)" } });
      if (!r.ok) throw new Error("source " + r.status);
      const all = await r.json() as Array<Record<string, string>>;
      const events = all
        .filter((e) => e.impact === "High" || e.impact === "Medium")
        .map((e) => ({ title: e.title, currency: e.country, time: new Date(e.date).toISOString(), impact: e.impact, forecast: e.forecast, previous: e.previous }));
      cache = { at: Date.now(), body: JSON.stringify({ fetchedAt: new Date().toISOString(), events }) };
    }
    return new Response(cache.body, { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    if (cache) return new Response(cache.body, { headers: { ...cors, "Content-Type": "application/json" } });
    return new Response(JSON.stringify({ error: String(e) }), { status: 502, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
