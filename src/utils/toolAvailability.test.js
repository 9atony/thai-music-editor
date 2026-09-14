import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isToolBlockedByMaintenance,
  resolveToolFeatureId,
} from './toolAvailability.js';

test('arranger routes share the same maintenance feature id', () => {
  assert.equal(resolveToolFeatureId('workspace'), 'arranger');
  assert.equal(resolveToolFeatureId('arranger-projects'), 'arranger');
  assert.equal(resolveToolFeatureId('metronome'), 'metronome');
});

test('maintenance blocks regular members but lets admins test the tool', () => {
  const maintenance = { arranger: true };

  assert.equal(isToolBlockedByMaintenance({ toolId: 'workspace', maintenance, role: 'user' }), true);
  assert.equal(isToolBlockedByMaintenance({ toolId: 'arranger-projects', maintenance, role: 'premium' }), true);
  assert.equal(isToolBlockedByMaintenance({ toolId: 'workspace', maintenance, role: 'admin' }), false);
  assert.equal(isToolBlockedByMaintenance({ toolId: 'metronome', maintenance, role: 'user' }), false);
});
