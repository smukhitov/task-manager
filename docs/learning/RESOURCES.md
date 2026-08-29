# Full-Stack Patterns Resources

## Knowledge

- [GitHub: fastapi/full-stack-fastapi-template](https://github.com/fastapi/full-stack-fastapi-template)
  The upstream template `task-manager` is forked from. Use for: seeing the "canonical" version of any pattern found here, and for release notes when the fork diverges.
- [FastAPI docs: Dependencies](https://fastapi.tiangolo.com/tutorial/dependencies/)
  Official explanation of `Depends()` and the dependency-injection system. Use for: understanding `SessionDep` / `CurrentUser` in `backend/app/api/deps.py`, and DI in general.
- [SQLModel docs](https://sqlmodel.tiangolo.com/)
  Official docs for the ORM layer (Pydantic + SQLAlchemy combined). Use for: understanding the `Base` / `Create` / `Update` / `Public` model-splitting pattern in `backend/app/models.py`.
- [TanStack Router docs: Overview](https://tanstack.com/router/latest/docs/overview)
  Official docs for the frontend's file-based, fully-typed router. Use for: `frontend/src/routes/**`, route guards like `beforeLoad`.
- [TanStack Query docs: Overview](https://tanstack.com/query/latest/docs/framework/react/overview)
  Official docs for server-state caching/fetching. Use for: how the frontend wraps the generated API client in queries/mutations.
- [Hey API (openapi-ts): Get Started](https://heyapi.dev/docs/openapi/typescript/get-started)
  Docs for the codegen tool that turns the backend's OpenAPI schema into `frontend/src/client/*`. Use for: the "typed contract" pattern — arguably the single most reusable idea in this stack.

## Wisdom (Communities)

- [FastAPI GitHub Discussions](https://github.com/fastapi/fastapi/discussions)
  Maintainer-adjacent, high-signal for real design questions (vs. Stack Overflow noise). Use for: "is this the idiomatic way to do X" questions.

## Gaps
- No community identified yet for the React/TanStack side specifically, or for full-stack architecture critique generally — revisit once lessons get past the orientation stage.
- Community/wisdom-seeking hasn't been discussed with the user yet — don't push it until it's clear they want it.
