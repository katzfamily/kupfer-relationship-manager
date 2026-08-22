# Migration Handoff — Kupfer Connections

**Purpose:** Everything needed to move this system onto Corey Kupfer's own
accounts (GitHub, Netlify, Airtable, LinkedIn). Read this top to bottom before
starting. Nothing here is optional trivia — each item is something the system
depends on to keep working after the move.

_Last updated: 2026-08-22._

---

## 1. What this system is

Two coupled pieces plus a source of truth:

1. **The static site** — `kupferconnections.com`. A password-protected,
   `noindex` set of hand-maintained HTML pages that Corey uses as his daily
   prospecting cockpit (The Five, Connection Map, travel lists, outreach
   tracker, referral partners, white-paper outreach).
2. **The Airtable CRM** — base `app1NUfZ5cnZD8toM`. The system of record for
   every firm, contact, and connection. **The site is NOT generated from
   Airtable.** They are maintained in parallel and can drift; see §7 for the
   sync conventions that keep them aligned.
3. **A small Netlify Functions backend** — two serverless endpoints that let
   the site read/write shared state (checkbox sync) and write back to Airtable
   (the "Do Not Resurface" button).

> **The single most important migration fact:** the site and the CRM are
> **separate** and must **both** move. Moving the GitHub repo alone leaves the
> data behind; moving the Airtable base alone leaves the cockpit behind. And
> two environment variables (§4) are what connect them — if those aren't set on
> the new Netlify account, the site loads but the write-back features silently
> stop working.

---

## 2. Accounts & assets to transfer

| Asset | Current location | What to do on migration |
|---|---|---|
| **GitHub repo** | `katzfamily/kupfer-relationship-manager` | Transfer ownership to Corey's GitHub, or fork/re-push into a repo he owns. Production branch is `main`. |
| **Netlify site (main app)** | Netlify project `kupfer-relationship-manager`, domain **kupferconnections.com** | Re-create under Corey's Netlify team (see §3). Re-point the domain's DNS. Re-set env vars (§4). |
| **Netlify site (guest page)** | Netlify project `dealquestguestpage`, domain **beaguestondealquest.com** | Separate, self-contained static page for DealQuest podcast guests. Move if Corey wants it; it has no backend and no Airtable dependency. |
| **Airtable base** | `app1NUfZ5cnZD8toM` ("Kupfer" M&A prospecting base) | Duplicate/transfer into Corey's Airtable workspace. **Table and field IDs change when a base is duplicated** — see §6 warning. |
| **Airtable PAT** | Personal access token in `AIRTABLE_TOKEN` env var | Corey generates a **new** PAT on his own Airtable account with scopes `data.records:read` + `data.records:write`, limited to the migrated base. |
| **Domain(s)** | `kupferconnections.com`, `beaguestondealquest.com` | Transfer registrar/DNS or re-point to Corey's Netlify. |
| **LinkedIn** | Corey's connections (~8,649) drive the whole pipeline | No transfer needed — it's already Corey's account. The site's connection counts reference it. |

---

## 3. Netlify configuration (main app)

- **Deploy method:** Git deploy from the GitHub repo. Import the repo in Netlify
  → *Add new site → Import from Git*.
- **Build settings:** publish dir `.`, **no build command**. Netlify runs
  `npm install` to pull `@netlify/blobs` and wire up the functions. (Drag-and-drop
  deploy will NOT work — the functions need `npm install`.)
- **Production branch:** `main`. The production deploy context is
  `main--kupfer-relationship-manager` (rename follows the new site name).
- **Password protection:** the site is behind Netlify's site-wide password
  (Site configuration → Access control → Visitor access → Password protection).
  **Re-enable this on the new site** — the content is private/privileged.
- **Search indexing:** every page sends `X-Robots-Tag: noindex` (via
  `netlify.toml`) and carries a `<meta name="robots" content="noindex,nofollow">`
  tag, plus `robots.txt` disallows all. Keep all three — this site must never be
  indexed.
- **Config file:** `netlify.toml` at repo root sets `publish = "."`,
  `functions = "netlify/functions"`, redirects `/api/* → /.netlify/functions/:splat`,
  and the cache/noindex headers. It moves with the repo — no manual re-entry.

---

## 4. Environment variables (REQUIRED for backend)

Set these in **Netlify → Site configuration → Environment variables** on the new
site. Without them the site still loads, but the "Do Not Resurface" button and
any Airtable write-back silently no-op.

| Variable | Value | Used by | Notes |
|---|---|---|---|
| `AIRTABLE_TOKEN` | _(new PAT Corey generates)_ | `netlify/functions/never-prospect.mjs` | Scopes: `data.records:read`, `data.records:write`. Scope it to the migrated base only. **Never commit this to the repo.** |
| `AIRTABLE_BASE_ID` | `app1NUfZ5cnZD8toM` **→ update to the new base ID after duplicating** | `never-prospect.mjs` | The function falls back to the hard-coded old ID if unset; **after migration the old ID is wrong**, so set this explicitly to the new base's ID. |

> Netlify Blobs (the checkbox-sync store) needs **no** env vars or API keys — it's
> built into Netlify and is provisioned automatically per-site. Note this means
> the checkbox state does **not** migrate: the new site starts with a fresh,
> empty `outreach` blob. That's fine — it's just UI toggle state, not data of
> record.

---

## 5. The Netlify Functions backend

Two functions in `netlify/functions/`:

### `outreach.mjs` → `/api/outreach`
- Backs the "Mark Complete" / "Do Not Resurface" checkboxes on **The Five**.
- Stores a single JSON blob in a Netlify Blobs store named **`outreach`**, key
  **`state`**. GET returns it; POST merges the change and returns the merged state.
- No external dependencies beyond `@netlify/blobs`. Nothing to configure.

### `never-prospect.mjs` → `/api/never-prospect`
- Backs the "Do Not Resurface" button — when Corey dismisses a firm, this writes
  it to the Airtable **Never Prospect List** table so it won't resurface.
- Constants inside the file:
  - `BASE_ID = process.env.AIRTABLE_BASE_ID || "app1NUfZ5cnZD8toM"` ← **update the
    fallback or set the env var** post-migration.
  - `TABLE = "tbltK12NMGhHy0uyP"` (Never Prospect List table ID) ← **changes if the
    base is duplicated** (see §6).
  - `SOURCE_TAG = "Site: Do Not Resurface button (Corey)"` — the function only
    ever removes/edits entries it created, identified by this tag. Safe.
- No-ops gracefully if `AIRTABLE_TOKEN` is absent (so a missing token degrades
  quietly instead of erroring).

---

## 6. Airtable CRM — base, tables, fields

**Base ID:** `app1NUfZ5cnZD8toM`

> ⚠️ **Critical migration warning:** When you **duplicate** an Airtable base (the
> normal way to move it to another workspace), Airtable assigns **new** base,
> table, and field IDs. The site's front-end doesn't reference these IDs (it's
> hand-maintained HTML), but **`never-prospect.mjs` does** — its `BASE_ID` and
> `TABLE` constants, plus the field names it writes. After duplicating:
> 1. Update `AIRTABLE_BASE_ID` env var (and/or the fallback in the function).
> 2. Update `TABLE` in `never-prospect.mjs` to the new Never Prospect List table ID.
> 3. Confirm the field **names** it writes still match (names are preserved on
>    duplicate; only IDs change — so name-based writes keep working, which is why
>    the function uses names for fields but IDs for the table).
>
> **Alternative that avoids all of this:** transfer the base to Corey's workspace
> via Airtable's *move base* (workspace-to-workspace) instead of duplicating —
> that **preserves** IDs. Prefer this if Corey's account can be added as a
> collaborator on the current workspace to move it.

The four tables (IDs valid for the current base):

### Prospects — `tblLhODDaYnHVKg7x`
The core pipeline. Every firm evaluated lives here.

| Field | Field ID | Notes |
|---|---|---|
| Firm Name | `fldqkGtxd0MzT9FnW` | |
| Priority Tier | `fldLFFxYMQmcVTRO7` | |
| Estimated AUM | `fldNd1ksXJHtYeJsM` | text |
| AUM($M) | `fldsK5LaYfnJ724Dp` | numeric |
| Status | `fld0vkBo9VrBgz8Bc` | singleSelect: Prospect `selSLWGVmka7HY5Sq` / Early Relationship `selgeubsRIW9tiDQj` / Excluded `selODaIyX2NnyVdCx` |
| Deal Side | `fldSL7MJFrRn5Hlb0` | Buy `selwcRvrNTv6ikdSs` / Sell `selxVjbjVK59GWsfD` / Unclear `selBUxx1zdqmREsnx` |
| Key Decision-Maker | `fldpOx5JeEWzpTHPX` | |
| Decision-Maker Title | `fldSHv4dnYJm9aNVY` | |
| Secondary Contact | `fldFHE9CcZmgDZUyk` | |
| Website | `fld1gyRBUbeNGimpo` | |
| Headquarters | `fldzIBHYxLw9Kcm4T` | |
| Why They're a Fit | `fldt5nZfx7bB59wd7` | |
| Trigger/Signal | `fldmGo3cCDoI8qAqe` | |
| Needs Verification | `fldkwbLjFJlEfpIzJ` | |
| PE/Platform Backer | `fldv9sZRK4axbBvyl` | the ICP disqualifier flag |
| Screening Notes | `fldvJtSlEJpSiHvxl` | where exclusion rationale is recorded |
| Exclusion Category | `fldjvIJgJcrA7aSBH` | singleSelect (note: "PE-Backed / Platform" is NOT a valid option — use Screening Notes) |
| Never Prospect List | `fldieP7Qu3D4OX1NE` | link to NPL table |
| Contacts | `fldLEHofrbJTTjMRR` | link to Contacts table |

### Contacts — `tblQh8TGpgvtno6x6`
Individual people at prospect firms; drives connection-request tracking.

| Field | Field ID | Notes |
|---|---|---|
| Contact Name | `fldvqtYpsOBT0aZwt` | |
| Prospect | `fld04q4hooeOWyTzv` | link to Prospects |
| Title | `fldgdxf4N6W1pkwco` | |
| Role | `fldsb3yMJToHctpVf` | Primary Decision-Maker / Secondary Contact / Other |
| Connection Request Status | `fldcoOb9CHrCBy23O` | Not Sent `selcQUwJCLB0yPp4p` / Request Sent `selHmoSDxBPjPHJrR` / Accepted `sel8Popvvv7kp14Xv` / Declined / No LinkedIn Found |
| Date Request Sent | `fld7CoJU6E6GYM4fO` | |
| Date Accepted | `fldNvp7WdgWq0TWfh` | |
| Notes | `fldkITNbl3J6JaFy6` | |
| RIA Series Guest Fit | `fldFkAk8sUO5JqISM` | DealQuest podcast fit flag |

### Never Prospect List — `tbltK12NMGhHy0uyP`
Firms that must never resurface. Written by `never-prospect.mjs`.

| Field | Field ID |
|---|---|
| Firm Name | `fld43NMOaIZb7oxbU` |
| Reason | `fldsIlnO8dArkI14Z` |
| Source | `fldHCL9aMhAkOTfIf` |
| Linked Prospect | `fldbMazRrPgR2ji7M` |
| Last Reviewed | `fldXAjBWhek3XjvVH` |

### Network Connections — `tbloyACYiUX1iI9Aa`
The broader connection graph — podcast guests, referral/COI value, media.

| Field | Field ID | Notes |
|---|---|---|
| Name | `fld5dfCu4d8ODGwSB` | |
| Company | `fldJ1cK4L7Lz791bC` | |
| Title | `fldGYpdwkn4zEChZd` | |
| Location | `fldZ4mT7xfouoSfcW` | |
| Podcast | `fldqJ5THGVBv5fAZU` | |
| Source | `fld5jdhef4aILR0Ec` | |
| Notes | `fld9k6dg5BFGeGxtX` | |
| Media Feature Opportunity | `fld8L58eypBBhzuZH` | |
| DealQuest Guest Fit | `fldmFmUYiY3flideO` | Strong guest / Possible guest / No |

---

## 7. Site ↔ CRM sync conventions

The site is **hand-maintained** and does not read Airtable at runtime. When a
fact changes, it must be updated in **both** places. Conventions the current
system follows (keep these after migration):

- **Working List** (`working-list.html`) is the site's source of truth for
  prospects and drives **The Five** on the homepage. Each row carries data
  attributes: `data-aum="under10"`, `data-tier`, `data-side`, `data-connected`,
  `data-week`. The Five auto-ranks client-side from these rows — a firm only
  qualifies if it's `under10` AUM, `data-connected="yes"`, has a named person and
  connection tag, and isn't marked complete/no-resurface.
- **The Five is computed live in the browser** from Working List rows — there's no
  build step. Editing the HTML rows changes the recommendations.
- **Connection Map** (homepage §02) is hand-maintained, **prospects-only**.
  Current figures in the deck: **23 prospect firms / 31 named connections.**
  Update these counts in the prose when you add/remove firms.
- **The send-list is computed from Airtable, not the site.** Method: Prospects
  (Status = Prospect or Early Relationship) **minus** those already connected
  **minus** any PE-backed / over-$10B / acquired firm. Do not trust the site's
  stale `data-connected` flag for this — check the Contacts table's Connection
  Request Status.
- **Masthead connection count** currently reads **8,649** across `index.html`,
  `referral-partners.html`, `white-paper.html`. It reflects Corey's LinkedIn
  connection total; bump it in all three when it changes.
- **Pages:** `index.html` (home: The Five, Connection Map, travel, Close to Home),
  `working-list.html` (full pipeline), `outreach.html` (outreach tracker,
  per-firm contact blocks with `data-cstatus`), `referral-partners.html`
  (advisors/bankers, custodian BDOs & RMs, consultants, recruiters),
  `white-paper.html` (PE-in-wealth white-paper outreach). Shared `styles.css`.

---

## 8. ICP rules (the business logic behind every prospect decision)

These rules govern what qualifies. They live in people's heads and in Screening
Notes, not in code — write them down here so they survive the handoff.

- **Hard disqualifiers (any one excludes a firm):**
  - Any PE / VC / platform / aggregator backer — **even a minority stake.**
  - Acquired or absorbed into another firm.
  - **$10B AUM or more** (strictly under $10B only).
- **"Exclude" means Status = Excluded, never delete.** Every firm evaluated stays
  in the CRM with its rationale in Screening Notes. Removing history loses the
  record of why a firm was passed on (and risks re-adding it later).
- **Only remove true duplicates.**
- **Never recommend a non-prospect** on the site.
- **When re-encountering someone already logged, re-check their profile** for
  anything missed the first time before moving on.
- **Known-excluded backers seen so far** (PE/platform — not exhaustive):
  Constellation Wealth Capital, Rise Growth, Elevation Point, Wealth Partners
  Capital Group, Lovell Minnick, CIVC, Merchant Investment Management, Emigrant
  Partners, Long Ridge, Peloton, Abry, Lightyear, Crestview, Charlesbank,
  Carlyle, Warburg Pincus, Dynasty (equity), Arax, Corsair, Genstar, LLR,
  Estancia, New Mountain, Parthenon, RedBird, TRIA Capital, Pathstone, Focus
  Financial, Hightower, CI/Corient, Aspen Standard/Alpine, Constellation, TPG,
  KKR.

---

## 9. Migration checklist (do in this order)

1. **Airtable base** → move (preferred) or duplicate into Corey's workspace.
   Record the new base ID and, if duplicated, the new Never Prospect List table
   ID.
2. **Airtable PAT** → Corey generates a new token scoped to the migrated base
   (`data.records:read` + `data.records:write`).
3. **GitHub repo** → transfer/re-push into Corey's account.
4. **Netlify site** → import the repo under Corey's Netlify team; publish dir `.`,
   no build command; production branch `main`.
5. **Env vars** → set `AIRTABLE_TOKEN` (new PAT) and `AIRTABLE_BASE_ID` (new base
   ID) on the Netlify site.
6. **`never-prospect.mjs`** → if the base was duplicated, update the `TABLE`
   constant (and the `BASE_ID` fallback) to the new IDs, commit, redeploy.
7. **Password protection** → re-enable site-wide password on the new Netlify site.
8. **Domain** → re-point `kupferconnections.com` DNS to the new site; keep
   `noindex`.
9. **Smoke test:** load the site behind the password; tick a Mark-Complete box
   (tests `/api/outreach` + Blobs); click a Do-Not-Resurface button and confirm a
   new row appears in the Airtable Never Prospect List (tests `/api/never-prospect`
   + `AIRTABLE_TOKEN` + `AIRTABLE_BASE_ID`).
10. **(Optional) DealQuest guest page** → move the separate `dealquestguestpage`
    Netlify site / `beaguestondealquest.com` domain if wanted (no backend, no
    Airtable — trivial).

If all of step 9's smoke tests pass, the migration is complete and the two
write-back features are correctly wired to Corey's own Airtable.
