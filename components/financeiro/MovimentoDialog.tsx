'use client'

import { useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { registrarLog } from '@/lib/log'
import { datasRecorrentes, rotuloParcela, validarRecorrencia } from '@/lib/recorrencia'
import { X } from 'lucide-react'

export type TipoMov = 'Entrada' | 'Saída'
export type Opcao = { id: string; nome: string }
export type CategoriaOpcao = { id: string; tipo: TipoMov; categoria: string; subcategoria: string | null }
export type Catalogos = {
  categorias: CategoriaOpcao[]
  pessoas: Opcao[]
  contas: Opcao[]
  bancos: Opcao[]
  esportes: Opcao[]
  alunos: Opcao[]
  professores: Opcao[]
}
export type MovimentoEditavel = {
  id: string
  tipo: TipoMov
  categoria_id: string | null
  pessoa_id: string | null
  aluno_ref_id: string | null
  professor_id: string | null
  conta_bancaria_id: string | null
  banco_id: string | null
  esporte_id: string | null
  status: string | null
  data: string
  data_vencimento: string | null
  data_pagamento: string | null
  descricao: string | null
  valor: number
  forma_pagamento: string | null
}

// O valor gravado é o texto da forma de pagamento (já usado no sistema); o rótulo é o que aparece no botão.
const FORMAS: { valor: string; rotulo: string }[] = [
  { valor: 'Pix', rotulo: 'Pix' },
  { valor: 'Dinheiro', rotulo: 'Dinheiro' },
  { valor: 'Cartão Débito', rotulo: 'Débito' },
  { valor: 'Cartão Crédito', rotulo: 'Crédito' },
  { valor: 'Transferência', rotulo: 'Transf.' },
  { valor: 'Boleto', rotulo: 'Boleto' },
]

const hoje = () => new Date().toLocaleDateString('en-CA')
const maisDias = (n: number) => new Date(Date.now() + n * 86400000).toLocaleDateString('en-CA')
const centavos = (v: number) => String(Math.round(v * 100))
const formatarValor = (digitos: string) => {
  const n = digitos.replace(/\D/g, '')
  return n ? (parseInt(n, 10) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''
}

const caixa = 'w-full h-10 border border-gray-200 rounded-lg px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#7DC421]/40 focus:border-[#7DC421]'

function Campo({ rotulo, children, cheio }: { rotulo: string; children: React.ReactNode; cheio?: boolean }) {
  return (
    <div className={cheio ? 'col-span-2' : ''}>
      <span className="text-label text-gray-500 block mb-1">{rotulo}</span>
      {children}
    </div>
  )
}

function Seg({ opcoes, atual, aoMudar, cor }: { opcoes: { valor: string; rotulo: string }[]; atual: string; aoMudar: (v: string) => void; cor: string }) {
  return (
    <div className="flex flex-wrap rounded-lg border border-gray-200 overflow-hidden bg-white">
      {opcoes.map((o, i) => (
        <button
          key={o.valor}
          type="button"
          aria-pressed={atual === o.valor}
          onClick={() => aoMudar(atual === o.valor ? '' : o.valor)}
          className={`flex-1 h-10 px-2 text-sm whitespace-nowrap transition-colors ${i > 0 ? 'border-l border-gray-200' : ''} ${atual === o.valor ? `${cor} text-white font-medium` : 'text-gray-700 hover:bg-gray-50'}`}
        >{o.rotulo}</button>
      ))}
    </div>
  )
}

export default function MovimentoDialog({ tipo, movimento, unidadeId, catalogos, onFechar, onSalvo }: {
  tipo: TipoMov
  movimento?: MovimentoEditavel
  unidadeId: string
  catalogos: Catalogos
  onFechar: () => void
  onSalvo: () => void
}) {
  const entrada = tipo === 'Entrada'
  const editando = !!movimento
  const cor = entrada ? 'bg-green-600' : 'bg-red-600'
  const doTipo = catalogos.categorias.filter(c => c.tipo === tipo)
  const nomes = useMemo(() => [...new Set(doTipo.map(c => c.categoria))].sort((a, b) => a.localeCompare(b)), [doTipo])

  const inicial = movimento ? catalogos.categorias.find(c => c.id === movimento.categoria_id) : undefined
  const [categoria, setCategoria] = useState(inicial?.categoria ?? '')
  const [categoriaId, setCategoriaId] = useState(movimento?.categoria_id ?? '')
  const [descricao, setDescricao] = useState(movimento?.descricao ?? '')
  const [pessoaId, setPessoaId] = useState(movimento?.pessoa_id ?? '')
  const [alunoId, setAlunoId] = useState(movimento?.aluno_ref_id ?? '')
  const [professorId, setProfessorId] = useState(movimento?.professor_id ?? '')
  const [esporteId, setEsporteId] = useState(movimento?.esporte_id ?? '')
  const [bancoId, setBancoId] = useState(movimento?.banco_id ?? '')
  const [contaId, setContaId] = useState(movimento?.conta_bancaria_id ?? '')
  const [valor, setValor] = useState(movimento ? centavos(movimento.valor) : '')
  const [forma, setForma] = useState(movimento?.forma_pagamento ?? '')
  const [feito, setFeito] = useState(movimento ? movimento.status === 'Recebido' || movimento.status === 'Pago' : false)
  const [vencimento, setVencimento] = useState(movimento?.data_vencimento ?? movimento?.data ?? maisDias(4))
  const [dataPag, setDataPag] = useState(movimento?.data_pagamento ?? hoje())
  const [recorrente, setRecorrente] = useState(false)
  const [recDia, setRecDia] = useState('')
  const [recMeses, setRecMeses] = useState('12')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  // Subcategorias da categoria escolhida; se ela não tiver nenhuma, vale a própria categoria.
  const subs = doTipo.filter(c => c.categoria === categoria && c.subcategoria)
  const pai = doTipo.find(c => c.categoria === categoria && !c.subcategoria)

  function escolherCategoria(nome: string) {
    setCategoria(nome)
    const semSub = !doTipo.some(c => c.categoria === nome && c.subcategoria)
    setCategoriaId(semSub ? doTipo.find(c => c.categoria === nome)?.id ?? '' : '')
  }

  // Ao escolher o aluno (entrada), o valor já vem com a soma das modalidades dele — só se ainda estiver vazio.
  async function escolherAluno(id: string) {
    setAlunoId(id)
    if (!id || !entrada || valor) return
    const { data } = await supabase.from('matriculas').select('valor').eq('aluno_id', id)
    const c = Math.round((data ?? []).reduce((a, m) => a + (m.valor ?? 0), 0) * 100)
    if (c > 0) setValor(v => (v ? v : String(c)))
  }

  const podeRecorrer = !editando

  async function salvar() {
    const idCat = categoriaId || (subs.length === 0 ? pai?.id ?? '' : '')
    if (!idCat) return setErro('Escolha a categoria e a subcategoria.')
    const num = parseInt(valor.replace(/\D/g, '') || '0', 10) / 100
    if (!(num > 0)) return setErro('Informe o valor.')
    if (!vencimento) return setErro('Informe o vencimento.')
    if (!descricao.trim()) return setErro('Informe a descrição.')
    if (feito && !dataPag) return setErro('Informe a data do pagamento.')
    const meses = recorrente ? parseInt(recMeses, 10) : 0
    if (recorrente) {
      const e = validarRecorrencia(meses, parseInt(recDia, 10))
      if (e) return setErro(e)
    }
    setErro('')
    setSalvando(true)

    const base = {
      tipo,
      categoria_id: idCat,
      pessoa_id: pessoaId || null,
      aluno_ref_id: alunoId || null,
      professor_id: professorId || null,
      conta_bancaria_id: contaId || null,
      banco_id: bancoId || null,
      esporte_id: esporteId || null,
      forma_pagamento: forma || 'Pix',
      valor: num,
    }
    const statusFeito = entrada ? 'Recebido' : 'Pago'
    const statusAberto = entrada ? 'Não recebido' : 'Pendente'

    let falha: { message: string } | null = null
    if (editando) {
      const { error } = await supabase.from('movimentacoes').update({
        ...base, descricao: descricao.trim(), status: feito ? statusFeito : statusAberto,
        data_vencimento: vencimento, data_pagamento: feito ? dataPag : null,
      }).eq('id', movimento!.id)
      falha = error
    } else if (recorrente) {
      const datas = datasRecorrentes(vencimento, parseInt(recDia, 10), meses)
      const { error } = await supabase.from('movimentacoes').insert(datas.map((d, i) => ({
        ...base, unidade_id: unidadeId, data: d, data_vencimento: d,
        descricao: descricao.trim() + rotuloParcela(i + 1, meses),
        // O primeiro vale pela situação escolhida; os seguintes ficam em aberto.
        status: i === 0 && feito ? statusFeito : statusAberto,
        data_pagamento: i === 0 && feito ? dataPag : null,
      })))
      falha = error
    } else {
      const { error } = await supabase.from('movimentacoes').insert({
        ...base, unidade_id: unidadeId, data: vencimento, data_vencimento: vencimento, descricao: descricao.trim(),
        status: feito ? statusFeito : statusAberto, data_pagamento: feito ? dataPag : null,
      })
      falha = error
    }
    setSalvando(false)
    if (falha) return setErro('Erro ao salvar: ' + falha.message)
    await registrarLog(editando ? `${tipo} alterada` : recorrente ? `${tipo} recorrente criada` : `Nova ${tipo.toLowerCase()}`, 'movimentacoes', movimento?.id, descricao.trim())
    onSalvo()
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onFechar}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <h2 className={`text-section-title ${entrada ? 'text-green-700' : 'text-red-700'}`}>{editando ? 'Editar' : 'Nova'} {entrada ? 'entrada' : 'saída'}</h2>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-600" title="Fechar"><X size={18} /></button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Categoria">
            <select className={caixa} value={categoria} onChange={e => escolherCategoria(e.target.value)}>
              <option value="">{nomes.length ? 'Escolha a categoria' : 'Nenhuma categoria cadastrada'}</option>
              {nomes.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Subcategoria">
            <select className={caixa} value={categoriaId} onChange={e => setCategoriaId(e.target.value)} disabled={!categoria || subs.length === 0}>
              <option value="">{categoria && subs.length === 0 ? 'Sem subcategoria' : 'Escolha a subcategoria'}</option>
              {subs.map(c => <option key={c.id} value={c.id}>{c.subcategoria}</option>)}
            </select>
          </Campo>

          <Campo rotulo="Descrição" cheio>
            <input className={caixa} maxLength={200} value={descricao} onChange={e => setDescricao(e.target.value)} />
          </Campo>

          <Campo rotulo={entrada ? 'Cliente' : 'Fornecedor'}>
            <select className={caixa} value={pessoaId} onChange={e => setPessoaId(e.target.value)}>
              <option value="">Não informado</option>
              {catalogos.pessoas.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Valor (R$)">
            <input className={caixa} inputMode="numeric" value={valor ? formatarValor(valor) : ''} placeholder="0,00" onChange={e => setValor(e.target.value.replace(/\D/g, ''))} />
          </Campo>

          <Campo rotulo="Aluno">
            <select className={caixa} value={alunoId} onChange={e => escolherAluno(e.target.value)}>
              <option value="">Nenhum</option>
              {catalogos.alunos.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Professor">
            <select className={caixa} value={professorId} onChange={e => setProfessorId(e.target.value)}>
              <option value="">Nenhum</option>
              {catalogos.professores.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </Campo>

          <Campo rotulo="Esporte">
            <select className={caixa} value={esporteId} onChange={e => setEsporteId(e.target.value)}>
              <option value="">Nenhum</option>
              {catalogos.esportes.map(x => <option key={x.id} value={x.id}>{x.nome}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Banco">
            <select className={caixa} value={bancoId} onChange={e => setBancoId(e.target.value)}>
              <option value="">Nenhum</option>
              {catalogos.bancos.map(b => <option key={b.id} value={b.id}>{b.nome}</option>)}
            </select>
          </Campo>

          <Campo rotulo="Meio de pagamento" cheio>
            <Seg opcoes={FORMAS} atual={forma} aoMudar={setForma} cor={cor} />
          </Campo>
          <Campo rotulo={entrada ? 'Recebido?' : 'Pago?'}>
            <Seg
              opcoes={entrada ? [{ valor: 'nao', rotulo: 'Não' }, { valor: 'sim', rotulo: 'Sim' }] : [{ valor: 'nao', rotulo: 'A pagar' }, { valor: 'sim', rotulo: 'Pago' }]}
              atual={feito ? 'sim' : 'nao'} aoMudar={v => setFeito(v === 'sim')} cor={cor}
            />
          </Campo>

          <Campo rotulo={podeRecorrer && recorrente ? 'Mês de início (data do 1º vencimento)' : 'Vencimento'}>
            <input type="date" className={caixa} value={vencimento} onChange={e => setVencimento(e.target.value)} />
          </Campo>
          {feito && (
            <Campo rotulo="Data do pagamento">
              <input type="date" className={caixa} value={dataPag} onChange={e => setDataPag(e.target.value)} />
            </Campo>
          )}

          <Campo rotulo="De que conta" cheio>
            {catalogos.contas.length === 0
              ? <span className="text-sm text-amber-700">Nenhuma conta cadastrada nesta unidade (Cadastros → Contas)</span>
              : <Seg opcoes={catalogos.contas.map(c => ({ valor: c.id, rotulo: c.nome }))} atual={contaId} aoMudar={setContaId} cor={cor} />}
          </Campo>

          {podeRecorrer && (
            <div className="col-span-2 border-t border-gray-100 pt-3 grid gap-3">
              <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer w-fit">
                <input
                  type="checkbox" className="h-[18px] w-[18px] accent-blue-600" checked={recorrente}
                  onChange={e => { setRecorrente(e.target.checked); if (e.target.checked && !recDia) setRecDia(String(Number(vencimento.slice(8, 10)) || 1)) }}
                />
                Conta recorrente (repete todo mês)
              </label>
              {recorrente && (
                <div className="grid grid-cols-2 gap-3">
                  <Campo rotulo="Dia da cobrança (1 a 31)">
                    <input className={caixa} type="number" min={1} max={31} inputMode="numeric" value={recDia} onChange={e => setRecDia(e.target.value)} />
                  </Campo>
                  <Campo rotulo="Meses de recorrência">
                    <input className={caixa} type="number" min={2} max={60} inputMode="numeric" value={recMeses} onChange={e => setRecMeses(e.target.value)} />
                  </Campo>
                  <p className="col-span-2 text-sm text-gray-500">
                    Cria um lançamento por mês, com o mesmo valor, todo dia {recDia || '…'}, a partir do mês acima. Nos meses mais curtos, vale o último dia do mês.
                    {feito ? ' O primeiro fica como ' + (entrada ? 'recebido' : 'pago') + '; os outros, em aberto.' : ''}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {erro && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onFechar} className="h-10 px-4 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Cancelar</button>
          <button onClick={salvar} disabled={salvando} className="h-10 px-5 text-sm bg-[#7DC421] text-white font-medium rounded-lg hover:bg-[#6ab01a] disabled:opacity-50">{salvando ? 'Salvando...' : 'Salvar'}</button>
        </div>
      </div>
    </div>
  )
}
