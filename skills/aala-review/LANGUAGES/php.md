# PHP

Reference for code review. Apply to all `.php` files.

---

## Naming Conventions

| Item | Convention | Example |
|------|-----------|---------|
| Variable and function | camelCase | `$userId`, `getUserById()` |
| Class | PascalCase | `UserController`, `PaymentService` |
| Constant | UPPER_SNAKE_CASE | `MAX_RETRY_COUNT`, `DEFAULT_TIMEOUT` |
| Interface | PascalCase, noun | `Authenticatable`, `Billable` |
| Trait | PascalCase, adjective | `HasTimestamps`, `SoftDeletes` |
| Boolean | is/has/can prefix | `$isActive`, `$hasPermission`, `$canSubmit` |

---

## Type Declarations

All files must begin with `declare(strict_types=1)`. All function signatures must have parameter and return types.

```php
// BLOCKING
function processPayment($amount, $currency) {
    return $amount * getRate($currency);
}

// GOOD
declare(strict_types=1);

function processPayment(float $amount, string $currency): float
{
    return $amount * getRate($currency);
}
```

---

## Security

### SQL Injection

```php
// BLOCKING
$query = "SELECT * FROM users WHERE id = " . $_GET['id'];
$result = mysqli_query($conn, $query);

// GOOD
$stmt = $pdo->prepare('SELECT * FROM users WHERE email = :email');
$stmt->execute(['email' => $email]);
```

### XSS

```php
// BLOCKING
echo "<div>" . $_GET['name'] . "</div>";

// GOOD
echo "<div>" . htmlspecialchars($_GET['name'], ENT_QUOTES, 'UTF-8') . "</div>";
```

### Path Traversal

```php
// BLOCKING
$filename = $_GET['file'];
$content = file_get_contents('/uploads/' . $filename);

// GOOD
$base = realpath('/var/app/uploads');
$path = realpath($base . '/' . $filename);
if ($path === false || !str_starts_with($path, $base)) {
    throw new RuntimeException('Path traversal detected');
}
$content = file_get_contents($path);
```

### Command Injection

```php
// BLOCKING
exec("ping " . $_GET['host']);

// GOOD
$allowedHosts = ['example.com', 'localhost'];
if (!in_array($_GET['host'], $allowedHosts, true)) {
    throw new InvalidArgumentException('Host not allowed');
}
exec('ping ' . escapeshellarg($_GET['host']));
```

### Hardcoded Credentials

```php
// BLOCKING
$db = new PDO('mysql:host=localhost', 'root', 'password123');

// GOOD
$db = new PDO($_ENV['DB_DSN'], $_ENV['DB_USER'], $_ENV['DB_PASSWORD']);
```

### Timing-Safe Token Comparison

```php
// BLOCKING: regular comparison leaks timing information
if ($token === $storedToken) {
    // attacker can measure response time to guess token byte-by-byte
}

// GOOD: constant-time comparison for tokens, CSRF values, API keys
if (!hash_equals($storedToken, $token)) {
    throw new AuthenticationException('Invalid token');
}
```

Flag any direct `===` or `==` comparison of tokens, CSRF values, API keys, or session identifiers. Use `hash_equals()` instead.

---

## Password Handling

```php
// BLOCKING
$hash = md5($password);

// GOOD
$hash = password_hash($password, PASSWORD_ARGON2ID);
if (!password_verify($password, $storedHash)) {
    throw new AuthenticationException('Invalid credentials');
}
```

---

## Error Handling

```php
// BLOCKING
try {
    $this->processPayment($order);
} catch (Exception $e) {
    // silently ignored
}

// GOOD
try {
    $this->processPayment($order);
} catch (Exception $e) {
    Log::error('Payment processing failed', ['order_id' => $order->id, 'error' => $e->getMessage()]);
    return response()->json(['error' => 'Payment processing failed'], 500);
}
```

---

## Logging

Never log sensitive fields:
`password`, `token`, `api_key`, `secret`, `authorization`, `credit_card`, `otp`, `pin`

```php
// BLOCKING
Log::info('User login', ['password' => $password]);

// GOOD
Log::info('User login successful', ['user_id' => $user->id]);
```

---

## Supply Chain

```text
# IMPORTANT: unpinned
"laravel/framework": "*"
"guzzlehttp/guzzle": "^7.0"

# GOOD: pinned
"guzzlehttp/guzzle": "7.9.2"
```

---

## Algorithmic Complexity

Apply `SKILL.md` **Check J (Algorithmic Complexity)** and **Check I (Performance and Resource Management)**.

Flag (severity depends on whether `n` is unbounded/user-controlled and whether this runs in a hot path):

### Linear search inside loops

```php
// BLOCKING: in_array inside loop = O(n²)
$allowed = ['admin', 'editor', 'viewer', /* ... many roles */];
foreach ($users as $user) {
    if (in_array($user->role, $allowed)) {  // O(n) per iteration
        $result[] = $user;
    }
}

// GOOD: O(1) lookup with flipped array
$allowedMap = array_flip($allowed);
foreach ($users as $user) {
    if (isset($allowedMap[$user->role])) {  // O(1) per iteration
        $result[] = $user;
    }
}
```

Same applies to `array_search()` called inside loops. For associative lookups, prefer `isset()` or `array_key_exists()` over `in_array()`.

### String concatenation in loops

```php
// IMPORTANT: O(n²) string building with .= on large output
$html = '';
foreach ($items as $item) {
    $html .= '<li>' . htmlspecialchars($item->name) . '</li>';
}

// GOOD: collect pieces, implode once
$parts = [];
foreach ($items as $item) {
    $parts[] = '<li>' . htmlspecialchars($item->name) . '</li>';
}
$html = implode('', $parts);
```

### I/O in loops (generalized N+1)

Flag DB/HTTP/filesystem I/O performed once per item.

Fix patterns:
- Add bulk endpoints / batch queries (e.g., `WHERE id IN (...)`)
- Paginate with a hard cap
- Use bounded concurrency when batching isn’t possible

(Framework-specific eager-loading examples belong in the relevant framework overlay, e.g. Laravel.)


### array_merge in loops

```php
// IMPORTANT: array_merge inside loop = O(n²) total copies
$result = [];
foreach ($batches as $batch) {
    $result = array_merge($result, $batch);  // copies entire $result each time
}

// GOOD: spread operator or array_push
$result = array_merge(...$batches);

// GOOD: for large datasets
$result = [];
foreach ($batches as $batch) {
    array_push($result, ...$batch);
}
```

### ReDoS (Regex Denial of Service)

```php
// BLOCKING: catastrophic backtracking on crafted input
preg_match('/^([a-zA-Z0-9])+@/', $userInput);

// GOOD: linear-time pattern + length bound
if (strlen($userInput) > 254) {
    throw new InvalidArgumentException('Input too long');
}
preg_match('/^[a-zA-Z0-9]+@/', $userInput);

// BETTER: use filter_var
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    throw new InvalidArgumentException('Invalid email');
}
```

---

## Review Checklist

- [ ] `declare(strict_types=1)` at top of every PHP file
- [ ] Functions have parameter and return type declarations
- [ ] No string concatenation in SQL queries
- [ ] Output is escaped for user-provided data
- [ ] No include or require with user input
- [ ] No exec or shell_exec without allowlist + escapeshellarg
- [ ] No hardcoded credentials in source
- [ ] Passwords use password_hash and password_verify
- [ ] Token/CSRF comparisons use hash_equals (timing-safe)
- [ ] No raw exception message returned to clients
- [ ] No credentials or tokens in logs
- [ ] Dependencies pinned and composer lock committed

### Algorithmic Complexity
- [ ] No DB/HTTP/filesystem I/O inside loops (batch/eager-load/paginate)
- [ ] No `in_array` / `array_search` inside loops on related datasets (use associative map / `array_flip`)
- [ ] No large string building with `.=` in loops (use `implode()`)
- [ ] No `array_merge` inside loops (use spread operator or `array_push`)
- [ ] Regex on user-controlled input is length-bounded and avoids nested quantifiers (ReDoS)
