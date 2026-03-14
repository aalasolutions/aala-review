# AGENTS.md

This file guides AI coding agents working in this repository.

## Repository Overview

- Root skill directory: `skills/`
- Current published skill: `skills/aala-review/`
- Primary skill definition file: `skills/aala-review/SKILL.md`
- Current version: `1.1.0`

## Skill Packaging Rules

1. Skill directory names must be kebab-case.
2. Each skill must include `SKILL.md`.
3. Keep `SKILL.md` focused and reference supporting files for details.
4. Use framework overlay files instead of duplicating framework rules in base language files.
5. Keep skill metadata up to date in `SKILL.md` frontmatter.

## Review Modes

The skill supports four review modes (defined in `SKILL.md`):

1. **Changeset** (default): review staged/unstaged/recent changes before push
2. **Full codebase**: audit an entire project or folder
3. **Incoming**: review what a remote branch brings after merge
4. **PR / Branch compare**: compare two branches using `git fetch`

## Current Code Review Structure

- Base language guides:
  - `LANGUAGES/javascript.md`
  - `LANGUAGES/typescript.md`
  - `LANGUAGES/go.md`
  - `LANGUAGES/python.md`
  - `LANGUAGES/php.md`
  - `LANGUAGES/rust.md`
  - `LANGUAGES/html.md`
  - `LANGUAGES/css-scss.md`
- Framework overlays:
  - `LANGUAGES/framework-express.md`
  - `LANGUAGES/framework-ember.md`
  - `LANGUAGES/framework-fastapi.md`
  - `LANGUAGES/framework-laravel.md`
  - `LANGUAGES/framework-nestjs.md`
  - `LANGUAGES/framework-nextjs.md`
  - `LANGUAGES/framework-react-vite.md`

## Installation Paths

- Claude Code default: `~/.claude/skills/`
- Codex default: `~/.codex/skills/`
- Cursor default: `~/.cursor/skills/`
- Continue default: `~/.continue/skills/`

## Packaging Commands

```bash
npm run package:skill -- --skill aala-review
```

This creates:
- `dist/aala-review.zip`

## Installer Commands

```bash
npm run install:skill -- --skill aala-review --agent claude
npm run install:skill -- --skill aala-review --target ~/.claude/skills
```

## Publishing Notes

1. Push this repository to GitHub.
2. Keep `README.md`, `AGENTS.md`, and `CLAUDE.md` in sync.
3. For Skills CLI compatibility, keep skills under `skills/{skill-name}/SKILL.md`.
4. Tag releases using semantic versioning.
