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
