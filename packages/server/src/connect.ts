import {
  ConnectErrorResponseSchema,
  type ConnectRequest,
  ConnectRequestSchema,
  ConnectResponseSchema,
  ListDevicesQuerySchema,
  ListDevicesResponseSchema,
} from '@pokecode/api';
import { deviceService } from '@pokecode/core';
import type { FastifyPluginAsync } from 'fastify';

const connectRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /devices - list devices seen within timeframe
  fastify.get(
    '/devices',
    {
      schema: {
        querystring: ListDevicesQuerySchema,
        response: {
          200: ListDevicesResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const query = ListDevicesQuerySchema.parse(request.query);
      const args: { activeWithinSeconds?: number; limit?: number; offset?: number } = {};
      if (typeof query.activeWithinSeconds === 'number')
        args.activeWithinSeconds = query.activeWithinSeconds;
      if (typeof query.limit === 'number') args.limit = query.limit;
      if (typeof query.offset === 'number') args.offset = query.offset;
      const result = await deviceService.list(args);
      return reply.send(result);
    },
  );

  fastify.post<{ Body: ConnectRequest }>(
    '/',
    {
      schema: {
        body: ConnectRequestSchema,
        response: {
          200: ConnectResponseSchema,
          422: ConnectErrorResponseSchema,
          500: ConnectErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const payload: {
          deviceId: string;
          deviceName: string;
          platform?: 'ios' | 'android';
          appVersion?: string;
        } = {
          deviceId: request.body.device_id,
          deviceName: request.body.device_name,
        };
        if (request.body.platform) payload.platform = request.body.platform;
        if (request.body.app_version) payload.appVersion = request.body.app_version;
        await deviceService.upsertHeartbeat(payload);

        return reply.send({
          status: 'ok',
          poll_interval_s: 5,
          server_time: new Date().toISOString(),
        });
      } catch (error) {
        fastify.log.error(
          { error, device: request.body.device_id?.slice(0, 8) },
          'connect upsert failed',
        );
        return reply.code(500).send({ error: 'Unexpected server error', code: 'INTERNAL' });
      }
    },
  );
};

export default connectRoutes;
