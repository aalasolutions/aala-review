---
name: aala-review
description: |
  Automated code review. Checks naming conventions, DRY violations, single responsibility,
  separation of concerns, security vulnerabilities, and code quality against AALA standards.
  Supports full-codebase reviews, changeset reviews, incoming-change reviews, and PR branch
  comparisons. Use when reviewing a file, folder, changeset, or pull request.
  Triggers: "review this code", "code review", "/aala-review", "review [file/folder]",
  "check this file", "audit this", "what's wrong with this", "review my changes",
  "review this PR", "review incoming changes", "review the diff", "review this branch",
  "compare branches", "what changed", "pre-push review"
metadata:
  author: aalasolutions
  version: "1.1.0"
  argument-hint: <file-or-folder-or-branch>
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

# Code Review

Automated, systematic review against AALA coding standards.

Supports four review modes:

| Mode | When to use | Default trigger |
|------|-------------|-----------------|
| **Full codebase** | Audit an entire project or folder | `review src/` or `review this codebase` |
| **Changeset** | Review staged or recent changes before push | `review my changes` or `review the diff` |
| **Incoming** | Review what a remote branch brings | `review incoming changes` |
| **PR / Branch compare** | Compare two branches for pull-request review | `review this PR` or `compare branches` |

## Parameters

| Parameter | Default | Example |
|-----------|---------|---------|
| Target | Changed files (git diff HEAD~1) | `src/users/user.service.ts`, `api/`, `components/` |
| Mode | Auto-detected from target | `full`, `changeset`, `incoming`, `pr` |
| Base branch | Current branch | `main`, `develop` |
| Head branch | Current HEAD | `feature/auth` |

## Workflow

```
1. Scope statement     State what will be reviewed, the review mode, and which guides will be loaded
2. Load guides         Read base language guide, then framework overlays if detected
3. Determine scope     Detect review mode, resolve file list from target, diff, or branch comparison
4. Discover files      Find all reviewable source files matching the resolved scope
5. Open report file    Create .claude/plans/review-YYYY-MM-DD-HH-MM.md before reviewing anything
6. Review              Read each file fully, write findings directly to the report file as found
7. Chat summary        Print severity counts and must-fix list to chat after the file is complete
```

**The report file is created first (Step 5), before any code is read.** Every finding is written to the file as it is discovered. The chat message at the end is a count summary only - it never contains the findings themselves.

---

### Step 1: Detect Language and Framework, Then Load Guides

Identify the primary language(s) in scope, then read the corresponding base guide from `./LANGUAGES/` before touching any code.

After base guide loading, detect frameworks and load matching framework overlays.

| File extension | Load base guide |
|----------------|-----------------|
| `.ts`, `.tsx` | `./LANGUAGES/typescript.md` |
| `.js` | `./LANGUAGES/javascript.md` |
| `.go` | `./LANGUAGES/go.md` |
| `.py` | `./LANGUAGES/python.md` |
| `.rs` | `./LANGUAGES/rust.md` |
| `.html`, `.hbs`, `.jinja`, `.ejs` | `./LANGUAGES/html.md` |
| `.css`, `.scss`, `.sass` | `./LANGUAGES/css-scss.md` |
| `.php` | `./LANGUAGES/php.md` |
| `Dockerfile`, `docker-compose*.yml` | `./LANGUAGES/docker.md` (if exists), else apply Docker rules from `./LANGUAGES/python.md` |

Framework overlays (load in addition to base guide):

| Framework signal | Load overlay |
|------------------|--------------|
| `ember-cli-build.js`, `config/environment.js`, dependencies containing `ember` | `./LANGUAGES/framework-ember.md` |
| `express()` or `Router()` usage, dependencies containing `express` | `./LANGUAGES/framework-express.md` |
| `from fastapi import`, `FastAPI()`, `@app.get` or `@app.post` usage | `./LANGUAGES/framework-fastapi.md` |
| dependencies containing `laravel/framework`, route and controller conventions, Blade templates | `./LANGUAGES/framework-laravel.md` |
| files like `*.controller.ts`, `*.module.ts`, `main.ts` with Nest bootstrap, dependencies containing `@nestjs/` | `./LANGUAGES/framework-nestjs.md` |
| presence of `next.config.*`, `app/` or `pages/` route structure, dependencies containing `next` | `./LANGUAGES/framework-nextjs.md` |
| `vite.config.*`, dependencies containing `react` and `vite`, or JSX/TSX component trees in `src/` | `./LANGUAGES/framework-react-vite.md` |

If multiple languages are present, load all relevant base guides.
If one or more frameworks are present, load all relevant overlays.
Every finding must map to a rule from one of the loaded guides.

Use base and overlay files only.

---

### Step 2: Determine Scope and Review Mode

Detect the review mode from the user prompt and target. If the mode is ambiguous, ask the user.

#### Mode 1: Full Codebase

Triggered by a folder path, `review this codebase`, or an explicit `full` mode.

Review every reviewable file under the target directory (or project root if no target).

#### Mode 2: Changeset (pre-push / pre-commit)

Triggered by `review my changes`, `review the diff`, `pre-push review`, or when no target is provided.

Collect changed files:

```bash
# Staged changes (about to be committed)
git diff --name-only --cached 2>/dev/null

# Unstaged changes in working tree
git diff --name-only 2>/dev/null

# Commits not yet pushed to remote
UPSTREAM=$(git rev-parse --abbrev-ref '@{upstream}' 2>/dev/null)
if [ -n "$UPSTREAM" ]; then
  git diff --name-only "$UPSTREAM"..HEAD 2>/dev/null
else
  git diff --name-only HEAD~1 HEAD 2>/dev/null
fi
```

Combine all lists, deduplicate, and review each file. When reviewing a changeset, read the full file for context but **focus findings on the changed lines**. Run `git diff --unified=5` (or `git diff --cached --unified=5`) to identify exactly which lines changed, and prioritize review of those regions.

If all commands return empty, ask the user what to review.

#### Mode 3: Incoming Changes

Triggered by `review incoming changes`, `review what's coming`, or when the user names a remote branch.

Fetch and compare against the remote tracking branch:

```bash
git fetch origin 2>/dev/null

UPSTREAM=$(git rev-parse --abbrev-ref '@{upstream}' 2>/dev/null)
if [ -n "$UPSTREAM" ]; then
  git diff --name-only HEAD..."${UPSTREAM}" 2>/dev/null
fi
```

If upstream is not set, ask the user for the remote branch name and run:

```bash
git fetch origin {BRANCH} 2>/dev/null
git diff --name-only HEAD...origin/{BRANCH} 2>/dev/null
```

Review the incoming files. Focus findings on lines that will change after merge.

#### Mode 4: PR / Branch Compare

Triggered by `review this PR`, `compare branches`, `review feature/X against main`, or when two branch names are provided.

**Ref normalization:** Before constructing any git command, strip the `origin/` prefix from user-provided branch names if present. If the user passes `origin/main`, use `main` as the branch name so commands do not produce `origin/origin/main`.

```bash
# Strip origin/ prefix if present
BASE=$(echo "{BASE_BRANCH}" | sed 's|^origin/||')
HEAD_BR=$(echo "{HEAD_BRANCH}" | sed 's|^origin/||')

git fetch origin "$BASE" "$HEAD_BR" 2>/dev/null

# Three-dot diff: changes HEAD introduces relative to BASE
git diff --name-only "origin/${BASE}...origin/${HEAD_BR}" 2>/dev/null
```

If reviewing a local branch against a remote base:

```bash
BASE=$(echo "{BASE_BRANCH}" | sed 's|^origin/||')
git fetch origin "$BASE" 2>/dev/null
git diff --name-only "origin/${BASE}...HEAD" 2>/dev/null
```

Review all files that differ between the two branches. Read each full file for context, but **prioritize findings on the diff regions**. Use the detailed diff to identify changed lines:

```bash
git diff --unified=5 "origin/${BASE}...origin/${HEAD_BR}" -- {FILE}
```

#### Diff-Context Review Rule

In changeset, incoming, and PR modes: read the entire file to understand context, but weight your review toward the changed lines. A security vulnerability in an unchanged line is still a finding, but new violations introduced by the diff are **always BLOCKING or IMPORTANT**. Existing issues in unchanged code should be flagged at their normal severity.

Include the review mode in the report header (see Step 5).

---

### Step 3: Discover Files

In **full codebase** mode, if the target is a folder, list all reviewable files:

```bash
find {TARGET} \( -name "*.py" -o -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.go" -o -name "*.rs" -o -name "*.php" -o -name "*.html" -o -name "*.scss" -o -name "*.css" \) \
  -not -path "*/__pycache__/*" \
  -not -path "*/node_modules/*" \
  -not -path "*/vendor/*" \
  -not -path "*/.venv/*" \
  -not -path "*/dist/*" \
  -not -path "*/.next/*" \
  -not -path "*/target/*" \
  -not -path "*/.git/*"
```

In **changeset**, **incoming**, or **PR** modes, the file list comes from the git diff commands in Step 2. Filter that list to only include reviewable file extensions (same list above). Exclude deleted files:

```bash
# For changeset mode, exclude deleted files
git diff --name-only --diff-filter=d HEAD~1 HEAD 2>/dev/null
```

Also include `Dockerfile` and `docker-compose*.yml` files in the target.

Skip from code review scope: test files (`*_test.py`, `*_test.go`, `*.test.ts`, `*.spec.ts`), auto-generated files, bare `__init__.py` with no logic, migration files. Note: Check K still verifies whether test files exist for reviewed source files, but does not review test file contents.

Print the file list to chat before starting so the scope is visible.

---

### Steps 4 (Checks Reference)

These checks are applied during Step 6 (Review). One file at a time. Write each finding to the report file immediately as it is found.

#### Check A: Naming and Readability

- Variable names must be descriptive. Single-letter names outside loop counters are a violation.
- Function names: verb + noun, describes what the function does AND what it returns.
- Class names: PascalCase noun that matches what it represents.
- Constants: UPPER_SNAKE_CASE.
- Consistency: if one name pattern is used in one part of the file, it must be used throughout.
- Booleans: must read as a true/false question (`isActive`, `hasPermission`, `canSubmit`).

```bash
grep -n " [a-z] = " {FILE} | grep -v "for "
```

**Function name contract:** The name is a binding promise about what the function does. Read the body and ask: does it do ONLY what the name says, nothing more?

Violations to flag:
- `isUser(token)` that also calls `login()` and sets a session: name says "check", body does "login". BLOCKING.
- `getUser(id)` that deletes inactive records as a side effect: name says "read", body mutates. BLOCKING.
- `validateEmail(email)` that also saves to the database: name says "validate", body writes. IMPORTANT.
- `calculateTotal(items)` that applies discounts AND sends a confirmation email: three jobs in one. IMPORTANT.

When you find this pattern, flag the name as invalid AND flag the single-responsibility violation separately.

---

#### Check B: Single Responsibility

- Each function does ONE thing. If it fetches AND processes AND saves, flag it.
- Each class has one reason to change.
- Flag any function over 40 lines. Read it and confirm it is doing more than one thing before flagging.
- Flag any non-config file over 400 lines and explain the concerns.
- If a function mixes abstraction levels (raw DB query alongside business logic in the same function), flag it.

---

#### Check C: DRY (Don't Repeat Yourself)

- Identical or near-identical blocks repeated 2+ times: flag and suggest extraction.
- Repeated hardcoded values (URLs, timeouts, limits) that should be constants.
- Copy-pasted logic with minor variations that should be a parameterized function.
- Same validation written in two places (route + service): flag.

```bash
grep -n "{PATTERN}" {FILE}
```

---

#### Check J: Algorithmic Complexity

Catch obvious O(n²) or worse patterns in code that processes collections or runs in hot paths.

```typescript
// BLOCKING: O(n²) nested loop over same dataset
for (const user of users) {
  for (const order of orders) {
    if (order.userId === user.id) { }  // should be a Map lookup
  }
}

// GOOD: O(n) - build index first
const ordersByUser = new Map(orders.map(o => [o.userId, o]));
for (const user of users) {
  const order = ordersByUser.get(user.id);
}
```

```python
# BLOCKING: O(n) list lookup inside loop = O(n²)
for item in items:
    if item in big_list:  # list `in` is O(n)
        process(item)

# GOOD: O(1) set lookup
big_set = set(big_list)
for item in items:
    if item in big_set:
        process(item)
```

Flag:
- Nested loops iterating over the same or related datasets (use Map/Set/dict)
- `Array.find()` / `list.index()` / `in list` called inside a loop
- Database query inside a loop (N+1)
- Sorting the same collection multiple times

---

#### Check D: Separation of Concerns

- Route handlers / controllers: parse input, call service, return response. Nothing else.
- Database queries must not be inline in route handlers or controllers.
- Configuration and connection setup must not be inside request handlers.
- Business logic must not live in templates, components, or view layers.
- Infrastructure concerns (process spawning, file I/O, external service calls) belong in dedicated service modules, not embedded in framework bootstrap code.

---

#### Check E: Security

Run through every item for each file:

**Input Validation**
- All external inputs validated (type, length, format)?
- No raw user input passed to SQL queries, shell commands, or file paths?
- Request bodies have typed validation models (Pydantic, DTOs with class-validator, Zod)?

**Injection Prevention**
- No string interpolation or concatenation in SQL queries?
- subprocess / child_process calls use list/array args, not shell string with dynamic input?
- File paths validated against an allowed base directory before opening?

**Authentication and Authorization**
- No hardcoded credentials, tokens, or API keys in source code?
- All secrets from environment variables or config files?
- Protected routes have auth guards / middleware applied?

**Data Protection**
- Sensitive data not in log output?
- Error responses return generic messages to clients, not stack traces or internal details?
- No credentials of any kind embedded in URLs that appear in logs?

**Dependencies**
- Check if `package.json` or `requirements.txt` is in scope. If so, flag unpinned versions (`*`, `latest`, `^` without upper bound).

**Environment Files**
- Check for `.env` files committed to version control using a recursive search:

```bash
git ls-files '*.env' '*.env.*' '**/.env' '**/.env.*' 2>/dev/null
```

- `.env.example` or `.env.template` are acceptable if they contain only placeholder values (no real secrets).
- Flag any `.env` file containing real tokens, passwords, or API keys: **BLOCKING**.
- Flag any committed `.env` file that is not a template: **IMPORTANT**.

---

#### Check F: Language-Specific

Apply all rules from the loaded LANGUAGES guide. This is the primary check for language idioms, framework patterns, and language-specific security concerns.

---

#### Check G: Docker and Infrastructure

Applied to `Dockerfile` and `docker-compose*.yml` files:

- No `latest` tags on base images. Must pin to a specific version.
- Containers must not run as root. `user:` or `USER` directive required.
- Resource limits (`deploy.resources.limits`) defined.
- No secrets hardcoded in environment variables in compose files.
- `container_name` format: every container in the same file must follow the same pattern.
- Health checks defined for all long-running services.

---

#### Check H: Error Handling

- No silent catch/except blocks with no logging.
- Errors logged with context (function name, resource) before re-raising or handling.
- Specific exceptions caught wherever possible, not catch-all.
- Async rejection / promise rejection handled or propagated.

---

#### Check I: Performance and Resource Management

- No N+1 patterns: a loop that queries the database on every iteration.
- Resources released after use: file handles, DB connections, HTTP clients.
- Infinite loops must have a clear exit condition or an explicit daemon/background intent.

---

#### Check K: Test Coverage Awareness

When reviewing a source file, check whether a corresponding test file exists. Use the project's test naming convention to search within the target path:

```bash
# Search for test files matching the reviewed source file
find . -name "*_test.go" -o -name "*.test.ts" -o -name "*.spec.ts" -o -name "*.test.js" -o -name "*.spec.js" -o -name "test_*.py" -o -name "*_test.py" -o -name "*Test.php" 2>/dev/null
```

Flag:
- Source files with business logic or security-sensitive code that have no corresponding test file: **IMPORTANT**.
- Public API endpoints with no integration or request test: **IMPORTANT**.
- Complex branching logic (3+ conditions) with no unit test: **NIT**.

Do NOT flag missing tests for: config files, type definitions, interfaces, migration files, or simple re-exports.

This check verifies test file existence only. It does not review test file contents (test files are excluded from code review scope in Step 3).

---

### Step 5: Create the Report File

Before reading any code, create the report file:

```
{project-root}/.claude/plans/review-YYYY-MM-DD-HH-MM.md
```

Use the actual current date and time in the filename. Create the `.claude/plans/` directory if it does not exist. Write a header:

```markdown
# Code Review - YYYY-MM-DD HH:MM

**Mode:** [Full codebase | Changeset | Incoming | PR: base...head]
**Scope:** [what is being reviewed]
**Language guides loaded:** [list]
**Framework overlays loaded:** [list or "none"]

---
```

The file is now open. Every finding goes into this file, one at a time, as it is discovered. Do not accumulate findings in memory and write them at the end. Write each finding to the file the moment it is found.

---

### Step 6: Review Each File, Write to File

For each file in scope: read it fully, apply every check. Write each finding to the report file in this format:

```markdown
## [SEVERITY] Short descriptive title

**File:** `path/to/file.php` line N
**Rule:** [check name] / [specific rule from language guide]

**Issue:** [What is wrong and why it matters.]

**Current code:**
[code block]

**Fix:**
[code block]

---
```

**Severity levels:**

| Label | Meaning |
|-------|---------|
| `[BLOCKING]` | Security vulnerability, silent failure, broken architecture. Must fix before merge. |
| `[IMPORTANT]` | Violates DRY, SRP, naming, or architecture rules. Fix in this PR. |
| `[NIT]` | Style, minor inconsistency, optional improvement. |
| `[PRAISE]` | Something done well. Include at least one per file if warranted. |

**The report file is the review.** If a finding is not in the file, it does not exist. The chat is never the source of truth.

---

### Step 7: Chat Summary

After all files are reviewed and the report file is complete, post this summary to chat:

```
## Review Summary

Full report: .claude/plans/review-YYYY-MM-DD-HH-MM.md

Files reviewed: N
Findings:
  [BLOCKING]:  N
  [IMPORTANT]: N
  [NIT]:       N
  [PRAISE]:    N

### Must Fix Before Merge
- [title] in [file] line N
- ...

### Fix in This PR
- [title] in [file] line N
- ...
```

The chat message contains counts and the blockers list only. Every finding with its full code and fix is in the file.

---

## Guidance

- Load the language guide first. Every finding needs a rule behind it.
- Be specific. "Bad naming" is not a finding. "`x` on line 47 should be `requestCount`" is a finding.
- Show the fix. Not just what is wrong.
- If uncertain whether something is a real issue, say so explicitly. Do not flag false positives with confidence.
- Read code line by line. Do not skim.
- Match the language rules to the file: Python rules for `.py`, TypeScript rules for `.ts`. Do not cross-apply.
- In diff-based modes (changeset, incoming, PR), read the full file for context but weight your review toward the changed lines. New violations introduced by the diff are always the highest priority.
- When reviewing a PR, consider cross-file impact: does a change in one file break assumptions in another changed file?

**NEVER leave things out "for brevity".** This is a complete code review. If a file has 12 issues, report all 12. Do not summarize, truncate, or say "and similar issues exist elsewhere". Every finding gets its own entry with full file path, line number, current code, and fix. Partial reviews are worthless to the developer reading the report.

**The report file must not be a summary.** If the saved file contains "Top 5 issues" or "Recommended next steps" instead of every individual finding in full format, the review failed. A 332-file codebase with 48 findings means the file has 48 complete entries - not a bullet list. Write them all.
