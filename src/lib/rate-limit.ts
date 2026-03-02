/**
 * Rate limiter with Upstash Redis primary + in-memory fallback.
 *
 * Upstash (distributed, works correctly on Vercel serverless):
 *   Requires env vars: UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
 *   Get them at: https://console.upstash.com → Redis → REST API
 *
 * In-memory fallback (per-instance only, resets on cold starts):
 *   Used automatically if Upstash env vars are not set.
 *   Still protects against burst abuse within the same Lambda instance.
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// ─── Upstash Redis (optional) ─────────────────────────────────────────────────

let redisRatelimit: Ratelimit | null = null;

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    const redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    // Sliding window — same semantics as the in-memory implementation
    redisRatelimit = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(1, '1 h'), // placeholder; overridden per-call below
        prefix: 'mitalento:rl',
        analytics: false,
    });
}

// ─── In-memory fallback ───────────────────────────────────────────────────────

interface InMemoryEntry {
    timestamps: number[];
}

const store = new Map<string, InMemoryEntry>();

// Prune stale entries every 10 minutes to avoid memory growth
setInterval(() => {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    for (const [key, entry] of store.entries()) {
        entry.timestamps = entry.timestamps.filter(t => t > oneHourAgo);
        if (entry.timestamps.length === 0) store.delete(key);
    }
}, 10 * 60 * 1000);

function inMemoryCheck(
    key: string,
    max: number,
    windowMs: number
): { allowed: boolean; remaining: number; resetInMs: number } {
    const now = Date.now();
    const windowStart = now - windowMs;

    const entry = store.get(key) ?? { timestamps: [] };
    entry.timestamps = entry.timestamps.filter(t => t > windowStart);

    if (entry.timestamps.length >= max) {
        const oldest = entry.timestamps[0];
        return { allowed: false, remaining: 0, resetInMs: windowMs - (now - oldest) };
    }

    entry.timestamps.push(now);
    store.set(key, entry);

    return { allowed: true, remaining: max - entry.timestamps.length, resetInMs: windowMs };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetInMs: number;
}

/**
 * @param uid       - Unique identifier for the caller (user UID)
 * @param endpoint  - Endpoint name used to namespace limits (e.g. 'generate-quiz')
 * @param max       - Max requests allowed in the window
 * @param windowMs  - Time window in milliseconds (default: 1 hour)
 */
export async function checkRateLimit(
    uid: string,
    endpoint: string,
    max: number,
    windowMs = 60 * 60 * 1000
): Promise<RateLimitResult> {
    const key = `${endpoint}:${uid}`;

    // ── Upstash path ──────────────────────────────────────────────────────────
    if (redisRatelimit) {
        try {
            // Build a per-call limiter with the correct max and window
            const redis = (redisRatelimit as any).redis as Redis;
            const windowSeconds = Math.round(windowMs / 1000);
            const limiter = new Ratelimit({
                redis,
                limiter: Ratelimit.slidingWindow(max, `${windowSeconds} s`),
                prefix: 'mitalento:rl',
                analytics: false,
            });

            const result = await limiter.limit(key);
            return {
                allowed: result.success,
                remaining: result.remaining,
                resetInMs: Math.max(0, result.reset - Date.now()),
            };
        } catch (err) {
            // Upstash unavailable — fall through to in-memory
            console.warn('[rate-limit] Redis error, using in-memory fallback:', err);
        }
    }

    // ── In-memory fallback ────────────────────────────────────────────────────
    return inMemoryCheck(key, max, windowMs);
}
