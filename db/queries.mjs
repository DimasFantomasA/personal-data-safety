import pg from 'pg';
import { createHmac } from 'node:crypto';

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});

export async function getDomainSummary(domain) {
  const result = await pool.query(
    `SELECT domain,
            breach_count AS "breachCount",
            expires_at AS "expiresAt"
     FROM domain_summary_cache
     WHERE domain = $1 AND expires_at > CURRENT_TIMESTAMP`,
    [domain]
  );

  return result.rows[0] ?? null;
}

export async function saveDomainSummary(domain, breachCount) {
  await pool.query(
    `INSERT INTO domain_summary_cache (domain, breach_count, expires_at)
     VALUES ($1, $2, CURRENT_TIMESTAMP + INTERVAL '24 hours')
     ON CONFLICT (domain) DO UPDATE
     SET breach_count = EXCLUDED.breach_count,
         expires_at = EXCLUDED.expires_at`,
    [domain, breachCount]
  );
}

export async function incrementCheckCount(checkType, outcome) {
  await pool.query(
    `INSERT INTO daily_check_counts (check_type, outcome, count)
     VALUES ($1, $2, 1)
     ON CONFLICT (check_date, check_type, outcome) DO UPDATE
     SET count = daily_check_counts.count + 1`,
    [checkType, outcome]
  );
}

function getEmailCacheKey(email) {
  const secret = process.env.EMAIL_CACHE_SECRET;

  if (!secret) {
    throw new Error('EMAIL_CACHE_SECRET is not configured');
  }

  return createHmac('sha256', secret)
    .update(email.trim())
    .digest('hex');
}

export async function getEmailCheckCache(email) {
  const { rows } = await pool.query(
    `SELECT result
     FROM app_private.email_check_cache
     WHERE email_key = $1 AND expires_at > CURRENT_TIMESTAMP`,
    [getEmailCacheKey(email)]
  );

  return rows[0]?.result ?? null;
}

export async function saveEmailCheckCache(email, result) {
  await pool.query(
    `INSERT INTO app_private.email_check_cache (email_key, result)
     VALUES ($1, $2::jsonb)
     ON CONFLICT (email_key) DO UPDATE
     SET result = EXCLUDED.result,
         expires_at = EXCLUDED.expires_at`,
    [getEmailCacheKey(email), JSON.stringify(result)]
  );
}