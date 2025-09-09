import {
  type ConfigStatus,
  ConfigStatusSchema,
  type HealthResponse,
  HealthResponseSchema,
  type ListDevicesResponse,
  ListDevicesResponseSchema,
  type ListSessionsResponse,
  ListSessionsResponseSchema,
  type QueueMetrics,
  QueueMetricsSchema,
} from '@pokecode/api';
import { getConfig } from '@pokecode/core';
import chalk from 'chalk';

type SafeParsed<T> = { success: true; data: T } | { success: false };

type Mode = 'attach' | 'foreground';

type Status = 'ok' | 'warn' | 'error' | 'unknown';

type Nullable<T> = T | undefined;

type DashboardState = {
  health: Nullable<HealthResponse>;
  config: Nullable<ConfigStatus>;
  devices: Nullable<ListDevicesResponse>;
  queue: Nullable<QueueMetrics>;
  sessions: Nullable<ListSessionsResponse>;
  logFilePath: string | null;
  dbFilePath: string | null;
  statusMessage: Nullable<string>;
  lastRedrawAt: number;
};

function pad(text: string, width: number): string {
  const t = text.length > width ? `${text.slice(0, Math.max(0, width - 1))}…` : text;
  const diff = width - t.length;
  return diff > 0 ? t + ' '.repeat(diff) : t;
}

function relativeAgo(iso: string): string {
  const d = new Date(iso);
  const diff = Math.max(0, Date.now() - d.getTime());
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m ago`;
}

function statusColor(state: Status): (s: string) => string {
  return state === 'ok'
    ? chalk.green
    : state === 'warn'
      ? chalk.yellow
      : state === 'error'
        ? chalk.red
        : chalk.gray;
}

function healthToStatus(h?: HealthResponse): Status {
  if (!h) return 'unknown';
  return h.status === 'healthy' ? 'ok' : 'error';
}

function boolToStatus(v?: boolean): Status {
  return v === undefined ? 'unknown' : v ? 'ok' : 'error';
}

function serviceToStatus(s: 'healthy' | 'unhealthy' | 'unknown'): Status {
  return s === 'healthy' ? 'ok' : s === 'unhealthy' ? 'error' : 'unknown';
}

async function safeGet<T>(
  url: string,
  schema: { safeParse: (x: unknown) => SafeParsed<T> },
): Promise<T | undefined> {
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return undefined;
    const json = await res.json();
    const parsed = schema.safeParse(json);
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

function drawFrame(params: { serverUrl: string; mode: Mode; state: DashboardState }): string {
  const width = Math.max(80, process.stdout.columns || 80);
  const lines: string[] = [];

  // Header
  lines.push('');
  lines.push(chalk.bold(` PokéCode @ ${params.serverUrl}`));

  // Health row
  const h = params.state.health;
  const cfg = params.state.config;
  const db = h ? serviceToStatus(h.services.database) : 'unknown';
  const q = h ? serviceToStatus(h.services.queue) : 'unknown';
  const api = healthToStatus(h);
  const worker = 'unknown' as Status; // refined later via /api/worker if needed

  const tag = (label: string, s: Status) => `${statusColor(s)('●')} ${label}`;
  const cfgTag = (label: string, ok: boolean | undefined) =>
    `${statusColor(boolToStatus(ok))('●')} ${label}`;

  const healthLine = [tag('API', api), tag('DB', db), tag('Queue', q), tag('Worker', worker)];
  const configLine = cfg
    ? [
        cfgTag('ClaudeCode', cfg.claudeCode.exists),
        cfgTag('CodexCLI', cfg.codexCli.exists),
        `LogLevel: ${cfg.logLevel}`,
      ]
    : ['Config: —'];

  lines.push(` ${healthLine.join('   ')}`);
  lines.push(` ${configLine.join('   ')}`);

  // Paths (log and database)
  const trunc = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);
  if (params.state.logFilePath || params.state.dbFilePath) {
    const logLine = params.state.logFilePath
      ? `Log: ${trunc(params.state.logFilePath, width - 6)}`
      : null;
    const dbLine = params.state.dbFilePath
      ? `DB:  ${trunc(params.state.dbFilePath, width - 6)}`
      : null;
    if (logLine) lines.push(` ${chalk.gray(logLine)}`);
    if (dbLine) lines.push(` ${chalk.gray(dbLine)}`);
  }

  // Devices table
  lines.push('');
  lines.push(chalk.bold(' Connected Devices (last 1h)'));
  const cols = [
    { name: 'id', w: 8 },
    { name: 'name', w: 22 },
    { name: 'platform', w: 8 },
    { name: 'version', w: 10 },
    { name: 'last seen', w: 14 },
  ] as const;
  const header = ` ${cols.map((c) => pad(c.name, c.w)).join('  ')}`;
  lines.push(chalk.gray(header));
  const devs = params.state.devices?.devices ?? [];
  const toShow = devs.slice(0, 8);
  for (const d of toShow) {
    const row = [
      pad(d.deviceId.slice(0, 8), cols[0].w),
      pad(d.deviceName, cols[1].w),
      pad(d.platform ?? '-', cols[2].w),
      pad(d.appVersion ?? '-', cols[3].w),
      pad(relativeAgo(d.lastConnectedAt), cols[4].w),
    ].join('  ');
    lines.push(` ${row}`);
  }
  if (toShow.length === 0) lines.push(` ${chalk.gray('no recent devices')}`);

  // Sessions table
  lines.push('');
  lines.push(chalk.bold(' Active Sessions (last 1h)'));
  const sessCols = [
    { name: 'id', w: 8 },
    { name: 'name', w: 18 },
    { name: 'provider', w: 8 },
    { name: 'working', w: 8 },
    { name: 'last msg', w: 14 },
    { name: 'msgs', w: 5 },
    { name: 'tokens', w: 7 },
  ] as const;
  lines.push(chalk.gray(` ${sessCols.map((c) => pad(c.name, c.w)).join('  ')}`));
  const now = Date.now();
  const sessionsRaw = params.state.sessions?.sessions ?? [];
  const sessions = sessionsRaw
    .filter((s): s is typeof sessionsRaw[number] & { lastMessageSentAt: string } =>
      typeof s.lastMessageSentAt === 'string',
    )
    .filter((s) => now - new Date(s.lastMessageSentAt).getTime() <= 3600 * 1000);
  const sShow = sessions.slice(0, 8);
  for (const s of sShow) {
    const row = [
      pad(s.id.slice(0, 8), sessCols[0].w),
      pad(s.name, sessCols[1].w),
      pad(s.provider, sessCols[2].w),
      pad(s.isWorking ? 'yes' : 'no', sessCols[3].w),
      pad(relativeAgo(s.lastMessageSentAt), sessCols[4].w),
      pad(String(s.messageCount), sessCols[5].w),
      pad(String(s.tokenCount), sessCols[6].w),
    ].join('  ');
    lines.push(` ${row}`);
  }
  if (sShow.length === 0) lines.push(` ${chalk.gray('no recently updated sessions')}`);

  // Queue
  if (params.state.queue) {
    const qm = params.state.queue;
    lines.push('');
    lines.push(chalk.bold(' Queue Metrics'));
    lines.push(
      ` waiting: ${qm.waiting}   active: ${qm.active}   completed: ${qm.completed}   failed: ${qm.failed}   delayed: ${qm.delayed}   paused: ${qm.paused}   total: ${qm.total}`,
    );
  }

  // Logs section
  lines.push('');
  lines.push(chalk.bold(' Logs'));
  lines.push(` ${chalk.gray('not shown in TUI; use `pokecode logs -f`')}`);

  // Footer
  lines.push('');
  const foot = ` q Quit  r Restart worker  (${params.mode})`;
  lines.push(chalk.gray(foot));

  if (params.state.statusMessage) {
    lines.push(chalk.yellow(` ${params.state.statusMessage}`));
  }

  // Cut to terminal height minus 1 for safety
  const height = Math.max(24, process.stdout.rows || 24);
  return lines.slice(0, height - 1).join('\n');
}

export function runDashboard(params: { serverUrl: string; mode: Mode }): void {
  const stdout = process.stdout;
  const stdin = process.stdin;

  function write(s: string) {
    stdout.write(s);
  }
  function clear() {
    write('\u001b[2J');
    write('\u001b[H');
  }

  const state: DashboardState = {
    health: undefined,
    config: undefined,
    devices: undefined,
    queue: undefined,
    sessions: undefined,
    logFilePath: null,
    dbFilePath: null,
    statusMessage: undefined,
    lastRedrawAt: 0,
  };

  let closed = false;
  // Cache the last rendered frame to avoid unnecessary redraws
  let prevFrame: string | null = null;
  const redraw = () => {
    if (closed) return;
    const now = Date.now();
    // modest throttle to avoid excessive CPU when events burst
    if (now - state.lastRedrawAt < 60) return;
    const nextFrame = drawFrame({ serverUrl: params.serverUrl, mode: params.mode, state });
    if (prevFrame === nextFrame) return;
    state.lastRedrawAt = now;
    prevFrame = nextFrame;
    clear();
    write(nextFrame);
  };

  const poll = async () => {
    const base = params.serverUrl;
    const [health, config, devices, queue, sessions] = await Promise.all([
      safeGet<HealthResponse>(`${base}/health`, HealthResponseSchema),
      safeGet<ConfigStatus>(`${base}/health/config`, ConfigStatusSchema),
      safeGet<ListDevicesResponse>(
        `${base}/api/connect/devices?activeWithinSeconds=3600&limit=20`,
        ListDevicesResponseSchema,
      ),
      safeGet<QueueMetrics>(`${base}/api/queue/metrics`, QueueMetricsSchema),
      safeGet<ListSessionsResponse>(
        `${base}/api/sessions?state=active&limit=50`,
        ListSessionsResponseSchema,
      ),
    ]);
    state.health = health;
    state.config = config;
    state.devices = devices;
    state.queue = queue;
    state.sessions = sessions;
    redraw();
  };

  // intervals
  const tick = setInterval(redraw, 1000);
  const pollFast = setInterval(poll, 5000);
  void poll();

  // input
  if (stdin.isTTY) stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding('utf8');
  const onData = (key: string) => {
    if (key === '\u0003' /* Ctrl+C */ || key === 'q' || key === 'Q' || key === '\u001b') {
      cleanup();
      process.exit(0);
      return;
    }
    if (key === 'r' || key === 'R') {
      void (async () => {
        try {
          const res = await fetch(`${params.serverUrl}/api/worker/restart`, { method: 'POST' });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          state.statusMessage = 'Worker restarted';
        } catch (_e) {
          state.statusMessage = `Worker restart failed`;
        }
        setTimeout(() => {
          state.statusMessage = undefined;
          redraw();
        }, 2000);
        redraw();
      })();
      return;
    }
  };
  stdin.on('data', onData);

  process.on('SIGWINCH', redraw);

  // first draw
  void (async () => {
    try {
      const cfg = await getConfig();
      state.logFilePath = cfg.logFile;
      state.dbFilePath = cfg.databasePath;
    } catch {}
    redraw();
  })();

  function cleanup() {
    closed = true;
    clearInterval(tick);
    clearInterval(pollFast);
    stdin.off('data', onData);
    process.off('SIGWINCH', redraw);
    if (stdin.isTTY) stdin.setRawMode(false);
    stdin.pause();
    write('\n');
  }
}
