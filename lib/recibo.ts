// Recibo de pagamento em dinheiro (sem banco, para poder ser testado).

const UNIDADES = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove']
const DEZENAS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa']
const CENTENAS = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos']

function ate999(n: number): string {
  if (n === 0) return ''
  if (n === 100) return 'cem'
  const c = Math.floor(n / 100)
  const r = n % 100
  const partes: string[] = []
  if (c) partes.push(CENTENAS[c])
  if (r) partes.push(r < 20 ? UNIDADES[r] : DEZENAS[Math.floor(r / 10)] + (r % 10 ? ' e ' + UNIDADES[r % 10] : ''))
  return partes.join(' e ')
}

function inteiroPorExtenso(n: number): string {
  if (n === 0) return 'zero'
  const milhoes = Math.floor(n / 1_000_000)
  const milhares = Math.floor((n % 1_000_000) / 1000)
  const resto = n % 1000
  const grupos: { texto: string; valor: number }[] = []
  if (milhoes) grupos.push({ texto: milhoes === 1 ? 'um milhão' : `${ate999(milhoes)} milhões`, valor: milhoes })
  if (milhares) grupos.push({ texto: milhares === 1 ? 'mil' : `${ate999(milhares)} mil`, valor: milhares })
  if (resto) grupos.push({ texto: ate999(resto), valor: resto })
  // "e" antes de um grupo só quando ele é uma dezena ou centena redonda (mil e cem, mil e vinte; mas mil duzentos e trinta)
  return grupos.reduce((acc, g, i) => (i === 0 ? g.texto : `${acc}${g.valor < 100 || g.valor % 100 === 0 ? ' e ' : ' '}${g.texto}`), '')
}

/** 130 -> "cento e trinta reais"; 1250,5 -> "mil duzentos e cinquenta reais e cinquenta centavos". */
export function valorPorExtenso(valor: number): string {
  const centavosTotal = Math.round(Math.abs(valor) * 100)
  const reais = Math.floor(centavosTotal / 100)
  const cent = centavosTotal % 100
  const partes: string[] = []
  if (reais > 0) {
    const redondoEmMilhoes = reais % 1_000_000 === 0
    partes.push(`${inteiroPorExtenso(reais)}${redondoEmMilhoes ? ' de' : ''} ${reais === 1 ? 'real' : 'reais'}`)
  }
  if (cent > 0) partes.push(`${inteiroPorExtenso(cent)} ${cent === 1 ? 'centavo' : 'centavos'}`)
  return partes.length ? partes.join(' e ') : 'zero reais'
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const dataBr = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/')
const dataPorExtenso = (iso: string) => { const [a, m, d] = iso.slice(0, 10).split('-').map(Number); return `${d} de ${MESES[m - 1]} de ${a}` }
const brl = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export type DadosRecibo = {
  id: string
  quem: string
  valor: number
  /** Categoria do lançamento (ex.: "Aula Tênis", "Clubinho", "Venda Produto Loja") */
  categoria: string | null
  produto: boolean
  descricao: string | null
  /** AAAA-MM-DD do mês a que a mensalidade se refere */
  competencia: string | null
  dataPagamento: string
  unidade: string
  forma?: string
  emitidoEm?: Date
}

export type Recibo = {
  numero: string
  texto: string
  referente: string
  linhas: [string, string][]
  geradoEm: string
}

export function montarRecibo(d: DadosRecibo): Recibo {
  const forma = (d.forma ?? 'Dinheiro').toLowerCase()
  const referente = d.produto
    ? `compra de produto${d.descricao ? ` (${d.descricao.replace(/^Venda:\s*/i, '')})` : ''}`
    : `mensalidade${d.categoria ? ` de ${d.categoria}` : ''}${d.competencia ? `, competência ${d.competencia.slice(5, 7)}/${d.competencia.slice(2, 4)}` : ''}`
  const texto = `Recebemos de ${d.quem} a quantia de ${brl(d.valor)} (${valorPorExtenso(d.valor)}), referente a ${referente}, paga em ${forma} no dia ${dataPorExtenso(d.dataPagamento)}.`
  const emitido = d.emitidoEm ?? new Date()
  return {
    numero: d.id.replace(/-/g, '').slice(0, 8).toUpperCase(),
    texto,
    referente,
    linhas: [
      ['Pagador', d.quem],
      ['Valor', `${brl(d.valor)} (${valorPorExtenso(d.valor)})`],
      ['Referente a', referente],
      ['Forma de pagamento', d.forma ?? 'Dinheiro'],
      ['Data do pagamento', dataBr(d.dataPagamento)],
      ['Unidade', d.unidade],
    ],
    geradoEm: emitido.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }),
  }
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Página HTML completa do recibo, pronta para imprimir ou salvar em PDF. */
export function htmlDoRecibo(r: Recibo, unidade: string, logoUrl: string): string {
  const linhas = r.linhas.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>Recibo ${esc(r.numero)}</title>
<style>
  @page { size: A5 landscape; margin: 12mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111827; margin: 0; padding: 16px; }
  .topo { display: flex; align-items: center; justify-content: space-between; gap: 16px; border-bottom: 3px solid #7DC421; padding-bottom: 10px; }
  .marca { display: flex; align-items: center; gap: 12px; }
  .marca img { height: 64px; width: auto; }
  .marca b { font-size: 20px; display: block; }
  .marca span { font-size: 13px; color: #4b5563; }
  .titulo { text-align: right; }
  .titulo h1 { margin: 0; font-size: 22px; letter-spacing: .04em; text-transform: uppercase; }
  .titulo p { margin: 2px 0 0; font-size: 13px; color: #4b5563; }
  .texto { margin: 18px 0 14px; font-size: 15px; line-height: 1.55; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; width: 34%; color: #4b5563; font-weight: 600; padding: 6px 8px; border-bottom: 1px solid #e5e7eb; }
  td { padding: 6px 8px; border-bottom: 1px solid #e5e7eb; }
  .rodape { margin-top: 22px; font-size: 11px; color: #6b7280; text-align: center; }
</style></head>
<body>
  <div class="topo">
    <div class="marca"><img src="${esc(logoUrl)}" alt="Boa Bola Beach"><div><b>Boa Bola Beach</b><span>${esc(unidade)}</span></div></div>
    <div class="titulo"><h1>Recibo de pagamento</h1><p>Nº ${esc(r.numero)}</p></div>
  </div>
  <p class="texto">${esc(r.texto)}</p>
  <table>${linhas}</table>
  <p class="rodape">Recibo emitido em ${esc(r.geradoEm)}. Este documento comprova o pagamento descrito acima.</p>
  <script>window.onload = function () { setTimeout(function () { window.print() }, 150) }</script>
</body></html>`
}
