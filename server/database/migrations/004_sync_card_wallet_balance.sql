BEGIN;

CREATE OR REPLACE FUNCTION sync_customer_card_wallet_balance()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  wallet_total_cents bigint;
BEGIN
  SELECT COALESCE(SUM(
    account.principal_opening_cents
    + account.gift_opening_cents
    + COALESCE((
        SELECT SUM(ledger.delta_amount_cents)
        FROM customer_card_ledger ledger
        WHERE ledger.account_id = account.id
          AND ledger.status = 'posted'
          AND ledger.deduction_mode IN ('principal', 'gift')
      ), 0)
  ), 0)
  INTO wallet_total_cents
  FROM customer_card_account account
  WHERE account.customer_asset_id = NEW.customer_asset_id;

  UPDATE customer_asset
  SET current_balance = wallet_total_cents::numeric / 100,
      _updated_at = CURRENT_TIMESTAMP,
      _updated_by = CASE
        WHEN NEW.operator_user_id IS NULL OR NEW.operator_user_id = '' THEN _updated_by
        ELSE ROW(NEW.operator_user_id)::user_profile
      END
  WHERE id = NEW.customer_asset_id;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_customer_card_wallet_balance
  ON customer_card_ledger;
CREATE TRIGGER trg_sync_customer_card_wallet_balance
  AFTER INSERT ON customer_card_ledger
  FOR EACH ROW EXECUTE FUNCTION sync_customer_card_wallet_balance();

COMMIT;
