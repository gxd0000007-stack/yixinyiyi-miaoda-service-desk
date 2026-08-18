BEGIN;

INSERT INTO customer_card_account (
  customer_asset_id,
  source_key,
  card_name,
  category,
  card_type,
  status,
  validity,
  card_number,
  account_number,
  principal_opening_cents,
  gift_opening_cents,
  session_value_opening_cents,
  source_snapshot
)
SELECT
  asset.id,
  COALESCE(card.value->>'sourceKey', 'internal-card:' || asset.id::text || ':' || card.ordinality::text),
  COALESCE(NULLIF(card.value->>'cardName', ''), '未命名卡账户'),
  NULLIF(card.value->>'category', ''),
  NULLIF(card.value->>'cardType', ''),
  COALESCE(NULLIF(card.value->>'status', ''), '状态待确认'),
  NULLIF(card.value->>'validity', ''),
  NULLIF(card.value->>'cardNumber', ''),
  NULLIF(card.value->>'accountNumber', ''),
  ROUND(COALESCE(NULLIF(card.value->>'principalBalance', '')::numeric, 0) * 100)::bigint,
  ROUND(COALESCE(NULLIF(card.value->>'giftBalance', '')::numeric, 0) * 100)::bigint,
  ROUND(COALESCE(NULLIF(card.value->>'sessionBalance', '')::numeric, 0) * 100)::bigint,
  card.value
FROM customer_asset asset
CROSS JOIN LATERAL jsonb_array_elements(
  COALESCE(asset.raw_profile->'有赞卡项', '[]'::jsonb)
) WITH ORDINALITY AS card(value, ordinality)
ON CONFLICT (customer_asset_id, source_key) DO NOTHING;

INSERT INTO customer_card_account (
  customer_asset_id,
  source_key,
  card_name,
  card_type,
  status,
  validity,
  principal_opening_cents,
  source_snapshot
)
SELECT
  asset.id,
  'internal-opening:' || asset.id::text,
  '门店储值账户',
  '储值账户',
  'active',
  '永久有效',
  ROUND(COALESCE(asset.current_balance, 0) * 100)::bigint,
  '{}'::jsonb
FROM customer_asset asset
WHERE NOT EXISTS (
  SELECT 1
  FROM customer_card_account account
  WHERE account.customer_asset_id = asset.id
)
ON CONFLICT (customer_asset_id, source_key) DO NOTHING;

INSERT INTO customer_card_entitlement (
  account_id,
  source_right_key,
  right_name,
  right_type,
  is_gift,
  discount_rule,
  opening_total_count,
  opening_used_count,
  opening_remaining_count
)
SELECT
  account.id,
  account.source_key || ':' || (right_item.ordinality - 1)::text || ':'
    || COALESCE(NULLIF(right_item.value->>'name', ''), '未命名权益'),
  COALESCE(NULLIF(right_item.value->>'name', ''), '未命名权益'),
  NULLIF(right_item.value->>'type', ''),
  COALESCE(right_item.value->>'gift', '') = '是',
  NULLIF(right_item.value->>'discountRule', ''),
  CASE
    WHEN NULLIF(right_item.value->>'total', '') IS NULL THEN NULL
    ELSE ROUND((right_item.value->>'total')::numeric)::integer
  END,
  CASE
    WHEN NULLIF(right_item.value->>'used', '') IS NULL THEN NULL
    ELSE ROUND((right_item.value->>'used')::numeric)::integer
  END,
  CASE
    WHEN NULLIF(right_item.value->>'remaining', '') IS NULL THEN NULL
    ELSE ROUND((right_item.value->>'remaining')::numeric)::integer
  END
FROM customer_asset asset
CROSS JOIN LATERAL jsonb_array_elements(
  COALESCE(asset.raw_profile->'有赞卡项', '[]'::jsonb)
) WITH ORDINALITY AS card(value, ordinality)
JOIN customer_card_account account
  ON account.customer_asset_id = asset.id
  AND account.source_key = COALESCE(
    card.value->>'sourceKey',
    'internal-card:' || asset.id::text || ':' || card.ordinality::text
  )
CROSS JOIN LATERAL jsonb_array_elements(
  COALESCE(card.value->'rights', '[]'::jsonb)
) WITH ORDINALITY AS right_item(value, ordinality)
ON CONFLICT (account_id, source_right_key) DO NOTHING;

COMMIT;
