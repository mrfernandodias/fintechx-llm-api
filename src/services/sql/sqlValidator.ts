import { getSchemaCached } from '../schema/schemaCache.js'

export type SqlValidationResult = {
  ok: boolean
  errors: string[]
  warnings: string[]
  safeSql?: string
}

const BLOCKLIST = [
  /\b(insert|update|delete|drop|alter|truncate|create|grant|revoke|call)\b/i,
  /\b(information_schema|mysql|sys)\b/i,
  /;/,           // multi-statement
  /--|\/\*/,     // comentários
  /\b(sleep|benchmark|load_file|into\s+outfile)\b/i,
]

const DEFAULT_LIMIT = 200
const LIMIT_CAP = 500

function stripExtraSpaces(sql: string) {
  return sql.replace(/\s+/g, ' ').trim()
}

function startsWithSelect(sql: string) {
  return /^\s*select\b/i.test(sql)
}

function hasLimit(sql: string) {
  return /\blimit\b/i.test(sql)
}

function applyDefaultLimit(sql: string, limit = 200) {
  // não tenta ser esperto: só aplica se não tiver LIMIT
  if (hasLimit(sql)) return { sql, applied: false }
  return { sql: `${sql} LIMIT ${limit}`, applied: true }
}

function stripTrailingSemicolon(sql: string) {
  return sql.replace(/;\s*$/, '')
}

function enforceLimitCap(sql: string, cap = LIMIT_CAP) {
  const re = /\blimit\s+(\d+)\s*(?:,\s*(\d+))?(?:\s+offset\s+(\d+))?/i
  const match = sql.match(re)
  if (!match) return { sql, applied: false }

  const [, first, second, offset] = match
  const count = second ? Number(second) : Number(first)
  if (!Number.isFinite(count) || count <= cap) return { sql, applied: false }

  let replacement: string
  if (second) {
    replacement = `LIMIT ${first}, ${cap}`
  } else if (offset) {
    replacement = `LIMIT ${cap} OFFSET ${offset}`
  } else {
    replacement = `LIMIT ${cap}`
  }

  return { sql: sql.replace(re, replacement), applied: true }
}

function extractTableNames(sql: string) {
  // heurística simples: pega tokens após FROM e JOIN
  // cobre casos comuns do teste, sem parser pesado
  const cleaned = sql
    .replace(/`/g, '')
    .replace(/"([^"]+)"/g, '$1')
    .replace(/\s+/g, ' ')
  const names = new Set<string>()
  const re = /\b(from|join)\s+([a-zA-Z_][a-zA-Z0-9_]*)(?:\s*\.\s*([a-zA-Z_][a-zA-Z0-9_]*))?/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(cleaned))) {
    const name = m[3] ?? m[2]
    if (name) names.add(name)
  }
  return [...names]
}

export async function validateSql(sqlRaw: string): Promise<SqlValidationResult> {
  const errors: string[] = []
  const warnings: string[] = []

  if (!sqlRaw || !sqlRaw.trim()) return { ok: false, errors: ['SQL vazio'], warnings }

  for (const rule of BLOCKLIST) {
    if (rule.test(sqlRaw)) errors.push(`SQL contém padrão proibido: ${rule}`)
  }

  let sql = stripExtraSpaces(sqlRaw)
  sql = stripTrailingSemicolon(sql)

  if (!startsWithSelect(sql)) errors.push('Apenas SELECT é permitido.')

  // whitelist de tabelas existentes no schema
  const schema = await getSchemaCached()
  const existingTables = new Set(Object.keys(schema))
  const usedTables = extractTableNames(sql)

  for (const t of usedTables) {
    if (!existingTables.has(t)) errors.push(`Tabela não permitida ou inexistente: ${t}`)
  }

  // ✅ se já tem erros, NÃO mexe no SQL (nem adiciona warnings)
  if (errors.length > 0) {
    return { ok: false, errors, warnings }
  }

  // LIMIT padrão (só para SQL válido)
  const lim = applyDefaultLimit(sql, DEFAULT_LIMIT)
  sql = lim.sql
  if (lim.applied) warnings.push(`LIMIT ${DEFAULT_LIMIT} aplicado automaticamente.`)

  const capped = enforceLimitCap(sql, LIMIT_CAP)
  sql = capped.sql
  if (capped.applied) warnings.push(`LIMIT ajustado para ${LIMIT_CAP}.`)

  return {
    ok: true,
    errors,
    warnings,
    safeSql: sql,
  }
}
