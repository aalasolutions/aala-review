# AALA Review Skill

A collection of installable skills for AI coding agents.

This repository currently ships one skill:

- `aala-review`: systematic code review with language guides and framework overlays

## Coverage Matrix

### v1.2 (Current)

Base languages:

- JavaScript
- TypeScript
- Go
- Python
- PHP
- Rust
- HTML
- CSS/SCSS

Framework overlays:

- Express
- Ember
- FastAPI
- Laravel
- NestJS
- NextJS
- React/Vite

### Roadmap

Planned framework overlays:

- Angular
- Vue
- Django

## Review Modes

The skill supports four review modes:

| Mode | Command | What it reviews |
|------|---------|-----------------|
| **Changeset** (default) | `review my changes` or `review the diff` | Staged, unstaged, and recent commit changes |
| **Full codebase** | `review src/` or `review this codebase` | Every reviewable file in a folder or project |
| **Incoming** | `review incoming changes` | What a remote branch will bring after merge |
| **PR / Branch compare** | `review this PR` or `compare branches` | Differences between two branches |

## Installation

### Option 1: Using the community `skills` CLI

```bash
npx skills add aalasolutions/aala-review
```

### Option 2: Direct install for Claude Code

```bash
cp -r skills/aala-review ~/.claude/skills/
```

### Option 3: Local installer script (multi-agent presets)

```bash
npm run install:skill -- --skill aala-review --agent claude
```

Supported `--agent` presets:

- `claude` -> `~/.claude/skills`
- `codex` -> `~/.codex/skills`
- `cursor` -> `~/.cursor/skills`
- `continue` -> `~/.continue/skills`

Use `--target` to provide a custom path.

## Usage

Once installed, the skill auto-activates when relevant prompts are detected.

Review reports are saved to `.aala-reviews/` in the project root (e.g. `.aala-reviews/review-2026-03-22-14-30.md`). The user can also choose chat-only output.

Examples:

- `Review this file for security and architecture issues`
- `Audit these changed files`
- `Code review this folder`

## Skill Structure

Each skill contains:

- `SKILL.md` for activation and workflow
- `LANGUAGES/` for base language rules and framework overlays
- optional scripts and references in future versions

## Versioning

- Skill version is stored in frontmatter under `metadata.version`
- Package version is in `package.json`

## License

MIT
