BEGIN;

CREATE SCHEMA IF NOT EXISTS app_private;

CREATE TABLE app_private.email_check_cache (
    email_key TEXT PRIMARY KEY,
    result JSONB NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '12 hours')
);

CREATE INDEX email_check_cache_expires_at_idx
    ON app_private.email_check_cache (expires_at);

COMMIT;