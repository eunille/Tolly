import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ago, buildAnnouncement, pesos } from './announcement.ts';

const MIN = 60_000;
const HOUR = 60 * MIN;

test('pesos reads naturally', () => {
  assert.equal(pesos(340), '340 pesos');
  assert.equal(pesos(1), '1 peso');
  assert.equal(pesos(340.5), '340 pesos and 50 centavos');
  assert.equal(pesos(0.999), '1 peso'); // rounding carries into pesos
  assert.equal(pesos(-20), 'minus 20 pesos');
  assert.equal(pesos(0), '0 pesos');
});

test('ago picks the right unit', () => {
  assert.equal(ago(30_000), null);
  assert.equal(ago(1 * MIN), '1 minute ago');
  assert.equal(ago(59 * MIN), '59 minutes ago');
  assert.equal(ago(2 * HOUR + 5 * MIN), '2 hours ago');
  assert.equal(ago(49 * HOUR), '2 days ago');
});

test('live, cached, unavailable and low in one announcement', () => {
  const now = 1_000 * HOUR;
  const text = buildAnnouncement(
    [
      { label: 'Autosweep', amount: 340, asOf: now, live: true },
      { label: 'Easytrip', amount: 150, asOf: now - 2 * HOUR, live: false },
      { label: 'Other', amount: null },
    ],
    now,
  );
  assert.equal(
    text,
    'Autosweep: 340 pesos. Easytrip: 150 pesos, as of 2 hours ago. Low, reload soon. Other balance unavailable.',
  );
});

test('nothing set up', () => {
  assert.equal(buildAnnouncement([]), 'No toll accounts set up yet.');
});
