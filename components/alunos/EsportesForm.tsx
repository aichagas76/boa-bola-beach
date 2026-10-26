'use client'

import { mascaraValor, ESPORTE_COM_COMBO, MAX_AULAS_POR_ESPORTE, type EstadoEsporte } from '@/lib/esportes'
import type { Unidade } from '@/lib/esportes-db'

function Chave({ ligado, onChange, rotulo }: { ligado: boolean; onChange: (v: boolean) => void; rotulo: string }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer" aria-label={rotulo}>
      <div className="relative">
        <input type="checkbox" className="sr-only" checked={ligado} onChange={e => onChange(e.target.checked)} />
        <div className={`w-9 h-5 rounded-full transition-colors ${ligado ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
        <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${ligado ? 'translate-x-4' : ''}`}></div>
      </div>
    </label>
  )
}

function CampoValor({ valor, onChange, placeholder }: { valor: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="flex items-center border border-gray-200 rounded-lg bg-white">
      <span className="px-3 py-2 text-sm text-gray-600 font-semibold">R$</span>
      <input
        inputMode="decimal"
        className="flex-1 min-w-0 border-0 px-0 py-2 text-sm bg-transparent"
        placeholder={placeholder}
        value={valor}
        onChange={e => onChange(mascaraValor(e.target.value))}
      />
    </div>
  )
}

type Props = {
  estados: EstadoEsporte[]
  onChange: (estados: EstadoEsporte[]) => void
  unidades: Unidade[] // só as que este login pode usar
  professores: { id: string; nome: string }[]
}

/** Esporte (liga/desliga) -> modalidades Clubinho, Aulas e Ranking, cada uma com o seu valor mensal. */
export default function EsportesForm({ estados, onChange, unidades, professores }: Props) {
  function atualizar(i: number, mudar: (e: EstadoEsporte) => EstadoEsporte) {
    onChange(estados.map((e, idx) => (idx === i ? mudar(e) : e)))
  }

  return (
    <div className="space-y-4">
      {estados.map((e, i) => (
        <div key={e.esporteId} className="border border-gray-200 rounded-lg">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm font-medium text-gray-900">🎾 {e.nome}</span>
            <Chave ligado={e.ativo} rotulo={`Aluno pratica ${e.nome}`} onChange={v => atualizar(i, x => ({ ...x, ativo: v }))} />
          </div>

          {e.ativo && (
            <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
              {unidades.length > 1 && (
                <div>
                  <label className="text-label text-gray-500 block mb-1">Unidade onde pratica</label>
                  <select
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                    value={e.unidadeId}
                    onChange={ev => atualizar(i, x => ({ ...x, unidadeId: ev.target.value }))}
                  >
                    {unidades.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
                  </select>
                </div>
              )}

              {/* Clubinho */}
              <div className="rounded-lg bg-gray-50 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-900">🏆 Clubinho</span>
                  <Chave ligado={e.clubinho.ativo} rotulo={`Clubinho de ${e.nome}`}
                    onChange={v => atualizar(i, x => ({ ...x, clubinho: { ...x.clubinho, ativo: v } }))} />
                </div>
                {e.clubinho.ativo && (
                  <div className="mt-3 space-y-2">
                    <label className="text-label text-gray-500 block">Valor mensal</label>
                    <CampoValor valor={e.clubinho.valor} placeholder="150,00"
                      onChange={v => atualizar(i, x => ({ ...x, clubinho: { ...x.clubinho, valor: v } }))} />
                    {e.nome === ESPORTE_COM_COMBO && unidades.length > 0 && (
                      <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                        <input type="checkbox" checked={e.clubinho.combo}
                          onChange={ev => atualizar(i, x => ({ ...x, clubinho: { ...x.clubinho, combo: ev.target.checked } }))} />
                        Combo: pode usar o Clubinho nas duas unidades
                      </label>
                    )}
                  </div>
                )}
              </div>

              {/* Aulas */}
              <div className="rounded-lg bg-gray-50 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-900">🎓 Aulas</span>
                  <Chave ligado={e.aulas.ativo} rotulo={`Aulas de ${e.nome}`}
                    onChange={v => atualizar(i, x => ({ ...x, aulas: { ...x.aulas, ativo: v } }))} />
                </div>
                {e.aulas.ativo && (
                  <div className="mt-3 space-y-3">
                    {e.aulas.lista.map((aula, k) => (
                      <div key={k} className="relative rounded-lg bg-white border border-gray-100 p-3">
                        <div className="text-th text-gray-400 mb-2">Aula {k + 1}</div>
                        {k > 0 && (
                          <button type="button" className="absolute top-3 right-3 text-red-400 hover:text-red-600 text-sm"
                            onClick={() => atualizar(i, x => ({ ...x, aulas: { ...x.aulas, lista: x.aulas.lista.filter((_, idx) => idx !== k) } }))}>✕</button>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-label text-gray-500 block mb-1">Professor</label>
                            <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white" value={aula.professor}
                              onChange={ev => atualizar(i, x => ({ ...x, aulas: { ...x.aulas, lista: x.aulas.lista.map((a, idx) => idx === k ? { ...a, professor: ev.target.value } : a) } }))}>
                              <option value="">Selecionar professor</option>
                              {professores.map(p => <option key={p.id} value={p.nome}>{p.nome}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="text-label text-gray-500 block mb-1">Valor mensal</label>
                            <CampoValor valor={aula.valor} placeholder="180,00"
                              onChange={v => atualizar(i, x => ({ ...x, aulas: { ...x.aulas, lista: x.aulas.lista.map((a, idx) => idx === k ? { ...a, valor: v } : a) } }))} />
                          </div>
                        </div>
                      </div>
                    ))}
                    {e.aulas.lista.length < MAX_AULAS_POR_ESPORTE && (
                      <button type="button" className="w-full border border-dashed border-blue-300 text-blue-600 text-sm py-2 rounded-lg hover:bg-blue-50"
                        onClick={() => atualizar(i, x => ({ ...x, aulas: { ...x.aulas, lista: [...x.aulas.lista, { id: null, tipo: 'Aula', professor: '', valor: '' }] } }))}>
                        + Adicionar outra aula
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Ranking */}
              <div className="rounded-lg bg-gray-50 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-900">🥇 Ranking</span>
                  <Chave ligado={e.ranking.ativo} rotulo={`Ranking de ${e.nome}`}
                    onChange={v => atualizar(i, x => ({ ...x, ranking: { ...x.ranking, ativo: v } }))} />
                </div>
                {e.ranking.ativo && (
                  <div className="mt-3">
                    <label className="text-label text-gray-500 block mb-1">Valor mensal</label>
                    <CampoValor valor={e.ranking.valor} placeholder="50,00"
                      onChange={v => atualizar(i, x => ({ ...x, ranking: { ...x.ranking, valor: v } }))} />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
