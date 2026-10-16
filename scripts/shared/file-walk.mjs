/**
 * file-walk.mjs — every file under a directory, by extension.
 *
 * Shared by the lint sweep, the tree hash and the verify gates; each caller
 * passes the directories its own sweep never enters.
 */
import fs from 'node:fs'
import path from 'node:path'

/**
 * @param dir - where the walk starts; a missing directory finds nothing.
 * @param extensions - a file whose name ends in one of these is collected.
 * @param skipped - directory names the walk never enters.
 */
export function filesUnder(dir, extensions, skipped) {
  const found = []
  const walk = (at) => {
    for (const entry of fs.readdirSync(at, { withFileTypes: true })) {
      const full = path.join(at, entry.name)
      if (entry.isDirectory()) {
        if (!skipped.has(entry.name)) walk(full)
        continue
      }
      if (extensions.some((extension) => entry.name.endsWith(extension))) found.push(full)
    }
  }
  if (fs.existsSync(dir)) walk(dir)
  return found
}
