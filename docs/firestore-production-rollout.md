# Firestore production rollout runbook

This runbook is preparation only. None of these production actions are part of
Phase 3.6.

## Preconditions

- `npm run firebase:qa` passes against the local `demo-thai-music-editor`
  emulator project.
- `npm test`, `npm run build`, and targeted lint checks pass.
- A release owner, rollback owner, maintenance window, and monitoring window
  are assigned.
- The client release includes the Phase 3 split-document reader and remains
  able to read legacy parent documents.

## Backup and restore check

1. Create a managed Firestore export of the production database to a
   versioned Cloud Storage location owned by the production project.
2. Record the export URI, database name, timestamp, document counts, and the
   person who initiated it.
3. Verify the export operation completed successfully; do not rely only on the
   command having started.
4. Restore the export into an isolated verification project/database and open
   representative legacy, partial, and split projects there.
5. Keep the export immutable until the rollout and rollback windows close.

If managed export is not enabled for the production billing/project setup,
stop the rollout and arrange a verified backup method first.

## Controlled rollout

1. Announce a short maintenance window that prevents old clients from writing
   while the aggregate baseline is established.
2. Take and verify the production backup above.
3. Deploy only the reviewed backward-compatible `firestore.rules` and verify
   owner, other-user, admin, aggregate-schema, content-id, and legacy cases.
4. Deploy the new client. Do not perform a bulk or destructive content
   migration.
5. Require or strongly force a refresh by publishing a minimum supported
   client version. Keep legacy reads enabled during the compatibility window.
6. Reconcile every affected user's `meta/storage` against project metadata in
   dry-run mode. Review drift before any correction is authorized:

   ```powershell
   npm run firebase:reconcile -- --project <production-project-id> --dry-run
   ```

   After the report has been reviewed and while the maintenance window still
   blocks old-client writes, apply the reviewed correction explicitly:

   ```powershell
   npm run firebase:reconcile -- --project <production-project-id> --apply --confirm-write
   ```
7. Monitor permission-denied rates, `PROJECT_CONTENT_MISSING`, migration
   retries, save failures, and aggregate drift throughout the window.
8. Sample newly created, updated, renamed, duplicated, imported, and deleted
   projects, including a real `.tme` export/import round trip.
9. Roll back the client first if failures rise. Restore data only from the
   verified backup under an explicit incident decision.

## Old-client mitigation

An old client can still write a legacy parent project without updating
`meta/storage`. Therefore the safe rollout uses all three controls:

- a maintenance window during the rule/client transition;
- a minimum-client-version gate or forced refresh before writes resume; and
- aggregate drift reconciliation during and after the compatibility window.

Rules alone cannot prove aggregate correctness while old clients remain able
to write the legacy format. Do not close the compatibility window until old
write traffic is negligible and reconciliation reports no unexplained drift.

## Rollback triggers

- sustained permission-denied errors for valid owner operations;
- missing `content/current` without a readable legacy fallback;
- negative, double-counted, or unexplained aggregate drift;
- failed `.tme` round trips or project IDs changing during migration; or
- concurrent saves producing metadata/content mismatches.
