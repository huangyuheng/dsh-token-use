/**
 * dsh-token-use host half: an always-live, in-memory fold of every model
 * call's token usage plus a read-only loopback JSON endpoint.
 *
 * Cost model: O(1) arithmetic per `session/event` — no polling, no file
 * watches, no periodic writes. History is rebuilt once at boot by streaming
 * the zstd session logs with cooperative yields; from then on the fold only
 * moves forward through the live event bus. A per-session seq watermark makes
 * the boot scan and the live fold overlap-safe in either order. Every record
 * is also priced at the DeepSeek rate of the moment it happened (see
 * `pricing.js`), so each bucket carries an estimated amount alongside tokens.
 *
 * Queries: `GET /dsh-token-use` returns all-time buckets;
 * `?day=YYYY-MM-DD` and `?month=YYYY-MM` return the matching window,
 * aggregated in memory from per-day buckets (no rescan, no disk).
 *
 * @module dsh-token-use
 */
import { homedir } from 'node:os'
import { readFileSync } from 'node:fs'
import { readdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { zstdDecompressSync } from 'node:zlib'
import { scheduler } from 'node:timers/promises'
import { PricingStore } from './pricing.js'

export const name = 'dsh-token-use'

const VERSION = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version

/** usage field -> fold key, in display order. */
const USAGE_FIELDS = [
  ['inputTokens', 'input'],
  ['outputTokens', 'output'],
  ['cacheReadTokens', 'cacheRead'],
  ['cacheWriteTokens', 'cacheWrite'],
  ['reasoningTokens', 'reasoning'],
]

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1'])

/**
 * Days of per-day buckets the snapshot carries for the trend chart. The client
 * slices this down to its 7/30/90-day range switcher, so the widest range is
 * served without another round trip.
 */
const TREND_DAYS = 90

/**
 * Auxiliary LLM calls that DeepSeek bills but that persist no `usage` record:
 * session-title generation and the web-search tool's own model call. They are
 * counted — so the dashboard can say how many calls the amount leaves out —
 * but never priced, because their token counts exist only in the platform's
 * ledger, not in the session log.
 */
const AUXILIARY_EVENTS = {
  'session/title-llm-request': 'title',
  'web/deepseek-search-llm-request': 'search',
}

/**
 * Session artifact names: `session.jsonl[.zstd]` for the original generation
 * and `session.v<N>.jsonl[.zstd]` for a versioned re-encoding of the same log.
 * A migration leaves both on disk (same session, different generations), so a
 * session is read from its highest-version file only.
 */
const LOG_NAME_RE = /^session(?:\.v(\d+))?\.jsonl(?:\.zstd)?$/

/** Pick the newest generation present in one session directory. */
function pickSessionLog(entries) {
  let best
  for (const name of entries) {
    const match = LOG_NAME_RE.exec(name)
    if (match === null) continue
    const version = match[1] === undefined ? 0 : Number(match[1])
    const compressed = name.endsWith('.zstd') ? 1 : 0
    if (best === undefined || version > best.version || (version === best.version && compressed > best.compressed)) {
      best = { name, version, compressed }
    }
  }
  return best === undefined ? undefined : best.name
}
const ZSTD_MAGIC = 4247762216
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/
const MONTH_RE = /^\d{4}-\d{2}$/

function resolveDshHome(env = process.env) {
  const explicit = env.DSH_HOME
  if (explicit !== undefined && explicit.trim().length > 0) return explicit
  return join(homedir(), '.dsh')
}

function shiftDay(day, delta) {
  const [year, month, date] = day.split('-').map(Number)
  const shifted = new Date(year, month - 1, date + delta)
  const p = (n) => String(n).padStart(2, '0')
  return `${shifted.getFullYear()}-${p(shifted.getMonth() + 1)}-${p(shifted.getDate())}`
}

function localDay(timestamp) {
  const d = new Date(timestamp)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/**
 * Project of a live session: cwd lives on the detached creation header
 * (`session.header.cwd`), not on the Session object itself.
 */
function sessionCwd(session) {
  if (session === null || typeof session !== 'object') return undefined
  if (typeof session.cwd === 'string') return session.cwd
  const header = session.header
  if (header !== null && typeof header === 'object' && typeof header.cwd === 'string') return header.cwd
  return undefined
}

/** Fork/subagent lineage of a live session, used to inherit its project. */
function sessionParent(session) {
  if (session === null || typeof session !== 'object') return undefined
  const header = session.header
  if (header !== null && typeof header === 'object' && typeof header.parentSession === 'string') return header.parentSession
  if (typeof session.parentSession === 'string') return session.parentSession
  return undefined
}

function emptyBucket() {
  return { calls: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0, cost: 0 }
}

function addUsage(bucket, usage, cost = 0) {
  bucket.calls += 1
  bucket.cost += cost
  for (const [field, key] of USAGE_FIELDS) {
    const value = usage[field]
    if (typeof value === 'number' && Number.isFinite(value)) bucket[key] += value
  }
}

function mergeInto(target, source) {
  target.calls += source.calls
  for (const key of ['input', 'output', 'cacheRead', 'cacheWrite', 'reasoning', 'cost']) target[key] += source[key]
}

/**
 * Split a concatenated-frame zstd container into complete frame ranges.
 * Session artifacts append one frame per flush; the single-frame Node
 * decompressor stops at the first frame, so the container is walked frame by
 * frame with the same header math as the harness's own persistence backend.
 */
function scanZstdFrames(buffer) {
  const frames = []
  let offset = 0
  while (offset < buffer.length) {
    const start = offset
    if (buffer.length - offset < 4) break
    if (buffer.readUInt32LE(offset) !== ZSTD_MAGIC) break
    offset += 4
    const descriptor = buffer.readUInt8(offset)
    offset += 1
    const contentSizeFlag = descriptor >>> 6
    const singleSegment = (descriptor & 32) !== 0
    const checksum = (descriptor & 4) !== 0
    const dictionaryFlag = descriptor & 3
    const dictionaryBytes = dictionaryFlag === 3 ? 4 : dictionaryFlag
    const contentSizeBytes = contentSizeFlag === 0 ? singleSegment ? 1 : 0 : 1 << contentSizeFlag
    offset += (singleSegment ? 0 : 1) + dictionaryBytes + contentSizeBytes
    let complete = false
    for (;;) {
      if (buffer.length - offset < 3) break
      const blockHeader = buffer.readUIntLE(offset, 3)
      offset += 3
      const lastBlock = (blockHeader & 1) !== 0
      const blockType = blockHeader >>> 1 & 3
      const blockSize = blockHeader >>> 3
      if (blockType === 3) break
      const payloadBytes = blockType === 1 ? 1 : blockSize
      if (buffer.length - offset < payloadBytes) break
      offset += payloadBytes
      if (lastBlock) {
        if (checksum) {
          if (buffer.length - offset < 4) break
          offset += 4
        }
        complete = true
        break
      }
    }
    if (complete) frames.push([start, offset])
  }
  return frames
}

/**
 * Decode one session artifact to utf-8 text. Both persistence encodings are
 * supported: plaintext `session.jsonl` and multi-frame `session.jsonl.zstd`.
 */
async function decompressSessionLog(path) {
  const buffer = await readFile(path)
  if (path.endsWith('.jsonl')) return buffer.toString('utf8')
  if (typeof zstdDecompressSync !== 'function') {
    throw new Error('node:zlib has no zstd support on this Node version (needs >= 22.15)')
  }
  let text = ''
  for (const [start, end] of scanZstdFrames(buffer)) {
    text += zstdDecompressSync(buffer.subarray(start, end)).toString('utf8')
  }
  return text
}

async function listSessionLogs(sessionsDir) {
  const logs = []
  let projects
  try {
    projects = await readdir(sessionsDir, { withFileTypes: true })
  } catch {
    return logs
  }
  for (const project of projects) {
    if (!project.isDirectory()) continue
    const projectDir = join(sessionsDir, project.name)
    let sessions
    try {
      sessions = await readdir(projectDir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const session of sessions) {
      if (!session.isDirectory()) continue
      const sessionDir = join(projectDir, session.name)
      let entries
      try {
        entries = await readdir(sessionDir)
      } catch {
        continue
      }
      const picked = pickSessionLog(entries)
      if (picked !== undefined) logs.push(join(sessionDir, picked))
    }
    await scheduler.yield()
  }
  return logs
}

/**
 * In-memory token ledger. Both sources — the live `session/event` bus and the
 * boot-time log scan — funnel through {@link UsageTracker#fold}; the seq
 * watermark in {@link UsageTracker#seen} deduplicates the overlap.
 */
export class UsageTracker {
  constructor(dshHome = resolveDshHome(), options = {}) {
    this.dshHome = dshHome
    this.allowRemote = options.allowRemote === true
    this.pricing = options.pricing ?? new PricingStore(dshHome, options.pricingOptions ?? {})
    this.startedAt = Date.now()
    this.totals = emptyBucket()
    this.byModel = new Map()
    this.byProject = new Map()
    this.byDay = new Map()
    this.dayModel = new Map()
    this.dayProject = new Map()
    this.dayModelProject = new Map()
    this.dayAuxiliary = new Map()
    this.lastModel = new Map()
    this.seen = new Map()
    this.scanning = false
    this.pending = []
    this.projectOf = new Map()
    this.parentOf = new Map()
    this.orphans = new Map()
    this.scan = { startedAt: 0, done: false, files: 0, sessions: 0, bytes: 0, ms: 0, skipped: 0, error: null }
  }

  bucket(map, key) {
    let bucket = map.get(key)
    if (bucket === undefined) {
      bucket = emptyBucket()
      map.set(key, bucket)
    }
    return bucket
  }

  nestedBucket(map, outerKey, innerKey) {
    let inner = map.get(outerKey)
    if (inner === undefined) {
      inner = new Map()
      map.set(outerKey, inner)
    }
    return this.bucket(inner, innerKey)
  }

  nestedBucket3(map, firstKey, secondKey, thirdKey) {
    let second = map.get(firstKey)
    if (second === undefined) {
      second = new Map()
      map.set(firstKey, second)
    }
    return this.nestedBucket(second, secondKey, thirdKey)
  }

  /** Counters for auxiliary calls (title/search) on one day. */
  auxiliaryBucket(day) {
    let counts = this.dayAuxiliary.get(day)
    if (counts === undefined) {
      counts = { title: 0, search: 0, total: 0 }
      this.dayAuxiliary.set(day, counts)
    }
    return counts
  }

  /** Auxiliary-call counters summed over the given days. */
  auxiliaryOver(days) {
    const counts = { title: 0, search: 0, total: 0 }
    for (const day of days) {
      const found = this.dayAuxiliary.get(day)
      if (found === undefined) continue
      counts.title += found.title
      counts.search += found.search
      counts.total += found.total
    }
    return counts
  }

  /**
   * Fold one decoded session event. `request/header` only updates the
   * per-session model attribution; an auxiliary request is counted (its usage
   * is never persisted, so it cannot be priced); `assistant/message` with a
   * usage record is counted once, priced with the rate in effect right then.
   * @returns true when the event was counted.
   */
  fold(session, event) {
    if (event === null || typeof event !== 'object' || session === null || typeof session !== 'object') return false
    if (this.scanning) {
      this.pending.push([session, event])
      return false
    }
    if (event.type === 'request/header') {
      const model = event.data?.header?.config?.model
      if (typeof model === 'string' && model.length > 0) this.lastModel.set(session.id, model)
      return false
    }
    const auxiliary = AUXILIARY_EVENTS[event.type]
    if (auxiliary === undefined && event.type !== 'assistant/message') return false
    const usage = auxiliary === undefined ? event.data?.usage : undefined
    if (auxiliary === undefined && (usage === null || typeof usage !== 'object')) return false
    const seq = event.seq
    const seen = this.seen.get(session.id)
    if (typeof seen === 'number' && typeof seq === 'number' && seq <= seen) return false
    if (typeof seq === 'number') this.seen.set(session.id, Math.max(seen ?? 0, seq))
    const time = typeof event.time === 'number' ? event.time : undefined
    if (auxiliary !== undefined) {
      if (time !== undefined) {
        const counts = this.auxiliaryBucket(localDay(time))
        counts[auxiliary] += 1
        counts.total += 1
      }
      return false
    }
    const model = this.lastModel.get(session.id) ?? 'unknown'
    const cost = this.pricing.costOf(usage, model, time)
    addUsage(this.totals, usage, cost)
    addUsage(this.bucket(this.byModel, model), usage, cost)
    const project = this.projectFor(session)
    if (project === undefined) {
      // The session's project is not known yet: hold the project-side usage
      // until it resolves (a later event or the parent's resolution).
      this.holdOrphan(session.id, usage, cost, time === undefined ? undefined : localDay(time), model)
    } else {
      addUsage(this.bucket(this.byProject, project), usage, cost)
    }
    if (time !== undefined) {
      const day = localDay(time)
      addUsage(this.bucket(this.byDay, day), usage, cost)
      addUsage(this.nestedBucket(this.dayModel, day, model), usage, cost)
      if (project !== undefined) {
        addUsage(this.nestedBucket(this.dayProject, day, project), usage, cost)
        addUsage(this.nestedBucket3(this.dayModelProject, day, model, project), usage, cost)
      }
    }
    return true
  }

  /**
   * Rebuild history from `$DSH_HOME/sessions/**` once. Runs on a worker
   * thread by default so a large history never blocks the host event loop;
   * events arriving during the scan are buffered and replayed afterwards, and
   * the seq watermark keeps the two folds from double counting.
   */
  async scanSessions(options = {}) {
    if (this.scan.startedAt !== 0) return this.scan
    if (options.worker !== false) {
      const done = await this.scanInWorker()
      if (done) return this.scan
    }
    return this.scanInProcess()
  }

  /** Worker-thread scan; returns false when unavailable so the caller falls back. */
  async scanInWorker() {
    if (typeof Worker !== 'function') return false
    let WorkerCtor
    try {
      ;({ Worker: WorkerCtor } = await import('node:worker_threads'))
    } catch {
      return false
    }
    this.scan.startedAt = Date.now()
    this.scanning = true
    try {
      const result = await new Promise((resolve, reject) => {
        const worker = new WorkerCtor(new URL('./scan-worker.js', import.meta.url), {
          workerData: { dshHome: this.dshHome, pricing: { snapshots: this.pricing.snapshots ?? [], currency: this.pricing.currency } },
        })
        worker.once('message', (message) => {
          worker.terminate().catch(() => {})
          resolve(message)
        })
        worker.once('error', (error) => {
          worker.terminate().catch(() => {})
          reject(error)
        })
      })
      this.merge(result)
      this.scan.ms = Date.now() - this.scan.startedAt
      return true
    } catch (error) {
      this.scan.error = String(error?.message ?? error)
      this.scan.startedAt = 0
      return false
    } finally {
      this.scanning = false
      const buffered = this.pending
      this.pending = []
      for (const [session, event] of buffered) this.fold(session, event)
    }
  }

  async scanInProcess() {
    if (this.scan.startedAt !== 0) return this.scan
    this.scan.startedAt = Date.now()
    const root = join(this.dshHome, 'sessions')
    const logs = await listSessionLogs(root)
    this.scan.files = logs.length
    const sessionDirs = new Set()
    const processLog = async (log) => {
      sessionDirs.add(log.slice(root.length + 1).split('/')[0])
      try {
        this.scan.bytes += (await stat(log)).size
        const decoded = await decompressSessionLog(log)
        let current = null
        for (const line of decoded.split('\n')) {
          if (line.length === 0) continue
          let event
          try {
            event = JSON.parse(line)
          } catch {
            continue
          }
          if (event.type === 'session') {
            current = { id: event.id, cwd: event.cwd }
            if (typeof event.cwd === 'string') this.projectOf.set(event.id, event.cwd)
            if (typeof event.parentSession === 'string') this.parentOf.set(event.id, event.parentSession)
            continue
          }
          if (current !== null) this.fold(current, event)
        }
      } catch (error) {
        this.scan.skipped += 1
        if (this.scan.error === null) this.scan.error = String(error?.message ?? error)
      }
    }
    let cursor = 0
    const worker = async () => {
      while (cursor < logs.length) {
        const log = logs[cursor]
        cursor += 1
        await processLog(log)
        await scheduler.yield()
      }
    }
    await Promise.all(Array.from({ length: Math.min(3, logs.length) }, worker))
    for (const id of [...this.projectOf.keys()]) this.rememberProject(id, this.projectOf.get(id))
    this.scan.sessions = sessionDirs.size
    this.scan.ms = Date.now() - this.scan.startedAt
    this.scan.done = true
    return this.scan
  }

  sorted(map) {
    return Object.fromEntries([...map.entries()].sort((a, b) => b[1].input - a[1].input))
  }

  /** Record a session's project and release any usage that was waiting on it. */
  rememberProject(sessionId, project) {
    if (typeof sessionId !== 'string' || typeof project !== 'string') return
    this.projectOf.set(sessionId, project)
    for (const [id, parent] of this.parentOf) {
      if (parent === sessionId && !this.projectOf.has(id)) this.rememberProject(id, project)
    }
    const held = this.orphans.get(sessionId)
    if (held !== undefined) {
      this.orphans.delete(sessionId)
      this.commitProject(project, held)
    }
  }

  /** Attribute usage that arrived before its session's project was known. */
  holdOrphan(sessionId, usage, cost, day, model) {
    let held = this.orphans.get(sessionId)
    if (held === undefined) {
      held = { totals: emptyBucket(), days: new Map(), dayModels: new Map(), since: Date.now() }
      this.orphans.set(sessionId, held)
    }
    addUsage(held.totals, usage, cost)
    if (day !== undefined) {
      addUsage(this.bucket(held.days, day), usage, cost)
      if (model !== undefined) {
        let byModel = held.dayModels.get(day)
        if (byModel === undefined) {
          byModel = new Map()
          held.dayModels.set(day, byModel)
        }
        addUsage(this.bucket(byModel, model), usage, cost)
      }
    }
  }

  /** Merge held usage into the by-project, by-day-project and model-project buckets. */
  commitProject(project, held) {
    mergeInto(this.bucket(this.byProject, project), held.totals)
    for (const [day, bucket] of held.days) mergeInto(this.nestedBucket(this.dayProject, day, project), bucket)
    for (const [day, byModel] of held.dayModels) {
      for (const [model, bucket] of byModel) mergeInto(this.nestedBucket3(this.dayModelProject, day, model, project), bucket)
    }
  }

  /** Anything still unattributed after this long is shown as `(no cwd)`. */
  flushStaleOrphans(maxAgeMs = 30000) {
    const now = Date.now()
    for (const [id, held] of [...this.orphans]) {
      if (now - held.since < maxAgeMs) continue
      this.orphans.delete(id)
      this.commitProject('(no cwd)', held)
    }
  }

  /**
   * Resolve a session's project: the live header first, then the boot scan's
   * map, then the parent session (subagents/fork children inherit it).
   */
  projectFor(session) {
    const direct = sessionCwd(session)
    if (direct !== undefined) {
      this.rememberProject(session.id, direct)
      return direct
    }
    const known = this.projectOf.get(session.id)
    if (known !== undefined) return known
    const parent = sessionParent(session)
    if (parent !== undefined) {
      this.parentOf.set(session.id, parent)
      const inherited = this.projectOf.get(parent)
      if (inherited !== undefined) {
        this.rememberProject(session.id, inherited)
        return inherited
      }
    }
    return undefined
  }

  /** Snapshot the fold for structured-clone transfer out of a worker. */
  serialize() {
    const pairs = (map) => [...map.entries()]
    return {
      totals: { ...this.totals },
      byModel: pairs(this.byModel),
      byProject: pairs(this.byProject),
      byDay: pairs(this.byDay),
      dayModel: pairs(this.dayModel).map(([day, inner]) => [day, pairs(inner)]),
      dayProject: pairs(this.dayProject).map(([day, inner]) => [day, pairs(inner)]),
      dayModelProject: pairs(this.dayModelProject).map(([day, inner]) => [day, pairs(inner).map(([model, byProject]) => [model, pairs(byProject)])]),
      dayAuxiliary: pairs(this.dayAuxiliary).map(([day, counts]) => [day, { ...counts }]),
      lastModel: pairs(this.lastModel),
      projectOf: pairs(this.projectOf),
      parentOf: pairs(this.parentOf),
      seen: pairs(this.seen),
      scan: { ...this.scan },
    }
  }

  /** Adopt a serialized fold (worker result); buckets are additive. */
  merge(part) {
    mergeInto(this.totals, part.totals)
    for (const [key, bucket] of part.byModel) mergeInto(this.bucket(this.byModel, key), bucket)
    for (const [key, bucket] of part.byProject) mergeInto(this.bucket(this.byProject, key), bucket)
    for (const [key, bucket] of part.byDay) mergeInto(this.bucket(this.byDay, key), bucket)
    for (const [day, inner] of part.dayModel) for (const [key, bucket] of inner) mergeInto(this.nestedBucket(this.dayModel, day, key), bucket)
    for (const [day, inner] of part.dayProject) for (const [key, bucket] of inner) mergeInto(this.nestedBucket(this.dayProject, day, key), bucket)
    for (const [day, byModel] of part.dayModelProject) {
      for (const [model, byProject] of byModel) for (const [project, bucket] of byProject) {
        mergeInto(this.nestedBucket3(this.dayModelProject, day, model, project), bucket)
      }
    }
    for (const [key, model] of part.lastModel) this.lastModel.set(key, model)
    for (const [key, project] of part.projectOf) this.rememberProject(key, project)
    for (const [key, parent] of part.parentOf) this.parentOf.set(key, parent)
    for (const [key, seq] of part.seen) this.seen.set(key, Math.max(this.seen.get(key) ?? 0, seq))
    for (const [day, counts] of part.dayAuxiliary ?? []) {
      const bucket = this.auxiliaryBucket(day)
      bucket.title += counts.title
      bucket.search += counts.search
      bucket.total += counts.total
    }
    this.scan = { ...this.scan, ...part.scan }
  }

  /** Known model names across every day bucket, sorted for the picker. */
  models() {
    return [...this.byModel.keys()].sort()
  }

  /**
   * Materialize totals/breakdowns for the optional window + model filter.
   * Filtering only re-aggregates existing per-day buckets — no rescan, no disk.
   */
  view(filter = null) {
    if (filter === null) {
      const sortedDays = [...this.byDay.keys()].sort()
      const trendEnd = sortedDays.length > 0 ? sortedDays[sortedDays.length - 1] : localDay(Date.now())
      const trendStart = shiftDay(trendEnd, -(TREND_DAYS - 1))
      const trendDays = []
      for (let day = trendStart; day <= trendEnd; day = shiftDay(day, 1)) {
        const bucket = this.byDay.get(day)
        trendDays.push([day, bucket === undefined ? emptyBucket() : { ...bucket }])
      }
      return {
        totals: { ...this.totals },
        byModel: this.sorted(this.byModel),
        byProject: this.sorted(this.byProject),
        byDay: Object.fromEntries([...this.byDay.entries()].sort()),
        trend: { from: trendStart, to: trendEnd, days: Object.fromEntries(trendDays) },
        auxiliary: this.auxiliaryOver([...this.dayAuxiliary.keys()].sort()),
      }
    }
    const model = filter.model
    const allDays = [...new Set([...this.byDay.keys(), ...this.dayAuxiliary.keys()])].sort()
    const days = filter.kind === 'all'
      ? allDays
      : allDays.filter((day) => (filter.kind === 'day' ? day === filter.value : day.startsWith(filter.value)))
    const totals = emptyBucket()
    const models = new Map()
    const projects = new Map()
    const byDay = {}
    for (const day of days) {
      const dayBucket = model === undefined ? this.byDay.get(day) : this.dayModel.get(day)?.get(model)
      if (dayBucket === undefined) continue
      mergeInto(totals, dayBucket)
      byDay[day] = { ...dayBucket }
      if (model === undefined) {
        for (const [name, bucket] of this.dayModel.get(day) ?? []) mergeInto(this.bucket(models, name), bucket)
        for (const [name, bucket] of this.dayProject.get(day) ?? []) mergeInto(this.bucket(projects, name), bucket)
      } else {
        mergeInto(this.bucket(models, model), dayBucket)
        for (const [name, bucket] of this.dayModelProject.get(day)?.get(model) ?? []) mergeInto(this.bucket(projects, name), bucket)
      }
    }
    const trendDays = []
    const lastDataDay = days.length > 0 ? days[days.length - 1] : undefined
    const trendEnd = filter.kind === 'day'
      ? filter.value
      : (lastDataDay ?? localDay(Date.now()))
    const trendStart = shiftDay(trendEnd, -(TREND_DAYS - 1))
    for (let day = trendStart; day <= trendEnd; day = shiftDay(day, 1)) {
      const bucket = model === undefined ? this.byDay.get(day) : this.dayModel.get(day)?.get(model)
      trendDays.push([day, bucket === undefined ? emptyBucket() : { ...bucket }])
    }
    return {
      totals,
      byModel: this.sorted(models),
      byProject: this.sorted(projects),
      byDay,
      trend: { from: trendStart, to: trendEnd, days: Object.fromEntries(trendDays) },
      auxiliary: this.auxiliaryOver(days),
    }
  }

  snapshot(filter = null) {
    this.flushStaleOrphans()
    const view = this.view(filter)
    const withTotal = (bucket) => ({ ...bucket, total: bucket.input + bucket.output + bucket.cacheRead + bucket.cacheWrite })
    const now = Date.now()
    const names = new Set([...Object.keys(view.byModel), ...this.byModel.keys()])
    const modelPricing = {}
    for (const model of names) {
      const resolved = this.pricing.priceFor(model, now)
      modelPricing[model] = resolved.status === 'priced'
        ? { status: resolved.status, id: resolved.id, label: resolved.label, hit: resolved.hit, miss: resolved.miss, out: resolved.out }
        : { status: resolved.status, reason: resolved.reason }
    }
    return {
      ok: true,
      name,
      version: VERSION,
      startedAt: this.startedAt,
      updatedAt: now,
      dshHome: this.dshHome,
      filter: filter === null ? null : { kind: filter.kind, value: filter.value ?? null, model: filter.model ?? null },
      models: this.models(),
      modelPricing,
      pricing: this.pricing.describe(now),
      auxiliary: view.auxiliary,
      scan: { ...this.scan },
      totals: withTotal(view.totals),
      byModel: Object.fromEntries(Object.entries(view.byModel).map(([k, v]) => [k, withTotal(v)])),
      byProject: Object.fromEntries(Object.entries(view.byProject).map(([k, v]) => [k, withTotal(v)])),
      byDay: Object.fromEntries(Object.entries(view.byDay).map(([k, v]) => [k, withTotal(v)])),
      trend: {
        from: view.trend.from,
        to: view.trend.to,
        days: Object.fromEntries(Object.entries(view.trend.days).map(([k, v]) => [k, withTotal(v)])),
      },
    }
  }

  handle(req, res) {
    res.setHeader('cache-control', 'no-store')
    if (req.method !== 'GET') {
      res.writeHead(405, { 'content-type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ ok: false, error: 'method not allowed' }))
      return
    }
    if (!LOOPBACK.has(req.socket?.remoteAddress)) {
      const origin = req.headers.origin
      const sameOrigin = req.headers['sec-fetch-site'] === 'same-origin'
        && typeof origin === 'string'
        && typeof req.headers.host === 'string'
      let trusted = false
      if (sameOrigin) {
        try {
          trusted = new URL(origin).host === req.headers.host
        } catch {
          trusted = false
        }
      }
      if (!(this.allowRemote && trusted)) {
        res.writeHead(403, { 'content-type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify({ ok: false, error: 'loopback only; set allowRemote for trusted same-origin access' }))
        return
      }
    }
    const params = new URL(req.url, 'http://localhost').searchParams
    const day = params.get('day')
    const month = params.get('month')
    const rawModel = params.get('model')
    const model = rawModel !== null && rawModel.length > 0 && rawModel.length <= 200 ? rawModel : undefined
    let filter = null
    if (day !== null && month !== null) {
      res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ ok: false, error: 'use exactly one of day or month' }))
      return
    }
    if (day !== null) {
      if (!DAY_RE.test(day)) {
        res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify({ ok: false, error: 'day must be YYYY-MM-DD' }))
        return
      }
      filter = { kind: 'day', value: day, model }
    } else if (month !== null) {
      if (!MONTH_RE.test(month)) {
        res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify({ ok: false, error: 'month must be YYYY-MM' }))
        return
      }
      filter = { kind: 'month', value: month, model }
    } else if (model !== undefined) {
      filter = { kind: 'all', value: undefined, model }
    }
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify(this.snapshot(filter)))
  }
}

/**
 * Register the tracker once the profile's webServer service exists.
 * @param ctx - host context from the cordis loader.
 * @param config - loader config: `endpoint`, `scanAtBoot`, `allowRemote` and
 * `pricing` (`enabled`, `currency`, `refreshHour`, `url`, `timeoutMs`).
 */
export function apply(ctx, config = {}) {
  const endpoint = typeof config.endpoint === 'string' && config.endpoint.length > 0 ? config.endpoint : '/dsh-token-use'
  const scanAtBoot = config.scanAtBoot !== false
  ctx.inject(['webServer'], (host) => {
    const dshHome = resolveDshHome()
    const pricing = new PricingStore(dshHome, config.pricing ?? {})
    const tracker = new UsageTracker(dshHome, { allowRemote: config.allowRemote === true, pricing })
    host.effect(() => {
      pricing.start()
      return () => pricing.stop()
    }, 'dsh-token-use: daily price refresh')
    host.on('session/event', (session, event) => {
      tracker.fold(session, event)
    }, { global: true })
    host.effect(() => {
      const dispose = host.webServer.register({
        kind: 'exact',
        path: endpoint,
        handler: (req, res) => tracker.handle(req, res),
      })
      return () => dispose()
    }, 'dsh-token-use: http route')
    if (scanAtBoot) {
      tracker.scanSessions().catch((error) => {
        tracker.scan.error = String(error?.stack ?? error)
      })
    }
  })
}
