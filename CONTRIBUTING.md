# Contributing

Thanks for helping with the RPGO MVP. Start with [`AGENTS.md`](AGENTS.md), then [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and [`docs/TESTING.md`](docs/TESTING.md).

## Workflow

1. Pick a small vertical change.
2. Read the relevant app `AGENTS.md` and docs.
3. Search for existing patterns before creating abstractions.
4. Implement with tests.
5. Update documentation and `CHANGELOG.md`.
6. Run the verification suite.
7. Describe changed docs and verification results in your summary.

## Branch and commit style

- Keep commits focused. One behavioural change per commit where practical.
- Use imperative subjects: `Add opportunity expiry by world turn`.
- Reference an ADR when a material decision changes.

## Code style

- TypeScript strict mode, no implicit `any`.
- Biome formatting: 2 spaces, 100-column lines, double quotes, semicolons.
- Domain code is pure and infrastructure-free.
- Application code coordinates; it does not execute SQL or make HTTP calls directly except through infrastructure.
- Prefer explicit types at module boundaries.
- Do not leave unexplained TODOs or dead debug code.

## Tests

```bash
bun test
bun run typecheck
bun run lint
bun run build
bun run docs:check
```

Required coverage for changes:

- New formula or rule: unit test.
- New command or state transition: integration test, including duplicate operation.
- New LLM schema or validation rule: model-contract test with a fixture.
- New screen or interaction: manual playtest step in the PR description; no brittle UI snapshot requirement.

Tests must never require a live model server. Use `DisabledLlmProvider` or a stub.

## Database changes

- Add `migrations/NNNN_description.sql`; never modify an applied migration.
- Run migrations from an empty database in tests.
- Foreign keys are enabled. Store timestamps in UTC ISO strings and world turns as integers.
- Add unique constraints for idempotency keys.

## Documentation changes

Every behaviour change updates the relevant docs in the same change:

- Architecture or dependency flow → `docs/ARCHITECTURE.md`.
- Game rules, formulas or balance → `docs/GAME_DESIGN.md`.
- Tables or constraints → `docs/DATA_MODEL.md`.
- Prompt, schema, provider or fallback behaviour → `docs/LLM_PIPELINE.md` and `docs/prompts/`.
- Commands, configuration, backups or troubleshooting → `docs/OPERATIONS.md`.
- Test strategy → `docs/TESTING.md`.
- Material decision → new ADR under `docs/decisions/`.

`bun run docs:check` verifies required files and internal links. It cannot verify semantic accuracy; that remains a reviewer responsibility.

## ADR process

Use the format in existing ADRs. Accepted ADRs are historical records: to change a decision, add a new ADR with status `Accepted` and mark the old one `Superseded` by the new one.

## Secrets

Never commit `.env` files, API keys or database files. Use `.env.example` for documented configuration. Diagnostics must not expose secrets.
