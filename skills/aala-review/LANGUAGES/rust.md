# Rust

Reference for code review. Apply to all `.rs` files.

---

## Naming Conventions

| Item | Convention | Example |
|------|-----------|---------|
| Variable / function | snake_case | `frame_count`, `process_frame()` |
| Type / Struct / Enum | PascalCase | `CameraConfig`, `DetectionResult` |
| Trait | PascalCase | `FrameProcessor`, `Detectable` |
| Constant | UPPER_SNAKE_CASE | `MAX_FRAME_SIZE` |
| Module | snake_case | `camera_worker`, `inference` |
| Lifetime | short lowercase | `'a`, `'buf` |
| Generic type param | single uppercase or short PascalCase | `T`, `K`, `V`, `Err` |

---

## Safety

### Unsafe Code

```rust
// BLOCKING: unsafe without documented justification
unsafe {
    *ptr = value;
}

// IMPORTANT: any unsafe block must have a comment explaining:
// 1. Why unsafe is needed
// 2. What invariant guarantees safety

// ACCEPTABLE (with comment)
// SAFETY: ptr is guaranteed non-null and aligned by the allocator contract.
unsafe {
    std::ptr::write(ptr, value);
}
```

Flag every `unsafe` block. If it lacks a `// SAFETY:` comment, it is a violation.

### Unwrap in Production Code

```rust
// BLOCKING: unwrap can panic in production
let value = some_option.unwrap();
let result = some_result.unwrap();

// IMPORTANT: expect is slightly better but still panics
let value = some_option.expect("value must exist");

// GOOD: propagate with ?
fn process(input: Option<u32>) -> Result<u32, AppError> {
    let value = input.ok_or(AppError::MissingValue)?;
    Ok(value * 2)
}

// GOOD: provide default
let value = some_option.unwrap_or(0);
let value = some_option.unwrap_or_default();
let value = some_option.unwrap_or_else(|| compute_default());
```

Exception: `unwrap()` is acceptable in:
- Tests
- `main()` during startup where panic is appropriate
- Cases where the value is proven non-None by construction (document it)

### Integer Overflow

```rust
// BLOCKING: arithmetic that can overflow silently in release mode
let result = a + b;  // wraps in release, panics in debug

// GOOD: explicit overflow handling
let result = a.checked_add(b).ok_or(Error::Overflow)?;

// GOOD: saturating (clamp at max value)
let result = a.saturating_add(b);

// GOOD: wrapping (intentional wrap)
let result = a.wrapping_add(b);
```

Flag any arithmetic on user-provided values without overflow handling.

---

## Error Handling

### Result and Option

```rust
// BLOCKING: ignoring Result
std::fs::remove_file("temp.txt");  // returns Result, not checked

// GOOD: handle or explicitly ignore with comment
std::fs::remove_file("temp.txt").ok();  // intentional: best-effort cleanup

// GOOD: propagate
std::fs::remove_file("temp.txt")?;
```

### Custom Error Types

```rust
// IMPORTANT: using String as error type loses type information
fn parse(input: &str) -> Result<u32, String> { }

// GOOD: use thiserror for structured errors
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Parse error: {0}")]
    Parse(#[from] std::num::ParseIntError),
    #[error("Not found: {0}")]
    NotFound(String),
}
```

### Question Mark Operator

```rust
// IMPORTANT: converting between error types manually
fn load_config() -> Result<Config, AppError> {
    let content = match std::fs::read_to_string("config.toml") {
        Ok(c) => c,
        Err(e) => return Err(AppError::Io(e)),
    };
    // ...
}

// GOOD: use ? with From impl
fn load_config() -> Result<Config, AppError> {
    let content = std::fs::read_to_string("config.toml")?;
    let config: Config = toml::from_str(&content)?;
    Ok(config)
}
```

---

## Ownership and Borrowing

### Unnecessary Cloning

```rust
// IMPORTANT: cloning to avoid borrow checker instead of fixing the design
let name = user.name.clone();
process(name);
process(name.clone());

// GOOD: pass reference when ownership is not needed
fn process(name: &str) { }
process(&user.name);
```

Flag `.clone()` calls. Not all are wrong but each should be reviewed for necessity.

### Lifetimes

```rust
// IMPORTANT: lifetime elision hiding complexity
fn longest(x: &str, y: &str) -> &str {  // which lifetime?
    if x.len() > y.len() { x } else { y }
}

// GOOD: explicit lifetime
fn longest<'a>(x: &'a str, y: &'a str) -> &'a str {
    if x.len() > y.len() { x } else { y }
}
```

---

## Concurrency

### Shared State

```rust
// BLOCKING: shared mutable state without synchronization (won't compile, but flag design)
// If someone is using Arc<T> where T is not Send+Sync, flag it

// GOOD: Arc<Mutex<T>> for shared mutable state
use std::sync::{Arc, Mutex};

let shared = Arc::new(Mutex::new(Vec::new()));
let shared_clone = Arc::clone(&shared);

std::thread::spawn(move || {
    let mut data = shared_clone.lock().unwrap();
    data.push(42);
});
```

### Channel Usage

```rust
// GOOD: prefer message passing over shared state
use std::sync::mpsc;

let (tx, rx) = mpsc::channel::<FrameData>();

std::thread::spawn(move || {
    tx.send(frame).expect("receiver dropped");
});

let frame = rx.recv().expect("sender dropped");
```

### Deadlock Risk

Flag any code that acquires two locks in sequence. If lock A is always acquired before lock B, document it. If the order is inconsistent across call sites, that is a BLOCKING violation.

---

## Memory

### Box, Rc, Arc

| Type | Use when |
|------|---------|
| `Box<T>` | Single owner, heap allocation |
| `Rc<T>` | Multiple owners, single thread |
| `Arc<T>` | Multiple owners, across threads |
| `Weak<T>` | Break reference cycles |

Flag `Rc<T>` used in a multi-threaded context. Should be `Arc<T>`.

### String Types

```rust
// IMPORTANT: using String when &str suffices
fn greet(name: String) { }  // takes ownership unnecessarily

// GOOD: borrow when you only need to read
fn greet(name: &str) { }

// IMPORTANT: allocating String just to pass as &str
let s = format!("{}", value);
process(&s);

// GOOD: use format only when you actually need the owned String
```

---

## Type Design

### Newtype Pattern for Validation

```rust
// IMPORTANT: using primitives for domain values, allowing invalid states
fn create_user(age: u32) { }  // age could be 999

// GOOD: newtype enforces invariant at construction
pub struct Age(u32);

impl Age {
    pub fn new(value: u32) -> Result<Self, &'static str> {
        if value > 120 {
            return Err("Age out of range");
        }
        Ok(Age(value))
    }
}
```

### Enum for State

```rust
// IMPORTANT: using bool flags for state
struct Connection {
    is_connected: bool,
    is_reconnecting: bool,
    is_failed: bool,  // mutually exclusive states, error-prone
}

// GOOD: enum makes invalid states unrepresentable
enum ConnectionState {
    Connected,
    Reconnecting { attempt: u32 },
    Failed(String),
    Disconnected,
}
```

---

## Actix-Web (if used)

```rust
use actix_web::{web, HttpResponse, HttpServer, App};
use serde::{Deserialize, Serialize};
use validator::Validate;

// GOOD: typed and validated request body
#[derive(Debug, Deserialize, Validate)]
struct CreateUser {
    #[validate(email)]
    email: String,

    #[validate(length(min = 8, max = 100))]
    password: String,

    #[validate(range(min = 18, max = 120))]
    age: u8,
}

async fn create_user(user: web::Json<CreateUser>) -> actix_web::Result<HttpResponse> {
    // Validate input
    user.validate()
        .map_err(|e| actix_web::error::ErrorBadRequest(e))?;

    let hash = bcrypt::hash(&user.password, bcrypt::DEFAULT_COST)
        .map_err(|_| actix_web::error::ErrorInternalServerError("hashing failed"))?;

    Ok(HttpResponse::Created().finish())
}

// BLOCKING: exposing internal errors to client
async fn handler() -> impl Responder {
    match do_something() {
        Ok(v) => HttpResponse::Ok().json(v),
        Err(e) => HttpResponse::InternalServerError().body(e.to_string()),  // leaks internals
    }
}

// GOOD
async fn handler() -> impl Responder {
    match do_something() {
        Ok(v) => HttpResponse::Ok().json(v),
        Err(e) => {
            log::error!("handler error: {}", e);
            HttpResponse::InternalServerError().body("Internal server error")
        }
    }
}
```

---

## Performance

> See also `## Algorithmic Complexity` below for Vec preallocation, HashSet lookups, and clone-in-loop patterns.

### Avoid Allocation in Hot Loops

```rust
// IMPORTANT: allocating Vec on every iteration
for frame in frames {
    let result: Vec<Detection> = process(frame);  // allocates every loop
}

// GOOD: reuse buffer
let mut result_buf: Vec<Detection> = Vec::with_capacity(32);
for frame in frames {
    result_buf.clear();
    process_into(frame, &mut result_buf);
}
```

### Iterator Chains vs Loops

```rust
// GOOD: iterator chains are idiomatic and often optimized better
let emails: Vec<String> = users
    .iter()
    .filter(|u| u.is_active)
    .map(|u| u.email.clone())
    .collect();
```

---

## Security

### Input Validation

```rust
// IMPORTANT: using raw string input without validation
async fn create_user(body: web::Json<serde_json::Value>) -> impl Responder {
    let email = body["email"].as_str().unwrap(); // no validation
}

// GOOD: use typed structs with validation
use validator::Validate;

#[derive(Debug, Deserialize, Validate)]
struct CreateUser {
    #[validate(email)]
    email: String,

    #[validate(length(min = 8, max = 100))]
    password: String,
}
```

Flag any web handler that accepts `serde_json::Value` or untyped input without validation.

### SQL Injection

```rust
// BLOCKING: string interpolation in SQL
let query = format!("SELECT * FROM users WHERE email = '{}'", email);
sqlx::query(&query).fetch_one(&pool).await?;

// GOOD: parameterized query
sqlx::query("SELECT * FROM users WHERE email = $1")
    .bind(&email)
    .fetch_one(&pool)
    .await?;
```

### Hardcoded Credentials

```rust
// BLOCKING
let db_url = "postgres://admin:password@localhost/mydb";

// GOOD
let db_url = std::env::var("DATABASE_URL")
    .expect("DATABASE_URL must be set");
```

### Path Traversal

```rust
// BLOCKING
let path = format!("uploads/{}", user_filename);
let content = std::fs::read_to_string(&path)?;

// GOOD: validate path stays within base directory
use std::path::{Path, PathBuf};

let base = Path::new("uploads").canonicalize()?;
let requested = base.join(user_filename).canonicalize()?;
if !requested.starts_with(&base) {
    return Err(AppError::PathTraversal);
}
```

---

## Logging

Never log: `password`, `token`, `secret`, `authorization`, `cookie`, `api_key`.

```rust
// BLOCKING
log::info!("User login: email={}, password={}", email, password);
tracing::info!(token = %token, "Auth attempt");

// GOOD
log::info!("Login attempt: email={}", email);
tracing::info!(email = %email, ip = %ip, "Auth attempt");
```

---

## Supply Chain

```toml
# IMPORTANT: wildcard version
[dependencies]
serde = "*"

# GOOD: pinned version
[dependencies]
serde = "1.0.197"
serde_json = "1.0.114"
tokio = { version = "1.36.0", features = ["full"] }
```

Rules:
- All dependencies in `Cargo.toml` should specify exact versions or tight ranges.
- `Cargo.lock` must be committed for binary projects (applications, services).
- For library crates, `Cargo.lock` may be gitignored, but `Cargo.toml` version constraints must be meaningful (not `*`).
- Flag any `[patch]` section pointing to a git URL without a pinned `rev` or `tag`.

---

## Algorithmic Complexity

Apply `SKILL.md` **Check J (Algorithmic Complexity)** and **Check I (Performance and Resource Management)**.

Flag (severity depends on whether `n` is unbounded/user-controlled and whether this runs in a hot path):

### Linear search vs HashSet/HashMap

```rust
// BLOCKING: Vec::contains inside loop = O(n²)
let allowed: Vec<String> = get_allowed_ids();
for request in requests {
    if allowed.contains(&request.id) {  // O(n) per iteration
        process(request);
    }
}

// GOOD: O(1) lookup with HashSet
use std::collections::HashSet;

let allowed: HashSet<String> = get_allowed_ids().into_iter().collect();
for request in requests {
    if allowed.contains(&request.id) {  // O(1) per iteration
        process(request);
    }
}
```

Same applies to `.iter().find()`, `.iter().position()`, and `.iter().any()` called inside loops over related datasets.

### Clone in hot loops

```rust
// IMPORTANT: unnecessary clone on every iteration
for item in &items {
    let name = item.name.clone();  // allocates every iteration
    process_name(name);
}

// GOOD: borrow instead of cloning
for item in &items {
    process_name(&item.name);  // zero allocation
}

// If process_name needs ownership, consider restructuring to take &str
fn process_name(name: &str) { /* ... */ }
```

Review every `.clone()` inside a loop. Not all are wrong, but each must be justified. If the function can accept a reference, prefer borrowing.

### Collect into intermediate Vecs unnecessarily

```rust
// IMPORTANT: allocates intermediate Vec just to iterate again
let active: Vec<&User> = users.iter().filter(|u| u.is_active).collect();
for user in &active {
    send_notification(user);
}

// GOOD: chain iterators, no intermediate allocation
users.iter()
    .filter(|u| u.is_active)
    .for_each(|user| send_notification(user));
```

Flag `.collect::<Vec<_>>()` when the result is only iterated once and could remain a lazy iterator chain.

### String building in loops

```rust
// IMPORTANT: repeated format! + push_str allocates unnecessarily
let mut result = String::new();
for item in &items {
    result += &format!("{}: {}\n", item.key, item.value);  // format! allocates a new String each time
}

// GOOD: use write! macro to write directly into the buffer
use std::fmt::Write;

let mut result = String::with_capacity(items.len() * 32);  // preallocate estimate
for item in &items {
    write!(result, "{}: {}\n", item.key, item.value).unwrap();
}
```

### Vec reallocation in hot paths

```rust
// IMPORTANT: Vec grows by doubling, many small reallocations at start
let mut results = Vec::new();
for frame in frames {
    results.push(process(frame));  // reallocates multiple times if frames is large
}

// GOOD: preallocate when size is known or estimable
let mut results = Vec::with_capacity(frames.len());
for frame in frames {
    results.push(process(frame));
}
```

---

## Review Checklist

- [ ] Every `unsafe` block has a `// SAFETY:` comment
- [ ] No `.unwrap()` in production logic paths
- [ ] No unhandled `Result` return values
- [ ] Integer arithmetic on user input uses `checked_*` or `saturating_*`
- [ ] Custom error types use `thiserror` or `anyhow`
- [ ] `Arc` used instead of `Rc` in threaded code
- [ ] No unnecessary `.clone()` calls
- [ ] Newtype pattern used for domain values with constraints
- [ ] Enum used for mutually exclusive states
- [ ] No sensitive data in error messages returned to callers
- [ ] No allocation inside hot loops
- [ ] No string interpolation in SQL queries
- [ ] No hardcoded credentials in source
- [ ] File paths validated against base directory
- [ ] No passwords, tokens, or secrets in log output
- [ ] Cargo.lock committed for binary projects
- [ ] Dependencies pinned to specific versions

### Algorithmic Complexity
- [ ] No `Vec::contains` / `.iter().find()` inside loops on related datasets — use `HashSet`/`HashMap`
- [ ] No unnecessary `.clone()` inside hot loops — borrow where possible
- [ ] No `.collect::<Vec<_>>()` into intermediate Vecs that are only iterated once
- [ ] `Vec::with_capacity` used when collection size is known or estimable
- [ ] String building in loops uses `write!` macro or preallocated `String`, not repeated `format!` + `push_str`
