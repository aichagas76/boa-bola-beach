'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Aluno = {
  id: string
  nome: string
  celular: string
  cpf: string
  sexo: string
  data_nascimento: string
  data_cadastro: string
  data_vencimento: string
  status: string
  observacao: string
}

type Matricula = {
  id: string
  tipo: string
  valor: number
  professor_nome: string
}

type Pagamento = {
  id: string
  data_vencimento: string | null
  valor: number
  status: string
  link_pagamento: string | null
}

export default function DetalheAluno() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [aluno, setAluno] = useState<Aluno | null>(null)
  const [matriculas, setMatriculas] = useState<Matricula[]>([])
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([])
  const [loading, setLoading] = useState(true)
  const [copiado, setCopiado] = useState<string | null>(null)

  useEffect(() => {
    async function carregar() {
      const { data: a } = await supabase
        .from('alunos')
        .select('*')
        .eq('id', id)
        .single()

      const { data: m } = await supabase
        .from('matriculas')
        .select('*')
        .eq('aluno_id', id)

      const { data: p } = await supabase
        .from('pagamentos')
        .select('*')
        .eq('aluno_id', id)
        .order('data_vencimento', { ascending: false })

      setAluno(a)
      setMatriculas(m ?? [])
      setPagamentos(p ?? [])
      setLoading(false)
    }
    carregar()
  }, [id])

  function copiarLink(link: string, id: string) {
    navigator.clipboard.writeText(link)
    setCopiado(id)
    setTimeout(() => setCopiado(null), 2000)
  }

  function corStatus(status: string) {
    if (status === 'Pago') return 'bg-green-50 text-green-700'
    if (status === 'Atrasado') return 'bg-red-50 text-red-700'
    return 'bg-yellow-50 text-yellow-700'
  }

  function formataData(d: string) {
    if (!d) return '-'
    return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')
  }

  if (loading) return <div className="text-gray-400 text-sm">Carregando...</div>
  if (!aluno) return <div className="text-gray-400 text-sm">Aluno não encontrado.</div>

  const clubinho = matriculas.find(m => m.tipo === 'Clubinho')
  const aulasList = matriculas.filter(m => m.tipo === 'Aula')

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700">← Voltar</button>
        <h1 className="text-xl font-medium text-gray-900">{aluno.nome}</h1>
        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${aluno.status === 'Ativo' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
          {aluno.status}
        </span>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-4">
        <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-4">Dados pessoais</div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-xs text-gray-500 mb-1">Celular</div>
            <div className="text-gray-900">{aluno.celular || '-'}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">CPF</div>
            <div className="text-gray-900">{aluno.cpf || '-'}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Sexo</div>
            <div className="text-gray-900">{aluno.sexo === 'M' ? 'Masculino' : aluno.sexo === 'F' ? 'Feminino' : '-'}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Data de nascimento</div>
            <div className="text-gray-900">{formataData(aluno.data_nascimento)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Data de cadastro</div>
            <div className="text-gray-900">{formataData(aluno.data_cadastro)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Data de vencimento</div>
            <div className="text-gray-900">{formataData(aluno.data_vencimento)}</div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-4">
        <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-4">Modalidades</div>

        {!clubinho && aulasList.length === 0 && (
          <div className="text-sm text-gray-400">Nenhuma modalidade cadastrada.</div>
        )}

        {clubinho && (
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <span className="text-sm font-medium text-gray-900">🏆 Clubinho</span>
            <span className="text-sm text-gray-600">R$ {clubinho.valor?.toFixed(2).replace('.', ',')}/mês</span>
          </div>
        )}

        {aulasList.map((aula, i) => (
          <div key={aula.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
            <div className="text-sm font-medium text-gray-900">
              🎓 Aula {aulasList.length > 1 ? i + 1 : ''}
              {aula.professor_nome && <span className="text-gray-400 font-normal ml-1">· {aula.professor_nome}</span>}
            </div>
            <span className="text-sm text-gray-600">R$ {aula.valor?.toFixed(2).replace('.', ',')}/mês</span>
          </div>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-4">
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="text-xs font-medium text-gray-400 uppercase tracking-wider">Pagamentos</div>
        </div>
        {pagamentos.length === 0 ? (
          <div className="px-6 py-4 text-sm text-gray-400">Nenhum pagamento encontrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Competência</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Vencimento</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Valor</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Link</th>
                </tr>
              </thead>
              <tbody>
                {pagamentos.map((p, i) => (
                  <tr key={p.id} className={`border-b border-gray-100 hover:bg-gray-50 ${i === pagamentos.length - 1 ? 'border-0' : ''}`}>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {p.data_vencimento
                        ? new Date(p.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
                        : '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {p.data_vencimento ? formataData(p.data_vencimento) : '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-800 font-medium text-xs">
                      R$ {p.valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) ?? '0,00'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${corStatus(p.status)}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {p.link_pagamento ? (
                        <button
                          onClick={() => copiarLink(p.link_pagamento!, p.id)}
                          className="text-blue-600 hover:underline"
                        >
                          {copiado === p.id ? '✓ Copiado' : '🔗 Copiar link'}
                        </button>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3">
        <button
          onClick={async () => {
            if (!confirm('Tem certeza que deseja excluir este aluno?')) return
            await supabase.from('matriculas').delete().eq('aluno_id', aluno.id)
            await supabase.from('alunos').delete().eq('id', aluno.id)
            router.push('/alunos')
          }}
          className="px-4 py-2 text-sm border border-red-200 rounded-lg text-red-600 hover:bg-red-50"
        >
          Excluir
        </button>
        <button
          onClick={() => router.push(`/alunos/${aluno.id}/editar`)}
          className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
        >
          Editar
        </button>
      </div>
    </div>
  )
}