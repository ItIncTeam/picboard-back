# Rate limiting strategy

**Status:** proposal — nothing implemented yet.
**Scope:** `apps/gateway`, `apps/users-microservice`, `apps/files-microservice`, `libs/common`, Prisma migrations.

**Constraint:** no new infrastructure. Kubernetes access is read-only, so nothing that
requires a new Deployment, Service, or ingress change is available. Everything below ships
inside the application and its existing Postgres databases.

## Context

There is currently **no rate limiting anywhere in the codebase**. No `@nestjs/throttler`,
no counters in any of the three Prisma schemas, no attempt tracking on auth. The only
abuse control that exists is reCAPTCHA v3, and it is wired to exactly one mutation:

- `RecaptchaGuard` is registered on the whole `AuthResolver`
  (`apps/users-microservice/src/graphql/resolvers/auth.resolver.ts:33`)
- but it no-ops unless the handler carries `@Recaptcha()`, and only `passwordReset` does
  (`auth.resolver.ts:166`).

So `signUp`, `signIn`, and `emailConfirmationResending` are entirely unprotected today.

### Topology that constrains the design

- The entire public API is **one HTTP route**: `POST /api/v1` on the Apollo Federation
  gateway (`apps/gateway/src/app.module.ts:31`).
- The three subgraphs sit behind a shared-secret middleware
  (`libs/common/src/subgraph-auth/subgraph-gateway-auth.middleware.ts`) and are not
  publicly reachable — **except** the OAuth `GET` routes, which are deliberately excluded
  (`apps/users-microservice/src/app.module.ts:64`) because browsers hit them directly.
- Deployed to Kubernetes (namespace `picboard-space`) via Jenkins, which holds its own
  deploy credentials. Replica count lives in an external `preparingDeploy.sh`.
- Three **separate** Postgres databases (users / posts / files), each reachable through
  Prisma with migrations already scripted in `package.json`.

---

## The finding that decides the approach

**Request counting does not work here.** Because everything is one POST route, a
conventional HTTP throttler cannot distinguish `me` from `signUp` — and GraphQL aliasing
makes per-request limits trivially bypassable:

```graphql
mutation {
  a: signIn(input: {...})
  b: signIn(input: {...})
  c: signIn(input: {...})
}
```

That is **one** HTTP request and N bcrypt compares. Aliased *queries* are worse — Apollo
executes root queries in parallel, mutations serially.

The limiter must therefore count **operations and units of work, not HTTP requests**, and
it must run where the parsed GraphQL document is available (`didResolveOperation`), not in
an Express middleware.

Second consequence: any batch-shaped field must be charged by its payload size, not by 1.
`initiateUploadBatch` accepts up to 10 files per call
(`apps/files-microservice/src/application/use-cases/initiate-upload/initiate-upload-batch.use.case.ts`),
so its limit must be denominated in **files**, not calls.

---

## Storage decision

A limiter needs atomic increment + expiry. With read-only cluster access, the candidates
narrow to what already exists in the process or in the databases:

| Option | Available? | Verdict |
|---|---|---|
| **Postgres counters in existing DBs** | Yes — Prisma migrations are ours | **Chosen** for security-critical limits |
| **In-process memory** | Yes — no dependency at all | **Chosen** for volumetric limits |
| Self-hosted Redis/Valkey | No — needs a Deployment + Service | Ruled out by the constraint |
| Managed Redis free tier | Technically yes | Rejected — external dep, quota cliff, and the limiter silently dies when the quota is hit |
| RabbitMQ (already wired) | Yes | Wrong tool — a broker is not a counter |

### Chosen: split by frequency × stakes

Rather than forcing one store to do both jobs, each layer uses the store that fits it:

**In-memory, per pod — volumetric limits.** High frequency, low stakes. Every request
touches this, so it must not hit the database. Drift across replicas is acceptable here:
the effective global ceiling becomes `limit × replicas`, which is fine for a bulk-traffic
guard.

**Postgres — auth and upload limits.** Low frequency (a handful of writes per user action),
high stakes. These must survive pod restarts and be shared across replicas, because
"attacker waits for a rolling deploy to reset the counter" is a real bypass and
per-pod counters divide an attacker's effort by the replica count.

The write volume this adds is trivial: one upsert per login attempt, per signup, per
password-reset request. That is the correct trade — the expensive path stays in memory, and
only the security-critical path pays for durability.

Limits also decompose cleanly along the existing database seams, so **no cross-service
database coupling is introduced**:

- auth limits → users DB (auth already lives there)
- upload limits → files DB
- volumetric limits → memory, no DB at all

### Schema

Added to `prisma/users/schema.prisma` and `prisma/files/schema.prisma` via the existing
`prisma:migrate:*` scripts:

```prisma
model RateLimitCounter {
  key       String   @id
  count     Int      @default(0)
  expiresAt DateTime

  @@index([expiresAt])
}
```

The **window start is embedded in the key**, so each time window gets its own fresh row:

```
key = `${scope}:${windowStartEpochMs}:${identifier}`
// e.g. signin:1735689600000:ip=1.2.3.4|em=<sha256>
```

This matters. If the key were stable across windows, an expired-but-not-yet-swept row would
keep accumulating and permanently lock the caller out. With the window in the key, stale
rows are inert garbage, and the increment is a single atomic statement with no transaction
and no read-modify-write race:

```sql
INSERT INTO "RateLimitCounter" (key, count, "expiresAt")
VALUES ($1, $2, $3)
ON CONFLICT (key) DO UPDATE
  SET count = "RateLimitCounter".count + EXCLUDED.count
RETURNING count;
```

Hash the email into the key rather than storing it raw — these rows should not become a
secondary directory of user addresses.

### Cleanup

Expired rows need sweeping or the table grows without bound. Two options, no infra either
way:

- **`@nestjs/schedule`** (a package, not a service) — a `@Cron` running
  `DELETE FROM "RateLimitCounter" WHERE "expiresAt" < now()` every 15 minutes. With multiple
  replicas each pod runs it; harmless for an idempotent delete.
- **Probabilistic sweep** — ~1% of writes also issue the delete. Zero new dependencies, but
  lumpier.

Prefer the cron. Note that `prisma migrate deploy` never drops tables it does not know
about, so this table is safe under the existing deploy pipeline.

### In-memory store: bound it

The naive `Map<string, count>` is a memory leak — an attacker cycling source IPs grows it
without limit, which converts a rate limiter into a denial-of-service vector against your
own pod. The implementation needs both:

- a periodic sweep of expired entries, and
- a hard cap on entry count with LRU eviction once it is hit.

### Abstraction

Both implementations sit behind one interface in `libs/common`, so a layer's storage choice
is a wiring decision and tests never need a live backend:

```ts
// libs/common/src/rate-limit/rate-limiter.store.ts
export interface RateLimiterStore {
  /** Increments the window counter for `key` by `cost` and returns the new total. */
  hit(key: string, windowMs: number, cost?: number): Promise<number>;
  reset(key: string): Promise<void>;
}
```

- `InMemoryRateLimiterStore` — volumetric layer, plus all dev and unit tests
- `PostgresRateLimiterStore` — auth and upload layers

This is ~80 lines of real logic and matches the repository/adapter pattern the codebase
already uses everywhere. The alternative is the `rate-limiter-flexible` package, which
supports both backends and would work against the `pg` Pool already in the dependency
tree — worth taking if maintaining this is not appealing, at the cost of a table whose
shape the library owns rather than Prisma.

**Failure policy:** if the Postgres store throws, **fail closed** on auth limits — a
limiter that opens under load is not a limiter — but keep it to that layer, so a database
blip cannot take the read-only API down with it. The in-memory layer cannot fail this way.

---

## Architecture: three layers

Note the previously obvious fourth layer — per-IP ceilings at ingress-nginx — is
**unavailable**, since ingress config is not writable. That pushes volumetric defence into
the gateway process, which is the main compromise this constraint forces.

### Layer 1 — Gateway, operation-aware (in-memory)

An Apollo Server plugin on `didResolveOperation`, where the parsed document is available.
It walks the operation's root fields, sums a per-field cost, and charges the total.

Key selection, in order:

1. `userId` from the verified JWT.
2. Client IP, for anonymous traffic.

The JWT is currently verified inside `PicboardDataSource.willSendRequest`
(`apps/gateway/src/auth/picboard-data-source.ts`), which runs *after* planning and once per
subgraph. Identity needs to be resolved earlier — in the GraphQL `context` factory — so the
plugin can key on it. Small refactor, and it removes the redundant repeat verification per
subgraph as a side benefit.

This layer also rejects amplification directly, which costs nothing and does not need a
store at all:

- cap root fields per document (~10)
- reject documents containing duplicate *sensitive* root fields (aliased `signIn` × N)

### Layer 2 — Subgraph, business limits (Postgres)

The gateway already forwards `x-user-id` and `x-client-ip`
(`picboard-data-source.ts:76,101`), so subgraphs can identify the real client despite
sitting behind the gateway. Use it for semantic limits rather than volumetric ones —
notably **keyed on email, not only IP**, which is what actually defeats distributed
credential stuffing.

Implemented as a Nest guard reading a `@RateLimit({...})` decorator, mirroring the existing
`RecaptchaGuard` / `@Recaptcha()` pattern so it stays idiomatic to this codebase.

The OAuth `GET` callbacks live here too and need their own guard, since they bypass the
gateway entirely and Layer 1 never sees them.

### Layer 3 — Captcha escalation

reCAPTCHA v3 is already integrated and costs nothing extra. Rather than a hard 429 at the
limit, escalate:

- soft threshold → require a captcha token
- hard threshold → 429

and extend `@Recaptcha()` to `signUp`, `signIn`, and `emailConfirmationResending`, which
have none today.

---

## Proposed limits

| Operation | Cost driver | Limit | Store |
|---|---|---|---|
| `signIn` | bcrypt cost 10 ≈ 100ms CPU; credential stuffing | 5/min per IP+email, 20/min per IP | PG |
| `signUp` | bcrypt + SMTP + DB write | 3/hr, 10/day per IP | PG |
| `emailConfirmationResending` | sends email, no captcha today | 1/min, 5/hr per email | PG |
| `passwordReset` | sends email (has captcha) | 3/hr per email, 10/hr per IP | PG |
| `emailConfirmation`, `setNewPassword` | code brute-force | 10/hr per IP | PG |
| `exchangeOAuthCode` | code guessing | 10/min per IP | PG |
| `refreshToken` | DB + JWT | 30/hr per session | PG |
| `initiateUploadBatch` | ≤10 S3 presigns + 10 DB rows per call | **count files:** 50/hr, 200/day per user | PG |
| `completeUpload` | DB writes | 100/hr per user | PG |
| OAuth `GET` callbacks | bypass the gateway | 20/min per IP | PG |
| Global authenticated | — | 300 ops/min per user | memory |
| Global anonymous | — | 100 ops/min per IP | memory |

All 429 responses carry `Retry-After`, surfaced through the existing
`createGraphqlFormatError` so the shape stays consistent with the rest of the API.

Escalating lockout after repeated `signIn` failures is deliberately **not** in scope for the
first pass. It needs a second piece of state ("locked until") with different semantics from
a window counter, and the window limits above already blunt the attack. Revisit once the
basics are running.

---

## Prerequisite: verify the real client IP

`apps/gateway/src/main.ts:18` sets `trust proxy` to `1`. Behind the k8s ingress this needs
verifying: **if the hop count is wrong, `req.ip` resolves to the ingress IP and every user
shares a single bucket** — turning every per-IP limit into a global one and locking out the
whole user base as soon as one attacker trips it.

Every per-IP limit in the table above, plus the forwarded `x-client-ip` that Layer 2 depends
on, inherits this value. Confirm before building on it.

Read-only cluster access is enough to answer both open infrastructure questions:

```bash
kubectl get ingress -n picboard-space -o yaml    # how many proxy hops add to X-Forwarded-For
kubectl get deploy  -n picboard-space -o wide    # replica count → in-memory drift factor
```

Then log `req.ip` alongside `x-forwarded-for` against a known client address in staging to
confirm empirically.

---

## Phases

1. **Verify client IP and replica count.** Both answerable with read-only access. Nothing
   else is trustworthy until the IP question is settled.
2. **Store abstraction.** `RateLimiterStore`, both implementations, the Prisma model and
   migration, the cleanup cron. No enforcement yet — ship it inert and unit-test it.
3. **Auth limits (Layer 2).** Keyed by email + IP on the users subgraph, plus the OAuth
   callback guard. Highest risk, smallest surface, no gateway refactor required — deliver
   this before Layer 1.
4. **Gateway operation-cost plugin (Layer 1).** Includes hoisting JWT verification into the
   context factory, the root-field cap, and duplicate-sensitive-field rejection.
5. **Upload and file limits.** File-denominated counting on `initiateUploadBatch`, plus
   presigned-URL caching (see below).
6. **Captcha escalation (Layer 3).**

Phases 1–3 remove most of the actual risk. Phase 4 is what makes it hard to bypass. Phases
1–4 are a coherent stopping point if the remainder gets deprioritised.

---

## Adjacent issues found

Not rate limiting, but they determine whether it works:

1. **`File.url` presigns S3 on every field resolution**
   (`apps/files-microservice/src/application/use-cases/resolve-file-url/resolve-file-url.use.case.ts`),
   uncached. A feed query with many posts × attachments fans out into a burst of presign
   calls — read amplification no per-request limit catches. Cache presigned GETs by
   `storageKey` for most of their TTL. In-memory is fine for this cache.

2. **`feed()` has no pagination at all**
   (`apps/posts-microservice/src/posts/graphql/posts.resolver.ts:36`, marked
   `//todo: infinity scroll`). It returns the whole table. `profilePosts` is correctly
   capped with `@Max`; `feed` is not. Combined with #1, one query gets more expensive as the
   table grows — and cost-based limiting cannot price a field whose cost is unbounded.

3. **`EmailAdapter` constructs a new SMTP transport per email**
   (`apps/users-microservice/src/infrastructure/messaging/email.adapter.ts:10`). Under a
   burst, every request holds its own handshake to smtp.mail.ru. Pool the transporter, and
   ideally move sends onto RabbitMQ — `@app/rmq` is already wired.

4. **Orphaned `PENDING` file rows.** `initiateUploadBatch` writes rows before presigning and
   never cleans up when the upload never completes. Spammable into unbounded row growth
   independent of any storage cost, and the use case's own `//todo` acknowledges the failure
   path. Needs a sweeper — the same cron added in Phase 2 can host it.

---

## Open questions

- Does anything else share these Postgres instances, or is headroom entirely ours? Relevant
  only if traffic ever leaves portfolio scale.
- Should authenticated abusers be limited per user *and* per IP simultaneously, or does
  per-user suffice? Per-user alone is bypassable by registering many accounts — which is
  what the `signUp` limit exists to make expensive.
- If cluster access ever becomes writable, the Postgres store is the piece to revisit:
  swapping in Redis behind `RateLimiterStore` is a single new implementation and a wiring
  change, with no call sites touched. The interface exists partly to keep that door open.
