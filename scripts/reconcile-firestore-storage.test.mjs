import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseArguments,
  storageAggregateDrift,
  summarizeUserStorage,
} from './reconcile-firestore-storage.mjs';

test('reconciliation refuses ambiguous or unconfirmed production modes', () => {
  assert.throws(() => parseArguments([]), /--project is required/);
  assert.throws(() => parseArguments(['--project', 'production', '--dry-run', '--apply']), /exactly one/);
  assert.throws(() => parseArguments(['--project', 'production', '--apply']), /--confirm-write/);
  assert.deepEqual(parseArguments(['--project', 'production', '--dry-run', '--user', 'user-1']), {
    apply: false,
    confirmWrite: false,
    dryRun: true,
    projectId: 'production',
    userId: 'user-1',
  });
  assert.deepEqual(parseArguments(['production', 'user-2'], {
    npm_config_dry_run: 'true',
    npm_config_project: 'true',
    npm_config_user: 'true',
  }), {
    apply: false,
    confirmWrite: false,
    dryRun: true,
    projectId: 'production',
    userId: 'user-2',
  });
});

test('storage reconciliation uses canonical sizes and estimates legacy projects', () => {
  const legacy = { name: 'Legacy', sheetData: '[[["ด"]]]' };
  const summary = summarizeUserStorage([
    { name: 'Split', storageSizeBytes: 123 },
    legacy,
  ]);
  assert.equal(summary.projectCount, 2);
  assert.ok(summary.storageUsedBytes > 123);
});

test('aggregate drift reports signed count and byte corrections', () => {
  assert.deepEqual(
    storageAggregateDrift(
      { projectCount: 5, storageUsedBytes: 900 },
      { projectCount: 3, storageUsedBytes: 1200 },
    ),
    { projectCount: -2, storageUsedBytes: 300 },
  );
});
