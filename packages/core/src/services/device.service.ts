import { desc, gte, sql } from 'drizzle-orm';
import { db, sqlite } from '../database';
import { devices } from '../database/schema-sqlite/devices';

export class DeviceService {
  async upsertHeartbeat(params: {
    deviceId: string;
    deviceName: string;
    platform?: 'ios' | 'android';
    appVersion?: string;
  }): Promise<void> {
    const now = new Date();
    await db
      .insert(devices)
      .values({
        deviceId: params.deviceId,
        deviceName: params.deviceName,
        platform: params.platform ?? null,
        appVersion: params.appVersion ?? null,
        lastConnectedAt: now,
      })
      .onConflictDoUpdate({
        target: devices.deviceId,
        set: {
          deviceName: sql`excluded.device_name`,
          platform: sql`excluded.platform`,
          appVersion: sql`excluded.app_version`,
          lastConnectedAt: now,
          updatedAt: now,
        },
      });
  }

  async list(params: { activeWithinSeconds?: number; limit?: number; offset?: number }) {
    const activeWithin = params.activeWithinSeconds ?? 3600;
    const limit = Math.min(Math.max(params.limit ?? 100, 1), 200);
    const offset = Math.max(params.offset ?? 0, 0);

    // Use raw sqlite for this listing to avoid timestamp binding issues
    const sinceSec = Math.floor(Date.now() / 1000) - activeWithin;

    type Row = {
      device_id: string;
      device_name: string;
      platform: string | null;
      app_version: string | null;
      last_connected_at: number; // epoch seconds
    };
    const listStmt = sqlite.query<Row, [number, number, number]>(
      'select device_id, device_name, platform, app_version, last_connected_at from devices where last_connected_at >= ? order by last_connected_at desc limit ? offset ?',
    );
    const rows = listStmt.all(sinceSec, limit, offset);

    const countStmt = sqlite.query<{ cnt: number }, [number]>(
      'select count(*) as cnt from devices where last_connected_at >= ?',
    );
    const countRow = countStmt.get(sinceSec);

    return {
      devices: rows.map((d) => ({
        deviceId: d.device_id,
        deviceName: d.device_name,
        platform: d.platform === 'ios' || d.platform === 'android' ? d.platform : null,
        appVersion: d.app_version,
        lastConnectedAt: new Date(d.last_connected_at * 1000).toISOString(),
      })),
      total: countRow?.cnt ?? 0,
      limit,
      offset,
    };
  }
}

export const deviceService = new DeviceService();
