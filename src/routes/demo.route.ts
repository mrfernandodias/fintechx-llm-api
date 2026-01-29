import type { FastifyPluginAsync } from 'fastify'

import { pool } from '../db/mysql.js'

export const demoRoute: FastifyPluginAsync = async (app) => {
  app.get('/v1/demo/top-products', {
    schema: {
      summary: 'Top produtos (demo)',
      description: 'Demo: lista os 10 produtos mais caros com preço de lista.',
      tags: ['demo'],
      response: {
        200: {
          type: 'object',
          properties: {
            sql: { type: 'string' },
            data: { type: 'array' }
          },
          examples: [
            {
              sql: 'SELECT id, product_name, list_price FROM products ORDER BY list_price DESC LIMIT 10',
              data: [
                { id: 20, product_name: 'Northwind Traders Marmalade', list_price: '81.0000' }
              ]
            },
            {
              sql: 'SELECT id, product_name, list_price FROM products ORDER BY list_price DESC LIMIT 10',
              data: [
                { id: 1, product_name: 'Northwind Traders Chai', list_price: '18.0000' }
              ]
            }
          ]
        }
      }
    }
  }, async () => {
    const sql = `
      SELECT id, product_name, list_price
  FROM products
  ORDER BY list_price DESC
  LIMIT 10
    `.trim()

    const [rows] = await pool.query(sql)
    return { sql, data: rows }
  })
}
