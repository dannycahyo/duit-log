# Contributing to DuitLog

DuitLog is a personal project, but contributions and suggestions are welcome.

## Development Setup

Follow the [Getting Started](README.md#getting-started) section in the README to set up your local environment.

## Code Style

- **TypeScript strict mode** is enabled — fix all type errors before committing.
- **Tailwind utility classes only** — no custom CSS files (except `app.css` for Tailwind directives).
- **Server-only code** goes in `.server.ts` files to ensure it never ships to the client bundle.
- **React Router conventions** — use `loader`, `action`, `useLoaderData`, `useActionData`, and `<Form>`.
- **Zod** for all input validation — define schemas in `app/lib/validation.ts`.

## Branching

Create feature branches off `master` with descriptive names:

- `feat/offline-queue`
- `fix/amount-validation`
- `docs/update-readme`

## Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/) format:

```
feat: add offline expense queue
fix: correct amount decimal parsing
docs: update Google Sheets setup instructions
chore: upgrade React Router to v7.13
```

## Pull Requests

- Describe **what** changed and **why**.
- Include screenshots for UI changes.
- Ensure `npm run typecheck` passes before opening a PR.
