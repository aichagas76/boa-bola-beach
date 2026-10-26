'use client'

import { mascaraValor, ESPORTE_COM_COMBO, MAX_AULAS_POR_ESPORTE, type EstadoEsporte } from '@/lib/esportes'

import IconeEsporte from '@/components/alunos/IconeEsporte'
import IconeModalidade from '@/components/alunos/IconeModalidade'

function CampoValor({ valor, onChange, placeholder }: { valor: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="flex items-center border border-gray-200 rounded-md bg-white w-32">
      <span className="pl-2 pr-1 text-sm text-gray-500">R$</span>
      <input
        inputMode="decimal"
        className="flex-1 min-w-0 border-0 px-1 py-1.5 text-sm bg-transparent focus:outline-none"
        placeholder={placeholder}
        value={valor}
        onChange={e => onChange(mascaraValor(e.target.value))}
      />
    </div>
  )
}

function Marca({ marcado, onChange, children }: { marcado: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer text-sm text-gray-900 min-w-[7.5rem]">
      <input type="checkbox" className="h-4 w-4 accent-[#7DC421]" checked={marcado} onChange={e => onChange(e.target.checked)} />
      {children}
    </label>
  )
}

type Props = {
  estados: EstadoEsporte[]
  onChange: (estados: EstadoEsporte[]) => void
  professores: { id: string; nome: string }[]
}

/** Os esportes numa linha só; ao marcar um, as modalidades dele abrem logo abaixo, também compactas. */
export default function EsportesForm({ estados, onChange, professores }: Props) {
  function atualizar(i: number, mudar: (e: EstadoEsporte) => EstadoEsporte) {
    onChange(estados.map((e, idx) => (idx === i ? mudar(e) : e)))
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {estados.map((e, i) => (
          <label
            key={e.esporteId}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm cursor-pointer select-none transition-colors ${
              e.ativo ? 'border-[#7DC421] bg-green-50 text-gray-900 font-medium' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            <input type="checkbox" className="h-4 w-4 accent-[#7DC421]" checked={e.ativo}
              onChange={ev => atualizar(i, x => ({ ...x, ativo: ev.target.checked }))} />
            <IconeEsporte nome={e.nome} tamanho={20} />
            <span>{e.nome}</span>
          </label>
        ))}
      </div>

      {estados.map((e, i) => !e.ativo ? null : (
        <div key={e.esporteId} className="mt-3 border border-gray-200 rounded-lg px-3 py-2.5">
          <div className="text-th text-gray-500 mb-2">{e.nome}</div>

          <div className="space-y-2">
            {/* Clubinho */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
              <Marca marcado={e.clubinho.ativo} onChange={v => atualizar(i, x => ({ ...x, clubinho: { ...x.clubinho, ativo: v } }))}><IconeModalidade tipo="Clubinho" /> Clubinho</Marca>
              {e.clubinho.ativo && (
                <>
                  <CampoValor valor={e.clubinho.valor} placeholder="150,00"
                    onChange={v => atualizar(i, x => ({ ...x, clubinho: { ...x.clubinho, valor: v } }))} />
                  {e.nome === ESPORTE_COM_COMBO && (
                    <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input type="checkbox" className="h-4 w-4 accent-[#7DC421]" checked={e.clubinho.combo}
                        onChange={ev => atualizar(i, x => ({ ...x, clubinho: { ...x.clubinho, combo: ev.target.checked } }))} />
                      Combo (Boa Bola 1 e 2)
                    </label>
                  )}
                </>
              )}
            </div>

            {/* Aulas */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
              <Marca marcado={e.aulas.ativo} onChange={v => atualizar(i, x => ({ ...x, aulas: { ...x.aulas, ativo: v } }))}><IconeModalidade tipo="Aula" /> Aulas</Marca>
              {e.aulas.ativo && (
                <div className="flex flex-col gap-1.5">
                  {e.aulas.lista.map((aula, k) => (
                    <div key={k} className="flex flex-wrap items-center gap-2">
                      <select className="border border-gray-200 rounded-md px-2 py-1.5 text-sm bg-white w-44" value={aula.professor}
                        onChange={ev => atualizar(i, x => ({ ...x, aulas: { ...x.aulas, lista: x.aulas.lista.map((a, idx) => idx === k ? { ...a, professor: ev.target.value } : a) } }))}>
                        <option value="">Professor</option>
                        {professores.map(p => <option key={p.id} value={p.nome}>{p.nome}</option>)}
                      </select>
                      <CampoValor valor={aula.valor} placeholder="180,00"
                        onChange={v => atualizar(i, x => ({ ...x, aulas: { ...x.aulas, lista: x.aulas.lista.map((a, idx) => idx === k ? { ...a, valor: v } : a) } }))} />
                      {k > 0 && (
                        <button type="button" title="Remover aula" className="text-red-400 hover:text-red-600 text-sm px-1"
                          onClick={() => atualizar(i, x => ({ ...x, aulas: { ...x.aulas, lista: x.aulas.lista.filter((_, idx) => idx !== k) } }))}>✕</button>
                      )}
                    </div>
                  ))}
                  {e.aulas.lista.length < MAX_AULAS_POR_ESPORTE && (
                    <button type="button" className="self-start text-sm text-blue-600 hover:underline"
                      onClick={() => atualizar(i, x => ({ ...x, aulas: { ...x.aulas, lista: [...x.aulas.lista, { id: null, tipo: 'Aula', professor: '', valor: '' }] } }))}>
                      + outra aula
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Ranking */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
              <Marca marcado={e.ranking.ativo} onChange={v => atualizar(i, x => ({ ...x, ranking: { ...x.ranking, ativo: v } }))}><IconeModalidade tipo="Ranking" /> Ranking</Marca>
              {e.ranking.ativo && (
                <CampoValor valor={e.ranking.valor} placeholder="50,00"
                  onChange={v => atualizar(i, x => ({ ...x, ranking: { ...x.ranking, valor: v } }))} />
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
