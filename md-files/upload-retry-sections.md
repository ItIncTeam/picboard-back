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

## Section 2 — Tell the client what's retryable 🎯

Plan step 2. Small, high UI value.

- Add `failedReason?: string` and `retryable: boolean` to `graphql/types/payloads/complete-upload.payload.ts`
- Widen `CompleteUploadBatchResult` (`complete-upload-batch.use.case.ts:20`)
- Set the flag at the four existing failure exits:

| Site | Reason | `retryable` |
|---|---|---|
| `complete-upload-batch.use.case.ts:96` | Object not found in storage | `true` |
| `:110` | Size mismatch | `true` |
| `:145` | MIME mismatch | **`false`** — same bytes fail identically |
| `:168` | caught exception | `true` |

**Cleanup to fold in:** `UPLOAD_RULES.MAX_FILES_PER_BATCH` is used only by the retry use case.
Still hardcoded as `10` in `complete-upload-batch.use.case.ts:49`,
`initiate-upload-batch.use.case.ts:54`, `upload-policy.service.ts:13`.

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

## Section 4 — Transactional `createManyPending` ⬜

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
