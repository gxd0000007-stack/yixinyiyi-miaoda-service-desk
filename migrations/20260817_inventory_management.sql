BEGIN;

CREATE TABLE IF NOT EXISTS inventory_product (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barcode varchar(120) NOT NULL,
  sku varchar(120),
  product_name varchar(255) NOT NULL,
  category varchar(100) NOT NULL DEFAULT '零售产品',
  unit varchar(40) NOT NULL DEFAULT '件',
  purchase_cost_cents bigint NOT NULL DEFAULT 0,
  retail_price_cents bigint NOT NULL DEFAULT 0,
  default_discount_basis_points integer NOT NULL DEFAULT 10000,
  safety_stock numeric(14,3) NOT NULL DEFAULT 0,
  supplier varchar(255),
  note text,
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
  ),
  CONSTRAINT ck_inventory_product_cost_nonnegative CHECK (purchase_cost_cents >= 0),
  CONSTRAINT ck_inventory_product_price_nonnegative CHECK (retail_price_cents >= 0),
  CONSTRAINT ck_inventory_product_discount CHECK (
    default_discount_basis_points BETWEEN 0 AND 10000
  ),
  CONSTRAINT ck_inventory_product_safety_stock CHECK (safety_stock >= 0),
  CONSTRAINT ck_inventory_product_status CHECK (status IN ('active', 'inactive'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_inventory_product_barcode
  ON inventory_product(barcode);
CREATE UNIQUE INDEX IF NOT EXISTS uk_inventory_product_sku
  ON inventory_product(sku) WHERE sku IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_product_category_status
  ON inventory_product(category, status);
ALTER TABLE inventory_product ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_role_bypass_policy ON inventory_product
  TO service_role USING (true);
CREATE POLICY "修改全部数据" ON inventory_product
  AS PERMISSIVE FOR ALL TO authenticated USING (true);
CREATE POLICY "查看全部数据" ON inventory_product
  AS PERMISSIVE FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "修改本人数据" ON inventory_product
  AS PERMISSIVE FOR ALL TO authenticated USING (
    (current_setting('app.user_id'::text) = ANY (ARRAY[]::text[]))
    AND (current_setting('app.user_id'::text) = ((_created_by).user_id)::text)
  );
COMMENT ON TABLE inventory_product IS '门店产品档案、价格、默认折扣与安全库存';

CREATE TABLE IF NOT EXISTS inventory_movement (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  movement_no varchar(80) NOT NULL,
  idempotency_key varchar(180) NOT NULL,
  product_id uuid NOT NULL REFERENCES inventory_product(id),
  movement_type varchar(40) NOT NULL,
  quantity numeric(14,3) NOT NULL,
  delta_quantity numeric(14,3) NOT NULL,
  unit_cost_cents bigint NOT NULL DEFAULT 0,
  list_price_cents bigint NOT NULL DEFAULT 0,
  discount_basis_points integer NOT NULL DEFAULT 10000,
  actual_amount_cents bigint NOT NULL DEFAULT 0,
  customer_asset_id uuid REFERENCES customer_asset(id),
  customer_name varchar(255),
  recipient_name varchar(255),
  purpose text,
  supplier varchar(255),
  batch_no varchar(120),
  expires_on date,
  note text,
  operator_user_id varchar(255),
  operator_name varchar(255) NOT NULL,
  occurred_at TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
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
  ),
  CONSTRAINT ck_inventory_movement_type CHECK (
    movement_type IN ('inbound', 'internal_use', 'customer_sale')
  ),
  CONSTRAINT ck_inventory_movement_quantity CHECK (quantity > 0),
  CONSTRAINT ck_inventory_movement_cost_nonnegative CHECK (unit_cost_cents >= 0),
  CONSTRAINT ck_inventory_movement_price_nonnegative CHECK (list_price_cents >= 0),
  CONSTRAINT ck_inventory_movement_discount CHECK (
    discount_basis_points BETWEEN 0 AND 10000
  ),
  CONSTRAINT ck_inventory_movement_amount_nonnegative CHECK (actual_amount_cents >= 0),
  CONSTRAINT ck_inventory_movement_delta CHECK (
    (movement_type = 'inbound' AND delta_quantity > 0)
    OR (movement_type IN ('internal_use', 'customer_sale') AND delta_quantity < 0)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_inventory_movement_no
  ON inventory_movement(movement_no);
CREATE UNIQUE INDEX IF NOT EXISTS uk_inventory_movement_idempotency
  ON inventory_movement(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_inventory_movement_product_time
  ON inventory_movement(product_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_movement_type_time
  ON inventory_movement(movement_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_movement_customer_time
  ON inventory_movement(customer_asset_id, occurred_at DESC);
ALTER TABLE inventory_movement ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_role_bypass_policy ON inventory_movement
  TO service_role USING (true);
CREATE POLICY "修改全部数据" ON inventory_movement
  AS PERMISSIVE FOR ALL TO authenticated USING (true);
CREATE POLICY "查看全部数据" ON inventory_movement
  AS PERMISSIVE FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "修改本人数据" ON inventory_movement
  AS PERMISSIVE FOR ALL TO authenticated USING (
    (current_setting('app.user_id'::text) = ANY (ARRAY[]::text[]))
    AND (current_setting('app.user_id'::text) = ((_created_by).user_id)::text)
  );
COMMENT ON TABLE inventory_movement IS '产品入库、内部领用与客户销售的不可覆盖库存流水';

COMMIT;
