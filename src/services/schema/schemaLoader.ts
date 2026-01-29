import { pool } from '../../db/mysql.js'

export type ColumnInfo = {
  table: string
  column: string
  type: string
  nullable: 'YES' | 'NO'
}

export async function loadSchema(): Promise<Record<string, ColumnInfo[]>> {
  const sql = `
    SELECT
      table_name AS \`table\`,
      column_name AS \`column\`,
      data_type AS \`type\`,
      is_nullable AS \`nullable\`
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
    ORDER BY table_name, ordinal_position
  `.trim()

  const [rows] = await pool.query(sql)
  const columns = rows as ColumnInfo[]

  return columns.reduce<Record<string, ColumnInfo[]>>((acc, c) => {
    const list = acc[c.table] ?? (acc[c.table] = [])
    list.push(c)
    return acc
  }, {})
}
