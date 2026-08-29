# Mission: Full-Stack Patterns (via task-manager)

## Why
The user wants to extract reusable full-stack architecture patterns — FastAPI + React/TanStack + Postgres + Docker — by studying `task-manager`, a real codebase, so those patterns can be applied confidently when starting or structuring other projects, instead of re-deriving structure from scratch each time.

`task-manager` is a fork of the official [fastapi/full-stack-fastapi-template](https://github.com/fastapi/full-stack-fastapi-template), so what's learned here transfers directly to a well-known, widely-used template — not a one-off bespoke setup.

## Success looks like
- Can explain the request lifecycle from browser click to DB row and back, naming every layer it crosses and why each exists
- Can set up a new project with the same shape (typed API contract, generated client, DI-based auth, config-as-validated-settings) without copying this repo
- Can drop into an unfamiliar FastAPI/React monorepo and quickly locate the equivalent of routes/deps/crud/models on the backend and routes/hooks/generated-client on the frontend

## Constraints
- Sessions happen alongside real work on this repo (currently on `feature/dashboard`) — lessons should reuse what's already open/relevant rather than requiring dedicated separate reading time
- Time budget and preferred cadence: not yet stated — ask if it becomes relevant

## Out of scope
- Fixing bugs encountered while exploring (e.g. a real syntax error found in `backend/app/api/deps.py` during setup) — flagged to the user separately, not part of the curriculum
- Nothing else has been explicitly ruled out yet — revisit as the mission sharpens
