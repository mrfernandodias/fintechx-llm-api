type CompactSchemaTable = {
  table: string
  columns: { name: string; type: string; nullable: boolean }[]
}

export function formatSchemaForPrompt(
  tables: CompactSchemaTable[],
  opts?: { maxColumnsPerTable?: number }
) {
  const max = opts?.maxColumnsPerTable ?? 20

  // formato tipo: products(id, product_name, list_price, category, ...)
  return tables
    .map(t => {
      const cols = t.columns
        .slice(0, max)
        .map(c => c.name)
        .join(', ')
      return `${t.table}(${cols})`
    })
    .join('\n')
}
