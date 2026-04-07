# Python

Reference for code review. Apply to all `.py` files.

---

## Naming Conventions

| Item | Convention | Example |
|------|-----------|---------|
| Variable | snake_case | `frame_count`, `camera_id` |
| Function | snake_case, verb+noun | `get_frame()`, `process_detection()` |
| Class | PascalCase | `CameraWorker`, `DetectionResult` |
| Constant | UPPER_SNAKE_CASE | `MAX_RETRY_COUNT`, `DEFAULT_FPS` |
| Module | snake_case | `stream_server.py`, `inference_worker.py` |
| Private | leading underscore | `_camera_loop()`, `_inference_loop()` |
| Boolean | is/has/can prefix | `is_active`, `has_detections`, `can_connect` |

---

## Type Hints

All function signatures must have type hints.

```python
# IMPORTANT: missing type hints
def process_frame(frame, threshold):
    pass

# GOOD
from typing import Optional
import numpy as np

def process_frame(frame: np.ndarray, threshold: float = 0.5) -> Optional[list[dict]]:
    pass
```

---

## Security

### SQL Injection

```python
# BLOCKING
query = f"SELECT * FROM users WHERE username = '{username}'"
cursor.execute(query)

# GOOD
query = "SELECT * FROM users WHERE username = %s"
cursor.execute(query, (username,))
```

### Command Injection

```python
# BLOCKING
os.system(f"ping {host}")
subprocess.run(f"ping {host}", shell=True)

# GOOD
subprocess.run(["ping", "-c", "1", host], check=True)
```

### Pickle Deserialization

```python
# BLOCKING
data = pickle.loads(user_data)

# GOOD
data = json.loads(user_data)
```

### Path Traversal

```python
# BLOCKING
with open(f"uploads/{filename}", "r") as f:
    data = f.read()

# GOOD
base_dir = Path("uploads").resolve()
file_path = (base_dir / filename).resolve()
if not str(file_path).startswith(str(base_dir)):
    raise ValueError("Path traversal detected")
```

### Hardcoded Credentials

```python
# BLOCKING
DB_PASSWORD = "secret"

# GOOD
DB_PASSWORD = os.environ["DB_PASSWORD"]
```

---

## Error Handling

```python
# BLOCKING
try:
    risky_operation()
except:
    pass

# GOOD
try:
    risky_operation()
except FileNotFoundError as e:
    logger.error("Config missing: %s", e)
    raise
```

Rules:
- No bare `except` blocks.
- Catch specific exceptions where possible.
- Log context before re-raising or handling.

---

## Code Structure

- Flag functions over 40 lines that mix multiple responsibilities.
- Flag `global` keyword usage unless clearly justified.
- Use context managers for file and resource lifecycles.

```python
# GOOD
with open("file.txt", "r") as f:
    data = f.read()
```

---

## Thread Safety

```python
# BLOCKING: unsynchronized shared mutable state
class Counter:
    def __init__(self):
        self.value = 0

    def increment(self):
        self.value += 1

# GOOD
class Counter:
    def __init__(self):
        self.value = 0
        self._lock = threading.Lock()

    def increment(self):
        with self._lock:
            self.value += 1
```

---

## Asyncio Safety

```python
# BLOCKING: shared mutable state modified across awaits
async def transfer(from_id: int, to_id: int, amount: float):
    sender = await get_account(from_id)
    if sender.balance < amount:
        raise ValueError("Insufficient funds")
    await update_balance(from_id, -amount)
    await update_balance(to_id, amount)

# GOOD: lock or DB transaction
_transfer_lock = asyncio.Lock()

async def transfer(from_id: int, to_id: int, amount: float):
    async with _transfer_lock:
        sender = await get_account(from_id)
        if sender.balance < amount:
            raise ValueError("Insufficient funds")
        await update_balance(from_id, -amount)
        await update_balance(to_id, amount)
```

---

## Supply Chain

```text
# IMPORTANT: unpinned
requests
httpx>=0.24.0

# GOOD: pinned
requests==2.31.0
httpx==0.27.0
```

---

## Logging

Never log sensitive fields: `password`, `token`, `api_key`, `secret`, `authorization`, `cookie`, `credit_card`, `ssn`, `otp`.

```python
# BLOCKING
logger.info("User login: email=%s, password=%s", email, password)
logger.debug("Token: %s", token)
logger.info("DB URL: %s", database_url)  # may contain password

# GOOD
logger.info("Login attempt", extra={"email": email, "ip": ip})
logger.error("DB connection failed", extra={"host": db_host})
```

Use structured logging where possible. Prefer `logging` module over bare `print()` in production code.

```python
# IMPORTANT: print in production code
print(f"Processing order {order_id}")

# GOOD: use logging module
import logging
logger = logging.getLogger(__name__)
logger.info("Processing order %s", order_id)
```

Flag `print()` used for operational logging in non-CLI, non-script production code.

---

## Docstrings

```python
# IMPORTANT: public function without docstring
def calculate_discount(price: float, tier: str) -> float:
    if tier == "gold":
        return price * 0.8
    return price * 0.95

# GOOD: docstring on public functions
def calculate_discount(price: float, tier: str) -> float:
    """Apply tier-based discount to the given price.

    Args:
        price: Original price before discount.
        tier: Customer tier ("gold", "silver", "standard").

    Returns:
        Discounted price.

    Raises:
        ValueError: If tier is not recognized.
    """
    if tier == "gold":
        return price * 0.8
    return price * 0.95
```

Rules:
- Public functions and classes should have docstrings.
- Use a consistent docstring style across the project (Google, NumPy, or Sphinx).
- Private/internal helpers (`_prefixed`) do not require docstrings but benefit from them for complex logic.

---

## Algorithmic Complexity

Apply `SKILL.md` **Check J (Algorithmic Complexity)** and **Check I (Performance and Resource Management)**.

### Data structure selection

```python
# BLOCKING: O(n) prepend — list.insert(0, x) shifts all elements
items = []
for item in stream:
    items.insert(0, item)  # every insert is O(n)

# GOOD: O(1) append then reverse, or use deque
from collections import deque
items = deque()
items.appendleft(item)  # O(1)
```

```python
# IMPORTANT: using list for membership tests — O(n) per lookup
allowed = ["admin", "editor", "viewer"]
if role in allowed:  # O(n) scan every time
    ...

# GOOD: set for membership — O(1)
allowed = {"admin", "editor", "viewer"}
if role in allowed:  # O(1)
    ...
```

### Generator vs list comprehension

```python
# IMPORTANT: building full list when only iteration is needed
total = sum([x.price for x in orders])  # creates temporary list

# GOOD: generator expression — constant memory
total = sum(x.price for x in orders)
```

Flag list comprehensions used only as arguments to `sum()`, `any()`, `all()`, `min()`, `max()`, `sorted()`, or `len()` — a generator expression avoids the intermediate list.

### Walrus operator for single-pass patterns

```python
# IMPORTANT: computing .strip() twice per element
clean = [x.strip() for x in lines if x.strip()]

# GOOD: compute once with walrus operator
clean = [s for x in lines if (s := x.strip())]
```

### itertools and collections for common patterns

```python
# IMPORTANT: manual flattening when itertools.chain exists
flat = []
for sublist in nested:
    for item in sublist:
        flat.append(item)

# GOOD: itertools.chain.from_iterable
from itertools import chain
flat = list(chain.from_iterable(nested))
```

```python
# IMPORTANT: manual grouping when defaultdict exists
groups = {}
for item in items:
    key = item.category
    if key not in groups:
        groups[key] = []
    groups[key].append(item)

# GOOD: collections.defaultdict
from collections import defaultdict
groups = defaultdict(list)
for item in items:
    groups[item.category].append(item)
```

### Unbounded async concurrency

```python
# BLOCKING: unbounded concurrency — can exhaust connections/memory
results = await asyncio.gather(*[fetch(url) for url in urls])

# GOOD: bounded with semaphore
sem = asyncio.Semaphore(10)

async def limited_fetch(url):
    async with sem:
        return await fetch(url)

results = await asyncio.gather(*[limited_fetch(u) for u in urls])
```

Flag `asyncio.gather` over unbounded inputs without a semaphore or bounded worker pool.

---

## Review Checklist

- [ ] Function signatures have type hints
- [ ] No concatenated SQL queries
- [ ] No shell=True with dynamic input
- [ ] No pickle loads on untrusted input
- [ ] Path inputs validated with resolve prefix check
- [ ] No hardcoded credentials in source
- [ ] No credentials or tokens in logs
- [ ] No bare except pass blocks
- [ ] Shared mutable state is synchronized
- [ ] Resources use context managers
- [ ] Dependencies pinned
- [ ] Production code uses `logging` module, not `print()`
- [ ] Public functions and classes have docstrings

### Algorithmic Complexity
- [ ] No `list.insert(0, x)` in loops — use `collections.deque`
- [ ] Membership tests use `set`/`dict` not `list` for non-trivial collections
- [ ] Prefer generator expressions when only iteration is needed (avoid intermediate lists)
- [ ] Prefer `itertools` / `collections` helpers for grouping and flattening
- [ ] No unbounded `asyncio.gather` without semaphore / bounded worker pool
