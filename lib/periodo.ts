// Consultas rápidas do Financeiro: últimos N dias, contando hoje (1 dia = só hoje).

const dois = (n: number) => String(n).padStart(2, '0')

/** Intervalo (aaaa-mm-dd) dos últimos `dias` dias terminando em `hoje`. */
export function ultimosDias(hoje: string, dias: number): { de: string; ate: string } {
  const [a, m, d] = hoje.split('-').map(Number)
  const ini = new Date(a, m - 1, d - (dias - 1))
  return { de: `${ini.getFullYear()}-${dois(ini.getMonth() + 1)}-${dois(ini.getDate())}`, ate: hoje }
}

/** Data (aaaa-mm-dd) `meses` meses antes de `hoje`; em mês mais curto vale o último dia (31/05 - 3 meses = 28/02). */
export function mesesAtras(hoje: string, meses: number): string {
  const [a, m, d] = hoje.split('-').map(Number)
  const total = a * 12 + (m - 1) - meses
  const ano = Math.floor(total / 12)
  const mes = (total % 12) + 1
  const dia = Math.min(d, new Date(ano, mes, 0).getDate())
  return `${ano}-${dois(mes)}-${dois(dia)}`
}
