import type { FastifyPluginAsync } from 'fastify'

import { getSchemaCached } from '../services/schema/schemaCache.js'

export const metaRoute: FastifyPluginAsync = async (app) => {
  app.get('/v1/meta/schema', {
    schema: {
      summary: 'Schema do banco',
      description: 'Retorna tabelas e colunas do banco (cacheado) em formato compacto.',
      tags: ['meta'],
      response: {
        200: {
          type: 'object',
          properties: {
            tables: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  table: { type: 'string' },
                  columns: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string' },
                        type: { type: 'string' },
                        nullable: { type: 'boolean' }
                      }
                    }
                  }
                }
              }
            }
          },
          examples: [
            {
              tables: [
                {
                  table: 'products',
                  columns: [
                    { name: 'id', type: 'int', nullable: false },
                    { name: 'product_name', type: 'varchar', nullable: false },
                    { name: 'list_price', type: 'decimal', nullable: false }
                  ]
                }
              ]
            },
            {
              tables: [
                {
                  table: 'orders',
                  columns: [
                    { name: 'id', type: 'int', nullable: false },
                    { name: 'order_date', type: 'datetime', nullable: false },
                    { name: 'ship_city', type: 'varchar', nullable: true }
                  ]
                }
              ]
            }
          ]
        }
      }
    },
  }, async () => {
    const schema = await getSchemaCached()

    // formato compacto (melhor pra prompt depois)
    const compact = Object.entries(schema).map(([table, cols]) => ({
      table,
      columns: cols.map(c => ({
        name: c.column,
        type: c.type,
        nullable: c.nullable === 'YES',
      })),
    }))

    return { tables: compact }
  })
}
