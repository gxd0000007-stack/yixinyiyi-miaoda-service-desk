CREATE TABLE IF NOT EXISTS service_state (
  appointment_id VARCHAR(64) PRIMARY KEY,
  completed_task_ids TEXT NOT NULL DEFAULT '[]',
  actor_name VARCHAR(255) NOT NULL DEFAULT '数据前台',
  actor_user_id VARCHAR(255),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS service_config (
  config_key VARCHAR(64) PRIMARY KEY,
  config_value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO service_state (
  appointment_id,
  completed_task_ids,
  actor_name
) VALUES (
  '1',
  '["room","scent","bed","photo","tech","route","drink"]',
  '数据前台'
) ON CONFLICT (appointment_id) DO NOTHING;

INSERT INTO service_config (
  config_key,
  config_value
) VALUES (
  'chat_url',
  'https://applink.feishu.cn/client/chat/chatter/add_by_link?link_token=2aaj1e3f-59fc-4bb7-b388-16fda450995d'
) ON CONFLICT (config_key) DO UPDATE SET
  config_value = EXCLUDED.config_value,
  updated_at = CURRENT_TIMESTAMP;
