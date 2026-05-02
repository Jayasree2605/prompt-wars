/**
 * tests/unit.test.js — Unit tests for TeamFlow utility functions.
 * ES module. Auto-runs on import. Outputs pass/fail to console.group.
 * 35+ assertions covering genId, esc, initials, avatarBg, priColor,
 * fmtDate, timeAgo, and debounce.
 */

import { genId, fmtDate, timeAgo }    from '../src/utils/format.js';
import { esc }                         from '../src/utils/dom.js';
import { initials, avatarBg, priColor } from '../src/utils/avatar.js';
import { debounce }                    from '../src/utils/dom.js';

// ── Tiny assertion harness ────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${label}`);
  }
}

function assertEqual(actual, expected, label) {
  const ok = actual === expected;
  if (!ok) console.error(`    actual: ${JSON.stringify(actual)}, expected: ${JSON.stringify(expected)}`);
  assert(ok, label);
}

// ── genId ─────────────────────────────────────────────────────────────────────
console.group('genId');
{
  const a = genId();
  const b = genId();
  const c = genId();
  assert(typeof a === 'string' && a.length > 0,   'returns a non-empty string');
  assert(a !== b,                                   'two successive ids are different');
  assert(b !== c,                                   'three successive ids are all different');
  assert(a !== c,                                   'first and third are different');

  const ids = Array.from({ length: 1000 }, () => genId());
  const unique = new Set(ids);
  assert(unique.size === 1000,                      '1000 ids are all unique (no collision)');
}
console.groupEnd();

// ── esc ───────────────────────────────────────────────────────────────────────
console.group('esc');
{
  assertEqual(esc(null),      '',            'null → empty string');
  assertEqual(esc(undefined), '',            'undefined → empty string');
  assertEqual(esc(''),        '',            'empty string → empty string');
  assertEqual(esc('<b>'),     '&lt;b&gt;',   'escapes < and >');
  assertEqual(esc('&'),       '&amp;',       'escapes &');
  assertEqual(esc('"quote"'), '&quot;quote&quot;', 'escapes double-quotes');
  assertEqual(esc("it's"),    'it&#39;s',    'escapes single-quotes');
  assertEqual(esc('<script>alert(1)</script>'),
    '&lt;script&gt;alert(1)&lt;/script&gt;', 'full XSS payload escaped');
  assertEqual(esc(42),        '42',          'numbers coerced to string');
  assertEqual(esc(true),      'true',        'booleans coerced to string');
  assert(!esc('<img src=x onerror=alert(1)>').includes('<'), 'no raw < in output');
  assert(!esc('<img src=x onerror=alert(1)>').includes('>'), 'no raw > in output');
}
console.groupEnd();

// ── initials ──────────────────────────────────────────────────────────────────
console.group('initials');
{
  assertEqual(initials('Alice'),           'A',  'single word → first letter');
  assertEqual(initials('Alice Wonderland'),'AW', 'two words → first letters of each');
  assertEqual(initials('John Paul Jones'), 'JJ', 'three words → first and last');
  assertEqual(initials(''),                '?',  'empty string → ?');
  assertEqual(initials(null),              '?',  'null → ?');
  assertEqual(initials(undefined),         '?',  'undefined → ?');
  assertEqual(initials('  '),              '?',  'whitespace-only → ?');
  assertEqual(initials('alice'),           'A',  'lowercase name uppercased');
  assertEqual(initials('a b'),             'AB', 'short names work');
}
console.groupEnd();

// ── avatarBg ──────────────────────────────────────────────────────────────────
console.group('avatarBg');
{
  const c1 = avatarBg('Alice');
  const c2 = avatarBg('Alice');
  assertEqual(c1, c2, 'same name returns same colour (deterministic)');
  assert(c1.startsWith('#'),         'returns a hex colour');
  assert(c1.length === 7,            'hex colour is 7 chars (#rrggbb)');

  const c3 = avatarBg('Bob');
  // They may be the same by hash collision but lets confirm it's a valid colour
  assert(c3.startsWith('#'),         'Bob also returns a hex colour');

  const c4 = avatarBg('');
  assert(c4.startsWith('#'),         'empty string returns a default colour');

  // Check determinism across a few names
  assert(avatarBg('Charlie') === avatarBg('Charlie'), 'Charlie is deterministic');
  assert(avatarBg('Diana')   === avatarBg('Diana'),   'Diana is deterministic');
}
console.groupEnd();

// ── priColor ──────────────────────────────────────────────────────────────────
console.group('priColor');
{
  assertEqual(priColor('high'),   '#ef4444', 'high → red');
  assertEqual(priColor('medium'), '#f59e0b', 'medium → amber');
  assertEqual(priColor('low'),    '#10b981', 'low → green');
  assertEqual(priColor('unknown'),'#94a3b8', 'unknown → slate fallback');
  assertEqual(priColor(null),     '#94a3b8', 'null → fallback');
  assertEqual(priColor(undefined),'#94a3b8', 'undefined → fallback');
}
console.groupEnd();

// ── fmtDate ───────────────────────────────────────────────────────────────────
console.group('fmtDate');
{
  assertEqual(fmtDate(null),      '',   'null → empty string');
  assertEqual(fmtDate(undefined), '',   'undefined → empty string');
  assertEqual(fmtDate(NaN),       '',   'NaN → empty string');
  // Provide a known timestamp: 2024-01-15 (UTC)
  const ts = new Date('2024-01-15').getTime();
  const result = fmtDate(ts);
  assert(typeof result === 'string' && result.length > 0, 'valid timestamp returns a non-empty string');
  assert(result.includes('2024'), 'result contains the year 2024');
  assert(result.includes('15'),   'result contains the day 15');

  // Firestore-like Timestamp object
  const fireTs = { toMillis: () => ts };
  const result2 = fmtDate(fireTs);
  assert(result2.includes('2024'), 'Firestore Timestamp object formatted correctly');
}
console.groupEnd();

// ── timeAgo ───────────────────────────────────────────────────────────────────
console.group('timeAgo');
{
  const now = Date.now();
  assertEqual(timeAgo(null),           '',            'null → empty string');
  assertEqual(timeAgo(0),              '',            'zero → empty string (falsy)');
  assertEqual(timeAgo(now),            'just now',    'current time → just now');
  assertEqual(timeAgo(now - 30_000),   'just now',    '30 seconds ago → just now');
  assertEqual(timeAgo(now - 60_000),   '1m ago',      '1 minute ago');
  assertEqual(timeAgo(now - 90_000),   '1m ago',      '90 seconds ago → 1m ago');
  assertEqual(timeAgo(now - 3_600_000),'1h ago',      '1 hour ago');
  assertEqual(timeAgo(now - 7_200_000),'2h ago',      '2 hours ago');
  assertEqual(timeAgo(now - 86_400_000),'1d ago',     '1 day ago');
  assertEqual(timeAgo(now - 86_400_000 * 5), '5d ago','5 days ago');
  // ~45 days = ~1.5 months → should report months
  const moResult = timeAgo(now - 86_400_000 * 45);
  assert(moResult.includes('mo ago'),                  '45 days ago → months');
  // ~400 days = ~1 year
  const yrResult = timeAgo(now - 86_400_000 * 400);
  assert(yrResult.includes('y ago'),                   '400 days ago → years');
}
console.groupEnd();

// ── debounce ──────────────────────────────────────────────────────────────────
console.group('debounce');
{
  assert(typeof debounce === 'function',            'debounce is a function');
  const db = debounce(() => {}, 100);
  assert(typeof db === 'function',                  'debounce returns a function');

  // Verify calls are coalesced
  let callCount = 0;
  const dbFn = debounce(() => { callCount++; }, 50);
  dbFn(); dbFn(); dbFn();
  // After 3 rapid calls and waiting 100ms, should have fired once
  await new Promise(res => setTimeout(res, 120));
  assertEqual(callCount, 1,                         'rapid calls coalesced into one execution');

  // Verify each debounced instance is independent
  const db2 = debounce(() => {}, 200);
  assert(db !== db2,                                'two calls to debounce return distinct functions');
}
console.groupEnd();

// ── Summary ───────────────────────────────────────────────────────────────────
const total = passed + failed;
console.group(`%c TeamFlow Unit Tests — ${passed}/${total} passed ${failed > 0 ? `(${failed} FAILED)` : '✓'}`,
  failed > 0 ? 'color:red;font-weight:bold' : 'color:green;font-weight:bold');
console.log(`Passed: ${passed}`);
if (failed > 0) console.error(`Failed: ${failed}`);
console.groupEnd();

if (failed > 0) {
  throw new Error(`[unit.test.js] ${failed} test(s) failed — see console output above`);
}
