BEGIN;

CREATE TABLE IF NOT EXISTS card_package_template (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_no varchar(80) NOT NULL UNIQUE,
  package_name varchar(255) NOT NULL,
  category varchar(100) NOT NULL DEFAULT '活动套餐',
  retail_price_cents bigint NOT NULL DEFAULT 0,
  discount_basis_points integer NOT NULL DEFAULT 10000,
  valid_days integer,
  description text,
  components jsonb NOT NULL DEFAULT '[]'::jsonb,
  status varchar(40) NOT NULL DEFAULT 'active',
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

ALTER TABLE card_package_template ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_role_bypass_policy ON card_package_template
  TO service_role USING (true);

CREATE POLICY "修改全部数据" ON card_package_template
  AS PERMISSIVE FOR ALL TO authenticated USING (true);

CREATE POLICY "查看全部数据" ON card_package_template
  AS PERMISSIVE FOR SELECT TO authenticated, anon USING (true);

CREATE POLICY "修改本人数据" ON card_package_template
  AS PERMISSIVE FOR ALL TO authenticated USING (
    (current_setting('app.user_id'::text) = ANY (ARRAY[]::text[]))
    AND (current_setting('app.user_id'::text) = ((_created_by).user_id)::text)
  );

CREATE UNIQUE INDEX IF NOT EXISTS uk_card_package_template_no
  ON card_package_template(package_no);
CREATE INDEX IF NOT EXISTS idx_card_package_template_status_time
  ON card_package_template(status, _updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_card_package_template_category
  ON card_package_template(category, status);

COMMENT ON TABLE card_package_template IS '门店卡项管理中的多次卡项与活动套餐模板';
COMMENT ON COLUMN card_package_template.components IS '@type { projectId: string; projectName: string; category: string; unitPriceExact: string; quantity: number; }[]';

COMMIT;
