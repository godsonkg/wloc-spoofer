import { parseCoords, gcj02ToWgs84, round6, validateCoords } from "./parse.js";

// One response contract for Workers, Pages, and the generated standalone Worker.
// Keep the existing API's conversion policy; it is not a provider/datum guarantee.
export async function handleParseRequest(request) {
  const params = new URL(request.url).searchParams;
  const cs = (params.get('cs') || '').toLowerCase();
  const format = (params.get('format') || '').toLowerCase();
  const headers = { 'Access-Control-Allow-Origin': '*' };
  try {
    let { lat, lon, name, src } = await parseCoords(params.get('u') || '');
    const needConv = cs === 'gcj' || (cs !== 'none' && (src === 'amap' || src === 'apple'));
    if (needConv) ({ lat, lon } = gcj02ToWgs84(lat, lon));
    lat = round6(lat);
    lon = round6(lon);
    validateCoords(lat, lon);
    name = name || '';
    if (format === 'json') {
      return new Response(JSON.stringify({ lat, lon, name }), {
        headers: { ...headers, 'Content-Type': 'application/json; charset=UTF-8' },
      });
    }
    return new Response(`lat=${lat}&lon=${lon}`, {
      headers: { ...headers, 'Content-Type': 'text/plain; charset=UTF-8' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error && error.message ? error.message : error) }), {
      status: 422,
      headers: { ...headers, 'Content-Type': 'application/json; charset=UTF-8' },
    });
  }
}
