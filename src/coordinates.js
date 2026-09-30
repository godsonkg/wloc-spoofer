// Self-contained so the browser and the API execute the same direct parser.
// This factory must not depend on module-local variables (it is embedded in HTML).
export function createCoordinateParser() {
  const number = '[+-]?(?:\\d+(?:\\.\\d+)?|\\.\\d+)';
  const numeric = new RegExp('^' + number + '$');

  function safeDecode(value) {
    if (!value) return '';
    try { return decodeURIComponent(String(value).replace(/\+/g, ' ')); }
    catch { return String(value); }
  }

  function validateCoords(lat, lon) {
    if (!Number.isFinite(lat) || !Number.isFinite(lon) ||
        lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      throw new Error('无效经纬度：纬度须在 -90 到 90，经度须在 -180 到 180');
    }
    return { lat, lon };
  }

  function parameter(str, names) {
    const hit = str.match(new RegExp('(?:^|[?&\\s"\'<>])(?:' + names + ')=([^&#\\s"\'<>]*)', 'i'));
    return hit ? safeDecode(hit[1]) : null;
  }

  function pair(parts, source, name = '', reverse = false) {
    if (parts.length < 2 || !numeric.test(parts[0].trim()) || !numeric.test(parts[1].trim())) return null;
    const a = Number(parts[0]), b = Number(parts[1]);
    const { lat, lon } = validateCoords(reverse ? b : a, reverse ? a : b);
    return { lat, lon, name, src: source };
  }

  function extractFromString(value, options = {}) {
    if (!value) return null;
    const str = String(value);
    let valuePart = parameter(str, 'coordinate|ll|sll');
    if (valuePart !== null) {
      const hit = pair(valuePart.split(','), 'apple', parameter(str, 'name') || '');
      if (hit) return hit;
    }
    valuePart = parameter(str, 'p');
    if (valuePart !== null) {
      const parts = valuePart.split(',');
      const hit = pair(parts.slice(1), 'amap', parts[3] || '');
      if (hit) return hit;
    }
    valuePart = parameter(str, 'q');
    if (valuePart !== null) {
      const parts = valuePart.split(',');
      const hit = pair(parts, 'amap', parts[2] || '');
      if (hit) return hit;
    }
    // Existing webpage formats: @ uses latitude first, these keys longitude first.
    valuePart = parameter(str, 'lnglat|location|center');
    if (valuePart !== null) {
      const hit = pair(valuePart.split(','), 'text', '', true);
      if (hit) return hit;
    }
    const at = str.match(new RegExp('@(' + number + '),(' + number + ')(?=$|[,/\\s?#"\'<>])'));
    if (at) return pair([at[1], at[2]], 'text');

    // Do not match numeric substrings inside malformed numbers, exponents or names.
    const plain = str.match(new RegExp('(?:^|[^\\w.+-])(' + number + ')\\s*(?:,|%2c|\\s+)\\s*(' + number + ')(?![\\w.+-])', 'i'));
    if (!plain) return null;
    const a = Number(plain[1]), b = Number(plain[2]);
    // Retain the webpage's unambiguous longitude-first convenience. The API's
    // default stays latitude-first; no guessing when both values fit latitude.
    const reverse = options.plainOrder === 'auto' && Math.abs(a) > 90 && Math.abs(b) <= 90;
    return pair([plain[1], plain[2]], 'text', '', reverse);
  }

  return { safeDecode, validateCoords, extractFromString };
}

export const { safeDecode, validateCoords, extractFromString } = createCoordinateParser();
