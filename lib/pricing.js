/**
 * DeepSeek API pricing for the usage dashboard.
 *
 * One HTTPS fetch per day at a fixed local hour (12:00 by default), an
 * on-disk snapshot cache so restarts and offline runs keep working, and a
 * bundled fallback for the very first run. Prices are per 1M tokens and are
 * published per peak/off-peak window, so every recorded call is priced with
 * the rate in effect at the moment it happened — a later price change never
 * rewrites history.
 *
 * Only DeepSeek models are priced: a model name that does not name DeepSeek
 * (claude, gpt, …) is reported as `excluded` and contributes no amount.
 *
 * @module dsh-token-use/pricing
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export const URL_BY_CURRENCY = {
  CNY: 'https://api-docs.deepseek.com/zh-cn/quick_start/pricing',
  USD: 'https://api-docs.deepseek.com/quick_start/pricing',
}

const SYMBOL_BY_CURRENCY = { CNY: '¥', USD: '$' }
const REFRESH_HOUR = 12
const TIMEOUT_MS = 15000
const RETRY_MS = 3600e3
const MAX_SNAPSHOTS = 30
const USER_AGENT = 'dsh-token-use (+https://github.com/huangyuheng/dsh-token-use)'

/** Official peak window: UTC weekday mornings 01-04 and 06-10 (off-peak is half price). */
const DEFAULT_PEAK = { days: [1, 2, 3, 4, 5], hoursUtc: [[1, 4], [6, 10]] }

/** Built-in snapshot, used only until the first successful fetch. */
const BUILT_IN = {
  CNY: [
    { id: 'deepseek-flash', label: 'DeepSeek-V4.1-Flash', hit: { off: 0.02, peak: 0.04 }, miss: { off: 1, peak: 2 }, out: { off: 4, peak: 8 } },
    { id: 'deepseek-v4-pro', label: 'DeepSeek-V4-Pro-0813', hit: { off: 0.15, peak: 0.3 }, miss: { off: 4.5, peak: 9 }, out: { off: 13.5, peak: 27 } },
  ],
  USD: [
    { id: 'deepseek-flash', label: 'DeepSeek-V4.1-Flash', hit: { off: 0.003, peak: 0.006 }, miss: { off: 0.15, peak: 0.3 }, out: { off: 0.6, peak: 1.2 } },
    { id: 'deepseek-v4-pro', label: 'DeepSeek-V4-Pro-0813', hit: { off: 0.022, peak: 0.044 }, miss: { off: 0.66, peak: 1.32 }, out: { off: 1.98, peak: 3.96 } },
  ],
}

function builtIn(currency) {
  const key = BUILT_IN[currency] === undefined ? 'CNY' : currency
  return {
    fetchedAt: 0,
    source: 'built-in snapshot · DeepSeek official pricing 2026-09-14',
    currency: key,
    symbol: SYMBOL_BY_CURRENCY[key],
    peak: DEFAULT_PEAK,
    peakParsed: true,
    builtIn: true,
    models: BUILT_IN[key].map((model) => ({ ...model, hit: { ...model.hit }, miss: { ...model.miss }, out: { ...model.out } })),
  }
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" }

/** Plain text of an HTML fragment: tags dropped, entities resolved, space collapsed. */
function textOf(html) {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&(#?\w+);/g, (match, name) => ENTITIES[name] ?? match)
    .replace(/\s+/g, ' ')
    .trim()
}

function numberIn(text) {
  const match = /-?\d+(?:\.\d+)?/.exec(text.replace(/,/g, ''))
  return match === null ? undefined : Number(match[0])
}

/** Hour ranges from a clause such as `01:00 - 04:00 and 06:00 - 10:00`. */
function hourRanges(clause, shift) {
  const ranges = []
  for (const match of clause.matchAll(/(\d{1,2}):(\d{2})\s*[-–~]\s*(\d{1,2}):(\d{2})/g)) {
    if (match[2] !== '00' || match[4] !== '00') return undefined
    const from = (Number(match[1]) - shift + 24) % 24
    const to = (Number(match[3]) - shift + 24) % 24
    if (from >= to) return undefined
    ranges.push([from, to])
  }
  return ranges.length === 0 ? undefined : ranges
}

/**
 * Peak/off-peak window from the pricing page's footnote. Returns undefined when
 * the wording is not recognised, so the caller keeps the previous window.
 */
export function parsePeak(pageText) {
  const english = /Peak hours are ([^.]+)/i.exec(pageText)
  if (english !== null) {
    const hoursUtc = hourRanges(english[1], 0)
    const weekdays = /Monday\s+through\s+Friday/i.test(english[1]) ? [1, 2, 3, 4, 5] : undefined
    if (hoursUtc !== undefined && weekdays !== undefined) return { days: weekdays, hoursUtc }
  }
  const chinese = /高峰时段为北京时间([^（(。]+)/.exec(pageText)
  if (chinese !== null) {
    const hoursUtc = hourRanges(chinese[1], 8)
    const weekdays = /周一至周五/.test(chinese[1]) ? [1, 2, 3, 4, 5] : undefined
    if (hoursUtc !== undefined && weekdays !== undefined) return { days: weekdays, hoursUtc }
  }
  return undefined
}

/**
 * Parse the official pricing table. Both the Chinese and the English page share
 * one table shape: a model row, a model-version row, then price rows labelled
 * cache-hit / cache-miss / output, each with an off-peak and a peak line.
 * @throws when no price row could be read — the caller keeps its last snapshot.
 */
export function parsePricing(html, options = {}) {
  const pageText = textOf(html)
  const table = /<table[\s\S]*?<\/table>/i.exec(html)
  if (table === null) throw new Error('no pricing table in the response')
  const rows = table[0].split(/<tr[^>]*>/i).slice(1).map((row) => [...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) => textOf(cell[1])))
  const header = rows.find((cells) => /^(MODEL|模型)$/i.test(cells[0] ?? ''))
  if (header === undefined) throw new Error('no model header row in the pricing table')
  const ids = header.slice(1).map((cell) => cell.replace(/\(\d+\)/g, '').trim()).filter((id) => id.length > 0)
  const versionRow = rows.find((cells) => /^(MODEL VERSION|模型版本)$/i.test(cells[0] ?? ''))
  const labels = versionRow === undefined ? [] : versionRow.slice(1)
  if (ids.length === 0) throw new Error('no model columns in the pricing table')
  const models = ids.map((id, index) => ({ id, label: labels[index] ?? id, hit: {}, miss: {}, out: {} }))
  // The table groups each price with `rowspan`, so only the first row of a
  // group names the field ("cache hit", …); later rows inherit it.
  let field
  for (const cells of rows) {
    const joined = cells.join(' ')
    const tier = /OFF-?\s?PEAK|空闲时段/i.test(joined) ? 'off' : /PEAK|高峰时段/i.test(joined) ? 'peak' : undefined
    if (tier === undefined) continue
    field = /CACHE\s+MISS|缓存未命中/i.test(joined) ? 'miss' : /CACHE\s+HIT|缓存命中/i.test(joined) ? 'hit' : /OUTPUT|输出/i.test(joined) ? 'out' : field
    if (field === undefined) continue
    const values = cells.slice(cells.length - ids.length).map(numberIn)
    if (values.length !== ids.length || values.some((value) => value === undefined)) continue
    values.forEach((value, index) => { models[index][field][tier] = value })
  }
  const complete = models.filter((model) => ['hit', 'miss', 'out'].every((field) => typeof model[field].off === 'number' && typeof model[field].peak === 'number'))
  if (complete.length === 0) throw new Error('no complete price rows in the pricing table')
  const currency = options.currency === 'USD' || pageText.includes('$') ? 'USD' : 'CNY'
  const peak = parsePeak(pageText)
  return {
    fetchedAt: options.fetchedAt ?? Date.now(),
    source: options.source ?? URL_BY_CURRENCY[currency],
    currency,
    symbol: SYMBOL_BY_CURRENCY[currency],
    peak: peak ?? { days: [...DEFAULT_PEAK.days], hoursUtc: DEFAULT_PEAK.hoursUtc.map((range) => [...range]) },
    peakParsed: peak !== undefined,
    models: complete,
  }
}

/** Is `time` inside the published peak window? */
export function isPeakAt(time, peak) {
  const date = new Date(time)
  if (!peak.days.includes(date.getUTCDay())) return false
  const hour = date.getUTCHours()
  return peak.hoursUtc.some(([from, to]) => hour >= from && hour < to)
}

/** Money for one usage record: cache-miss input, cache-hit input and output, per 1M tokens. */
export function costOf(usage, entry, peak) {
  const tier = peak ? 'peak' : 'off'
  const miss = Number(usage.inputTokens) || 0
  const hit = Number(usage.cacheReadTokens) || 0
  const out = Number(usage.outputTokens) || 0
  return (miss * entry.miss[tier] + hit * entry.hit[tier] + out * entry.out[tier]) / 1e6
}

/** Distinct, non-version tokens of a model name — the words that identify a family. */
function familyTokens(name) {
  return String(name)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1 && !/^\d/.test(token) && token !== 'deepseek')
}

/**
 * Map one locally configured model name onto an official price entry.
 * A name without "deepseek" in it is `excluded`; a DeepSeek name whose family
 * word matches no entry is `unmatched` — neither contributes an amount.
 */
export function resolveModel(name, snapshot) {
  if (name === undefined || name === null || String(name).length === 0) return { status: 'excluded', reason: 'no model reported' }
  const base = String(name).toLowerCase().split('/').pop() ?? ''
  if (!base.includes('deepseek')) return { status: 'excluded', reason: 'not a DeepSeek model' }
  const tokens = familyTokens(base)
  let best
  let bestScore = 0
  for (const model of snapshot.models) {
    const entryTokens = familyTokens(`${model.id} ${model.label ?? ''}`)
    const score = entryTokens.filter((token) => tokens.includes(token)).length
    if (score > bestScore) {
      bestScore = score
      best = model
    }
  }
  if (best === undefined) return { status: 'unmatched', reason: 'no official price entry matches this model name' }
  return { status: 'priced', id: best.id, label: best.label, hit: best.hit, miss: best.miss, out: best.out }
}

/** Snapshot history, oldest first: drop unusable entries and cap the tail. */
function normalizeSnapshots(snapshots) {
  const list = Array.isArray(snapshots) ? snapshots : []
  return list
    .filter((snapshot) => Array.isArray(snapshot?.models) && snapshot.models.length > 0)
    .map((snapshot) => (typeof snapshot.peak?.days?.[0] === 'number' ? snapshot : { ...snapshot, peak: builtIn(snapshot.currency).peak }))
    .sort((a, b) => a.fetchedAt - b.fetchedAt)
    .slice(-MAX_SNAPSHOTS)
}

/**
 * Price book: the snapshot history, its disk cache, and the daily refresh.
 * `pricingAt(time)` makes a day/month view quote the rates of that moment.
 */
export class PricingStore {
  /**
   * @param dshHome - Harness home; the snapshot cache lives under it.
   * @param options - `enabled`, `currency`, `refreshHour`, `url`, `timeoutMs`.
   * @param imported - snapshot list to use instead of the cache file (worker threads).
   */
  constructor(dshHome, options = {}, imported = undefined) {
    this.dir = join(dshHome, 'dsh-token-use')
    this.path = join(this.dir, 'pricing.json')
    this.enabled = options.enabled !== false
    this.currency = options.currency === 'USD' ? 'USD' : 'CNY'
    this.refreshHour = Number.isInteger(options.refreshHour) && options.refreshHour >= 0 && options.refreshHour <= 23 ? options.refreshHour : REFRESH_HOUR
    this.url = typeof options.url === 'string' && options.url.length > 0 ? options.url : URL_BY_CURRENCY[this.currency]
    this.timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : TIMEOUT_MS
    this.snapshots = []
    this.retryAt = 0
    this.meta = { error: null, lastAttemptAt: 0, nextRefreshAt: 0 }
    this.timer = null
    this.entries = new WeakMap()
    if (imported === undefined) this.load()
    else this.snapshots = normalizeSnapshots(imported)
  }

  /** Price book for a worker thread: the host's snapshots, no cache, no timers. */
  static hydrate(data) {
    const currency = data?.currency === 'USD' ? 'USD' : 'CNY'
    return new PricingStore(process.cwd(), { enabled: false, currency }, Array.isArray(data?.snapshots) ? data.snapshots : [])
  }

  /** Cached snapshots from disk (synchronous: the boot scan prices from them). */
  load() {
    let stored
    try {
      stored = JSON.parse(readFileSync(this.path, 'utf8'))
    } catch {
      stored = undefined
    }
    this.snapshots = normalizeSnapshots(stored?.snapshots)
    if (stored?.error !== undefined) this.meta.error = stored.error ?? null
  }

  /** Rate in effect at `time`: the newest snapshot taken before it. */
  pricingAt(time) {
    const at = Number.isFinite(time) ? time : Date.now()
    let chosen
    for (const snapshot of this.snapshots) {
      if (snapshot.fetchedAt <= at) chosen = snapshot
      else break
    }
    return chosen ?? this.snapshots[0] ?? builtIn(this.currency)
  }

  /** Resolved price for one model name, memoized per snapshot. */
  priceFor(name, time) {
    const snapshot = this.pricingAt(time)
    let cache = this.entries.get(snapshot)
    if (cache === undefined) {
      cache = new Map()
      this.entries.set(snapshot, cache)
    }
    let resolved = cache.get(name)
    if (resolved === undefined) {
      resolved = resolveModel(name, snapshot)
      cache.set(name, resolved)
    }
    return resolved
  }

  /** Money for one usage record, or 0 when the model is not a priced DeepSeek one. */
  costOf(usage, name, time) {
    const resolved = this.priceFor(name, time)
    if (resolved.status !== 'priced') return 0
    return costOf(usage, resolved, isPeakAt(Number.isFinite(time) ? time : Date.now(), this.pricingAt(time).peak))
  }

  nextRefreshAt(now = Date.now()) {
    const next = new Date(now)
    next.setHours(this.refreshHour, 0, 0, 0)
    if (next.getTime() <= now) next.setDate(next.getDate() + 1)
    return next.getTime()
  }

  persist() {
    try {
      mkdirSync(this.dir, { recursive: true })
      const payload = JSON.stringify({ version: 1, snapshots: this.snapshots.slice(-MAX_SNAPSHOTS), error: this.meta.error })
      const temporary = `${this.path}.tmp`
      writeFileSync(temporary, payload)
      renameSync(temporary, this.path)
    } catch (error) {
      this.meta.error = `could not cache prices: ${String(error?.message ?? error)}`
    }
  }

  /** Fetch and store today's prices. Never throws; failures keep the last snapshot. */
  async refresh(now = Date.now()) {
    if (!this.enabled) return false
    this.meta.lastAttemptAt = now
    try {
      const response = await fetch(this.url, {
        redirect: 'follow',
        headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml' },
        signal: AbortSignal.timeout(this.timeoutMs),
      })
      if (!response.ok) throw new Error(`http ${response.status}`)
      const snapshot = parsePricing(await response.text(), { currency: this.currency, source: this.url, fetchedAt: Date.now() })
      this.snapshots = [...this.snapshots.filter((stored) => stored.fetchedAt !== snapshot.fetchedAt), snapshot].sort((a, b) => a.fetchedAt - b.fetchedAt).slice(-MAX_SNAPSHOTS)
      this.retryAt = 0
      this.meta.error = null
      this.persist()
      return true
    } catch (error) {
      this.meta.error = String(error?.message ?? error)
      this.retryAt = now + RETRY_MS
      this.persist()
      return false
    }
  }

  /** Refresh now when today's slot has not been fetched yet, then arm the daily timer. */
  start(now = Date.now()) {
    if (!this.enabled) return
    const slot = this.nextRefreshAt(now) - 24 * 3600e3
    const current = this.snapshots[this.snapshots.length - 1]
    if (current === undefined || current.fetchedAt < slot) this.refresh(now).catch(() => {})
    this.schedule(now)
  }

  schedule(now = Date.now()) {
    const at = this.retryAt > now ? this.retryAt : this.nextRefreshAt(now)
    this.meta.nextRefreshAt = at
    if (this.timer !== null) clearTimeout(this.timer)
    this.timer = setTimeout(() => {
      this.refresh().finally(() => this.schedule())
    }, Math.max(1000, at - now))
    this.timer.unref?.()
  }

  describe(now = Date.now()) {
    const current = this.snapshots[this.snapshots.length - 1] ?? builtIn(this.currency)
    return {
      enabled: this.enabled,
      currency: current.currency,
      symbol: current.symbol,
      source: current.source,
      fetchedAt: current.fetchedAt,
      builtIn: current.builtIn === true,
      peakParsed: current.peakParsed !== false,
      peak: current.peak,
      error: this.meta.error,
      nextRefreshAt: this.meta.nextRefreshAt > 0 ? this.meta.nextRefreshAt : this.nextRefreshAt(now),
      refreshHour: this.refreshHour,
      snapshots: this.snapshots.length,
      models: current.models.map((model) => ({ id: model.id, label: model.label, hit: model.hit, miss: model.miss, out: model.out })),
    }
  }

  stop() {
    if (this.timer !== null) clearTimeout(this.timer)
    this.timer = null
  }
}
