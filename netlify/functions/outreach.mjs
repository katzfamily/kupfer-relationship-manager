import { getStore } from "@netlify/blobs";

const STORE_NAME = "outreach";
const KEY = "state";

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "content-type",
    },
  });

export default async (request) => {
  const store = getStore(STORE_NAME);

  if (request.method === "OPTIONS") {
    return json({ ok: true });
  }

  if (request.method === "GET") {
    const data = (await store.get(KEY, { type: "json" })) || {};
    return json(data);
  }

  if (request.method === "POST") {
    let body = {};
    try {
      body = await request.json();
    } catch (e) {
      return json({ error: "invalid json" }, 400);
    }
    const current = (await store.get(KEY, { type: "json" })) || {};
    const merged = { ...current };
    for (const [k, v] of Object.entries(body)) {
      if (v && v !== false) {
        merged[k] = v;
      } else {
        delete merged[k];
      }
    }
    await store.setJSON(KEY, merged);
    return json(merged);
  }

  return json({ error: "method not allowed" }, 405);
};

export const config = {
  path: "/api/outreach",
};
