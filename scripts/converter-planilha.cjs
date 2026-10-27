// Precisa do pacote xlsx so para esta conversao:  npm install xlsx --no-save   (nao entra no package.json)
// Converte a planilha BB 1.0 (xlsx) em JSON simples, sem perder precisão:
//  - datas viram dd/mm/aaaa [hh:mm:ss] (pelo número da data, não pelo texto formatado);
//  - números de valor viram o número puro (ex.: 5000.5), sem depender do formato da célula;
//  - percentuais viram "35%"; o resto usa o texto que aparece na planilha.
// Uso: node converter.cjs <caminho.xlsx> <saida.json>
const XLSX = require('xlsx')
const fs = require('fs')
const [, , entrada, saida] = process.argv
const wb = XLSX.readFile(entrada, { cellDates: false })
const dois = n => String(n).padStart(2, '0')

function texto(c) {
  if (!c) return ''
  if (c.t === 's' || c.t === 'b' || c.t === 'e') return String(c.w ?? c.v ?? '').trim()
  if (c.t === 'n') {
    const w = String(c.w ?? '')
    if (/^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(w)) {
      const d = XLSX.SSF.parse_date_code(c.v)
      const data = `${dois(d.d)}/${dois(d.m)}/${d.y}`
      return d.H || d.M || d.S ? `${data} ${dois(d.H)}:${dois(d.M)}:${dois(Math.floor(d.S))}` : data
    }
    if (w.includes('%')) return `${Math.round(c.v * 10000) / 100}%`
    if (/^-?\s*R\$/.test(w)) return String(c.v)
    return (w || String(c.v)).trim()
  }
  return String(c.w ?? c.v ?? '').trim()
}

const out = {}
for (const nome of wb.SheetNames) {
  const ws = wb.Sheets[nome]
  if (!ws['!ref']) { out[nome] = { cab: [], linhas: [] }; continue }
  const r = XLSX.utils.decode_range(ws['!ref'])
  const cab = []
  for (let C = r.s.c; C <= r.e.c; C++) cab.push(texto(ws[XLSX.utils.encode_cell({ r: r.s.r, c: C })]))
  const linhas = []
  for (let R = r.s.r + 1; R <= r.e.r; R++) {
    const obj = {}; let vazia = true
    for (let C = r.s.c; C <= r.e.c; C++) {
      const t = texto(ws[XLSX.utils.encode_cell({ r: R, c: C })])
      obj[cab[C - r.s.c]] = t
      if (t) vazia = false
    }
    if (!vazia) linhas.push(obj)
  }
  out[nome] = { cab, linhas }
}
fs.writeFileSync(saida, JSON.stringify(out))
console.log(Object.entries(out).map(([n, s]) => `${n}: ${s.linhas.length}`).join(' | '))
