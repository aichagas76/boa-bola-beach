// Importação da planilha BB 1.0 (AppSheet) para o sistema novo — Boa Bola 1.
//
//   node scripts/importar-bb1.mjs            -> SIMULAÇÃO: não grava nada; mostra os números e grava o relatório de revisão
//   node scripts/importar-bb1.mjs --gravar   -> grava no banco (só depois do OK; pode repetir sem duplicar)
//   node scripts/importar-bb1.mjs --desfazer -> apaga do banco tudo o que esta importação criou (pelos ids fixos)
//
// Entrada: dados-appsheet/bb.json (a planilha convertida; pasta fora do Git, tem dados pessoais).
// Saída:   dados-appsheet/relatorio-importacao.txt (nomes e motivos para revisar; também fora do Git).
// Decisões já combinadas: unidade Boa Bola 1; alunos inativos entram como Inativo (sem matrículas);
// financeiro só de 2026 (pelo vencimento); alunos sem CPF e nomes repetidos entram marcados "REVISAR";
// lançamentos incoerentes são corrigidos pela regra lógica e listados; retiradas e compras antigas NÃO viram lançamentos
// (o dinheiro delas já está no financeiro): o estoque nasce com o saldo calculado como uma compra "Saldo inicial".
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import {
  normaliza, parseDataBR, parseValorBR, parseComissao, formataCelular, formataCpf, soDigitos, esporteDe, formaDe,
  tipoMovDe, modalidadeDe, uuidV5, situacaoMov,
} from '../lib/importacao-bb.ts'

const GRAVAR = process.argv.includes('--gravar')
const DESFAZER = process.argv.includes('--desfazer')
const ANO = '2026'
const PASTA = new URL('../dados-appsheet/', import.meta.url)
process.loadEnvFile(new URL('../.env', import.meta.url))
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
const bb = JSON.parse(fs.readFileSync(new URL('bb.json', PASTA), 'utf8'))
const L = nome => bb[nome]?.linhas ?? []
const id = (tipo, chave) => uuidV5(`bb1:${tipo}:${chave}`)
const conta = (o, k) => { o[k] = (o[k] ?? 0) + 1 }

const rel = [] // linhas do relatório
const secao = t => rel.push('', `== ${t} ==`)
const out = {} // contagens para mostrar

// ---------- referências que já existem no banco ----------
const { data: unidades } = await db.from('unidades').select('id, codigo')
const UNIDADE = unidades.find(u => u.codigo === 'bb1')?.id
if (!UNIDADE) throw new Error('Unidade bb1 não encontrada')
const { data: esportesDb } = await db.from('esportes').select('id, nome')
const ESPORTE = Object.fromEntries(esportesDb.map(e => [e.nome, e.id]))
const { data: categoriasDb } = await db.from('categorias_financeiro').select('id, tipo, categoria, subcategoria')
const { data: contasDb } = await db.from('contas_bancarias').select('id, nome, unidade_id')

// ---------- professores ----------
const matriculasPorProfEsporte = {} // 'prof|Esporte' -> quantidade (para decidir a comissão de quem ensina em dois esportes)
const nomesProf = new Map() // normalizado -> nome de exibição
const comissoes = {} // normalizado -> [{ esporte, pct }]
for (const p of L('Professor')) {
  const nome = p.Professor.trim(); if (!nome) continue
  nomesProf.set(normaliza(nome), nomesProf.get(normaliza(nome)) ?? nome)
  ;(comissoes[normaliza(nome)] ??= []).push({ esporte: esporteDe(p.Modalidade), pct: parseComissao(p.Comissão ?? p['Comissão'] ?? '') })
}

// Professores que só aparecem nos lançamentos de ${ANO} (não estão na aba Professor) também precisam existir
for (const r of L('Movimentacao')) {
  const prof = r.Professor.trim(); const venc = parseDataBR(r.Vencimento) ?? parseDataBR(r.DataPagamento)
  if (prof && venc?.startsWith(ANO)) nomesProf.set(normaliza(prof), nomesProf.get(normaliza(prof)) ?? prof)
}

// ---------- alunos ----------
secao('ALUNOS (revisar)')
const alunos = []
const alunoPorRowId = new Map() // RowId -> { id, status, nome }
const vistos = {}
const descartados = {}
for (const r of L('Cadastro')) {
  const rid = r.RowId; const nomeOrig = r.Nome.replace(/\s+/g, ' ').trim()
  const st = r.Status.toUpperCase()
  if (!nomeOrig) { conta(descartados, 'cadastro sem nome'); continue }
  if (st === 'TESTE') { conta(descartados, 'cadastro de teste'); rel.push(`descartado (cadastro de teste): ${nomeOrig}`); continue }
  const revisar = []
  let nome = nomeOrig; const chave = normaliza(nomeOrig)
  vistos[chave] = (vistos[chave] ?? 0) + 1
  if (vistos[chave] > 1) { nome = `${nomeOrig} (${vistos[chave]})`; revisar.push('nome repetido na planilha') }
  const status = st === 'ATIVO' ? 'Ativo' : 'Inativo'
  if (st !== 'ATIVO' && st !== 'INATIVO') revisar.push('status em branco: importado como Inativo')
  const cpf = formataCpf(r.CPF)
  if (!r.CPF) revisar.push('sem CPF'); else if (!cpf) revisar.push(`CPF inválido (${r.CPF})`)
  const celular = formataCelular(r.Celular)
  if (!r.Celular) revisar.push('sem celular'); else if (!celular) revisar.push(`celular incompleto (${r.Celular})`)
  const venc = parseDataBR(r.DataVencimento)
  if (!venc) revisar.push('sem data de vencimento')
  const row = {
    id: id('cadastro', rid), unidade_id: UNIDADE, nome, celular, cpf, sexo: r.Sexo || null,
    data_nascimento: parseDataBR(r.DataNascimento), data_cadastro: parseDataBR(r.Datacadastro) ?? undefined,
    endereco: r.Endereco || null, status, data_vencimento: venc,
    asaas_customer_id: r.IdClienteAsaas || null, asaas_customer_doc: r.IdClienteAsaas && cpf ? soDigitos(cpf) : null,
    observacao: [revisar.length ? 'REVISAR: ' + revisar.join('; ') : '', `AppSheet:${rid}`].filter(Boolean).join(' | '),
  }
  alunos.push(row); alunoPorRowId.set(rid, { id: row.id, status, nome })
  if (revisar.length) rel.push(`${nome} [${st || 'sem status'}]: ${revisar.join('; ')}`)
}
out.alunos = { total: alunos.length, ativos: alunos.filter(a => a.status === 'Ativo').length, inativos: alunos.filter(a => a.status === 'Inativo').length, marcadosParaRevisar: alunos.filter(a => a.observacao.startsWith('REVISAR')).length, descartados }

// ---------- matrículas (só de alunos ativos) ----------
secao('MATRÍCULAS (descartadas)')
const matriculas = []
const mDescartadas = {}
for (const [folha, esporte] of [['BeachTennis', 'Beach Tênis'], ['Tenis', 'Tênis'], ['Pickleball', 'Pickleball'], ['Padel', 'Padel']]) {
  for (const m of L(folha)) {
    const aluno = alunoPorRowId.get(m[folha])
    const st = m.Status.toUpperCase()
    if (!aluno) { conta(mDescartadas, 'aluno não existe no cadastro'); rel.push(`matrícula ${folha}/${m.RowId}: aluno não existe no cadastro`); continue }
    if (aluno.status !== 'Ativo') { conta(mDescartadas, 'aluno inativo (não importada)'); continue }
    if (st && st !== 'ATIVO') { conta(mDescartadas, `status ${st}`); continue }
    const tipo = modalidadeDe(m.Tipo)
    if (!tipo) { conta(mDescartadas, `modalidade "${m.Tipo || 'em branco'}" não existe`); rel.push(`matrícula ${folha}/${m.RowId} (${aluno.nome}): modalidade "${m.Tipo || 'em branco'}" não existe no sistema`); continue }
    const valor = parseValorBR(m.Valor)
    if (valor === null) rel.push(`matrícula ${folha}/${m.RowId} (${aluno.nome}) ${tipo}: sem valor (importada com R$ 0,00)`)
    const prof = m.Professor.trim()
    if (prof) nomesProf.set(normaliza(prof), nomesProf.get(normaliza(prof)) ?? prof)
    if (prof) conta(matriculasPorProfEsporte, `${normaliza(prof)}|${esporte}`)
    const combo = esporte === 'Beach Tênis' && tipo === 'Clubinho' && m.Combo?.toUpperCase() === 'SIM'
    if (m.Combo?.toUpperCase() === 'SIM' && !combo) rel.push(`matrícula ${folha}/${m.RowId} (${aluno.nome}): combo ignorado (só vale para Clubinho de Beach Tênis)`)
    matriculas.push({ id: id('matricula', `${folha}:${m.RowId}`), aluno_id: aluno.id, tipo, valor: valor ?? 0, professor_nome: prof || null, _prof: prof, esporte_id: ESPORTE[esporte], unidade_id: UNIDADE, acesso_duas_unidades: combo, ativo: true })
  }
}
out.matriculas = { total: matriculas.length, combo: matriculas.filter(m => m.acesso_duas_unidades).length, descartadas: mDescartadas }

// ---------- professores (agora que se sabe quem ensina o quê) ----------
secao('PROFESSORES (conferir)')
const professores = []
const profId = new Map()
for (const [norm, nome] of [...nomesProf.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'))) {
  const lista = comissoes[norm] ?? []
  let pct = 0; let obs = ''
  if (lista.length === 0) obs = 'não está na aba Professor: comissão 0% (ajustar)'
  else if (new Set(lista.map(x => x.pct)).size === 1) pct = lista[0].pct
  else {
    // ensina em mais de um esporte com comissões diferentes: vale a do esporte em que tem mais matrículas
    const maior = lista.map(x => ({ ...x, n: matriculasPorProfEsporte[`${norm}|${x.esporte}`] ?? 0 })).sort((a, b) => b.n - a.n)[0]
    pct = maior.pct
    obs = `comissões diferentes por esporte (${lista.map(x => `${x.esporte}: ${x.pct}%`).join(', ')}); usada a de ${maior.esporte}: ${pct}% (o sistema guarda uma só por professor)`
  }
  const rowId = id('professor', norm)
  professores.push({ id: rowId, nome, comissao_percentual: pct, ativo: true })
  profId.set(norm, rowId)
  if (obs) rel.push(`${nome}: ${obs}`)
}
for (const m of matriculas) { m.professor_id = m._prof ? profId.get(normaliza(m._prof)) ?? null : null; delete m._prof }
out.professores = professores.length

// ---------- fornecedores / empresas ----------
const pessoas = new Map() // normalizado -> { id, nome, tipo }
const addPessoa = (nome, tipo) => {
  const n = nome.replace(/\s+/g, ' ').trim(); if (!n) return null
  const k = normaliza(n)
  if (!pessoas.has(k)) pessoas.set(k, { id: id('pessoa', k), nome: n, tipo: tipo || 'Fornecedor', ativo: true })
  return pessoas.get(k).id
}
for (const e of L('Empresa')) addPessoa(e.Nome, e.Tipo)
const fornecedorPorRowId = {}
for (const f of L('Fornecedor')) fornecedorPorRowId[f.RowId] = addPessoa(f.Nome, 'Fornecedor')

// ---------- categorias e contas (as do financeiro de 2026) ----------
const ALIAS_CAT = { 'mao de obra|comissao encordoamento': ['Mão de Obra', 'Comissão de encordoamento'], 'transporte|combustivel': ['Transporte', 'Combustível'] }
const catPorChave = new Map(categoriasDb.map(c => [`${normaliza(c.tipo)}|${normaliza(c.categoria)}|${normaliza(c.subcategoria ?? '')}`, c.id]))
const categoriasNovas = new Map()
function categoriaId(tipo, categoria, sub) {
  let cat = categoria.trim(); let sb = ['-', ''].includes(sub.trim()) ? '' : sub.trim()
  const al = ALIAS_CAT[`${normaliza(cat)}|${normaliza(sb)}`]; if (al) [cat, sb] = al
  const k = `${normaliza(tipo)}|${normaliza(cat)}|${normaliza(sb)}`
  if (catPorChave.has(k)) return catPorChave.get(k)
  // nome de exibição: se a planilha escreveu TUDO EM MAIÚSCULAS, usa a forma com inicial maiúscula
  const exib = s => (s === s.toUpperCase() && s.length > 3 ? s.toLowerCase().replace(/(^|\s)(\S)/g, (_, a, b) => a + b.toUpperCase()) : s)
  const novo = { id: id('categoria', k), tipo, categoria: exib(cat), subcategoria: sb ? exib(sb) : null, ativo: true }
  catPorChave.set(k, novo.id); categoriasNovas.set(k, novo)
  return novo.id
}
const contaPorNome = new Map(contasDb.map(c => [normaliza(c.nome), c.id]))
const contasNovas = new Map()
function contaId(nome) {
  const n = nome.trim(); if (!n) return null
  const k = normaliza(n)
  if (!contaPorNome.has(k)) { const nova = { id: id('conta', k), nome: n, ativo: true, unidade_id: UNIDADE }; contaPorNome.set(k, nova.id); contasNovas.set(k, nova) }
  return contaPorNome.get(k)
}

// ---------- financeiro (2026, pelo vencimento) ----------
secao('FINANCEIRO (corrigidos e descartados)')
const movs = []
const mvDescartados = {}; const mvCorrecoes = {}
const FORA_PERIODO = {}
for (const r of L('Movimentacao')) {
  const tipo = tipoMovDe(r.Tipo)
  const valor = parseValorBR(r.Valor)
  const dataPag = parseDataBR(r.DataPagamento)
  let venc = parseDataBR(r.Vencimento)
  const descTxt = `${r.RowId} ${r.Categoria || 'sem categoria'}${r.Observacao ? ' - ' + r.Observacao.slice(0, 40) : ''} R$ ${r.Valor || '?'}`
  if (!tipo) { conta(mvDescartados, 'sem tipo (entrada/saída)'); rel.push(`descartado (sem tipo): ${descTxt}`); continue }
  if (valor === null || valor <= 0) { conta(mvDescartados, 'valor vazio, zero ou negativo'); rel.push(`descartado (valor ${r.Valor || 'vazio'}): ${tipo} ${descTxt}`); continue }
  if (!venc) { venc = dataPag ?? parseDataBR(r['DataLançamento']); if (venc) conta(mvCorrecoes, 'sem vencimento: usada a data de pagamento/lançamento') }
  if (!venc) { conta(mvDescartados, 'sem nenhuma data'); rel.push(`descartado (sem data): ${tipo} ${descTxt}`); continue }
  if (!venc.startsWith(ANO)) { conta(FORA_PERIODO, venc.slice(0, 4)); continue }
  if (!r.Categoria.trim()) { conta(mvDescartados, 'sem categoria'); rel.push(`descartado (sem categoria): ${tipo} ${descTxt}`); continue }
  const sit = situacaoMov(tipo, r['Pago?'], dataPag, venc)
  if (sit.correcao) { conta(mvCorrecoes, sit.correcao); rel.push(`corrigido (${sit.correcao}): ${tipo} ${descTxt}`) }
  const aluno = r.IdAluno ? alunoPorRowId.get(r.IdAluno) : null
  const esp = esporteDe(r.Esporte)
  movs.push({
    id: id('mov', r.RowId), unidade_id: UNIDADE, tipo, categoria_id: categoriaId(tipo, r.Categoria, r.SubCategoria),
    descricao: r.Observacao || null, valor, forma_pagamento: formaDe(r.MeioDePagamento), status: sit.status,
    data: venc, data_vencimento: venc, data_pagamento: sit.dataPagamento, aluno_ref_id: aluno?.id ?? null,
    professor_id: r.Professor ? profId.get(normaliza(r.Professor)) ?? null : null, esporte_id: esp ? ESPORTE[esp] : null,
    pessoa_id: r.Empresa ? addPessoa(r.Empresa, 'Fornecedor') : null, conta_bancaria_id: contaId(r['DeQueConta?']), origem: 'AppSheet',
  })
  if (r.IdAluno && !aluno) conta(mvCorrecoes, 'aluno do lançamento não foi importado (lançamento entra sem aluno)')
  if (r.Professor && !profId.get(normaliza(r.Professor))) conta(mvCorrecoes, 'professor do lançamento não está nos professores (entra sem professor)')
}
const soma = (tipo, status) => Math.round(movs.filter(m => m.tipo === tipo && (!status || status.includes(m.status))).reduce((a, m) => a + m.valor, 0) * 100) / 100
out.financeiro = { importados: movs.length, entradas: movs.filter(m => m.tipo === 'Entrada').length, saidas: movs.filter(m => m.tipo === 'Saída').length,
  somaEntradasRecebidas: soma('Entrada', ['Recebido']), somaSaidasPagas: soma('Saída', ['Pago']), somaEntradasEmAberto: soma('Entrada', ['Não recebido']), somaSaidasEmAberto: soma('Saída', ['Pendente']),
  foraDoPeriodoPorAno: FORA_PERIODO, descartados: mvDescartados, correcoes: mvCorrecoes }

// ---------- estoque ----------
secao('ESTOQUE (conferir)')
const precos = Object.fromEntries(L('ProdutoValor').map(p => [p.NomeProduto, p]))
const qtd = s => { const n = parseValorBR(s); return n === null ? 0 : n }
const entrou = {}; const saiu = {}; const ultimoCusto = {}
for (const c of L('Compra')) { entrou[c.Produto] = (entrou[c.Produto] ?? 0) + qtd(c.Quantidade); const u = parseValorBR(c.ValorUnitario) ?? (parseValorBR(c.ValorTotal) && qtd(c.Quantidade) ? parseValorBR(c.ValorTotal) / qtd(c.Quantidade) : null); if (u) ultimoCusto[c.Produto] = u }
for (const r of L('Retirada')) saiu[r.Produto] = (saiu[r.Produto] ?? 0) + qtd(r.Quantidade)
const produtos = []; const saldosIniciais = []; const nomesProd = {}
for (const p of L('Estoque')) {
  const nomeOrig = p.Nome.replace(/\s+/g, ' ').trim(); if (!nomeOrig) continue
  const k = normaliza(nomeOrig); nomesProd[k] = (nomesProd[k] ?? 0) + 1
  const nome = nomesProd[k] > 1 ? `${nomeOrig} (${nomesProd[k]})` : nomeOrig
  if (nomesProd[k] > 1) rel.push(`produto com nome repetido: ${nomeOrig} -> ${nome}`)
  const pv = precos[p.RowId]; const prodId = id('produto', p.RowId)
  const enc = /encordoamento/i.test(nomeOrig)
  const custo = ultimoCusto[p.RowId] ?? 0
  if (!pv) rel.push(`produto sem preço de venda (aba ProdutoValor): ${nome}`)
  produtos.push({ id: prodId, unidade_id: UNIDADE, nome, categoria: pv?.Tipo || p.Subcategoria || null, fornecedor_id: fornecedorPorRowId[p.Fornecedor] ?? null,
    custo, preco_aluno: parseValorBR(pv?.ValorAluno ?? '') ?? 0, preco_professor: parseValorBR(pv?.ValorProfessor ?? ''), limite_compra: Math.round(qtd(p.LimiteparaCompra)), encordoamento: enc, ativo: true })
  const saldo = Math.round((entrou[p.RowId] ?? 0) - (saiu[p.RowId] ?? 0))
  if (saldo > 0) saldosIniciais.push({ id: id('saldo', p.RowId), unidade_id: UNIDADE, produto_id: prodId, data: new Date().toLocaleDateString('en-CA'), quantidade: saldo, custo_unitario: custo, fornecedor_id: null, movimentacao_id: null })
  else rel.push(`saldo ${saldo <= 0 ? 'zerado/negativo' : ''} (compras ${entrou[p.RowId] ?? 0} - retiradas ${saiu[p.RowId] ?? 0}): ${nome}`)
}
const retSemComprador = L('Retirada').filter(r => !r.Aluno && !r.Professor).length
out.estoque = { produtos: produtos.length, comSaldoInicial: saldosIniciais.length, semPreco: produtos.filter(p => !p.preco_aluno).length,
  retiradasAntigas: L('Retirada').length, retiradasSemAlunoNemProfessor: retSemComprador, retiradasNaoPagas: L('Retirada').filter(r => r['Pago?'].toUpperCase() === 'NÃO').length, comprasAntigas: L('Compra').length, nota: 'não importadas: o dinheiro delas já está no financeiro' }

// ---------- resumo ----------
out.novosCadastros = { pessoas: pessoas.size, categoriasNovas: [...categoriasNovas.values()].map(c => `${c.tipo}|${c.categoria}|${c.subcategoria ?? '-'}`), contasNovas: [...contasNovas.values()].map(c => c.nome) }
fs.writeFileSync(new URL('relatorio-importacao.txt', PASTA), rel.join('\n'))
console.log(JSON.stringify(out, null, 1))
console.log(`\nRelatório de revisão: dados-appsheet/relatorio-importacao.txt (${rel.length} linhas)`)

if (DESFAZER) {
  const apagar = async (tabela, ids) => {
    for (let i = 0; i < ids.length; i += 200) {
      const { error } = await db.from(tabela).delete().in('id', ids.slice(i, i + 200))
      if (error) throw new Error(`${tabela}: ${error.message}`)
    }
    console.log(`apagado ${tabela}: ${ids.length}`)
  }
  // ordem inversa da gravação (o que depende de outro sai primeiro)
  await apagar('estoque_compras', saldosIniciais.map(x => x.id))
  await apagar('estoque_produtos', produtos.map(x => x.id))
  await apagar('movimentacoes', movs.map(x => x.id))
  await apagar('matriculas', matriculas.map(x => x.id))
  await apagar('alunos', alunos.map(x => x.id))
  await apagar('categorias_financeiro', [...categoriasNovas.values()].map(x => x.id))
  await apagar('contas_bancarias', [...contasNovas.values()].map(x => x.id))
  await apagar('pessoas', [...pessoas.values()].map(x => x.id))
  await apagar('professores', professores.map(x => x.id))
  console.log('\nIMPORTAÇÃO DESFEITA.')
  process.exit(0)
}
if (!GRAVAR) { console.log('\nSIMULAÇÃO: nada foi gravado.'); process.exit(0) }

// ---------- gravação (repetível: usa ids fixos e atualiza o que já existe) ----------
async function gravar(tabela, linhas, lote = 300) {
  for (let i = 0; i < linhas.length; i += lote) {
    const { error } = await db.from(tabela).upsert(linhas.slice(i, i + lote), { onConflict: 'id' })
    if (error) throw new Error(`${tabela}: ${error.message}`)
  }
  console.log(`gravado ${tabela}: ${linhas.length}`)
}
await gravar('professores', professores)
await gravar('pessoas', [...pessoas.values()])
if (contasNovas.size) await gravar('contas_bancarias', [...contasNovas.values()])
if (categoriasNovas.size) await gravar('categorias_financeiro', [...categoriasNovas.values()])
await gravar('alunos', alunos)
// o banco grava "inativado hoje" ao inserir aluno Inativo; aqui a data real é desconhecida, então fica em branco (o painel avisa quantos são)
const inativos = alunos.filter(a => a.status === 'Inativo').map(a => a.id)
for (let i = 0; i < inativos.length; i += 200) {
  const { error } = await db.from('alunos').update({ data_inativacao: null }).in('id', inativos.slice(i, i + 200))
  if (error) throw new Error('data_inativacao: ' + error.message)
}
await gravar('matriculas', matriculas)
await gravar('movimentacoes', movs)
await gravar('estoque_produtos', produtos)
await gravar('estoque_compras', saldosIniciais)
console.log('\nIMPORTAÇÃO CONCLUÍDA.')
