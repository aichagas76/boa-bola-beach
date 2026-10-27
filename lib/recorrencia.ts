// Conta recorrente: um lançamento por mês, sempre no mesmo dia (nos meses curtos, o último dia).
// Regras sem banco, para poderem ser testadas.

export const MAX_MESES_RECORRENCIA = 60

/** Mensagem de erro, ou null se estiver tudo certo. */
export function validarRecorrencia(meses: number, dia: number): string | null {
  if (!Number.isInteger(meses) || meses < 2 || meses > MAX_MESES_RECORRENCIA) return `Meses de recorrência: de 2 a ${MAX_MESES_RECORRENCIA}.`
  if (!Number.isInteger(dia) || dia < 1 || dia > 31) return 'Informe o dia da cobrança (1 a 31).'
  return null
}

const dois = (n: number) => String(n).padStart(2, '0')

/** Datas (aaaa-mm-dd) de cada mês, a partir do mês de `inicio`, no dia pedido ou no último dia do mês curto. */
export function datasRecorrentes(inicio: string, dia: number, meses: number): string[] {
  const [a, m] = inicio.split('-').map(Number)
  return Array.from({ length: meses }, (_, i) => {
    const total = a * 12 + (m - 1) + i
    const ano = Math.floor(total / 12)
    const mes = (total % 12) + 1
    const ultimo = new Date(ano, mes, 0).getDate()
    return `${ano}-${dois(mes)}-${dois(Math.min(dia, ultimo))}`
  })
}

/** Sufixo da descrição de cada lançamento, ex.: " (3/12)". */
export const rotuloParcela = (n: number, total: number) => ` (${n}/${total})`
