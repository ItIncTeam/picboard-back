# Upload Retry Plan

How to add retry to the S3 upload flow so one failed file no longer discards the whole batch.

---

## 1. Where the batch actually dies

The reported symptom — one bad file discards the whole post — comes from exactly one place. But it isn't the only spot in the codebase with all-or-nothing behaviour; see [§11](#11-every-other-place-a-batch-can-die) for the full audit, including a live one on the read path.

The reported bug:

**`create-post.use.case.ts:32`** → `files-service.client.ts:84`:

```ts
await this.filesClient.assertAllOwnedReadyOrException(input.fileIds, ownerId);
// ↓
if (result.invalidFileIds.length > 0) {
  throw new BadRequestException(`Invalid file ids: ...`);   // ← whole post rejected
}
```

`CheckOwnedReadyFilesHandler` filters on `status: READY`. One file stuck at `PENDING` or `FAILED` → the entire `createPost` throws → the user loses four good uploads because of one bad one.

One nearby spot with the same shape, one layer up:

- **`initiate-upload-batch.use.case.ts:98`** — `Promise.all` over presigning is fail-fast. If one rejects, the whole mutation throws, but `createManyPending` at line 83 already wrote N `PENDING` rows. You get orphan DB rows and the client gets zero URLs.

And one that is worth studying because it gets it *right*:

- **`complete-upload-batch.use.case.ts:72`** — the `for` loop with `try/catch` + `continue` per file means one bad file doesn't stop the others, and each gets its own `FAILED` status and reason. This is the pattern the rest should follow.

**Recommendation up front: don't loosen the `createPost` gate.** A post with a missing image is a broken post, permanently, and users can't tell what went wrong. The gate is right. What's missing is a way to *repair* the one broken file before reaching the gate.

---

## 2. S3 background: what a presigned URL actually is

This determines the whole design, so it's worth being precise.

`generatePresignedPutUrl` (`awsS3Storage.service.ts:55`) produces a normal HTTPS URL with signature parameters appended (`X-Amz-Signature`, `X-Amz-Expires`, `X-Amz-Date`, `X-Amz-Credential`...). Key properties:

**It's generated locally — no network call to AWS.** `getSignedUrl` is pure crypto over your credentials and the request shape. This means presigning is fast, free, cannot fail from network problems, and **regenerating a URL for a retry costs nothing.** It also means the `try/catch` at `initiate-upload-batch.use.case.ts:118` is guarding against something that can't really happen transiently.

**It authorizes exactly one key with exactly one shape.** The `PutObjectCommand` sets `Key`, `ContentType`, and `Metadata`. The client's PUT must match what was signed — most importantly it must send `Content-Type: image/png` (or whatever) verbatim. A mismatch gives `403 SignatureDoesNotMatch`, which looks like an auth bug but is really a header bug. This is the single most common beginner trip-up with presigned PUTs.

**PUT to the same key is idempotent and atomic.** Upload the same key twice and the second write replaces the first, wholesale. There's no such thing as a half-written S3 object — readers see the old object or the new one, never a blend. **This is what makes retry-in-place safe**, and it's the foundation of everything below.

**Read-after-write is strongly consistent.** Since December 2020, a successful PUT is immediately visible to `HeadObject` in every region. There's no need to sleep or poll before verifying. Plenty of older tutorials say otherwise — ignore them.

**Expiry is a hard wall.** After `expiresInSeconds`, the URL returns 403 and the bytes never reach S3. Two caveats: the max is 7 days, and — important here — if the service runs with an **IAM role** rather than static keys (the `awsS3Storage.service.ts:42` comment says that's the production plan), the URL dies when the *role session* expires, which can be well before `expiresIn`. On ECS/EKS that's often ~6 hours regardless of what was asked for.

---

## 3. Classify the failures first

Retry design falls out of this. Four distinct classes, needing different mechanisms:

| # | What happened | DB state | Fix |
|---|---|---|---|
| 1 | Client network dropped mid-PUT | `PENDING`, no object in S3 | Re-PUT |
| 2 | URL expired before/during upload (slow mobile, app backgrounded) | `PENDING`, 403 | **New URL**, same key |
| 3 | Verification failed — size or MIME mismatch | `FAILED` + reason | Depends on reason |
| 4 | Transient AWS/infra error server-side (`HeadObject` threw) | `FAILED`, but file may be fine | SDK-level retry |

Class 3 splits further, and this matters: **"Object not found in storage" is retryable** (the upload just never landed). **"MIME mismatch" is not** — the client declared PNG and sent JPEG, so re-uploading the same bytes fails identically. That one needs a fresh `initiateUploadBatch` with corrected metadata, not a retry.

---

## 4. Core solution: a `retryUpload` mutation that reuses the same key

The elegant part of the existing design is that `storageKey` is derived from `fileId`, and `fileId` lives in the DB row. So a retry needs **no new file record and no new key** — just a fresh signature over the key already stored.

**Prisma addition** (`prisma/files/schema.prisma`):

```prisma
model File {
  // ... existing fields
  uploadAttempts Int       @default(1)
  lastAttemptAt  DateTime?
}
```

**Repository additions** (`files.repository.ts`):

```ts
abstract findRetryable(ids: string[], ownerId: string): Promise<FileEntity[]>;
abstract markRetrying(id: string): Promise<FileEntity>;
```

```ts
// prisma-files.repository.ts
async findRetryable(ids: string[], ownerId: string): Promise<FileEntity[]> {
  const rows = await this.prisma.file.findMany({
    where: {
      id: { in: ids },
      ownerId,                                              // ownership check
      status: { in: [FileStatus.PENDING, FileStatus.FAILED] },
      deletedAt: null,
    },
  });
  return rows.map(FileMapper.toEntity);
}

async markRetrying(id: string): Promise<FileEntity> {
  const row = await this.prisma.file.update({
    where: { id },
    data: {
      status: FileStatus.PENDING,
      failedReason: null,
      failedAt: null,
      uploadAttempts: { increment: 1 },
      lastAttemptAt: new Date(),
    },
  });
  return FileMapper.toEntity(row);
}
```

**The use case:**

```ts
export class RetryUploadBatchCommand {
  constructor(
    public readonly fileIds: string[],
    public readonly ownerId: string,
  ) {}
}

export class RetryUploadBatchResult {
  fileId: string;
  uploadUrl: string;
  expiresAt: Date;
  attempt: number;
}

@CommandHandler(RetryUploadBatchCommand)
@Injectable()
export class RetryUploadBatchUseCase
  implements ICommandHandler<RetryUploadBatchCommand, RetryUploadBatchResult[]>
{
  private readonly logger = new Logger(RetryUploadBatchUseCase.name);

  constructor(
    private readonly filesRepository: FilesRepository,
    private readonly storageService: StorageService,
    private readonly appConfig: AppConfig,
  ) {}

  async execute(cmd: RetryUploadBatchCommand): Promise<RetryUploadBatchResult[]> {
    const { fileIds, ownerId } = cmd;
    const uniqueIds = [...new Set(fileIds)];

    if (!uniqueIds.length) {
      throw new BadRequestException('At least one fileId is required');
    }
    if (uniqueIds.length > UPLOAD_RULES.MAX_FILES_PER_BATCH) {
      throw new BadRequestException('Maximum 10 files are allowed');
    }

    const files = await this.filesRepository.findRetryable(uniqueIds, ownerId);

    if (files.length !== uniqueIds.length) {
      const found = new Set(files.map((f) => f.id));
      throw new NotFoundException(
        `Not retryable (missing, not owned, or already READY): ` +
        `${uniqueIds.filter((id) => !found.has(id)).join(', ')}`,
      );
    }

    return Promise.all(
      files.map(async (file) => {
        if (file.uploadAttempts >= UPLOAD_RULES.MAX_UPLOAD_ATTEMPTS) {
          throw new BadRequestException(
            `File ${file.id} exceeded the retry limit`,
          );
        }

        // ── CRITICAL ──────────────────────────────────────────────
        // Sign the key that is ALREADY STORED. Never rebuild it with
        // storageKeyBuilder: build() embeds the *current* year/month
        // (storage-key-builder.service.ts:52), so a retry that crosses
        // a month boundary would produce a different key — orphaning
        // the original object and, since storageKey is @unique,
        // desyncing the row from the object it points at.
        // ──────────────────────────────────────────────────────────
        const signed = await this.storageService.generatePresignedPutUrl({
          key: file.storageKey,
          mimeType: file.mimeType,
          size: file.size,
          expiresInSeconds: this.appConfig.s3UrlExpiresInSeconds,
        });

        const updated = await this.filesRepository.markRetrying(file.id);

        this.logger.log(
          JSON.stringify({
            event: 'upload_retry_issued',
            fileId: file.id,
            ownerId,
            attempt: updated.uploadAttempts,
          }),
        );

        return {
          fileId: file.id,
          uploadUrl: signed.uploadUrl,
          expiresAt: signed.expiresAt,
          attempt: updated.uploadAttempts,
        };
      }),
    );
  }
}
```

**Resolver** (`files.resolver.ts`):

```ts
@Mutation(() => [RetryUploadPayload])
retryUpload(
  @CurrentUserId() ownerId: string,
  @Args('input', { type: () => [RetryUploadInput] }) input: RetryUploadInput[],
): Promise<RetryUploadPayload[]> {
  return this.commandBus.execute(
    new RetryUploadBatchCommand(input.map((i) => i.fileId), ownerId),
  );
}
```

**Why reuse the key rather than creating a new file row:**

- No orphaned S3 objects. A new key leaves the old broken object behind — you pay storage for it forever unless a lifecycle rule sweeps it.
- The `fileId`s the client is already holding stay valid. Its upload list doesn't need re-keying, and `createPost` receives exactly the ids it always expected.
- Attachment ordering (`sortOrder` in `prisma-posts.repository.ts`) is preserved.
- Overwrite is atomic, so a retry can never leave a corrupt object.

---

## 5. Tell the client what's worth retrying

Right now `CompleteUploadPayload` is just `{ fileId, status }`. The client sees `FAILED` and has no idea whether retrying helps. `complete-upload-batch.use.case.ts` already computes precise reasons — surface them:

```ts
@ObjectType()
export class CompleteUploadPayload {
  @Field() fileId: string;
  @Field(() => FileStatus) status: FileStatus;
  @Field({ nullable: true }) failedReason?: string;
  @Field() retryable: boolean;
}
```

Classify at the point of failure, where the cause is already known:

```ts
// "Object not found in storage"  → retryable: true   (upload never landed)
// "Size mismatch"                → retryable: true   (truncated / partial upload)
// "MIME mismatch"                → retryable: false  (client bug — same bytes fail again)
// caught exception               → retryable: true   (probably transient S3/infra)
```

This turns a dead end into an actionable UI: four green thumbnails, one red one with a **Retry** button, and for the non-retryable case a "re-pick this file" prompt instead.

---

## 6. Client-side: two tiers of retry

A point that saves a lot of pointless server traffic — **while the presigned URL is still valid, a retry needs no server round trip at all.** `initiateUploadBatch` already returns `expiresAt`, so the client can decide which tier it needs:

```ts
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Tier 1: re-PUT the SAME url. Free, no server call. Handles flaky networks.
async function putWithRetry(
  url: string, blob: Blob, mimeType: string, maxAttempts = 3,
): Promise<'ok' | 'needs-new-url' | 'failed'> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'PUT',
        body: blob,
        headers: { 'Content-Type': mimeType }, // MUST equal the signed ContentType
      });

      if (res.ok) return 'ok';

      // 403 = expired URL or Content-Type mismatch. Retrying this URL is futile.
      if (res.status === 403) return 'needs-new-url';

      // 5xx / 429 (SlowDown) → transient, worth another go at the same URL
    } catch {
      // network error → also worth retrying
    }

    // exponential backoff + jitter; jitter stops 10 parallel uploads
    // from all retrying on the same tick and re-colliding
    await sleep(2 ** attempt * 300 + Math.random() * 200);
  }
  return 'failed';
}

// Tier 2: escalate to the server for a fresh signature.
async function uploadOne(item: InitiatePayload, blob: Blob, mimeType: string) {
  let url = item.uploadUrl;

  for (let round = 0; round < 2; round++) {
    const expired = Date.now() >= new Date(item.expiresAt).getTime();
    if (!expired) {
      const result = await putWithRetry(url, blob, mimeType);
      if (result === 'ok') return true;
      if (result === 'failed') return false;
    }
    const [fresh] = await gql.retryUpload([{ fileId: item.fileId }]);
    url = fresh.uploadUrl;
    item = { ...item, expiresAt: fresh.expiresAt };
  }
  return false;
}
```

**Then call `completeUpload` only after the PUT has returned 200.** There's a latent race in the current flow: fire `completeUpload` before the PUT resolves and `HeadObject` legitimately returns `null` → the file is marked `FAILED` even though it was fine a second later. If "random" failures are showing up today, this is a strong suspect.

---

## 7. Server-side retry for transient AWS errors

Different mechanism, different failure class. The AWS SDK v3 **already retries automatically** — default `maxAttempts: 3`, exponential backoff with jitter, covering 500/502/503/504, throttling (`SlowDown`, `RequestLimitExceeded`, 429), and network errors like `ECONNRESET`. The `S3Client` (`awsS3Storage.service.ts:35`) doesn't configure it, so it's on defaults. Make it explicit and add timeouts:

```ts
import { NodeHttpHandler } from '@smithy/node-http-handler';

this.s3Client = new S3Client({
  region: this.appConfig.s3Region,
  credentials: appConfig.s3AccessKeyId ? { ... } : undefined,

  maxAttempts: 3,           // 1 initial attempt + 2 retries
  retryMode: 'adaptive',    // adds client-side rate limiting when S3 throttles you

  requestHandler: new NodeHttpHandler({
    connectionTimeout: 3_000,
    requestTimeout: 5_000,  // without this, a hung socket can block a request forever
  }),
});
```

Two things to be clear about:

- **This only affects `HeadObject`** (`getObjectMetadata`) and any other real API call. `getSignedUrl` makes no network request, so retry settings are irrelevant to presigning.
- **`retryMode: 'adaptive'`** matters if a user uploads 10 files at once and 10 concurrent `HeadObject`s then fire — adaptive mode backs off proactively instead of hammering into throttling.

One more, on `getObjectMetadata`: the `catch` at line 121 only maps `NotFound`/`NoSuchKey` to `null`. If the IAM role lacks `s3:ListBucket` on the bucket, S3 returns **403 `AccessDenied` instead of 404** for a missing key — a genuinely confusing AWS behavior. That 403 would rethrow, hit the outer catch in `complete-upload-batch.use.case.ts:158`, and mark the file `FAILED` with a misleading reason. Granting `s3:ListBucket` makes missing objects report as honest 404s.

---

## 8. The safety net: reconcile abandoned uploads

Retry handles users who stick around. It doesn't help the user who closes the tab mid-upload, leaving a `PENDING` row forever — and possibly a real S3 object nobody references, which costs money.

Two mechanisms, and they complement each other:

**S3 Lifecycle rule** (AWS console or IaC, zero code) — expire objects under a prefix after N days. This is the cheapest backstop and needs no application logic at all. It's the standard answer for orphaned upload objects.

**A reconciliation sweep** for the DB side. Note `@nestjs/schedule` isn't in `package.json` yet, so this needs installing:

```ts
@Cron(CronExpression.EVERY_HOUR)
async sweepStalePendingUploads(): Promise<void> {
  // Anything PENDING far longer than a URL could live is definitively abandoned.
  const cutoff = new Date(
    Date.now() - this.appConfig.s3UrlExpiresInSeconds * 1000 - GRACE_MS,
  );
  const stale = await this.filesRepository.findStalePending(cutoff, 100);

  for (const file of stale) {
    const meta = await this.storageService.getObjectMetadata({
      bucket: file.bucket,
      key: file.storageKey,
    });

    if (meta && meta.size === file.size) {
      // RESCUE: the upload actually succeeded, the client just never
      // called completeUpload (crashed, lost connection, closed the tab).
      await this.filesRepository.updateStatus(
        file.id, FileStatus.READY, undefined, new Date(),
      );
    } else {
      await this.filesRepository.updateStatus(
        file.id, FileStatus.FAILED, 'Upload abandoned (stale pending)',
      );
    }
  }
}
```

The rescue branch is the valuable half — it silently recovers uploads that genuinely worked but never got confirmed, which is a surprisingly common real-world case on mobile.

---

## 9. The one product decision to make

Everything above assumes `createPost` stays strict. That's a product call, not a technical one:

**Option A — strict (keep current behavior), repair before posting.** The upload screen shows per-file status; **Create Post** stays disabled until all files are `READY`. Zero change to `assertAllOwnedReadyOrException`. This is how Instagram and Twitter actually behave, and it's the recommended path — the retry mutation alone solves the problem.

**Option B — allow partial posts.** Change the client to opt in explicitly:

```ts
// create-post.use.case.ts
const { validFileIds, invalidFileIds } =
  await this.filesClient.filterOwnedReady(input.fileIds, ownerId);

if (invalidFileIds.length > 0 && !input.allowPartial) {
  throw new BadRequestException(`Invalid file ids: ${invalidFileIds.join(', ')}`);
}
if (validFileIds.length === 0) {
  throw new BadRequestException('No valid files to attach');
}
// then create with validFileIds, and return invalidFileIds in the payload
```

Make `allowPartial` an explicit input flag, never the default. Silently posting 4 of someone's 5 photos is a bad surprise, and it's irreversible from their point of view. If going this way, return the dropped ids so the UI can say so.

**If this grows later:** the fuller pattern is draft posts — create the post immediately in `DRAFT`, attach files as they turn `READY`, publish when complete. It handles resumable multi-session uploads well, but it needs a status on `Post`, a publish mutation, and cleanup for abandoned drafts. Overkill for now; worth knowing it's the next step up.

---

## 10. Gotchas worth writing down

1. **Never rebuild the storage key on retry.** `storageKeyBuilder.build()` embeds the current year/month — a cross-month retry would generate a different key. Always sign `file.storageKey` from the DB.
2. **`Content-Type` on the client PUT must exactly match the signed `ContentType`,** or you get a 403 that looks like an auth failure.
3. **`Metadata['uploaded-at']`** (`awsS3Storage.service.ts:67`) records when the URL was *signed*, not when the upload happened — and on retry it's the retry's signing time. Don't treat it as an upload timestamp; the `uploadedAt`/`readyAt` columns exist for that.
4. **Cap retries** (`uploadAttempts`, ~3–5). Without a cap, a client bug becomes an infinite presigning loop.
5. **`markRetrying` resets `FAILED → PENDING`**, which matters because `CheckOwnedReadyFilesHandler` only accepts `READY`. A retried file is correctly excluded from `createPost` until it re-completes.
6. **Presigned URLs under an IAM role die with the role session,** often hours before the configured `expiresIn`. Keep `s3UrlExpiresInSeconds` modest (15–60 min) and lean on `retryUpload` for fresh ones rather than signing long-lived URLs.
7. **Don't sleep before `HeadObject`** — S3 is strongly read-after-write consistent. If the object isn't there, it genuinely isn't there.

---

## 11. Every other place a batch can die

An audit of the rest of the codebase for the same "one bad item kills the whole set" shape. The write-path items are variations on the reported bug; the read-path item is a separate live bug on the most-used query.

### Write path

**A. `createManyPending` is not transactional** — `prisma-files.repository.ts:23`

```ts
const created = await Promise.all(
  items.map((item) => this.prisma.file.create({ data: item, select: {...} })),
);
```

N separate `create` calls under `Promise.all`, no `$transaction`. If item 3 of 5 hits a `storageKey` unique violation, `Promise.all` rejects — but items 1, 2 (and likely 4, 5) **have already committed**. Nothing rolls back. The mutation throws, the client gets zero URLs, and orphan `PENDING` rows are left pointing at keys nobody will ever upload to.

More severe than B, because it leaves persistent state behind.

Worth noting the returned rows aren't actually needed: `fileId` and `storageKey` are both generated locally in `initiate-upload-batch.use.case.ts:63-69`, so every field is already known. `createMany` inside a `$transaction`, then building the entities from `preparedItems`, buys atomicity *and* one round trip instead of N.

**B. `Promise.all` over presigning** — `initiate-upload-batch.use.case.ts:98`

Covered in §1. Low severity: presigning is local crypto (§2) and can't fail transiently.

**C. The TCP call itself can kill a valid post** — `files-service.client.ts:53`

```ts
.pipe(timeout(5000))   // → GatewayTimeoutException / ServiceUnavailableException
```

If files-service is slow or briefly down, `createPost` fails **even when all ten files are perfectly `READY`**. This failure has nothing to do with file state. It's also the class most worth an automatic server-side retry, because it's transient by definition — two attempts with a short backoff would absorb most of it.

**D. Nested inner timeout** — `check-owned-ready-files.handler.ts:67`

3s around the DB query, sitting inside C's 5s. The layering is correct (inner < outer). Just be aware that a slow query surfaces to the user as a dead post.

**E. `posts.repository.create`'s `$transaction`** — `prisma-posts.repository.ts:79`

All-or-nothing by design, and correct. A post with half its attachments would be worse than no post. No change needed.

### Read path

**F. A throwing DataLoader batch function rejects the entire batch.**

This pattern appears four times — `files.resolver.ts:81`, `posts.resolver.ts:113`, `post-author.resolver.ts:25`, `users.resolver.ts:66`:

```ts
return ids.map((id) => {
  const file = fileMap.get(id);
  if (!file) {
    throw new NotFoundException('File not found');   // ← thrown inside the batch fn
  }
  return file;
});
```

Throwing inside a batch function rejects **every key in that batch**, not just the missing one — that's documented DataLoader behaviour. So on a `feed` query loading 4 posts × up to 10 attachments, a single dangling `fileId` fails all ~40 file resolutions at once, and GraphQL null-propagation then blanks out large parts of the response.

It is the same bug as the reported one, mirrored onto reads. The idiom is to **return** the error rather than throw it, which scopes it to the one key:

```ts
return ids.map((id) => {
  const file = fileMap.get(id);
  if (!file) {
    this.logger.warn(`Referenced file not found. fileId=${id}`);
    return new NotFoundException('File not found');  // returned → rejects only this key
  }
  return file;
});
```

DataLoader treats a returned `Error` instance as that key's rejection and resolves the rest normally.

The `/* | null */` comments scattered through those four files suggest this was already under consideration — and for a feed, returning `null` against a nullable field is arguably the better product call: one missing thumbnail instead of a broken post.

**G. Minor: `DataloaderFactory` caches on `name` alone** — `dataloader.factory.ts:9`

`create()` returns the existing loader on a name hit and ignores the newly passed `batchFn`. Harmless, since the factory is per-request. But `posts.resolver.ts` uses `'posts'` while `post-author.resolver.ts` uses `'post-author'` and both call `postsRepository.findByIds` — so that query runs twice per request. Efficiency, not correctness.

### Priority

**F** is the one that changes this plan: a live bug on the most-used query, cheap to fix, same class as the problem that started all this. **A** next, since orphan rows accumulate silently. **C** is a good candidate for the retry treatment in §7. B, D, G are notes.

---

## Suggested order

1. `retryUpload` mutation + `uploadAttempts` column — this alone fixes the reported problem.
2. `failedReason` + `retryable` on `CompleteUploadPayload` — makes the UI actionable.
3. Client-side two-tier retry, and only call `completeUpload` after the PUT resolves.
4. **Return instead of throw in the four DataLoader batch functions** (§11 F) — independent of the retry work, and fixes a live feed bug.
5. **Wrap `createManyPending` in a transaction** (§11 A) — stops silent orphan `PENDING` rows.
6. Explicit `maxAttempts` / `retryMode` / timeouts on `S3Client`; grant `s3:ListBucket`.
7. Retry the files-service TCP call on timeout (§11 C).
8. S3 lifecycle rule (config only, no code).
9. Reconciliation cron with the rescue branch.

Steps 1–3 are the reported fix. 4–5 are separate live bugs found in the §11 audit and can be done independently. 6–9 are the durability layer that stops `PENDING` rows and orphaned objects accumulating.
