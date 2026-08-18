import { spawn, spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';

const APP_ID = 'app_17bqq1hu1r4';
const CHAT_ID = 'oc_e24ee1bc42e8722b342dbd5c93c986a1';
const LARK_CLI =
  process.env.LARK_CLI_BIN ||
  join(homedir(), '.local', 'node-current', 'bin', 'lark-cli');
const SYNC_ENVS = (process.env.SYNC_ENVS || 'online')
  .split(',')
  .map((value) => value.trim())
  .filter((value) => value === 'online' || value === 'dev');

const TECHNICIAN_NAMES = {
  '欣': '欣欣',
  '冉': '冉冉',
  '圆': '圆圆',
  '安': '安安',
  '佳': '佳佳',
  '米': '小米',
};

const DEMO_PROFILES = [
  {
    project: '深层补水管理',
    room: '201',
    member: 'VIP会员',
    accent: '#7c5cff',
    amount: '¥980',
    tags: ['补水', '哺乳期', '敏感肌', '熟客'],
    arrivalMethod: '开车',
    lastVisit: '07月15日',
    lastSpend: '¥980',
    cardBalance: '¥4,260',
    remainingProjects: [
      { name: '深层补水管理', times: 3, expires: '2027年06月30日' },
      { name: '舒缓修护管理', times: 2, expires: '2027年06月30日' },
    ],
  },
  {
    project: '舒缓修护管理',
    room: '202',
    member: '铂金会员',
    accent: '#2f80ed',
    amount: '¥1,280',
    tags: ['舒缓', '敏感期关怀', '安静休息'],
    arrivalMethod: '打车',
    lastVisit: '07月22日',
    lastSpend: '¥1,280',
    cardBalance: '¥3,280',
    remainingProjects: [
      { name: '舒缓修护管理', times: 4, expires: '2027年05月31日' },
    ],
  },
  {
    project: '面部轮廓管理',
    room: '203',
    member: '黑钻会员',
    accent: '#ef8d32',
    amount: '¥2,380',
    tags: ['轮廓', 'VIP', '效果对照'],
    arrivalMethod: '开车',
    lastVisit: '07月18日',
    lastSpend: '¥2,380',
    cardBalance: '¥16,800',
    remainingProjects: [
      { name: '面部轮廓管理', times: 6, expires: '2027年06月30日' },
      { name: '肩颈衔接放松', times: 3, expires: '2027年06月30日' },
    ],
  },
  {
    project: '净透焕肤管理',
    room: '205',
    member: '储值会员',
    accent: '#16a085',
    amount: '¥1,080',
    tags: ['焕肤', '肤况观察', '防晒关怀'],
    arrivalMethod: '网约车',
    lastVisit: '07月26日',
    lastSpend: '¥1,080',
    cardBalance: '¥2,160',
    remainingProjects: [
      { name: '净透焕肤管理', times: 2, expires: '2027年03月31日' },
      { name: '水光补水管理', times: 1, expires: '2027年03月31日' },
    ],
  },
  {
    project: '肩颈舒压护理',
    room: '206',
    member: '次卡客户',
    accent: '#d05788',
    amount: '¥680',
    tags: ['肩颈', '上班族', '力度关注'],
    arrivalMethod: '地铁',
    lastVisit: '07月29日',
    lastSpend: '¥680',
    cardBalance: '¥1,360',
    remainingProjects: [
      { name: '肩颈舒压护理', times: 5, expires: '2026年12月31日' },
    ],
  },
];

const WEEKDAY_NAMES = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

const RECOVERED_AUGUST_7 = {
  appointments: [
    {
      id: 1,
      time: '15:00',
      name: '王启慧',
      nickname: '启慧',
      project: '三明治美白',
      room: '101',
      fixedTechnician: '欣欣',
      technician: '欣欣',
      status: '准备中',
      member: '1688会员老客',
      accent: '#7c5cff',
      amount: '¥1,688',
      tags: ['历史工作台恢复', '重点关怀', '美白提亮', '哺乳期', '敏感肌'],
      arrivalMethod: '开车',
      lastVisit: '07月12日',
      lastSpend: '¥1,688',
      cardBalance: '¥4,260',
      remainingProjects: [
        { name: '三明治美白', times: 2, expires: '2027年03月31日' },
        { name: '水光补水管理', times: 1, expires: '2027年03月31日' },
        { name: '舒缓修护管理', times: 1, expires: '2027年03月31日' },
        { name: '肩颈舒压护理', times: 1, expires: '2026年12月31日' },
      ],
    },
    {
      id: 2,
      time: '10:00',
      name: '林晓雯',
      nickname: '晓雯',
      project: '深层补水管理',
      room: '203',
      fixedTechnician: '小米',
      technician: '小米',
      status: '已完成',
      member: '铂金会员',
      accent: '#2f80ed',
      amount: '¥980',
      tags: ['历史工作台恢复', '补水', '熟客', '安静休息'],
      arrivalMethod: '打车',
      lastVisit: '07月26日',
      lastSpend: '¥980',
      cardBalance: '¥3,280',
      remainingProjects: [
        { name: '深层补水管理', times: 3, expires: '2027年05月31日' },
        { name: '眼周保湿护理', times: 2, expires: '2027年05月31日' },
      ],
    },
    {
      id: 3,
      time: '11:30',
      name: '周雅琪',
      nickname: '雅琪',
      project: '舒缓修护',
      room: '202',
      fixedTechnician: '圆圆',
      technician: '圆圆',
      status: '服务中',
      member: '储值会员',
      accent: '#16a085',
      amount: '¥1,280',
      tags: ['历史工作台恢复', '舒缓', '首次到店', '怕冷'],
      arrivalMethod: '步行',
      lastVisit: '首次到店',
      lastSpend: '首次到店',
      cardBalance: '¥2,000',
      remainingProjects: [
        { name: '舒缓修护', times: 4, expires: '2027年08月07日' },
      ],
    },
    {
      id: 4,
      time: '13:30',
      name: '陈思妍',
      nickname: '思妍',
      project: '面部轮廓管理',
      room: 'VIP 1',
      fixedTechnician: '佳佳',
      technician: '佳佳',
      status: '服务中',
      member: '黑钻会员',
      accent: '#ef8d32',
      amount: '¥2,380',
      tags: ['历史工作台恢复', '轮廓', 'VIP', '固定技师'],
      arrivalMethod: '开车',
      lastVisit: '07月18日',
      lastSpend: '¥2,380',
      cardBalance: '¥16,800',
      remainingProjects: [
        { name: '面部轮廓管理', times: 6, expires: '2027年06月30日' },
        { name: '肩颈衔接放松', times: 3, expires: '2027年06月30日' },
      ],
    },
    {
      id: 5,
      time: '16:30',
      name: '许静怡',
      nickname: '静怡',
      project: '肩颈舒压护理',
      room: '206',
      fixedTechnician: '安安',
      technician: '安安',
      status: '待到店',
      member: '次卡客户',
      accent: '#d05788',
      amount: '¥680',
      tags: ['历史工作台恢复', '肩颈', '上班族', '大力度'],
      arrivalMethod: '地铁',
      lastVisit: '07月22日',
      lastSpend: '¥680',
      cardBalance: '¥1,360',
      remainingProjects: [
        { name: '肩颈舒压护理', times: 5, expires: '2026年12月31日' },
      ],
    },
    {
      id: 6,
      time: '18:00',
      name: '赵若澜',
      nickname: '若澜',
      project: '净透焕肤管理',
      room: '205',
      fixedTechnician: '欣欣',
      technician: '欣欣',
      status: '待到店',
      member: '新客体验',
      accent: '#4f9c76',
      amount: '¥1,080',
      tags: ['历史工作台恢复', '焕肤', '新客', '需建档'],
      arrivalMethod: '网约车',
      lastVisit: '首次到店',
      lastSpend: '首次到店',
      cardBalance: '¥1,080',
      remainingProjects: [
        { name: '净透焕肤管理', times: 1, expires: '2026年09月30日' },
      ],
    },
  ],
  schedule: {
    date: '2026-08-07',
    label: '8月7日',
    weekday: '星期五',
    note: '已从此前工作台发布版本恢复，可完整回看并纳入周报',
    sourceName: '历史工作台恢复',
    importedAt: '2026-08-07T23:59:00+08:00',
  },
};

function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

function normalizeTechnician(value) {
  const name = value.trim();
  return TECHNICIAN_NAMES[name] || name;
}

function profileIndexForCustomer(name) {
  const normalized = name.replace(/\s+/gu, '').toLowerCase();
  let hash = 1;
  for (const character of normalized) {
    hash = Math.imul(hash, 23) + (character.codePointAt(0) || 0);
  }
  return Math.abs(hash) % DEMO_PROFILES.length;
}

function inferYear(month, day) {
  const now = new Date();
  const currentYear = Number(
    new Intl.DateTimeFormat('en', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
    }).format(now),
  );
  const candidate = new Date(`${currentYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T12:00:00+08:00`);
  const distance = candidate.getTime() - now.getTime();
  if (distance < -180 * 24 * 60 * 60 * 1000) return currentYear + 1;
  return currentYear;
}

function parseAppointmentMessage(content, messageId, createTime) {
  if (typeof content !== 'string' || !content.trim()) return null;
  const lines = content
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return null;

  const dateMatch = lines[0].match(
    /^(\d{1,2})\s*(?:月|🈷️?|\/|-)\s*(\d{1,2})\s*日?\s*(?:周|星期)?\s*([一二三四五六日天])?/u,
  );
  if (!dateMatch) return null;

  const month = Number(dateMatch[1]);
  const day = Number(dateMatch[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const year = inferYear(month, day);
  const date = new Date(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T12:00:00+08:00`);
  if (Number.isNaN(date.getTime())) return null;

  const parsed = [];
  for (const line of lines.slice(1)) {
    const match = line.match(
      /^(\d{1,2}):(\d{2})\s*(.+?)\s*[【\[（(]\s*([^\u3011\]\uff09)\s]+)\s*[】\]）)]?\s*$/u,
    );
    if (!match) continue;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    const name = match[3].trim();
    if (hour > 23 || minute > 59 || !name) continue;
    parsed.push({
      time: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
      name,
      technician: normalizeTechnician(match[4]),
    });
  }
  if (!parsed.length) return null;

  const dateKey = year * 10000 + month * 100 + day;
  const appointments = parsed.map((item, index) => {
    const profile = DEMO_PROFILES[profileIndexForCustomer(item.name)];
    return {
      id: dateKey * 100 + index + 1,
      time: item.time,
      name: item.name,
      nickname: item.name,
      project: profile.project,
      room: profile.room,
      fixedTechnician: item.technician,
      technician: item.technician,
      status: '待到店',
      member: profile.member,
      accent: profile.accent,
      amount: profile.amount,
      tags: ['飞书预约表同步', '标准流程Demo', ...profile.tags],
      arrivalMethod: profile.arrivalMethod,
      lastVisit: profile.lastVisit,
      lastSpend: profile.lastSpend,
      cardBalance: profile.cardBalance,
      remainingProjects: profile.remainingProjects,
    };
  });

  return {
    appointments,
    schedule: {
      date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      label: `${month}月${day}日`,
      weekday: WEEKDAY_NAMES[date.getUTCDay()],
      note: '飞书群预约已自动同步，可直接点击查看完整服务流程',
      sourceName: '飞书群预约自动同步',
      sourceMessageId: messageId,
      importedAt: createTime || new Date().toISOString(),
    },
  };
}

function syncPayload(payload, { updateCurrent = true } = {}) {
  const json = JSON.stringify(payload);
  const escaped = json.replaceAll("'", "''");
  const dayKey = `appointments_day:${payload.schedule.date}`;
  const values = updateCurrent
    ? `('${dayKey}', '${escaped}', CURRENT_TIMESTAMP), ('appointments_json', '${escaped}', CURRENT_TIMESTAMP)`
    : `('${dayKey}', '${escaped}', CURRENT_TIMESTAMP)`;
  const sql =
    "INSERT INTO service_config (config_key, config_value, updated_at) " +
    `VALUES ${values} ` +
    'ON CONFLICT (config_key) DO UPDATE SET ' +
    'config_value = EXCLUDED.config_value, updated_at = CURRENT_TIMESTAMP;';

  for (const environment of SYNC_ENVS) {
    const result = spawnSync(
      LARK_CLI,
      [
        'apps',
        '+db-execute',
        '--app-id',
        APP_ID,
        '--environment',
        environment,
        '--sql',
        sql,
        '--yes',
        '--as',
        'user',
      ],
      { encoding: 'utf8', timeout: 60_000 },
    );
    if (result.status !== 0) {
      throw new Error(
        `写入 ${environment} 失败: ${(result.stderr || result.stdout || '').trim()}`,
      );
    }
  }
  log(
    `已归档 ${payload.schedule.date} 的 ${payload.appointments.length} 条预约${updateCurrent ? '，并设为当前日' : ''}`,
  );
}

function backfillLatestMessage() {
  const result = spawnSync(
    LARK_CLI,
    [
      'im',
      '+chat-messages-list',
      '--chat-id',
      CHAT_ID,
      '--order',
      'desc',
      '--page-size',
      '50',
      '--format',
      'json',
      '--no-reactions',
      '--as',
      'bot',
    ],
    { encoding: 'utf8', timeout: 60_000 },
  );
  if (result.status !== 0) {
    throw new Error(`读取群历史失败: ${(result.stderr || result.stdout || '').trim()}`);
  }
  const response = JSON.parse(result.stdout);
  const messages = response?.data?.messages || [];
  const payloadsByDate = new Map();
  for (const message of messages) {
    const payload = parseAppointmentMessage(
      message.content,
      message.message_id,
      message.create_time,
    );
    if (payload && !payloadsByDate.has(payload.schedule.date)) {
      payloadsByDate.set(payload.schedule.date, payload);
    }
  }
  if (!payloadsByDate.has(RECOVERED_AUGUST_7.schedule.date)) {
    payloadsByDate.set(
      RECOVERED_AUGUST_7.schedule.date,
      RECOVERED_AUGUST_7,
    );
  }
  const payloads = Array.from(payloadsByDate.values()).sort((left, right) =>
    left.schedule.date.localeCompare(right.schedule.date),
  );
  payloads.forEach((payload, index) =>
    syncPayload(payload, { updateCurrent: index === payloads.length - 1 }),
  );
  log(`历史补拉完成，共恢复 ${payloads.length} 个预约日期`);
}

let stopping = false;
let consumer;

function startConsumer() {
  if (stopping) return;
  consumer = spawn(
    LARK_CLI,
    ['event', 'consume', 'im.message.receive_v1', '--as', 'bot'],
    { stdio: ['pipe', 'pipe', 'pipe'] },
  );

  let pending = '';
  consumer.stdout.setEncoding('utf8');
  consumer.stdout.on('data', (chunk) => {
    pending += chunk;
    const lines = pending.split('\n');
    pending = lines.pop() || '';
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const event = JSON.parse(line);
        if (
          event.chat_id !== CHAT_ID ||
          !['text', 'post'].includes(event.message_type)
        ) {
          continue;
        }
        const payload = parseAppointmentMessage(
          event.content,
          event.message_id,
          event.create_time,
        );
        if (payload) syncPayload(payload);
      } catch (error) {
        log(`处理群消息失败: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  });
  consumer.stderr.setEncoding('utf8');
  consumer.stderr.on('data', (chunk) => {
    const text = chunk.trim();
    if (text) log(text);
  });
  consumer.on('exit', (code, signal) => {
    log(`事件监听退出 code=${code ?? ''} signal=${signal ?? ''}`);
    consumer = undefined;
    if (!stopping) setTimeout(startConsumer, 5_000);
  });
}

function shutdown() {
  stopping = true;
  if (consumer && !consumer.killed) consumer.kill('SIGTERM');
  setTimeout(() => process.exit(0), 1_000).unref();
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

try {
  backfillLatestMessage();
} catch (error) {
  log(`启动补拉失败: ${error instanceof Error ? error.message : String(error)}`);
}
if (process.argv.includes('--backfill-only')) {
  process.exit(0);
} else {
  startConsumer();
}
