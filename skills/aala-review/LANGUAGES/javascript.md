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

### WebSocket (Client)
- [ ] Authentication sent after connection open
- [ ] Incoming messages validated before use
- [ ] Error and close handlers implemented
- [ ] Reconnect with exponential backoff (not tight loop)

### Supply Chain
- [ ] No `*` or `latest` in package.json
- [ ] Lock file committed
- [ ] No unused dependencies
