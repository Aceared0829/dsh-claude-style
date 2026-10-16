/**
 * One path under the harness home, resolved the host's own way.
 *
 * The harness publishes its home directory through the `dshHomePath` service,
 * which joins the segments it is handed; when that service is absent,
 * `$DSH_HOME` stands in, with `~/.dsh` behind it. Every host-half module that
 * touches stored sessions resolves through here, so the delete route, the usage
 * roll-up and the search index all read the same directory.
 *
 * @param ctx - host plugin context.
 * @param segments - path segments under the harness home.
 * @returns the resolved path.
 */
import { homedir } from 'node:os'
import type { DshContext } from './dsh.ts'
import { join } from 'node:path'

export function harnessPath(ctx: DshContext, ...segments: string[]): string {
  const resolvePath = ctx.get('dshHomePath')
  if (typeof resolvePath === 'function') return resolvePath(...segments)
  return join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), ...segments)
}

/**
 * One path inside this plugin's own directory in the harness home, which holds
 * everything of ours that lives beside the host's own stores: the reader's
 * dropped-in fonts and brand images, and the usage record.
 *
 * @param ctx - host plugin context.
 * @param segments - path segments under the plugin's directory.
 * @returns the resolved path.
 */
export function pluginPath(ctx: DshContext, ...segments: string[]): string {
  return harnessPath(ctx, 'dsh-claude-style', ...segments)
}
