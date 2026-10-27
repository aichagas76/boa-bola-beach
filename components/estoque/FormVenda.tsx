'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useUnidade } from '@/components/layout/UnidadeProvider'
import { registrarLog } from '@/lib/log'
import { X } from 'lucide-react'
import { comissaoIndicacao, precoUnitario, totalVenda, validarVenda, vencimentoNaMensalidade, vencimentoProfessor, type Comprador, type Situacao } from '@/lib/estoque'

export type Produto = {
  id: string; nome: string; categoria: string | null; fornecedor_id: string | null
  custo: number; preco_aluno: number; preco_professor: number | null; limite_compra: number
  encordoamento: boolean; comissao_indicacao?: number; comissao_valor: number; comissao_professor_id: string | null; ativo: boolean
}
export type Opcao = { id: string; nome: string }
export type AlunoOpcao = Opcao & { data_vencimento: string | null }
export type Retirada = {
  id: string; data: string; quantidade: number; comprador: Comprador; preco_unitario: number; custo_unitario: number
  produto_id: string; estoque_produtos: { nome: string } | null; alunos: { nome: string } | null; professores: { nome: string } | null
  movimentacoes: { status: string; data_vencimento: string | null } | null
}
export type Compra = {
  id: string; data: string; quantidade: number; custo_unitario: number
  estoque_produtos: { nome: string } | null; pessoas: { nome: string } | null
}

export const FORMAS = ['Pix', 'Dinheiro', 'Cartão Débito', 'Cartão Crédito', 'Transferência']
export const moeda = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
export const hojeIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export const dataBr = (iso: string) => iso.split('-').reverse().join('/')
export const numero = (s: string) => {
  const n = parseFloat(s.replace(',', '.'))
  return Number.isFinite(n) ? n : NaN
}

export const COR: Record<Situacao, string> = {
  COMPRAR: 'bg-red-100 text-red-700',
  'ATENÇÃO': 'bg-amber-100 text-amber-700',
  OK: 'bg-green-100 text-green-700',
}
export const campo = 'w-full h-10 border border-gray-200 rounded-lg px-3 text-sm bg-white'

export function Janela({ titulo, onFechar, children }: { titulo: string; onFechar: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onFechar}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-section-title text-gray-900">{titulo}</h2>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-600" title="Fechar"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Rotulo({ texto, children }: { texto: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-label text-gray-500 block mb-1">{texto}</span>{children}</label>
}

export function FormVenda({ produtos, saldos, inicial, alunos, professores, bancos, alunoFixo, onFechar, onSalvo }: {
  produtos: Produto[]; saldos: Record<string, number>; inicial?: Produto; alunos: AlunoOpcao[]; professores: Opcao[]; bancos: Opcao[]; alunoFixo?: AlunoOpcao
  onFechar: () => void; onSalvo: () => void
}) {
  const [produtoId, setProdutoId] = useState(inicial?.id ?? '')
  const [comprador, setComprador] = useState<Comprador>('aluno')
  const [alunoId, setAlunoId] = useState(alunoFixo?.id ?? '')
  const [professorId, setProfessorId] = useState('')
  const [qtd, setQtd] = useState('1')
  const [pago, setPago] = useState(true)
  const [forma, setForma] = useState('Pix')
  const [banco, setBanco] = useState('')
  const [data, setData] = useState(hojeIso())
  const [comissaoProf, setComissaoProf] = useState('')
  const [comissaoValor, setComissaoValor] = useState('')
  const [indicacaoProf, setIndicacaoProf] = useState('')
  const [indicacaoPct, setIndicacaoPct] = useState<string | null>(null) // null = usa o % do cadastro do produto
  const [salvando, setSalvando] = useState(false)

  const produto = produtos.find(p => p.id === produtoId)
  const precoPadrao = produto ? precoUnitario(produto, comprador) : 0
  // O valor pode ser alterado na venda; ao trocar de produto ou de comprador volta ao preço do cadastro
  const chavePreco = `${produtoId}|${comprador}`
  const [manual, setManual] = useState<{ chave: string; texto: string } | null>(null)
  const textoPreco = manual && manual.chave === chavePreco ? manual.texto : String(precoPadrao).replace('.', ',')
  const editou = !!manual && manual.chave === chavePreco && Number.isFinite(numero(manual.texto))
  const preco = editou ? numero(manual!.texto) : precoPadrao
  const q = parseInt(qtd) || 0
  const aluno = alunoFixo ?? alunos.find(a => a.id === alunoId)
  const vencimento = comprador === 'aluno' ? vencimentoNaMensalidade(hojeIso(), aluno?.data_vencimento) : vencimentoProfessor(hojeIso())

  async function salvar() {
    if (!produto) return alert('Escolha o produto.')
    const erros = validarVenda({ quantidade: q, saldo: saldos[produto.id] ?? 0, comprador, aluno_id: alunoId, professor_id: professorId, preco })
    if (erros.length) return alert(erros.join('\n'))
    setSalvando(true)
    const { error } = await supabase.rpc('estoque_vender', {
      p_produto: produto.id, p_quantidade: q, p_comprador: comprador,
      p_aluno: comprador === 'aluno' ? alunoId : null, p_professor: comprador === 'professor' ? professorId : null,
      p_pago: pago, p_forma: forma, p_banco: pago ? banco || null : null, p_vencimento: pago ? null : vencimento, p_data: data,
      p_comissao_professor: produto.encordoamento ? comissaoProf || null : null,
      p_comissao_valor: produto.encordoamento && comissaoValor.trim() !== '' ? numero(comissaoValor) : null,
      ...(editou ? { p_preco: preco } : {}),
      ...(indicacaoProf ? { p_indicacao_professor: indicacaoProf, ...(indicacaoPct !== null && Number.isFinite(numero(indicacaoPct)) ? { p_indicacao_percentual: numero(indicacaoPct) } : {}) } : {}),
    })
    setSalvando(false)
    if (error) return alert('Erro: ' + error.message)
    await registrarLog('Venda de estoque', 'estoque_retiradas', undefined, `${q} x ${produto.nome}`)
    onSalvo()
  }

  return (
    <Janela titulo="Vender (saída do estoque)" onFechar={onFechar}>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><Rotulo texto="Produto">
          <select className={campo} value={produtoId} onChange={e => setProdutoId(e.target.value)}>
            <option value="">Escolher</option>{produtos.map(p => <option key={p.id} value={p.id}>{p.nome} (restam {saldos[p.id] ?? 0})</option>)}
          </select></Rotulo></div>
        {alunoFixo ? (
          <div className="col-span-2 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">Aluno: <b>{alunoFixo.nome}</b></div>
        ) : (
        <Rotulo texto="Vender para">
          <select className={campo} value={comprador} onChange={e => setComprador(e.target.value as Comprador)}>
            <option value="aluno">Aluno</option><option value="professor">Professor</option>
          </select></Rotulo>
        )}
        {alunoFixo ? null : comprador === 'aluno' ? (
          <Rotulo texto="Aluno"><select className={campo} value={alunoId} onChange={e => setAlunoId(e.target.value)}>
            <option value="">Escolher</option>{alunos.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}</select></Rotulo>
        ) : (
          <Rotulo texto="Professor"><select className={campo} value={professorId} onChange={e => setProfessorId(e.target.value)}>
            <option value="">Escolher</option>{professores.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}</select></Rotulo>
        )}
        <Rotulo texto="Quantidade"><input className={campo} inputMode="numeric" value={qtd} onChange={e => setQtd(e.target.value)} /></Rotulo>
        <Rotulo texto="Data"><input type="date" className={campo} value={data} onChange={e => setData(e.target.value)} /></Rotulo>
        <Rotulo texto={`Valor de cada (R$) — ${comprador === 'professor' ? 'preço do professor' : 'preço do aluno'}, pode alterar`}>
          <input className={campo} inputMode="decimal" disabled={!produto} value={produto ? textoPreco : ''} placeholder="0,00"
            onChange={e => setManual({ chave: chavePreco, texto: e.target.value })} />
        </Rotulo>
        <div className="rounded-lg bg-gray-50 px-3 flex flex-col justify-center text-sm text-gray-700 self-end h-10">
          {produto ? <span>Total: <b>{moeda(totalVenda(preco, q))}</b>{editou && preco !== precoPadrao ? <span className="ml-2 text-xs text-amber-600">(alterado)</span> : null}</span> : 'Escolha o produto'}
        </div>
        <div className="col-span-2 flex gap-2">
          <button type="button" onClick={() => setPago(true)} className={`flex-1 h-10 rounded-lg border text-sm ${pago ? 'border-green-500 bg-green-50 text-green-800' : 'border-gray-200 text-gray-600'}`}>Pago agora</button>
          <button type="button" onClick={() => setPago(false)} className={`flex-1 h-10 rounded-lg border text-sm ${!pago ? 'border-amber-500 bg-amber-50 text-amber-800' : 'border-gray-200 text-gray-600'}`}>Não pagou</button>
        </div>
        {pago ? (
          <>
            <Rotulo texto="Forma de pagamento"><select className={campo} value={forma} onChange={e => setForma(e.target.value)}>{FORMAS.map(x => <option key={x}>{x}</option>)}</select></Rotulo>
            <Rotulo texto="Banco"><select className={campo} value={banco} onChange={e => setBanco(e.target.value)}><option value="">Nenhum</option>{bancos.map(x => <option key={x.id} value={x.id}>{x.nome}</option>)}</select></Rotulo>
          </>
        ) : (
          <div className="col-span-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Fica no Financeiro do mês, a receber em <b>{dataBr(vencimento)}</b>{comprador === 'aluno' ? ' (vencimento da mensalidade)' : ' (fim do mês)'}. Depois é só dar baixa.
          </div>
        )}
        <Rotulo texto="Indicação (professor)">
          <select className={campo} value={indicacaoProf} onChange={e => setIndicacaoProf(e.target.value)}>
            <option value="">Ninguém indicou</option>{professores.map(x => <option key={x.id} value={x.id}>{x.nome}</option>)}
          </select>
        </Rotulo>
        {indicacaoProf ? (() => {
          const pct = indicacaoPct !== null && Number.isFinite(numero(indicacaoPct)) ? numero(indicacaoPct) : Number(produto?.comissao_indicacao ?? 0)
          return (
            <Rotulo texto="Comissão da indicação (%)">
              <div className="flex items-center gap-2">
                <input className={campo} inputMode="decimal" value={indicacaoPct ?? String(produto?.comissao_indicacao ?? 0).replace('.', ',')} onChange={e => setIndicacaoPct(e.target.value)} />
                <span className="text-sm text-gray-600 whitespace-nowrap">= <b>{moeda(comissaoIndicacao(totalVenda(preco, q), pct))}</b></span>
              </div>
            </Rotulo>
          )
        })() : <div />}
        {produto?.encordoamento && (
          <>
            <Rotulo texto="Comissão para">
              <select className={campo} value={comissaoProf || produto.comissao_professor_id || ''} onChange={e => setComissaoProf(e.target.value)}>
                <option value="">Escolher</option>{professores.map(x => <option key={x.id} value={x.id}>{x.nome}</option>)}
              </select></Rotulo>
            <Rotulo texto="Valor por unidade (R$)"><input className={campo} inputMode="decimal" value={comissaoValor} onChange={e => setComissaoValor(e.target.value)} placeholder={String(produto.comissao_valor)} /></Rotulo>
          </>
        )}
      </div>
      <div className="flex justify-end gap-2 mt-5">
        <button onClick={onFechar} className="h-10 px-4 text-sm border border-gray-200 rounded-lg">Cancelar</button>
        <button onClick={salvar} disabled={salvando} className="h-10 px-4 text-sm bg-[#7DC421] text-white rounded-lg hover:bg-[#6ab01a] disabled:opacity-50">Registrar venda</button>
      </div>
    </Janela>
  )
}


/** Popup de retirada de produto aberto a partir de um aluno (lista de Alunos). */
export function VendaDoAluno({ aluno, onFechar, onSalvo }: { aluno: AlunoOpcao; onFechar: () => void; onSalvo?: () => void }) {
  const { unidadeId } = useUnidade()
  const [dados, setDados] = useState<{ produtos: Produto[]; saldos: Record<string, number>; professores: Opcao[]; bancos: Opcao[] } | null>(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (!unidadeId) return
    let ativo = true
    Promise.all([
      supabase.from('estoque_produtos').select('*').eq('unidade_id', unidadeId).eq('ativo', true).order('nome'),
      supabase.from('estoque_saldos').select('produto_id, saldo'),
      supabase.from('professores').select('id, nome').eq('ativo', true).order('nome'),
      supabase.from('bancos').select('id, nome').order('nome'),
    ]).then(([p, s, pr, b]) => {
      if (!ativo) return
      if (p.error) return setErro('O estoque ainda não está ativado no banco de dados.')
      setDados({
        produtos: (p.data ?? []) as Produto[],
        saldos: Object.fromEntries((s.data ?? []).map((x: { produto_id: string; saldo: number }) => [x.produto_id, Number(x.saldo)])),
        professores: pr.data ?? [], bancos: b.data ?? [],
      })
    })
    return () => { ativo = false }
  }, [unidadeId])

  if (erro) return <Janela titulo="Retirar produto" onFechar={onFechar}><p className="text-sm text-amber-800">{erro}</p></Janela>
  if (!dados) return <Janela titulo="Retirar produto" onFechar={onFechar}><p className="text-sm text-gray-400">Carregando...</p></Janela>
  if (dados.produtos.length === 0) return <Janela titulo="Retirar produto" onFechar={onFechar}><p className="text-sm text-gray-500">Nenhum produto cadastrado em Estoque nesta unidade.</p></Janela>
  return <FormVenda produtos={dados.produtos} saldos={dados.saldos} alunos={[aluno]} alunoFixo={aluno} professores={dados.professores} bancos={dados.bancos}
    onFechar={onFechar} onSalvo={() => { onSalvo?.(); onFechar() }} />
}
