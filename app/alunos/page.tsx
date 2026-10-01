'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

type Aluno = {
  id: string
  nome: string
  celular: string
  cpf: string
  status: string
  data_vencimento: string
  valor_total: number
  modalidades: string[]
  ultimo_pagamento: string | null
  pago_mes: number
}

type Matricula = {
  id: string
  tipo: string
  valor: number
  professor_nome: string | null
  professor_id: string | null
}

export default function Alunos() {
  const [alunos, setAlunos] = useState<Aluno[]>([])
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState('Todos')
  const [loading, setLoading] = useState(true)
  const [sortConfig, setSortConfig] = useState<{ column: 'nome' | 'data_vencimento' | 'valor_total', direction: 'asc' | 'desc' }>({ column: 'nome', direction: 'asc' })

  // Modal pagamento
  const [modalAberto, setModalAberto] = useState(false)
  const [alunoModal, setAlunoModal] = useState<Aluno | null>(null)
  const [matriculasModal, setMatriculasModal] = useState<Matricula[]>([])
  const [formPgto, setFormPgto] = useState({
    forma_pagamento: 'Pix',
    data_pagamento: new Date().toLocaleDateString('en-CA'),
  })
  const [salvandoPgto, setSalvandoPgto] = useState(false)
  const [valorParcial, setValorParcial] = useState('')

  function mascaraValor(v: string) {
    v = v.replace(/\D/g, '')
    if (!v) return ''
    return (parseInt(v) / 100).toFixed(2).replace('.', ',')
  }

  async function carregar() {
    setLoading(true)

    const { data: alunosData } = await supabase
      .from('alunos')
      .select('id, nome, celular, cpf, status, data_vencimento')
      .order('nome')

    const { data: matriculasData } = await supabase
      .from('matriculas')
      .select('aluno_id, tipo, valor')

    const { data: pagamentosData } = await supabase
      .from('movimentacoes')
      .select('aluno_ref_id, data_pagamento, valor')
      .eq('tipo', 'Entrada')
      .eq('status', 'Recebido')
      .not('aluno_ref_id', 'is', null)
      .order('data_pagamento', { ascending: false })

    const mesAtual = new Date().toLocaleDateString('en-CA').substring(0, 7)

    // Último pagamento e soma paga no mês por aluno
    const ultimoPorAluno: Record<string, string> = {}
    const pagoMesPorAluno: Record<string, number> = {}
    for (const p of (pagamentosData ?? [])) {
      if (!p.aluno_ref_id) continue
      if (!ultimoPorAluno[p.aluno_ref_id]) {
        ultimoPorAluno[p.aluno_ref_id] = p.data_pagamento
      }
      if (p.data_pagamento?.startsWith(mesAtual)) {
        pagoMesPorAluno[p.aluno_ref_id] = (pagoMesPorAluno[p.aluno_ref_id] ?? 0) + (p.valor ?? 0)
      }
    }

    const alunos = (alunosData ?? []).map(a => {
      const mats = (matriculasData ?? []).filter(m => m.aluno_id === a.id)
      const valor_total = mats.reduce((acc, m) => acc + (m.valor ?? 0), 0)
      const modalidades = mats.map(m => m.tipo)
      return { ...a, valor_total, modalidades, ultimo_pagamento: ultimoPorAluno[a.id] ?? null, pago_mes: pagoMesPorAluno[a.id] ?? 0 }
    })

    setAlunos(alunos)
    setLoading(false)
  }

  useEffect(() => { carregar() }, [])

  async function abrirModal(aluno: Aluno) {
    const { data } = await supabase
      .from('matriculas')
      .select('id, tipo, valor, professor_nome, professor_id')
      .eq('aluno_id', aluno.id)

    const mats = data ?? []
    const total = mats.reduce((acc, m) => acc + (m.valor ?? 0), 0)

    // Soma pagamentos já feitos no mês atual para este aluno
    const mesAtual = new Date().toLocaleDateString('en-CA').substring(0, 7) // YYYY-MM
    const { data: pgtos } = await supabase
      .from('movimentacoes')
      .select('valor')
      .eq('aluno_ref_id', aluno.id)
      .eq('status', 'Recebido')
      .gte('data_pagamento', `${mesAtual}-01`)
      .lte('data_pagamento', `${mesAtual}-31`)

    const jaPago = (pgtos ?? []).reduce((acc, p) => acc + (p.valor ?? 0), 0)
    const restante = Math.max(total - jaPago, 0)

    setMatriculasModal(mats)
    setAlunoModal(aluno)
    setFormPgto({ forma_pagamento: 'Pix', data_pagamento: new Date().toLocaleDateString('en-CA') })
    setValorParcial(restante.toFixed(2).replace('.', ','))
    setModalAberto(true)
  }

  async function confirmarPagamento() {
    if (!alunoModal) return
    if (matriculasModal.length === 0) return alert('Este aluno não tem matrículas cadastradas.')
    setSalvandoPgto(true)

    // Busca categorias (subcategoria IS NULL para pegar a categoria raiz)
    const { data: catClubinho } = await supabase
      .from('categorias_financeiro')
      .select('id')
      .eq('categoria', 'Clubinho')
      .eq('tipo', 'Entrada')
      .is('subcategoria', null)
      .limit(1)

    const { data: catAula } = await supabase
      .from('categorias_financeiro')
      .select('id')
      .eq('categoria', 'Aula BT')
      .eq('tipo', 'Entrada')
      .is('subcategoria', null)
      .limit(1)

    const catClubinhoId = catClubinho?.[0]?.id ?? null
    const catAulaId = catAula?.[0]?.id ?? null

    const totalMats = matriculasModal.reduce((acc, m) => acc + (m.valor ?? 0), 0)
    const valorPago = parseFloat(valorParcial.replace(',', '.')) || 0
    const isParcial = valorPago < totalMats

    if (isParcial) {
      // Pagamento parcial — um único lançamento com o valor digitado
      const { error } = await supabase.from('movimentacoes').insert({
        tipo: 'Entrada',
        descricao: `Pagamento parcial - ${alunoModal.nome}`,
        valor: valorPago,
        forma_pagamento: formPgto.forma_pagamento,
        data_pagamento: formPgto.data_pagamento,
        data_vencimento: alunoModal.data_vencimento || null,
        data: formPgto.data_pagamento,
        status: 'Recebido',
        aluno_ref_id: alunoModal.id,
        professor_id: null,
        origem: 'Manual',
        categoria_id: catClubinhoId ?? catAulaId,
      })
      if (error) { alert('Erro ao lançar: ' + error.message); setSalvandoPgto(false); return }

      // Distribui o valor pago pelas matrículas em ordem
      let restante = valorPago
      for (const mat of matriculasModal) {
        if (restante <= 0) break
        const novoValor = parseFloat(Math.max(mat.valor - restante, 0).toFixed(2))
        restante = parseFloat((restante - mat.valor).toFixed(2))
        await supabase.from('matriculas').update({ valor: novoValor }).eq('id', mat.id)
      }
    } else {
      // Pagamento total — lançamento por matrícula
      for (const mat of matriculasModal) {
        let professor_id: string | null = null
        if (mat.professor_nome) {
          const { data: prof } = await supabase
            .from('professores').select('id').eq('nome', mat.professor_nome).limit(1)
          professor_id = prof?.[0]?.id ?? null
        }

        const isClubinho = mat.tipo === 'Clubinho'
        const categoria_id = isClubinho ? catClubinhoId : catAulaId
        const descricao = isClubinho
          ? `Mensalidade Clubinho - ${alunoModal.nome}`
          : `Mensalidade Aula - ${alunoModal.nome}${mat.professor_nome ? ' - Prof. ' + mat.professor_nome : ''}`

        const { error } = await supabase.from('movimentacoes').insert({
          tipo: 'Entrada',
          descricao,
          valor: mat.valor,
          forma_pagamento: formPgto.forma_pagamento,
          data_pagamento: formPgto.data_pagamento,
          data_vencimento: alunoModal.data_vencimento || null,
          data: formPgto.data_pagamento,
          status: 'Recebido',
          aluno_ref_id: alunoModal.id,
          professor_id,
          origem: 'Manual',
          categoria_id,
        })
        if (error) { alert('Erro ao lançar: ' + error.message); setSalvandoPgto(false); return }
      }
    }

    // Avança data_vencimento +1 mês apenas no pagamento total
    if (!isParcial && alunoModal.data_vencimento) {
      const venc = new Date(alunoModal.data_vencimento + 'T00:00:00')
      venc.setMonth(venc.getMonth() + 1)
      const novaData = venc.toISOString().split('T')[0]
      await supabase.from('alunos').update({ data_vencimento: novaData }).eq('id', alunoModal.id)
    }

    setSalvandoPgto(false)
    setModalAberto(false)
    setAlunoModal(null)
    carregar()
  }

  const filtrados = sortAlunos(alunos.filter(a => {
    const matchBusca = a.nome?.toLowerCase().includes(busca.toLowerCase()) ||
      a.cpf?.includes(busca) ||
      a.celular?.includes(busca)
    const matchFiltro = filtro === 'Todos' || a.status === filtro
    return matchBusca && matchFiltro
  }))

  const contadores = {
    Todos: alunos.length,
    Ativo: alunos.filter(a => a.status === 'Ativo').length,
    Inativo: alunos.filter(a => a.status === 'Inativo').length,
  }

  function iconeModalidade(modalidades: string[]) {
    const temClubinho = modalidades.includes('Clubinho')
    const temAula = modalidades.includes('Aula')
    if (temClubinho && temAula) return '🏆🎓'
    if (temClubinho) return '🏆'
    if (temAula) return '🎓'
    return '-'
  }

  function mascaraCelular(v: string) {
    v = v.replace(/\D/g, '').slice(0, 11)
    if (v.length > 6) v = v.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3')
    else if (v.length > 2) v = v.replace(/(\d{2})(\d{0,5})/, '($1) $2')
    return v
  }

  function handleSort(column: 'nome' | 'data_vencimento' | 'valor_total') {
    setSortConfig(prev => ({
      column,
      direction: prev.column === column && prev.direction === 'asc' ? 'desc' : 'asc'
    }))
  }

  function sortAlunos(lista: Aluno[]) {
    return [...lista].sort((a, b) => {
      let aVal: any = a[sortConfig.column]
      let bVal: any = b[sortConfig.column]
      if (sortConfig.column === 'nome') {
        aVal = (aVal || '').toLowerCase()
        bVal = (bVal || '').toLowerCase()
      }
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1
      return 0
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-medium text-gray-900">Alunos</h1>
        <Link
          href="/alunos/novo"
          className="flex items-center gap-2 bg-[#7DC421] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#6ab01a] transition-colors"
        >
          + Novo aluno
        </Link>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <input
          type="text"
          placeholder="Buscar por nome, CPF ou celular..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#7DC421]"
        />
      </div>

      <div className="flex gap-2 mb-4">
        {(['Todos', 'Ativo', 'Inativo'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={`px-4 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              filtro === f
                ? 'bg-[#7DC421] text-white border-[#7DC421]'
                : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {f} ({contadores[f as keyof typeof contadores] ?? alunos.length})
          </button>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th onClick={() => handleSort('nome')} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide cursor-pointer hover:bg-gray-100 transition-colors">
                Nome {sortConfig.column === 'nome' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Celular</th>
              <th onClick={() => handleSort('data_vencimento')} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide cursor-pointer hover:bg-gray-100 transition-colors">
                Vencimento {sortConfig.column === 'data_vencimento' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Últ. Pagamento</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Modalidade</th>
              <th onClick={() => handleSort('valor_total')} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide cursor-pointer hover:bg-gray-100 transition-colors">
                Valor {sortConfig.column === 'valor_total' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Pago</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={9} className="text-center py-8 text-gray-400">Carregando...</td></tr>
            )}
            {!loading && filtrados.length === 0 && (
              <tr><td colSpan={9} className="text-center py-8 text-gray-400">Nenhum aluno encontrado.</td></tr>
            )}
            {filtrados.map((aluno, i) => (
              <tr key={aluno.id} className={`border-b border-gray-100 hover:bg-gray-50 ${i === filtrados.length - 1 ? 'border-0' : ''}`}>
                <td className="px-4 py-3 font-medium text-gray-900">{aluno.nome}</td>
                <td className="px-4 py-3 text-gray-600">
                  <a href={`https://wa.me/55${aluno.celular.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="#25D366">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    {mascaraCelular(aluno.celular)}
                  </a>
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {aluno.data_vencimento ? new Date(aluno.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
                </td>
                <td className="px-4 py-3 text-gray-600 text-xs">
                  {aluno.ultimo_pagamento ? new Date(aluno.ultimo_pagamento + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
                </td>
                <td className="px-4 py-3 text-lg">{iconeModalidade(aluno.modalidades)}</td>
                <td className="px-4 py-3 text-gray-600">
                  {aluno.valor_total > 0 ? `R$ ${aluno.valor_total.toFixed(2).replace('.', ',')}` : '-'}
                </td>
                <td className="px-4 py-3 text-xs font-medium">
                  {aluno.pago_mes >= aluno.valor_total && aluno.pago_mes > 0 ? (
                    <span className="text-green-600">✓ R$ {aluno.pago_mes.toFixed(2).replace('.', ',')}</span>
                  ) : aluno.pago_mes > 0 ? (
                    <span className="text-yellow-600">R$ {aluno.pago_mes.toFixed(2).replace('.', ',')}</span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                    aluno.status === 'Ativo' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {aluno.status}
                  </span>
                </td>
                <td className="px-4 py-3 flex items-center gap-2">
                  <button
                    onClick={() => abrirModal(aluno)}
                    title="Registrar pagamento"
                    className="text-lg hover:scale-110 transition-transform"
                  >
                    💰
                  </button>
                  <Link href={`/alunos/${aluno.id}`} className="text-xs text-blue-600 hover:underline">
                    Ver
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal pagamento */}
      {modalAberto && alunoModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Registrar pagamento</h2>
              <p className="text-sm text-gray-500 mt-1">{alunoModal.nome}</p>
            </div>

            <div className="p-6 space-y-4">
              {/* Matrículas */}
              <div>
                <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Matrículas</div>
                {matriculasModal.length === 0 ? (
                  <p className="text-sm text-gray-400">Nenhuma matrícula encontrada.</p>
                ) : (
                  <div className="space-y-2">
                    {matriculasModal.map(m => (
                      <div key={m.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                        <div>
                          <span className="text-sm font-medium text-gray-800">{m.tipo}</span>
                          {m.professor_nome && (
                            <span className="text-xs text-gray-500 ml-2">— {m.professor_nome}</span>
                          )}
                        </div>
                        <span className="text-sm font-semibold text-[#7DC421]">
                          R$ {m.valor.toFixed(2).replace('.', ',')}
                        </span>
                      </div>
                    ))}
                    <div className="flex justify-between pt-1 border-t border-gray-100">
                      <span className="text-xs font-medium text-gray-500">Total</span>
                      <span className="text-sm font-bold text-gray-900">
                        R$ {matriculasModal.reduce((acc, m) => acc + m.valor, 0).toFixed(2).replace('.', ',')}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Valor pago */}
              {matriculasModal.length > 0 && (
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Valor pago</label>
                  <input
                    type="text"
                    value={valorParcial}
                    onChange={e => setValorParcial(mascaraValor(e.target.value))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    placeholder="0,00"
                  />
                  {(() => {
                    const total = matriculasModal.reduce((acc, m) => acc + m.valor, 0)
                    const pago = parseFloat(valorParcial.replace(',', '.')) || 0
                    if (pago > 0 && pago < total) {
                      return <p className="text-xs text-yellow-600 mt-1">Pagamento parcial — R$ {(total - pago).toFixed(2).replace('.', ',')} restante</p>
                    }
                    if (pago >= total) {
                      return <p className="text-xs text-green-600 mt-1">✓ Pagamento total</p>
                    }
                    return null
                  })()}
                </div>
              )}

              {/* Forma de pagamento */}
              <div>
                <label className="text-xs text-gray-500 block mb-1">Meio de pagamento</label>
                <select
                  value={formPgto.forma_pagamento}
                  onChange={e => setFormPgto({ ...formPgto, forma_pagamento: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                >
                  <option>Pix</option>
                  <option>Dinheiro</option>
                  <option>Cartão Débito</option>
                  <option>Cartão Crédito</option>
                  <option>Transferência</option>
                </select>
              </div>

              {/* Data de pagamento */}
              <div>
                <label className="text-xs text-gray-500 block mb-1">Data de pagamento</label>
                <input
                  type="date"
                  value={formPgto.data_pagamento}
                  onChange={e => setFormPgto({ ...formPgto, data_pagamento: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => { setModalAberto(false); setAlunoModal(null) }}
                className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarPagamento}
                disabled={salvandoPgto || matriculasModal.length === 0}
                className="px-4 py-2 text-sm bg-[#7DC421] text-white rounded-lg hover:bg-[#6ab01a] disabled:opacity-50"
              >
                {salvandoPgto ? 'Salvando...' : 'Confirmar Pagamento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
