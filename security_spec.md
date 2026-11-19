# Security Specification & Threat Model — Barnhem Super App

## 1. Data Invariants
1. **Verified Authentication Gate**: No unauthenticated or unverified-email client may read or write any document in `members`, `records`, `config`, or `admins`.
2. **Master Admin & Authorized Foundation Isolation**: Only the bootstrapped foundation admin (`chali6939p@gmail.com` with `email_verified == true`) or explicitly authorized foundation device accounts listed in `resource.data.sharedEmails` / `ownerUid` can read, list, or mutate records.
3. **Path Variable Hardening**: Every document ID (`memberId`, `recordId`, `configId`, `uid`) is strictly validated with `isValidId(id)` (`^[a-zA-Z0-9_\-]+$`, max 128 chars).
4. **No Shadow Fields & Bounded Strings/Lists**: Every `create` and `update` enforces `keys().hasAll(...)` and `keys().hasOnly(...)`, string `.size()` caps, and list `.size()` caps to prevent Denial-of-Wallet attacks.
5. **Server Timestamp Integrity**: Every write enforces `incoming().updatedAt == request.time`.
6. **Zero-Lookup List Queries**: `allow list` relies purely on `request.auth` and `resource.data` fields without `get()` or `exists()` calls.

## 2. The "Dirty Dozen" Adversarial Payloads (Expected: PERMISSION_DENIED)
1. Unauthenticated read on `/members/j1` (`request.auth == null`).
2. Authenticated read with `email_verified: false` claiming admin email `chali6939p@gmail.com`.
3. Non-admin stranger reading `/members/j1` where stranger's email is not in `sharedEmails` and `ownerUid != auth.uid`.
4. Non-admin stranger attempting `list` on `/records` without matching `sharedEmails`/`ownerUid`.
5. Creating `/members/j1` with an extra shadow field `isSuperAdmin: true`.
6. Creating `/members/j1` with oversized `nickname` (> 64 chars) or > 128 char document ID.
7. Updating `/members/j1` with spoofed client timestamp `updatedAt: "2026-01-01T00:00:00Z"` instead of `request.time`.
8. Creating `/records/rec_1` with invalid `recordType: "arbitrary_table"`.
9. Updating `/records/rec_1` changing immutable `recordType` or injecting > 20 items into `sharedEmails`.
10. Stranger attempting to write `/admins/stranger_uid` to escalate privileges.
11. Creating `/config/settings` with invalid `creatorPins` list (> 5 items) or missing `ownerUid`.
12. Deleting `/members/j1` or `/config/settings` as an unauthorized user.
