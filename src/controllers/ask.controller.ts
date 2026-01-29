import type { FastifyReply, FastifyRequest } from 'fastify'

import { pool } from '../db/mysql.js'
import { getCachedResponse, setCachedResponse } from '../services/cache/semanticCache.js'
import { generateSqlFromQuestion } from '../services/llm/sqlGenerator.js'
import { getSchemaCached } from '../services/schema/schemaCache.js'
import { formatSchemaForPrompt } from '../services/schema/schemaFormatter.js'
import { selectTablesForQuestion } from '../services/schema/schemaSelector.js'
import { validateSql } from '../services/sql/sqlValidator.js'

type AskBody = {
  question: string
  execute?: boolean
  debug?: boolean
}

function normalizeParams(value: unknown) {
  return Array.isArray(value) ? value : []
}

export async function askController(
  req: FastifyRequest<{ Body: AskBody }>,
  reply: FastifyReply
) {
  const { question, execute = true, debug = false } = req.body
  const requestId = req.id

  const cached = getCachedResponse(question, { execute, debug })
  if (cached.hit) {
    req.log.info({ request_id: requestId, cache_hit: true, cache_age_ms: cached.ageMs }, 'cache.hit')
    const base = { ...(cached.value as Record<string, unknown>) }
    if (typeof base.llm_ms === 'number') base.llm_ms = 0
    if (typeof base.db_ms === 'number') base.db_ms = 0
    return { ...base, cache: { hit: true, age_ms: cached.ageMs } }
  }

  const schemaMap = await getSchemaCached()
  const schemaTables = Object.entries(schemaMap).map(([table, cols]) => ({
    table,
    columns: cols.map(c => ({
      name: c.column,
      type: c.type,
      nullable: c.nullable === 'YES',
    })),
  }))

  const selected = selectTablesForQuestion(question, schemaTables)
  const selectedTables = selected.map(t => t.table)
  const schemaContext = formatSchemaForPrompt(selected, { maxColumnsPerTable: 25 })

  const llmStart = Date.now()
  let generated: { sql: string; params: unknown[]; explanation?: string; usage?: unknown }
  try {
    generated = await generateSqlFromQuestion(question, schemaContext)
  } catch (error: unknown) {
    const llmMs = Date.now() - llmStart
    const err = error as { message?: string }
    req.log.error({ request_id: requestId, llm_ms: llmMs, err }, 'llm.error')
    return reply.code(502).send({
      error: 'LLM_FAILED',
      message: err?.message ?? 'Falha ao gerar SQL.',
      question,
      selected_tables: selectedTables,
      llm_ms: llmMs,
      ...(debug ? { schema_context: schemaContext } : {}),
    })
  }
  const llmMs = Date.now() - llmStart
  req.log.info({ request_id: requestId, llm_ms: llmMs, tokens: generated.usage }, 'llm.ok')

  const validation = await validateSql(generated.sql)
  if (!validation.ok || !validation.safeSql) {
    req.log.info({ request_id: requestId, validation_errors: validation.errors }, 'sql.validation_failed')
    return reply.code(400).send({
      error: 'SQL_GENERATED_BUT_REJECTED',
      question,
      selected_tables: selectedTables,
      ...(debug ? { schema_context: schemaContext } : {}),
      llm: {
        sql: generated.sql,
        params: normalizeParams(generated.params),
        explanation: generated.explanation,
      },
      validation,
      llm_ms: llmMs,
    })
  }

  if (!execute) {
    const response = {
      question,
      selected_tables: selectedTables,
      schema_context: schemaContext,
      sql: validation.safeSql,
      params: normalizeParams(generated.params),
      warnings: validation.warnings,
      llm_explanation: generated.explanation,
      llm_ms: llmMs,
    }
    setCachedResponse(question, { execute, debug }, response)
    req.log.info({ request_id: requestId, cache_store: true }, 'cache.store')
    return response
  }

  const dbStart = Date.now()

  try {
    const [rows] = await pool.execute(
      validation.safeSql,
      normalizeParams(generated.params)
    )
    const dbMs = Date.now() - dbStart
    const response = {
      question,
      selected_tables: selectedTables,
      sql: validation.safeSql,
      params: normalizeParams(generated.params),
      warnings: validation.warnings,
      llm_explanation: generated.explanation,
      llm_ms: llmMs,
      db_ms: dbMs,
      rows,
      ...(debug ? { schema_context: schemaContext } : {}),
    }
    const rowCount = Array.isArray(rows) ? rows.length : 0
    req.log.info({ request_id: requestId, db_ms: dbMs, rows: rowCount }, 'db.ok')
    setCachedResponse(question, { execute, debug }, response)
    req.log.info({ request_id: requestId, cache_store: true }, 'cache.store')
    return response
  } catch (error: unknown) {
    const dbMs = Date.now() - dbStart
    const err = error as { code?: string; message?: string }

    if (err?.code === 'ER_BAD_FIELD_ERROR') {
      req.log.info({ request_id: requestId, db_ms: dbMs, err }, 'db.invalid_column')
      return reply.code(400).send({
        error: 'SQL_EXECUTION_FAILED',
        reason: 'INVALID_COLUMN',
        message: err.message,
        question,
        selected_tables: selectedTables,
        sql: validation.safeSql,
        params: normalizeParams(generated.params),
        llm_explanation: generated.explanation,
        llm_ms: llmMs,
        db_ms: dbMs,
        hint: 'O SQL referenciou uma coluna inexistente. Use apenas colunas do schema retornado por /v1/meta/schema.',
        ...(debug ? { schema_context: schemaContext } : {}),
      })
    }

    req.log.error({ request_id: requestId, db_ms: dbMs, err }, 'db.error')
    return reply.code(500).send({
      error: 'SQL_EXECUTION_FAILED',
      message: err?.message ?? 'Erro ao executar SQL.',
      question,
      selected_tables: selectedTables,
      sql: validation.safeSql,
      params: normalizeParams(generated.params),
      llm_explanation: generated.explanation,
      llm_ms: llmMs,
      db_ms: dbMs,
      ...(debug ? { schema_context: schemaContext } : {}),
    })
  }
}
