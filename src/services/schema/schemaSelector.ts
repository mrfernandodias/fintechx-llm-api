type CompactSchemaTable = {
  table: string
  columns: { name: string; type: string; nullable: boolean }[]
}

const KEYWORDS: Array<{ table: string; words: string[] }> = [
  { table: 'products', words: ['produto', 'produtos', 'product', 'preço', 'caro', 'categoria', 'category'] },
  { table: 'orders', words: ['pedido', 'pedidos', 'order', 'venda', 'vendas', 'ano', 'data', 'ship', 'frete'] },
  { table: 'order_details', words: ['itens', 'item', 'detalhe', 'details', 'quantidade', 'quantity', 'unit_price', 'desconto'] },
  { table: 'customers', words: ['cliente', 'clientes', 'customer', 'empresa', 'company', 'cidade', 'city', 'país', 'country'] },
  { table: 'employees', words: ['vendedor', 'vendedores', 'employee', 'funcionário', 'melhores vendedores'] },
  { table: 'shippers', words: ['transportadora', 'shipper', 'envio', 'shipping'] },
  { table: 'suppliers', words: ['fornecedor', 'fornecedores', 'supplier'] },
  { table: 'invoices', words: ['fatura', 'invoice'] },
]

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
}

export function selectTablesForQuestion(
  question: string,
  schemaTables: CompactSchemaTable[]
) {
  const q = normalize(question)

  const hits = new Set<string>()
  for (const rule of KEYWORDS) {
    if (rule.words.some(w => q.includes(normalize(w)))) hits.add(rule.table)
  }

  // regras de “combo” que ajudam muito
  if (hits.has('orders')) hits.add('order_details')
  if (hits.has('order_details')) hits.add('orders')
  if (hits.has('order_details')) hits.add('products')
  if (hits.has('orders')) hits.add('customers')

  // fallback: se nada casou, mandar o core do desafio
  if (hits.size === 0) {
    ;['customers', 'orders', 'order_details', 'products'].forEach(t => hits.add(t))
  }

  const selected = schemaTables.filter(t => hits.has(t.table))

  // ordena com prioridade “core”
  const priority = ['customers', 'orders', 'order_details', 'products', 'employees', 'shippers', 'suppliers', 'invoices']
  selected.sort((a, b) => priority.indexOf(a.table) - priority.indexOf(b.table))

  return selected
}
