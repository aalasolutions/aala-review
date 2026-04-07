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

### Input Validation

```go
// BLOCKING: trusting raw query parameter
func handler(w http.ResponseWriter, r *http.Request) {
    id := r.URL.Query().Get("id")
    row := db.QueryRow("SELECT * FROM users WHERE id = $1", id)
    // id is passed safely to SQL, but never validated as integer
}

// GOOD: validate input type and range before use
func handler(w http.ResponseWriter, r *http.Request) {
    idStr := r.URL.Query().Get("id")
    id, err := strconv.ParseInt(idStr, 10, 64)
    if err != nil || id <= 0 {
        http.Error(w, "invalid id", http.StatusBadRequest)
        return
    }
    row := db.QueryRow("SELECT * FROM users WHERE id = $1", id)
}

// GOOD: struct validation for JSON request bodies
type CreateUserRequest struct {
    Email    string `json:"email" validate:"required,email"`
    Password string `json:"password" validate:"required,min=8,max=100"`
}

func createUser(w http.ResponseWriter, r *http.Request) {
    var req CreateUserRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        http.Error(w, "invalid JSON", http.StatusBadRequest)
        return
    }
    if err := validate.Struct(req); err != nil {
        http.Error(w, "validation failed", http.StatusBadRequest)
        return
    }
    // proceed with validated data
}
```

Flag any HTTP handler that reads `r.Body`, query params, or path params without validation.

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

## Graceful Shutdown

```go
// IMPORTANT: server with no graceful shutdown drops in-flight requests
func main() {
    srv := &http.Server{Addr: ":8080", Handler: mux}
    log.Fatal(srv.ListenAndServe())
}

// GOOD: graceful shutdown on signal
func main() {
    srv := &http.Server{Addr: ":8080", Handler: mux}

    go func() {
        if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
            log.Fatal("listen:", err)
        }
    }()

    quit := make(chan os.Signal, 1)
    signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
    <-quit

    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()
    if err := srv.Shutdown(ctx); err != nil {
        log.Fatal("forced shutdown:", err)
    }
}
```

Flag any `http.Server` in `main()` that does not handle OS signals for graceful shutdown.

---

## Supply Chain

```text
# IMPORTANT: unpinned dependency in go.mod
require (
    github.com/lib/pq v0.0.0-20210101000000-abcdef123456 // pseudo-version, pin to release
)

# GOOD: pinned to tagged release
require (
    github.com/lib/pq v1.10.9
)
```

Rules:
- All dependencies should reference tagged releases, not pseudo-versions, unless a specific commit is required and documented.
- `go.sum` must be committed alongside `go.mod`.
- Flag any `replace` directive pointing to a local filesystem path in committed code.

---

## Algorithmic Complexity

Apply `SKILL.md` **Check J (Algorithmic Complexity)** and **Check I (Performance and Resource Management)**.

### Slice preallocation

```go
// IMPORTANT: append causes repeated reallocation when size is known
var results []string
for _, item := range items {
    results = append(results, item.Name)
}

// GOOD: preallocate when size is known
results := make([]string, 0, len(items))
for _, item := range items {
    results = append(results, item.Name)
}
```

Flag `append` in loops where the final size is knowable (from `len()` of source collection, query result count, etc.) but no capacity is preallocated.

### Map preallocation

```go
// NIT: map grows incrementally
m := make(map[string]int)
for _, item := range items {
    m[item.ID] = item.Value
}

// GOOD: preallocate when size is known
m := make(map[string]int, len(items))
for _, item := range items {
    m[item.ID] = item.Value
}
```

### String building

```go
// IMPORTANT: O(n²) string concatenation
var html string
for _, item := range items {
    html += fmt.Sprintf("<li>%s</li>", item.Name)
}

// GOOD: strings.Builder — amortized O(n)
var b strings.Builder
b.Grow(len(items) * 20) // estimate capacity
for _, item := range items {
    fmt.Fprintf(&b, "<li>%s</li>", item.Name)
}
html := b.String()
```

### Linear search to map index

```go
// BLOCKING: O(n) linear search per lookup
for _, order := range orders {
    for _, user := range users {  // scans entire users slice
        if user.ID == order.UserID {
            process(user, order)
        }
    }
}

// GOOD: O(1) map lookup
userMap := make(map[string]User, len(users))
for _, u := range users {
    userMap[u.ID] = u
}
for _, order := range orders {
    if user, ok := userMap[order.UserID]; ok {
        process(user, order)
    }
}
```

### Binary search on sorted slices

```go
// IMPORTANT: linear scan on sorted slice
func findUser(users []User, id int) (User, bool) {
    for _, u := range users {  // O(n) on sorted data
        if u.ID == id {
            return u, true
        }
    }
    return User{}, false
}

// GOOD: binary search — O(log n)
func findUser(users []User, id int) (User, bool) {
    idx := sort.Search(len(users), func(i int) bool {
        return users[i].ID >= id
    })
    if idx < len(users) && users[idx].ID == id {
        return users[idx], true
    }
    return User{}, false
}
```

### Bounded goroutine pools

```go
// BLOCKING: unbounded goroutine creation
for _, url := range urls {
    go fetch(url)  // N goroutines, can exhaust resources
}

// GOOD: bounded worker pool
sem := make(chan struct{}, 10) // max 10 concurrent
var wg sync.WaitGroup
for _, url := range urls {
    wg.Add(1)
    go func(u string) {
        defer wg.Done()
        sem <- struct{}{}
        defer func() { <-sem }()
        fetch(u)
    }(url)
}
wg.Wait()
```

### Unbounded HTTP calls in loop

```go
// BLOCKING: N sequential HTTP calls
for _, id := range userIDs {
    resp, err := http.Get(fmt.Sprintf("/api/users/%s", id))  // one per iteration
    // ...
}

// GOOD: batch endpoint if available
resp, err := http.Get(fmt.Sprintf("/api/users?ids=%s", strings.Join(userIDs, ",")))

// GOOD: bounded parallel with errgroup
g, ctx := errgroup.WithContext(ctx)
g.SetLimit(10)
for _, id := range userIDs {
    id := id
    g.Go(func() error {
        _, err := fetchUser(ctx, id)
        return err
    })
}
if err := g.Wait(); err != nil {
    return err
}
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
- [ ] HTTP handlers validate all input (params, body, query)
- [ ] Graceful shutdown implemented for long-running servers
- [ ] go.sum committed, dependencies pinned to tagged releases

### Algorithmic Complexity
- [ ] Slices preallocated with `make([]T, 0, n)` when size is known
- [ ] Maps preallocated with `make(map[K]V, n)` when size is known
- [ ] `strings.Builder` used for string building in loops, not `+` or `fmt.Sprintf`
- [ ] No nested linear scans inside loops — build map index; use `sort.Search` for sorted slices
- [ ] No I/O-in-loop or unbounded goroutines — use batch endpoints or bounded concurrency (`errgroup.SetLimit` / semaphore)
