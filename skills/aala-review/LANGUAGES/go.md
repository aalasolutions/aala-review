# Go

Reference for code review. Apply to all `.go` files.

---

## Naming Conventions

| Item | Convention | Example |
|------|-----------|---------|
| Package | lowercase, short | `auth`, `billing` |
| Exported symbol | PascalCase | `CreateUser`, `UserService` |
| Unexported symbol | camelCase | `validateToken`, `repo` |
| Interface | behavior-based name | `UserStore`, `TokenVerifier` |
| Constant | mixedCaps or UPPER for globals | `maxRetries`, `HTTPTimeout` |
| Boolean | is/has/can prefix | `isActive`, `hasAccess` |

Flag package names with underscores or mixed case.

---

## Error Handling

```go
// BLOCKING: ignored error
data, _ := os.ReadFile("config.json")

// BLOCKING: panic in request path
func handler(w http.ResponseWriter, r *http.Request) {
    panic("db failed")
}

// GOOD: handle and wrap
data, err := os.ReadFile("config.json")
if err != nil {
    return fmt.Errorf("read config: %w", err)
}
```

Rules:
- Never ignore returned errors with `_` unless explicitly intentional and documented.
- No `panic` in normal request flow.
- Wrap errors with context using `%w`.

---

## Context and Timeouts

```go
// IMPORTANT: no timeout, can hang forever
req, _ := http.NewRequest("GET", url, nil)
resp, err := http.DefaultClient.Do(req)

// GOOD: context + timeout
ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
defer cancel()

req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
if err != nil { return err }
resp, err := client.Do(req)
```

Flag external calls without context deadlines in service paths.

---

## Concurrency and Goroutines

```go
// BLOCKING: goroutine leak, no cancel path
go worker.Run()

// GOOD: lifecycle tied to context
go func() {
    if err := worker.Run(ctx); err != nil {
        logger.Error("worker failed", "err", err)
    }
}()
```

Rules:
- Goroutines must have cancellation strategy.
- Shared mutable state must use channels, mutexes, or atomics.
- Flag data races from unsynchronized map writes.

---

## Security

### SQL Injection

```go
// BLOCKING
query := "SELECT * FROM users WHERE email = '" + email + "'"
rows, err := db.Query(query)

// GOOD
rows, err := db.Query("SELECT * FROM users WHERE email = $1", email)
```

### Command Injection

```go
// BLOCKING
cmd := exec.Command("sh", "-c", "ping "+host)

// GOOD
cmd := exec.Command("ping", "-c", "1", host)
```

### Path Traversal

```go
// BLOCKING
path := "uploads/" + filename

// GOOD
base := filepath.Clean("uploads")
full := filepath.Join(base, filepath.Base(filename))
if !strings.HasPrefix(full, base) {
    return errors.New("invalid path")
}
```

---

## HTTP API Rules

- Validate all request payloads.
- Return generic client errors for internal failures.
- Do not leak stack traces or secrets in responses.
- Set explicit status codes and content types.

```go
// IMPORTANT: leaking internal error
http.Error(w, err.Error(), http.StatusInternalServerError)

// GOOD
logger.Error("create user failed", "err", err)
http.Error(w, "internal server error", http.StatusInternalServerError)
```

---

## Logging

Never log: `password`, `token`, `secret`, `authorization`, `cookie`, `apiKey`.

```go
// BLOCKING
logger.Info("login", "email", email, "password", password)

// GOOD
logger.Info("login attempt", "email", email, "ip", ip)
```

---

## Review Checklist

- [ ] Errors are checked and wrapped with context
- [ ] No panic in request flow
- [ ] External calls use context timeouts
- [ ] Goroutines have cancellation strategy
- [ ] No SQL string concatenation
- [ ] No shell command construction with user input
- [ ] File paths sanitized before use
- [ ] Sensitive data excluded from logs
