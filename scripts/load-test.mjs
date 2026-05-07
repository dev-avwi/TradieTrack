#!/usr/bin/env node
/**
 * Realistic load-test harness for JobRunner.
 *
 * Targets ~100 concurrent users on a single Reserved VM. The default scenario
 * mix mirrors the read/write balance of a working trades crew during business
 * hours and exercises the bottlenecks that Task #79 was designed to protect:
 *
 *   - Hot reads (dashboard, jobs, quotes, invoices, rate cards) — protected by
 *     the LRU+TTL cache and per-user rate limiter.
 *   - PDF generation (quote/invoice PDFs) — protected by `pdfQueue` (3/12) and
 *     the per-user PDF limiter (20/min). Should surface as 429 + Retry-After
 *     under sustained load, never a 500/504.
 *   - AI calls (chat, suggestions) — protected by `aiQueue` (8/24) and the
 *     per-user AI limiter (30/min). Same backpressure expectation.
 *   - Photo upload — protected by `visionQueue` (4/12) when AI categorisation
 *     runs, and the per-user photo limiter (60/min).
 *
 * Reports p50/p95/p99 latency per endpoint plus 429 / 504 / 5xx counts so we
 * can confirm backpressure kicks in (good) instead of 5xx (bad).
 *
 * Usage:
 *   BASE_URL=http://localhost:5000 \
 *   CONCURRENCY=100 DURATION_SEC=30 \
 *   LOAD_TEST_TOKEN=<session-token> \   # required for the realistic mix
 *   LOAD_TEST_QUOTE_ID=<quote-uuid> \   # optional: enables quote PDF traffic
 *   LOAD_TEST_INVOICE_ID=<inv-uuid> \   # optional: enables invoice PDF traffic
 *   node scripts/load-test.mjs
 *
 * Targets (acceptance for Task #79):
 *   - p95 < 500ms on hot-read endpoints
 *   - 0 HTTP 5xx
 *   - <1% HTTP 429 under steady state; spikes acceptable on PDF/AI under burst
 *   - 0 HTTP 504 (timeout middleware)
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const CONCURRENCY = parseInt(process.env.CONCURRENCY || '100', 10);
const DURATION_SEC = parseInt(process.env.DURATION_SEC || '30', 10);
const TOKEN = process.env.LOAD_TEST_TOKEN || '';
const QUOTE_ID = process.env.LOAD_TEST_QUOTE_ID || '';
const INVOICE_ID = process.env.LOAD_TEST_INVOICE_ID || '';

// Weighted scenario mix: hot reads dominate, with a sprinkle of heavy work to
// exercise the PDF/AI/vision backpressure paths and the per-user limiters.
// Weights are roughly: 70% hot reads, 20% AI, 8% PDF, 2% photo upload.
function buildScenario() {
  const s = [
    // === Hot reads (cached / cheap) ===
    { weight: 18, method: 'GET', path: '/api/health', auth: false },
    { weight: 5,  method: 'GET', path: '/api/metrics', auth: false },
    { weight: 14, method: 'GET', path: '/api/dashboard/unified', auth: true },
    { weight: 12, method: 'GET', path: '/api/jobs', auth: true },
    { weight: 8,  method: 'GET', path: '/api/quotes', auth: true },
    { weight: 8,  method: 'GET', path: '/api/invoices', auth: true },
    { weight: 5,  method: 'GET', path: '/api/rate-cards', auth: true },

    // === AI (rate-limited + queued) ===
    { weight: 12, method: 'GET', path: '/api/ai/suggestions', auth: true },
    { weight: 8, method: 'POST', path: '/api/ai/chat', auth: true,
      body: () => ({ message: 'How am I tracking on quotes this week?' }) },
  ];

  if (QUOTE_ID) {
    s.push({ weight: 5, method: 'GET',
      path: `/api/quotes/${QUOTE_ID}/pdf`,
      auth: true, expectBinary: true });
  }
  if (INVOICE_ID) {
    s.push({ weight: 5, method: 'GET',
      path: `/api/invoices/${INVOICE_ID}/pdf`,
      auth: true, expectBinary: true });
  }
  return s;
}

const SCENARIO = buildScenario();

function pick() {
  const total = SCENARIO.reduce((s, x) => s + x.weight, 0);
  let r = Math.random() * total;
  for (const s of SCENARIO) {
    if ((r -= s.weight) <= 0) return s;
  }
  return SCENARIO[0];
}

const stats = new Map();
function record(key, ms, status, networkErrMsg) {
  let s = stats.get(key);
  if (!s) {
    s = { count: 0, errors: 0, status429: 0, status504: 0, status5xx: 0, networkErrors: 0, durations: [], lastNetworkErr: '' };
    stats.set(key, s);
  }
  s.count++;
  if (status === 0) {
    // Client-side fetch failure (DNS/connection refused/protocol error like
    // "Request with GET/HEAD method cannot have body"). Counted as a hard
    // error and surfaced in the verdict so the harness cannot silently pass
    // when scenarios never actually hit the server.
    s.networkErrors++;
    s.errors++;
    if (networkErrMsg) s.lastNetworkErr = networkErrMsg;
  } else {
    if (status === 429) s.status429++;
    else if (status === 504) s.status504++;
    else if (status >= 500) s.status5xx++;
    if (status >= 400 && status !== 429) s.errors++;
  }
  s.durations.push(ms);
}

function pct(arr, q) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((q / 100) * sorted.length))];
}

async function fireOne() {
  const s = pick();
  if (s.auth && !TOKEN) return; // skip auth-required when no token
  const headers = { 'content-type': 'application/json' };
  if (s.auth) headers['authorization'] = `Bearer ${TOKEN}`;
  const init = { method: s.method, headers };
  // Never attach a body to GET/HEAD — undici throws "Request with GET/HEAD
  // method cannot have body" and the scenario silently fails client-side.
  const methodAllowsBody = s.method !== 'GET' && s.method !== 'HEAD';
  if (s.body && methodAllowsBody) init.body = JSON.stringify(s.body());
  const start = Date.now();
  let status = 0;
  let errMsg = '';
  try {
    const res = await fetch(`${BASE_URL}${s.path}`, init);
    status = res.status;
    if (s.expectBinary) {
      // Drain without parsing
      await res.arrayBuffer().catch(() => {});
    } else {
      await res.text().catch(() => {});
    }
  } catch (e) {
    status = 0;
    errMsg = e?.message || String(e);
  }
  record(`${s.method} ${s.path}`, Date.now() - start, status, errMsg);
}

async function worker(deadline) {
  while (Date.now() < deadline) {
    await fireOne();
  }
}

async function main() {
  console.log(`Load test: ${CONCURRENCY} workers x ${DURATION_SEC}s against ${BASE_URL}`);
  if (!TOKEN) {
    console.log('(no LOAD_TEST_TOKEN — only /api/health and /api/metrics will be exercised)');
  } else {
    console.log(`(authenticated mix; ${SCENARIO.filter(s => s.auth).length} auth scenarios)`);
    if (!QUOTE_ID && !INVOICE_ID) {
      console.log('(set LOAD_TEST_QUOTE_ID and/or LOAD_TEST_INVOICE_ID to exercise PDF backpressure)');
    }
  }
  const deadline = Date.now() + DURATION_SEC * 1000;
  const workers = Array.from({ length: CONCURRENCY }, () => worker(deadline));
  await Promise.all(workers);

  console.log('\n=== Per-endpoint stats ===');
  let totalReq = 0, totalErr = 0, total429 = 0, total504 = 0, total5xx = 0, totalNet = 0;
  const sortedKeys = [...stats.keys()].sort();
  for (const key of sortedKeys) {
    const s = stats.get(key);
    totalReq += s.count;
    totalErr += s.errors;
    total429 += s.status429;
    total504 += s.status504;
    total5xx += s.status5xx;
    totalNet += s.networkErrors;
    console.log(
      `${key.padEnd(40)}` +
      ` count=${String(s.count).padStart(6)}` +
      ` p50=${String(pct(s.durations, 50)).padStart(4)}ms` +
      ` p95=${String(pct(s.durations, 95)).padStart(4)}ms` +
      ` p99=${String(pct(s.durations, 99)).padStart(5)}ms` +
      ` 429=${s.status429} 504=${s.status504} 5xx=${s.status5xx} net=${s.networkErrors} err=${s.errors}` +
      (s.lastNetworkErr ? ` lastNetErr="${s.lastNetworkErr}"` : '')
    );
  }
  console.log('\n=== Totals ===');
  console.log(
    `requests=${totalReq} rps≈${Math.round(totalReq / DURATION_SEC)} ` +
    `non-429-errors=${totalErr} 429=${total429} 504=${total504} 5xx=${total5xx} net=${totalNet}`
  );
  const ok = total5xx === 0 && total504 === 0 && totalNet === 0;
  const verdict = ok
    ? `OK (no 5xx/504/network errors — backpressure surfaced cleanly as ${total429} x 429)`
    : `FAIL (${total5xx} x 5xx, ${total504} x 504, ${totalNet} x network errors — these compromise the load-test result)`;
  console.log(`verdict: ${verdict}`);
  if (!ok) process.exitCode = 1;

  try {
    const m = await fetch(`${BASE_URL}/api/metrics`).then(r => r.json());
    console.log('\n=== Server-reported metrics snapshot ===');
    console.log(`overall p50=${m.overall?.p50}ms p95=${m.overall?.p95}ms p99=${m.overall?.p99}ms`);
    console.log(`totals:`, m.totals);
    console.log(`pool:`, m.pool);
    console.log(`queues:`, (m.queues || []).map(q =>
      `${q.name}(active=${q.active}/queued=${q.queued}/rejected=${q.totalRejected}/p95=${q.p95Ms}ms)`
    ).join(' '));
    console.log(`caches:`, Object.entries(m.caches || {}).map(([ns, s]) =>
      `${ns}(hits=${s.hits}/misses=${s.misses}/size=${s.size})`
    ).join(' '));
  } catch (e) {
    console.log('Could not fetch /api/metrics for post-test snapshot:', e.message);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
