/*
 * NoRefer 2 — background.
 * Single writer for declarativeNetRequest dynamic rules: the popup only
 * writes storage; this script compiles storage -> DNR and owns the badge.
 * Runs as a service worker in Chrome and an event page script in Firefox.
 */

/* global NoRefer */
if (typeof importScripts === 'function') importScripts('rules.js');

var api = typeof browser !== 'undefined' ? browser : chrome;

function loadState() {
  return api.storage.local.get({ enabled: true, rules: [] });
}

function sync() {
  return loadState().then(function (state) {
    return NoRefer.applyState(api, state).then(
      function () {
        return { ok: true, at: Date.now(), active: NoRefer.compile(state).length };
      },
      function (err) {
        return { ok: false, at: Date.now(), error: String((err && err.message) || err) };
      }
    );
  }).then(function (status) {
    return api.storage.local.set({ syncStatus: status });
  }).then(refreshBadge);
}

function refreshBadge() {
  return Promise.all([loadState(), api.tabs.query({ active: true })])
    .then(function (results) {
      var state = results[0];
      results[1].forEach(function (tab) {
        var count = 0;
        if (state.enabled !== false && tab.url && /^https?:/.test(tab.url)) {
          var host = new URL(tab.url).hostname;
          count = state.rules.filter(function (r) {
            return NoRefer.matchesHost(r, host);
          }).length;
        }
        api.action.setBadgeText({ tabId: tab.id, text: count ? String(count) : '' });
      });
    })
    .catch(function () { /* tab may be gone */ });
}

api.action.setBadgeBackgroundColor({ color: '#6d5df2' });
if (api.action.setBadgeTextColor) api.action.setBadgeTextColor({ color: '#ffffff' });

api.runtime.onInstalled.addListener(sync);
api.runtime.onStartup.addListener(sync);

api.storage.onChanged.addListener(function (changes, area) {
  if (area !== 'local') return;
  if (!('rules' in changes) && !('enabled' in changes)) return;
  sync();
});

api.tabs.onActivated.addListener(refreshBadge);
api.tabs.onUpdated.addListener(function (tabId, info) {
  if (info.url || info.status === 'complete') refreshBadge();
});

refreshBadge();
