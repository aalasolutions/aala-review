# Performance & Algorithmic Complexity (Reference)

This reference expands the core review checks:
- **Check J: Algorithmic Complexity**
- **Check I: Performance and Resource Management**

Use this when you see code that scales with input size (records, requests, users, payload length) or runs in hot paths.

---

## Severity rubric (how to label findings)

**[BLOCKING]** when any of the following is true:
- Runs in a **request/handler hot path** and can be triggered frequently.
- Input size is **unbounded or user-controlled** (query params, request body arrays, uploaded files, search strings, IDs list).
- Performs **I/O in a loop** (DB/HTTP/filesystem) with N scaling.
- Enables a **security DoS vector** (e.g., catastrophic regex backtracking / ReDoS).

**[IMPORTANT]** when:
- Not in the direct hot path but will be expensive on realistic production data.
- A batch/cron job scales poorly and will grow with data size.

**[NIT]** when:
- Inputs are **explicitly bounded** (hard limit, pagination cap) and the code is not in a hot path.

If there is **no explicit bound**, assume it is unbounded.

---

## Patterns to flag (with common fixes)

### 1) I/O in a loop (generalized N+1)

**Flag:** database queries, HTTP calls, or filesystem reads/writes executed once per item.

**Examples to flag:**
- `for id in ids: db.fetch(id)`
- `Promise.all(items.map(i => fetch(urlFor(i))))` with no concurrency limit

**Fix patterns:**
- Batch queries (`WHERE id IN (...)`), joins, eager loading.
- Bulk API endpoints.
- Parallelize with a **concurrency cap** (worker pool / semaphore) when batching is not possible.

---

### 2) Accidental O(n²) collection usage

**Flag:** linear search inside a loop:
- JS/TS: `Array.includes`, `find`, `indexOf` inside loops
- Python: `x in list`, `list.index` inside loops

**Fix patterns:**
- Build an index once: `Map/Set/dict`.
- Pre-group by key.

---

### 3) Repeated full passes / repeated sorting

**Flag:**
- Sorting the same list multiple times.
- Multiple `filter/map/reduce` passes when one pass is sufficient in hot paths.

**Fix patterns:**
- Sort once, reuse result.
- Combine passes into a single loop when it materially reduces work.

---

### 4) Regex ReDoS (catastrophic backtracking)

**Flag:** complex regex applied to untrusted input, especially with nested quantifiers like `(a+)+` or ambiguous groups.

**Fix patterns:**
- Prefer non-regex parsing or a trusted validation library.
- Bound input length before applying regex.
- Use safe/linear-time regex patterns.

---

### 5) String concatenation in loops

**Flag:** building large strings via repeated concatenation.

**Fix patterns:**
- JS/TS: push fragments into an array and `join('')`.
- Python: collect into list and `''.join(parts)`.
- Go: `strings.Builder`.
- PHP: consider array + `implode()` for large concatenations.

---

### 6) Recursion without guards or memoization

**Flag:** recursion that can run deep on user data, or recomputes subproblems.

**Fix patterns:**
- Memoize / dynamic programming.
- Convert to iterative.
- Add depth/size guards.

---

### 7) Space complexity: collect-all vs stream/paginate

**Flag:** loading entire datasets into memory when streaming/pagination works.

**Fix patterns:**
- Pagination caps (`limit`, `pageSize`) with hard maximum.
- Streaming/iterators/generators.
- Chunked processing.

---

## Reviewer prompts (questions to ask)

- What is the expected max **N**? Is it bounded?
- Is this code executed **per request**? per user action?
- Are there **DB/HTTP/fs calls** inside loops?
- Is concurrency bounded (avoid unbounded `Promise.all` / goroutine floods)?
- Could input be attacker-controlled (ReDoS / amplification)?
