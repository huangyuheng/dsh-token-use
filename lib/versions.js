/**
 * Version discovery and process control for the settings panel's config tab.
 *
 * Installed versions are read from disk, never guessed: the running dsh bin
 * (`process.argv[1]`) names the service package, and the plugin's own module
 * chain reaches the harness packages. Latest versions come from the npm
 * registry and are cached on disk for hours — the panel is a settings page,
 * not a poller.
 *
 * The restart helper writes a detached shell script instead of killing the
 * process directly: the HTTP response has to reach the browser first, and the
 * relaunch must survive the death of the process that spawned it.
 *
 * @module dsh-token-use/versions
 */
import { execFileSync, spawn } from 'node:child_process'
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { arch, platform as platformName, release, type as osType } from 'node:os'
import { dirname, join } from 'node:path'

/** Packages the config tab reports; `id` is what the client labels. */
export const TRACKED = [
  { id: 'dsh-service', label: 'dsh-service', name: '@deepseek-ai/dsh' },
  { id: 'dsh', label: 'dsh', name: '@deepseek-ai/dsh-web-app' },
  { id: 'dsh-base', label: 'dsh-base', name: '@deepseek-ai/dsh-base' },
  { id: 'dsh-token-use', label: 'dsh-token-use', name: 'dsh-token-use' },
]

const DEFAULT_REGISTRY = 'https://registry.npmjs.org'
const TIMEOUT_MS = 8000
/** How long a registry answer is trusted before the next check. */
const CACHE_TTL_MS = 6 * 60 * 60 * 1000
const USER_AGENT = 'dsh-token-use (+https://github.com/huangyuheng/dsh-token-use)'
/** Steps walked up a directory chain while hunting for a package.json. */
const MAX_WALK = 12

const require = createRequire(import.meta.url)

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return undefined
  }
}

/** package.json paths to try, nearest first, walking up from `start`. */
function walkUp(start, name) {
  const candidates = []
  let dir = start
  for (let i = 0; i < MAX_WALK; i++) {
    candidates.push(join(dir, 'node_modules', name, 'package.json'))
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return candidates
}

/**
 * Version of the harness package that owns the running bin. `process.argv[1]`
 * is the entry script, so the first package.json named `@deepseek-ai/dsh` above
 * it is exactly the code being served — the truth even when several copies are
 * installed (pnpm dlx keeps one store link per version).
 */
function runningServiceVersion() {
  const bin = process.argv[1]
  if (typeof bin !== 'string' || bin.length === 0) return undefined
  let dir = dirname(bin)
  for (let i = 0; i < MAX_WALK; i++) {
    const pkg = readJson(join(dir, 'package.json'))
    if (pkg !== undefined && pkg.name === '@deepseek-ai/dsh' && typeof pkg.version === 'string') return pkg.version
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return undefined
}

/** Installed version of one package, or undefined when it cannot be located. */
function installedVersion(name) {
  if (name === '@deepseek-ai/dsh') {
    const fromBin = runningServiceVersion()
    if (fromBin !== undefined) return fromBin
  }
  try {
    const pkg = readJson(require.resolve(`${name}/package.json`))
    if (pkg !== undefined && typeof pkg.version === 'string') return pkg.version
  } catch {
    // fall through to the directory walk
  }
  const starts = [dirname(new URL(import.meta.url).pathname), ...(typeof process.argv[1] === 'string' ? [dirname(process.argv[1])] : []), process.cwd()]
  for (const start of starts) {
    for (const candidate of walkUp(start, name)) {
      const pkg = readJson(candidate)
      if (pkg !== undefined && typeof pkg.version === 'string') return pkg.version
    }
  }
  return undefined
}

/**
 * Semver-lite precedence: `-1` older, `0` equal, `1` newer. A prerelease sorts
 * below its release, and prerelease identifiers are compared the semver way
 * (numeric below alphanumeric, numbers numerically) so `0.1.5-rc.2` beats
 * `0.1.5-rc.1`.
 */
export function compareVersions(a, b) {
  const parse = (value) => {
    const [core, pre = ''] = String(value).split('-')
    return {
      core: core.split('.').map((part) => Number.parseInt(part, 10) || 0),
      pre: pre.length === 0 ? [] : pre.split('.').map((part) => (/^\d+$/.test(part) ? Number(part) : part)),
    }
  }
  const left = parse(a)
  const right = parse(b)
  for (let i = 0; i < Math.max(left.core.length, right.core.length); i++) {
    const diff = (left.core[i] ?? 0) - (right.core[i] ?? 0)
    if (diff !== 0) return diff > 0 ? 1 : -1
  }
  if (left.pre.length === 0 || right.pre.length === 0) {
    if (left.pre.length === right.pre.length) return 0
    return left.pre.length === 0 ? 1 : -1
  }
  for (let i = 0; i < Math.max(left.pre.length, right.pre.length); i++) {
    const one = left.pre[i]
    const two = right.pre[i]
    if (one === undefined) return -1
    if (two === undefined) return 1
    if (one === two) continue
    const oneNumeric = typeof one === 'number'
    if (oneNumeric !== (typeof two === 'number')) return oneNumeric ? -1 : 1
    return one > two ? 1 : -1
  }
  return 0
}

/**
 * Release channel of a version: the `rc` of `0.1.5-rc.2`, or `stable`. The
 * harness publishes every channel to the same package, and `latest` is not
 * always the newest of them — `@deepseek-ai/dsh-web-app` still tags a stale
 * `0.0.1-rc.1` as latest while `next` carries the real build.
 */
export function channelOf(version, fallback = 'stable') {
  if (typeof version !== 'string' || version.length === 0) return fallback
  const match = /-[a-zA-Z]+/.exec(version)
  return match === null ? 'stable' : match[0].slice(1).toLowerCase()
}

/** Highest version inside one channel. */
function highestInChannel(versions, channel) {
  let best
  for (const version of versions) {
    if (channelOf(version) !== channel) continue
    if (best === undefined || compareVersions(version, best) > 0) best = version
  }
  return best
}

/** macOS prefers the marketing version (`sw_vers`); elsewhere the kernel tells enough. */
function osDisplayName() {
  if (platformName() === 'darwin') {
    try {
      const product = execFileSync('sw_vers', ['-productVersion'], { encoding: 'utf8', timeout: 2000 }).trim()
      if (product.length > 0) return `macOS ${product}`
    } catch {
      return `macOS (kernel ${release()})`
    }
  }
  const family = { linux: 'Linux', win32: 'Windows', freebsd: 'FreeBSD' }[platformName()]
  return family === undefined ? `${osType()} ${release()}` : `${family} ${release()}`
}

/** Runtime facts for the config tab; `port` comes from the request that asked. */
export function describePlatform(port, dshHome) {
  return {
    os: platformName(),
    osName: osDisplayName(),
    arch: arch(),
    node: process.version,
    pid: process.pid,
    port: typeof port === 'string' && port.length > 0 ? port : null,
    uptimeSec: Math.round(process.uptime()),
    cwd: process.cwd(),
    execPath: process.execPath,
    dshHome,
  }
}

/** `'current' | 'outdated' | 'ahead' | 'unknown'`. */
function statusOf(installed, latest) {
  if (typeof installed !== 'string' || installed.length === 0) return 'unknown'
  if (typeof latest !== 'string' || latest.length === 0) return 'unknown'
  const diff = compareVersions(installed, latest)
  if (diff === 0) return 'current'
  return diff < 0 ? 'outdated' : 'ahead'
}

/**
 * Latest-version lookups with an on-disk cache. A failed lookup keeps the last
 * known answer (marked stale) so the tab still renders offline.
 */
export class VersionStore {
  /**
   * @param dshHome - `$DSH_HOME`, where the cache lives.
   * @param options - `registry` (defaults to npmjs), `timeoutMs`, `ttlMs`.
   */
  constructor(dshHome, options = {}) {
    this.file = join(dshHome, 'dsh-token-use', 'versions.json')
    this.registry = typeof options.registry === 'string' && options.registry.length > 0 ? options.registry : DEFAULT_REGISTRY
    this.timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : TIMEOUT_MS
    this.ttlMs = Number.isFinite(options.ttlMs) ? options.ttlMs : CACHE_TTL_MS
    this.cache = readJson(this.file) ?? {}
    this.pending = null
  }

  /** Cached record for one package, or undefined. */
  cached(name) {
    return this.cache.packages?.[name]
  }

  /**
   * The registry's install metadata (versions + dist-tags) — the abbreviated
   * packument, which is a fraction of the full document's size.
   */
  async fetchPackument(name) {
    const url = `${this.registry}/${name.replace('/', '%2f')}`
    const response = await fetch(url, {
      headers: { accept: 'application/vnd.npm.install-v1+json', 'user-agent': USER_AGENT },
      signal: AbortSignal.timeout(this.timeoutMs),
    })
    if (!response.ok) throw new Error(`http ${response.status}`)
    const body = await response.json()
    const versions = Object.keys(body?.versions ?? {})
    if (versions.length === 0) throw new Error('no versions in registry response')
    return { versions, tags: body['dist-tags'] ?? {} }
  }

  /** Refresh every tracked package at most once per TTL, deduplicated. */
  async ensure(names) {
    const checkedAt = typeof this.cache.checkedAt === 'number' ? this.cache.checkedAt : 0
    if (Date.now() - checkedAt < this.ttlMs) return
    if (this.pending !== null) {
      await this.pending
      return
    }
    this.pending = (async () => {
      const packages = { ...this.cache.packages }
      const errors = {}
      await Promise.all(names.map(async (name) => {
        try {
          const { versions, tags } = await this.fetchPackument(name)
          const next = typeof tags.next === 'string' ? tags.next : undefined
          packages[name] = {
            versions: versions.slice(-40),
            tags,
            next: next ?? null,
            latest: highestInChannel(versions, channelOf(next ?? '')) ?? highestInChannel(versions, 'stable') ?? versions[versions.length - 1],
          }
        } catch (error) {
          errors[name] = String(error?.message ?? error)
        }
      }))
      this.cache = { checkedAt: Date.now(), packages, errors }
      this.persist()
    })()
    try {
      await this.pending
    } finally {
      this.pending = null
    }
  }

  persist() {
    try {
      mkdirSync(dirname(this.file), { recursive: true })
      const tmp = `${this.file}.tmp`
      writeFileSync(tmp, `${JSON.stringify(this.cache, null, 2)}\n`)
      renameSync(tmp, this.file)
    } catch {
      // a cache that cannot be written is still a usable in-memory cache
    }
  }

  /**
   * The config tab's payload: installed vs latest for every tracked package,
   * the runtime facts, and whether the cached registry answer is fresh.
   */
  async describe({ port, dshHome }) {
    try {
      await this.ensure(TRACKED.map((entry) => entry.name))
    } catch {
      // ensure() swallows per-package errors already; a throw here means the cache
      // file itself is unwritable, which the report below still handles
    }
    const errors = this.cache.errors ?? {}
    const packages = TRACKED.map((entry) => {
      const installed = entry.id === 'dsh-token-use'
        ? readJson(new URL('../package.json', import.meta.url))?.version
        : installedVersion(entry.name)
      const record = this.cached(entry.name)
      // Compare inside the channel the user actually runs: an rc install is not
      // out of date just because an alpha exists.
      const channel = channelOf(installed ?? record?.next ?? '')
      const latest = record === undefined
        ? undefined
        : highestInChannel(record.versions, channel) ?? record.latest
      return {
        id: entry.id,
        label: entry.label,
        name: entry.name,
        installed: installed ?? null,
        latest: latest ?? null,
        channel,
        tags: record?.tags ?? {},
        status: statusOf(installed, latest),
        error: errors[entry.name] ?? null,
      }
    })
    return {
      packages,
      registry: this.registry,
      checkedAt: typeof this.cache.checkedAt === 'number' ? this.cache.checkedAt : 0,
      platform: describePlatform(port, dshHome),
    }
  }
}

/** Single-quote a shell word so paths with spaces survive. */
function shellQuote(value) {
  return `'${String(value).replaceAll("'", `'\\''`)}'`
}

/**
 * The detached restart script: wait for the response to land, stop the process
 * that serves this request, then start the very same command again from the
 * same directory. Relaunching by `argv` (not by a guessed CLI invocation)
 * keeps custom flags, ports and working directories intact.
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
    'sleep 2',
    `kill -TERM ${pid} 2>/dev/null`,
    'i=0',
    `while kill -0 ${pid} 2>/dev/null && [ "$i" -lt 30 ]; do sleep 1; i=$((i+1)); done`,
    `kill -9 ${pid} 2>/dev/null`,
    'sleep 1',
    `cd ${shellQuote(workingDir)} || exit 1`,
    `nohup ${command} >>${shellQuote(logFile)} 2>&1 </dev/null &`,
    '',
  ].join('\n')
}

/**
 * Write and fire the restart script, fully detached so it outlives the server
 * it is about to stop.
 *
 * @returns `{ script, logFile }` for the response, or undefined when the
 * current command line cannot be relaunched safely.
 */
export function scheduleRestart(dshHome) {
  const dir = join(dshHome, 'dsh-token-use')
  const logFile = join(dir, 'restart.log')
  const scriptFile = join(dir, 'restart.sh')
  const script = restartScript({
    pid: process.pid,
    argv: process.argv,
    cwd: process.cwd(),
    logFile,
  })
  if (script === undefined) return undefined
  try {
    mkdirSync(dir, { recursive: true })
    writeFileSync(scriptFile, script, { mode: 0o700 })
  } catch (error) {
    return { error: String(error?.message ?? error) }
  }
  const child = spawn('sh', [scriptFile], { detached: true, stdio: 'ignore' })
  child.unref()
  return { script: scriptFile, logFile }
}
