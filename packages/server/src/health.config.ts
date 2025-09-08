import type { FastifyPluginAsync } from 'fastify';
import { ConfigStatusSchema } from '@pokecode/api';
import { getConfig } from '@pokecode/core';

const healthConfigRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/config',
    {
      schema: {
        response: { 200: ConfigStatusSchema },
      },
    },
    async (_request, reply) => {
      const cfg = await getConfig();

      async function check(path: string | undefined) {
        if (!path) return { configuredPath: null, exists: false, version: null } as const;
        const file = Bun.file(path);
        const exists = await file.exists();
        let version: string | null = null;
        if (exists) {
          try {
            const proc = Bun.spawn({ cmd: [path, '--version'], stdout: 'pipe', stderr: 'pipe' });
            await proc.exited;
            const out = proc.stdout ? await new Response(proc.stdout).text() : null;
            version = out ? out.trim() || null : null;
          } catch {
            version = null;
          }
        }
        return { configuredPath: path, exists, version } as const;
      }

      const [claude, codex] = await Promise.all([check(cfg.claudeCodePath), check(cfg.codexCliPath)]);
      return reply.send({ claudeCode: claude, codexCli: codex, logLevel: cfg.logLevel });
    },
  );
};

export default healthConfigRoutes;
