# Sprint: Profile editing & profile photo — backend tickets

Spec: "Заполнение/редактирование профиля. Загрузка фото" (UC-1 Fill in profile, UC-2 Upload photo, UC-3 Edit profile).

Ticket keys (A-1…, B-1…) are placeholders — replace with real BACK-xx numbers when created in Jira.

## Workload split

| | **Dev A — Profile data** | **Dev B — Profile photo** |
|---|---|---|
| Scope | UC-1, UC-3: profile fields, validation, country/city lookup | UC-2: avatar upload, replace, delete, cleanup |
| Story points | 17 | 18 (+5 optional) |
| Main services | users-microservice | files-microservice, users-microservice, libs |

**Where the two halves meet:** both devs edit `prisma/users/schema.prisma` (A adds profile fields, B adds an outbox table). Merge **A-1 first** and have B rebase before generating their migration. Both also add fields to the `User` GraphQL type, which is a small, easy merge.

---

## Dev A — Profile data

### A-1: Extend User schema with profile fields
**Type:** Task · **SP:** 2 · **Service:** users-microservice

Add the fields the "General Information" form needs to the `User` model.
- Add `firstName String?`, `lastName String?`, `dateOfBirth DateTime? @db.Date`, `countryId`, `cityId` (FKs to the tables from A-2; they can be added in A-2's migration if that's simpler)
- Reuse the existing `bio` column for "About me". Decide what to do with `displayName`: keep it, derive it from first + last name, or drop it.
- The columns stay nullable in the DB because users who existed before this change have no values. "Mandatory" is enforced at the API level (A-4).

**AC:**
- [ ] Migration created and applied locally (SQL reviewed, and it doesn't touch existing rows)
- [ ] `UserEntity` and the repository mapping are updated
- [ ] The generated client is regenerated

---

### A-2: Countries and cities reference data
**Type:** Task · **SP:** 3 · **Service:** users-microservice

The Country and City fields must be picked from predefined lists, so the backend needs those lists.
- Add `Country` (id, ISO 3166-1 alpha-2 code, name) and `City` (id, countryId, name) tables
- Seed them from an open dataset (e.g. GeoNames `cities15000` to keep the size reasonable). Write the seed script so it can be re-run safely without creating duplicates.
- Add indexes that support prefix search on name (e.g. `lower(name)` with `text_pattern_ops`, or `pg_trgm`)

**AC:**
- [ ] Seed script committed and documented in the README
- [ ] Re-running the seed doesn't create duplicates
- [ ] `User.countryId` / `cityId` FKs are in place (`onDelete: SetNull`)

---

### A-3: GraphQL queries for country/city autocomplete
**Type:** Story · **SP:** 3 · **Service:** users-microservice

Queries the frontend calls to populate and autocomplete the dropdowns. They're public (no auth needed).
- `countries(search: String, limit: Int = 20): [Country!]!`
- `cities(countryId: ID!, search: String, limit: Int = 20): [City!]!`
- Match on name prefix, case-insensitive. Cap `limit` at 50.
- Add `country` and `city` fields to `User` (use dataloaders so listing many users doesn't trigger one query each)

**AC:**
- [ ] Searching "ger" returns Germany. Searching "ber" under Germany returns Berlin.
- [ ] Empty `search` returns the first N results alphabetically
- [ ] The queries are exempt from auth but still covered by the gateway rate limiter
- [ ] Unit tests for the use cases

---

### A-4: `updateProfile` mutation with validation
**Type:** Story · **SP:** 5 · **Service:** users-microservice

Saves the "General Information" form (UC-1 and UC-3 use the same endpoint). Only the logged-in owner can call it: the user id comes from the auth context and is never taken from the input.

Validation rules:

| Field | Required | Rules |
|---|---|---|
| username | yes | 6–30 chars, `^[A-Za-z0-9_-]+$`, unique |
| firstName | yes | 1–50 chars, Latin and Cyrillic letters only |
| lastName | yes | 1–50 chars, Latin and Cyrillic letters only |
| dateOfBirth | no | valid date, not in the future, **age ≥ 13** |
| countryId / cityId | no | must exist, and the city must belong to the country |
| aboutMe | no | 0–200 chars (letters, digits, special characters) |

**Notes:**
- The under-13 check needs a dedicated error code (e.g. `USER_UNDER_13`) so the frontend can show "A user under 13 cannot create a profile. Privacy Policy".
- If the username is already taken, return a specific `USERNAME_TAKEN` error. Also catch the Prisma unique-constraint violation (P2002) in case two requests race for the same name.
- The spec's `dd.mm.yyyy` is how the date is shown in the UI. The API accepts ISO `YYYY-MM-DD`, and the frontend converts between the two.
- ⚠️ The JWT payload includes `username` (`libs/auth/src/jwt.strategy.ts:36`). After a username change, either issue a fresh access token in the response, or stop depending on the `username` claim downstream. Decide which one as part of this ticket.
- Trim whitespace from strings before validating.

**AC:**
- [ ] Valid input saves the profile and the mutation returns the updated profile
- [ ] Each rule in the table rejects bad input with a field-level error the frontend can map to the form
- [ ] A user can't edit anyone else's profile
- [ ] Unit tests cover every rule, including the age boundary (exactly 13 years old today)

---

### A-5: Expose profile fields in `user(id)` / `me`
**Type:** Task · **SP:** 2 · **Service:** users-microservice

The profile page is public (anyone can view it without logging in), but only the owner can edit it.
- Add `firstName`, `lastName`, `aboutMe`, `country`, `city` to `User`
- Decide whether `dateOfBirth` is public. The suggestion: show it only on `Me`, not on the public `User` type.
- `me` returns all fields, including the ones needed to pre-fill the settings form (username is already filled in from registration)

**AC:**
- [ ] `user(id)` works without a token and returns only public fields
- [ ] `me` returns everything the settings form needs to pre-fill

---

### A-6: E2E tests for profile editing
**Type:** Task · **SP:** 2

**AC:**
- [ ] Happy path: fill in the profile, then read it back through both `me` and `user(id)`
- [ ] Rejected: under 13, taken username, invalid characters, `aboutMe` over 200 chars, a city from a different country
- [ ] Anonymous callers get 401 on `updateProfile`
- [ ] Test data is cleaned up afterwards (same approach as BACK-47)

---

## Dev B — Profile photo

### B-1: Support the `AVATAR` purpose in files-service
**Type:** Task · **SP:** 3 · **Service:** files-microservice

Allow avatars to go through the existing initiate → complete upload flow.
- Add `AVATAR` to the `Purpose` enum in both Prisma and GraphQL
- Upload rules per purpose: for `AVATAR`, JPEG/PNG only, **≤ 10 MB**, and exactly one file per batch. Move the rules out of `UPLOAD_RULES` into a per-purpose map.
- On complete-upload, check the actual file content, not just the declared type: confirm the real size, and confirm the file's first bytes match JPEG/PNG.

**AC:**
- [ ] A file over 10 MB, or one that isn't JPEG/PNG, is rejected at initiate. A file that lies about its size or type is rejected at complete (status `FAILED` with a `failedReason`).
- [ ] The error message matches the spec: "The photo must be less than 10 Mb and have JPEG or PNG format"
- [ ] Existing `POST_IMAGE` behavior is unchanged
- [ ] Unit tests

---

### B-2: Extract the file-deletion outbox into a shared lib
**Type:** Tech debt · **SP:** 3 · **Services:** libs/common, posts-microservice

Replacing or deleting an avatar has to reliably delete the old file, which is the same problem #24 solved for posts. Move the outbox repository interface and worker out of posts-microservice into `libs/` so users-microservice can reuse them.

**AC:**
- [ ] The shared module takes the Prisma client and the TCP client as parameters instead of hard-coding them
- [ ] posts-microservice is migrated to the shared module, and its existing tests pass unchanged
- [ ] No behavior change for posts

---

### B-3: `setProfilePhoto` mutation
**Type:** Story · **SP:** 5 · **Service:** users-microservice · **Depends on:** B-1, B-2

After the upload completes, the frontend calls `setProfilePhoto(fileId: ID!): User`.
- Check over TCP (using the existing `check-owned-ready-files` handler) that the file belongs to the caller, is `READY`, and has purpose `AVATAR`
- In one transaction: set `profilePictureFileId` to the new file, and add the previous avatar's file id (if there was one) to the users-service outbox
- Add the outbox table to `prisma/users/schema.prisma` (**coordinate with A-1**)
- Wire up the outbox worker from B-2

**AC:**
- [ ] The new avatar resolves through the existing `avatar` field
- [ ] The old file gets soft-deleted in files-service, and still gets deleted if files-service was down at the time
- [ ] Rejected: a file owned by someone else, a file that isn't `READY`, a file with the wrong purpose
- [ ] Unit tests

---

### B-4: `deleteProfilePhoto` mutation
**Type:** Story · **SP:** 3 · **Service:** users-microservice · **Depends on:** B-3

Backs the "Do you really want to delete your profile photo?" → Yes action.
- In one transaction: set `profilePictureFileId = null` and add the file id to the outbox
- Deleting when there's no avatar succeeds and does nothing (returns `true`), so a retried request isn't an error

**AC:**
- [ ] After deletion, `avatar` is `null` and the file is eventually `DELETED` in files-service
- [ ] Only the owner can delete their own photo
- [ ] Unit tests

---

### B-5: E2E tests for avatar lifecycle
**Type:** Task · **SP:** 2

**AC:**
- [ ] Full flow: upload → set avatar → replace it (old file gets deleted) → delete it
- [ ] Rejected: a file over 10 MB, a GIF, a file owned by another user
- [ ] Anonymous callers get 401

---

### B-6: Clean up unattached avatar uploads
**Type:** Task · **SP:** 2 · **Service:** files-microservice

UC-2's cancel scenario: if the photo gets uploaded before the user clicks [Save] and they then close the window, the file is never attached to the user and stays in storage. files-service has no cleanup job for this today.
- Agree with the frontend that the upload starts only after [Save]. That makes this rare, but it can still happen (tab closed mid-flow, network failure).
- Scheduled job: soft-delete `AVATAR` files that are still `PENDING` / `FAILED` / unattached after N hours (e.g. 24h)
- For "unattached": either ask users-service over TCP, or have `setProfilePhoto` mark the file as attached (e.g. an `attachedAt` column). Decide which in this ticket.

**AC:**
- [ ] An avatar file that was uploaded but never set gets soft-deleted after the configured interval
- [ ] Current avatars and post images are never touched
- [ ] Unit tests for how the job selects files

---

### B-7 (optional): Server-side avatar resizing
**Type:** Story · **SP:** 5

The spec says photo centering is optional, and the frontend can crop before uploading. If there's time left in the sprint, generate fixed-size avatar variants (e.g. 48 px and 192 px) with `sharp` after the upload completes, so the feed doesn't download 10 MB originals.

---

### B-8: Sign `Content-Type` in presigned PUT URLs
**Type:** Tech debt · **SP:** 3 · **Service:** files-microservice · **Needs:** frontend

Found while testing B-1. The AWS SDK v3 S3 presigner always leaves `content-type` out of the signature: `prepareRequest()` in `@aws-sdk/s3-request-presigner` adds it to `unsignableHeaders`. Our presigned PUT URLs are therefore signed for `host` only (`X-Amz-SignedHeaders=host`), and the `ContentType` we pass to `PutObjectCommand` has no effect. The client can send any `Content-Type`, S3 stores it, and S3 serves the file back with it.

Today the only thing stopping, say, a file declared as PNG and uploaded as `text/html` from becoming `READY` is the Content-Type check in `completeUpload`, and the object still stays in S3 with that header. A second problem: we pass the `Mime` enum value (`'JPEG'` / `'PNG'`), not a real MIME type, so it can't be signed as it is. The comment in `retry-upload-batch.use.case.ts` that says S3 answers 403 on a mismatch is wrong for the same reason; it was corrected during B-1.

Signing the header makes S3 reject a mismatched PUT with 403, before anything is stored. Verified locally: passing `signableHeaders` changes the signed headers from `host` to `content-type;host`.

- Map `Mime` to real MIME types in one place (`JPEG → image/jpeg`, `PNG → image/png`) and use it in both presign calls (initiate and retry)
- Pass `signableHeaders: new Set(['content-type'])` to `getSignedUrl`
- Return the exact header value to the frontend, e.g. a `contentType` field on `InitiateUploadPayload` and `RetryUploadPayload`. It must match character for character: `image/jpg` or a missing header gets a 403.
- Frontend: send that header on the PUT, and treat a 403 on the PUT as **not retryable**. `retryUpload` would issue a URL that fails the same way.
- Keep the magic-byte check from B-1. Signing only forces the header to match the declaration; the bytes can still be anything.
- `toMimeEnum` in complete-upload already accepts `image/jpeg` / `image/png`, so the Content-Type check there keeps working

**Behavior change:** this also affects `POST_IMAGE`. A header that doesn't match the declaration fails at the PUT (403) instead of at `completeUpload` (`FAILED`). That's why it's a separate ticket and not part of B-1.

**Rollout:** URLs issued before the deploy keep working until they expire (15 min), and files already uploaded are unaffected. To avoid 403s during the switch: (1) backend adds the `contentType` field without signing it yet, (2) frontend starts sending it, (3) backend turns on `signableHeaders`.

**AC:**
- [ ] Presigned PUT URLs have `X-Amz-SignedHeaders=content-type;host`
- [ ] A PUT with a `Content-Type` other than the declared one is rejected by S3 with 403, and nothing is stored
- [ ] Stored objects have `Content-Type` `image/jpeg` / `image/png`, never the enum value
- [ ] Initiate and retry sign the same value: a retried upload with the returned header succeeds
- [ ] The frontend sends the returned header and doesn't call `retryUpload` after a 403
- [ ] Unit tests: the presign call uses the mapped MIME type and signs `content-type`

---

## Spec coverage

| Spec item | Covered by |
|---|---|
| UC-1.1 Profile URL has user id; public view, owner-only edit | A-5, A-4 (ownership from the auth context) |
| UC-1.3 Form: photo, username (prefilled), first/last name, DOB, country, city, about me | A-1, A-2, A-3, A-5; photo → B-1…B-4 |
| UC-1.3 Country/city from predefined lists with suggestions | A-2, A-3 |
| UC-1.5.1 Saved → "Your settings are saved!" | A-4 (returns success); alert is frontend |
| UC-1.5.2 Server unavailable → "Error! Server is not available!" | Existing TCP error classification (BACK-36); alert is frontend |
| UC-1 alt: age < 13 → message + Privacy Policy link | A-4 (`USER_UNDER_13`); message and preserving form data are frontend |
| Field validation table | A-4 |
| UC-2 JPEG/PNG, ≤ 10 MB, error message | B-1 |
| UC-2 Preview, optional centering | Frontend; optional server resizing in B-7 |
| UC-2 Save photo | B-3 |
| UC-2 alt: cancel upload | Frontend; storage cleanup in B-6 |
| UC-2 alt: delete photo with confirmation | B-4; confirmation dialog is frontend |
| UC-3 Edit and save | A-4 (same mutation as UC-1) |
| UC-3 Save button disabled on validation errors | Frontend; the backend enforces the same rules (A-4) |
| UC-3 alt: leave without saving | Frontend only |

## Open questions for the PO / frontend
1. `displayName`: keep it, derive it from first + last name, or drop it?
2. Is date of birth shown publicly?
3. Should editing the username be allowed without re-authenticating?
4. Should the country/city lists be English-only, or also in Russian?
5. Frontend: confirm that the photo upload starts only after [Save] (affects B-6).
