'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useUnidade } from '@/components/layout/UnidadeProvider'
import { registrarLog } from '@/lib/log'
import { Plus, ShoppingCart, PackagePlus, Pencil, Undo2, Check } from 'lucide-react'
import {
  arredonda, lucroVenda, situacao, totalVenda, validarCompra,
} from '@/lib/estoque'
import {
  COR, FORMAS, FormVenda, Janela, Rotulo, campo, dataBr, hojeIso, moeda, numero,
  type AlunoOpcao, type Compra, type Opcao, type Produto, type Retirada,
} from '@/components/estoque/FormVenda'

export default function Estoque() {
  const { unidadeId } = useUnidade()
  const [aba, setAba] = useState<'produtos' | 'vendas' | 'compras'>('produtos')
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [saldos, setSaldos] = useState<Record<string, number>>({})
  const [retiradas, setRetiradas] = useState<Retirada[]>([])
  const [compras, setCompras] = useState<Compra[]>([])
  const [fornecedores, setFornecedores] = useState<Opcao[]>([])
  const [professores, setProfessores] = useState<Opcao[]>([])
  const [alunos, setAlunos] = useState<AlunoOpcao[]>([])
  const [bancos, setBancos] = useState<Opcao[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<null | { tipo: 'produto'; produto?: Produto } | { tipo: 'compra'; produto?: Produto } | { tipo: 'venda'; produto?: Produto }>(null)
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    if (!unidadeId) return
    setLoading(true)
    const [p, s, r, c, f, pr, a, b] = await Promise.all([
      supabase.from('estoque_produtos').select('*').eq('unidade_id', unidadeId).order('nome'),
      supabase.from('estoque_saldos').select('produto_id, saldo'),
      supabase.from('estoque_retiradas')
        .select('id, data, quantidade, comprador, preco_unitario, custo_unitario, produto_id, estoque_produtos(nome), alunos(nome), professores(nome), movimentacoes!movimentacao_id(status, data_vencimento)')
        .eq('unidade_id', unidadeId).order('data', { ascending: false }).order('created_at', { ascending: false }).limit(300),
      supabase.from('estoque_compras').select('id, data, quantidade, custo_unitario, estoque_produtos(nome), pessoas(nome)')
        .eq('unidade_id', unidadeId).order('data', { ascending: false }).order('created_at', { ascending: false }).limit(300),
      supabase.from('pessoas').select('id, nome').eq('ativo', true).order('nome'),
      supabase.from('professores').select('id, nome').eq('ativo', true).order('nome'),
      supabase.from('alunos').select('id, nome, data_vencimento').eq('unidade_id', unidadeId).neq('status', 'Inativo').order('nome'),
      supabase.from('bancos').select('id, nome').order('nome'),
    ])
    setProdutos((p.data ?? []) as Produto[])
    setSaldos(Object.fromEntries((s.data ?? []).map((x: { produto_id: string; saldo: number }) => [x.produto_id, Number(x.saldo)])))
    setRetiradas((r.data ?? []) as unknown as Retirada[])
    setCompras((c.data ?? []) as unknown as Compra[])
    setFornecedores(f.data ?? [])
    setProfessores(pr.data ?? [])
    setAlunos((a.data ?? []) as AlunoOpcao[])
    setBancos(b.data ?? [])
    if (p.error) setErro('O estoque ainda não está ativado no banco de dados.')
    else setErro('')
    setLoading(false)
  }, [unidadeId])

  useEffect(() => { carregar() }, [carregar])

  const ativos = useMemo(() => produtos.filter(p => p.ativo), [produtos])
  const aComprar = ativos.filter(p => situacao(saldos[p.id] ?? 0, p.limite_compra) === 'COMPRAR').length
  const pendentes = retiradas.filter(r => r.movimentacoes && r.movimentacoes.status !== 'Recebido')

  async function darBaixa(r: Retirada) {
    const { data: ret } = await supabase.from('estoque_retiradas').select('movimentacao_id').eq('id', r.id).single()
    if (!ret?.movimentacao_id) return
    const { error } = await supabase.from('movimentacoes').update({ status: 'Recebido', data_pagamento: hojeIso() }).eq('id', ret.movimentacao_id)
    if (error) return alert('Erro: ' + error.message)
    await registrarLog('Baixa de venda de estoque', 'estoque_retiradas', r.id)
    carregar()
  }

  async function desfazerVenda(r: Retirada) {
    if (!confirm('Desfazer esta venda? O produto volta ao estoque e o lançamento sai do financeiro.')) return
    const { error } = await supabase.rpc('estoque_desfazer_venda', { p_retirada: r.id })
    if (error) return alert('Erro: ' + error.message)
    await registrarLog('Venda de estoque desfeita', 'estoque_retiradas', r.id)
    carregar()
  }

  async function desfazerCompra(c: Compra) {
    if (!confirm('Desfazer esta compra? Ela sai do estoque e do financeiro.')) return
    const { error } = await supabase.rpc('estoque_desfazer_compra', { p_compra: c.id })
    if (error) return alert('Erro: ' + error.message)
    await registrarLog('Compra de estoque desfeita', 'estoque_compras', c.id)
    carregar()
  }

  const aba_ = (id: typeof aba, texto: string) => (
    <button onClick={() => setAba(id)}
      className={`px-4 h-10 text-sm font-medium border-b-2 ${aba === id ? 'border-[#7DC421] text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{texto}</button>
  )

  return (
    <div className="max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <h1 className="text-page-title text-gray-900">Estoque</h1>
        <div className="flex gap-2">
          <button onClick={() => setModal({ tipo: 'produto' })} className="h-10 px-4 text-sm border border-gray-200 rounded-lg bg-white hover:bg-gray-50 inline-flex items-center gap-2"><Plus size={16} />Produto</button>
          <button onClick={() => setModal({ tipo: 'compra' })} className="h-10 px-4 text-sm border border-gray-200 rounded-lg bg-white hover:bg-gray-50 inline-flex items-center gap-2"><PackagePlus size={16} />Comprar</button>
          <button onClick={() => setModal({ tipo: 'venda' })} className="h-10 px-4 text-sm bg-[#7DC421] text-white rounded-lg hover:bg-[#6ab01a] inline-flex items-center gap-2"><ShoppingCart size={16} />Vender</button>
        </div>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Produtos desta unidade. A venda paga entra no Financeiro como entrada; a que o aluno não pagar fica no Financeiro, a receber no vencimento da mensalidade.
      </p>

      {erro && <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{erro}</div>}

      {!erro && (aComprar > 0 || pendentes.length > 0) && (
        <div className="mb-4 flex flex-wrap gap-3 text-sm">
          {aComprar > 0 && <span className="rounded-lg bg-red-50 text-red-700 px-3 py-2">{aComprar} produto(s) para comprar</span>}
          {pendentes.length > 0 && <span className="rounded-lg bg-amber-50 text-amber-700 px-3 py-2">{pendentes.length} venda(s) ainda não paga(s): {moeda(pendentes.reduce((a, r) => a + totalVenda(r.preco_unitario, r.quantidade), 0))}</span>}
        </div>
      )}

      <div className="flex border-b border-gray-200 mb-4">
        {aba_('produtos', 'Produtos')}{aba_('vendas', 'Vendas')}{aba_('compras', 'Compras')}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        {loading ? <div className="text-center py-8 text-gray-400">Carregando...</div> : aba === 'produtos' ? (
          ativos.length === 0 ? <div className="text-center py-8 text-gray-400">Nenhum produto cadastrado</div> : (
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50 border-b border-gray-200">
                {['Produto', 'Saldo', 'Limite', 'Situação', 'Custo', 'Aluno', 'Professor', ''].map(t => <th key={t} className="text-left px-3 py-3 text-th text-gray-500">{t}</th>)}
              </tr></thead>
              <tbody>
                {ativos.map(p => {
                  const sd = saldos[p.id] ?? 0
                  const sit = situacao(sd, p.limite_compra)
                  return (
                    <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-3 font-medium text-gray-900">{p.nome}{p.encordoamento && <span className="ml-2 text-xs text-gray-400">encordoamento</span>}</td>
                      <td className="px-3 py-3 font-semibold">{sd}</td>
                      <td className="px-3 py-3 text-gray-500">{p.limite_compra}</td>
                      <td className="px-3 py-3"><span className={`px-2 py-1 rounded-full text-xs font-semibold ${COR[sit]}`}>{sit}</span></td>
                      <td className="px-3 py-3">{moeda(p.custo)}</td>
                      <td className="px-3 py-3">{moeda(p.preco_aluno)}</td>
                      <td className="px-3 py-3">{p.preco_professor != null ? moeda(p.preco_professor) : '—'}</td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <button onClick={() => setModal({ tipo: 'venda', produto: p })} className="text-[#5a9217] hover:underline mr-3">Vender</button>
                        <button onClick={() => setModal({ tipo: 'compra', produto: p })} className="text-blue-600 hover:underline mr-3">Comprar</button>
                        <button onClick={() => setModal({ tipo: 'produto', produto: p })} className="text-gray-500 hover:text-gray-800 align-middle" title="Editar"><Pencil size={15} /></button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )
        ) : aba === 'vendas' ? (
          retiradas.length === 0 ? <div className="text-center py-8 text-gray-400">Nenhuma venda</div> : (
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50 border-b border-gray-200">
                {['Data', 'Produto', 'Qtd', 'Quem', 'Total', 'Lucro', 'Pagamento', ''].map(t => <th key={t} className="text-left px-3 py-3 text-th text-gray-500">{t}</th>)}
              </tr></thead>
              <tbody>
                {retiradas.map(r => {
                  const pago = r.movimentacoes?.status === 'Recebido'
                  return (
                    <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-3 whitespace-nowrap">{dataBr(r.data)}</td>
                      <td className="px-3 py-3 font-medium text-gray-900">{r.estoque_produtos?.nome}</td>
                      <td className="px-3 py-3">{r.quantidade}</td>
                      <td className="px-3 py-3">{r.comprador === 'aluno' ? r.alunos?.nome : `${r.professores?.nome} (prof.)`}</td>
                      <td className="px-3 py-3">{moeda(totalVenda(r.preco_unitario, r.quantidade))}</td>
                      <td className="px-3 py-3">{moeda(lucroVenda(r.preco_unitario, r.custo_unitario, r.quantidade))}</td>
                      <td className="px-3 py-3">
                        {pago ? <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">Pago</span>
                          : <span className="px-2 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">Vence {r.movimentacoes?.data_vencimento ? dataBr(r.movimentacoes.data_vencimento) : '—'}</span>}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {!pago && <button onClick={() => darBaixa(r)} className="text-green-700 hover:underline mr-3 inline-flex items-center gap-1"><Check size={14} />Dar baixa</button>}
                        <button onClick={() => desfazerVenda(r)} className="text-gray-400 hover:text-red-600 align-middle" title="Desfazer venda"><Undo2 size={15} /></button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )
        ) : (
          compras.length === 0 ? <div className="text-center py-8 text-gray-400">Nenhuma compra</div> : (
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50 border-b border-gray-200">
                {['Data', 'Produto', 'Qtd', 'Custo un.', 'Total', 'Fornecedor', ''].map(t => <th key={t} className="text-left px-3 py-3 text-th text-gray-500">{t}</th>)}
              </tr></thead>
              <tbody>
                {compras.map(c => (
                  <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-3 whitespace-nowrap">{dataBr(c.data)}</td>
                    <td className="px-3 py-3 font-medium text-gray-900">{c.estoque_produtos?.nome}</td>
                    <td className="px-3 py-3">{c.quantidade}</td>
                    <td className="px-3 py-3">{moeda(c.custo_unitario)}</td>
                    <td className="px-3 py-3">{moeda(totalVenda(c.custo_unitario, c.quantidade))}</td>
                    <td className="px-3 py-3 text-gray-600">{c.pessoas?.nome ?? '—'}</td>
                    <td className="px-3 py-3"><button onClick={() => desfazerCompra(c)} className="text-gray-400 hover:text-red-600" title="Desfazer compra"><Undo2 size={15} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
      </div>

      {modal?.tipo === 'produto' && unidadeId && (
        <FormProduto unidadeId={unidadeId} produto={modal.produto} fornecedores={fornecedores} professores={professores}
          onFechar={() => setModal(null)} onSalvo={() => { setModal(null); carregar() }} />
      )}
      {modal?.tipo === 'compra' && (
        <FormCompra produtos={ativos} inicial={modal.produto} fornecedores={fornecedores} bancos={bancos}
          onFechar={() => setModal(null)} onSalvo={() => { setModal(null); setAba('compras'); carregar() }} />
      )}
      {modal?.tipo === 'venda' && (
        <FormVenda produtos={ativos} saldos={saldos} inicial={modal.produto} alunos={alunos} professores={professores} bancos={bancos}
          onFechar={() => setModal(null)} onSalvo={() => { setModal(null); setAba('vendas'); carregar() }} />
      )}
    </div>
  )
}

function FormProduto({ unidadeId, produto, fornecedores, professores, onFechar, onSalvo }: {
  unidadeId: string; produto?: Produto; fornecedores: Opcao[]; professores: Opcao[]; onFechar: () => void; onSalvo: () => void
}) {
  const [f, setF] = useState({
    nome: produto?.nome ?? '', categoria: produto?.categoria ?? '', fornecedor_id: produto?.fornecedor_id ?? '',
    custo: String(produto?.custo ?? ''), preco_aluno: String(produto?.preco_aluno ?? ''),
    preco_professor: produto?.preco_professor != null ? String(produto.preco_professor) : '',
    limite_compra: String(produto?.limite_compra ?? 0), encordoamento: produto?.encordoamento ?? false,
    comissao_indicacao: String(produto?.comissao_indicacao ?? 0), comissao_valor: String(produto?.comissao_valor ?? 10), comissao_professor_id: produto?.comissao_professor_id ?? '',
    ativo: produto?.ativo ?? true,
  })
  const [salvando, setSalvando] = useState(false)
  const set = (k: keyof typeof f, v: string | boolean) => setF(x => ({ ...x, [k]: v }))

  async function salvar() {
    if (!f.nome.trim()) return alert('Informe o nome do produto.')
    const preco = numero(f.preco_aluno)
    if (!(preco >= 0)) return alert('Informe o preço para o aluno.')
    const dados = {
      nome: f.nome.trim(), categoria: f.categoria.trim() || null, fornecedor_id: f.fornecedor_id || null,
      custo: numero(f.custo) >= 0 ? numero(f.custo) : 0, preco_aluno: preco,
      preco_professor: f.preco_professor.trim() === '' ? null : numero(f.preco_professor),
      limite_compra: Math.max(0, parseInt(f.limite_compra) || 0), encordoamento: f.encordoamento,
      comissao_indicacao: numero(f.comissao_indicacao) >= 0 && numero(f.comissao_indicacao) <= 100 ? numero(f.comissao_indicacao) : 0,
      comissao_valor: numero(f.comissao_valor) >= 0 ? numero(f.comissao_valor) : 10,
      comissao_professor_id: f.encordoamento ? f.comissao_professor_id || null : null, ativo: f.ativo,
    }
    setSalvando(true)
    const { error } = produto
      ? await supabase.from('estoque_produtos').update(dados).eq('id', produto.id)
      : await supabase.from('estoque_produtos').insert({ ...dados, unidade_id: unidadeId })
    setSalvando(false)
    if (error) return alert(error.code === '23505' ? 'Já existe um produto com este nome nesta unidade.' : 'Erro: ' + error.message)
    await registrarLog(produto ? 'Produto de estoque alterado' : 'Produto de estoque criado', 'estoque_produtos', produto?.id, dados.nome)
    onSalvo()
  }

  return (
    <Janela titulo={produto ? 'Editar produto' : 'Novo produto'} onFechar={onFechar}>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><Rotulo texto="Nome"><input className={campo} value={f.nome} onChange={e => set('nome', e.target.value)} /></Rotulo></div>
        <Rotulo texto="Categoria"><input className={campo} value={f.categoria} onChange={e => set('categoria', e.target.value)} placeholder="Ex.: Overgrip" /></Rotulo>
        <Rotulo texto="Fornecedor">
          <select className={campo} value={f.fornecedor_id} onChange={e => set('fornecedor_id', e.target.value)}>
            <option value="">Nenhum</option>{fornecedores.map(x => <option key={x.id} value={x.id}>{x.nome}</option>)}
          </select>
        </Rotulo>
        <Rotulo texto="Custo (R$)"><input className={campo} inputMode="decimal" value={f.custo} onChange={e => set('custo', e.target.value)} /></Rotulo>
        <Rotulo texto="Comprar quando sobrar até"><input className={campo} inputMode="numeric" value={f.limite_compra} onChange={e => set('limite_compra', e.target.value)} /></Rotulo>
        <Rotulo texto="Preço aluno (R$)"><input className={campo} inputMode="decimal" value={f.preco_aluno} onChange={e => set('preco_aluno', e.target.value)} /></Rotulo>
        <Rotulo texto="Preço professor (R$)"><input className={campo} inputMode="decimal" value={f.preco_professor} onChange={e => set('preco_professor', e.target.value)} placeholder="Igual ao do aluno" /></Rotulo>
        <Rotulo texto="Comissão de indicação (%)"><input className={campo} inputMode="decimal" value={f.comissao_indicacao} onChange={e => set('comissao_indicacao', e.target.value)} placeholder="0 = não paga" /></Rotulo>
        <div className="text-xs text-gray-500 self-end pb-2">Para o professor que indicar a venda (valor sobre o total da venda).</div>
        <label className="col-span-2 flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input type="checkbox" className="h-[18px] w-[18px] accent-blue-600" checked={f.encordoamento} onChange={e => set('encordoamento', e.target.checked)} />
          É encordoamento (paga comissão ao professor em cada venda)
        </label>
        {f.encordoamento && (
          <>
            <Rotulo texto="Comissão por unidade (R$)"><input className={campo} inputMode="decimal" value={f.comissao_valor} onChange={e => set('comissao_valor', e.target.value)} /></Rotulo>
            <Rotulo texto="Professor da comissão">
              <select className={campo} value={f.comissao_professor_id} onChange={e => set('comissao_professor_id', e.target.value)}>
                <option value="">Escolher</option>{professores.map(x => <option key={x.id} value={x.id}>{x.nome}</option>)}
              </select>
            </Rotulo>
          </>
        )}
        {produto && (
          <label className="col-span-2 flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" className="h-[18px] w-[18px] accent-blue-600" checked={f.ativo} onChange={e => set('ativo', e.target.checked)} /> Produto ativo
          </label>
        )}
      </div>
      <div className="flex justify-end gap-2 mt-5">
        <button onClick={onFechar} className="h-10 px-4 text-sm border border-gray-200 rounded-lg">Cancelar</button>
        <button onClick={salvar} disabled={salvando} className="h-10 px-4 text-sm bg-[#7DC421] text-white rounded-lg hover:bg-[#6ab01a] disabled:opacity-50">Salvar</button>
      </div>
    </Janela>
  )
}

function FormCompra({ produtos, inicial, fornecedores, bancos, onFechar, onSalvo }: {
  produtos: Produto[]; inicial?: Produto; fornecedores: Opcao[]; bancos: Opcao[]; onFechar: () => void; onSalvo: () => void
}) {
  const [produtoId, setProdutoId] = useState(inicial?.id ?? '')
  const [qtd, setQtd] = useState('')
  const [custo, setCusto] = useState(inicial ? String(inicial.custo) : '')
  const [fornecedor, setFornecedor] = useState(inicial?.fornecedor_id ?? '')
  const [data, setData] = useState(hojeIso())
  const [lancar, setLancar] = useState(true)
  const [forma, setForma] = useState('Pix')
  const [banco, setBanco] = useState('')
  const [salvando, setSalvando] = useState(false)

  function escolher(id: string) {
    setProdutoId(id)
    const p = produtos.find(x => x.id === id)
    if (p) { setCusto(String(p.custo)); setFornecedor(p.fornecedor_id ?? '') }
  }

  async function salvar() {
    if (!produtoId) return alert('Escolha o produto.')
    const q = parseInt(qtd), c = numero(custo)
    const erros = validarCompra({ quantidade: q, custo_unitario: c })
    if (erros.length) return alert(erros.join('\n'))
    setSalvando(true)
    const { error } = await supabase.rpc('estoque_comprar', {
      p_produto: produtoId, p_quantidade: q, p_custo: c, p_fornecedor: fornecedor || null, p_data: data,
      p_lancar: lancar, p_forma: forma, p_banco: banco || null,
    })
    setSalvando(false)
    if (error) return alert('Erro: ' + error.message)
    await registrarLog('Compra de estoque', 'estoque_compras', undefined, `${q} x ${produtos.find(x => x.id === produtoId)?.nome}`)
    onSalvo()
  }

  const total = arredonda((parseInt(qtd) || 0) * (numero(custo) || 0))
  return (
    <Janela titulo="Comprar (entrada no estoque)" onFechar={onFechar}>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><Rotulo texto="Produto">
          <select className={campo} value={produtoId} onChange={e => escolher(e.target.value)}>
            <option value="">Escolher</option>{produtos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select></Rotulo></div>
        <Rotulo texto="Quantidade"><input className={campo} inputMode="numeric" value={qtd} onChange={e => setQtd(e.target.value)} /></Rotulo>
        <Rotulo texto="Custo de cada (R$)"><input className={campo} inputMode="decimal" value={custo} onChange={e => setCusto(e.target.value)} /></Rotulo>
        <Rotulo texto="Fornecedor">
          <select className={campo} value={fornecedor} onChange={e => setFornecedor(e.target.value)}>
            <option value="">Nenhum</option>{fornecedores.map(x => <option key={x.id} value={x.id}>{x.nome}</option>)}
          </select></Rotulo>
        <Rotulo texto="Data"><input type="date" className={campo} value={data} onChange={e => setData(e.target.value)} /></Rotulo>
        <label className="col-span-2 flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input type="checkbox" className="h-[18px] w-[18px] accent-blue-600" checked={lancar} onChange={e => setLancar(e.target.checked)} />
          Lançar a saída no Financeiro ({moeda(total)}). Desmarque para só registrar o estoque que já existe.
        </label>
        {lancar && (
          <>
            <Rotulo texto="Forma de pagamento"><select className={campo} value={forma} onChange={e => setForma(e.target.value)}>{FORMAS.map(x => <option key={x}>{x}</option>)}</select></Rotulo>
            <Rotulo texto="Banco"><select className={campo} value={banco} onChange={e => setBanco(e.target.value)}><option value="">Nenhum</option>{bancos.map(x => <option key={x.id} value={x.id}>{x.nome}</option>)}</select></Rotulo>
          </>
        )}
      </div>
      <div className="flex justify-end gap-2 mt-5">
        <button onClick={onFechar} className="h-10 px-4 text-sm border border-gray-200 rounded-lg">Cancelar</button>
        <button onClick={salvar} disabled={salvando} className="h-10 px-4 text-sm bg-[#7DC421] text-white rounded-lg hover:bg-[#6ab01a] disabled:opacity-50">Registrar compra</button>
      </div>
    </Janela>
  )
}
