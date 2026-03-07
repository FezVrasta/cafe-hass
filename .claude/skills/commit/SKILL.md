---
name: commit
description: Create a git commit. Always use this skill when the user asks to commit changes. Runs linting, type checking, and formatting checks before committing to ensure all quality gates pass.
user-invocable: true
allowed-tools: Bash, Read, Edit, Write, Glob, Grep
---

The user wants to commit changes. Before creating any git commit, you MUST run all quality checks and fix any issues found. Follow these steps in order:

## Step 1: Run quality checks

Run all checks in parallel:

```bash
yarn lint:biome --fix
yarn typecheck
yarn format:check --fix
yarn test
```

## Step 2: Fix all issues

If any check fails:
- **Lint errors**: Run `yarn lint:biome --fix` to auto-fix, then manually fix remaining issues
- **Type errors**: Fix TypeScript errors in the affected files
- **Formatting**: Run `yarn format` (i.e. `yarn format:check --fix`) to auto-format all files

Re-run the failing checks after fixing until they all pass. Do NOT proceed to commit until every check passes with zero errors.

## Step 3: Create the commit

Only after all checks pass, follow the standard commit process:
1. Run `git status` and `git diff` to review changes
2. Stage the relevant files with `git add <specific files>`
3. Write a clear commit message following the existing style
4. Create the commit using a heredoc for the message:

```bash
git commit -m "$(cat <<'EOF'
<message here>

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

5. Run `git status` to confirm the commit succeeded.

**IMPORTANT**: Never use `--no-verify` or skip hooks. Never commit if any lint, typecheck, or format check is failing.
