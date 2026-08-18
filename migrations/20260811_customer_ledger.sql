BEGIN;

CREATE TABLE IF NOT EXISTS customer_transaction (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_order_key varchar(140) NOT NULL,
  order_no varchar(100) NOT NULL,
  customer_asset_id uuid NOT NULL REFERENCES customer_asset(id),
  customer_yz_uid varchar(100) NOT NULL,
  customer_name varchar(255) NOT NULL,
  customer_mobile varchar(30),
  ordered_at TIMESTAMP(3) WITH TIME ZONE NOT NULL,
  order_type varchar(100),
  detail_url text,
  remark text,
  actual_amount numeric(14,2),
  amount_detail text,
  payment_method varchar(100),
  deductions jsonb NOT NULL DEFAULT '{}'::jsonb,
  store varchar(255),
  status varchar(100),
  source_page integer NOT NULL DEFAULT 1,
  source_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
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

CREATE UNIQUE INDEX IF NOT EXISTS uk_customer_transaction_source_order
  ON customer_transaction(source_order_key);
CREATE UNIQUE INDEX IF NOT EXISTS uk_customer_transaction_order_no
  ON customer_transaction(order_no);
CREATE INDEX IF NOT EXISTS idx_customer_transaction_asset_time
  ON customer_transaction(customer_asset_id, ordered_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_transaction_type
  ON customer_transaction(order_type);
ALTER TABLE customer_transaction ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_role_bypass_policy ON customer_transaction
  TO service_role USING (true);
CREATE POLICY "修改全部数据" ON customer_transaction
  AS PERMISSIVE FOR ALL TO authenticated USING (true);
CREATE POLICY "查看全部数据" ON customer_transaction
  AS PERMISSIVE FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "修改本人数据" ON customer_transaction
  AS PERMISSIVE FOR ALL TO authenticated USING (
    (current_setting('app.user_id'::text) = ANY (ARRAY[]::text[]))
    AND (current_setting('app.user_id'::text) = ((_created_by).user_id)::text)
  );
COMMENT ON TABLE customer_transaction IS '有赞客户逐笔消费订单账本';
COMMENT ON COLUMN customer_transaction.deductions IS '@type { [key: string]: string }';
COMMENT ON COLUMN customer_transaction.source_payload IS '@type { [key: string]: unknown }';

CREATE TABLE IF NOT EXISTS customer_transaction_item (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES customer_transaction(id),
  source_item_key varchar(180) NOT NULL,
  line_no integer NOT NULL,
  item_name varchar(500) NOT NULL,
  item_category varchar(100),
  product_url text,
  unit_price numeric(14,2),
  quantity numeric(12,3),
  artisan varchar(255),
  salesperson varchar(255),
  actual_amount numeric(14,2),
  amount_detail text,
  payment_method varchar(100),
  deductions jsonb NOT NULL DEFAULT '{}'::jsonb,
  store varchar(255),
  status varchar(100),
  raw_row text,
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

CREATE UNIQUE INDEX IF NOT EXISTS uk_customer_transaction_item_source
  ON customer_transaction_item(source_item_key);
CREATE INDEX IF NOT EXISTS idx_customer_transaction_item_transaction
  ON customer_transaction_item(transaction_id, line_no);
CREATE INDEX IF NOT EXISTS idx_customer_transaction_item_name
  ON customer_transaction_item(item_name);
ALTER TABLE customer_transaction_item ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_role_bypass_policy ON customer_transaction_item
  TO service_role USING (true);
CREATE POLICY "修改全部数据" ON customer_transaction_item
  AS PERMISSIVE FOR ALL TO authenticated USING (true);
CREATE POLICY "查看全部数据" ON customer_transaction_item
  AS PERMISSIVE FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "修改本人数据" ON customer_transaction_item
  AS PERMISSIVE FOR ALL TO authenticated USING (
    (current_setting('app.user_id'::text) = ANY (ARRAY[]::text[]))
    AND (current_setting('app.user_id'::text) = ((_created_by).user_id)::text)
  );
COMMENT ON TABLE customer_transaction_item IS '有赞订单内逐项目明细';
COMMENT ON COLUMN customer_transaction_item.deductions IS '@type { [key: string]: string }';

CREATE TABLE IF NOT EXISTS customer_coupon (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_asset_id uuid NOT NULL REFERENCES customer_asset(id),
  source_coupon_key varchar(180) NOT NULL,
  customer_yz_uid varchar(100) NOT NULL,
  customer_name varchar(255) NOT NULL,
  customer_mobile varchar(30),
  coupon_name varchar(500) NOT NULL,
  face_value numeric(14,2),
  threshold text,
  valid_from date,
  valid_to date,
  status varchar(100) NOT NULL DEFAULT '可用',
  source_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
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

CREATE UNIQUE INDEX IF NOT EXISTS uk_customer_coupon_source
  ON customer_coupon(source_coupon_key);
CREATE INDEX IF NOT EXISTS idx_customer_coupon_asset_validity
  ON customer_coupon(customer_asset_id, valid_to);
CREATE INDEX IF NOT EXISTS idx_customer_coupon_name
  ON customer_coupon(coupon_name);
ALTER TABLE customer_coupon ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_role_bypass_policy ON customer_coupon
  TO service_role USING (true);
CREATE POLICY "修改全部数据" ON customer_coupon
  AS PERMISSIVE FOR ALL TO authenticated USING (true);
CREATE POLICY "查看全部数据" ON customer_coupon
  AS PERMISSIVE FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "修改本人数据" ON customer_coupon
  AS PERMISSIVE FOR ALL TO authenticated USING (
    (current_setting('app.user_id'::text) = ANY (ARRAY[]::text[]))
    AND (current_setting('app.user_id'::text) = ((_created_by).user_id)::text)
  );
COMMENT ON TABLE customer_coupon IS '有赞客户优惠券资产';
COMMENT ON COLUMN customer_coupon.source_payload IS '@type { [key: string]: unknown }';

CREATE TABLE IF NOT EXISTS customer_import_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_key varchar(140) NOT NULL,
  source_name varchar(255) NOT NULL,
  status varchar(100) NOT NULL,
  customer_count integer NOT NULL DEFAULT 0,
  transaction_count integer NOT NULL DEFAULT 0,
  item_count integer NOT NULL DEFAULT 0,
  coupon_count integer NOT NULL DEFAULT 0,
  balance_error_count integer NOT NULL DEFAULT 0,
  identity_error_count integer NOT NULL DEFAULT 0,
  duplicate_order_count integer NOT NULL DEFAULT 0,
  precision_error_count integer NOT NULL DEFAULT 0,
  qc_report jsonb NOT NULL DEFAULT '{}'::jsonb,
  imported_at TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
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

CREATE UNIQUE INDEX IF NOT EXISTS uk_customer_import_audit_batch
  ON customer_import_audit(batch_key);
CREATE INDEX IF NOT EXISTS idx_customer_import_audit_time
  ON customer_import_audit(imported_at DESC);
ALTER TABLE customer_import_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_role_bypass_policy ON customer_import_audit
  TO service_role USING (true);
CREATE POLICY "修改全部数据" ON customer_import_audit
  AS PERMISSIVE FOR ALL TO authenticated USING (true);
CREATE POLICY "查看全部数据" ON customer_import_audit
  AS PERMISSIVE FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "修改本人数据" ON customer_import_audit
  AS PERMISSIVE FOR ALL TO authenticated USING (
    (current_setting('app.user_id'::text) = ANY (ARRAY[]::text[]))
    AND (current_setting('app.user_id'::text) = ((_created_by).user_id)::text)
  );
COMMENT ON TABLE customer_import_audit IS '客户资产全量导入与质检审计';
COMMENT ON COLUMN customer_import_audit.qc_report IS '@type { [key: string]: unknown }';

COMMIT;
