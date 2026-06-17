// Best-effort in-memory IP rate limit. Serverless instances are ephemeral and may be
// reused across requests for a while — this isn't perfectly consistent across cold
// starts, but it deters basic spam/bot abuse with zero extra infrastructure.
const hits = new Map();

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.socket && req.socket.remoteAddress ? req.socket.remoteAddress : 'unknown';
}

function isRateLimited(req, { max = 5, windowMs = 10 * 60 * 1000, key = 'default' } = {}) {
  const ip = getClientIp(req);
  const bucketKey = `${key}:${ip}`;
  const now = Date.now();
  const entry = hits.get(bucketKey) || { count: 0, resetAt: now + windowMs };

  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + windowMs;
  }

  entry.count += 1;
  hits.set(bucketKey, entry);

  // Periodic cleanup so the map doesn't grow unbounded on long-lived instances.
  if (hits.size > 5000) {
    for (const [k, v] of hits) {
      if (now > v.resetAt) hits.delete(k);
    }
  }

  return entry.count > max;
}

module.exports = { isRateLimited, getClientIp };
