import { extractJsonObject } from './jsonExtract.js'
import { chatCompletion } from './openaiCompatClient.js'
import { buildSqlSystemPrompt, buildSqlUserPrompt } from './prompt.js'

export type GeneratedSql = {
  sql: string
  params: unknown[]
  explanation?: string
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
  }
}

export async function generateSqlFromQuestion(question: string, schemaContext: string): Promise<GeneratedSql> {
  const system = buildSqlSystemPrompt()
  const user = buildSqlUserPrompt(question, schemaContext)

  const toolDef = {
    type: 'function',
    function: {
      name: 'generate_sql',
      description: 'Gera uma única query SQL (SELECT-only) e parâmetros.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          sql: { type: 'string' },
          params: { type: 'array', items: {} },
          explanation: { type: 'string' },
        },
        required: ['sql'],
      },
    },
  }

  let result: Awaited<ReturnType<typeof chatCompletion>>
  try {
    result = await chatCompletion(
      [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      {
        tools: [toolDef],
        toolChoice: { type: 'function', function: { name: 'generate_sql' } },
        temperature: 0,
      }
    )
  } catch (error: unknown) {
    const err = error as { message?: string }
    const msg = String(err?.message ?? '')
    if (/tool_use_failed|Failed to call a function/i.test(msg)) {
      result = await chatCompletion([
        { role: 'system', content: system },
        { role: 'user', content: user },
      ])
    } else {
      throw err
    }
  }

  const obj = (result.toolArgs
    ? (typeof result.toolArgs === 'object'
        ? result.toolArgs
        : extractJsonObject(String(result.toolArgs)))
    : extractJsonObject(result.content ?? '')) as {
    sql?: unknown
    params?: unknown
    explanation?: unknown
  }

  if (!obj?.sql || typeof obj.sql !== 'string') {
    throw new Error('LLM não retornou campo "sql" válido.')
  }

  const out: GeneratedSql = {
    sql: obj.sql,
    params: Array.isArray(obj.params) ? obj.params : [],
  }
  if (typeof obj.explanation === 'string') out.explanation = obj.explanation
  if (result.usage) out.usage = result.usage
  return out
}
