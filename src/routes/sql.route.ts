import type { FastifyPluginAsync } from 'fastify'

import { querySqlController, validateSqlController } from '../controllers/sql.controller.js'

export const sqlRoute: FastifyPluginAsync = async (app) => {
  app.post('/v1/sql/validate', {
    schema: {
      summary: 'Validação de SQL',
      description: 'Valida SQL com regras de segurança (somente SELECT).',
      tags: ['sql'],
      body: {
        type: 'object',
        required: ['sql'],
        properties: {
          sql: { type: 'string' }
        },
        examples: [
          { sql: 'SELECT * FROM products' },
          { sql: 'SELECT product_name, list_price FROM products ORDER BY list_price DESC' }
        ]
      },
      response: {
        200: {
          type: 'object',
          properties: {
            ok: { type: 'boolean' },
            errors: { type: 'array', items: { type: 'string' } },
            warnings: { type: 'array', items: { type: 'string' } },
            safeSql: { type: 'string' }
          },
          examples: [
            {
              ok: true,
              errors: [],
              warnings: ['LIMIT 200 aplicado automaticamente.'],
              safeSql: 'SELECT * FROM products LIMIT 200'
            },
            {
              ok: true,
              errors: [],
              warnings: [],
              safeSql: 'SELECT product_name, list_price FROM products ORDER BY list_price DESC LIMIT 10'
            }
          ]
        }
      }
    }
  }, validateSqlController)

  app.post('/v1/query', {
    schema: {
      tags: ['sql'],
      summary: 'Executar SQL (SELECT-only)',
      description: 'Executa SQL já validado e retorna os resultados.',
      body: {
        type: 'object',
        required: ['sql'],
        properties: {
          sql: { type: 'string' },
          params: { type: 'array', default: [] }
        },
        examples: [
          { sql: 'SELECT * FROM products', params: [] },
          { sql: 'SELECT product_name, list_price FROM products ORDER BY list_price DESC LIMIT 5', params: [] }
        ]
      },
      response: {
        200: {
          type: 'object',
          properties: {
            sql: { type: 'string' },
            warnings: { type: 'array', items: { type: 'string' } },
            latency_ms: { type: 'number' },
            rows: { type: 'array', items: {} }
          },
          examples: [
            {
              sql: 'SELECT * FROM products LIMIT 200',
              warnings: ['LIMIT 200 aplicado automaticamente.'],
              latency_ms: 52,
              rows: [{ id: 1, product_name: 'Northwind Traders Chai' }]
            },
            {
              sql: 'SELECT product_name, list_price FROM products ORDER BY list_price DESC LIMIT 5',
              warnings: [],
              latency_ms: 37,
              rows: [{ product_name: 'Northwind Traders Marmalade', list_price: '81.0000' }]
            }
          ]
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            errors: { type: 'array', items: { type: 'string' } },
            warnings: { type: 'array', items: { type: 'string' } }
          },
          examples: [
            {
              error: 'SQL_VALIDATION_FAILED',
              errors: ['Apenas SELECT é permitido.'],
              warnings: []
            },
            {
              error: 'SQL_VALIDATION_FAILED',
              errors: ['SQL contém padrão proibido: /;/' ],
              warnings: []
            }
          ]
        }
      }
    }
  }, querySqlController)
}
