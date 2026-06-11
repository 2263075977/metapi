import { db, schema } from '../db/index.js';
import { formatUtcSqlDateTime } from './localTimeService.js';

export type SettingsEventInput = {
  type: 'checkin' | 'balance' | 'proxy' | 'status' | 'token';
  title: string;
  message: string;
  level?: 'info' | 'warning' | 'error';
};

export async function appendSettingsEvent(input: SettingsEventInput) {
  try {
    const createdAt = formatUtcSqlDateTime(new Date());
    await db
      .insert(schema.events)
      .values({
        type: input.type,
        title: input.title,
        message: input.message,
        level: input.level || 'info',
        relatedType: 'settings',
        createdAt,
      })
      .run();
  } catch {}
}
