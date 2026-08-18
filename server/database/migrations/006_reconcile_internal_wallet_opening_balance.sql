BEGIN;

WITH wallet_totals AS (
  SELECT
    asset.id AS customer_asset_id,
    ROUND(COALESCE(asset.current_balance, 0) * 100)::bigint AS target_cents,
    COALESCE(SUM(
      account.principal_opening_cents + account.gift_opening_cents
    ), 0)::bigint AS account_cents
  FROM customer_asset asset
  LEFT JOIN customer_card_account account
    ON account.customer_asset_id = asset.id
  GROUP BY asset.id, asset.current_balance
)
INSERT INTO customer_card_account (
  customer_asset_id,
  source_key,
  card_name,
  category,
  card_type,
  status,
  validity,
  principal_opening_cents,
  source_snapshot
)
SELECT
  customer_asset_id,
  'internal-balance-reconciliation:' || customer_asset_id::text,
  '门店余额校准账户',
  '储值余额',
  '余额校准账户',
  'active',
  '永久有效',
  target_cents - account_cents,
  jsonb_build_object(
    'reason', '历史卡明细合计与客户总余额存在差额，按客户总余额精确补齐',
    'targetCents', target_cents,
    'cardAccountCents', account_cents
  )
FROM wallet_totals
WHERE target_cents > account_cents
ON CONFLICT (customer_asset_id, source_key) DO NOTHING;

COMMIT;
