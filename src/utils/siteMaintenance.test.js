import test from 'node:test';
import assert from 'node:assert/strict';
import { isSiteMaintenanceActiveAt, siteMaintenanceEndsAtMs } from './siteMaintenance.js';

const timestamp = (milliseconds) => ({ toMillis: () => milliseconds });

test('site maintenance stays active only before its configured end time', () => {
  const maintenance = { enabled: true, endsAt: timestamp(2_000) };
  assert.equal(isSiteMaintenanceActiveAt(maintenance, 1_999), true);
  assert.equal(isSiteMaintenanceActiveAt(maintenance, 2_000), false);
  assert.equal(isSiteMaintenanceActiveAt(maintenance, 2_001), false);
});

test('disabled or incomplete maintenance never locks the website', () => {
  assert.equal(isSiteMaintenanceActiveAt({ enabled: false, endsAt: timestamp(2_000) }, 1_000), false);
  assert.equal(isSiteMaintenanceActiveAt({ enabled: true, endsAt: null }, 1_000), false);
  assert.equal(siteMaintenanceEndsAtMs({ endsAt: null }), 0);
});
