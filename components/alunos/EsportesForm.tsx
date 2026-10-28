'use client'

import { useState } from 'react'
import { Check, ChevronUp, Trophy } from 'lucide-react'
import { mascaraValor, ESPORTE_COM_COMBO, MAX_AULAS_POR_ESPORTE, type EstadoEsporte } from '@/lib/esportes'
import IconeEsporte from '@/components/alunos/IconeEsporte'
import IconeModalidade from '@/components/alunos/IconeModalidade'
import { professoresDoEsporte, type ProfessorOpcao } from '@/lib/professores'

const entrada = 'w-full h-10 border border-gray-200 rounded-lg px-3 text-sm bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-400'

function CampoValor({ valor, onChange, placeholder, desligado }: { valor: string; onChange: (v: string) => void; placeholder: string; desligado: boolean }) {
  return (
    <div className="relative">
      <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm ${desligado ? 'text-gray-300' : 'text-gray-500'}`}>R$</span>
      <input
        inputMode="decimal"
        className={`${entrada} pl-9`}
        placeholder={placeholder}
        value={valor}
        disabled={desligado}
        onChange={e => onChange(mascaraValor(e.target.value))}
      />
    </div>
  )
}

function Marca({ marcado, onChange, children }: { marcado: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="inline-flex items-center gap-3 cursor-pointer text-sm font-medium text-blue-950 select-none">
      <input type="checkbox" className="h-[18px] w-[18px] accent-blue-600" checked={marcado} onChange={e => onChange(e.target.checked)} />
      <span className="inline-flex items-center gap-2">{children}</span>
    </label>
  )
}

const temModalidade = (e: EstadoEsporte) => e.clubinho.ativo || e.aulas.ativo || e.ranking.ativo || e.extras.some(x => x.ativo)
const LINHA = 'grid grid-cols-1 md:grid-cols-[10rem_12rem_1fr] gap-x-4 gap-y-2 items-center'

type Props = {
  estados: EstadoEsporte[]
  onChange: (estados: EstadoEsporte[]) => void
  professores: ProfessorOpcao[]
  modalidadesPorEsporte: Record<string, string[]> // para cada esporte, as modalidades ativas que valem nele
}

/**
 * Cartão "Esportes e modalidades": cada pílula liga/desliga um esporte (pode ligar vários)
 * e, para cada esporte ligado, aparece abaixo o quadro com Clubinho / Aulas / Ranking.
 */
export default function EsportesForm({ estados, onChange, professores, modalidadesPorEsporte }: Props) {
  const mostra = (e: EstadoEsporte, nome: string) => (modalidadesPorEsporte[e.esporteId] ?? []).includes(nome)
  const [recolhidos, setRecolhidos] = useState<Record<string, boolean>>({})

  function mudar(esporteId: string, fn: (x: EstadoEsporte) => EstadoEsporte) {
    onChange(estados.map(x => (x.esporteId === esporteId ? fn(x) : x)))
  }

  function alternarEsporte(x: EstadoEsporte) {
    if (x.ativo && temModalidade(x) && !window.confirm(`Tirar ${x.nome}? As modalidades e valores marcados nele serão removidos ao salvar.`)) return
    setRecolhidos(r => ({ ...r, [x.esporteId]: false }))
    mudar(x.esporteId, e => ({ ...e, ativo: !e.ativo }))
  }

  const ligados = estados.filter(x => x.ativo)

  return (
    <section className="bg-white border border-gray-200 rounded-2xl p-5 mb-4 shadow-sm">
      <h2 className="flex items-center gap-2.5 text-sm font-bold uppercase tracking-wide text-blue-950 mb-1">
        <span className="h-7 w-7 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center"><Trophy size={16} /></span>
        Esportes e modalidades
      </h2>
      <p className="text-sm text-gray-500 mb-4">Toque nos esportes que o aluno pratica. Pode escolher mais de um.</p>

      {/* Pílulas: cada uma liga ou desliga o esporte */}
      <div className="flex flex-wrap gap-2.5">
        {estados.map(x => (
          <button
            key={x.esporteId}
            type="button"
            aria-pressed={x.ativo}
            onClick={() => alternarEsporte(x)}
            className={`inline-flex items-center gap-2 pl-1.5 pr-4 h-11 rounded-full border text-sm font-medium transition-colors ${
              x.ativo
                ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                : 'bg-gray-50 border-gray-200 text-gray-800 hover:bg-gray-100'
            }`}
          >
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white"><IconeEsporte nome={x.nome} tamanho={26} /></span>
            {x.nome}
            {x.ativo && <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-blue-600"><Check size={13} strokeWidth={3} /></span>}
          </button>
        ))}
      </div>

      {ligados.length === 0 && (
        <div className="mt-4 rounded-xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-400">
          Nenhum esporte escolhido ainda.
        </div>
      )}

      {/* Um quadro de modalidades para cada esporte ligado */}
      {ligados.map(e => {
        const recolhido = !!recolhidos[e.esporteId]
        return (
          <div key={e.esporteId} className="mt-4 border border-gray-200 rounded-xl overflow-hidden">
            <button type="button" onClick={() => setRecolhidos(r => ({ ...r, [e.esporteId]: !recolhido }))}
              className="w-full flex items-center justify-between bg-blue-50/70 border-l-4 border-blue-600 px-4 py-3 text-left">
              <span className="flex items-center gap-2.5 text-base font-bold text-blue-950">
                <IconeEsporte nome={e.nome} tamanho={24} /> {e.nome}
              </span>
              <ChevronUp size={18} className={`text-gray-500 transition-transform ${recolhido ? 'rotate-180' : ''}`} />
            </button>

            {!recolhido && (
              <div className="px-4 py-4 space-y-3.5">
                {/* Clubinho */}
                {mostra(e, 'Clubinho') && <div className={LINHA}>
                  <Marca marcado={e.clubinho.ativo} onChange={v => mudar(e.esporteId, x => ({ ...x, clubinho: { ...x.clubinho, ativo: v } }))}>
                    <IconeModalidade tipo="Clubinho" tamanho={22} /> Clubinho
                  </Marca>
                  <CampoValor valor={e.clubinho.valor} placeholder="0,00" desligado={!e.clubinho.ativo}
                    onChange={v => mudar(e.esporteId, x => ({ ...x, clubinho: { ...x.clubinho, valor: v } }))} />
                  {e.nome === ESPORTE_COM_COMBO ? (
                    <label className={`inline-flex items-center gap-2.5 text-sm select-none ${e.clubinho.ativo ? 'text-gray-700 cursor-pointer' : 'text-gray-300'}`}>
                      <input type="checkbox" className="h-[18px] w-[18px] accent-blue-600" disabled={!e.clubinho.ativo} checked={e.clubinho.combo}
                        onChange={ev => mudar(e.esporteId, x => ({ ...x, clubinho: { ...x.clubinho, combo: ev.target.checked } }))} />
                      Combo (Boa Bola 1 e 2)
                    </label>
                  ) : <span />}
                </div>}

                {/* Aulas */}
                {mostra(e, 'Aula') && e.aulas.lista.map((aula, k) => (
                  <div key={k} className={LINHA}>
                    {k === 0 ? (
                      <Marca marcado={e.aulas.ativo} onChange={v => mudar(e.esporteId, x => ({ ...x, aulas: { ...x.aulas, ativo: v } }))}>
                        <IconeModalidade tipo="Aula" tamanho={22} /> Aulas
                      </Marca>
                    ) : (
                      <span className="text-sm text-gray-500 md:pl-[30px]">Aula {k + 1}</span>
                    )}
                    <CampoValor valor={aula.valor} placeholder="0,00" desligado={!e.aulas.ativo}
                      onChange={v => mudar(e.esporteId, x => ({ ...x, aulas: { ...x.aulas, lista: x.aulas.lista.map((a, idx) => idx === k ? { ...a, valor: v } : a) } }))} />
                    <div className="flex items-center gap-2">
                      <select className={entrada} disabled={!e.aulas.ativo} value={aula.professor}
                        onChange={ev => mudar(e.esporteId, x => ({ ...x, aulas: { ...x.aulas, lista: x.aulas.lista.map((a, idx) => idx === k ? { ...a, professor: ev.target.value } : a) } }))}>
                        <option value="">Professor</option>
                        {professoresDoEsporte(professores, e.esporteId, aula.professor).map(p => <option key={p.id} value={p.nome}>{p.nome}</option>)}
                      </select>
                      {k > 0 && (
                        <button type="button" title="Remover aula" className="text-red-400 hover:text-red-600 text-sm px-1"
                          onClick={() => mudar(e.esporteId, x => ({ ...x, aulas: { ...x.aulas, lista: x.aulas.lista.filter((_, idx) => idx !== k) } }))}>✕</button>
                      )}
                    </div>
                  </div>
                ))}
                {mostra(e, 'Aula') && e.aulas.ativo && e.aulas.lista.length < MAX_AULAS_POR_ESPORTE && (
                  <button type="button" className="md:ml-[calc(10rem+1rem)] text-sm text-blue-600 hover:underline"
                    onClick={() => mudar(e.esporteId, x => ({ ...x, aulas: { ...x.aulas, lista: [...x.aulas.lista, { id: null, tipo: 'Aula', professor: '', valor: '' }] } }))}>
                    + outra aula
                  </button>
                )}

                {/* Ranking */}
                {mostra(e, 'Ranking') && <div className={LINHA}>
                  <Marca marcado={e.ranking.ativo} onChange={v => mudar(e.esporteId, x => ({ ...x, ranking: { ...x.ranking, ativo: v } }))}>
                    <IconeModalidade tipo="Ranking" tamanho={22} /> Ranking
                  </Marca>
                  <CampoValor valor={e.ranking.valor} placeholder="0,00" desligado={!e.ranking.ativo}
                    onChange={v => mudar(e.esporteId, x => ({ ...x, ranking: { ...x.ranking, valor: v } }))} />
                  <span />
                </div>}

                {/* Outras modalidades cadastradas: só o valor */}
                {e.extras.filter(x => mostra(e, x.tipo)).map(x => (
                  <div key={x.tipo} className={LINHA}>
                    <Marca marcado={x.ativo} onChange={v => mudar(e.esporteId, y => ({ ...y, extras: y.extras.map(z => z.tipo === x.tipo ? { ...z, ativo: v } : z) }))}>
                      <IconeModalidade tipo={x.tipo} tamanho={22} /> {x.tipo}
                    </Marca>
                    <CampoValor valor={x.valor} placeholder="0,00" desligado={!x.ativo}
                      onChange={v => mudar(e.esporteId, y => ({ ...y, extras: y.extras.map(z => z.tipo === x.tipo ? { ...z, valor: v } : z) }))} />
                    <span />
                  </div>
                ))}

                {(modalidadesPorEsporte[e.esporteId] ?? []).length === 0 && (
                  <p className="text-sm text-gray-400">Nenhuma modalidade vale para este esporte. Veja em Cadastros &gt; Modalidades.</p>
                )}
              </div>
            )}
          </div>
        )
      })}
    </section>
  )
}
