# TypeScript

Reference for code review. Apply to all `.ts` and `.tsx` files: frontends and standalone Node.js services.

---

## Naming Conventions

| Item | Convention | Example |
|------|-----------|---------|
| Variable / function | camelCase | `userId`, `getActiveUsers()` |
| Class | PascalCase | `UserService`, `PaymentController` |
| Interface | PascalCase, no `I` prefix | `UserDto`, `PaymentConfig` |
| Type alias | PascalCase | `UserId`, `ApiResponse` |
| Enum | PascalCase, values UPPER | `Status.ACTIVE`, `Role.ADMIN` |
| Constant (module-level) | UPPER_SNAKE_CASE | `MAX_RETRY_COUNT`, `DEFAULT_TIMEOUT` |
| Boolean | is/has/can prefix | `isActive`, `hasPermission`, `canSubmit` |
| Event handler | on + event | `onSubmit`, `onClick`, `onError` |
| File | kebab-case | `user-service.ts`, `payment.controller.ts` |
| Test file | same + `.spec.ts` | `user-service.spec.ts` |

---

## TypeScript Core Rules

### Strict Mode

`tsconfig.json` must have `strict: true`. Flag any project without it.

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

### Type Safety

```typescript
// BLOCKING: avoid 'any'
function process(data: any) { }

// GOOD: use unknown and narrow
function process(data: unknown) {
  if (typeof data === 'string') { }
}

// IMPORTANT: missing return type on non-trivial function
function fetchUser(id: string) {
  return db.find(id);
}

// GOOD
async function fetchUser(id: string): Promise<User | null> {
  return db.find(id);
}

// GOOD: branded types prevent value confusion
type UserId = string & { readonly __brand: 'UserId' };
type OrderId = string & { readonly __brand: 'OrderId' };
```

### Error Handling

```typescript
// BLOCKING: swallowing errors
try {
  await riskyOp();
} catch (e) { }

// IMPORTANT: accessing .message on unknown
catch (e) {
  console.log(e.message);  // 'e' is unknown in strict TS
}

// GOOD
catch (e) {
  const message = e instanceof Error ? e.message : String(e);
  logger.error('Operation failed', { message, context: 'fetchUser' });
  throw e;
}
```

---

## Security

### Prototype Pollution

```typescript
// BLOCKING: merging without key filtering
function merge(target: any, source: any) {
  for (const key in source) {
    target[key] = source[key];
  }
}

// GOOD
function merge<T extends object>(target: T, source: Partial<T>): T {
  return Object.assign({}, target, source);
}
```

### ReDoS (Regular Expression Denial of Service)

```typescript
// BLOCKING: catastrophic backtracking
const emailRegex = /^([a-zA-Z0-9])+@[a-zA-Z0-9]+\.[a-z]+$/;

// GOOD: linear time
const emailRegex = /^[a-zA-Z0-9]+@[a-zA-Z0-9]+\.[a-z]+$/;

// BETTER: use validation library
import validator from 'validator';
validator.isEmail(email);
```

### Path Traversal

```typescript
// BLOCKING
app.get('/file/:name', (req, res) => {
  res.sendFile(`./uploads/${req.params.name}`);
});

// GOOD
import path from 'path';
app.get('/file/:name', (req, res) => {
  const filename = path.basename(req.params.name);
  const filepath = path.join(__dirname, 'uploads', filename);
  if (!filepath.startsWith(path.join(__dirname, 'uploads'))) {
    return res.status(403).send('Forbidden');
  }
  res.sendFile(filepath);
});
```

### Command Injection

```typescript
// BLOCKING
exec(`ping ${userInput}`, callback);

// GOOD
execFile('ping', [userInput], callback);
```

### XSS

```typescript
// BLOCKING
element.innerHTML = userContent;

// GOOD
element.textContent = userContent;

// ACCEPTABLE with sanitization
import DOMPurify from 'isomorphic-dompurify';
element.innerHTML = DOMPurify.sanitize(userContent);
```

---


## Authentication and Sessions

### JWT

```typescript
// BLOCKING: no expiry on JWT
const token = jwt.sign({ userId }, secret);

// GOOD: short-lived access token + refresh token
const accessToken = jwt.sign({ userId }, accessSecret, { expiresIn: '15m' });
const refreshToken = jwt.sign({ userId }, refreshSecret, { expiresIn: '7d' });

// BLOCKING: storing JWT in localStorage (XSS accessible)
localStorage.setItem('token', token);

// GOOD: httpOnly cookie (not accessible to JS)
res.cookie('token', token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 15 * 60 * 1000,
});

// IMPORTANT: not verifying token on every request
// Every protected route must verify the token, not just check its presence
```

### Password Handling

```typescript
// BLOCKING: plain text password comparison
if (user.password === inputPassword) { }

// BLOCKING: MD5 or SHA1 for passwords
const hash = crypto.createHash('md5').update(password).digest('hex');

// GOOD: bcrypt with minimum cost 12
import * as bcrypt from 'bcrypt';
const hash = await bcrypt.hash(password, 12);
const valid = await bcrypt.compare(inputPassword, hash);

// GOOD: timing-safe comparison for tokens
import { timingSafeEqual } from 'crypto';
const valid = timingSafeEqual(
  Buffer.from(inputToken),
  Buffer.from(storedToken)
);
```

---

## WebSocket Security

```typescript
import { WebSocketServer, WebSocket } from 'ws';

const wss = new WebSocketServer({ port: 8080 });

// BLOCKING: accepts unauthenticated clients and unbounded payloads
wss.on('connection', (socket) => {
  socket.on('message', (raw) => {
    const msg = JSON.parse(raw.toString());
    broadcast(msg);
  });
});

// GOOD: authenticate at connection and validate each message
wss.on('connection', (socket: WebSocket, req) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const user = token ? verifyToken(token) : null;
  if (!user) {
    socket.close(1008, 'Unauthorized');
    return;
  }

  socket.on('message', (raw) => {
    if (raw.byteLength > 10_000) {
      socket.send(JSON.stringify({ error: 'Payload too large' }));
      return;
    }

    let payload: unknown;
    try {
      payload = JSON.parse(raw.toString());
    } catch {
      socket.send(JSON.stringify({ error: 'Invalid JSON' }));
      return;
    }

    if (!payload || typeof payload !== 'object') {
      socket.send(JSON.stringify({ error: 'Invalid payload structure' }));
      return;
    }

    const roomId = (payload as { roomId?: string }).roomId;
    if (!roomId || !canUserSend(user.id, roomId)) {
      socket.send(JSON.stringify({ error: 'Forbidden' }));
      return;
    }

    handleMessage(user.id, payload);
  });
});
```

What to enforce:
- Authenticate in `handleConnection`, disconnect immediately if invalid
- Validate every incoming message: type check, size limit
- Verify authorization per action (can this user send to this room?)
- Rate limit connections per IP and messages per connection
- Idle timeout: disconnect clients with no activity after N minutes

---

## File Upload Security

```typescript
import crypto from 'crypto';
import path from 'path';
import { fileTypeFromBuffer } from 'file-type';

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// BLOCKING: using original filename from user
const savePath = `./uploads/${file.originalname}`;

// BLOCKING: trusting Content-Type header alone
if (file.mimetype !== 'image/jpeg') throw new Error('Invalid type');

// GOOD: detect from file magic bytes
async function validateAndSave(buffer: Buffer, originalName: string): Promise<string> {
  // 1. Size check
  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error('File too large');
  }

  // 2. Detect actual type from magic bytes
  const detected = await fileTypeFromBuffer(buffer);
  if (!detected || !ALLOWED_MIME_TYPES.has(detected.mime)) {
    throw new Error('File type not allowed');
  }

  // 3. Generate safe random filename
  const ext = path.extname(originalName).toLowerCase();
  const safeFilename = `${crypto.randomUUID()}${ext}`;

  // 4. Store outside webroot
  const safePath = path.join('/var/app/uploads', safeFilename);

  // 5. Verify path is within allowed directory
  if (!safePath.startsWith('/var/app/uploads')) {
    throw new Error('Invalid path');
  }

  await fs.writeFile(safePath, buffer);
  return safeFilename;
}

// GOOD: serve with correct headers
async function serveFile(filename: string, userId: string, res: Response) {
  const file = await this.fileRepo.findOne({ where: { filename, userId } });
  if (!file) throw new Error('Not found');

  res.setHeader('Content-Type', file.mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${file.safeName}"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
}
```

---

## Logging

### What NOT to Log

```typescript
// BLOCKING: logging credentials
logger.info(`User login: ${email} / ${password}`);
logger.debug('Auth token:', token);
logger.info('Connecting to DB', { url: databaseUrl }); // may contain password

// BLOCKING: stack trace to client
res.status(500).json({ error: err.stack });

// GOOD: log event, not secret
logger.info('Login attempt', { email, ip: req.ip });

// GOOD: generic client response, detailed server log
logger.error('Database error', { message: err.message, query: 'users.findOne' });
res.status(500).json({ error: 'Internal server error' });
```

Sensitive fields that must NEVER appear in logs:
`password`, `token`, `accessToken`, `refreshToken`, `apiKey`, `secret`, `authorization`, `cookie`, `creditCard`, `ssn`, `otp`

Flag any `console.log`, `logger.*`, or Winston transport that includes any of these.

---

## Supply Chain

```typescript
// IMPORTANT: unpinned dependency
"dependencies": {
  "express": "*",           // any version
  "lodash": "^4.0.0",       // allows minor+patch upgrades silently
  "axios": "latest"         // latest at install time, changes unpredictably
}

// GOOD: pinned or tight range
"dependencies": {
  "express": "4.18.2",
  "axios": "~1.6.0"         // patch updates only
}
```

Flag any `package.json` in scope and check for:
- `*` or `latest` version specifiers
- No `package-lock.json` or `yarn.lock` committed
- `npm audit` not part of CI

---

## Caching Security

```typescript
// BLOCKING: caching user-specific data without scoping by userId
const cacheKey = `orders:${page}`;
const cached = await redis.get(cacheKey);

// GOOD: scope cache key by user
const cacheKey = `orders:${userId}:${page}`;

// BLOCKING: caching auth tokens or passwords
await redis.set('user:token', token);

// GOOD: never cache credentials
// Cache only non-sensitive computed data

// GOOD: always set TTL
await redis.set(cacheKey, JSON.stringify(data), 'EX', 300);  // 5 minutes

// IMPORTANT: cache poisoning via unvalidated header
const lang = req.headers['accept-language'];
const cacheKey = `content:${lang}`;  // user-controlled key
```

---

## Algorithmic Complexity

Apply `SKILL.md` **Check J (Algorithmic Complexity)** and **Check I (Performance and Resource Management)**.

Flag (severity depends on whether `n` is unbounded/user-controlled and whether this runs in a hot path):

### Linear search inside loops

```typescript
// BLOCKING: Array.find inside loop = O(n²)
for (const order of orders) {
  const user = users.find(u => u.id === order.userId);  // O(n) per iteration
  process(user, order);
}

// GOOD: O(n) - build typed Map index
const userById = new Map<string, User>(users.map(u => [u.id, u]));
for (const order of orders) {
  const user = userById.get(order.userId);  // O(1)
  if (user) process(user, order);
}
```

Same applies to `Array.includes()`, `Array.indexOf()`, and `Array.some()` called inside loops on related datasets.

### String concatenation in loops

```typescript
// IMPORTANT: O(n²) string building via +=
let output = '';
for (const row of rows) {
  output += `${row.name}: ${row.value}\n`;
}

// GOOD: O(n) array join
const output = rows.map(row => `${row.name}: ${row.value}`).join('\n');
```

### Unbounded concurrency

```typescript
// IMPORTANT: unbounded Promise.all can exhaust connections/memory
const results = await Promise.all(
  userIds.map(id => fetchUser(id))  // thousands of concurrent requests
);

// GOOD: chunked concurrency
async function fetchChunked<T>(
  ids: string[],
  fetcher: (id: string) => Promise<T>,
  chunkSize = 10
): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const batch = await Promise.all(chunk.map(fetcher));
    results.push(...batch);
  }
  return results;
}
```

### Sequential I/O in loops

```typescript
// BLOCKING: N sequential awaits in loop
for (const id of userIds) {
  const user = await userService.findById(id);  // one query per iteration
  results.push(user);
}

// GOOD: batch query
const users = await userService.findByIds(userIds);

// GOOD: parallel with bounded concurrency (see above)
```

### ReDoS (Regex Denial of Service)

```typescript
// BLOCKING: catastrophic backtracking
const regex = /^([a-zA-Z0-9])+@[a-zA-Z0-9]+\.[a-z]+$/;

// GOOD: linear-time pattern
const regex = /^[a-zA-Z0-9]+@[a-zA-Z0-9]+\.[a-z]+$/;

// BETTER: validation library
import validator from 'validator';
validator.isEmail(input);
```

Flag regex with nested quantifiers applied to user-controlled input.

---

## Review Checklist

### TypeScript
- [ ] `strict: true` in tsconfig
- [ ] No `any` types
- [ ] Return types on all non-trivial functions
- [ ] Errors narrowed before accessing `.message`

### WebSocket
- [ ] Authentication in `handleConnection`, disconnect if invalid
- [ ] Message payload validated (type + size)
- [ ] Authorization checked per action
- [ ] Rate limiting configured

### Algorithmic Complexity
- [ ] No `find` / `includes` / `indexOf` inside loops over related datasets — build `Map`/`Set` index
- [ ] No large string building via `+=` inside loops on unbounded data — use array fragments + `join('')`
- [ ] No unbounded `Promise.all` over user-controlled input — cap concurrency / chunk work
- [ ] No I/O-in-loop (DB/HTTP/fs) without batching/pagination
- [ ] Regex on user input avoids nested quantifiers or is length-bounded (ReDoS)

### File Upload
- [ ] File type detected from magic bytes, not Content-Type header
- [ ] Random UUID filename, not original filename
- [ ] File stored outside webroot
- [ ] Size limit enforced before writing

### Authentication
- [ ] Passwords hashed with bcrypt (cost >= 12)
- [ ] JWT has expiry set
- [ ] Access tokens stored in httpOnly cookie, not localStorage
- [ ] Timing-safe comparison for tokens

### Logging
- [ ] No passwords, tokens, or API keys in log output
- [ ] No stack traces in client-facing error responses
- [ ] No DB connection strings (with credentials) in logs

### Supply Chain
- [ ] No `*` or `latest` version specifiers in package.json
- [ ] Lock file committed

