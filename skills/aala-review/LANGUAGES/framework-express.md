# Framework Overlay: Express

Load this guide in addition to:
- `./LANGUAGES/javascript.md` for `.js`
- `./LANGUAGES/typescript.md` for `.ts`

Apply when project uses Express APIs (`express()`, `Router()`, `app.use`, `req`, `res`).

---

## Route and Service Separation

Route handlers should parse input, call service layer, return response.

```typescript
// IMPORTANT: business logic in route
app.post('/users', async (req, res) => {
  const hash = await bcrypt.hash(req.body.password, 12);
  const user = await db.user.create({ data: { ...req.body, password: hash } });
  res.json(user);
});

// GOOD: thin route
app.post('/users', async (req, res, next) => {
  try {
    const user = await userService.create(req.body);
    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
});
```

---

## Input Validation

Every mutating endpoint should validate body/params/query.

```typescript
// BLOCKING: unvalidated body
app.post('/users', async (req, res) => {
  await userService.create(req.body);
});

// GOOD: schema validation
const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100),
});

app.post('/users', async (req, res, next) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
  try {
    const user = await userService.create(parsed.data);
    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
});
```

---

## Error Middleware

Use centralized error middleware and do not expose internals.

```typescript
// BLOCKING: sending raw stack
app.use((err, req, res, next) => {
  res.status(500).json({ error: err.stack });
});

// GOOD
app.use((err, req, res, next) => {
  logger.error('request failed', { message: err.message, path: req.path });
  res.status(500).json({ error: 'internal server error' });
});
```

---

## Auth, Security, and Middleware

- Auth middleware on protected routes.
- Use `helmet` and a strict CORS policy.
- Parse body size limits (`express.json({ limit: '1mb' })`).

```typescript
app.use(helmet());
app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: '1mb' }));
```

Flag missing security middleware on public APIs.

---

## Rate Limiting

Use `express-rate-limit` to protect endpoints from abuse. Apply stricter limits to auth routes (login, register, password reset). Always return a `Retry-After` header so clients know when to retry.

```typescript
import rateLimit from 'express-rate-limit';

// General API limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true, // sends RateLimit-* headers
  legacyHeaders: false,
});

// Stricter limiter for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', apiLimiter);
app.use('/api/auth/', authLimiter);
```

---

## CSRF Protection

The `csurf` package was deprecated in September 2022. Use `csrf-csrf` instead, which implements the double-submit cookie pattern.

```typescript
import { doubleCsrf } from 'csrf-csrf';

const { doubleCsrfProtection, generateToken } = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET,
  cookieName: '_csrf',
  cookieOptions: { sameSite: 'strict', secure: true },
  getTokenFromRequest: (req) => req.headers['x-csrf-token'],
});

// Apply to all state-changing routes
app.use(doubleCsrfProtection);

// Endpoint to fetch a token for the client
app.get('/api/csrf-token', (req, res) => {
  res.json({ token: generateToken(req, res) });
});
```

Apply CSRF protection to POST, PUT, PATCH, and DELETE routes. GET requests that only read data do not need it.

---

## Async Safety

Unhandled async errors in routes must be passed to `next(err)` or wrapped by async middleware.

```typescript
// BLOCKING: unhandled rejection path
app.get('/users/:id', async (req, res) => {
  const user = await userService.get(req.params.id);
  res.json(user);
});

// GOOD
app.get('/users/:id', async (req, res, next) => {
  try {
    const user = await userService.get(req.params.id);
    res.json(user);
  } catch (err) {
    next(err);
  }
});
```

---

## Express Checklist

- [ ] Async errors caught (express-async-errors or try/catch + next)
- [ ] Helmet enabled with appropriate directives
- [ ] CORS origin restricted to known domains
- [ ] Rate limiting applied to auth and sensitive routes
- [ ] CSRF protection via csrf-csrf on state-changing routes
- [ ] Request body size limited (express.json({ limit }))
- [ ] Input validated before use (no raw req.body in queries)
- [ ] Auth middleware on protected routes (not just client-side checks)
- [ ] Sensitive data excluded from logs and error responses
- [ ] Static files served from dedicated directory with restricted access
