CREATE TABLE IF NOT EXISTS customer_asset (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_record_id varchar(100) NOT NULL,
  customer_name varchar(255) NOT NULL,
  mobile varchar(30),
  nickname varchar(255),
  member_level varchar(255),
  initial_source text,
  total_spend numeric(14, 2),
  current_balance numeric(14, 2),
  service_staff text,
  profile_completeness integer NOT NULL DEFAULT 0,
  raw_profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_synced_at TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _created_at TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _created_by user_profile DEFAULT (
    CASE
      WHEN current_setting('app.user_id', TRUE) = '' THEN NULL
      ELSE concat('(', current_setting('app.user_id', TRUE), ')')::user_profile
    END
  ),
  _updated_at TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _updated_by user_profile DEFAULT (
    CASE
      WHEN current_setting('app.user_id', TRUE) = '' THEN NULL
      ELSE concat('(', current_setting('app.user_id', TRUE), ')')::user_profile
    END
  )
);

ALTER TABLE customer_asset ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_role_bypass_policy ON customer_asset
  TO service_role USING (true);

CREATE POLICY "修改全部数据" ON customer_asset
  AS PERMISSIVE FOR ALL TO authenticated USING (true);

CREATE POLICY "查看全部数据" ON customer_asset
  AS PERMISSIVE FOR SELECT TO authenticated, anon USING (true);

CREATE POLICY "修改本人数据" ON customer_asset
  AS PERMISSIVE FOR ALL TO authenticated USING (
    (current_setting('app.user_id'::text) = ANY (ARRAY[]::text[]))
    AND (current_setting('app.user_id'::text) = ((_created_by).user_id)::text)
  );

CREATE UNIQUE INDEX IF NOT EXISTS uk_customer_asset_source_record
  ON customer_asset(source_record_id);
CREATE INDEX IF NOT EXISTS idx_customer_asset_name
  ON customer_asset(customer_name);
CREATE INDEX IF NOT EXISTS idx_customer_asset_mobile
  ON customer_asset(mobile);
CREATE INDEX IF NOT EXISTS idx_customer_asset_member_level
  ON customer_asset(member_level);

COMMENT ON TABLE customer_asset IS '客户画像多维表格的只读同步资产库';
COMMENT ON COLUMN customer_asset.source_record_id IS '原客户画像表记录 ID';
COMMENT ON COLUMN customer_asset.raw_profile IS '@type { [key: string]: unknown }';
COMMENT ON COLUMN customer_asset.source_synced_at IS '最近一次从客户画像表同步的时间';
