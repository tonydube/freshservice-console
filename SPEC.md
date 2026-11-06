# Freshservice Ticket Console — Spec (draft v0.2)

A React + TypeScript web UI for viewing and working Freshservice tickets through the Freshservice REST API v2, using an API key (no Freshservice UI login needed).

**Deployment:** single user, runs locally on your Mac (`localhost` only). No app login.

---

## 1. Goals

- See tickets quickly: list, search, filter, sort, paginate.
- Open a ticket and see everything relevant: fields, requester, conversation thread, attachments.
- Act on tickets: reply, add private notes, change status / priority / assignee / group, create tickets.
- Never expose the API key to the browser.

**Non-goals (v1):** deleting/restoring tickets, changes, problems, assets, service catalog, approvals, reporting dashboards, multi-user hosting, SSO, OAuth.

---

## 2. Freshservice API facts the design depends on

| Topic | Detail |
|---|---|
| Base URL | `https://{domain}.freshservice.com/api/v2/` (must be the `*.freshservice.com` domain, not a custom CNAME) |
| Auth | HTTP Basic, API key as username, `X` as password |
| Identity | Every action is performed **as the agent who owns the API key** (replies/notes show that agent as author) |
| Pagination | `page` (from 1), `per_page` default 30, **max 100**; `Link: <…>; rel="next"` header when more pages exist |
| Rate limits (per minute, account-wide) | Starter 100 · Growth 200 · Pro 400 · Enterprise 500. Ticket sub-limits too (e.g. Pro: list 120 / view 140 / create 140 / update 140) |
| Rate-limit headers | `X-RateLimit-Total`, `X-RateLimit-Remaining`, `X-RateLimit-Used-CurrentRequest`, sub-limit variants; `429` + `Retry-After` when exceeded |
| Embeds cost credits | Each `include=` costs 1 extra credit; `include=conversations` costs 2 |
| Attachments | `multipart/form-data`, total ≤ 40 MB per ticket |

### Endpoints used

| Purpose | Method + path |
|---|---|
| List tickets | `GET /tickets?filter=new_and_my_open\|watching\|spam\|deleted&updated_since=&order_type=asc\|desc&include=requester,stats,tags,department&per_page=&page=` |
| Filter/search tickets | `GET /tickets/filter?query="…"&page=` (30/page, returns `total`) |
| View ticket | `GET /tickets/{id}?include=requester,stats,tags,…` |
| Create ticket | `POST /tickets` |
| Update ticket | `PUT /tickets/{id}` |
| Conversations | `GET /tickets/{id}/conversations` |
| Reply (public) | `POST /tickets/{id}/reply` |
| Note (private/public) | `POST /tickets/{id}/notes` |
| Activities | `GET /tickets/{id}/activities` |
| Tasks | `GET/POST /tickets/{id}/tasks`, `PUT/DELETE /tickets/{id}/tasks/{task_id}` |
| Time entries | `GET/POST /tickets/{id}/time_entries`, `PUT/DELETE …/{entry_id}` |
| Ticket fields (incl. custom + choices) | `GET /ticket_form_fields` |
| Lookups | `GET /agents`, `GET /groups`, `GET /requesters`, `GET /departments` |

### Filter query syntax (`/tickets/filter`)

- Format: `"(priority:3 OR priority:4) AND status:2 AND agent_id:null"`
- Operators: `:` equals, `:>` ≥, `:<` ≤, `AND`, `OR`, parentheses
- Strings/dates in single quotes: `created_at:>'2026-10-01'`
- Fields: `workspace_id, requester_id, email, agent_id, group_id, priority, status, impact, urgency, tag, due_by, fr_due_by, created_at, updated_at` + custom fields
- Whole query wrapped in double quotes, URL-encoded, **≤ 512 chars**
- No free-text search on subject/description → keyword search is not natively supported (see §8)

### Enums

| Field | Values |
|---|---|
| Status | 2 Open · 3 Pending · 4 Resolved · 5 Closed (custom statuses come from `ticket_form_fields`) |
| Priority | 1 Low · 2 Medium · 3 High · 4 Urgent |
| Urgency / Impact | 1 Low · 2 Medium · 3 High |
| Source | 1 Email · 2 Portal · 3 Phone · 4 Chat · 5 Feedback widget · 6 Yammer · 7 AWS CloudWatch · 8 PagerDuty · 9 Walk-up · 10 Slack · 11 Chatbot · 12 Workplace · 13 Onboarding · 14 Alerts · 15 MS Teams · 18 Offboarding |

The UI will load labels from `/ticket_form_fields` at startup and fall back to these built-ins, so custom statuses and custom fields render correctly.

---

## 3. Architecture

```
Browser (React SPA)  ──/api/*──▶  Thin proxy (Node, Hono or Express)  ──▶  {domain}.freshservice.com/api/v2
                                   • adds Basic auth header from env
                                   • allowlists paths/methods
                                   • passes rate-limit headers through
                                   • optional: short TTL cache for lookups
```

**Why a proxy even though Freshservice supports CORS:** anything in the browser bundle is readable by anyone who loads the page. The key would let them do anything that agent can do. The proxy keeps `FRESHSERVICE_API_KEY` in a server-side `.env` only.

- Dev: Vite dev server proxies `/api` → local proxy (one `npm run dev` starts both).
- "Prod" (daily use): `npm start` builds the SPA and runs the proxy, which also serves it. One Node process bound to `127.0.0.1` only, so nothing else on the network can reach it.

### Stack

| Concern | Choice |
|---|---|
| Build | Vite + React 19 + TypeScript (strict) |
| Data fetching / cache | TanStack Query (retries, background refresh, optimistic updates) |
| Routing | React Router |
| Tables | TanStack Table |
| UI components | shadcn/ui (Radix + Tailwind) |
| Forms + validation | React Hook Form + Zod (Zod schemas also type API responses) |
| Rich text (reply/note body) | Tiptap → HTML (Freshservice bodies are HTML) |
| HTML rendering of conversations | DOMPurify sanitization before render |
| Proxy | Hono on Node |
| Tests | Vitest + React Testing Library; MSW to mock Freshservice |
| Lint/format | ESLint + Prettier |

---

## 4. Screens & features

### 4.1 Ticket list (home)
- Preset views: **My open**, **Unassigned**, **All open**, **Pending**, **Recently updated**, **Overdue** (`due_by:<'now'`), **Spam** (view only).
- Filter bar: status, priority, urgency, impact, agent, group, requester email, tag, created/updated date range. Builds a `/tickets/filter` query; shows the generated query in an "advanced" box for power users.
- Columns (configurable, saved in localStorage): ID, subject, requester, status, priority, agent, group, due by, created, updated.
- Pagination with page size control (30/50/100 where supported).
- Badges for overdue / first-response due.
- Auto-refresh every N seconds (default 60, respecting rate limit).
- Bulk select → bulk change status / priority / assignee (sequential PUTs with progress, throttled).

### 4.2 Ticket detail
- Header: subject, ID, status/priority pills, quick-edit dropdowns (status, priority, urgency, impact, agent, group, category, custom fields).
- Left: conversation thread (description + replies + notes), private notes visually distinct, attachments downloadable.
- Right sidebar: requester card, department, tags, SLA times (`due_by`, `fr_due_by`), source, created/updated.
- Tabs: Conversation · Activity · Tasks · Time entries.
- Composer: **Reply** (to requester, cc/bcc) or **Note** (private toggle, notify agents). Rich text + attachments.
- "Edit in Freshservice" link to the native ticket URL.

### 4.3 Create ticket
- Form driven by `/ticket_form_fields` (required fields, dropdown choices, custom fields).
- Requester lookup (search `/requesters`), or new email.
- Attachments.

### 4.4 Settings
- Shows connected domain, the agent the key belongs to (`GET /agents/me` equivalent via proxy), plan rate-limit usage meter from headers.
- Refresh interval, default view, theme (light/dark).

---

## 5. Rate-limit handling

- Proxy forwards `X-RateLimit-*` headers; client keeps a live "remaining this minute" value in a small store, shown in the footer.
- On `429`: wait `Retry-After` seconds, then retry (TanStack Query retry with custom delay). Show a non-blocking toast.
- Lookups (agents, groups, departments, ticket fields) cached ~10 min.
- Avoid `include=conversations` on list views (2 credits each); load conversations only on the detail page.
- Bulk actions throttled to stay under the update sub-limit.

---

## 6. Security

- API key only in server `.env`; `.env` git-ignored; `.env.example` committed.
- Proxy allowlist: only the endpoints in §2 and only the methods the UI uses. **No `DELETE` on tickets** (v1 is full write minus delete).
- Proxy listens on `127.0.0.1` only, so there's no login screen and nothing is exposed to the LAN.
- Optional signature: if `REPLY_SIGNATURE` is set in `.env`, it's appended to replies/notes (useful if the key belongs to a shared/service agent rather than you).
- Ticket HTML sanitized with DOMPurify before rendering.

---

## 7. Project layout

```
freshservice-console/
├── server/              # Hono proxy
│   ├── index.ts
│   ├── allowlist.ts
│   └── env.ts
├── src/
│   ├── api/             # typed client, Zod schemas, query keys
│   ├── features/
│   │   ├── tickets/     # list, filters, detail, composer, create
│   │   ├── lookups/     # agents, groups, requesters, fields
│   │   └── settings/
│   ├── components/ui/   # shadcn components
│   ├── lib/             # filter-query builder, enums, rate-limit store
│   └── main.tsx
├── tests/
├── .env.example         # FRESHSERVICE_DOMAIN, FRESHSERVICE_API_KEY, PORT
└── package.json
```

---

## 8. Known API limitations to design around

1. **No keyword search** on subject/description in `/tickets/filter`. Options: client-side search over the loaded page(s), or search by ticket ID directly. (A fuller fix would be a local index synced via `updated_since`, out of scope for v1.)
2. **All actions are attributed to the key's owner.** Fine for single-user use, as long as the key is yours. If it's a service account, use `REPLY_SIGNATURE` (see §6).
3. **List endpoint without `updated_since` returns only the last 30 days.** Older tickets need `updated_since` or the filter endpoint.
4. **Filter endpoint returns 30/page, no `per_page`**, and has a practical depth limit (verify against the account; plan for ≤ 10 pages / 300 results and show "refine your filter" beyond that).
5. **Query length ≤ 512 chars** — the filter builder must warn when too many OR'd values are chosen.

---

## 9. Milestones

1. **M1 — Skeleton:** Vite + TS + proxy, env config, connection check, enums & lookups loaded. ✅
2. **M2 — Read:** ticket list with presets, filters, pagination; ticket detail with conversations. ✅
   - Built with a plain table + client-side sort instead of TanStack Table (not needed yet).
   - "My open" uses your agent email (Settings, or `MY_AGENT_EMAIL` in `.env`); Freshservice has no "who am I" endpoint for API keys.
   - Requester names are fetched per unique requester (`GET /requesters/{id}`) and cached for an hour, since `/tickets/filter` has no `include=requester`.
   - Overdue view uses `due_by` ≤ yesterday (filter dates are day-granular); the list also flags overdue rows using exact times.
3. **M3 — Write:** quick-edit fields, reply, notes, attachments, create ticket.
4. **M4 — Extras:** tasks, time entries, activity, bulk actions, rate-limit meter, dark mode.
5. **M5 — Polish:** tests, README, `npm start` one-command launch.

---

## 10. Decisions

| # | Decision | Answer |
|---|---|---|
| D1 | Who uses it | Just me, locally |
| D2 | UI login | None; bound to `127.0.0.1` |
| D3 | Write scope v1 | Full minus delete: view, reply, notes, edit fields, assign, create, tasks, time entries, bulk edit |
| D4 | Plan tier | Unknown; read `X-RateLimit-Total` from the first response and size auto-refresh/bulk throttling from it |
| — | Attribution | Key owner; optional `REPLY_SIGNATURE` |

### Still open (can be settled once the key arrives)
- **D5. Workspaces:** does the account use multiple workspaces? (If yes, add a workspace switcher.)
- **D6. Custom fields / statuses** that matter to your workflow. These are auto-loaded from `/ticket_form_fields`, so only needed if some should be list columns or filters.
- **D7. Look & feel:** shadcn/Tailwind default with dark mode, unless you want something else.
