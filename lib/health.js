/**
 * Harness self-check: the failure modes a plugin install can leave behind.
 *
 * A broken profile rarely announces itself — the service starts, the panel
 * loads, and one plugin is silently missing (its entry file never shipped, its
 * bundle patch is gone, or two copies of cordis fight over the same hooks).
 * This module walks the running profile on disk, so the panel can say which
 * plugin is incomplete and why. What the *browser* can actually load is checked
 * on the client side, where the boot manifest lives.
 *
 * The report is data, not prose: rows carry a `code`/`hint` the client
 * translates, and `detail` holds only language-neutral facts (paths, versions).
 *
 * Everything here is read-only, and every probe is wrapped: a check that cannot
 * run reports `unknown` rather than breaking the report.
 *
 * @module dsh-token-use/health
 */
import { existsSync, readFileSync, readdirSync, realpathSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { compareVersions, installedVersion } from './versions.js'

/** A plugin's `dsh` block, tolerant of a missing or oddly shaped one. */
function dshBlock(pkg) {
  const block = pkg?.dsh
  return block !== null && typeof block === 'object' ? block : {}
}

/** Worst-first status across rows. */
function worst(items, fallback = 'ok') {
  if (items.length === 0) return fallback
  if (items.some((item) => item.status === 'error')) return 'error'
  if (items.some((item) => item.status === 'warn')) return 'warn'
  if (items.every((item) => item.status === 'unknown')) return 'unknown'
  return 'ok'
}

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return undefined
  }
}

/** The profile whose dependency list names this plugin. */
export function findProfile(dshHome, name) {
  const root = join(dshHome, 'profiles')
  let entries
  try {
    entries = readdirSync(root)
  } catch {
    return undefined
  }
  for (const entry of entries) {
    const dir = join(root, entry)
    const pkg = readJson(join(dir, 'package.json'))
    if (pkg === undefined) continue
    const deps = Object.keys(pkg.dependencies ?? {})
    const bundles = dshBlock(pkg).profile?.bundles ?? []
    if (deps.includes(name) || bundles.includes(name)) return { name: entry, dir, pkg }
  }
  return undefined
}

/** One installed package inside the profile, symlinks resolved. */
function packageIn(profile, name) {
  const link = join(profile.dir, 'node_modules', name)
  const pkg = readJson(join(link, 'package.json'))
  if (pkg === undefined) return undefined
  let dir = link
  try {
    dir = realpathSync(link)
  } catch {
    // keep the un-resolved path: it exists, we just cannot canonicalise it
  }
  return { dir, pkg, linked: dir !== link }
}

/** The file a loader resolves for a subpath such as `.` or `./client`. */
function subpathEntry(dir, pkg, subpath) {
  const exports = pkg.exports
  const direct = typeof exports === 'string' && subpath === '.' ? exports : undefined
  const field = typeof exports === 'object' && exports !== null ? exports[subpath] : undefined
  const rel = direct
    ?? (typeof field === 'string' ? field : field?.default)
    ?? (subpath === '.' ? pkg.main : undefined)
  if (typeof rel !== 'string' || rel.length === 0) return undefined
  return join(dir, rel)
}

/** Every `@deepseek-ai/cordis` copy reachable from `fromDir`, with its version. */
function cordisFrom(fromDir) {
  let dir = fromDir
  for (let i = 0; i < 12; i++) {
    const file = join(dir, 'node_modules', '@deepseek-ai', 'cordis', 'package.json')
    if (existsSync(file)) {
      const pkg = readJson(file)
      let real = file
      try {
        real = realpathSync(file)
      } catch {
        // keep the unresolved path
      }
      return { real, version: typeof pkg?.version === 'string' ? pkg.version : 'unknown' }
    }
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return undefined
}

/**
 * Walk the profile that runs this plugin and report every plugin-level problem
 * that could keep it out of the running service.
 *
 * @param options - `dshHome`, the plugin `name` and the running `commandVersion`.
 * @returns `{ ok, profile, checks }` — checks group per-plugin rows.
 */
export function checkHarness({ dshHome, name, commandVersion }) {
  const checks = []
  const profile = findProfile(dshHome, name)
  if (profile === undefined) {
    return {
      ok: false,
      profile: null,
      // The summary already names the searched root, so no hint is needed here.
      checks: [{ id: 'profile', status: 'error', hint: null, data: { root: join(dshHome, 'profiles') }, items: [] }],
    }
  }

  const integrity = []
  const nodeModules = join(profile.dir, 'node_modules')
  const hasModules = existsSync(nodeModules)
  integrity.push({
    name: 'node_modules',
    status: hasModules ? 'ok' : 'error',
    code: hasModules ? null : 'modules-missing',
    detail: nodeModules,
    hint: hasModules ? null : 'install',
  })
  for (const lock of ['pnpm-lock.yaml', 'package-lock.json', 'yarn.lock']) {
    if (existsSync(join(profile.dir, lock))) integrity.push({ name: lock, status: 'ok', code: null, detail: lock })
  }
  const bundles = dshBlock(profile.pkg).profile?.bundles ?? []
  integrity.push({
    name: 'bundles',
    status: bundles.length > 0 ? 'ok' : 'warn',
    code: bundles.length > 0 ? null : 'bundles-empty',
    detail: String(bundles.length),
    hint: bundles.length > 0 ? null : 'bundles-empty',
  })
  checks.push({
    id: 'profile',
    status: worst(integrity),
    data: { name: profile.name, dir: profile.dir },
    items: integrity,
  })

  // Per-plugin files on disk. Harness bundles (@deepseek-ai/…) are supplied by
  // the service package rather than the profile, so they are not files to check.
  const items = []
  const cordisCopies = new Map()
  const rememberCordis = (label, fromDir) => {
    const found = cordisFrom(fromDir)
    if (found === undefined) return
    if (!cordisCopies.has(found.real)) cordisCopies.set(found.real, { version: found.version, owners: [] })
    cordisCopies.get(found.real).owners.push(label)
  }

  for (const bundle of bundles) {
    const found = packageIn(profile, bundle)
    if (found === undefined) {
      items.push(bundle.startsWith('@deepseek-ai/')
        ? { name: bundle, client: false, status: 'ok', code: 'provided', detail: '', hint: null }
        : { name: bundle, client: false, status: 'error', code: 'not-installed', detail: '', hint: 'add' })
      continue
    }
    const problems = []
    const entry = subpathEntry(found.dir, found.pkg, '.')
    if (entry === undefined) problems.push({ code: 'entry-undeclared', detail: '', status: 'warn' })
    else if (!existsSync(entry)) problems.push({ code: 'entry-missing', detail: entry, status: 'error' })

    const patch = dshBlock(found.pkg).bundle?.patch
    if (typeof patch === 'string' && !existsSync(join(found.dir, patch))) {
      problems.push({ code: 'patch-missing', detail: patch, status: 'error' })
    }

    const declaresClient = dshBlock(found.pkg).client !== undefined
    if (declaresClient) {
      const clientFile = subpathEntry(found.dir, found.pkg, './client')
      if (clientFile === undefined) problems.push({ code: 'client-undeclared', detail: '', status: 'warn' })
      else if (!existsSync(clientFile)) problems.push({ code: 'client-missing', detail: clientFile, status: 'error' })
    }
    rememberCordis(bundle, found.dir)
    items.push({
      name: bundle,
      client: declaresClient,
      version: found.pkg.version,
      status: worst(problems.map((problem) => ({ status: problem.status }))),
      code: problems.length === 0 ? null : problems.map((problem) => problem.code).join('+'),
      detail: problems.length === 0
        ? `v${found.pkg.version}${found.linked ? ' (linked)' : ''}`
        : problems.map((problem) => problem.detail).filter((text) => text.length > 0).join('; '),
      hint: problems.length === 0 ? null : 'reinstall',
    })
  }
  checks.push({
    id: 'plugins',
    status: worst(items),
    data: { total: items.length, ok: items.filter((item) => item.status === 'ok').length },
    items,
  })

  const deps = Object.entries(profile.pkg.dependencies ?? {}).map(([dep, range]) => {
    const found = packageIn(profile, dep)
    if (found === undefined) {
      return { name: dep, status: 'error', code: 'not-installed', detail: String(range), hint: 'install' }
    }
    return { name: dep, status: 'ok', code: null, detail: `v${found.pkg.version}${found.linked ? ' (linked)' : ''}` }
  })
  checks.push({ id: 'deps', status: worst(deps), data: { count: deps.length }, items: deps })

  rememberCordis(profile.name, profile.dir)
  const cordisItems = [...cordisCopies.entries()].map(([file, record]) => ({
    name: record.owners.length === 2 && record.owners[0] === profile.name ? record.owners[1] : record.owners.join(', '),
    status: 'ok',
    code: null,
    detail: `v${record.version} · ${dirname(dirname(file))}`,
  }))
  const cordisVersions = [...new Set([...cordisCopies.values()].map((record) => record.version))]
  const cordisStatus = cordisVersions.length > 1 ? 'error' : cordisCopies.size > 1 ? 'warn' : 'ok'
  checks.push({
    id: 'cordis',
    status: cordisStatus,
    data: { copies: cordisCopies.size, versions: cordisVersions.length },
    items: cordisItems,
    hint: cordisStatus === 'ok' ? null : (cordisVersions.length > 1 ? 'cordis-mixed' : 'cordis-duplicate'),
  })

  const harness = ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app']
  const versionItems = harness.map((dep) => {
    const installed = installedVersion(dep)
    if (installed === undefined) return { name: dep, status: 'warn', code: 'unresolved', detail: '', hint: null }
    const same = typeof commandVersion !== 'string' || commandVersion.length === 0 || compareVersions(installed, commandVersion) === 0
    return {
      name: dep,
      status: same ? 'ok' : 'warn',
      code: same ? null : 'service-mismatch',
      detail: `v${installed}`,
      hint: same ? null : 'service-version',
    }
  })
  const own = installedVersion(name)
  versionItems.push({
    name,
    status: own === undefined ? 'warn' : 'ok',
    code: own === undefined ? 'unresolved' : null,
    detail: own === undefined ? '' : `v${own}`,
  })
  const versionHint = worst(versionItems) === 'ok' ? null : 'service-version'
  checks.push({
    id: 'versions',
    status: worst(versionItems),
    data: { commandVersion: typeof commandVersion === 'string' ? commandVersion : null },
    items: versionItems,
    hint: versionHint,
  })

  return {
    // `ok` means "nothing broken": a warning is information, not a failure.
    ok: checks.every((check) => check.status !== 'error'),
    profile: { name: profile.name, dir: profile.dir },
    checks,
  }
}
