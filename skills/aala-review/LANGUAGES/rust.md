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

// GOOD: Pydantic equivalent in Rust
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
