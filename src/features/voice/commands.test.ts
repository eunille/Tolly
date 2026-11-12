import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hearWake, parseCommand } from './commands.ts';

test('wake word and its usual mishearings', () => {
  for (const s of ['Tolly', 'hey tolly', 'Hey Tali', 'okay tollie', 'Polly', 'TOLLEY!']) assert.ok(hearWake(s).wake, s);
  for (const s of ['total', 'toll gate', 'hello', 'Italy', 'stolly']) assert.ok(!hearWake(s).wake, s);
});

test('wake + command in one breath keeps the rest', () => {
  const w = hearWake('hey Tolly check my balance');
  assert.ok(w.wake);
  assert.equal(parseCommand(w.rest), 'balances');
  assert.equal(parseCommand(hearWake('Tolly').rest), null);
});

test('commands, with stop winning', () => {
  assert.equal(parseCommand('how much is left'), 'balances');
  assert.equal(parseCommand('yes please'), 'balances');
  assert.equal(parseCommand('sige'), 'balances');
  assert.equal(parseCommand('open settings'), 'settings');
  assert.equal(parseCommand('stop'), 'stop');
  assert.equal(parseCommand('no stop reading the balance'), 'stop');
  assert.equal(parseCommand('what is the weather'), null);
});
