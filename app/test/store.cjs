const fs = require('node:fs');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const path = require('node:path');
const React = require('react');
const { create, act } = require('react-test-renderer');
const babel = require('@babel/core');
global.IS_REACT_ACT_ENVIRONMENT = true;

const events = { 1: { id: 1, bride: 'First', groom: 'Wedding' }, 2: { id: 2, bride: 'Second', groom: 'Wedding' } };
let selected = null, snapshot, hold = false, failSave = false, failGuest = false;
const delayed = [], writes = [];
const mockApi = {
  loadSession: async () => true,
  setToken: async () => {}, setAuthFailHandler: () => {}, wakeServer: () => {},
  setEventId: async id => { selected = id; }, getEventId: () => selected,
  api: async (method, endpoint, body, options = {}) => {
    const id = options.eventId ?? selected ?? 1;
    if (method === 'PUT') {
      writes.push({ id, body });
      if (failSave) throw new Error('Save failed');
      events[id] = { ...events[id], ...body };
      return { event: { ...events[id] } };
    }
    if (method === 'POST' && endpoint === '/api/guests') {
      if (failGuest) throw new Error('Guest save failed');
      return { guests: [{ id: 99, ...body.guests[0] }] };
    }
    let result;
    if (endpoint === '/api/guests') result = { guests: [{ id, name: `Guest ${id}`, status: 'pending', seats: 1 }] };
    else if (endpoint === '/api/event') result = { event: { ...events[id] }, mail: false };
    else if (endpoint === '/api/events') result = { events: Object.values(events) };
    else if (endpoint === '/api/me') result = { user: { name: 'Test' } };
    else result = { ok: true };
    if (hold && id === 1) return new Promise(resolve => delayed.push(() => resolve(result)));
    return result;
  },
};
const code = babel.transformSync(fs.readFileSync(path.join(__dirname, '../src/store.js'), 'utf8'), {
  babelrc: false, configFile: false,
  plugins: ['@babel/plugin-transform-react-jsx', '@babel/plugin-transform-modules-commonjs'],
}).code;
const moduleShim = { exports: {} };
vm.runInNewContext(code, {
  exports: moduleShim.exports, module: moduleShim,
  require: name => name === './api' ? mockApi : name === 'react-native' ? { AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) } } : require(name),
  setTimeout, clearTimeout, setInterval, clearInterval, console,
});
const { StoreProvider, useStore } = moduleShim.exports;
function Probe() { snapshot = useStore(); return null; }

(async () => {
  let renderer;
  try {
    await act(async () => { renderer = create(React.createElement(StoreProvider, null, React.createElement(Probe))); });
    assert.equal(snapshot.wedding.id, 1);
    hold = true;
    let oldRefresh;
    await act(async () => { oldRefresh = snapshot.refresh(); });
    await act(async () => { await snapshot.switchEvent(2); });
    assert.equal(snapshot.wedding.id, 2);
    hold = false;
    await act(async () => { delayed.splice(0).forEach(resolve => resolve()); await oldRefresh; });
    assert.equal(snapshot.wedding.id, 2, 'a stale refresh cannot replace the selected wedding');
    assert.equal(snapshot.guests[0].name, 'Guest 2');
    await act(async () => { snapshot.setWedding(w => ({ ...w, venue: 'Unsaved venue' })); });
    failSave = true;
    await act(async () => { await assert.rejects(snapshot.switchEvent(1), /Save failed/); });
    assert.equal(selected, 2, 'failed save must prevent switching away');
    assert.equal(snapshot.saveStatus, 'error');
    await act(async () => { await snapshot.refresh(); });
    assert.equal(snapshot.wedding.venue, 'Unsaved venue', 'polling must retain failed drafts');
    failSave = false;
    await act(async () => { await snapshot.retrySave(); await snapshot.switchEvent(1); });
    assert.equal(events[2].venue, 'Unsaved venue');
    assert.ok(writes.every(write => write.id === 2), 'writes are pinned to the draft event');
    failGuest = true;
    await act(async () => { await assert.rejects(snapshot.addGuests([{ name: 'Not saved' }]), /Guest save failed/); });
    assert.equal(snapshot.guests.length, 1);
    console.log('Store regression checks passed: stale responses, save retry, wedding isolation, failed guest saves.');
  } finally { if (renderer) await act(async () => renderer.unmount()); }
})().catch(error => { console.error(error); process.exitCode = 1; });
