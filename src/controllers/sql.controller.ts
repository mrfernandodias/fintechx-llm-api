import type { FastifyReply, FastifyRequest } from 'fastify'

import { pool } from '../db/mysql.js'
import { validateSql } from '../services/sql/sqlValidator.js'

type ValidateBody = { sql: string }
type QueryBody = { sql: string; params?: unknown[] }

function normalizeParams(value: unknown) {
  return Array.isArray(value) ? value : []
}

export async function validateSqlController(
  req: FastifyRequest<{ Body: ValidateBody }>
) {
  const { sql } = req.body
  const requestId = req.id
  const result = await validateSql(sql)
  req.log.info({ request_id: requestId, ok: result.ok }, 'sql.validate')
  return result
}

export async function querySqlController(
  req: FastifyRequest<{ Body: QueryBody }>,
  reply: FastifyReply
) {
  const { sql, params = [] } = req.body
  const requestId = req.id

  const validation = await validateSql(sql)
  if (!validation.ok || !validation.safeSql) {
    req.log.info({ request_id: requestId, validation_errors: validation.errors }, 'sql.validation_failed')
    return reply.code(400).send({ error: 'SQL_VALIDATION_FAILED', ...validation })
  }

  const started = Date.now()
  try {
    const [rows] = await pool.execute(
      validation.safeSql,
      normalizeParams(params)
    )
    const latencyMs = Date.now() - started
    const rowCount = Array.isArray(rows) ? rows.length : 0
    req.log.info({ request_id: requestId, latency_ms: latencyMs, rows: rowCount }, 'db.ok')
    return { sql: validation.safeSql, warnings: validation.warnings, latency_ms: latencyMs, rows }
  } catch (error: unknown) {
    const latencyMs = Date.now() - started
    const err = error as { code?: string; message?: string }
    if (err?.code === 'ER_BAD_FIELD_ERROR') {
      req.log.info({ request_id: requestId, latency_ms: latencyMs, err }, 'db.invalid_column')
      return reply.code(400).send({
        error: 'SQL_EXECUTION_FAILED',
        reason: 'INVALID_COLUMN',
        message: err.message,
        sql: validation.safeSql,
        params: normalizeParams(params),
        latency_ms: latencyMs,
      })
    }

    req.log.error({ request_id: requestId, latency_ms: latencyMs, err }, 'db.error')
    return reply.code(500).send({
      error: 'SQL_EXECUTION_FAILED',
      message: err?.message ?? 'Erro ao executar SQL.',
      sql: validation.safeSql,
      params: normalizeParams(params),
      latency_ms: latencyMs,
    })
  }
}
