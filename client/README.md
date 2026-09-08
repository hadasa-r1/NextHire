# NextHire — client (Group B)

React + TypeScript + Vite frontend for Group B. Currently one screen:

**Internal Candidate Pool** (מאגר מועמדים פנימי) — system page 13. All candidates
who applied to a single position, for a recruiter/referent to review and act on.

## Run

From the repo root (npm workspaces — one install covers backend + client):

```bash
npm install
```

Then, in two terminals:

```bash
npm start            # repo root — Group B API on http://127.0.0.1:3000
npm run dev -w client   # Vite dev server on http://localhost:5173
```

Vite proxies `/api/*` to the API (see `vite.config.ts`), so no CORS setup is
needed in dev.

Routes:
- `/` — home / landing page
- `/candidates` — global list of every candidate in the system
- `/positions/<positionId>/candidate-pool` — candidate pool for one position
  (`<positionId>` is an existing `Application`'s `positionId`; optional header
  params `?title=<שם המשרה>&closed=1`)
- `/design-system` — shared component gallery

Scripts: `dev`, `build` (`tsc --noEmit && vite build`), `preview`, `typecheck`.

## Layout

```
src/
  api/client.ts                       tiny read-only fetch wrapper + ApiError
  types/domain.ts                     mirrors ../src/models/*.ts over the wire
  features/home/HomePage.tsx          landing page ("/")
  features/candidates/                global candidates list ("/candidates")
    CandidatesPage.tsx               route page: header, search, states, layout
    CandidatesTable.tsx              presentational table only
    useCandidates.ts                 data hook: GET /api/candidates
    filter.ts                        client-side name / ID search
  features/candidate-pool/           candidate pool for one position
    CandidatePoolPage.tsx            route page: header, search, states, layout
    CandidatePoolTable.tsx           presentational table only
    useApplicationsForPosition.ts    data hook: fetch + merge → PoolRow[]
    poolRow.ts                       PoolRow view-model + builder
    stage.ts                         stage labels, threshold badge, action mapping
    filter.ts                        client-side name / ID search
  router.tsx                         route table
```

The design system is consumed from `../design-system` via the `@ds/*` alias.
It is never modified here.

## Backend endpoints used

| Call | Purpose |
| --- | --- |
| `GET /api/applications?positionId=<id>&populate=candidateId` | the pool, with candidate joined |
| `GET /api/tender-summaries` | `finalWeightedScore` per application |
| `GET /api/evaluation-scores` | fallback score (`computedScore`, latest by `evaluatedAt`) |

The `positionId` filter and `populate` support were added to the shared generic
controller on this branch (`src/controllers/generic.controller.ts`).

## Known gaps / stubs (see the top-level task summary)

- **Company name** — no Company model on the Group B backend. The "חברה" column
  shows a shortened `companyId` in muted monospace. Wire up once Group A/C expose
  a companies API (`poolRow.ts` → `companyLabel`).
- **`currentStage`** — not implemented on the backend (explicit TODO in
  `src/models/application.model.ts`). "שלב נוכחי" shows "—" and every action
  falls back to "צפייה". `stage.ts` has the full label/action mapping ready;
  point `readStage()` at the real field when it lands.
- **Position title / "submission window closed"** — no Position model reachable.
  Taken from `?title=` / `?closed=1` query params for now.
- **Action buttons** — `handleAction` in `CandidatePoolPage.tsx` is a `console.warn`
  stub. Wire to the real detail / scheduling screens when they exist.
- **Score fetch** — no bulk "scores for these applications" endpoint, so both
  score collections are fetched whole and indexed client-side. Fine for
  course-project volumes; revisit with an `applicationId in (...)` filter if a
  position ever has many hundreds of applications.
