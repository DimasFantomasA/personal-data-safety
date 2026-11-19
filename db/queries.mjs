import pg from 'pg';

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