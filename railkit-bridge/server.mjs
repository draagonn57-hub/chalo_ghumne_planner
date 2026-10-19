/**
 * railkit-bridge/server.mjs
 *
 * Thin HTTP server that wraps the Railkit Node.js SDK and exposes three
 * endpoints for the Python backend to call internally:
 *
 *   GET /trains?from=NDLS&to=BCT
 *       → searchTrainBetweenStations — returns train list with schedule + classes
 *
 *   GET /fare?train=12951&from=NDLS&to=BCT&date=25-10-2026&class=3A&quota=GN
 *       → fareLookup — returns full fare breakdown for one class
 *
 *   GET /availability?train=12951&from=NDLS&to=BCT&date=25-10-2026&class=3A&quota=GN
 *       → getAvailability — returns seat availability + fare breakdown
 *
 * The bridge listens on 127.0.0.1 only (not externally accessible).
 * The API key is read from RAILKIT_API_KEY env var.
 * configure() is called once at startup.
 */

import http from "http";
import { configure, searchTrainBetweenStations, fareLookup, getAvailability } from "railkit";

const PORT       = parseInt(process.env.RAILKIT_BRIDGE_PORT || "7421", 10);
const API_KEY    = process.env.RAILKIT_API_KEY || "";
const BRIDGE_KEY = process.env.RAILKIT_BRIDGE_SECRET || "";   // optional internal auth

if (!API_KEY) {
  console.error("[railkit-bridge] RAILKIT_API_KEY is not set — exiting");
  process.exit(1);
}

configure(API_KEY);
console.log(`[railkit-bridge] Railkit SDK configured. Listening on 127.0.0.1:${PORT}`);

// ── helpers ──────────────────────────────────────────────────────────────────

function parseQuery(url) {
  const idx = url.indexOf("?");
  if (idx === -1) return {};
  const params = {};
  for (const [k, v] of new URLSearchParams(url.slice(idx + 1))) params[k] = v;
  return params;
}

function send(res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(json),
  });
  res.end(json);
}

// ── server ───────────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  // Optional internal auth header
  if (BRIDGE_KEY && req.headers["x-bridge-key"] !== BRIDGE_KEY) {
    return send(res, 401, { success: false, error: "Unauthorized" });
  }

  const path = req.url.split("?")[0];
  const q    = parseQuery(req.url);

  try {
    // ── GET /trains ──────────────────────────────────────────────────────────
    if (req.method === "GET" && path === "/trains") {
      const { from, to } = q;
      if (!from || !to) return send(res, 400, { success: false, error: "from and to are required" });

      const result = await searchTrainBetweenStations(from.toUpperCase(), to.toUpperCase());
      return send(res, 200, result);
    }

    // ── GET /fare ────────────────────────────────────────────────────────────
    if (req.method === "GET" && path === "/fare") {
      const { train, from, to, date, class: cls, quota } = q;
      if (!train || !from || !to || !date || !cls) {
        return send(res, 400, { success: false, error: "train, from, to, date, class are required" });
      }
      const result = await fareLookup(
        train, from.toUpperCase(), to.toUpperCase(), date, cls.toUpperCase(), (quota || "GN").toUpperCase()
      );
      return send(res, 200, result);
    }

    // ── GET /availability ────────────────────────────────────────────────────
    if (req.method === "GET" && path === "/availability") {
      const { train, from, to, date, class: cls, quota } = q;
      if (!train || !from || !to || !date || !cls) {
        return send(res, 400, { success: false, error: "train, from, to, date, class are required" });
      }
      const result = await getAvailability(
        train, from.toUpperCase(), to.toUpperCase(), date, cls.toUpperCase(), (quota || "GN").toUpperCase()
      );
      return send(res, 200, result);
    }

    // ── GET /health ──────────────────────────────────────────────────────────
    if (req.method === "GET" && path === "/health") {
      return send(res, 200, { success: true, status: "ok" });
    }

    return send(res, 404, { success: false, error: "Not found" });

  } catch (err) {
    console.error("[railkit-bridge] Unhandled error:", err?.message || err);
    return send(res, 500, { success: false, error: err?.message || "Internal error" });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[railkit-bridge] Ready at http://127.0.0.1:${PORT}`);
});

server.on("error", (err) => {
  console.error("[railkit-bridge] Server error:", err.message);
  process.exit(1);
});
