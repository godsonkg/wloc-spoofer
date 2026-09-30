import { getPageHtml } from "./page.js";
import { handleParseRequest } from "./api.js";

// Preserve the standalone Worker's legacy page fallback and OPTIONS response.
// Its new API route executes exactly the same handler as Workers/Pages.
export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*' } });
    }
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/api/parse') {
      return handleParseRequest(request);
    }
    return new Response(getPageHtml(), {
      headers: { 'Content-Type': 'text/html;charset=utf-8', 'Cache-Control': 'no-cache' },
    });
  },
};
