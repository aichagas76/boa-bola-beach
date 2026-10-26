'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Trash2 } from 'lucide-react'
import IconeEsporte from '@/components/alunos/IconeEsporte'

type Modalidade = { id: string; nome: string; ativo: boolean }
type Esporte = { id: string; nome: string }

// Têm tela própria no cadastro do aluno (combo, professor); podem ser desativadas, mas não apagadas
const FIXAS = ['Clubinho', 'Aula', 'Ranking']

export default function Modalidades() {
  const [lista, setLista] = useState<Modalidade[]>([])
  const [esportes, setEsportes] = useState<Esporte[]>([])
  const [vinculos, setVinculos] = useState<Set<string>>(new Set()) // "modalidadeId|esporteId"
  const [semVinculos, setSemVinculos] = useState(false)
  const [loading, setLoading] = useState(true)
  const [novoNome, setNovoNome] = useState('')
  const [novosEsportes, setNovosEsportes] = useState<string[] | null>(null) // null = todos

  async function carregar() {
    setLoading(true)
    const [m, e, v] = await Promise.all([
      supabase.from('modalidades').select('id, nome, ativo').order('nome'),
      supabase.from('esportes').select('id, nome').eq('ativo', true).order('nome'),
      supabase.from('modalidade_esportes').select('modalidade_id, esporte_id'),
    ])
    setLista(m.data ?? [])
    setEsportes(e.data ?? [])
    setSemVinculos(!!v.error)
    setVinculos(new Set((v.data ?? []).map(x => `${x.modalidade_id}|${x.esporte_id}`)))
    setLoading(false)
  }

  useEffect(() => {
    carregar()
  }, [])

  function mensagemDeErro(error: { code?: string; message: string }) {
    return error.code === '23505' ? 'Já existe uma modalidade com este nome.' : 'Erro: ' + error.message
  }

  const escolhidosNovos = novosEsportes ?? esportes.map(x => x.id)

  async function adicionar() {
    if (!novoNome.trim()) return
    const { data, error } = await supabase.from('modalidades').insert({ nome: novoNome.trim() }).select('id').single()
    if (error || !data) return alert(mensagemDeErro(error ?? { message: 'não consegui criar' }))
    if (!semVinculos && escolhidosNovos.length > 0) {
      const { error: e2 } = await supabase.from('modalidade_esportes').insert(escolhidosNovos.map(esporte_id => ({ modalidade_id: data.id, esporte_id })))
      if (e2) alert('Modalidade criada, mas não consegui ligar aos esportes: ' + e2.message)
    }
    setNovoNome('')
    setNovosEsportes(null)
    carregar()
  }

  async function alternar(m: Modalidade) {
    const { error } = await supabase.from('modalidades').update({ ativo: !m.ativo }).eq('id', m.id)
    if (error) return alert(mensagemDeErro(error))
    carregar()
  }

  async function alternarEsporte(m: Modalidade, esporteId: string) {
    const chave = `${m.id}|${esporteId}`
    const tem = vinculos.has(chave)
    const { error } = tem
      ? await supabase.from('modalidade_esportes').delete().eq('modalidade_id', m.id).eq('esporte_id', esporteId)
      : await supabase.from('modalidade_esportes').insert({ modalidade_id: m.id, esporte_id: esporteId })
    if (error) return alert(mensagemDeErro(error))
    setVinculos(v => {
      const novo = new Set(v)
      if (tem) novo.delete(chave)
      else novo.add(chave)
      return novo
    })
  }

  async function deletar(m: Modalidade) {
    const { count } = await supabase.from('matriculas').select('id', { count: 'exact', head: true }).eq('tipo', m.nome)
    if ((count ?? 0) > 0) {
      return alert(`Há ${count} matrícula(s) de alunos nesta modalidade. Para ela sumir do cadastro, deixe-a inativa em vez de excluir.`)
    }
    if (!confirm(`Excluir a modalidade ${m.nome}?`)) return
    const { error } = await supabase.from('modalidades').delete().eq('id', m.id)
    if (error) return alert(mensagemDeErro(error))
    carregar()
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-page-title text-gray-900 mb-2">Modalidades</h1>
      <p className="text-sm text-gray-500 mb-6">
        Escolha a que esportes cada modalidade se aplica. No cadastro do aluno, cada esporte mostra só as modalidades ativas que valem para ele.
        Ao inativar ou tirar um esporte, as matrículas que os alunos já têm continuam guardadas.
      </p>

      {semVinculos && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          A escolha de esportes por modalidade ainda não está ativada no banco. Enquanto isso, todas as modalidades valem para todos os esportes.
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
        <div className="flex gap-3">
          <input
            type="text"
            value={novoNome}
            onChange={e => setNovoNome(e.target.value)}
            className="flex-1 h-10 border border-gray-200 rounded-lg px-3 text-sm"
            placeholder="Nome da modalidade (ex: Day Use, Torneio...)"
            onKeyDown={e => e.key === 'Enter' && adicionar()}
          />
          <button onClick={adicionar} className="h-10 px-4 text-sm bg-[#7DC421] text-white rounded-lg hover:bg-[#6ab01a]">
            + Adicionar
          </button>
        </div>
        {!semVinculos && novoNome.trim() && (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-700">
            <span className="text-gray-500">Vale para:</span>
            {esportes.map(e => (
              <label key={e.id} className="inline-flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" className="h-[18px] w-[18px] accent-blue-600" checked={escolhidosNovos.includes(e.id)}
                  onChange={ev => setNovosEsportes(ev.target.checked ? [...escolhidosNovos, e.id] : escolhidosNovos.filter(x => x !== e.id))} />
                <IconeEsporte nome={e.nome} tamanho={16} /> {e.nome}
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        {loading ? (
          <div className="text-center py-8 text-gray-400">Carregando...</div>
        ) : lista.length === 0 ? (
          <div className="text-center py-8 text-gray-400">Nenhuma modalidade cadastrada</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-th text-gray-500">Modalidade</th>
                <th className="text-left px-4 py-3 text-th text-gray-500 w-32">Ativa</th>
                <th className="text-left px-4 py-3 text-th text-gray-500">Vale para os esportes</th>
                <th className="text-left px-4 py-3 text-th text-gray-500 w-20">Ações</th>
              </tr>
            </thead>
            <tbody>
              {lista.map(m => (
                <tr key={m.id} className="border-b border-gray-100 hover:bg-gray-50 align-middle">
                  <td className="px-4 py-3 text-gray-900">
                    {m.nome === 'Aula' ? 'Aula (aparece como "Aulas")' : m.nome}
                  </td>
                  <td className="px-4 py-3">
                    <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                      <div className="relative">
                        <input type="checkbox" className="sr-only" checked={m.ativo} onChange={() => alternar(m)} />
                        <div className={`w-9 h-5 rounded-full transition-colors ${m.ativo ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                        <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${m.ativo ? 'translate-x-4' : ''}`}></div>
                      </div>
                      <span className={`text-xs font-medium ${m.ativo ? 'text-green-700' : 'text-gray-500'}`}>{m.ativo ? 'Ativa' : 'Inativa'}</span>
                    </label>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {esportes.map(e => {
                        const vale = semVinculos || vinculos.has(`${m.id}|${e.id}`)
                        return (
                          <button key={e.id} type="button" disabled={semVinculos} onClick={() => alternarEsporte(m, e.id)}
                            title={vale ? `Vale para ${e.nome} (clique para tirar)` : `Não vale para ${e.nome} (clique para incluir)`}
                            className={`inline-flex items-center gap-1.5 h-8 pl-1.5 pr-2.5 rounded-full border text-xs font-medium transition-colors ${
                              vale ? 'border-blue-200 bg-blue-50 text-blue-900' : 'border-gray-200 bg-white text-gray-400 hover:bg-gray-50'
                            }`}>
                            <span className={vale ? '' : 'opacity-40 grayscale'}><IconeEsporte nome={e.nome} tamanho={18} /></span>
                            {e.nome}
                          </button>
                        )
                      })}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {!FIXAS.includes(m.nome) && (
                      <button onClick={() => deletar(m)} className="text-red-600 hover:text-red-800" title="Excluir"><Trash2 size={16} /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
