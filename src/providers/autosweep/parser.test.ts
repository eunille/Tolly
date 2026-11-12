import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { AutosweepError, parseBalance, parseLogin } from './parser.ts';

const kind = (k: string) => (e: unknown) => e instanceof AutosweepError && e.kind === k;

test('login success returns the main account number', () => {
  assert.deepEqual(parseLogin({ success: 1, data: { account_number: ' 123456 ', active: 1 } }), { accountNumber: '123456' });
});

test('login: wrong password vs locked', () => {
  assert.throws(() => parseLogin({ success: 0, account_status: 1, msg: 'x' }), kind('bad-login'));
  assert.throws(() => parseLogin({ success: 0, account_status: 2 }), kind('locked'));
  assert.throws(() => parseLogin({ success: 0, account_status: '3' }), kind('locked'));
  assert.throws(() => parseLogin({ success: 1, data: { account_number: '1', active: 2 } }), kind('locked'));
});

test('login: unknown shapes are errors, not silent success', () => {
  assert.throws(() => parseLogin({ success: 1, data: {} }), kind('unexpected'));
  assert.throws(() => parseLogin('<html>'), kind('unexpected'));
});

test('balance accepts numbers and formatted strings', () => {
  assert.equal(parseBalance({ data: { available_balance: 340.5 } }), 340.5);
  assert.equal(parseBalance({ data: { available_balance: '1,240.00' } }), 1240);
  assert.equal(parseBalance({ data: { available_balance: '-20' } }), -20);
});

test('missing balance throws instead of becoming 0', () => {
  for (const bad of [{}, { data: {} }, { data: { available_balance: '' } }, { data: { available_balance: 'n/a' } }]) {
    assert.throws(() => parseBalance(bad), kind('unexpected'));
  }
});

test('errors do not leak response values', () => {
  assert.throws(
    () => parseBalance({ data: { account_number: '999888777', plate: 'ABC123' } }),
    (e) => !String(e).includes('999888777') && !String(e).includes('ABC123'),
  );
});

const fixture = (name: string) => new URL(`./fixtures/${name}.json`, import.meta.url);
const captured = existsSync(fixture('checkbalance'));

test('captured real replies parse', { skip: !captured && 'no fixtures yet: run npm run capture:autosweep' }, () => {
  const login = JSON.parse(readFileSync(fixture('login'), 'utf8'));
  const balance = JSON.parse(readFileSync(fixture('checkbalance'), 'utf8'));
  assert.ok(parseLogin(login).accountNumber);
  assert.ok(Number.isFinite(parseBalance(balance)));
});
