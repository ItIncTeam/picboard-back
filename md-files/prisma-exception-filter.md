# Consolidating the Prisma exception filters into `libs/`

**Status:** proposal — nothing implemented yet.
**Scope:** `apps/users-microservice`, `apps/files-microservice`, `libs/common`.

## Context

We have two near-identical Prisma exception filters:

- `apps/users-microservice/src/infrastructure/prisma/users-prisma-exception.filter.ts`
- `apps/files-microservice/src/infrastructure/prisma/exception-filter/files-prisma-exception-filter.ts`

Both `@Catch(Prisma.PrismaClientKnownRequestError)`, both delegate to the shared
`mapPrismaErrorCode()` in `libs/common/src/filters/map-prisma-error-code.ts`.
`posts-microservice` has no filter at all.

Goal: one reusable filter in `libs/`, no duplication, no per-service copies.

---

## The finding that decides the approach

The usual blocker for a shared Prisma filter is that `@Catch()` matches by `instanceof`,
and each microservice generates its own client (`users-client`, `files-client`,
`posts-client`). Normally that means **three distinct** `PrismaClientKnownRequestError`
classes, so a single filter in `libs/` would silently fail to catch two of them. That is
why people usually reach for an abstract base class with a per-service subclass.

**That does not apply to us.** In Prisma 7.8 the generated `runtime/client.js` does not
define the error class — it re-exports it from the shared `@prisma/client-runtime-utils`
package, of which pnpm resolves exactly one copy.

Verified by running against our actual generated clients:

```bash
node -e "
const u = require('./prisma/apps/users/src/generated/prisma/users-client');
const f = require('./prisma/apps/files/src/generated/prisma/files-client');
const p = require('./prisma/apps/posts/src/generated/prisma/posts-client');
const shared = require('@prisma/client-runtime-utils');
console.log('users === files :', u.Prisma.PrismaClientKnownRequestError === f.Prisma.PrismaClientKnownRequestError);
console.log('users === posts :', u.Prisma.PrismaClientKnownRequestError === p.Prisma.PrismaClientKnownRequestError);
console.log('users === shared:', u.Prisma.PrismaClientKnownRequestError === shared.PrismaClientKnownRequestError);
"
```

```
users === files : true
users === posts : true
users === shared: true
```

So **one concrete, fully-typed filter in `libs/` works**, with `@Catch()` bound to the class
imported from `@prisma/client-runtime-utils` — no dependency on any app's generated client,
no abstract base class, no subclassing.

Two secondary checks that also came back clean:

- The gateway imports **none** of the shared libs (`@app/common`, `@app/auth`, `@app/contracts`),
  so putting a Prisma import in `libs/common` does not pull Prisma into the gateway's
  dependency graph.
- The error shape is stable for duck-typing if we ever need it: `name` is reliably
  `'PrismaClientKnownRequestError'`, and `code` / `meta` / `clientVersion` are all present.

---

## What has to be reconciled first

The two filters **behave differently**, so consolidating means picking a winner:

| | users | files |
|---|---|---|
| Mapped code | `throw mapped` | `throw mapped` + appends `(P2002)` to the message |
| Unmapped code | `return exception` — leaks the raw Prisma error to the client | `throw InternalServerErrorException` |

The files version is strictly safer — the comment on
`files-prisma-exception-filter.ts:20` already says `//leaks db details to client`.

This difference is really an **environment** distinction (expose detail in dev, never in
prod), not a service distinction. We already have `isProduction` on every `AppConfig` and
`createGraphqlFormatError(appConfig.isProduction)` doing exactly this. Proposal: collapse it
into one env-driven rule rather than preserving it as a per-service knob.

---

## Options considered

**1. One concrete filter, imported directly.** ~15 lines, each app registers
`new PrismaExceptionFilter()`. Least code. No per-service or per-env behaviour — the
users/files difference just disappears by fiat.

**2. One filter with constructor options.** `new PrismaExceptionFilter({ exposeErrorCode })`.
Single implementation, differences survive as data. No DI needed, so it still works from
`main.ts`. Good middle ground.

**3. Dynamic module (`PrismaExceptionModule.forRootAsync`).** Mirrors the existing
`SubgraphAuthModule.forRootAsync` pattern in `libs/common/src/subgraph-auth/`. Registers via
`APP_FILTER`, injects `AppConfig`, so behaviour derives from `isProduction` automatically
instead of being passed by hand in three `main.ts` files. Matches a convention we already
established. **Recommended.**

**4. Abstract base class + thin per-service subclass.** The option we would be *forced* into
if the error classes were distinct. Given the identity test, this is ceremony with no
benefit — unless we expect services to drift onto different Prisma versions, in which case
it stays correct because each `@Catch` references its own client.

**5. Duck-typing, keeping `libs` Prisma-free.** `@Catch()` catch-all plus a type guard.
Immune to version drift and keeps `libs/common` free of Prisma. Cost: a catch-all filter
intercepts *every* exception, so non-Prisma errors have to be handed back correctly (see
Alternative below). Not worth it while the identity test passes.

**Where to put it:** `libs/common/src/prisma/`. `mapPrismaErrorCode` already lives at
`libs/common/src/filters/`, and `subgraph-auth` sets the precedent for a cross-cutting
concern living in `common`. Zero config changes. A separate `libs/prisma` project would be a
cleaner boundary but costs four config edits (`nest-cli.json`, `tsconfig.json` paths, a
`tsconfig.lib.json`, and the jest `moduleNameMapper` in `package.json`).

---

## Recommended implementation

### 1. `libs/common/src/prisma/prisma-exception.constants.ts`

Mirrors `sungraph-auth.constants.ts`.

```ts
export const PRISMA_EXCEPTION_OPTIONS = Symbol('PRISMA_EXCEPTION_OPTIONS');

export type PrismaExceptionOptions = {
  // Appends the Prisma code — "Resource already exists (P2002)" — for non-prod debugging.
  exposeErrorCode: boolean;
};
```

### 2. `libs/common/src/prisma/prisma-exception.filter.ts`

```ts
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Inject,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { GqlContextType } from '@nestjs/graphql';
import { RpcException } from '@nestjs/microservices';
import { PrismaClientKnownRequestError } from '@prisma/client-runtime-utils';
import { throwError } from 'rxjs';
import type { Response } from 'express';
import { mapPrismaErrorCode } from '../filters/map-prisma-error-code';
import {
  PRISMA_EXCEPTION_OPTIONS,
  PrismaExceptionOptions,
} from './prisma-exception.constants';

@Catch(PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  constructor(
    @Inject(PRISMA_EXCEPTION_OPTIONS)
    private readonly options: PrismaExceptionOptions,
  ) {}

  catch(exception: PrismaClientKnownRequestError, host: ArgumentsHost) {
    // Full detail stays server-side; the client only ever sees the mapped message.
    this.logger.error(
      JSON.stringify({
        event: 'prisma_known_request_error',
        code: exception.code,
        meta: exception.meta,
      }),
    );

    const mapped =
      mapPrismaErrorCode(exception.code) ??
      new InternalServerErrorException('Database error occurred');

    const error = this.withErrorCode(mapped, exception.code);

    switch (host.getType<GqlContextType>()) {
      case 'graphql':
        // Apollo catches this and runs it through createGraphqlFormatError.
        throw error;

      case 'rpc':
        return throwError(
          () =>
            new RpcException({
              statusCode: error.getStatus(),
              message: error.message,
            }),
        );

      default: {
        const response = host.switchToHttp().getResponse<Response>();
        response.status(error.getStatus()).json(error.getResponse());
      }
    }
  }

  private withErrorCode(error: HttpException, code: string): HttpException {
    if (!this.options.exposeErrorCode) return error;

    // Rebuild rather than mutate .message — see "Bugs this fixes" below.
    const ExceptionClass = error.constructor as new (
      message: string,
    ) => HttpException;

    return new ExceptionClass(`${error.message} (${code})`);
  }
}
```

### 3. `libs/common/src/prisma/prisma-exception.module.ts`

Same shape as `SubgraphAuthModule`.

```ts
import { DynamicModule, Module, Provider } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { PrismaExceptionFilter } from './prisma-exception.filter';
import {
  PRISMA_EXCEPTION_OPTIONS,
  PrismaExceptionOptions,
} from './prisma-exception.constants';

@Module({})
export class PrismaExceptionModule {
  static forRoot(options: PrismaExceptionOptions): DynamicModule {
    return PrismaExceptionModule.build({
      provide: PRISMA_EXCEPTION_OPTIONS,
      useValue: options,
    });
  }

  static forRootAsync(options: {
    imports?: any[];
    inject?: any[];
    useFactory: (
      ...args: any[]
    ) => Promise<PrismaExceptionOptions> | PrismaExceptionOptions;
  }): DynamicModule {
    return PrismaExceptionModule.build(
      {
        provide: PRISMA_EXCEPTION_OPTIONS,
        useFactory: options.useFactory,
        inject: options.inject ?? [],
      },
      options.imports ?? [],
    );
  }

  private static build(
    optionsProvider: Provider,
    imports: any[] = [],
  ): DynamicModule {
    return {
      module: PrismaExceptionModule,
      imports,
      providers: [
        optionsProvider,
        { provide: APP_FILTER, useClass: PrismaExceptionFilter },
      ],
    };
  }
}
```

### 4. `libs/common/src/index.ts`

Add alongside the existing exports:

```ts
export * from './prisma/prisma-exception.filter';
export * from './prisma/prisma-exception.module';
export * from './prisma/prisma-exception.constants';
```

---

## Wiring it up

`apps/users-microservice/src/app.module.ts` — add to `imports`, next to
`SubgraphAuthModule.forRootAsync`:

```ts
PrismaExceptionModule.forRootAsync({
  imports: [AppConfigModule],
  inject: [AppConfig],
  useFactory: (appConfig: AppConfig) => ({
    exposeErrorCode: !appConfig.isProduction,
  }),
}),
```

Identical block in `apps/files-microservice/src/app.module.ts`, and in
`posts-microservice` if we want the coverage it currently lacks.

Then remove the duplicate registrations:

```ts
// apps/users-microservice/src/main.ts:25   — delete
app.useGlobalFilters(new UsersPrismaExceptionFilter());

// apps/users-microservice/src/users/users.module.ts:136 — delete
{ provide: APP_FILTER, useClass: UsersPrismaExceptionFilter },

// apps/files-microservice/src/main.ts:15   — delete
app.useGlobalFilters(new FilesPrismaExceptionFilter());
```

…and delete `users-prisma-exception.filter.ts` and `files-prisma-exception-filter.ts`.

> Note: the users filter is currently registered **twice** — once via `useGlobalFilters` in
> `main.ts:25` and once via `APP_FILTER` in `users.module.ts:136`. Only the `APP_FILTER` one
> gets DI.

`APP_FILTER` is required here rather than `useGlobalFilters`: the filter now takes an
injected options token, and filters constructed by hand in `main.ts` get no DI.

---

## Drift guard

The whole approach rests on all three clients resolving a single
`@prisma/client-runtime-utils`. If someone later upgrades one service's Prisma
independently, pnpm installs two copies and `instanceof` breaks **silently** — errors stop
being caught and raw Prisma messages reach clients.

Make it an assertion. Put it in an app's test dir rather than `libs/`, to avoid a deep
generated-client import from a library:

```ts
// apps/files-microservice/test/prisma-error-identity.spec.ts
import { PrismaClientKnownRequestError } from '@prisma/client-runtime-utils';
import { Prisma as UsersPrisma } from '../../../prisma/apps/users/src/generated/prisma/users-client';
import { Prisma as FilesPrisma } from '../../../prisma/apps/files/src/generated/prisma/files-client';
import { Prisma as PostsPrisma } from '../../../prisma/apps/posts/src/generated/prisma/posts-client';

describe('shared Prisma error class', () => {
  it('is one constructor across all generated clients', () => {
    // If this fails, @Catch() silently stops matching and raw DB errors reach clients.
    expect(UsersPrisma.PrismaClientKnownRequestError).toBe(
      PrismaClientKnownRequestError,
    );
    expect(FilesPrisma.PrismaClientKnownRequestError).toBe(
      PrismaClientKnownRequestError,
    );
    expect(PostsPrisma.PrismaClientKnownRequestError).toBe(
      PrismaClientKnownRequestError,
    );
  });
});
```

---

## Alternative: duck-typed, zero Prisma import in `libs`

Only worth it if we expect services to drift onto different Prisma versions.

```ts
// libs/common/src/prisma/is-prisma-known-request-error.ts
const PRISMA_ERROR_CODE = /^P\d{4}$/;

export type PrismaKnownRequestError = Error & {
  code: string;
  meta?: Record<string, unknown>;
  clientVersion: string;
};

export function isPrismaKnownRequestError(
  error: unknown,
): error is PrismaKnownRequestError {
  if (!(error instanceof Error)) return false;

  const candidate = error as Partial<PrismaKnownRequestError>;

  return (
    error.name === 'PrismaClientKnownRequestError' &&
    typeof candidate.code === 'string' &&
    PRISMA_ERROR_CODE.test(candidate.code)
  );
}
```

The filter then becomes catch-all, which is the catch — it now intercepts *every* exception,
so non-Prisma ones have to be handed back correctly:

```ts
@Catch()
export class PrismaExceptionFilter extends BaseExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    if (!isPrismaKnownRequestError(exception)) {
      // GraphQL: let Apollo's formatError chain handle it.
      if (host.getType<GqlContextType>() === 'graphql') throw exception;
      // HTTP/RPC: fall back to Nest's default handling, or HttpExceptions
      // lose their status and degrade to a bare 500.
      return super.catch(exception, host);
    }
    // ...identical mapping logic
  }
}
```

That delegation branch is the entire cost of this option.

---

## Bugs this consolidation fixes

**1. The `(P2002)` suffix silently doesn't work outside GraphQL.**
`files-prisma-exception-filter.ts:16` mutates `mapped.message`, but
`HttpException.getResponse()` returns the response object built in the constructor, which
still holds the original string. It works today only because `createGraphqlFormatError`
reads `resolverError.message` directly (`create-graphql-format-error.ts:23`). Over HTTP or
RPC the suffix vanishes. Rebuilding the exception fixes it everywhere.

**2. Unmapped codes leak raw Prisma errors in users.**
`users-prisma-exception.filter.ts:15` does `return exception`. Converging on the files
behaviour closes it, and `exposeErrorCode: !isProduction` keeps dev ergonomics without the
prod leak.

**3. RPC context is currently unhandled.**
files-microservice runs a TCP microservice alongside GraphQL (`files/main.ts:17`), and
`useGlobalFilters` applies to **both**. Both existing filters implement `GqlExceptionFilter`
and throw `HttpException`s, which is wrong for a TCP handler — the caller should get an
`RpcException`. The `host.getType()` branch in the proposed filter handles this. Relevant to
the `check-owned-ready-files` RPC path on branch `BACK-29`.

**Also worth knowing:** `mapPrismaErrorCode` returns `null` for `P1000`–`P1017`
(connection/auth failures) and `P2013`/`P2028`, so those all land in the
`InternalServerErrorException` fallback — correct for clients, and the logger line preserves
the real code for us.
