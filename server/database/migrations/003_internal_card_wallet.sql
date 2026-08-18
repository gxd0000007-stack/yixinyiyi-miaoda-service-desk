BEGIN;

CREATE TABLE IF NOT EXISTS customer_card_account (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_asset_id uuid NOT NULL REFERENCES customer_asset(id),
  source_key varchar(800) NOT NULL,
  card_name varchar(500) NOT NULL,
  category varchar(255),
  card_type varchar(100),
  status varchar(100) NOT NULL DEFAULT 'active',
  validity varchar(255),
  card_number varchar(255),
  account_number varchar(255),
  principal_opening_cents bigint NOT NULL DEFAULT 0,
  gift_opening_cents bigint NOT NULL DEFAULT 0,
  session_value_opening_cents bigint NOT NULL DEFAULT 0,
  source_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
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

ALTER TABLE customer_card_account ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_role_bypass_policy ON customer_card_account
  TO service_role USING (true);
CREATE POLICY "修改全部数据" ON customer_card_account
  AS PERMISSIVE FOR ALL TO authenticated USING (true);
CREATE POLICY "查看全部数据" ON customer_card_account
  AS PERMISSIVE FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "修改本人数据" ON customer_card_account
  AS PERMISSIVE FOR ALL TO authenticated USING (
    (current_setting('app.user_id'::text) = ANY (ARRAY[]::text[]))
    AND (current_setting('app.user_id'::text) = ((_created_by).user_id)::text)
  );

CREATE UNIQUE INDEX IF NOT EXISTS uk_customer_card_account_source
  ON customer_card_account(customer_asset_id, source_key);
CREATE INDEX IF NOT EXISTS idx_customer_card_account_customer
  ON customer_card_account(customer_asset_id, status);

COMMENT ON TABLE customer_card_account IS '门店独立卡资产账户基准，不依赖外部收银系统';
COMMENT ON COLUMN customer_card_account.source_snapshot
  IS '@type { [key: string]: unknown }';

CREATE TABLE IF NOT EXISTS customer_card_entitlement (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES customer_card_account(id),
  source_right_key varchar(1000) NOT NULL,
  right_name varchar(500) NOT NULL,
  right_type varchar(100),
  is_gift boolean NOT NULL DEFAULT false,
  discount_rule varchar(255),
  opening_total_count integer,
  opening_used_count integer,
  opening_remaining_count integer,
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

ALTER TABLE customer_card_entitlement ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_role_bypass_policy ON customer_card_entitlement
  TO service_role USING (true);
CREATE POLICY "修改全部数据" ON customer_card_entitlement
  AS PERMISSIVE FOR ALL TO authenticated USING (true);
CREATE POLICY "查看全部数据" ON customer_card_entitlement
  AS PERMISSIVE FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "修改本人数据" ON customer_card_entitlement
  AS PERMISSIVE FOR ALL TO authenticated USING (
    (current_setting('app.user_id'::text) = ANY (ARRAY[]::text[]))
    AND (current_setting('app.user_id'::text) = ((_created_by).user_id)::text)
  );

CREATE UNIQUE INDEX IF NOT EXISTS uk_customer_card_entitlement_source
  ON customer_card_entitlement(account_id, source_right_key);
CREATE INDEX IF NOT EXISTS idx_customer_card_entitlement_account
  ON customer_card_entitlement(account_id, right_name);

COMMENT ON TABLE customer_card_entitlement IS '门店独立卡资产中的项目次数权益';

CREATE TABLE IF NOT EXISTS customer_card_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_no varchar(80) NOT NULL,
  idempotency_key varchar(180) NOT NULL,
  customer_asset_id uuid NOT NULL REFERENCES customer_asset(id),
  account_id uuid NOT NULL REFERENCES customer_card_account(id),
  entitlement_id uuid REFERENCES customer_card_entitlement(id),
  appointment_id varchar(80),
  transaction_type varchar(40) NOT NULL,
  deduction_mode varchar(40) NOT NULL,
  project_name varchar(500) NOT NULL,
  amount_cents bigint NOT NULL DEFAULT 0,
  quantity integer NOT NULL DEFAULT 0,
  delta_amount_cents bigint NOT NULL DEFAULT 0,
  delta_quantity integer NOT NULL DEFAULT 0,
  before_amount_cents bigint,
  after_amount_cents bigint,
  before_quantity integer,
  after_quantity integer,
  reason text,
  operator_user_id varchar(255),
  operator_name varchar(255) NOT NULL,
  reversal_of uuid REFERENCES customer_card_ledger(id),
  status varchar(40) NOT NULL DEFAULT 'posted',
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
  )
);

ALTER TABLE customer_card_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_role_bypass_policy ON customer_card_ledger
  TO service_role USING (true);
CREATE POLICY "修改全部数据" ON customer_card_ledger
  AS PERMISSIVE FOR ALL TO authenticated USING (true);
CREATE POLICY "查看全部数据" ON customer_card_ledger
  AS PERMISSIVE FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "修改本人数据" ON customer_card_ledger
  AS PERMISSIVE FOR ALL TO authenticated USING (
    (current_setting('app.user_id'::text) = ANY (ARRAY[]::text[]))
    AND (current_setting('app.user_id'::text) = ((_created_by).user_id)::text)
  );

CREATE UNIQUE INDEX IF NOT EXISTS uk_customer_card_ledger_transaction_no
  ON customer_card_ledger(transaction_no);
CREATE UNIQUE INDEX IF NOT EXISTS uk_customer_card_ledger_idempotency
  ON customer_card_ledger(idempotency_key);
CREATE UNIQUE INDEX IF NOT EXISTS uk_customer_card_ledger_reversal
  ON customer_card_ledger(reversal_of)
  WHERE reversal_of IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customer_card_ledger_customer_time
  ON customer_card_ledger(customer_asset_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_card_ledger_account_time
  ON customer_card_ledger(account_id, occurred_at DESC);

COMMENT ON TABLE customer_card_ledger IS '门店独立扣卡与撤销的不可覆盖流水';

CREATE OR REPLACE FUNCTION validate_customer_card_ledger()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  account_row customer_card_account%ROWTYPE;
  entitlement_row customer_card_entitlement%ROWTYPE;
  original_row customer_card_ledger%ROWTYPE;
  current_amount bigint;
  current_quantity integer;
BEGIN
  SELECT * INTO account_row
  FROM customer_card_account
  WHERE id = NEW.account_id
  FOR UPDATE;

  IF NOT FOUND OR account_row.customer_asset_id <> NEW.customer_asset_id THEN
    RAISE EXCEPTION '卡账户与客户不匹配';
  END IF;

  IF NEW.transaction_type = 'deduction' THEN
    IF account_row.status NOT IN ('active', '使用中') THEN
      RAISE EXCEPTION '该卡当前不可扣减';
    END IF;

    IF NEW.deduction_mode IN ('principal', 'gift') THEN
      IF NEW.amount_cents <= 0 OR NEW.quantity <> 0 THEN
        RAISE EXCEPTION '金额扣卡参数不合法';
      END IF;

      SELECT
        CASE NEW.deduction_mode
          WHEN 'principal' THEN account_row.principal_opening_cents
          ELSE account_row.gift_opening_cents
        END + COALESCE(SUM(delta_amount_cents), 0)
      INTO current_amount
      FROM customer_card_ledger
      WHERE account_id = NEW.account_id
        AND deduction_mode = NEW.deduction_mode
        AND status = 'posted';

      IF current_amount < NEW.amount_cents THEN
        RAISE EXCEPTION '卡内余额不足';
      END IF;

      NEW.delta_amount_cents := -NEW.amount_cents;
      NEW.delta_quantity := 0;
      NEW.before_amount_cents := current_amount;
      NEW.after_amount_cents := current_amount - NEW.amount_cents;
    ELSIF NEW.deduction_mode = 'entitlement' THEN
      IF NEW.entitlement_id IS NULL OR NEW.quantity <= 0 OR NEW.amount_cents <> 0 THEN
        RAISE EXCEPTION '项目次数扣卡参数不合法';
      END IF;

      SELECT * INTO entitlement_row
      FROM customer_card_entitlement
      WHERE id = NEW.entitlement_id
      FOR UPDATE;

      IF NOT FOUND OR entitlement_row.account_id <> NEW.account_id THEN
        RAISE EXCEPTION '项目权益与卡账户不匹配';
      END IF;

      SELECT COALESCE(entitlement_row.opening_remaining_count, 0)
        + COALESCE(SUM(delta_quantity), 0)
      INTO current_quantity
      FROM customer_card_ledger
      WHERE entitlement_id = NEW.entitlement_id
        AND deduction_mode = 'entitlement'
        AND status = 'posted';

      IF current_quantity < NEW.quantity THEN
        RAISE EXCEPTION '项目剩余次数不足';
      END IF;

      NEW.delta_amount_cents := 0;
      NEW.delta_quantity := -NEW.quantity;
      NEW.before_quantity := current_quantity;
      NEW.after_quantity := current_quantity - NEW.quantity;
    ELSE
      RAISE EXCEPTION '不支持的扣卡方式';
    END IF;
  ELSIF NEW.transaction_type = 'reversal' THEN
    IF NEW.reversal_of IS NULL THEN
      RAISE EXCEPTION '撤销必须关联原扣卡流水';
    END IF;

    SELECT * INTO original_row
    FROM customer_card_ledger
    WHERE id = NEW.reversal_of
      AND transaction_type = 'deduction'
      AND status = 'posted'
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION '未找到可撤销的原扣卡流水';
    END IF;

    NEW.customer_asset_id := original_row.customer_asset_id;
    NEW.account_id := original_row.account_id;
    NEW.entitlement_id := original_row.entitlement_id;
    NEW.appointment_id := original_row.appointment_id;
    NEW.deduction_mode := original_row.deduction_mode;
    NEW.project_name := original_row.project_name;
    NEW.amount_cents := original_row.amount_cents;
    NEW.quantity := original_row.quantity;
    NEW.delta_amount_cents := -original_row.delta_amount_cents;
    NEW.delta_quantity := -original_row.delta_quantity;

    IF NEW.deduction_mode IN ('principal', 'gift') THEN
      SELECT
        CASE NEW.deduction_mode
          WHEN 'principal' THEN account_row.principal_opening_cents
          ELSE account_row.gift_opening_cents
        END + COALESCE(SUM(delta_amount_cents), 0)
      INTO current_amount
      FROM customer_card_ledger
      WHERE account_id = NEW.account_id
        AND deduction_mode = NEW.deduction_mode
        AND status = 'posted';
      NEW.before_amount_cents := current_amount;
      NEW.after_amount_cents := current_amount + original_row.amount_cents;
    ELSE
      SELECT * INTO entitlement_row
      FROM customer_card_entitlement
      WHERE id = NEW.entitlement_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION '未找到原项目权益';
      END IF;

      SELECT COALESCE(entitlement_row.opening_remaining_count, 0)
        + COALESCE(SUM(delta_quantity), 0)
      INTO current_quantity
      FROM customer_card_ledger
      WHERE entitlement_id = NEW.entitlement_id
        AND deduction_mode = 'entitlement'
        AND status = 'posted';
      NEW.before_quantity := current_quantity;
      NEW.after_quantity := current_quantity + original_row.quantity;
    END IF;
  ELSE
    RAISE EXCEPTION '不支持的卡账流水类型';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_validate_customer_card_ledger
  ON customer_card_ledger;
CREATE TRIGGER trg_validate_customer_card_ledger
  BEFORE INSERT ON customer_card_ledger
  FOR EACH ROW EXECUTE FUNCTION validate_customer_card_ledger();

COMMIT;
