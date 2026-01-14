# Project Overview

**C.A.F.E.** (Complex Automation Flow Editor) is a visual flow editor for Home Assistant automations, inspired by Node-RED. It allows users to design automations as diagrams and transpiles them to 100% native Home Assistant YAML—no vendor lock-in. Automations remain editable in HA’s built-in editor.

# Repository Structure

```
hflow/
├── packages/
│   ├── shared/          # @cafe/shared - Types and Zod schemas
│   ├── frontend/        # @cafe/frontend - React UI (Vite + Tailwind)
│   └── transpiler/      # @cafe/transpiler - YAML parser/generator
├── custom_components/cafe/  # Home Assistant integration (Python)
└── .github/workflows/       # CI/CD pipelines
```

# Package Descriptions

- **@cafe/shared**: Zod schemas, TypeScript types, validation utilities
- **@cafe/frontend**: React 18 + XYFlow canvas + Zustand state + Radix UI
- **@cafe/transpiler**: YAML parsing, topology analysis, transpilation strategies

# Key Domains/Features

- Flow Canvas (trigger, condition, action, delay, wait nodes)
- YAML Parsing & Transpilation (YamlParser, FlowTranspiler)
- Home Assistant Integration (WebSocket API, entity/device/service registry)
- Simulation & Trace Visualization
- Property Editing Panels

# Build System & Tooling

- Yarn 4 workspaces + Turbo for orchestration
- TypeScript 5.7 with strict mode
- Vite for frontend builds
- Vitest for testing, make sure to use the --run flag to avoid issues with watch mode
- Biome for linting, and for formatting

# Coding Conventions

In addition to strict TypeScript rules:

- **Zod for Schema Validation**: All data structures use Zod schemas in `@cafe/shared`
- **Zustand for State**: Single cohesive store pattern in `flow-store.ts`
- **React Patterns**: Use `memo()` for nodes, `cn()` for class merging, and typed NodeProps
- **Import Aliases**: `@/` for frontend, `@cafe/*` for packages

# Common Commands

```bash
yarn dev          # Watch mode
yarn build        # Build all packages
yarn build:ha     # Build + copy to custom_components
yarn test         # Run tests
yarn typecheck    # Type checking
yarn lint:biome   # Linting
```

# Development Guidelines

## Release and Commit Policy

**IMPORTANT**: Never cut a new release or commit changes without first asking the user for permission.

Always ask before:

- Creating git commits
- Pushing changes to the repository
- Bumping version numbers
- Creating new releases/tags
- Running any git operations that modify the repository

The user should have full control over when changes are committed and released.

## TypeScript Code Quality

**STRICT TYPING REQUIRED**: Always maintain strict TypeScript types throughout the codebase.

**FORBIDDEN PRACTICES**:

- Never use `as` type assertions unless absolutely necessary for external API boundaries
- Never use `any` type - use proper type definitions or `unknown` with type guards
- Avoid type casting hacks or workarounds
- Don't suppress TypeScript errors with `@ts-ignore` or `@ts-expect-error`

**REQUIRED PRACTICES**:

- Define proper interfaces and types for all data structures
- Use type guards for runtime type checking
- Leverage TypeScript's strict mode features
- Create proper type definitions for external libraries if needed
- Use generic types appropriately for reusable components

The codebase should compile with zero TypeScript errors and maintain type safety throughout.

# Best Practices

## Code Reusability (DRY)

**REQUIRED PRACTICES**:

- **Helper Functions/Utilities**: Extract common logic into reusable helper functions or utility modules.
- **Generic Components**: Design React components to be as generic and reusable as possible, accepting props to customize behavior and appearance.
- **Shared Types/Schemas**: Leverage `@cafe/shared` for all common types, interfaces, and Zod schemas to ensure consistency and avoid duplication across `frontend` and `transpiler`.
- **Custom Hooks**: For shared stateful logic in React, create custom hooks.

**FORBIDDEN PRACTICES**:

- **Copy-pasting code**: Avoid duplicating blocks of code. If you find yourself copying and pasting, it's a sign that a reusable function or component is needed.
- **Redundant Type Definitions**: Do not redefine types or interfaces that already exist in `@cafe/shared` or can be derived from existing schemas.


# Cutting a New Release

To cut a new release, follow these steps:

**Important:** Before tagging and releasing, always bump the version in `custom_components/cafe/manifest.json` to match the new release version.

1. **Commit your changes**
   - Ensure all changes are staged and committed with a clear message.
   - Bump the version in `custom_components/cafe/manifest.json` to the new release version (e.g., "0.1.9").
   - Example:
     ```bash
     # Edit manifest.json and update the version field
     git add .
     git commit -m "Release: v0.x.x - <short description>"
     ```

2. **Create a new git tag**
   - Use semantic versioning (e.g., v0.1.9). For 1.x.x.
   - Example:
     ```bash
     git tag v0.1.9
     ```

3. **Push changes to remote**
   - Push your commits and tags to the remote repository.
   - Example:
     ```bash
     git push origin main
     git push origin --tags
     ```

4. **Create a GitHub release**
   - Use the GitHub CLI (`gh`) to create a release.
   - **Include the changelog in the GitHub release notes. Do NOT create a literal CHANGELOG.md file.**
   - Read the git commit history since the last release to compile the changelog. Focus on user-facing changes. Make sure to include:
     - New features
     - Bug fixes
     - Breaking changes
   - Example:
    ```bash
    # IMPORTANT: Use real newlines in the --notes argument, not literal \n. For multiline notes, write each line on a new line inside the string.
    gh release create v0.1.9 --title "C.A.F.E. v0.1.9" --notes "<release notes>"
    ```

4. **Verify release on GitHub**
   - Check the Releases page to confirm the new release is published.

**Note:** Do not cut a release without explicit user approval. Always confirm before pushing tags or creating releases.
