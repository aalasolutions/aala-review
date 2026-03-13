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

// IMPORTANT: missing dependency array
useEffect(() => { fetchData(); });

// GOOD
useEffect(() => { fetchData(); }, [userId]);

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

## React / Vite Checklist

- [ ] No `VITE_` prefix on secrets
- [ ] `useEffect` has dependency arrays
- [ ] No `dangerouslySetInnerHTML` without DOMPurify
- [ ] Components under 150 lines
