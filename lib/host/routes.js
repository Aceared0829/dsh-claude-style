// packages/contracts/src/routes.ts
var ROUTE_PREFIX = "/dsh-claude-style";
var USERNAME_PATH = `${ROUTE_PREFIX}/username`;
var HDSL_PATH = `${ROUTE_PREFIX}/hdsl`;
var HDSL_SKIN_PATH = `${ROUTE_PREFIX}/hdsl-skin.png`;
var SESSION_DELETE_PATH = `${ROUTE_PREFIX}/session-delete`;
var USAGE_PATH = `${ROUTE_PREFIX}/usage`;
var SESSION_SEARCH_PATH = `${ROUTE_PREFIX}/session-search`;
var BRAND_PATH = `${ROUTE_PREFIX}/brand`;
var BRAND_MARK_PATH = `${ROUTE_PREFIX}/brand/mark`;
var BRAND_WORDMARK_PATH = `${ROUTE_PREFIX}/brand/wordmark`;
var PEAKRATE_PATH = `${ROUTE_PREFIX}/peakrate`;

// packages/host/src/routes.ts
import { existsSync, readFileSync, readdirSync, realpathSync, rmSync, statSync } from "node:fs";
import { userInfo } from "node:os";
import { join, resolve, sep } from "node:path";
import { brotliDecompressSync } from "node:zlib";
import { brandRoutes } from "./brand.js";
import { harnessPath } from "./harness-home.js";
import { fenceRefused, methodRefused, readRequestBody, refusalOf, sendJson } from "./http.js";
import { createHdslAccount } from "./hdsl.js";
import { packageRoot } from "./package-root.js";
import { createPeakRate } from "./peakrate.js";
import { QUERY_MAX, createSessionSearch } from "./search.js";
import { createUsage } from "./usage.js";
var COPY_FILE = "model-descriptions.json";
var FONT_FILES = {
  "JetBrainsMonoVariable.ttf": "font/ttf",
  "JetBrainsMonoItalicVariable.ttf": "font/ttf",
  "AnthropicSansWebText.ttf": "font/ttf",
  "AnthropicSerifWebText.ttf": "font/ttf",
  "InterVariable.woff2": "font/woff2",
  "NotoSerifVariable.woff2": "font/woff2"
};
var ASSETS_PATH = `${ROUTE_PREFIX}/assets/`;
var ASSETS_MANIFEST = "manifest.json";
var USAGE_TTL_MS = 5 * 60 * 1e3;
var SESSION_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/;
var DELETE_BODY_MAX = 4096;
function sessionIsLive(ctx, sessionId) {
  const sessions = ctx.get("sessions");
  if (sessions === null || sessions === void 0) return false;
  if (typeof sessions.get === "function") {
    const found = sessions.get(sessionId);
    return found !== void 0 && found !== null;
  }
  if (typeof sessions.list === "function") {
    const listed = sessions.list();
    if (Array.isArray(listed)) {
      return listed.some((item) => (typeof item === "string" ? item : item?.id ?? item?.sessionId) === sessionId);
    }
  }
  return true;
}
async function unarchiveSession(ctx, sessionId) {
  const registry = ctx.get("workspaceRegistry");
  if (typeof registry?.unarchiveSession !== "function") return;
  await registry.unarchiveSession(sessionId);
}
async function deleteSession(ctx, req, res) {
  const refused = refusalOf(ctx, req);
  if (refused !== void 0) {
    sendJson(res, refused, { ok: false, error: refused === 401 ? "unauthorized" : "forbidden" });
    return;
  }
  const raw = await readRequestBody(req, DELETE_BODY_MAX);
  if (raw === null) {
    res.once("finish", () => req.destroy());
  }
  let request = null;
  try {
    request = raw === null ? null : JSON.parse(raw.toString("utf8"));
  } catch {
    request = null;
  }
  const sessionId = request !== null && typeof request.sessionId === "string" ? request.sessionId : "";
  if (!SESSION_ID_RE.test(sessionId)) {
    sendJson(res, 400, { ok: false, error: "invalid session id" });
    return;
  }
  if (sessionIsLive(ctx, sessionId)) {
    sendJson(res, 409, { ok: false, error: "session is open" });
    return;
  }
  const root = resolve(harnessPath(ctx, "sessions"));
  let dir = null;
  for (const entry of readdirSync(root)) {
    const candidate = join(root, entry, sessionId);
    if (statSync(candidate, { throwIfNoEntry: false })?.isDirectory() === true) {
      dir = candidate;
      break;
    }
  }
  if (dir === null) {
    await unarchiveSession(ctx, sessionId);
    sendJson(res, 200, { ok: true, ghost: true });
    return;
  }
  const realRoot = realpathSync(root);
  if (!realpathSync(dir).startsWith(realRoot + sep)) {
    sendJson(res, 403, { ok: false, error: "session directory outside the sessions root" });
    return;
  }
  rmSync(dir, { recursive: true, force: true });
  await unarchiveSession(ctx, sessionId);
  sendJson(res, 200, { ok: true, ghost: false });
}
function registerRoutes(ctx, scope) {
  const root = packageRoot();
  const file = join(root, "lib", COPY_FILE);
  const fontsDir = join(root, "lib", "fonts");
  const userFontsDir = () => harnessPath(ctx, "dsh-claude-style", "fonts");
  const assetsDir = join(root, "lib", "assets");
  const unpressed = /* @__PURE__ */ new Map();
  const sendFile = (res, method, path, headers, body = null) => {
    if (body === null && !existsSync(path)) {
      res.writeHead(404);
      res.end();
      return;
    }
    const payload = body ?? readFileSync(path);
    res.writeHead(200, {
      ...headers,
      "content-length": String(payload.byteLength)
    });
    res.end(method === "HEAD" ? void 0 : payload);
  };
  const sendAsset = (req, res, name) => {
    const manifest = readManifest();
    const asset = manifest?.[name];
    if (asset === void 0) return false;
    const stored = join(assetsDir, asset.encoding === "br" ? `${name}.br` : name);
    const headers = {
      "content-type": asset.type,
      "cache-control": "public, max-age=31536000, immutable"
    };
    if (asset.encoding === "br") {
      if (/\bbr\b/.test(req.headers["accept-encoding"] ?? "")) {
        sendFile(res, req.method ?? "GET", stored, { ...headers, "content-encoding": "br" });
        return true;
      }
      const cached = unpressed.get(name);
      if (cached !== void 0) {
        sendFile(res, req.method ?? "GET", stored, headers, cached);
        return true;
      }
      if (!existsSync(stored)) {
        res.writeHead(404);
        res.end();
        return true;
      }
      const body = brotliDecompressSync(readFileSync(stored));
      unpressed.set(name, body);
      sendFile(res, req.method ?? "GET", stored, headers, body);
      return true;
    }
    sendFile(res, req.method ?? "GET", stored, headers);
    return true;
  };
  const readManifest = () => {
    const path = join(assetsDir, ASSETS_MANIFEST);
    if (!existsSync(path)) return void 0;
    try {
      return JSON.parse(readFileSync(path, "utf8")).assets;
    } catch (error) {
      ctx.logger?.warn?.(`dsh-claude-style: lib/assets/${ASSETS_MANIFEST} is unreadable: ${error?.message ?? String(error)}`);
      return void 0;
    }
  };
  scope.effect(() => {
    const disposers = [];
    const report = (message, error) => ctx.logger?.warn?.(`dsh-claude-style: ${message}: ${error?.message ?? String(error)}`);
    const server = scope.webServer;
    if (server === void 0 || server === null) {
      report("web server unavailable", new Error("the host carries no webServer service, so no route of this plugin is registered"));
      return;
    }
    const usage = createUsage(ctx);
    const hdsl = createHdslAccount(ctx);
    const sessionSearch = createSessionSearch(ctx);
    const peakrate = createPeakRate(ctx);
    const register = (label, route) => {
      try {
        const dispose = server.register(route);
        if (typeof dispose === "function") disposers.push(dispose);
      } catch (error) {
        report(`${label} route unavailable`, error);
      }
    };
    register("model copy", {
      kind: "prefix",
      path: ROUTE_PREFIX,
      handler: (req, res) => {
        if (methodRefused(req, res, ["GET", "HEAD"])) return;
        const sub = new URL(req.url ?? "/", "http://x").pathname.slice(ROUTE_PREFIX.length);
        if (sub === `/${COPY_FILE}`) {
          sendFile(res, req.method ?? "GET", file, {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "no-cache"
          });
          return;
        }
        const font = sub.startsWith("/fonts/") ? FONT_FILES[sub.slice("/fonts/".length)] : void 0;
        if (font !== void 0) {
          const name = sub.slice("/fonts/".length);
          const dropped = join(userFontsDir(), name);
          sendFile(res, req.method ?? "GET", existsSync(dropped) ? dropped : join(fontsDir, name), {
            "content-type": font,
            "cache-control": "public, max-age=86400"
          });
          return;
        }
        const sheet = sub.startsWith("/assets/") ? sub.slice("/assets/".length) : "";
        if (sheet !== "" && !sheet.includes("/")) {
          if (!sendAsset(req, res, sheet)) {
            res.writeHead(404);
            res.end();
          }
          return;
        }
        res.writeHead(404);
        res.end();
      }
    });
    register("username", {
      kind: "exact",
      path: USERNAME_PATH,
      handler: (req, res) => {
        if (methodRefused(req, res, ["GET", "HEAD"])) return;
        if (fenceRefused(ctx, req, res)) return;
        const username = userInfo().username || "";
        const body = Buffer.from(JSON.stringify({ ok: true, username }));
        res.writeHead(200, {
          "content-type": "application/json; charset=utf-8",
          "content-length": String(body.byteLength),
          "cache-control": "no-cache"
        });
        res.end(req.method === "HEAD" ? void 0 : body);
      }
    });
    register("HDSL account", {
      kind: "exact",
      path: HDSL_PATH,
      handler: (req, res) => {
        if (methodRefused(req, res, ["GET", "HEAD"])) return;
        if (fenceRefused(ctx, req, res)) return;
        hdsl.read().then((profile) => {
          const { skinFile, ...account } = profile;
          sendJson(res, 200, { ok: true, ...account });
        }, (error) => {
          sendJson(res, 500, { ok: false, error: String(error?.message ?? String(error)) });
        });
      }
    });
    register("HDSL skin", {
      kind: "exact",
      path: HDSL_SKIN_PATH,
      handler: (req, res) => {
        if (methodRefused(req, res, ["GET", "HEAD"])) return;
        if (fenceRefused(ctx, req, res)) return;
        return hdsl.read().then((profile) => {
          if (typeof profile.skinFile !== "string" || !existsSync(profile.skinFile)) {
            res.writeHead(404, { "cache-control": "no-store" });
            res.end();
            return;
          }
          const body = readFileSync(profile.skinFile);
          res.writeHead(200, {
            "content-type": "image/png",
            "content-length": String(body.byteLength),
            "cache-control": "no-cache"
          });
          res.end(req.method === "HEAD" ? void 0 : body);
        });
      }
    });
    register("session delete", {
      kind: "exact",
      path: SESSION_DELETE_PATH,
      handler: (req, res) => {
        if (methodRefused(req, res, ["POST"])) return;
        void deleteSession(ctx, req, res).catch((error) => {
          if (res.headersSent) res.destroy();
          else sendJson(res, 500, { ok: false, error: String(error?.message ?? String(error)) });
        });
      }
    });
    register("usage", {
      kind: "exact",
      path: USAGE_PATH,
      handler: (req, res) => {
        if (methodRefused(req, res, ["GET", "HEAD"])) return;
        if (fenceRefused(ctx, req, res)) return;
        let snapshot = usage.snapshot();
        const stale = snapshot.value === null || snapshot.computing === true || Date.now() - (snapshot.value?.computedAt ?? 0) > USAGE_TTL_MS;
        if (stale) {
          void usage.refresh();
          snapshot = usage.snapshot();
        }
        sendJson(res, 200, {
          ok: true,
          value: snapshot.value,
          computing: snapshot.computing === true,
          ...snapshot.error === void 0 ? {} : { error: snapshot.error }
        });
      }
    });
    register("session search", {
      kind: "exact",
      path: SESSION_SEARCH_PATH,
      handler: (req, res) => {
        if (methodRefused(req, res, ["GET"])) return;
        if (fenceRefused(ctx, req, res)) return;
        const query = (new URL(req.url ?? "/", "http://local").searchParams.get("q") ?? "").trim().slice(0, QUERY_MAX);
        const answer = query === "" ? sessionSearch.warm().then(() => ({ sessions: [] })) : sessionSearch.search(query);
        void answer.then((value) => {
          sendJson(res, 200, { ok: true, ...value });
        }, (error) => {
          sendJson(res, 500, { ok: false, error: String(error?.message ?? String(error)) });
        });
      }
    });
    register("peak rate", {
      kind: "exact",
      path: PEAKRATE_PATH,
      handler: (req, res) => {
        if (methodRefused(req, res, ["GET", "POST"])) return;
        if (fenceRefused(ctx, req, res)) return;
        peakrate.ensure();
        const answer = req.method === "POST" ? peakrate.refresh().then(() => peakrate.payload()) : Promise.resolve(peakrate.payload());
        void answer.then((payload) => {
          sendJson(res, 200, { ok: true, ...payload });
        }, (error) => {
          sendJson(res, 500, { ok: false, error: String(error?.message ?? String(error)) });
        });
      }
    });
    for (const { label, route } of brandRoutes(ctx)) register(label, route);
    return () => {
      usage.dispose();
      peakrate.dispose();
      for (const dispose of disposers) {
        try {
          dispose();
        } catch (error) {
          report("route disposal failed", error);
        }
      }
    };
  }, "dsh-claude-style: host routes");
}
export {
  registerRoutes
};
