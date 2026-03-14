# Framework Overlay: Laravel

Load this guide in addition to LANGUAGES/php.md.

Apply when project uses Laravel controllers, Eloquent models, Blade templates, middleware, or route groups.

---

## Request Validation

Every POST, PUT, PATCH endpoint must validate input.

```php
// BLOCKING
public function store(Request $request)
{
    User::create($request->all());
}

// GOOD
public function store(Request $request)
{
    $validated = $request->validate([
        'email' => 'required|email|unique:users',
        'password' => 'required|min:8|confirmed',
    ]);

    User::create([
        'email' => $validated['email'],
        'password' => Hash::make($validated['password']),
    ]);
}
```

Use Form Request classes for complex validation.

## Authorization

```php
// BLOCKING
public function destroy(int $id)
{
    Post::find($id)->delete();
}

// GOOD
public function destroy(int $id): Response
{
    $post = Post::findOrFail($id);
    $this->authorize('delete', $post);
    $post->delete();
    return response()->noContent();
}
```

## Routes and Middleware

```php
// IMPORTANT
Route::post('/payments', [PaymentController::class, 'store']);

// GOOD
Route::middleware(['auth:sanctum', 'throttle:60,1'])->group(function () {
    Route::post('/payments', [PaymentController::class, 'store']);
});
```

Flag non-public routes missing auth middleware. Flag admin routes missing role or permission checks.

## Mass Assignment

```php
// BLOCKING
class User extends Model
{
    // no fillable
}
User::create($request->all());

// GOOD
class User extends Model
{
    protected $fillable = ['name', 'email', 'password'];
}
```

## Secrets and Config

```php
// BLOCKING
$client = new StripeClient('sk_live_abc123');

// GOOD
$client = new StripeClient(config('services.stripe.secret'));
```

Rules:
- env usage only in config files
- application code reads settings via config

## Error Handling

```php
// BLOCKING
catch (Exception $e) {
    return response()->json(['error' => $e->getMessage()], 500);
}

// GOOD
catch (Exception $e) {
    Log::error('Payment processing failed', ['error' => $e->getMessage()]);
    return response()->json(['error' => 'Payment processing failed'], 500);
}
```

## Eloquent Query Efficiency

```php
// BLOCKING: N+1
$posts = Post::all();
foreach ($posts as $post) {
    echo $post->user->name;
}

// GOOD
$posts = Post::with('user')->get();
```

## Rate Limiting on Auth Routes

```php
// BLOCKING: login endpoint without rate limiting
Route::post('/login', [AuthController::class, 'login']);

// GOOD: throttle login and registration
Route::middleware('throttle:5,1')->group(function () {
    Route::post('/login', [AuthController::class, 'login']);
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/password/reset', [AuthController::class, 'resetPassword']);
});
```

Flag auth endpoints (`login`, `register`, `password/reset`, `verify`) without throttle middleware: **BLOCKING**.

## Laravel Checklist

- [ ] Request validation on every mutating endpoint
- [ ] authorize or gate checks for resource mutation
- [ ] auth middleware on non-public routes
- [ ] throttle on auth-sensitive routes (login, register, reset)
- [ ] fillable or guarded configured on models
- [ ] no request all mass assignment
- [ ] env only in config files
- [ ] no raw exception details returned to clients
- [ ] eager loading to avoid N+1
