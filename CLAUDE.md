# Claude Development Guidelines

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

## Lessons Learned

### Project Structure
- Monorepo with shared, frontend, and transpiler packages
- Frontend builds to dist/ then copies to custom_components/cafe/www/
- Release workflow should verify directory structure before creating archives
