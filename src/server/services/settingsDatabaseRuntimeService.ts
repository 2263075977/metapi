import { config } from '../config.js';
import { parseDatabaseMigrationPayload } from '../contracts/settingsRoutePayloads.js';
import { db, runtimeDbDialect, schema } from '../db/index.js';
import { upsertSetting } from '../db/upsertSetting.js';
import {
  maskConnectionString,
  migrateCurrentDatabase,
  normalizeMigrationInput,
  testDatabaseConnection,
  type MigrationDialect,
} from './databaseMigrationService.js';
import { appendSettingsEvent } from './settingsEventService.js';

type RuntimeDatabaseConfig = {
  dialect: MigrationDialect;
  connectionString: string;
  ssl: boolean;
};

const DB_TYPE_SETTING_KEY = 'db_type';
const DB_URL_SETTING_KEY = 'db_url';
const DB_SSL_SETTING_KEY = 'db_ssl';

function parseJsonValue(raw: unknown): unknown {
  if (typeof raw !== 'string' || !raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function maskRuntimeConnection(
  dialect: MigrationDialect,
  connectionString: string,
): string {
  const normalized = connectionString.trim();
  if (dialect === 'sqlite' && !normalized) return '(default sqlite path)';
  return maskConnectionString(normalized);
}

function parseDatabaseRuntimePayload(rawBody: unknown) {
  const parsedBody = parseDatabaseMigrationPayload(rawBody);
  if (!parsedBody.success) {
    throw new Error(parsedBody.error);
  }
  return parsedBody.data;
}

async function loadSavedRuntimeDatabaseConfig(): Promise<RuntimeDatabaseConfig | null> {
  const settingsRows = await db.select().from(schema.settings).all();
  const map = new Map(settingsRows.map((row) => [row.key, row.value]));
  const rawDialect = parseJsonValue(map.get(DB_TYPE_SETTING_KEY));
  const rawConnection = parseJsonValue(map.get(DB_URL_SETTING_KEY));
  const rawSsl = parseJsonValue(map.get(DB_SSL_SETTING_KEY));
  if (typeof rawDialect !== 'string' || typeof rawConnection !== 'string') {
    return null;
  }

  try {
    const normalized = normalizeMigrationInput({
      dialect: rawDialect,
      connectionString: rawConnection,
      ssl: rawSsl,
    });
    return {
      dialect: normalized.dialect,
      connectionString: normalized.connectionString,
      ssl: normalized.ssl,
    };
  } catch {
    return null;
  }
}

function buildRuntimeDatabaseState(saved: RuntimeDatabaseConfig | null) {
  const activeDialect = runtimeDbDialect;
  const activeConnection = (config.dbUrl || '').trim();
  const activeSsl = config.dbSsl;
  const restartRequired =
    !!saved &&
    (saved.dialect !== activeDialect ||
      saved.connectionString.trim() !== activeConnection ||
      saved.ssl !== activeSsl);

  return {
    active: {
      dialect: activeDialect,
      connection: maskRuntimeConnection(activeDialect, activeConnection),
      ssl: activeSsl,
    },
    saved: saved
      ? {
          dialect: saved.dialect,
          connection: maskRuntimeConnection(
            saved.dialect,
            saved.connectionString,
          ),
          ssl: saved.ssl,
        }
      : null,
    restartRequired,
  };
}

export async function loadRuntimeDatabasePayload() {
  const saved = await loadSavedRuntimeDatabaseConfig();
  return {
    success: true,
    ...buildRuntimeDatabaseState(saved),
  };
}

export async function saveRuntimeDatabasePayload(rawBody: unknown) {
  const normalized = normalizeMigrationInput(parseDatabaseRuntimePayload(rawBody));
  await upsertSetting(DB_TYPE_SETTING_KEY, normalized.dialect);
  await upsertSetting(DB_URL_SETTING_KEY, normalized.connectionString);
  await upsertSetting(DB_SSL_SETTING_KEY, normalized.ssl);

  await appendSettingsEvent({
    type: 'status',
    title: '数据库运行配置已更新',
    message: `已保存运行数据库配置：${normalized.dialect}${normalized.ssl ? ' (SSL)' : ''}（重启后生效）`,
  });

  const saved: RuntimeDatabaseConfig = {
    dialect: normalized.dialect,
    connectionString: normalized.connectionString,
    ssl: normalized.ssl,
  };

  return {
    success: true,
    message: '数据库运行配置已保存，重启容器后生效',
    ...buildRuntimeDatabaseState(saved),
  };
}

export async function testRuntimeDatabaseConnectionPayload(rawBody: unknown) {
  const result = await testDatabaseConnection(parseDatabaseRuntimePayload(rawBody));
  return {
    success: true,
    message: '目标数据库连接成功',
    ...result,
  };
}

export async function migrateRuntimeDatabasePayload(rawBody: unknown) {
  const result = await migrateCurrentDatabase(parseDatabaseRuntimePayload(rawBody));
  void appendSettingsEvent({
    type: 'status',
    title: '数据库迁移已完成',
    message: `目标 ${result.dialect}，已迁移站点 ${result.rows.sites}、账号 ${result.rows.accounts}、令牌 ${result.rows.accountTokens}、路由 ${result.rows.tokenRoutes}、通道 ${result.rows.routeChannels}、设置 ${result.rows.settings}`,
  });
  return {
    success: true,
    message: '数据库迁移完成',
    ...result,
  };
}
