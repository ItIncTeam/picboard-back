# Upload Retry — Implementation Sections

Working breakdown of [upload-retry-plan.md](./upload-retry-plan.md) into implementable chunks.
Each section is roughly one commit / one PR.

**Status legend:** ✅ done · 🎯 next · ⬜ not started

---

## Section 0 — Foundation ✅

Schema, migration, entity, repository, constants, and the use case itself.

| File | Change |
|---|---|
| `prisma/files/schema.prisma:49` | `uploadAttempts Int @default(1)`, `lastAttemptAt DateTime?` |
| `prisma/files/prisma/migrations/20260913144102_.../migration.sql` | `ALTER TABLE "file" ADD COLUMN ...` |
| `domain/entities/file.entity.ts:17` | two new constructor fields |
| `domain/repositories/files/files.repository.ts` | `findRetryable()`, `markRetrying()` abstracts |
| `infrastructure/prisma/.../prisma-files.repository.ts:78,134` | both implemented; `markRetrying` uses atomic `{ increment: 1 }`; also added the missing `deletedAt: null` to `findManyByOwnerAndStatus` |
| `files/files.constants.ts` | `UPLOAD_RULES = { MAX_FILES_PER_BATCH: 10, MAX_UPLOAD_ATTEMPTS: 5 }` |
| `application/use-cases/retry-upload/retry-upload-batch.use.case.ts` | the use case |

---

## Section 1 — Expose `retryUpload` ✅

Plan step 1. This alone fixes the reported bug.

| # | Task | File |
|---|---|---|
| 1.1 | `RetryUploadInput { fileId }` | `graphql/inputs/retry-upload.input.ts` |
| 1.2 | `RetryUploadPayload { fileId, uploadUrl, expiresAt, attempt }` | `graphql/types/payloads/retry-upload.payload.ts` |
| 1.3 | `retryUpload` mutation | `graphql/resolvers/files.resolver.ts:62` |
| 1.4 | Register `RetryUploadBatchUseCase` | `files/files.module.ts:39` |
| 1.5 | `pnpm run prisma:generate:files` | — |

**Verify:**

```graphql
mutation {
  retryUpload(input: [{ fileId: "..." }]) {
    fileId
    uploadUrl
    expiresAt
    attempt
  }
}
```

A `FAILED`/`PENDING` file you own returns a fresh URL over the **same** storage key and `attempt: 2`.
A `READY` file returns `NotFoundException` — not retryable, by design.

**Notes**

- Gateway needs no schema work: `apps/gateway/src/app.module.ts:55` uses `IntrospectAndCompose`,
  so the supergraph recomposes at startup. Restart files-microservice, then the gateway.
- Not yet confirmed against a live failed upload — the `attempt` counter and key reuse
  are the two things only a real run proves.

---

## Section 2 — Tell the client what's retryable ✅

Plan step 2. Small, high UI value.

| File | Change |
|---|---|
| `graphql/types/payloads/complete-upload.payload.ts` | added `failedReason?: string` (nullable) and `retryable: boolean` |
| `complete-upload-batch.use.case.ts` | widened `CompleteUploadBatchResult`; all five result sites now carry both fields |
| `complete-upload-batch.use.case.ts` | added private `markFailed()` so the persisted reason and the returned payload cannot drift |
| `complete-upload-batch.use.case.ts` | moved `toMimeEnum` to module scope (it was declared inside the verification loop and redeclared per iteration) |
| `complete-upload-batch.use.case.ts` + `initiate-upload-batch.use.case.ts` | hardcoded `10` → `UPLOAD_RULES.MAX_FILES_PER_BATCH` |

**Classification:**

| Situation | `retryable` | Why |
|---|---|---|
| Object not found in storage | `true` | the PUT never landed |
| Size mismatch | **`false`** | declaration mismatch — see below |
| MIME mismatch | **`false`** | same bytes fail identically — needs a fresh `initiateUploadBatch` |
| Caught exception | `true` | probably transient S3/infra |
| `READY` | `false` | nothing to retry |

**Size mismatch was initially `true`,** following the plan's "truncated / partial upload"
reasoning. That reasoning doesn't hold: S3 PUT is atomic — there is no partial object, and a
dropped connection returns an error rather than a 200. So for a client that waits for its 200
before calling `completeUpload` (which is the documented contract), the only way the sizes
disagree is that the client declared one `size` at initiate and sent different bytes. Re-sending
the same blob mismatches identically, exactly like the MIME case.

**Known imprecision, not fixed:** `retryable` conflates "retry the upload" with "retry the
verification". For the caught-exception branch the object is usually already in S3 and intact —
the cheap recovery is to call `completeUpload` again, not to re-upload. `retryable: true` gets the
right outcome by a wasteful route. Documented for the frontend instead of changing the API; the
`failedCode` enum below would resolve it properly.

**Security note:** the caught-exception branch persists the raw SDK message to
`failedReason` on the row but returns a generic `'Upload verification failed'` to the client —
AWS errors can carry bucket names, ARNs and internal endpoints. That's the `clientReason`
parameter on `markFailed`.

**Not done (optional):** a `failedCode` GraphQL enum (`OBJECT_NOT_FOUND`, `SIZE_MISMATCH`,
`MIME_MISMATCH`, `VERIFICATION_ERROR`) instead of matching on free-text `failedReason`.
Only worth it if the frontend wants per-case copy beyond retry/don't-retry.

---

## Section 3 — DataLoader: return, don't throw ✅

Plan step 4 / §11 F. Independent live bug — a single dangling id rejected an entire feed batch.

| File | Change |
|---|---|
| `libs/common/src/dataloader/dataloader.factory.ts:3` | `BatchLoadFn` widened to `Promise<(V \| Error)[]>` |
| `files-microservice/.../files.resolver.ts:100` | `throw` → `return new NotFoundException(...)` |
| `posts-microservice/.../posts.resolver.ts:117` | same |
| `users-microservice/.../users.resolver.ts:70` | same |
| `posts-microservice/.../post-author.resolver.ts:28` | same, plus a `Logger` (it was the only one with no warn line) |

**Why the factory change was required:** `BatchLoadFn` was typed `Promise<V[]>`, narrower than
DataLoader's real `ArrayLike<V | Error>`. Returning an `Error` wouldn't compile — TypeScript was
actively pushing toward the `throw` that caused the bug.

**Left open:** §11 F also floats returning `null` instead of an `Error` for the feed
("one missing thumbnail instead of a broken post"). Bigger change — the `/* | null */` types
throughout those four files would need enabling, and it changes what the gateway sends clients.
Product call, not a bug fix.

---

## Section 4 — Transactional `createManyPending` 🎯

Plan step 5 / §11 A. `prisma-files.repository.ts:23` runs N `create`s under `Promise.all` with no
`$transaction` — a mid-batch failure leaves committed orphan `PENDING` rows.

Swap to `createMany` inside `$transaction`, build entities from `preparedItems`
(`initiate-upload-batch.use.case.ts:63-69` already knows every field).
Atomic **and** 1 round trip instead of N.

---

## Section 5 — Transport hardening ⬜

Plan steps 6–7. Config-shaped, no domain logic.

- `awsS3Storage.service.ts:35` — explicit `maxAttempts: 3`, `retryMode: 'adaptive'`,
  `NodeHttpHandler` connection/request timeouts
- Grant `s3:ListBucket` so missing keys return 404, not a misleading 403
- `files-service.client.ts:53` — retry the TCP call once on timeout
  (§11 C: a slow files-service kills a post whose files are all `READY`)

---


## Section 6 — Durability net ⬜

Plan steps 8–9.

- S3 lifecycle rule on the upload prefix (console/IaC, zero code)
- Reconciliation cron — needs `@nestjs/schedule` installed. The **rescue branch** is the valuable
  half: a `PENDING` row whose object exists at the right size gets promoted to `READY`

---

## Section 7 — Make input validation actually run ✅

Not from the plan. Found while adding `RetryUploadArgs`.

`@Args('input', { type: () => [X] }) input: X[]` reflects as `design:paramtypes: [Array]`
(TypeScript erases the element type). `ValidationPipe.toValidate()` has an explicit skip list —
`[String, Boolean, Number, Array, Object, Buffer, Date]` — so the pipe returned before validating.
**Every decorator on `InitiateUploadInput` and `CompleteUploadInput` was inert.**

The explicit `{ type: () => [X] }` feeds the schema builder (`TypeMetadataStorage`), never the pipe.
Schema correct, validation absent, simultaneously.

What was unenforced: `@Max(20_971_520)` on `size` (and `awsS3Storage.service.ts:59` sets no
`ContentLength` either, so **nothing anywhere capped upload size**), `@MaxLength(255)` and
`@Matches(...)` on `originalName`, `@IsUUID()` on both `clientUploadId` and `fileId`.
GraphQL's own type system still covered `Int`, enum membership and non-null.

| File | Change |
|---|---|
| `graphql/inputs/initiate-upload.input.ts` | added `InitiateUploadArgs` (`@ArgsType`) |
| `graphql/inputs/complete-upload.input.ts` | added `CompleteUploadArgs` (`@ArgsType`) |
| `graphql/resolvers/files.resolver.ts` | both mutations take `@Args() args: XArgs` |

`@ArgsType` flattens, so both GraphQL signatures are unchanged. These were the only two bare-array
args in the codebase — `grep "type: () => \["` across `apps/` now returns nothing.

**Breaking for clients that were sending invalid data**, since the rules now actually apply.

---

## Section 8 — `formatError` returns 500 for every subgraph error ✅

`createGraphqlFormatError` returns `{message, code, statusCode, errors}` with `code`/`statusCode`
at the **top level**, but a `GraphQLFormattedError` only carries `message`, `locations`, `path`,
`extensions`. The subgraph computes the right status, emits it in fields the spec drops, and the
gateway's second pass over the same error finds nothing to match — falling through to
`INTERNAL_SERVER_ERROR`.

Not idempotent: it consumes the standard shape and emits a non-standard one, so running it twice
(subgraph, then gateway) loses everything the first pass computed. Affects every error in the
system, not just uploads.

| File | Change |
|---|---|
| `libs/common/src/graphql/types/graphql-api-error.type.ts` | `GraphqlApiError` → `GraphqlApiErrorCode` + `GraphqlApiErrorExtensions` |
| `libs/common/src/graphql/create-graphql-format-error.ts` | returns `GraphQLFormattedError` with everything under `extensions`; `getStatus` and the `errors` lookup also read `extensions`; `locations`/`path` now forwarded |
| `apps/posts-microservice/test/app.e2e-spec.ts:166` | `errors[0].code` → `errors[0].extensions.code` |

Two branches stay written out longhand rather than using the `build()` helper, because their
messages are deliberately fixed: `GRAPHQL_VALIDATION_FAILED` (always the same string) and the
final `INTERNAL_SERVER_ERROR` fallback — `build()` prefers the resolver's message over the
fallback, which in production would hand the caller the internal message that branch exists to
hide.

**Caller impact:** `errors[0].code` → `errors[0].extensions.code`. Frontend already warned in
[upload-retry-frontend-ru.md](./upload-retry-frontend-ru.md) §6 — tell them it has shipped.

---

## Not backend work

- **Plan step 3 — client two-tier retry** (§6). Frontend. Includes the latent race:
  `completeUpload` must only fire *after* the PUT resolves.
- **§9 — product decision.** Keep `createPost` strict (Option A, recommended) vs. `allowPartial`.
  Blocks nothing above; answer before Section 2's UI contract is final.

---

## Dependency order

```
Section 1 ──► Section 2
Section 3, 4, 5, 6  — independent of the retry work and of each other
```

## Known pre-existing issues (not from this work)

- `apps/posts-microservice/test/app.e2e-spec.ts` — six `TS2532: Object is possibly 'undefined'`
  errors on committed code. Present before this branch; typecheck is otherwise clean.
- **§11 G** — `DataloaderFactory.create()` returns on a name hit and discards the passed `batchFn`,
  so `'posts'` and `'post-author'` both call `postsRepository.findByIds` and that query runs
  twice per request. Efficiency, not correctness.
- `infrastructure/upload-policy/upload-policy.service.ts` is entirely commented out, including its
  own hardcoded `Maximum 10 files`. Dead code — left alone.
- The 500-for-every-error bug moved out of this list — it's now Section 8 above.
