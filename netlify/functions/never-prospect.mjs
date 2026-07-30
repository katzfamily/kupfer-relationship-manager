// Never Prospect List writer.
// Wired to the site's "Do Not Resurface" button: when Corey retires a pick, the
// firm is committed to the CRM Never Prospect List. This is the ONLY automated
// path onto that list — it fires only on Corey's explicit button click, never on
// our own screening judgment.
//
// Requires AIRTABLE_TOKEN in the Netlify environment (a personal access token
// with data.records:read + data.records:write on the base). If it is absent this
// no-ops gracefully: the local Do-Not-Resurface suppression still works via
// /api/outreach, only the CRM write is skipped.

const BASE_ID = process.env.AIRTABLE_BASE_ID || "app1NUfZ5cnZD8toM";
const TABLE = "tbltK12NMGhHy0uyP"; // Never Prospect List
const SOURCE_TAG = "Site: Do Not Resurface button (Corey)";
const API = "https://api.airtable.com/v0";

const cors = {
  "content-type": "application/json",
  "cache-control": "no-store",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
};
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: cors });
const clip = (s, n) => (typeof s === "string" ? s.trim().slice(0, n) : "");

export default async (request) => {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (request.method !== "POST") return json({ error: "method not allowed" }, 405);

  let body = {};
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: "invalid json" }, 400);
  }

  const firm = clip(body.firm, 200);
  if (!firm) return json({ error: "firm required" }, 400);

  const token = process.env.AIRTABLE_TOKEN;
  if (!token) return json({ ok: false, reason: "airtable-not-configured" });

  const authHeaders = { authorization: `Bearer ${token}`, "content-type": "application/json" };
  const firmEsc = firm.replace(/'/g, "\\'");
  const findUrl =
    `${API}/${BASE_ID}/${TABLE}?maxRecords=1&filterByFormula=` +
    encodeURIComponent(`{Firm Name}='${firmEsc}'`);

  try {
    const found = await fetch(findUrl, { headers: authHeaders }).then((r) => r.json());
    const existing = (found.records || [])[0];

    if (body.remove) {
      // Only ever remove an entry this button created. Never touch a manual
      // exclusion Corey (or we, at his direction) added by hand.
      if (existing && String(existing.fields?.Source || "").includes(SOURCE_TAG)) {
        await fetch(`${API}/${BASE_ID}/${TABLE}/${existing.id}`, { method: "DELETE", headers: authHeaders });
        return json({ ok: true, removed: true });
      }
      return json({ ok: true, removed: false });
    }

    // Idempotent: if the firm is already on the list, do nothing.
    if (existing) return json({ ok: true, already: true, id: existing.id });

    const side = clip(body.side, 40);
    const dm = clip(body.dm, 120);
    const dmTitle = clip(body.dmTitle, 160);
    const signal = clip(body.reason, 500);
    const reason =
      "Retired via the site's Do Not Resurface button (Corey's explicit exclude)." +
      (side ? ` Was a ${side} prospect.` : "") +
      (dm ? ` Contact on file: ${dm}${dmTitle ? ` (${dmTitle})` : ""}.` : "") +
      (signal ? ` Prior signal: ${signal}` : "");
    const today = new Date().toISOString().slice(0, 10);

    const created = await fetch(`${API}/${BASE_ID}/${TABLE}`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        fields: { "Firm Name": firm, Reason: reason, Source: SOURCE_TAG, "Last Reviewed": today },
        typecast: true,
      }),
    }).then((r) => r.json());

    if (created.error) return json({ ok: false, error: created.error }, 502);
    return json({ ok: true, created: created.id });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 502);
  }
};

export const config = {
  path: "/api/never-prospect",
};
