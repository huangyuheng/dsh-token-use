/**
 * Process lifecycle for the configuration tab: restart and shutdown.
 *
 * Both actions change the page under the user's feet, so the work happens in a
 * detached shell script rather than inline: the HTTP response has to reach the
 * browser first, and the script must outlive the process it is about to stop.
 *
 * Relaunching replays the running command line (`process.execPath` + `argv` +
 * cwd) instead of guessing a CLI invocation, so custom ports, flags and working
 * directories survive. Shutdown simply stops and never starts again — the user
 * brings the service back by hand, which the panel says in as many words.
 *
 * @module dsh-token-use/power
 */
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** How long the script waits before touching the process (ms, in whole seconds). */
const GRACE_SECONDS = 2
/** How long the script waits for a graceful exit before escalating. */
const STOP_TIMEOUT_SECONDS = 30

/** Single-quote a shell word so paths with spaces survive. */
function shellQuote(value) {
  return `'${String(value).replaceAll("'", `'\\''`)}'`
}

/** The stop half both scripts share: TERM, wait, then KILL. */
function stopCommands(pid) {
  return [
    `kill -TERM ${pid} 2>/dev/null`,
    'i=0',
    `while kill -0 ${pid} 2>/dev/null && [ "$i" -lt ${STOP_TIMEOUT_SECONDS} ]; do sleep 1; i=$((i+1)); done`,
    `kill -9 ${pid} 2>/dev/null`,
  ]
}

/**
 * The detached restart script: wait for the response to land, stop the process
 * that serves this request, then start the very same command again from the
 * same directory.
 *
 * @returns the script text, or undefined when the running command is unusable.
 */
export function restartScript({ pid, argv, cwd: workingDir, logFile }) {
  const entry = argv[1]
  const rest = argv.slice(2)
  if (typeof entry !== 'string' || entry.length === 0 || typeof pid !== 'number') return undefined
  const command = [process.execPath, entry, ...rest].map(shellQuote).join(' ')
  return [
    '#!/bin/sh',
    '# Written by dsh-token-use: restart the dsh web service on demand.',
    `sleep ${GRACE_SECONDS}`,
    ...stopCommands(pid),
    'sleep 1',
    `cd ${shellQuote(workingDir)} || exit 1`,
    `nohup ${command} >>${shellQuote(logFile)} 2>&1 </dev/null &`,
    '',
  ].join('\n')
}

/**
 * The detached shutdown script: stop the process and leave it stopped. There is
 * no relaunch, because "关闭" has to mean what it says.
 *
 * @returns the script text, or undefined when the running pid is unusable.
 */
export function shutdownScript({ pid, logFile }) {
  if (typeof pid !== 'number' || Number.isNaN(pid)) return undefined
  return [
    '#!/bin/sh',
    '# Written by dsh-token-use: stop the dsh web service and stay down.',
    `sleep ${GRACE_SECONDS}`,
    ...stopCommands(pid),
    `echo "dsh-token-use: stopped pid ${pid} at $(date)" >>${shellQuote(logFile)}`,
    '',
  ].join('\n')
}

/** Write a script and run it detached, so it survives the process it stops. */
function fire(dshHome, name, script) {
  if (script === undefined) return undefined
  const dir = join(dshHome, 'dsh-token-use')
  const scriptFile = join(dir, `${name}.sh`)
  try {
    mkdirSync(dir, { recursive: true })
    writeFileSync(scriptFile, script, { mode: 0o700 })
  } catch (error) {
    return { error: String(error?.message ?? error) }
  }
  const child = spawn('sh', [scriptFile], { detached: true, stdio: 'ignore' })
  child.unref()
  return { script: scriptFile, logFile: join(dir, `${name}.log`), graceSeconds: GRACE_SECONDS }
}

/**
 * Restart the service.
 * @returns `{ script, logFile, graceSeconds }`, or undefined when the current
 * command line cannot be replayed, or `{ error }` when the script cannot be written.
 */
export function scheduleRestart(dshHome) {
  const logFile = join(dshHome, 'dsh-token-use', 'restart.log')
  return fire(dshHome, 'restart', restartScript({
    pid: process.pid,
    argv: process.argv,
    cwd: process.cwd(),
    logFile,
  }))
}

/**
 * Shut the service down. `restartable` in the config report tells the panel
 * whether this is offered at all.
 */
export function scheduleShutdown(dshHome) {
  const logFile = join(dshHome, 'dsh-token-use', 'shutdown.log')
  return fire(dshHome, 'shutdown', shutdownScript({ pid: process.pid, logFile }))
}

/** Whether this launch can be restarted / shut down at all. */
export function powerCapability() {
  return {
    restartable: restartScript({ pid: process.pid, argv: process.argv, cwd: process.cwd(), logFile: 'probe' }) !== undefined,
    shutdownable: shutdownScript({ pid: process.pid, logFile: 'probe' }) !== undefined,
  }
}
