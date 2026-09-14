/**
 * Boot-scan worker: rebuilds the usage fold off the host thread so a large
 * session history never blocks the running app. Uses the same UsageTracker as
 * the host (node:zlib per-frame zstd decode), then posts the aggregated fold
 * back; the host merges it and replays any events buffered meanwhile.
 */
import { parentPort, workerData } from 'node:worker_threads'
import { UsageTracker } from './index.js'
import { PricingStore } from './pricing.js'

const tracker = new UsageTracker(workerData.dshHome, { pricing: PricingStore.hydrate(workerData.pricing) })
await tracker.scanSessions({ worker: false })
parentPort.postMessage(tracker.serialize())
