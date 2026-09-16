import test from 'node:test';
import assert from 'node:assert/strict';
import { getAnchoredScrollPosition, getPinchPreviewTranslation } from './sheetZoom.js';

test('pinch preview keeps the original sheet point beneath stationary fingers', () => {
  const translation = getPinchPreviewTranslation({
    anchorX: 420,
    anchorY: 600,
    startCenterX: 180,
    startCenterY: 300,
    centerX: 180,
    centerY: 300,
    visualScale: 1.5,
  });

  assert.deepEqual(translation, { x: -210, y: -300 });
  assert.equal((420 * 1.5) + translation.x, 420);
  assert.equal((600 * 1.5) + translation.y, 600);
});

test('pinch preview follows a moving finger midpoint without changing scroll', () => {
  const translation = getPinchPreviewTranslation({
    anchorX: 300,
    anchorY: 400,
    startCenterX: 160,
    startCenterY: 260,
    centerX: 190,
    centerY: 240,
    visualScale: 1.2,
  });

  assert.ok(Math.abs(translation.x - (-30)) < 1e-9);
  assert.ok(Math.abs(translation.y - (-100)) < 1e-9);
});

test('committed zoom restores the same content point and clamps negative scroll', () => {
  assert.equal(getAnchoredScrollPosition({ pagesOffset: 24, contentPoint: 500, scale: 1.4, center: 180 }), 544);
  assert.equal(getAnchoredScrollPosition({ pagesOffset: 16, contentPoint: 20, scale: 0.5, center: 100 }), 0);
});
