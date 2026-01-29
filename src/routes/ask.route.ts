import type { FastifyPluginAsync } from 'fastify'

import { askController } from '../controllers/ask.controller.js'

export const askRoute: FastifyPluginAsync = async (app) => {
  app.post('/v1/ask', {
    schema: {
      summary: 'Pergunta em linguagem natural',
      description: 'Gera SQL via LLM, valida e (opcionalmente) executa. Apenas SELECT.',
      tags: ['ask'],
      body: {
        type: 'object',
        required: ['question'],
        properties: {
          question: { type: 'string' },
          execute: { type: 'boolean', default: true },
          debug: { type: 'boolean', default: false },
        },
        examples: [
          { question: 'Quais são os produtos mais populares entre os clientes corporativos?' },
          { question: 'Quais são os produtos mais vendidos em termos de quantidade?' },
          { question: 'Qual é o volume de vendas por cidade?' },
          { question: 'Quais são os clientes que mais compraram?' },
          { question: 'Quais são os produtos mais caros da loja?' },
          { question: 'Quais são os fornecedores mais frequentes nos pedidos?' },
          { question: 'Quais os melhores vendedores?' },
          { question: 'Qual é o valor total de todas as vendas realizadas por ano?' },
          { question: 'Qual é o valor total de vendas por categoria de produto?' },
          { question: 'Qual o ticket médio por compra?' }
        ]
      },
      response: {
        200: {
          type: 'object',
          properties: {
            question: { type: 'string' },
            selected_tables: { type: 'array', items: { type: 'string' } },
            sql: { type: 'string' },
            params: { type: 'array', items: {} },
            warnings: { type: 'array', items: { type: 'string' } },
            llm_explanation: { type: 'string' },
            llm_ms: { type: 'number' },
            db_ms: { type: 'number' },
            rows: { type: 'array', items: {} },
            schema_context: { type: 'string' },
            cache: {
              type: 'object',
              properties: {
                hit: { type: 'boolean' },
                age_ms: { type: 'number' }
              }
            }
          },
          examples: [
            {
              question: 'Quais são os produtos mais caros?',
              selected_tables: ['products'],
              sql: 'SELECT p.product_name, p.list_price FROM products p ORDER BY p.list_price DESC LIMIT 10',
              params: [],
              warnings: [],
              llm_explanation: 'Retorna os 10 produtos mais caros',
              llm_ms: 312,
              db_ms: 280,
              rows: [
                { product_name: 'Northwind Traders Marmalade', list_price: '81.0000' }
              ]
            },
            {
              question: 'Qual o ticket médio por compra?',
              selected_tables: ['orders', 'order_details'],
              sql: 'SELECT AVG(t.order_total) AS avg_ticket FROM ( SELECT od.order_id, SUM(od.quantity * od.unit_price * (1 - od.discount)) AS order_total FROM order_details od GROUP BY od.order_id ) t LIMIT 1',
              params: [],
              warnings: [],
              llm_explanation: 'Calcula o ticket médio por pedido',
              llm_ms: 280,
              db_ms: 240,
              rows: [
                { avg_ticket: 1703.425 }
              ]
            }
          ]
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            reason: { type: 'string' },
            message: { type: 'string' },
            validation: { type: 'object' }
          },
          examples: [
            {
              error: 'SQL_GENERATED_BUT_REJECTED',
              validation: {
                ok: false,
                errors: ['Apenas SELECT é permitido.'],
                warnings: []
              }
            },
            {
              error: 'SQL_EXECUTION_FAILED',
              reason: 'INVALID_COLUMN',
              message: 'Unknown column ...',
              validation: { ok: true, errors: [], warnings: [] }
            }
          ]
        },
        502: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' }
          },
          examples: [
            {
              error: 'LLM_FAILED',
              message: 'Falha ao gerar SQL.'
            },
            {
              error: 'LLM_FAILED',
              message: 'LLM request failed: 429 rate limited'
            }
          ]
        }
      }
    }
  }, askController)
}
