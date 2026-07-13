---
name: simplify
description: Review recently changed code for clarity, consistency, and maintainability improvements. Use when the user asks to simplify, clean up, improve readability, reduce complexity, remove redundancy, or run a /simplify-style pass over changed files. Supports --staged, --ref=REF, and explicit file paths.
---

# Simplify Changed Code

This skill ports the behavior of the `pi-simplify` extension to a normal TraeX skill.

## Invocation

When the user invokes this skill, parse optional arguments from the user text:

- `--staged`: inspect only staged changes.
- `--ref=<ref>`: diff against the given git ref. Default is `HEAD`.
- Any other tokens that look like file paths: restrict the review to those paths.

If the user does not provide explicit paths, run:

```bash
python3 /Users/bytedance/.config/agents/skills/simplify/scripts/simplify_scope.py [args...]
```

Run it from the target repository root. The script prints the changed-file scope and the exact review prompt to follow. If the current directory is not the target repo, pass `--cwd <repo>`.

## Process

1. Use the script to determine the file scope unless the user already named exact files.
2. If no files are found, tell the user no changed files were found.
3. Read only the listed files and the minimal surrounding project context needed for conventions.
4. Apply concrete simplification improvements one file at a time.
5. Preserve behavior and public APIs.
6. Run the relevant existing tests or checks when practical.
7. Summarize what changed and what verification ran.

## Review Principles

- Preserve functionality: never change what the code does. Existing tests must continue to pass.
- Apply project standards: follow conventions from `CLAUDE.md`, `AGENTS.md`, and local code.
- Enhance clarity: reduce unnecessary complexity and nesting, remove redundant code and abstractions, improve names, consolidate related logic, and remove comments that only restate obvious code.
- Avoid nested ternary operators; prefer `switch` statements or `if`/`else` chains for multiple conditions.
- Maintain balance: do not over-simplify, do not make clever code harder to understand, and do not collapse too many concerns into one function.

Do not add new features, change public APIs, or refactor outside the scoped files unless the user explicitly asks.
