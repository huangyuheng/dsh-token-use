# dsh-token-use

[中文](README.md) | English

[![Awesome DSH Plugin](https://awesome-dsh-plugin.com/badge.svg)](https://awesome-dsh-plugin.com)

A real-time token usage and cost plugin for DeepSeek Harness: install it, then read your usage in **Settings → Token usage** (the plugin adds its own top-level Settings entry). The page refreshes every 5 seconds and stays quiet while the tab is hidden — no wasted polling.

## Features

- **Cost card** — spend estimated live from DeepSeek's published prices × the usage recorded here, with peak/off-peak rates. Every card (totals, trend, by model, by day, by project) carries an amount.
- **Daily price book** — the official pricing page is fetched once a day at **12:00** and cached locally, so restarts keep it and an offline machine falls back to a built-in snapshot.
- **Totals card** — estimated cost, total (input + output + cache), input, output, cache read, cache write, reasoning, calls.
- **Per-model pricing** — cache-hit input, cache-miss input and output are priced separately per model; anything that is not a DeepSeek model (claude, gpt, …) is never counted and shows `—`.
- **Range tabs** — by day / by month / all, with a date or month picker; defaults to by day = today.
- **Model filter** — the dropdown beside the range tabs narrows every breakdown to one model (including that model's project and per-day rows); defaults to all models.
- **Trend chart** — drawn with a tree-shaken ECharts bundle that ships inside the plugin (no CDN). Cache read / input / output stack into an **area composition** whose top edge is the total (with a total reference line), each day's amount is drawn as **cost bars** against a ¥ axis, and calls live in the tooltip. The card switches between **7 / 30 / 90 days (7 by default)**. A day without usage is a real zero (stacking needs it), and the tooltip still names it; tick labels keep one unit across an axis and monotone smoothing never overshoots. Rendering is imperative, so moving the mouse never re-renders React.
- **Unit switch** — 亿 / 万 / 千 in Chinese, B / M / K in English; remembered per browser.
- **Detail tables** — by model, by day and by project, each with an amount column (hover a row for its rates) and a total column.

## The amounts are estimates

The amount card (the last of the totals cards) carries an ⓘ icon — hover it for the full note:

> Amounts are estimates: DeepSeek's published prices × the usage recorded here, priced with the peak/off-peak rate in effect at each call. Official price changes, cache accounting and reporting lag can make this differ from your actual bill — the official settlement prevails.

How it is computed:

- Priced fields: `inputTokens` (cache-miss input), `cacheReadTokens` (cache-hit input), `outputTokens` (includes reasoning); DeepSeek does not charge for cache writes.
- Peak/off-peak: the pricing page publishes a peak window (currently 01:00–04:00 and 06:00–10:00 UTC on weekdays, with off-peak at half price). **Each record is priced with the rate in effect when it happened**, so a later price change never rewrites history.
- DeepSeek models only: a model whose name does not contain `deepseek` (claude, gpt, minimax, …) contributes no amount, and neither does a DeepSeek name that matches no official price entry — both are listed in the ⓘ note.
- **What it leaves out**: auxiliary calls such as web search and session-title generation are billed, but their tokens stay server-side where nothing local can read them. They are therefore counted by number and never guessed at, and the ⓘ note lists how many happened in the window — which makes this amount a **lower bound** on the bill. Checked against an official hourly export: every call we do count matches it token for token and tier for tier.
- Currency defaults to CNY (the Chinese pricing page); set `currency: USD` to read the English one.


## Why it is worth installing

You are burning tokens, but you cannot say where: which project costs the most, which model leans hardest on the cache, how much this week grew over last week.

**dsh-token-use turns that into numbers you can read at a glance.** It folds every call as it happens, then lays cost, totals, input, output, cache hits, reasoning and call counts out in the settings page, with filters by model, day, month or project and a smooth trend line that tells the story. Install it and you are done: nothing to configure, no session restart, and it never pops up while you are coding.

The most expensive cost is the one you cannot see — make it visible.

![Token usage panel: range and model filters, the cost and totals cards, the 7/30/90-day trend chart (stacked composition + cost bars), and the by-model / by-day / by-project tables with amounts](assets/token-usage.jpg)

## Install

```sh
dsh plugin --profile web add dsh-token-use
# or from source: dsh plugin --profile web add github:huangyuheng/dsh-token-use
```

Restart `dsh web` afterwards. To install from an unpacked zip instead:

```sh
dsh plugin --profile web add /path/to/dsh-token-use
```

## Performance design

- The host side **never polls and sets no periodic timer** other than the daily price refresh: it folds usage in O(1) increments from the `session/event` bus (one dictionary addition and one multiplication per `assistant/message`).
- History is rebuilt **once** at boot by streaming `$DSH_HOME/sessions/**/session.jsonl.zstd` (native zstd from `node:zlib`), yielding the event loop between files (`scheduler.yield()`) so session handling is never blocked. A per-session sequence watermark de-duplicates the rebuild against live events, whatever order they arrive in.
- **Price refresh**: one HTTPS GET per day at 12:00 local time (15 s timeout, retried an hour later on failure), stored atomically in `$DSH_HOME/dsh-token-use/pricing.json` (up to 30 snapshots). A restart reads the cache synchronously and does not re-fetch; a failed fetch falls back to the built-in snapshot, so the panel always shows numbers.
- One read-only JSON endpoint is exposed: `GET /dsh-token-use` (loopback only, in-memory snapshot, `no-store`).

```sh
# everything
curl http://127.0.0.1:3080/dsh-token-use
# a date / a month
curl 'http://127.0.0.1:3080/dsh-token-use?month=2026-09'
curl 'http://127.0.0.1:3080/dsh-token-use?day=2026-09-10'
# a model (combinable with day/month)
curl 'http://127.0.0.1:3080/dsh-token-use?model=deepseek-v4-flash'
```

Every bucket carries a `cost` (the estimate); `pricing` holds the current price book, when it was fetched and when it refreshes next; `modelPricing` maps each observed model to its rates or to the reason it carries no amount.

## Development

```sh
pnpm install          # development only (esbuild + echarts)
pnpm run build        # regenerate client/client.js (= tree-shaken ECharts + client/src.js)
```

`client/client.js` is a committed build artifact, so users install nothing and build nothing.

Published to npm as `dsh-token-use`; its `repository` field points back here, which is how the official market links the package and shows download counts. To cut a release: bump `version`, run `npm publish`, and users pick it up with `dsh plugin update` or the market's update button.

## Field definitions

- `input` / `output` — input and output tokens as reported by the API.
- `cacheRead` / `cacheWrite` — prompt cache read/write tokens (the API counts cache reads on the input side for billing).
- `reasoning` — reasoning tokens.
- `cost` — the estimate from those fields and the rates in effect; cache writes are not billed and reasoning is already inside output, so nothing is counted twice.
- `auxiliary` — how many auxiliary calls in the window the amount leaves out (`search` web search, `title` session titles).
- Model attribution — the model of the session's most recent `request/header`; small calls that carry no usage record (title generation, for example) are not counted.
- Project attribution — the `cwd` in the session's creation header (live events read `session.header.cwd`, history reads the log header); subagent and forked sessions inherit their parent's project; usage that cannot be attributed yet is held and back-filled as soon as it resolves, only reaching `(no cwd)` after 30 seconds. |

## Compatibility

These differences are already handled before anyone else installs the plugin:

| Dimension | Notes |
| --- | --- |
| Runtime | Requires **dsh web ≥ 0.1.0-rc.6** (the settings sidebar `settings.section` slot). The host half uses Node built-ins only; zstd decoding uses `node:zlib` (built in from Node 22.15, and dsh itself requires ^22.19 \|\| >=24, so it is always present). |
| Settings rail glyph | The shell hardcodes the rail glyph per section id and falls back to the same settings gear for every unknown id (ours and the market plugin's alike) — a slot registration cannot name an icon. The plugin masks its own bar-chart glyph over that gear with a structure-only selector anchored on a marker class inside its own label: no dependency on the shell's hashed class names, and if a future shell changes the markup the selector stops matching and the gear simply stays (never two glyphs), with no functional impact. |
| Data directory | Resolved from `$DSH_HOME` (environment variable, defaulting to `~/.dsh`), matching dsh's own `dsh-home-paths` rules; a custom home works too. Recorded usage is **read-only**; the only file written is the price cache `$DSH_HOME/dsh-token-use/pricing.json` (atomic replace), and `pricing.enabled: false` turns both the fetch and that write off. |
| Session formats | Handles `session.jsonl[.zstd]` (multi-frame zstd with checksums), the versioned next generation `session.v<N>.jsonl[.zstd]` that dsh leaves alongside the old file after a migration, and plaintext `.jsonl`. A session is read from its **highest-version generation only**, so a migration never double counts; `.bak`, `.corrupt-*` and `session.lock` are skipped, and a single corrupt frame only raises `scan.skipped`. |
| Directory layout | Follows the official JSONL persistence layout `sessions/<project dir>/<session dir>/`, reading every session independently. |
| Accounting | Some providers (the pi-ai adapter, for instance) fold reasoning tokens into output, so a `reasoning` column of 0 is normal there; calls that record no `usage` (title generation, web search) are not counted; model attribution uses the session's most recent `request/header`. |
| Network | The endpoint is **loopback-only** by default. On a LAN deployment (trustedHosts configured) set `allowRemote: true` in the profile patch; it still accepts same-origin requests only, and the client names the reason when it sees a 403. Outbound traffic has exactly one purpose: fetching the official pricing page from `api-docs.deepseek.com` once a day (repoint it with `pricing.url`, or turn it off with `pricing.enabled: false`). |
| Performance | The history rebuild runs on a **worker thread**, so the host event loop is never blocked; events arriving meanwhile are buffered and replayed after the scan, with the session sequence watermark keeping the two folds distinct. Only event increments happen afterwards. |
| Multiple instances | Every `$DSH_HOME` is counted separately; several profiles under one home share the `sessions` directory, so their usage is merged. |

## Configuration (overridable in cordis.patch.yml)

```yaml
- id: dsh-token-use
  name: 'dsh-token-use'
  config:
    endpoint: /dsh-token-use
    scanAtBoot: true    # false counts only usage recorded after the plugin starts
    allowRemote: false  # set true for LAN (non-loopback) access; same-origin only
    pricing:
      enabled: true     # false turns the daily fetch off (built-in/existing snapshots only)
      currency: CNY     # CNY (Chinese pricing page, 元) or USD (English page, $)
      refreshHour: 12   # local hour of the daily fetch
      # url: https://api-docs.deepseek.com/zh-cn/quick_start/pricing  # custom pricing page
```

## After installing

1. Restart `dsh web` (a bundle membership change only takes effect on restart);
2. Open **Settings → Token usage**;
3. Or from the command line: `curl 'http://127.0.0.1:3080/dsh-token-use?month=2026-09'`.
