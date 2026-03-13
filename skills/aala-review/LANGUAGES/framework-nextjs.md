# Framework Overlay: NextJS

Load this guide in addition to `./LANGUAGES/typescript.md` for NextJS projects.

Apply these rules to route handlers, server components, client components, and app or pages routing code.

---

## File and Folder Conventions

| Location | Purpose |
|----------|---------|
| `app/` or `pages/` | Route files only. No business logic. |
| `components/` | Reusable UI components |
| `lib/` or `utils/` | Shared utilities, API clients |
| `hooks/` | Custom React hooks |
| `types/` | TypeScript types and interfaces |
| `services/` | API call functions |

Flag any API call inside a React component body outside `useEffect` or a custom hook.

## Data Fetching

```typescript
// IMPORTANT: fetch in component body, runs on every render
export default function Page() {
  const data = await fetch('/api/users').then(r => r.json());
}

// GOOD: server component async fetch
export default async function Page() {
  const data = await fetchUsers();
  return <UserList users={data} />;
}

// GOOD: client component with SWR or React Query
'use client';
export default function Page() {
  const { data, error } = useSWR('/api/users', fetcher);
}
```

## API Routes (App Router)

```typescript
// IMPORTANT: no input validation
export async function POST(req: Request) {
  const body = await req.json();
  const user = await createUser(body.email, body.password);
}

// GOOD: validate with zod
import { z } from 'zod';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100),
});

export async function POST(req: Request) {
  const body = await req.json();
  const result = schema.safeParse(body);
  if (!result.success) {
    return Response.json({ error: result.error.issues }, { status: 400 });
  }
  const user = await createUser(result.data.email, result.data.password);
  return Response.json(user, { status: 201 });
}
```

## Environment Variables

```typescript
// BLOCKING: NEXT_PUBLIC_ prefix on secret
NEXT_PUBLIC_DATABASE_URL=postgres://...

// BLOCKING: unchecked env var
const dbUrl = process.env.DATABASE_URL;
db.connect(dbUrl);

// GOOD
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) throw new Error('DATABASE_URL is not set');
db.connect(dbUrl);
```

Rule: `NEXT_PUBLIC_` only for values safe to expose to browsers.

## XSS Prevention

```typescript
// BLOCKING
<div dangerouslySetInnerHTML={{ __html: userContent }} />

// ACCEPTABLE: with sanitization
import DOMPurify from 'isomorphic-dompurify';
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(userContent) }} />

// GOOD
<div>{userContent}</div>
```

## Component Naming and Size

- Components: PascalCase, one per file.
- File name matches export name: `UserCard.tsx` exports `UserCard`.
- Flag any component over 150 lines. Check if it can be split.
- Flag any component with more than 3-4 props that are not grouped into an object type.

## Performance

```typescript
// IMPORTANT: missing dependency array
useEffect(() => {
  fetchData();
});

// GOOD
useEffect(() => {
  fetchData();
}, [userId]);

// IMPORTANT: creating object in render, breaks memo
<Component config={{ timeout: 5000 }} />

// GOOD
const config = useMemo(() => ({ timeout: 5000 }), []);
<Component config={config} />
```

## NextJS Checklist

- [ ] Route files stay thin, business logic in services
- [ ] Data fetching pattern matches server or client component model
- [ ] API route bodies validated before use
- [ ] No secret in `NEXT_PUBLIC_` variables
- [ ] Env vars checked before use
- [ ] No unsafe HTML without sanitization
- [ ] Large components split into smaller units
- [ ] Hooks use stable dependencies
