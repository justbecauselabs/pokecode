import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const devices = sqliteTable(
  'devices',
  {
    deviceId: text('device_id').primaryKey(),
    deviceName: text('device_name').notNull(),
    platform: text('platform'),
    appVersion: text('app_version'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull()
      .$onUpdate(() => new Date()),
    lastConnectedAt: integer('last_connected_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (t) => ({
    lastConnectedIdx: index('idx_devices_last_connected_at').on(t.lastConnectedAt),
  }),
);

export type Device = typeof devices.$inferSelect;
export type NewDevice = typeof devices.$inferInsert;
