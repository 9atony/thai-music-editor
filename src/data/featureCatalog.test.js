import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_FEATURE_ACCESS, FEATURE_CATALOG } from './featureCatalog.js';

test('custom keyboard access is independently configurable for Free and Premium', () => {
  const feature = FEATURE_CATALOG.find((item) => item.id === 'custom-keyboard');

  assert.ok(feature);
  assert.equal(feature.group, 'workspace');
  assert.deepEqual(DEFAULT_FEATURE_ACCESS['custom-keyboard'], { free: false, premium: true });
});
