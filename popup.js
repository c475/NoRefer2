/*
 * NoRefer 2 — popup UI.
 * The popup is the single editor for rule state. It only writes
 * chrome.storage; the background script owns compiling state into
 * declarativeNetRequest rules and reports back via `syncStatus`.
 *
 * Opened outside an extension context (plain file/http), it runs in a
 * demo mode with seeded rules and in-memory storage, which keeps the UI
 * previewable and screenshot-able without a browser extension harness.
 */

/* global NoRefer */
(function () {
  'use strict';

  var hasExt = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;

  var api = hasExt
    ? (typeof browser !== 'undefined' ? browser : chrome)
    : demoApi();

  function demoApi() {
    var demo = {
      enabled: true,
      rules: [
        Object.assign(NoRefer.blankRule(), {
          operation: 'remove', header: 'Referer'
        }),
        Object.assign(NoRefer.blankRule(), {
          header: 'User-Agent', value: 'CoolAgent4000', scope: 'example.com'
        }),
        Object.assign(NoRefer.blankRule(), {
          direction: 'response', operation: 'set',
          header: 'Access-Control-Allow-Origin', value: '*',
          scope: 'localhost', enabled: false
        })
      ]
    };
    return {
      storage: {
        local: {
          get: function (defaults) {
            return Promise.resolve(Object.assign({}, defaults, demo));
          },
          set: function (obj) {
            Object.assign(demo, obj);
            return Promise.resolve();
          }
        },
        onChanged: { addListener: function () {} }
      },
      tabs: { create: function (o) { window.open(o.url); return Promise.resolve(); } },
      runtime: { getURL: function (p) { return p; } }
    };
  }

  var state = { enabled: true, rules: [] };

  var els = {
    ruleList: document.getElementById('ruleList'),
    empty: document.getElementById('empty'),
    masterToggle: document.getElementById('masterToggle'),
    activeCount: document.getElementById('activeCount'),
    addRule: document.getElementById('addRule'),
    presetsBtn: document.getElementById('presetsBtn'),
    presetsMenu: document.getElementById('presetsMenu'),
    ioBtn: document.getElementById('ioBtn'),
    ioMenu: document.getElementById('ioMenu'),
    importJson: document.getElementById('importJson'),
    importLegacy: document.getElementById('importLegacy'),
    exportJson: document.getElementById('exportJson'),
    helpBtn: document.getElementById('helpBtn'),
    help: document.getElementById('help'),
    openTab: document.getElementById('openTab'),
    legacyDialog: document.getElementById('legacyDialog'),
    legacyText: document.getElementById('legacyText'),
    legacyImport: document.getElementById('legacyImport'),
    legacyCancel: document.getElementById('legacyCancel'),
    filePicker: document.getElementById('filePicker'),
    toast: document.getElementById('toast')
  };

  var PRESETS = [
    {
      label: 'Strip Referer everywhere',
      rule: { operation: 'remove', header: 'Referer' }
    },
    {
      label: 'Send DNT + Sec-GPC signals',
      rules: [
        { operation: 'set', header: 'DNT', value: '1' },
        { operation: 'set', header: 'Sec-GPC', value: '1' }
      ]
    },
    {
      label: 'Spoof User-Agent on a site…',
      rule: { operation: 'set', header: 'User-Agent', value: 'CoolAgent4000', scope: 'example.com', enabled: false }
    },
    {
      label: 'Drop CSP on a dev site…',
      rule: { direction: 'response', operation: 'remove', header: 'Content-Security-Policy', scope: 'example.com', enabled: false }
    },
    {
      label: 'CORS-unlock a dev site…',
      rule: { direction: 'response', operation: 'set', header: 'Access-Control-Allow-Origin', value: '*', scope: 'localhost', enabled: false }
    }
  ];

  /* ---------- persistence ---------- */

  var persistTimer = null;

  function persist() {
    clearTimeout(persistTimer);
    persistTimer = setTimeout(function () {
      api.storage.local.set({ enabled: state.enabled, rules: state.rules });
    }, 200);
    updateChrome();
  }

  function updateChrome() {
    var active = NoRefer.compile(state).length;
    els.activeCount.textContent = active ? active + ' active' : '';
    els.masterToggle.checked = state.enabled !== false;
    document.querySelectorAll('.rule').forEach(function (card, i) {
      var r = state.rules[i];
      if (!r) return;
      card.classList.toggle('off', r.enabled === false || state.enabled === false);
      card.classList.toggle('op-remove', r.operation === 'remove');
    });
  }

  /* ---------- rendering ---------- */

  function render() {
    els.ruleList.textContent = '';
    state.rules.forEach(function (rule, i) {
      els.ruleList.appendChild(ruleCard(rule, i));
    });
    els.empty.hidden = state.rules.length > 0;
    updateChrome();
  }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'class') node.className = attrs[k];
      else if (k === 'text') node.textContent = attrs[k];
      else node.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { node.appendChild(c); });
    return node;
  }

  function select(key, idx, options, value) {
    var s = el('select', { 'data-k': key, 'data-idx': idx });
    options.forEach(function (o) {
      var opt = el('option', { value: o[0], text: o[1] });
      if (o[0] === value) opt.selected = true;
      s.appendChild(opt);
    });
    return s;
  }

  function ruleCard(rule, idx) {
    var enable = el('label', { class: 'switch', title: 'Enable rule' }, [
      el('input', { type: 'checkbox', 'data-k': 'enabled', 'data-idx': idx }),
      el('span', { class: 'slider' })
    ]);
    enable.querySelector('input').checked = rule.enabled !== false;

    var header = el('input', {
      type: 'text', class: 'header-input', 'data-k': 'header', 'data-idx': idx,
      list: 'commonHeaders', placeholder: 'Header', spellcheck: 'false', value: rule.header || ''
    });

    var value = el('input', {
      type: 'text', class: 'value-input', 'data-k': 'value', 'data-idx': idx,
      placeholder: 'value', spellcheck: 'false', value: rule.value || ''
    });

    var actions = el('div', { class: 'card-actions' }, [
      el('button', { class: 'icon-btn', 'data-act': 'up', 'data-idx': idx, title: 'Move up (higher priority)', text: '↑' }),
      el('button', { class: 'icon-btn', 'data-act': 'down', 'data-idx': idx, title: 'Move down', text: '↓' }),
      el('button', { class: 'icon-btn' + (rule._adv ? ' adv-on' : ''), 'data-act': 'adv', 'data-idx': idx, title: 'Advanced scoping', text: '⚙' }),
      el('button', { class: 'icon-btn delete', 'data-act': 'del', 'data-idx': idx, title: 'Delete rule', text: '✕' })
    ]);

    var row1 = el('div', { class: 'row1' }, [
      enable,
      select('direction', idx, [['request', 'Request'], ['response', 'Response']], rule.direction),
      select('operation', idx, [['set', 'Set'], ['remove', 'Remove'], ['append', 'Append']], rule.operation),
      header, value, actions
    ]);

    var scope = el('div', { class: 'row2' }, [
      el('input', {
        type: 'text', 'data-k': 'scope', 'data-idx': idx, spellcheck: 'false',
        placeholder: 'everywhere — or scope to: example.com, *.cdn.net',
        value: rule.scope || ''
      })
    ]);

    var adv = el('div', { class: 'row3' }, [
      el('label', { text: 'match ' }, [
        select('scopeKind', idx, [['request', 'target host'], ['initiator', 'page host']], rule.scopeKind || 'request')
      ]),
      el('label', { text: 'URL filter ', style: 'flex:1' }, [
        el('input', {
          type: 'text', 'data-k': 'urlFilter', 'data-idx': idx, spellcheck: 'false',
          placeholder: '||example.com/api/*', value: rule.urlFilter || ''
        })
      ])
    ]);
    adv.hidden = !rule._adv;

    var card = el('div', { class: 'rule', 'data-idx': idx }, [row1, scope, adv]);
    card.classList.toggle('off', rule.enabled === false || state.enabled === false);
    card.classList.toggle('op-remove', rule.operation === 'remove');
    return card;
  }

  /* ---------- events ---------- */

  els.ruleList.addEventListener('input', function (e) {
    var k = e.target.dataset.k;
    var idx = Number(e.target.dataset.idx);
    if (!k || !state.rules[idx]) return;
    var rule = state.rules[idx];
    if (k === 'enabled') rule.enabled = e.target.checked;
    else rule[k] = e.target.value;
    if (k === 'operation' || k === 'enabled') updateChrome();
    persist();
  });

  els.ruleList.addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-act]');
    if (!btn) return;
    var idx = Number(btn.dataset.idx);
    var act = btn.dataset.act;
    if (act === 'del') {
      state.rules.splice(idx, 1);
    } else if (act === 'up' && idx > 0) {
      swap(idx, idx - 1);
    } else if (act === 'down' && idx < state.rules.length - 1) {
      swap(idx, idx + 1);
    } else if (act === 'adv') {
      state.rules[idx]._adv = !state.rules[idx]._adv;
    } else {
      return;
    }
    render();
    persist();
  });

  function swap(a, b) {
    var t = state.rules[a];
    state.rules[a] = state.rules[b];
    state.rules[b] = t;
  }

  els.masterToggle.addEventListener('change', function () {
    state.enabled = els.masterToggle.checked;
    render();
    persist();
  });

  els.addRule.addEventListener('click', function () {
    state.rules.push(NoRefer.blankRule());
    render();
    persist();
    var cards = els.ruleList.querySelectorAll('.header-input');
    if (cards.length) cards[cards.length - 1].focus();
  });

  /* menus */

  function toggleMenu(menu) {
    var wasHidden = menu.hidden;
    closeMenus();
    menu.hidden = !wasHidden;
  }

  function closeMenus() {
    els.presetsMenu.hidden = true;
    els.ioMenu.hidden = true;
  }

  document.addEventListener('click', function (e) {
    if (!e.target.closest('.menu-wrap')) closeMenus();
  });

  els.presetsBtn.addEventListener('click', function () { toggleMenu(els.presetsMenu); });
  els.ioBtn.addEventListener('click', function () { toggleMenu(els.ioMenu); });

  PRESETS.forEach(function (preset) {
    var b = el('button', { text: preset.label });
    b.addEventListener('click', function () {
      var toAdd = preset.rules || [preset.rule];
      toAdd.forEach(function (partial) {
        state.rules.push(Object.assign(NoRefer.blankRule(), partial));
      });
      closeMenus();
      render();
      persist();
      var disabled = toAdd.some(function (r) { return r.enabled === false; });
      toast(disabled
        ? 'Preset added (disabled) — set its domain, then switch it on.'
        : 'Preset added.');
    });
    els.presetsMenu.appendChild(b);
  });
  els.presetsMenu.appendChild(el('div', {
    class: 'menu-note',
    text: 'Presets marked … arrive disabled so you can scope them first.'
  }));

  /* import / export */

  els.exportJson.addEventListener('click', function () {
    closeMenus();
    var payload = {
      app: 'NoRefer 2',
      version: 1,
      enabled: state.enabled,
      rules: state.rules.map(function (r) {
        var c = Object.assign({}, r);
        delete c._adv;
        return c;
      })
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'norefer2-rules.json';
    a.click();
    URL.revokeObjectURL(a.href);
  });

  els.importJson.addEventListener('click', function () {
    closeMenus();
    els.filePicker.click();
  });

  els.filePicker.addEventListener('change', function () {
    var file = els.filePicker.files[0];
    els.filePicker.value = '';
    if (!file) return;
    file.text().then(function (text) {
      var data = JSON.parse(text);
      var rules = Array.isArray(data) ? data : data.rules;
      if (!Array.isArray(rules)) throw new Error('no rules array found');
      var cleaned = rules.map(function (r) {
        return Object.assign(NoRefer.blankRule(), r);
      });
      if (state.rules.length &&
          !window.confirm('Replace your current ' + state.rules.length + ' rule(s)? Cancel appends instead.')) {
        state.rules = state.rules.concat(cleaned);
      } else {
        state.rules = cleaned;
        if (typeof data.enabled === 'boolean') state.enabled = data.enabled;
      }
      render();
      persist();
      toast('Imported ' + cleaned.length + ' rule(s).');
    }).catch(function (err) {
      toast('Import failed: ' + err.message, true);
    });
  });

  els.importLegacy.addEventListener('click', function () {
    closeMenus();
    els.legacyText.value = '';
    els.legacyDialog.showModal();
  });

  els.legacyCancel.addEventListener('click', function () {
    els.legacyDialog.close();
  });

  els.legacyImport.addEventListener('click', function () {
    var parsed = NoRefer.parseLegacy(els.legacyText.value);
    state.rules = state.rules.concat(parsed.rules);
    els.legacyDialog.close();
    render();
    persist();
    var msg = 'Imported ' + parsed.rules.length + ' rule(s).';
    if (parsed.skipped.length) {
      msg += ' Skipped ' + parsed.skipped.length + ' regex line(s): ' +
        parsed.skipped.join(', ');
    }
    toast(msg, parsed.skipped.length > 0);
  });

  /* help + full page */

  els.helpBtn.addEventListener('click', function () {
    els.help.hidden = !els.help.hidden;
    if (!els.help.hidden) els.help.scrollIntoView({ behavior: 'smooth' });
  });

  els.openTab.addEventListener('click', function () {
    api.tabs.create({ url: api.runtime.getURL('popup.html') + '?page=1' });
    if (hasExt) window.close();
  });

  /* ---------- toast + sync status ---------- */

  var toastTimer = null;

  function toast(msg, isError) {
    els.toast.textContent = msg;
    els.toast.className = isError ? 'error' : '';
    els.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { els.toast.hidden = true; }, isError ? 6000 : 2500);
  }

  api.storage.onChanged.addListener(function (changes, area) {
    if (area !== 'local' || !changes.syncStatus) return;
    var status = changes.syncStatus.newValue;
    if (status && status.ok === false) {
      toast('Rules rejected by the browser: ' + status.error, true);
    }
  });

  /* ---------- init ---------- */

  if (new URLSearchParams(location.search).has('page')) {
    document.body.classList.add('page-mode');
  }

  api.storage.local.get({ enabled: true, rules: [] }).then(function (stored) {
    state.enabled = stored.enabled !== false;
    state.rules = stored.rules || [];
    render();
  });
})();
