import { sql } from 'drizzle-orm';
import { db } from '../database';
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
}

export const deviceService = new DeviceService();
