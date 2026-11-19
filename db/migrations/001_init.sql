BEGIN;

CREATE TABLE domain_summary_cache (
    domain TEXT PRIMARY KEY,
    breach_count INTEGER NOT NULL CHECK (breach_count >= 0),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE daily_check_counts (
    check_date DATE NOT NULL DEFAULT ((CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date),
    check_type TEXT NOT NULL CHECK (check_type IN ('email', 'domain')),
    outcome TEXT NOT NULL CHECK (outcome IN ('found', 'not_found', 'error')),
    count BIGINT NOT NULL DEFAULT 0 CHECK (count >= 0),
    PRIMARY KEY (check_date, check_type, outcome)
);

COMMIT;