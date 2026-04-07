# JavaScript

Reference for code review. Apply to all `.js` files: Node.js scripts and browser-side JavaScript.

---

## Naming Conventions

| Item | Convention | Example |
|------|-----------|---------|
| Variable / function | camelCase | `userId`, `getActiveUsers()` |
| Class | PascalCase | `UserService`, `CameraRoute` |
| Constant (module-level) | UPPER_SNAKE_CASE | `MAX_RETRY_COUNT`, `API_TIMEOUT` |
| Private (convention) | leading underscore | `_internalState`, `_handleError()` |
| Boolean | is/has/can prefix | `isLoading`, `hasError`, `canSubmit` |
| Event handler | on + event | `onSubmit`, `onClick`, `onError` |
| File | kebab-case | `user-service.js`, `camera-route.js` |

---

## JavaScript Core Rules

### Variable Declarations

```javascript
// BLOCKING: var has function scope and hoisting issues
var userId = 1;

// GOOD: const for values that never reassign
const userId = getUserId();

// GOOD: let for values that change
let retryCount = 0;
```

Flag every `var`. There is no valid reason for it in modern JavaScript.

### Equality

```javascript
// BLOCKING: loose equality, causes type coercion bugs
if (userId == '1') { }
if (count == false) { }

// ACCEPTABLE: null/undefined check
if (value == null) { }  // intentionally catches both null and undefined

// GOOD: strict equality everywhere else
if (userId === 1) { }
```

Flag every `==` except `== null`.

### Null Safety

```javascript
// IMPORTANT: unchecked property access
const name = user.profile.name;  // throws if profile is null

// GOOD: optional chaining
const name = user?.profile?.name;

// GOOD: nullish coalescing for defaults
const timeout = config.timeout ?? 5000;
```

---

## Security

### XSS Prevention

```javascript
// BLOCKING: inserting user content as HTML
element.innerHTML = userContent;
document.write(userContent);
$('#output').html(userInput);  // jQuery

// GOOD: textContent is safe
element.textContent = userContent;

// ACCEPTABLE: with sanitization
import DOMPurify from 'dompurify';
element.innerHTML = DOMPurify.sanitize(userContent);
```

### eval and Dynamic Code Execution

```javascript
// BLOCKING: any form of dynamic code execution
eval(userCode);
new Function(userCode)();
setTimeout('doSomething()', 100);   // string form is eval
setInterval('updateUI()', 1000);    // string form is eval

// GOOD: use function references
setTimeout(() => doSomething(), 100);
setInterval(() => updateUI(), 1000);
```

### Prototype Pollution

```javascript
// BLOCKING: merging untrusted objects without key filtering
function merge(target, source) {
  for (const key in source) {
    target[key] = source[key];  // __proto__ can be poisoned
  }
}

// GOOD: filter dangerous keys
function merge(target, source) {
  for (const key of Object.keys(source)) {
    if (key !== '__proto__' && key !== 'constructor' && key !== 'prototype') {
      target[key] = source[key];
    }
  }
}

// GOOD: use spread (does not copy prototype chain)
const merged = { ...target, ...source };
```

### Command Injection (Node.js)

```javascript
// BLOCKING: exec with template string
const { exec } = require('child_process');
exec(`convert ${userFile} output.pdf`, callback);

// GOOD: execFile with array args
const { execFile } = require('child_process');
execFile('convert', [userFile, 'output.pdf'], callback);
```

---

## Async Code

### Promise Handling

```javascript
// BLOCKING: unhandled promise rejection
fetchData().then(process);

// GOOD: always handle rejection
fetchData()
  .then(process)
  .catch(err => logger.error('fetchData failed:', err));

// GOOD: async/await with try/catch
async function load() {
  try {
    const data = await fetchData();
    return process(data);
  } catch (err) {
    logger.error('load failed:', err);
    throw err;
  }
}
```

### Mixing Callbacks and Async

```javascript
// IMPORTANT: callback in async function, return before completion
async function save(data) {
  fs.writeFile('data.json', JSON.stringify(data), (err) => {
    if (err) console.error(err);
  });
  return 'saved';  // returns before file is written
}

// GOOD: use fs.promises
const { writeFile } = require('fs').promises;

async function save(data) {
  await writeFile('data.json', JSON.stringify(data));
  return 'saved';
}
```

---

## WebSocket (Client-Side)

```javascript
// BLOCKING: no connection error handling
const ws = new WebSocket('wss://api.example.com/ws');
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  renderData(data);  // no validation
};

// GOOD: validate and handle errors
const ws = new WebSocket('wss://api.example.com/ws');

ws.onopen = () => {
  // authenticate after connection
  ws.send(JSON.stringify({ type: 'auth', token: getAuthToken() }));
};

ws.onmessage = (event) => {
  let message;
  try {
    message = JSON.parse(event.data);
  } catch {
    console.error('Invalid JSON from server');
    return;
  }

  if (!message?.type || typeof message.type !== 'string') {
    console.error('Invalid message structure');
    return;
  }

  // handle by type
  switch (message.type) {
    case 'update': handleUpdate(message.payload); break;
    case 'error': handleServerError(message); break;
    default: console.warn('Unknown message type:', message.type);
  }
};

ws.onerror = (err) => {
  console.error('WebSocket error:', err);
};

ws.onclose = (event) => {
  if (!event.wasClean) {
    scheduleReconnect();  // exponential backoff
  }
};

// GOOD: reconnect with exponential backoff
let reconnectDelay = 1000;
function scheduleReconnect() {
  setTimeout(() => {
    reconnectDelay = Math.min(reconnectDelay * 2, 30000);
    connect();
  }, reconnectDelay);
}
```

---

## Module System

```javascript
// IMPORTANT: mixing require and import in the same file
const fs = require('fs');
import path from 'path';

// GOOD: use one module system consistently
// ESM (preferred for new code)
import fs from 'fs';
import path from 'path';

// CommonJS (existing Node.js projects)
const fs = require('fs');
const path = require('path');
```

Rules:
- Use ESM (`import`/`export`) for new projects. Set `"type": "module"` in `package.json`.
- Do not mix `require()` and `import` in the same file unless using dynamic `import()` for conditional loading.
- Flag `require()` in files that also use `import` statements: **IMPORTANT**.

---

## Error Handling

```javascript
// BLOCKING: swallowing errors
try {
  await riskyOperation();
} catch (e) { }

// BLOCKING: catching all errors the same way
try {
  await doSomething();
} catch (e) {
  showToast('Something went wrong');  // hides the actual error type
}

// GOOD: handle specific cases
try {
  await doSomething();
} catch (e) {
  if (e.status === 401) {
    this.auth.logout();
  } else if (e.status === 404) {
    this.router.transitionTo('not-found');
  } else {
    logger.error('Unexpected error:', e);
    this.notifications.error('Operation failed, please try again');
  }
}
```

---

## Supply Chain

```javascript
// IMPORTANT: unpinned dependencies
{
  "dependencies": {
    "ember-data": "*",
    "axios": "latest"
  }
}

// GOOD: pinned or tight range
{
  "dependencies": {
    "ember-data": "4.12.3",
    "axios": "~1.6.0"
  }
}
```

Flag any `package.json` in scope and check for:
- `*` or `latest` version specifiers
- Missing `package-lock.json` or `yarn.lock`
- Dependencies not used anywhere in the codebase (dead weight)

---

## Performance

```javascript
// IMPORTANT: running expensive computation on every event
element.addEventListener('scroll', () => {
  recalculateLayout();  // runs hundreds of times per second
});

// GOOD: debounce or throttle
import { debounce } from 'lodash';
element.addEventListener('scroll', debounce(() => {
  recalculateLayout();
}, 100));

// IMPORTANT: memory leak from event listener not removed
class MyComponent extends Component {
  constructor() {
    window.addEventListener('resize', this.onResize);
  }
  // no cleanup!
}

// GOOD: clean up in willDestroy
willDestroy() {
  window.removeEventListener('resize', this.onResize);
  super.willDestroy();
}
```

---

## Algorithmic Complexity

Apply `SKILL.md` **Check J (Algorithmic Complexity)** and **Check I (Performance and Resource Management)**.

Flag (severity depends on whether `n` is unbounded/user-controlled and whether this runs in a hot path):

### Linear search inside loops

```javascript
// BLOCKING: Array.includes / find inside loop = O(n²)
for (const order of orders) {
  const user = users.find(u => u.id === order.userId);  // O(n) per iteration
  process(user, order);
}

// GOOD: O(n) - build index first
const userById = new Map(users.map(u => [u.id, u]));
for (const order of orders) {
  const user = userById.get(order.userId);  // O(1) per iteration
  process(user, order);
}
```

Same applies to `Array.includes()`, `Array.indexOf()`, and `Array.some()` called inside loops on the same or related datasets.

### String concatenation in loops

```javascript
// IMPORTANT: O(n²) string building via +=
let html = '';
for (const item of items) {
  html += `<li>${item.name}</li>`;
}

// GOOD: O(n) array join
const html = items.map(item => `<li>${item.name}</li>`).join('');

// GOOD: array push + join for complex assembly
const parts = [];
for (const item of items) {
  parts.push(`<li>${item.name}</li>`);
}
const html = parts.join('');
```

### Multi-pass collection chains

```javascript
// NIT: three passes where one would work (only flag on large/unbounded collections)
const result = items
  .filter(x => x.active)
  .map(x => x.value)
  .filter(v => v > 10);

// GOOD: single pass
const result = [];
for (const x of items) {
  if (x.active && x.value > 10) result.push(x.value);
}
```

A single `.filter().map()` on a small known-bounded list is acceptable. Flag when chaining 3+ passes or when the collection is user-controlled / unbounded.

### Unbounded concurrency

```javascript
// IMPORTANT: unbounded parallel requests can overwhelm server/network
const results = await Promise.all(
  userIds.map(id => fetch(`/api/users/${id}`))
);

// GOOD: batch endpoint
const results = await fetch(`/api/users?ids=${userIds.join(',')}`);

// GOOD: chunked concurrency when batch endpoint unavailable
async function fetchChunked(ids, chunkSize = 10) {
  const results = [];
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const batch = await Promise.all(chunk.map(id => fetch(`/api/users/${id}`)));
    results.push(...batch);
  }
  return results;
}
```

### ReDoS (Regex Denial of Service)

```javascript
// BLOCKING: catastrophic backtracking on crafted input
const regex = /^(a+)+$/;               // exponential on "aaaaaaaaaaaaaaX"
const emailRegex = /^([a-zA-Z0-9])+@/; // nested quantifier

// GOOD: linear-time pattern
const regex = /^a+$/;
const emailRegex = /^[a-zA-Z0-9]+@/;

// BETTER: use a validation library
import validator from 'validator';
validator.isEmail(input);
```

Flag any regex applied to user-controlled input that contains nested quantifiers (`(a+)+`), overlapping alternations with quantifiers, or quantified groups followed by overlapping suffixes.

---

## Review Checklist

### JavaScript
- [ ] No `var` declarations
- [ ] Strict equality (`===`) used (except `== null`)
- [ ] No `innerHTML` with unsanitized content
- [ ] No `eval()` or `new Function()`
- [ ] All promises have `.catch()` or are in try/catch
- [ ] No callback-style mixed with async/await
- [ ] No prototype pollution risk in merge functions
- [ ] Optional chaining (`?.`) used for nullable chains
- [ ] Consistent module system (no mixing require and import)

### WebSocket (Client)
- [ ] Authentication sent after connection open
- [ ] Incoming messages validated before use
- [ ] Error and close handlers implemented
- [ ] Reconnect with exponential backoff (not tight loop)

### Algorithmic Complexity
- [ ] No `Array.find` / `includes` / `indexOf` called inside a loop over a related dataset
- [ ] No string concatenation via `+=` inside loops on unbounded data
- [ ] No I/O (DB/HTTP/fs) inside loops without batching or parallelism
- [ ] No unbounded `Promise.all` over user-controlled input
- [ ] No regex with nested quantifiers applied to user-controlled input

### Supply Chain
- [ ] No `*` or `latest` in package.json
- [ ] Lock file committed
- [ ] No unused dependencies
