import { env } from '../../config/env.js'

type ChatMessage = { role: 'system' | 'user'; content: string }

export type ChatCompletionUsage = {
  prompt_tokens?: number
  completion_tokens?: number
  total_tokens?: number
}

export type ChatCompletionResult = {
  content?: string
  toolArgs?: unknown
  usage?: ChatCompletionUsage
}

type ChatCompletionOptions = {
  tools?: unknown[]
  toolChoice?: unknown
  temperature?: number
}

export async function chatCompletion(
  messages: ChatMessage[],
  opts?: ChatCompletionOptions
): Promise<ChatCompletionResult> {
  const url = `${env.LLM_BASE_URL}/chat/completions`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${env.LLM_API_KEY}`,
    },
    body: JSON.stringify({
      model: env.LLM_MODEL,
      messages,
      temperature: opts?.temperature ?? 0,
      ...(opts?.tools ? { tools: opts.tools } : {}),
      ...(opts?.toolChoice ? { tool_choice: opts.toolChoice } : {}),
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`LLM request failed: ${res.status} ${text}`)
  }

  const data = (await res.json()) as {
    choices?: Array<{
      message?: {
        content?: string
        tool_calls?: Array<{ function?: { arguments?: unknown } }>
      }
    }>
    usage?: ChatCompletionUsage
  }
  const msg = data?.choices?.[0]?.message
  const usage = data?.usage

  if (msg?.tool_calls?.length) {
    const args = msg.tool_calls[0]?.function?.arguments
    if (typeof args === 'string') {
      try {
        const result: ChatCompletionResult = { toolArgs: JSON.parse(args) }
        if (usage) result.usage = usage
        return result
      } catch {
        const result: ChatCompletionResult = { toolArgs: args }
        if (usage) result.usage = usage
        return result
      }
    }
    const result: ChatCompletionResult = { toolArgs: args }
    if (usage) result.usage = usage
    return result
  }

  const content = msg?.content
  if (!content) throw new Error('LLM retornou vazio.')
  const result: ChatCompletionResult = { content: String(content) }
  if (usage) result.usage = usage
  return result
}
