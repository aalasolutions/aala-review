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
- Use `helmet`, CORS policy, and rate limiting.
- Parse body size limits (`express.json({ limit: '1mb' })`).

```typescript
app.use(helmet());
app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: '1mb' }));
```

Flag missing security middleware on public APIs.

---

## Rate Limiting

Every Express app exposed to the internet must have rate limiting. Flag any app without it.

```typescript
// BLOCKING: no rate limiting on auth endpoints
app.post('/auth/login', loginHandler);
app.post('/auth/register', registerHandler);

// GOOD: global rate limiter + stricter limits on auth
import rateLimit from 'express-rate-limit';

const globalLimiter = rateLimit({ windowMs: 60_000, max: 100 });
const authLimiter = rateLimit({ windowMs: 15 * 60_000, max: 10 });

app.use(globalLimiter);
app.post('/auth/login', authLimiter, loginHandler);
app.post('/auth/register', authLimiter, registerHandler);
```

Flag:
- No global rate limiter configured: **IMPORTANT**.
- Auth endpoints (`/login`, `/register`, `/reset-password`) without a stricter rate limiter: **BLOCKING**.

---

## CSRF Protection

For Express apps that serve HTML forms or use cookie-based authentication, CSRF protection is required.

```typescript
// IMPORTANT: cookie-based auth without CSRF protection
app.use(cookieParser());
app.use(session({ secret: process.env.SESSION_SECRET }));
app.post('/transfer', transferHandler);

// GOOD: CSRF token validation on state-changing routes
import csrf from 'csurf';
const csrfProtection = csrf({ cookie: true });

app.get('/form', csrfProtection, (req, res) => {
  res.render('form', { csrfToken: req.csrfToken() });
});
app.post('/transfer', csrfProtection, transferHandler);
```

If the app uses only Bearer token auth (no cookies), CSRF protection is not needed. Flag cookie-based auth without CSRF as **IMPORTANT**.

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

- [ ] Routes are thin, business logic in services
- [ ] Request input validated before service calls
- [ ] Central error middleware hides internal details
- [ ] Auth middleware on protected endpoints
- [ ] Helmet and CORS configured
- [ ] Body size limit set (`express.json({ limit })`)
- [ ] Global rate limiter configured
- [ ] Auth endpoints have stricter rate limiting
- [ ] CSRF protection on cookie-based auth routes
- [ ] Async route errors are propagated to middleware
