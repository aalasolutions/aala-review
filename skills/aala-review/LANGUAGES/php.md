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

## Review Checklist

- [ ] `declare(strict_types=1)` at top of every PHP file
- [ ] Functions have parameter and return type declarations
- [ ] No string concatenation in SQL queries
- [ ] Output is escaped for user-provided data
- [ ] No include or require with user input
- [ ] No exec or shell_exec without allowlist + escapeshellarg
- [ ] No hardcoded credentials in source
- [ ] Passwords use password_hash and password_verify
- [ ] No raw exception message returned to clients
- [ ] No credentials or tokens in logs
- [ ] Dependencies pinned and composer lock committed
