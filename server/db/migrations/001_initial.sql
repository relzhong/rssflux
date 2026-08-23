-- Migration 001_initial.sql

CREATE TABLE IF NOT EXISTS schema_migrations (
  id VARCHAR(255) PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth_captcha (
  id UUID PRIMARY KEY,
  answer_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_captcha_expires_at ON auth_captcha (expires_at);

CREATE TABLE IF NOT EXISTS auth_session (
  id UUID PRIMARY KEY,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_session_expires_at ON auth_session (expires_at);

CREATE TABLE IF NOT EXISTS article_summary (
  entry_id BIGINT PRIMARY KEY,
  title TEXT,
  url TEXT,
  content_hash TEXT,
  tldr TEXT,
  summary TEXT,
  model TEXT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_article_summary_content_hash ON article_summary (content_hash);
