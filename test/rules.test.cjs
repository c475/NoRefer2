'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const NoRefer = require('../rules.js');

function rule(overrides) {
  return Object.assign(NoRefer.blankRule(), overrides);
}

test('compile: empty state produces no rules', () => {
  assert.deepEqual(NoRefer.compile({ enabled: true, rules: [] }), []);
  assert.deepEqual(NoRefer.compile(null), []);
});

test('compile: master switch off produces no rules', () => {
  const state = { enabled: false, rules: [rule({ operation: 'remove', header: 'Referer' })] };
  assert.deepEqual(NoRefer.compile(state), []);
});

test('compile: remove rule has no value and hits requestHeaders', () => {
  const [dnr] = NoRefer.compile({ enabled: true, rules: [rule({ operation: 'remove', header: 'Referer' })] });
  assert.equal(dnr.id, 1);
  assert.equal(dnr.action.type, 'modifyHeaders');
  assert.deepEqual(dnr.action.requestHeaders, [{ header: 'Referer', operation: 'remove' }]);
  assert.equal(dnr.action.responseHeaders, undefined);
  assert.equal(dnr.condition.requestDomains, undefined);
  assert.deepEqual(dnr.condition.resourceTypes, NoRefer.RESOURCE_TYPES);
});

test('compile: set rule carries value; response direction hits responseHeaders', () => {
  const [dnr] = NoRefer.compile({
    enabled: true,
    rules: [rule({ direction: 'response', operation: 'set', header: 'X-Test', value: 'yes' })]
  });
  assert.deepEqual(dnr.action.responseHeaders, [{ header: 'X-Test', operation: 'set', value: 'yes' }]);
  assert.equal(dnr.action.requestHeaders, undefined);
});

test('compile: scope maps to requestDomains, initiator kind to initiatorDomains', () => {
  const [a, b] = NoRefer.compile({
    enabled: true,
    rules: [
      rule({ operation: 'remove', header: 'Referer', scope: 'example.com, *.cdn.net' }),
      rule({ operation: 'remove', header: 'Cookie', scope: 'foo.org', scopeKind: 'initiator' })
    ]
  });
  assert.deepEqual(a.condition.requestDomains, ['example.com', 'cdn.net']);
  assert.deepEqual(b.condition.initiatorDomains, ['foo.org']);
  assert.equal(b.condition.requestDomains, undefined);
});

test('compile: urlFilter passthrough', () => {
  const [dnr] = NoRefer.compile({
    enabled: true,
    rules: [rule({ operation: 'remove', header: 'Referer', urlFilter: '||example.com/api/*' })]
  });
  assert.equal(dnr.condition.urlFilter, '||example.com/api/*');
});

test('compile: earlier rules get higher priority, ids are sequential', () => {
  const rules = ['A', 'B', 'C'].map(h => rule({ operation: 'remove', header: h }));
  const compiled = NoRefer.compile({ enabled: true, rules });
  assert.deepEqual(compiled.map(r => r.id), [1, 2, 3]);
  assert.deepEqual(compiled.map(r => r.priority), [3, 2, 1]);
});

test('compile: disabled and incomplete rules are skipped', () => {
  const compiled = NoRefer.compile({
    enabled: true,
    rules: [
      rule({ operation: 'remove', header: 'Keep-Me' }),
      rule({ operation: 'remove', header: 'Referer', enabled: false }),
      rule({ operation: 'set', header: 'X-No-Value', value: '' }),
      rule({ operation: 'set', header: '', value: 'orphan' })
    ]
  });
  assert.equal(compiled.length, 1);
  assert.equal(compiled[0].action.requestHeaders[0].header, 'Keep-Me');
});

test('parseDomains: normalizes urls, wildcards, ports, case', () => {
  assert.deepEqual(
    NoRefer.parseDomains('https://Foo.com/some/path, *.bar.co.uk:8080  baz.io'),
    ['foo.com', 'bar.co.uk', 'baz.io']
  );
  assert.deepEqual(NoRefer.parseDomains(''), []);
  assert.deepEqual(NoRefer.parseDomains(undefined), []);
});

test('matchesHost: exact, subdomain, and everywhere matching', () => {
  const scoped = rule({ operation: 'remove', header: 'Referer', scope: 'example.com' });
  assert.equal(NoRefer.matchesHost(scoped, 'example.com'), true);
  assert.equal(NoRefer.matchesHost(scoped, 'api.example.com'), true);
  assert.equal(NoRefer.matchesHost(scoped, 'notexample.com'), false);
  assert.equal(NoRefer.matchesHost(scoped, 'example.com.evil.net'), false);

  const everywhere = rule({ operation: 'remove', header: 'Referer' });
  assert.equal(NoRefer.matchesHost(everywhere, 'anything.at.all'), true);

  const disabled = rule({ operation: 'remove', header: 'Referer', enabled: false });
  assert.equal(NoRefer.matchesHost(disabled, 'example.com'), false);
});

test('parseLegacy: the v1 README example converts as documented', () => {
  const { rules, skipped } = NoRefer.parseLegacy(
    '#Accept.*: SomeValue\nReferer\nUser-Agent: CoolAgent4000\n#Co.*\n\n'
  );
  assert.equal(rules.length, 2);
  assert.equal(rules[0].operation, 'remove');
  assert.equal(rules[0].header, 'Referer');
  assert.equal(rules[1].operation, 'set');
  assert.equal(rules[1].header, 'User-Agent');
  assert.equal(rules[1].value, 'CoolAgent4000');
  assert.deepEqual(skipped, ['#Accept.*: SomeValue', '#Co.*']);
});

test('parseLegacy: value keeps colons after the first', () => {
  const { rules } = NoRefer.parseLegacy('Referer: https://somegarbagewebsite.com/');
  assert.equal(rules[0].value, 'https://somegarbagewebsite.com/');
});

test('applyState: replaces existing dynamic rules wholesale', async () => {
  let captured = null;
  const fakeApi = {
    declarativeNetRequest: {
      getDynamicRules: () => Promise.resolve([{ id: 7 }, { id: 9 }]),
      updateDynamicRules: (arg) => { captured = arg; return Promise.resolve(); }
    }
  };
  await NoRefer.applyState(fakeApi, {
    enabled: true,
    rules: [rule({ operation: 'remove', header: 'Referer' })]
  });
  assert.deepEqual(captured.removeRuleIds, [7, 9]);
  assert.equal(captured.addRules.length, 1);
});
