import test from 'node:test';
import assert from 'node:assert/strict';
import { createAsyncResourceCache } from './asyncResourceCache.js';

test('lazy audio resource cache loads an asset once', async () => {
  const cache = createAsyncResourceCache();
  let assetLoads = 0;
  const loader = async () => {
    assetLoads += 1;
    return { decoded: true };
  };

  assert.equal(assetLoads, 0);
  const [first, second] = await Promise.all([
    cache.load('ranat-ek:C4', loader),
    cache.load('ranat-ek:C4', loader)
  ]);
  const third = await cache.load('ranat-ek:C4', loader);

  assert.equal(assetLoads, 1);
  assert.equal(first, second);
  assert.equal(second, third);
});

