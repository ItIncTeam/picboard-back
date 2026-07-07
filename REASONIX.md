# PICboard Backend — NestJS monorepo

## Stack
- **Runtime** — Node.js 20 (Alpine in Docker), TypeScript 5.7
- **Framework** — NestJS 11 monorepo (pnpm workspace)
- **API layer** — GraphQL (Apollo subgraph gateway + per-microservice resolvers)
- **Messaging** — RabbitMQ via `@nestjs/microservices` + `amqp-connection-manager`
- **ORM** — Prisma 7.8 (separate schema per DB: `prisma/{users,posts,files}/schema.prisma`)
- **Storage** — AWS S3 (`@aws-sdk/client-s3`)
- **Auth** — Passport (JWT + GitHub OAuth), bcrypt, JWT tokens with refresh rotation
- **Validation** — `class-validator` + `class-transformer`

## Layout
```
apps/                          — Microservices (4)
  gateway/                     — Apollo gateway (entry point for all GraphQL)
  users-microservice/          — Auth, user management (CQRS pattern)
  posts-microservice/          — Post CRUD
  files-microservice/          — File upload (S3 presigned URLs)
libs/                          — Shared libraries (4)
  auth/                        — Auth guards/decorators
  common/                      — Shared DTOs, utilities
  contracts/                   — Message/RPC contract types
  rmq/                         — RabbitMQ client/proxy wrappers
prisma/                        — Prisma schemas per service
  {users,posts,files}/{prisma/,schema.prisma,prisma.config.ts}
```

## Commands
```bash
pnpm install                   # Install deps
nest build                     # Build all
nest start --watch             # Dev (single service)
pnpm lint                      # ESLint --fix (apps/ + libs/)
pnpm format                    # Prettier (apps/ + libs/)
pnpm test                      # Jest (root; *.spec.ts in apps/ + libs/)
pnpm test:cov                  # Jest with coverage
pnpm test:*:e2e                # e2e per service (uses jest-e2e.json)
pnpm prisma:generate:*         # Generate Prisma client per service
pnpm prisma:migrate:*          # Migrate per service per env
pnpm start:dev:*               # Watch-mode dev per service (e.g. start:dev:users)
pnpm start:staging:*           # Staging per service
pnpm start:prod:*              # Production per service (node dist/...)
```

## Conventions
- **Naming** — kebab-case for files (`sign-in-user/`, `auth.resolver.ts`). Classes PascalCase.
- **Commits** — Conventional Commits (`feat:`, `fix:`, `refactor:`) with scope (`fix(files): ...`).
- **Code style** — Prettier: single quotes, trailing commas everywhere, `endOfLine: auto`.
- **ESLint** — `@typescript-eslint` strict preset minus no-explicit-any / no-unsafe-* (most disabled). `no-floating-promises` and `no-unsafe-argument` warn only.
- **Imports** — NestJS + `@app/{auth,common,contracts,rmq}` path aliases (tsconfig paths + jest moduleNameMapper).
- **Tests** — `*.spec.ts` colocated in `src/`; `*.e2e-spec.ts` in each `test/` dir (per-service jest-e2e.json).
- **Architecture** — Domain-driven modules per service (domain/entities, domain/services, application/use-cases, infrastructure/). Users service follows CQRS (`@nestjs/cqrs`).

## Watch out for
- **Prisma multi-config** — Each microservice has its own Prisma schema under `prisma/{users,posts,files}/`. Run the per-service script (e.g. `pnpm prisma:migrate:dev:users`), not a bare `prisma migrate dev`.
- **Env files** — Per-service env under `apps/*/src/env/` (`.env.development.local`, `.env.testing`, etc.). Commands use `dotenv -e` to select the right file.
- **`start:dev:files` uses `NODE_ENV=development.local`** (note: `development.local` not `development`), while others use `development`.
- **Jest uuid mock** — `__mocks__/uuid.js` is mapped via `moduleNameMapper: { "^uuid$": ... }`.
- **Generated code** — `prisma/apps/` contains generated Prisma clients (don't edit by hand). `dist/` is build output.
