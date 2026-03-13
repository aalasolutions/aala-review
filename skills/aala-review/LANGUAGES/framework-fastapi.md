# Framework Overlay: FastAPI

Load this guide in addition to LANGUAGES/python.md.

Apply when project uses FastAPI imports, app decorators, or ASGI route handlers.

---

## Request Validation

Every POST, PUT, PATCH endpoint must use a Pydantic model. Flag raw dict or Any payloads.

```python
# BLOCKING
@app.post("/users/")
async def create_user(data: dict):
    username = data["username"]

# GOOD
class UserCreate(BaseModel):
    email: EmailStr
    password: str

@app.post("/users/", status_code=201)
async def create_user(user: UserCreate):
    pass
```

## Error Responses

```python
# BLOCKING
@app.get("/users/{user_id}")
async def get_user(user_id: int):
    try:
        return db.query(User).filter(User.id == user_id).one()
    except Exception as e:
        return {"error": str(e)}

# GOOD
@app.get("/users/{user_id}")
async def get_user(user_id: int):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user
```

## Auth Dependencies

```python
security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> User:
    token = credentials.credentials
    user = verify_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")
    return user
```

## Startup Events

Do not embed process spawning or thread orchestration inline in startup hooks.

```python
# IMPORTANT
@app.on_event("startup")
async def on_startup():
    threading.Thread(target=start_worker, daemon=True).start()

# GOOD
@app.on_event("startup")
async def on_startup():
    worker_service.start()
```

## WebSocket

```python
# BLOCKING
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()

# GOOD
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str):
    user = verify_token(token)
    if not user:
        await websocket.close(code=4001)
        return
    await websocket.accept()
```

## File Uploads

```python
# GOOD pattern
@app.post("/upload")
async def upload(file: UploadFile):
    content = await file.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(status_code=413, detail="File too large")
```

Rules:
- Validate by magic bytes, not only Content-Type
- Use random UUID file names
- Enforce upload directory boundary checks

## Rate Limiting

```python
limiter = Limiter(key_func=get_remote_address)

@app.post("/auth/login")
@limiter.limit("5/minute")
async def login(request: Request, credentials: LoginDto):
    pass
```

Flag public auth endpoints without throttling.

## FastAPI Checklist

- [ ] Pydantic models on request bodies
- [ ] HTTPException for API errors
- [ ] Auth dependencies on protected routes
- [ ] Startup hooks delegate orchestration
- [ ] WebSockets authenticate before accept
- [ ] Uploads validate type, size, and path
- [ ] Auth endpoints are rate-limited
