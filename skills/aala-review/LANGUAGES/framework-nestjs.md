# Framework Overlay: NestJS

Load this guide in addition to `./LANGUAGES/typescript.md` for NestJS projects.

Apply these rules when files are in NestJS modules, controllers, providers, or bootstrap.

---

## Module Structure

Each feature should follow the NestJS module pattern:

```
feature/
  feature.module.ts
  feature.controller.ts
  feature.service.ts
  feature.repository.ts   (if DB access needed)
  dto/
    create-feature.dto.ts
    update-feature.dto.ts
  entities/
    feature.entity.ts
```

Flag any controller that imports a repository directly. Controllers talk to services, services talk to repositories.

## Controllers

```typescript
// IMPORTANT: business logic in controller
@Post()
async create(@Body() dto: CreateUserDto) {
  const existing = await this.userRepo.find({ email: dto.email });
  if (existing) throw new ConflictException();
  const user = await this.userRepo.save(dto);
  return user;
}

// GOOD: delegate to service
@Post()
async create(@Body() dto: CreateUserDto): Promise<UserResponseDto> {
  return this.userService.create(dto);
}
```

## DTOs and Validation

Every request body must have a DTO with `class-validator` decorators. Flag any endpoint that accepts raw `@Body()` without a typed DTO class.

```typescript
import { IsEmail, IsString, MinLength, MaxLength, IsInt, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateUserDto {
  @IsEmail()
  @Transform(({ value }) => value.toLowerCase().trim())
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(100)
  password: string;

  @IsInt()
  @Min(0)
  @Max(120)
  age: number;
}
```

Global validation pipe must be configured:

```typescript
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: { enableImplicitConversion: false },
}));
```

Flag any `main.ts` that does not have this.

## Guards and Authorization

```typescript
// BLOCKING: no auth guard on sensitive endpoint
@Delete(':id')
async remove(@Param('id') id: string) {
  return this.userService.remove(id);
}

// GOOD
@Delete(':id')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
async remove(@Param('id') id: string): Promise<void> {
  return this.userService.remove(id);
}
```

## Exception Handling

Use NestJS built-in exceptions, not raw `throw new Error()`:

```typescript
// IMPORTANT
throw new Error('Not found');

// GOOD
throw new NotFoundException(`User ${id} not found`);
throw new ConflictException('Email already registered');
throw new UnauthorizedException();
throw new BadRequestException('Invalid input');
```

## Database (TypeORM / Prisma)

```typescript
// BLOCKING: SQL injection via raw query with interpolation
const user = await this.userRepo.query(
  `SELECT * FROM users WHERE email = '${email}'`
);

// GOOD: parameterized
const user = await this.userRepo.query(
  'SELECT * FROM users WHERE email = $1',
  [email]
);

// GOOD: use ORM methods
const user = await this.userRepo.findOne({ where: { email } });

// IMPORTANT: N+1 query in loop
for (const order of orders) {
  order.user = await this.userRepo.findOne(order.userId);
}

// GOOD: eager load or join
const orders = await this.orderRepo.find({ relations: ['user'] });
```

## Environment Config

```typescript
// BLOCKING: hardcoded secret
const secret = 'my-secret-key';

// GOOD: use ConfigService
constructor(private config: ConfigService) {}

const secret = this.config.get<string>('JWT_SECRET');
if (!secret) throw new Error('JWT_SECRET not configured');
```

## NestJS Checklist

- [ ] Controllers delegate to services, not repositories
- [ ] DTO + class-validator on request payloads
- [ ] ValidationPipe enabled in bootstrap
- [ ] Guards on protected routes
- [ ] NestJS exceptions used instead of generic Error
- [ ] No interpolated raw SQL
- [ ] No N+1 data access in loops
- [ ] Secrets loaded from config/env
