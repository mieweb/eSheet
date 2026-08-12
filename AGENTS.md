# Repository Guidelines

- This is a pnpm workspace containing published libraries in `packages/` and private applications in `apps/`.
- Run workspace tasks through the root scripts: `pnpm build`, `pnpm test`, `pnpm lint`, `pnpm typecheck`, and `pnpm format:check`.
- Use `pnpm --filter <package> <script>` for a single workspace and `<package>...` when its dependencies must be included.
- Keep internal package dependencies on `workspace:*` unless a deliberate exception is documented.
- Keep applications private; only packages participate in synchronized releases.
- When the user asks to create a ticket, return it in raw Markdown only, with no surrounding explanation, intro, or code fences.
