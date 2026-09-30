import test from 'node:test';
import assert from 'node:assert/strict';
import { handleParseRequest } from '../src/api.js';
import { parseCoords } from '../src/parse.js';
import standalone from '../wloc-worker.js';

function request(input, options = {}) {
  const params = new URLSearchParams({ u: input, ...options });
  return new Request('https://worker.example/api/parse?' + params);
}
async function noNetwork(operation) {
  const original = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('Unexpected network call'); };
  try { return await operation(); } finally { globalThis.fetch = original; }
}

test('API preserves JSON fields, default plain coordinates, CORS and rounding', () => noNetwork(async () => {
  const response = await handleParseRequest(request('22.12345678,113.98765432', { format: 'json' }));
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /application\/json/);
  assert.equal(response.headers.get('access-control-allow-origin'), '*');
  assert.deepEqual(await response.json(), { lat: 22.123457, lon: 113.987654, name: '' });
}));
test('API preserves text response format', async () => {
  assert.equal(await (await handleParseRequest(request('22.5000,113.9000'))).text(), 'lat=22.5&lon=113.9');
});
test('API keeps cs=none and existing default conversion policy distinct', async () => {
  const input = 'https://maps.apple.com/?ll=22.5,113.9&name=Place';
  const raw = await (await handleParseRequest(request(input, { format: 'json', cs: 'none' }))).json();
  const automatic = await (await handleParseRequest(request(input, { format: 'json' }))).json();
  const forced = await (await handleParseRequest(request('22.5,113.9', { format: 'json', cs: 'gcj' }))).json();
  assert.deepEqual(raw, { lat: 22.5, lon: 113.9, name: 'Place' });
  assert.notEqual(automatic.lat, raw.lat);
  assert.equal(automatic.lat, forced.lat);
  assert.equal(automatic.lon, forced.lon);
  assert.equal(automatic.name, 'Place');
} );
test('API accepts zero coordinates and integer boundaries', async () => {
  for (const value of ['0,0', '90,-180']) assert.equal((await handleParseRequest(request(value))).status, 200);
});
for (const value of ['', 'not coordinates', '91,120', '22,181', '113.9000,22.5000']) {
  test('API 422 contract for invalid input: ' + value, () => noNetwork(async () => {
    const response = await handleParseRequest(request(value, { format: 'json' }));
    assert.equal(response.status, 422);
    assert.equal(response.headers.get('access-control-allow-origin'), '*');
    const body = await response.json();
    assert.deepEqual(Object.keys(body), ['error']);
    assert.equal(typeof body.error, 'string');
  }));
}
test('direct links parse without fetching', () => noNetwork(async () => {
  assert.equal((await parseCoords('分享 https://maps.apple.com/?ll=22.5,113.9')).lat, 22.5);
}));
test('existing relative redirect behavior, entirely mocked', async () => {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push([url, options.redirect]);
    return calls.length === 1
      ? new Response(null, { status: 302, headers: { location: '/next' } })
      : new Response(null, { status: 302, headers: { location: '/place?coordinate=22.5,113.9&name=Place' } });
  };
  try {
    assert.equal((await parseCoords('https://maps.apple/short')).name, 'Place');
    assert.deepEqual(calls, [['https://maps.apple/short', 'manual'], ['https://maps.apple/next', 'manual']]);
  } finally { globalThis.fetch = original; }
});
test('existing five-request cap is documented by deterministic mock', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; return new Response(null, { status: 302, headers: { location: '/loop' } }); };
  try { await assert.rejects(parseCoords('https://maps.apple/loop')); assert.equal(calls, 5); }
  finally { globalThis.fetch = original; }
});
test('HTML body parsing uses shared extraction and range validation', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response('<a href="https://maps.apple.com/?ll=22.5,113.9">Map</a>');
  try { assert.equal((await parseCoords('https://maps.apple/short')).lon, 113.9); }
  finally { globalThis.fetch = original; }
});
test('standalone executes the identical API contract', async () => {
  for (const [value, options] of [
    ['22.5000,113.9000', {}], ['0,0', { format: 'json' }],
    ['https://maps.apple.com/?ll=22.5,113.9', { cs: 'none', format: 'json' }],
    ['https://amap.com/?q=22.5,113.9,Place', { format: 'json' }],
    ['91,120', { format: 'json' }],
  ]) {
    const a = await handleParseRequest(request(value, options));
    const b = await standalone.fetch(request(value, options));
    assert.equal(b.status, a.status);
    assert.deepEqual([...b.headers], [...a.headers]);
    assert.equal(await b.text(), await a.text());
  }
});
test('standalone preserves OPTIONS and page fallback', async () => {
  const options = await standalone.fetch(new Request('https://worker.example/', { method: 'OPTIONS' }));
  assert.equal(options.headers.get('access-control-allow-origin'), '*');
  assert.equal(await options.text(), '');
  const fallback = await standalone.fetch(new Request('https://worker.example/legacy-page'));
  assert.equal(fallback.status, 200);
  assert.match(await fallback.text(), /WLOC/);
});
