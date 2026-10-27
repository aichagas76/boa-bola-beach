// Consultas rápidas do Financeiro: últimos N dias, contando hoje (1 dia = só hoje).

const dois = (n: number) => String(n).padStart(2, '0')

/** Intervalo (aaaa-mm-dd) dos últimos `dias` dias terminando em `hoje`. */
export function ultimosDias(hoje: string, dias: number): { de: string; ate: string } {
  const [a, m, d] = hoje.split('-').map(Number)
  const ini = new Date(a, m - 1, d - (dias - 1))
  return { de: `${ini.getFullYear()}-${dois(ini.getMonth() + 1)}-${dois(ini.getDate())}`, ate: hoje }
}
