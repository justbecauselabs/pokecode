import type { FastifyPluginAsync } from 'fastify';
import { getWorker, setWorker } from './index';
import { AgentRunnerWorker } from './workers';

const workerRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/restart', async (_request, reply) => {
    const current = getWorker?.() ?? null;
    if (current) {
      await current.shutdown();
    }
    const next = new AgentRunnerWorker();
    await next.start();
    setWorker(next);
    return reply.send({ status: 'ok' });
  });
};

export default workerRoutes;
