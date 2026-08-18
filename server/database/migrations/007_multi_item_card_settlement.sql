BEGIN;

ALTER TABLE customer_card_ledger
  ADD COLUMN IF NOT EXISTS operation_no varchar(80),
  ADD COLUMN IF NOT EXISTS line_no integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS item_type varchar(40) DEFAULT 'service',
  ADD COLUMN IF NOT EXISTS unit_price_cents bigint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_basis_points integer DEFAULT 10000;

ALTER TABLE customer_card_ledger
  ALTER COLUMN line_no DROP NOT NULL,
  ALTER COLUMN item_type DROP NOT NULL,
  ALTER COLUMN unit_price_cents DROP NOT NULL,
  ALTER COLUMN discount_basis_points DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customer_card_ledger_operation
  ON customer_card_ledger(customer_asset_id, operation_no, line_no);

COMMENT ON COLUMN customer_card_ledger.operation_no
  IS '一次多项目消费、购买或充值共用的整单编号';
COMMENT ON COLUMN customer_card_ledger.line_no
  IS '整单内的明细序号';
COMMENT ON COLUMN customer_card_ledger.item_type
  IS 'service/package/product/card/recharge';
COMMENT ON COLUMN customer_card_ledger.unit_price_cents
  IS '项目或商品成交前单价，精确到分';
COMMENT ON COLUMN customer_card_ledger.discount_basis_points
  IS '成交折扣，10000 表示 100%';

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

  IF NEW.transaction_type IN ('deduction', 'credit') THEN
    IF account_row.status NOT IN ('active', '使用中') THEN
      RAISE EXCEPTION '该卡当前不可操作';
    END IF;

    IF NEW.deduction_mode IN ('principal', 'gift') THEN
      IF NEW.amount_cents <= 0 OR NEW.quantity <> 0 THEN
        RAISE EXCEPTION '金额卡账参数不合法';
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

      IF NEW.transaction_type = 'deduction' AND current_amount < NEW.amount_cents THEN
        RAISE EXCEPTION '卡内余额不足';
      END IF;

      NEW.delta_amount_cents :=
        CASE NEW.transaction_type
          WHEN 'deduction' THEN -NEW.amount_cents
          ELSE NEW.amount_cents
        END;
      NEW.delta_quantity := 0;
      NEW.before_amount_cents := current_amount;
      NEW.after_amount_cents := current_amount + NEW.delta_amount_cents;
    ELSIF NEW.deduction_mode = 'entitlement' THEN
      IF NEW.entitlement_id IS NULL OR NEW.quantity <= 0 OR NEW.amount_cents <> 0 THEN
        RAISE EXCEPTION '项目次数卡账参数不合法';
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

      IF NEW.transaction_type = 'deduction' AND current_quantity < NEW.quantity THEN
        RAISE EXCEPTION '项目剩余次数不足';
      END IF;

      NEW.delta_amount_cents := 0;
      NEW.delta_quantity :=
        CASE NEW.transaction_type
          WHEN 'deduction' THEN -NEW.quantity
          ELSE NEW.quantity
        END;
      NEW.before_quantity := current_quantity;
      NEW.after_quantity := current_quantity + NEW.delta_quantity;
    ELSE
      RAISE EXCEPTION '不支持的卡账方式';
    END IF;
  ELSIF NEW.transaction_type = 'reversal' THEN
    IF NEW.reversal_of IS NULL THEN
      RAISE EXCEPTION '撤销必须关联原卡账流水';
    END IF;

    SELECT * INTO original_row
    FROM customer_card_ledger
    WHERE id = NEW.reversal_of
      AND transaction_type IN ('deduction', 'credit')
      AND status = 'posted'
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION '未找到可撤销的原卡账流水';
    END IF;

    NEW.customer_asset_id := original_row.customer_asset_id;
    NEW.account_id := original_row.account_id;
    NEW.entitlement_id := original_row.entitlement_id;
    NEW.appointment_id := original_row.appointment_id;
    NEW.deduction_mode := original_row.deduction_mode;
    NEW.project_name := original_row.project_name;
    NEW.item_type := original_row.item_type;
    NEW.unit_price_cents := original_row.unit_price_cents;
    NEW.discount_basis_points := original_row.discount_basis_points;
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

      IF current_amount + NEW.delta_amount_cents < 0 THEN
        RAISE EXCEPTION '该笔充值金额已被使用，不能直接撤销';
      END IF;

      NEW.before_amount_cents := current_amount;
      NEW.after_amount_cents := current_amount + NEW.delta_amount_cents;
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

      IF current_quantity + NEW.delta_quantity < 0 THEN
        RAISE EXCEPTION '该笔充值项目已被消费，不能直接撤销';
      END IF;

      NEW.before_quantity := current_quantity;
      NEW.after_quantity := current_quantity + NEW.delta_quantity;
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
