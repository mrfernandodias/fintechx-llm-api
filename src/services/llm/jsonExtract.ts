export function extractJsonObject(text: string) {
  // tenta parse direto
  try {
    return JSON.parse(text)
  } catch {
    // fallback para extração por substring
  }

  // fallback: pegar o primeiro bloco {...} no texto
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Não encontrei JSON no retorno do LLM.')
  }

  const slice = text.slice(start, end + 1)
  return JSON.parse(slice)
}
