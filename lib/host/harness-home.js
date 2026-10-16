// packages/host/src/harness-home.ts
import { homedir } from "node:os";
import { join } from "node:path";
function harnessPath(ctx, ...segments) {
  const resolvePath = ctx.get("dshHomePath");
  if (typeof resolvePath === "function") return resolvePath(...segments);
  return join(process.env.DSH_HOME ?? join(homedir(), ".dsh"), ...segments);
}
function pluginPath(ctx, ...segments) {
  return harnessPath(ctx, "dsh-claude-style", ...segments);
}
export {
  harnessPath,
  pluginPath
};
