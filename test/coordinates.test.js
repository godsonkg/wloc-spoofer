import test from 'node:test';
import assert from 'node:assert/strict';
import { createCoordinateParser, extractFromString, validateCoords, safeDecode } from '../src/coordinates.js';
import { gcj02ToWgs84, wgs84ToGcj02 } from '../src/parse.js';

for (const [input, expected] of [
  ['22.5000,113.9000', { lat: 22.5, lon: 113.9, name: '', src: 'text' }],
  ['-33.8,151.2', { lat: -33.8, lon: 151.2, name: '', src: 'text' }],
  ['0,0', { lat: 0, lon: 0, name: '', src: 'text' }],
  ['90,-180', { lat: 90, lon: -180, name: '', src: 'text' }],
  ['-.5,+.25', { lat: -.5, lon: .25, name: '', src: 'text' }],
  ['22.5 113.9', { lat: 22.5, lon: 113.9, name: '', src: 'text' }],
  ['https://maps.apple.com/place?coordinate=22.5%2C113.9&name=%E5%B9%BF%E5%9C%BA', { lat: 22.5, lon: 113.9, name: '广场', src: 'apple' }],
  ['https://maps.apple.com/?ll=22.5,113.9&name=Town+Hall', { lat: 22.5, lon: 113.9, name: 'Town Hall', src: 'apple' }],
  ['https://maps.apple.com/?sll=-33.8,151.2', { lat: -33.8, lon: 151.2, name: '', src: 'apple' }],
  ['https://uri.amap.com/marker?p=B001,22.5,113.9,地点,城市', { lat: 22.5, lon: 113.9, name: '地点', src: 'amap' }],
  ['https://uri.amap.com/marker?p=B001%2C22.5%2C113.9%2C地点%2C城市', { lat: 22.5, lon: 113.9, name: '地点', src: 'amap' }],
  ['https://amap.com/?q=22.5%2c113.9%2cTown+Hall', { lat: 22.5, lon: 113.9, name: 'Town Hall', src: 'amap' }],
  ['https://google.com/maps/@22.5,113.9,15z', { lat: 22.5, lon: 113.9, name: '', src: 'text' }],
  ['https://example.test/?lnglat=113.9,22.5', { lat: 22.5, lon: 113.9, name: '', src: 'text' }],
  ['https://example.test/?location=113.9,22.5', { lat: 22.5, lon: 113.9, name: '', src: 'text' }],
  ['center=113.9%2C22.5', { lat: 22.5, lon: 113.9, name: '', src: 'text' }],
]) test('direct parser: ' + input, () => assert.deepEqual(extractFromString(input), expected));

for (const input of ['', 'no coordinates', '--22.5,113.9', '1e2,2', 'NaN,Infinity', 'll=22.5,113.9oops', 'll=22.5.1,113.9']) {
  test('malformed input is not partially parsed: ' + input, () => assert.equal(extractFromString(input), null));
}
for (const input of ['91,0', '0,181', '-91,0', '0,-181', '9999.0,0', 'll=22.5,999', 'q=91,120,name']) {
  test('out-of-range is rejected: ' + input, () => assert.throws(() => extractFromString(input), /无效经纬度/));
}
for (const [lat, lon] of [[NaN, 0], [0, Infinity], [-Infinity, 0], ['22', 113], [null, 0]]) {
  test('validation rejects non-finite/non-number: ' + JSON.stringify([lat, lon]), () => assert.throws(() => validateCoords(lat, lon)));
}
test('page auto-swap remains explicit; API remains latitude first', () => {
  assert.deepEqual(extractFromString('113.9000,22.5000', { plainOrder: 'auto' }), { lat: 22.5, lon: 113.9, name: '', src: 'text' });
  assert.throws(() => extractFromString('113.9000,22.5000'));
  assert.equal(extractFromString('45,60', { plainOrder: 'auto' }).lat, 45);
  assert.equal(extractFromString('-120,-33', { plainOrder: 'auto' }).lon, -120);
});
test('factory can run without module scope', () => {
  const isolated = new Function('return (' + createCoordinateParser.toString() + ')()')();
  assert.deepEqual(isolated.extractFromString('22.5,113.9'), extractFromString('22.5,113.9'));
});
test('safeDecode handles malformed percent data without crashing', () => {
  assert.equal(safeDecode('%E0%A4%A'), '%E0%A4%A');
  assert.equal(safeDecode('Town+Hall'), 'Town Hall');
});
test('existing conversion is reversible for reference mainland coordinate', () => {
  const raw = { lat: 22.5, lon: 113.9 };
  const shifted = wgs84ToGcj02(raw.lat, raw.lon);
  const result = gcj02ToWgs84(shifted.lat, shifted.lon);
  assert.ok(Math.abs(result.lat - raw.lat) < 1e-8);
  assert.ok(Math.abs(result.lon - raw.lon) < 1e-8);
});
test('outside existing China bounding box conversion is unchanged', () => {
  assert.deepEqual(gcj02ToWgs84(-33.8, 151.2), { lat: -33.8, lon: 151.2 });
});
test('conversion rejects invalid input', () => {
  assert.throws(() => gcj02ToWgs84(NaN, 113));
  assert.throws(() => wgs84ToGcj02(22, 181));
});
