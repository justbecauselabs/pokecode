import {
  ConnectErrorResponseSchema,
  type ConnectRequest,
  ConnectRequestSchema,
  ConnectResponseSchema,
} from '@pokecode/api';
import { deviceService } from '@pokecode/core';
import type { FastifyPluginAsync } from 'fastify';

const connectRoutes: FastifyPluginAsync = async (fastify) => {
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
