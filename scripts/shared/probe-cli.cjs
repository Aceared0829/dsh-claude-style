/**
 * probe-cli.cjs — the command line the two probes share: `--token` (or the
 * DSH_WEB_TOKEN env var) and `--url`. Each probe keeps its own usage line for
 * a missing token.
 */
'use strict'

const args = process.argv.slice(2)
const argOf = (name) => {
  const i = args.indexOf('--' + name)
  return i === -1 ? undefined : args[i + 1]
}
const TOKEN = argOf('token') || process.env.DSH_WEB_TOKEN
const BASE = (argOf('url') || 'http://127.0.0.1:3080').replace(/\/+$/, '')

module.exports = { argOf, TOKEN, BASE }
