# Sprint Review — Findings & Outstanding Work

Post creation + file upload flow. Covers the whole sprint (2026-06-30 → 2026-09-19),
both contributors, all branches.

Companion to [upload-retry-plan.md](./upload-retry-plan.md) and
[upload-retry-sections.md](./upload-retry-sections.md). Where those two describe *planned*
work, this one lists what we found while reviewing the finished sprint: real bugs, wrong
documentation, and the gaps we chose not to close.

**Severity legend:** 🔴 bug, wrong behaviour today · 🟠 wrong docs already handed to another team ·
🟡 known gap, deliberately deferred · ⚪ cleanup / cosmetic · ✅ fixed during this sprint

Every item below was verified by reading the code (and, for §2, the pinned SDK source) —
none are speculative.

---

## 1. Bugs — wrong behaviour today

### 1.1 🔴 `User.posts` is in the schema but has no resolver

`apps/posts-microservice/src/posts/graphql/user-posts.resolver.ts` defines `UserPostsResolver`,
but it is **never listed in `posts.module.ts` providers**. The field is published in the
supergraph (it is declared on the `User` stub in `user.stub.ts:14`) and always resolves to
`null`.

Either register the provider or remove the field from the stub. Registering it is one line,
but note it would then call `findByOwnerId` with no pagination and no `DataLoader` — so
removing the field and pointing clients at `profilePosts` is probably the better call.

**Fix:** 1 line either way. Decide which.

### 1.2 🔴 Duplicate `fileId` in `completeUpload` rejects the whole batch with an empty message

`complete-upload-batch.use.case.ts:87`. `retryUpload` and `CheckOwnedReadyFilesHandler` both
deduplicate their input with `[...new Set(ids)]`; `completeUpload` does not.

Send `[A, A]`: the query returns 1 row, `1 !== 2` trips the count guard, and `missingIds`
computes to `[]` because `A` *is* in `foundIds`. The client gets:

```
Files not found or not in PENDING status:
```

— whole batch rejected, empty id list, nothing actionable. `@ArrayMaxSize(10)` also counts
duplicates against the batch limit.

**Fix:** dedupe like the other two use cases. 1 line.

### 1.3 🔴 Soft-deleted files still resolve and still return presigned URLs

`prisma-files.repository.ts:152` (`findById`) and `:162` (`findByIds`) have **no
`deletedAt: null` filter** — unlike `findByIdsOwnerAndStatus` and `findRetryable`, which both
have it. And `softDeleteMany` (`:188`) only stamps `deletedAt`; it leaves `status` at `READY`.

So a soft-deleted file still passes `ResolveFileUrlUseCase`'s `status !== READY` check and
still gets a fresh presigned GET URL. Practically it is hard to reach today — the only path to
a `File` is through a post attachment, and a deleted post is filtered out of every posts query
— but the data layer does not enforce the deletion, and any future `Query.file` or direct
entity reference would leak deleted images.

**Fix:** add `deletedAt: null` to both finders, and/or set `status: DELETED` in `softDeleteMany`
(see §5.3 — `DELETED` is currently a dead enum value).

### 1.4 🟡 `retryUpload` increments are not transactional

`retry-upload-batch.use.case.ts:103`. Both guards correctly run before any write, and
`markRetrying` uses an atomic `{ increment: 1 }` — but the N updates themselves are a bare
`Promise.all`. If update 3 of 5 fails, updates 1 and 2 have committed, the mutation throws,
and the client receives zero URLs while two files have silently burned an attempt.

Same shape as §3.1. Low impact (the user loses retries, nothing corrupts), but worth a
`$transaction`.

### 1.5 🟡 Exhausted-attempt check rejects the entire retry batch

`retry-upload-batch.use.case.ts:69-78`. One file at the 5-attempt cap throws
`BadRequestException` for the whole call — which is the same "one bad file kills the batch"
shape this sprint set out to eliminate.

Defensible today, because the client already knows each file's `attempt` from the previous
response, so asking for an exhausted file is a client bug. But the real blocker is that
`RetryUploadPayload` has no per-file error shape the way `CompleteUploadPayload` does.

**Fix:** mirror `CompleteUploadPayload` — add `failedReason` / `retryable` to
`RetryUploadPayload` and return per-file outcomes instead of throwing. Expect this to be asked
about; it is the most obvious inconsistency in the new code.

### 1.6 ⚪ `author` nullability disagrees between type and resolver

`post.entity.ts:22` declares `@Field(() => User) author?: User` (non-null in the SDL) while
`post-author.resolver.ts:15` declares `@ResolveField(() => User, { nullable: true })`. Pick one
— if the resolver can genuinely return `null`, the field must be nullable, otherwise a null
propagates up and blanks the whole post.

---

## 2. 🟠 Documentation already sent to the frontend team is wrong

Highest priority in this document, because the frontend is holding the incorrect version.

### 2.1 `Content-Type` is **not** covered by the presigned URL signature

Both [upload-retry-plan.md](./upload-retry-plan.md) §2 and §10.2, and
[upload-retry-frontend-ru.md](./upload-retry-frontend-ru.md) §"Ответ S3" / Step 2, state that a
`Content-Type` mismatch produces `403 SignatureDoesNotMatch`. Verified against the pinned SDK
(`@aws-sdk/s3-request-presigner@3.1073.0`), that is false:

```js
// s3-request-presigner/dist-es/presigner.js — prepareRequest()
unsignableHeaders.add("content-type");
```

`getCanonicalHeaders` then skips it, so `X-Amz-SignedHeaders` contains only `host`. AWS does
this deliberately — browsers append things like `; charset=utf-8` on their own, which would
break every signature.

Consequences to correct in both documents:

- A `403` means **expired URL** (or a wrong key/bucket). It does not mean a header mismatch.
  The frontend guide's advice to "fix the `Content-Type` header first" is wrong and will send
  someone down a dead end.
- `ContentType` in `PutObjectCommand` (`awsS3Storage.service.ts:59`) has **no effect on the
  presigned URL at all** — it is neither signed nor hoisted into the query string. Whatever
  `Content-Type` the client sends becomes the object's stored type.
- The `Metadata` block behaves the opposite way: `moveHeadersToQuery` hoists every `x-amz-*`
  header into the query string, so `x-amz-meta-original-size` and `x-amz-meta-uploaded-at`
  **are** signed and are applied automatically. The client sends nothing for them.

### 2.2 The `retryable: false` reasoning for MIME mismatch is wrong

`complete-upload-batch.use.case.ts:157-159` says *"the client declared one type and sent
another, so re-uploading the same bytes fails identically."* Given §2.1, a client that corrects
its header and re-PUTs the **same bytes** would pass.

`retryable: false` is still the behaviour we want — the client's declarations are inconsistent
and we should not paper over that. Only the justification needs rewriting, in the code comment
and in [upload-retry-sections.md](./upload-retry-sections.md) §2.

### 2.3 Plan §7's "10 concurrent `HeadObject`s" concern does not apply

The verification loop is a `for...of` with `await` inside, so the ten `HeadObject` calls are
**sequential**, not concurrent. The argument for `retryMode: 'adaptive'` in §7 is therefore
moot as the code stands. (Explicit timeouts are still worth adding — see §3.2.)

### 2.4 Stale note in `upload-retry-sections.md`

"Known pre-existing issues" still claims six `TS2532` errors in
`apps/posts-microservice/test/app.e2e-spec.ts`. `npx tsc --noEmit` is now **clean**; commit
`2eadf94` fixed them. Delete the note.

---

## 3. 🟡 Known gaps — already planned, not started

These are Sections 4–6 of [upload-retry-sections.md](./upload-retry-sections.md), restated here
so the sprint's total outstanding work is in one place.

### 3.1 `createManyPending` is not transactional — Section 4 🎯

`prisma-files.repository.ts:21`. N separate `create` calls under `Promise.all`, no
`$transaction`. A mid-batch failure leaves the earlier rows **committed** while the client gets
an error and zero URLs — orphan `PENDING` rows pointing at keys nobody will upload to.

Every field is already known locally (`initiate-upload-batch.use.case.ts:65-84`), so
`createMany` inside `$transaction` buys atomicity **and** one round trip instead of N.

### 3.2 Transport hardening — Section 5 ⬜

- `awsS3Storage.service.ts:35` — no explicit `maxAttempts`, no `NodeHttpHandler` connection or
  request timeout. A hung socket can block a request indefinitely.
- `awsS3Storage.service.ts:120` — `getObjectMetadata` maps only `NotFound`/`NoSuchKey` to
  `null`. Without `s3:ListBucket` on the bucket, S3 answers **403 `AccessDenied` instead of 404**
  for a missing key; that rethrows, hits the outer catch, and marks the file `FAILED` with a
  misleading reason. Grant `s3:ListBucket`.
- `files-service.client.ts:53` — the 5 s TCP call has no retry. A briefly slow files-service
  kills a `createPost` whose files are all `READY` (plan §11 C). Transient by definition, so
  the single most worthwhile retry in the system.

### 3.3 Nothing cleans up abandoned uploads — Section 6 ⬜

A user who closes the tab mid-upload leaves a `PENDING` row forever, and possibly a real S3
object nobody references. Two independent mechanisms, both still missing:

- S3 lifecycle rule on the upload prefix (console/IaC, zero code).
- Reconciliation cron (`@nestjs/schedule` not yet installed). The **rescue branch** is the
  valuable half: a stale `PENDING` row whose object exists at the right size gets promoted to
  `READY` — it recovers uploads that genuinely worked but were never confirmed, which is common
  on mobile.

### 3.4 Nothing enforces upload size at the storage layer

`@Max(20_971_520)` on `InitiateUploadInput.size` is the only cap, and it validates a *declared*
number. `PutObjectCommand` sets no `ContentLength`, so S3 accepts whatever is actually sent.
`completeUpload` catches the mismatch afterwards — so an oversized file can never reach `READY`
— but the bytes do land in the bucket and cost storage until something sweeps them (§3.3).

### 3.5 No content validation at all

We never look at the bytes. `completeUpload` verifies **size** (authoritative — S3 reports it)
and **`Content-Type`** (client-supplied on both sides of the comparison, per §2.1). There is no
magic-byte sniff, no image decode, no dimension check, no re-encode.

So the honest claim is *"we verify that the client's declarations are internally consistent and
that the size matches"*, not *"we verify uploads are images"*. Impact is bounded — objects are
stored and served as `image/*`, so a browser will not execute one as HTML — but it should be
stated accurately if asked.

If we want real validation, the standard route is a magic-byte check after `HeadObject`, or a
worker that re-encodes the image (which also strips EXIF — a privacy win).

---

## 4. 🔴 Verification gaps

### 4.1 `files-microservice` has **zero tests**

`apps/files-microservice/test/` contains only `jest-e2e.json` — no spec files anywhere in the
service. Every test in the repo (17, all passing) belongs to `posts` and `users`.

The sprint's headline feature is therefore verified by reading and by manual GraphQL calls
only. [upload-retry-sections.md](./upload-retry-sections.md) §1 admits it: *"Not yet confirmed
against a live failed upload — the `attempt` counter and key reuse are the two things only a
real run proves."*

Cheapest high-value fix, a `RetryUploadBatchUseCase` unit spec with `FilesRepository` and
`StorageService` mocked, asserting:

1. it signs `file.storageKey` and never calls `StorageKeyBuilder` — this is the month-boundary
   bug, and the one thing no manual test will ever catch;
2. an exhausted file is rejected with **no** write;
3. duplicate ids collapse;
4. `attempt` reflects the incremented value.

Then the same for `CompleteUploadBatchUseCase`'s five classification branches.

### 4.2 `retryUpload` has never run against a real failed upload

Key reuse and the attempt counter are both only provable end to end. Worth doing once against
staging before calling the feature done.

---

## 5. ⚪ Cleanup

### 5.1 Dead files

| File | State |
|---|---|
| `apps/posts-microservice/src/common/subgraph-gateway-auth.middleware.ts` | entirely commented out — superseded by the `libs/common` version |
| `apps/posts-microservice/src/common/current-user.decorator.ts` | **empty file** |
| `apps/files-microservice/src/infrastructure/upload-policy/upload-policy.service.ts` | entirely commented out, including its own hardcoded `Maximum 10 files` |
| `libs/contracts/src/soft-delete-files.contract.ts` | entirely commented out — the real DTOs live in `check-owned-ready-files.contract.ts` |
| `apps/posts-microservice/src/posts/posts.events.controller.ts` | listens for `file.upload.completed` and only logs it; RabbitMQ leftover, no live path |

### 5.2 `FileStatus.UPLOADED` and `FileStatus.DELETED` can never occur

Both are declared in `file-status.enum.ts` and `prisma/files/schema.prisma`, and **nothing ever
sets either**. Soft delete uses the `deletedAt` column instead (§1.3), and the row goes
`PENDING → READY` directly. `complete-upload-batch.use.case.ts:170` even carries the comment
`// Step 3: Transition UPLOADED -> READY`, describing a transition that does not exist.

Both values are published in the public GraphQL `FileStatus` enum, so the API advertises states
a client will never see. Either use them (`DELETED` would fix §1.3 cleanly) or remove them.

### 5.3 `failedReason` is not queryable

It is returned once in `CompleteUploadPayload` and persisted on the row, but is not a field on
the `File` type. A client that lost the mutation response cannot ask why a file failed. Add it
to `file.type.ts` if the frontend wants it.

### 5.4 `DataloaderFactory` caches on name alone

`dataloader.factory.ts:9` — `create()` returns the existing loader on a name hit and discards
the newly passed `batchFn`. Harmless (the factory is per request), but `posts.resolver.ts` uses
`'posts'` while `post-author.resolver.ts` uses `'post-author'` and both call
`postsRepository.findByIds`, so that query runs **twice per request**. Efficiency, not
correctness. (Plan §11 G.)

### 5.5 Lint

`npx eslint` reports 29 errors, of which 25 are CRLF/prettier noise that `pnpm lint` fixes
automatically. The four real ones:

- `post-row.type.ts:3` — `postInclude` assigned but used only as a type
- `apps/posts-microservice/test/app.e2e-spec.ts:10,11,16` — unused `_fileIds`, `_ownerId`, `_data`

Also worth addressing: `delete-post.use.case.ts:34` floats `markFilesDeleted(...)`
deliberately, but should say so with `void` so the lint warning stops hiding real ones.

### 5.6 `README.md` is still NestJS boilerplate

No setup steps, no service map, no local-run instructions, no explanation of the upload flow.
The single highest-value doc for anyone joining.

---

## 6. Decisions to make (not bugs)

### 6.1 Keep `createPost` strict, or allow partial posts?

Plan §9, still open. Option A (strict, repair before posting — current behaviour) is
recommended and is how Instagram and Twitter behave; `retryUpload` alone solves the reported
problem. Option B (`allowPartial` as an explicit, never-default input flag) needs a product
sign-off. Answer before Section 2's UI contract is final.

### 6.2 Public type names leak implementation names

`@ObjectType()` with no argument on `PostEntity` and `PostAttachmentEntity` uses the class name,
so clients write `PostEntity` in queries. Compare `FileReference`, correctly declared
`@ObjectType('File')`. Renaming is a **breaking change for the frontend**, so it gets cheaper
the sooner it happens — decide now rather than later.

### 6.3 `feed` is hardcoded to 4 posts

`prisma-posts.repository.ts:41` — `take: 4` with a `//todo: infinity scroll`. `profilePosts`
already has proper cursor pagination (`createdAt_id`, added in `8ee9107`); `feed` should get the
same treatment before it is a real feed.

### 6.4 Federation 1 idiom inside a Federation 2 schema

The `File` and `User` stubs use `@extends` + `@external`. Federation 2 accepts this for
compatibility, which is why composition succeeds, but the modern form states the intent
directly:

```graphql
type File @key(fields: "id", resolvable: false) { id: ID! }
```

Cosmetic, no rush — but expect a reviewer who works in Fed 2 daily to ask.

### 6.5 No schema checks in CI

`IntrospectAndCompose` composes at gateway **startup**, with no polling and no registry. A
breaking subgraph change is caught when the gateway boots in the target environment, not at PR
time. `rover subgraph check`, or a build-time composed supergraph SDL, would move that left.

### 6.6 `deletePost` → `markFilesDeleted` is fire-and-forget

`delete-post.use.case.ts:34` deliberately does not await, and the client swallows errors. If
that TCP call fails, the post is gone but its files stay live forever with no retry and no
outbox. Acceptable for now — it is the documented cost of one database per service — but it is
the one place the two services can silently diverge.

---

## 7. ✅ Fixed during this sprint

Recorded so these are not raised again.

| Item | Where |
|---|---|
| `markFilesDeleted` sent `filesIds`, so soft-delete **never ran** (`forbidNonWhitelisted` rejected every call) | `15982db` on `dev`, with a regression spec — **not yet merged into `upload-retry`** |
| One failed file discarded the whole post | `retryUpload` mutation, `add7f32` |
| Client could not tell whether a retry would help | `failedReason` + `retryable`, `c284202` / `9033aed` |
| One dangling id rejected an entire DataLoader batch (live feed bug) | `c4d5532`, 4 resolvers + factory type |
| Every validation decorator on the upload inputs was inert — including the 20 MB cap | `0d40312`, `@ArgsType` wrappers |
| `formatError` degraded every subgraph error to 500 | `390b2e7`, moved `code`/`statusCode` under `extensions` |
| Six `TS2532` errors in the posts e2e spec | `2eadf94` |

---

## Suggested order

1. **§2** — correct both documents. The frontend is acting on the wrong information right now.
2. **§1.1, §1.2, §1.3** — three small, real bugs. Roughly one line each plus tests.
3. **§4.1** — unit specs for `RetryUploadBatchUseCase` and `CompleteUploadBatchUseCase`.
4. **§3.1** — transactional `createManyPending`.
5. **§1.5** — per-file results from `retryUpload`; closes the last instance of the pattern this
   sprint was about.
6. **§3.2** — transport hardening, including the `s3:ListBucket` grant.
7. **§5** — cleanup, and give `README.md` a real page.
8. **§3.3** — the durability net, once `@nestjs/schedule` is in.

§6 items are decisions, not work; answer them before the code that depends on them.
