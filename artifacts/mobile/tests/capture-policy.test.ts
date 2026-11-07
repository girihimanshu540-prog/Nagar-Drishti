import test from 'node:test';
import assert from 'node:assert/strict';
import { distanceMetres, validateEvidence, type CapturedEvidence } from '../lib/capture-policy';
const now = Date.now();
const valid: CapturedEvidence = {
  uri: 'file:///live.jpg', lat: 18.52, lng: 73.85, accuracy: 10,
  timestamp: now, capturedAt: new Date(now).toISOString(),
};
test('fresh live metadata passes client policy', () => assert.doesNotThrow(() => validateEvidence(valid, undefined, now)));
test('stale capture is blocked', () => assert.throws(() => validateEvidence({ ...valid, capturedAt: new Date(now - 121_000).toISOString() }, undefined, now), /expired/));
test('future clock is blocked', () => assert.throws(() => validateEvidence({ ...valid, capturedAt: new Date(now + 16_000).toISOString() }, undefined, now), /clock/));
test('poor or missing accuracy is blocked', () => {
  for (const accuracy of [51, NaN, 0, -1]) assert.throws(() => validateEvidence({ ...valid, accuracy }, undefined, now), /accuracy/);
});
test('stale GPS is blocked', () => assert.throws(() => validateEvidence({ ...valid, timestamp: now - 31_000 }, undefined, now), /stale/));
test('invalid coordinates are blocked', () => assert.throws(() => validateEvidence({ ...valid, lat: 100 }, undefined, now), /coordinates/));
test('same-location repair passes but 40m-away repair is blocked', () => {
  assert.doesNotThrow(() => validateEvidence(valid, { lat: valid.lat + 0.00005, lng: valid.lng }, now));
  assert.throws(() => validateEvidence(valid, { lat: valid.lat + 0.00036, lng: valid.lng }, now), /15 m/);
});
test('distance calculation distinguishes 6m and 40m', () => {
  assert.ok(distanceMetres(valid, { lat: valid.lat + 0.000054, lng: valid.lng }) < 10);
  assert.ok(distanceMetres(valid, { lat: valid.lat + 0.00036, lng: valid.lng }) > 39);
});
