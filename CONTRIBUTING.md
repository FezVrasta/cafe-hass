# Contributing

Thank you for considering contributing to C.A.F.E. This document explains how to set up the repository locally, run the project, run tests, and the preferred workflow for making changes, opening pull requests and preparing releases.

**Please read these guidelines before opening a PR.**

## Quick Start

- **Clone the repo**:
  - `git clone <repo-url>`
  - `cd cafe-hass`
- **Install**: The repository uses Yarn 4 workspaces. From the repository root run:
  - `yarn install`
- **Start development**: To run the frontend in watch/dev mode for local development:
  - `yarn dev` (from the `cafe-hass` folder in monorepo the root scripts will route properly)

## Project Structure (short)

- `packages/frontend` — React + Vite frontend UI
- `packages/shared` — shared types & Zod schemas
- `packages/transpiler` — YAML parsing & transpilation
- `custom_components/cafe` — Home Assistant integration (Python)

See the repository root and the `packages` folder for the full layout.

## Common Commands

- Install dependencies: `yarn install`
- Start frontend dev server: `yarn dev`
- Build all packages: `yarn build`
- Build and copy to Home Assistant component: `yarn build:ha`
- Run tests: `yarn test` (use `--run` to avoid Vitest watch mode when necessary)
- Typecheck: `yarn typecheck`
- Lint/format: `yarn check` and `yarn format`

If you need to run a command inside a package, change into that package directory and run the command there (for example `cd packages/frontend && yarn dev`).

## Development Guidelines

- Keep TypeScript strict — the codebase is compiled with `--strict` and must remain type-safe.
- Avoid `any`, `as` assertions, and `@ts-ignore` except when interacting with unavoidable external APIs; prefer `unknown` + type guards instead.
- Use `@cafe/shared` types and Zod schemas for shared shapes — do not re-declare common types.
- Extract reusable logic to helpers or custom hooks rather than duplicating code.
- In React/TypeScript files: do not use IIFEs; prefer named components or helper functions.

## Tests

- Unit tests use Vitest. Run all tests with `yarn test` from the repository root or run the package-local tests inside `packages/*`.
- When adding tests, aim for deterministic, fast tests. Use fixtures in `packages/transpiler/fixtures` or `__tests__/yaml-automation-fixtures` where appropriate.

## Branching, Commits & Pull Requests

- Create a short-lived feature branch from `main`: `git checkout -b feat/short-description`.
- Make small, focused commits with clear messages. Use present-tense, imperative form (e.g., "Add X feature").
- Run `yarn typecheck`, `yarn test`, `yarn check`, and `yarn format` before opening a PR.
- Open a pull request against `main`. In the PR description, include:
  - What the change does and why
  - Any breaking changes
  - Manual steps to test (if applicable)

## Code Review

- Be responsive to review comments. The reviewer may ask for additional tests or stricter types.
- Keep changes focused; if a review requests a larger refactor, consider creating follow-up PRs.

## Home Assistant Build / Deploy

- The repository includes scripts to copy builds into the Home Assistant custom component directory. Use `yarn build:ha` from the repo root to build and copy files.
- The manifest at [custom_components/cafe/manifest.json](custom_components/cafe/manifest.json#L1) must be kept in sync with release versions.

## Adding Packages or Tests

- When adding new packages under `packages/`, add workspace entries and update root `package.json` if required.
- Keep package `tsconfig.json` and `vitest.config.ts` consistent with existing packages.

## Security & Sensitive Data

- Do not commit secrets, credentials, or Home Assistant tokens into the repository. Use environment variables or secure secret stores.

## Getting Help

- If you are unsure about something, open an issue or ask maintainers on the project's communication channel.

Thank you for helping improve C.A.F.E.! We appreciate careful, well-tested contributions.
