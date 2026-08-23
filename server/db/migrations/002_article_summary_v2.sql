-- Migration 002_article_summary_v2.sql

ALTER TABLE article_summary
  ADD COLUMN IF NOT EXISTS feed_id bigint,
  ADD COLUMN IF NOT EXISTS feed_title text,
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS text_length integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS topics text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS importance smallint,
  ADD COLUMN IF NOT EXISTS summary_kind text NOT NULL DEFAULT 'ai',
  ADD COLUMN IF NOT EXISTS prompt_version text DEFAULT 'article-summary-v1',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ready',
  ADD COLUMN IF NOT EXISTS last_error text;

-- Add check constraints safely
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'article_summary_importance_check') THEN
    ALTER TABLE article_summary ADD CONSTRAINT article_summary_importance_check
      CHECK (importance IS NULL OR importance BETWEEN 1 AND 5);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'article_summary_kind_check') THEN
    ALTER TABLE article_summary ADD CONSTRAINT article_summary_kind_check
      CHECK (summary_kind IN ('ai', 'extractive'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'article_summary_status_check') THEN
    ALTER TABLE article_summary ADD CONSTRAINT article_summary_status_check
      CHECK (status IN ('pending', 'ready', 'failed'));
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_article_summary_published_at ON article_summary (published_at DESC);
CREATE INDEX IF NOT EXISTS idx_article_summary_status ON article_summary (status);
CREATE INDEX IF NOT EXISTS idx_article_summary_importance ON article_summary (importance DESC);
