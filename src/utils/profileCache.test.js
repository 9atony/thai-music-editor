import test from 'node:test';
import assert from 'node:assert/strict';
import {
  loadCachedUserProfile,
  resetProfileCacheForTests,
  setProfileAuthUser
} from './profileCache.js';

test('logout and user switch reset the shared profile cache', async () => {
  resetProfileCacheForTests();
  let loads = 0;
  const load = async (role) => {
    loads += 1;
    return { role };
  };

  setProfileAuthUser('user-a');
  await loadCachedUserProfile('user-a', () => load('user'));
  await loadCachedUserProfile('user-a', () => load('admin'));
  assert.equal(loads, 1);

  setProfileAuthUser(null);
  setProfileAuthUser('user-a');
  assert.equal((await loadCachedUserProfile('user-a', () => load('premium'))).role, 'premium');
  assert.equal(loads, 2);

  setProfileAuthUser('user-b');
  assert.equal((await loadCachedUserProfile('user-b', () => load('admin'))).role, 'admin');
  assert.equal(loads, 3);
});

