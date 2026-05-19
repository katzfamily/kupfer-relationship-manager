# Kupfer. — Prospect Command Center

Deploys to Netlify. The "Mark Complete" checkboxes sync across **everyone**
via Netlify Blobs (built-in key-value storage — no database, no extra setup).

## Files

- `index.html` — the page
- `netlify/functions/outreach.mjs` — GET/POST endpoint for the shared state
- `netlify.toml` — routes `/api/*` → the function, sets functions dir
- `package.json` — declares the `@netlify/blobs` dependency

## Deploy

**Recommended — Git deploy:**

1. Push this folder to a GitHub repo.
2. In Netlify, **Add new site → Import from Git**, pick the repo.
3. Leave the build settings as detected (publish dir `.`, no build command).
4. Deploy. Netlify will install dependencies and wire up the function.

**Alternative — CLI deploy:**

```bash
cd deploy
npm install
npx netlify-cli deploy --build --prod
```

**Drag-and-drop deploy will NOT work** for this version because the function
needs `npm install` to run. Use one of the two methods above.

## How sync works

- On page load, the browser fetches `/api/outreach` and renders the checked state.
- Every 15 seconds it re-fetches, so anyone else's ticks show up automatically.
- When you click a checkbox it POSTs the change to the same endpoint, and the
  server returns the merged state.
- A local cache in `localStorage` makes the page paint instantly even when
  offline; it gets corrected on the next successful fetch.

## Resetting state

State is stored in a Netlify Blob named `outreach` under the key `state`.
Clear it from the Netlify dashboard → Site → Blobs, or hit the function with:

```bash
curl -X POST https://YOUR-SITE.netlify.app/api/outreach \
  -H 'content-type: application/json' \
  -d '{"hefty":false,"dilavore":false,"morris":false,"hannum":false,"guarino":false,"dann":false}'
```
