import { Hono } from "hono/tiny";
import { getPageHtml } from "./page.js";
import { handleParseRequest } from "./api.js";

const app = new Hono();

app.get("/", (c) => c.html(getPageHtml()));
// GET /api/parse?u=<link or coordinates>&format=json&cs=<gcj|none>
app.get("/api/parse", (c) => handleParseRequest(c.req.raw));

app.onError((e, c) => {
  console.error(`${e}`);
  return c.text(`${e}`, 500);
});

export default app;
