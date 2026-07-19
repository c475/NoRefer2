/*
 * NoRefer 2 — shared rule engine.
 *
 * Loaded by both the popup (script tag) and the background
 * (importScripts in Chrome's service worker, background.scripts in
 * Firefox), and by the node test suite via require().
 */
(function (root) {
  'use strict';

  // Resource types supported by both Chrome and Firefox DNR.
  var RESOURCE_TYPES = [
    'main_frame', 'sub_frame', 'stylesheet', 'script', 'image', 'font',
    'object', 'xmlhttprequest', 'ping', 'csp_report', 'media', 'websocket',
    'other'
  ];

  var DEFAULT_STATE = { enabled: true, rules: [] };

  function blankRule() {
    return {
      enabled: true,
      direction: 'request',   // request | response
      operation: 'set',       // set | remove | append
      header: '',
      value: '',
      scope: '',              // "example.com, *.cdn.net" — empty = everywhere
      scopeKind: 'request',   // request (target host) | initiator (page host)
      urlFilter: ''
    };
  }

  // "https://Foo.com/x, *.bar.co.uk:8080" -> ["foo.com", "bar.co.uk"]
  function parseDomains(scope) {
    return String(scope || '')
      .split(/[,\s]+/)
      .map(function (d) {
        d = d.trim().toLowerCase();
        d = d.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');
        d = d.split('/')[0];
        d = d.replace(/^\*\.?/, '');
        d = d.split(':')[0];
        return d.replace(/^\.+|\.+$/g, '');
      })
      .filter(Boolean);
  }

  // A rule that is enabled and complete enough to compile.
  function ruleReady(r) {
    if (!r || r.enabled === false) return false;
    if (!String(r.header || '').trim()) return false;
    if (r.operation !== 'remove' && String(r.value || '') === '') return false;
    return true;
  }

  // State -> array of declarativeNetRequest dynamic rules.
  // Rules earlier in the list get higher priority, so for conflicting
  // edits of the same header the top-most rule wins.
  function compile(state) {
    if (!state || state.enabled === false) return [];
    var active = (state.rules || []).filter(ruleReady);

    return active.map(function (r, i) {
      var headerInfo = {
        header: String(r.header).trim(),
        operation: r.operation
      };
      if (r.operation !== 'remove') headerInfo.value = String(r.value);

      var action = { type: 'modifyHeaders' };
      if (r.direction === 'response') action.responseHeaders = [headerInfo];
      else action.requestHeaders = [headerInfo];

      var condition = { resourceTypes: RESOURCE_TYPES.slice() };
      var domains = parseDomains(r.scope);
      if (domains.length) {
        if (r.scopeKind === 'initiator') condition.initiatorDomains = domains;
        else condition.requestDomains = domains;
      }
      var urlFilter = String(r.urlFilter || '').trim();
      if (urlFilter) condition.urlFilter = urlFilter;

      return {
        id: i + 1,
        priority: active.length - i,
        action: action,
        condition: condition
      };
    });
  }

  // Badge helper: does this (ready) rule apply on a tab whose host is `host`?
  // For initiator-scoped rules the tab host is the initiator, so the same
  // suffix match is the right approximation for both scope kinds.
  function matchesHost(rule, host) {
    if (!ruleReady(rule)) return false;
    var domains = parseDomains(rule.scope);
    if (!domains.length) return true;
    host = String(host || '').toLowerCase();
    return domains.some(function (d) {
      return host === d || host.slice(-(d.length + 1)) === '.' + d;
    });
  }

  // Parse a NoRefer v1 textarea config.
  //   Header            -> remove rule
  //   Header: value     -> set rule
  //   #regex[: value]   -> not expressible in DNR; reported in `skipped`
  function parseLegacy(text) {
    var rules = [];
    var skipped = [];
    String(text || '').split('\n').forEach(function (line) {
      line = line.trim();
      if (!line) return;
      if (line[0] === '#') { skipped.push(line); return; }
      var rule = blankRule();
      var idx = line.indexOf(':');
      if (idx !== -1) {
        rule.operation = 'set';
        rule.header = line.slice(0, idx).trim();
        rule.value = line.slice(idx + 1).trim();
      } else {
        rule.operation = 'remove';
        rule.header = line;
      }
      if (rule.header) rules.push(rule);
    });
    return { rules: rules, skipped: skipped };
  }

  // Replace all dynamic DNR rules with the compiled state.
  function applyState(api, state) {
    return api.declarativeNetRequest.getDynamicRules().then(function (existing) {
      return api.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: existing.map(function (r) { return r.id; }),
        addRules: compile(state)
      });
    });
  }

  var NoRefer = {
    RESOURCE_TYPES: RESOURCE_TYPES,
    DEFAULT_STATE: DEFAULT_STATE,
    blankRule: blankRule,
    parseDomains: parseDomains,
    ruleReady: ruleReady,
    compile: compile,
    matchesHost: matchesHost,
    parseLegacy: parseLegacy,
    applyState: applyState
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = NoRefer;
  root.NoRefer = NoRefer;
})(typeof globalThis !== 'undefined' ? globalThis : this);
