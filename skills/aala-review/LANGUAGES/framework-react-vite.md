# Framework Overlay: React / Vite

Load this guide in addition to `./LANGUAGES/typescript.md` for React and Vite projects.

---

## Component Rules

- PascalCase filename matches default export: `UserCard.tsx` exports `UserCard`.
- Flag any component over 150 lines.
- Flag any component with more than 5 props not grouped into a typed interface.

```typescript
// IMPORTANT: inline object breaks memo
<Component config={{ timeout: 5000 }} />

// GOOD: stable reference
const config = useMemo(() => ({ timeout: 5000 }), []);
<Component config={config} />
```

---

## Hooks

### useEffect

```typescript
// IMPORTANT: missing dependency array
useEffect(() => { fetchData(); });

// GOOD
useEffect(() => { fetchData(); }, [userId]);

// BLOCKING: stale closure from missing dependency
const [count, setCount] = useState(0);
useEffect(() => {
  const interval = setInterval(() => {
    setCount(count + 1); // stale: always reads initial count
  }, 1000);
  return () => clearInterval(interval);
}, []); // count is missing

// GOOD: use functional updater
useEffect(() => {
  const interval = setInterval(() => {
    setCount(prev => prev + 1);
  }, 1000);
  return () => clearInterval(interval);
}, []);
```

### useCallback and useMemo

```typescript
// IMPORTANT: function recreated every render, breaks child memo
function Parent() {
  const handleClick = () => { save(); };
  return <Child onClick={handleClick} />;
}

// GOOD: stable reference
function Parent() {
  const handleClick = useCallback(() => { save(); }, []);
  return <Child onClick={handleClick} />;
}
```

### Custom Hooks

```typescript
// IMPORTANT: duplicated fetch logic across components
function UserList() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetchUsers().then(setUsers).finally(() => setLoading(false)); }, []);
}

// GOOD: extract to custom hook
function useUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetchUsers().then(setUsers).finally(() => setLoading(false)); }, []);
  return { users, loading };
}
```

Flag duplicated `useState` + `useEffect` fetch patterns across components. Extract to a custom hook or use a data-fetching library.

---

## Error Boundaries

```typescript
// IMPORTANT: no error boundary, runtime error crashes entire app
function App() {
  return (
    <Dashboard />  // if Dashboard throws, white screen
  );
}

// GOOD: wrap with error boundary
import { ErrorBoundary } from 'react-error-boundary';

function App() {
  return (
    <ErrorBoundary fallback={<ErrorPage />}>
      <Dashboard />
    </ErrorBoundary>
  );
}
```

Flag any app with no error boundary at or near the root. At minimum, the top-level route should be wrapped.

---

## State Management

```typescript
// IMPORTANT: prop drilling through 3+ levels
function App() {
  const [user, setUser] = useState(null);
  return <Layout user={user}><Sidebar user={user}><UserMenu user={user} /></Sidebar></Layout>;
}

// GOOD: use context or state management for deeply shared state
const UserContext = createContext<User | null>(null);

function App() {
  const [user, setUser] = useState(null);
  return (
    <UserContext.Provider value={user}>
      <Layout><Sidebar><UserMenu /></Sidebar></Layout>
    </UserContext.Provider>
  );
}
```

Flag props passed through 3 or more component levels without being used in intermediate components.

---

## XSS Prevention

```typescript
// BLOCKING: XSS via dangerouslySetInnerHTML
<div dangerouslySetInnerHTML={{ __html: userContent }} />

// ACCEPTABLE with sanitization
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(userContent) }} />
```

## Environment Variables (Vite)

```typescript
// BLOCKING: secret exposed to browser
VITE_DB_PASSWORD=secret123

// Rule: VITE_ prefix only for values safe to expose publicly
// Never: API keys, DB credentials, JWT secrets, service passwords

// IMPORTANT: unchecked
const apiUrl = import.meta.env.VITE_API_URL;  // may be undefined

// GOOD
const apiUrl = import.meta.env.VITE_API_URL;
if (!apiUrl) throw new Error('VITE_API_URL is not set');
```

## Data Fetching

```typescript
// IMPORTANT: fetch in component body, runs every render
export function UserList() {
  const data = fetch('/api/users').then(r => r.json()); // wrong
}

// GOOD: TanStack Query or SWR
export function UserList() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['users'],
    queryFn: () => apiClient.getUsers(),
  });
}
```

---

## Cleanup and Memory Leaks

```typescript
// BLOCKING: event listener never removed
useEffect(() => {
  window.addEventListener('resize', handleResize);
}, []);

// GOOD: cleanup in return
useEffect(() => {
  window.addEventListener('resize', handleResize);
  return () => window.removeEventListener('resize', handleResize);
}, []);

// BLOCKING: async operation updates state after unmount
useEffect(() => {
  fetchData().then(data => setData(data)); // may fire after unmount
}, []);

// GOOD: abort controller or ignore flag
useEffect(() => {
  const controller = new AbortController();
  fetchData({ signal: controller.signal }).then(data => setData(data));
  return () => controller.abort();
}, []);
```

Flag any `useEffect` that subscribes to events, sets intervals, or starts async work without a cleanup function.

---

## React / Vite Checklist

- [ ] No `VITE_` prefix on secrets
- [ ] `useEffect` has dependency arrays
- [ ] `useEffect` cleanup returns for subscriptions, timers, and async work
- [ ] No `dangerouslySetInnerHTML` without DOMPurify
- [ ] Components under 150 lines
- [ ] Error boundary at or near root
- [ ] No prop drilling through 3+ levels (use context or state management)
- [ ] `useCallback` / `useMemo` for stable references passed to children
- [ ] Custom hooks extract duplicated fetch / state logic
- [ ] Data fetching uses library (TanStack Query, SWR) or custom hooks, not inline fetch
- [ ] Env vars checked for undefined before use
