/**
 * cli-args.cjs — the value after a `--name` flag on this process's command
 * line, for the tools here that also run standalone.
 */
'use strict'

const args = process.argv.slice(2)

/** The value after `--name`, undefined when the flag is absent. */
const argOf = (name) => {
  const at = args.indexOf(`--${name}`)
  return at === -1 ? undefined : args[at + 1]
}

module.exports = { argOf }
