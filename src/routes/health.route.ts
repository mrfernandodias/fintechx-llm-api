import type { FastifyPluginAsync } from 'fastify'

export const healthRoute: FastifyPluginAsync = async (app) => {
  app.get('/health', {
    schema: {
      summary: 'Health check',
      description: 'Verifica se a API está online.',
      tags: ['health'],
      response: {
        200: {
          type: 'object',
          properties: {
            ok: { type: 'boolean' }
          },
          example: { ok: true }
        }
      }
    }
  }, async () => ({ ok: true }))
}
