import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { getPageHtml } from '../src/page.js';
import standalone from '../wloc-worker.js';

function browser() {
  const elements = new Map();
  const node = () => ({ value: '', textContent: '', innerHTML: '', disabled: false, style: {}, classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {}, focus() {} });
  const map = { setView() { return this; }, removeLayer() {}, on() {} };
  const marker = { addTo() { return this; }, on() {}, setLatLng() {} };
  const calls = [];
  const context = vm.createContext({
    console, Number, JSON, Math, Date, String, decodeURIComponent, encodeURIComponent,
    setTimeout() {}, clearTimeout() {}, navigator: {}, window: {},
    localStorage: { getItem() { return null; }, setItem() {} },
    document: { getElementById(id) { if (!elements.has(id)) elements.set(id, node()); return elements.get(id); }, querySelectorAll() { return []; }, addEventListener() {} },
    L: { map() { return map; }, marker() { return marker; }, tileLayer() { return { addTo() {} }; } },
    fetch: async (url, options) => { calls.push({ url, options }); return { json: async () => ({}) }; },
  });
  const html = getPageHtml();
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(match => match[1]).filter(Boolean);
  assert.equal(scripts.length, 1);
  vm.runInContext(scripts[0], context, { timeout: 1000 });
  return { context, elements, calls, run: code => vm.runInContext(code, context, { timeout: 1000 }) };
}
test('generated page inline JavaScript parses and runs under DOM/Leaflet stubs', () => {
  const app = browser();
  assert.equal(app.run('typeof parseMapUrl'), 'function');
});
test('page retains no conversion and no link expansion; supports shared formats', () => {
  const app = browser();
  const initial = app.calls.length;
  const parsed = app.run("parseMapUrl('https://maps.apple.com/?coordinate=22.5,113.9')");
  assert.equal(parsed.lat, 22.5);
  assert.equal(parsed.lon, 113.9);
  assert.equal(app.run("parseMapUrl('https://maps.apple/short')"), null);
  assert.equal(app.calls.length, initial);
});
test('page bare-coordinate auto-swap remains', () => {
  const app = browser();
  assert.equal(app.run("parseMapUrl('113.9000,22.5000').lat"), 22.5);
});
test('page parser rejects malformed/out-of-range values without moving marker', () => {
  const app = browser();
  assert.equal(app.run("parseMapUrl('ll=91,120')"), null);
  assert.equal(app.run("parseMapUrl('ll=22.5,113.9oops')"), null);
  assert.equal(app.run('moveTo(NaN, 113.9, 15)'), false);
  assert.equal(app.run('selected'), false);
});
test('page setPos preserves zero and refuses non-finite values', () => {
  const app = browser();
  assert.equal(app.run('setPos(0, 0)'), true);
  assert.equal(app.run('lat'), 0);
  assert.equal(app.run('lon'), 0);
  assert.equal(app.run('setPos(Infinity, 0)'), false);
  assert.equal(app.run('lat'), 0);
});
test('MITM save URL and request fields stay unchanged', async () => {
  const app = browser();
  app.run('setPos(22.5, 113.9)');
  await app.run('save()');
  const call = app.calls.find(call => call.url.includes('?lon='));
  assert.equal(call.url, 'https://gs-loc.apple.com/wloc-settings/save?lon=113.9&lat=22.5&acc=25');
  assert.equal(call.options.method, 'GET');
  assert.equal(call.options.mode, 'cors');
  assert.equal(call.options.cache, 'no-store');
});
test('standalone and modular entrypoint use byte-identical page HTML', async () => {
  const response = await standalone.fetch(new Request('https://worker.example/'));
  assert.equal(await response.text(), getPageHtml());
});
