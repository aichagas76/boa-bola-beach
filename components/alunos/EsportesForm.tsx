'use client'

import { useState } from 'react'
import { Check, ChevronUp, Trophy } from 'lucide-react'
import { mascaraValor, ESPORTE_COM_COMBO, MAX_AULAS_POR_ESPORTE, type EstadoEsporte } from '@/lib/esportes'
import IconeEsporte from '@/components/alunos/IconeEsporte'
import IconeModalidade from '@/components/alunos/IconeModalidade'

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

const temModalidade = (e: EstadoEsporte) => e.clubinho.ativo || e.aulas.ativo || e.ranking.ativo
const LINHA = 'grid grid-cols-1 md:grid-cols-[10rem_12rem_1fr] gap-x-4 gap-y-2 items-center'

type Props = {
  estados: EstadoEsporte[]
  onChange: (estados: EstadoEsporte[]) => void
  professores: { id: string; nome: string }[]
}

/** Cartão "Esportes e modalidades": pílulas com os esportes e, abaixo, Clubinho / Aulas / Ranking do esporte escolhido. */
export default function EsportesForm({ estados, onChange, professores }: Props) {
  const primeiraComModalidade = estados.findIndex(temModalidade)
  const [aba, setAba] = useState<number | null>(null)
  const [recolhido, setRecolhido] = useState(false)
  const atual = Math.min(aba ?? (primeiraComModalidade >= 0 ? primeiraComModalidade : 0), Math.max(estados.length - 1, 0))
  const e = estados[atual]

  function atualizar(mudar: (x: EstadoEsporte) => EstadoEsporte) {
    onChange(estados.map((x, idx) => {
      if (idx !== atual) return x
      const novo = mudar(x)
      return { ...novo, ativo: temModalidade(novo) }
    }))
  }

  if (!e) return null

  return (
    <section className="bg-white border border-gray-200 rounded-2xl p-5 mb-4 shadow-sm">
      <h2 className="flex items-center gap-2.5 text-sm font-bold uppercase tracking-wide text-blue-950 mb-4">
        <span className="h-7 w-7 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center"><Trophy size={16} /></span>
        Esportes e modalidades
      </h2>

      {/* Pílulas dos esportes */}
      <div className="flex flex-wrap gap-2.5">
        {estados.map((x, i) => {
          const selecionada = i === atual
          return (
            <button
              key={x.esporteId}
              type="button"
              onClick={() => { setAba(i); setRecolhido(false) }}
              className={`inline-flex items-center gap-2 pl-1.5 pr-4 h-11 rounded-full border text-sm font-medium transition-colors ${
                selecionada
                  ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                  : 'bg-gray-50 border-gray-200 text-gray-800 hover:bg-gray-100'
              }`}
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white"><IconeEsporte nome={x.nome} tamanho={26} /></span>
              {x.nome}
              {selecionada && <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-blue-600"><Check size={13} strokeWidth={3} /></span>}
              {!selecionada && temModalidade(x) && <span className="h-2 w-2 rounded-full bg-green-500" title="Aluno pratica este esporte" />}
            </button>
          )
        })}
      </div>

      {/* Modalidades do esporte escolhido */}
      <div className="mt-4 border border-gray-200 rounded-xl overflow-hidden">
        <button type="button" onClick={() => setRecolhido(r => !r)}
          className="w-full flex items-center justify-between bg-blue-50/70 border-l-4 border-blue-600 px-4 py-3 text-left">
          <span className="text-base font-bold text-blue-950">{e.nome}</span>
          <ChevronUp size={18} className={`text-gray-500 transition-transform ${recolhido ? 'rotate-180' : ''}`} />
        </button>

        {!recolhido && (
          <div className="px-4 py-4 space-y-3.5">
            {/* Clubinho */}
            <div className={LINHA}>
              <Marca marcado={e.clubinho.ativo} onChange={v => atualizar(x => ({ ...x, clubinho: { ...x.clubinho, ativo: v } }))}>
                <IconeModalidade tipo="Clubinho" tamanho={22} /> Clubinho
              </Marca>
              <CampoValor valor={e.clubinho.valor} placeholder="0,00" desligado={!e.clubinho.ativo}
                onChange={v => atualizar(x => ({ ...x, clubinho: { ...x.clubinho, valor: v } }))} />
              {e.nome === ESPORTE_COM_COMBO ? (
                <label className={`inline-flex items-center gap-2.5 text-sm select-none ${e.clubinho.ativo ? 'text-gray-700 cursor-pointer' : 'text-gray-300'}`}>
                  <input type="checkbox" className="h-[18px] w-[18px] accent-blue-600" disabled={!e.clubinho.ativo} checked={e.clubinho.combo}
                    onChange={ev => atualizar(x => ({ ...x, clubinho: { ...x.clubinho, combo: ev.target.checked } }))} />
                  Combo (Boa Bola 1 e 2)
                </label>
              ) : <span />}
            </div>

            {/* Aulas */}
            {e.aulas.lista.map((aula, k) => (
              <div key={k} className={LINHA}>
                {k === 0 ? (
                  <Marca marcado={e.aulas.ativo} onChange={v => atualizar(x => ({ ...x, aulas: { ...x.aulas, ativo: v } }))}>
                    <IconeModalidade tipo="Aula" tamanho={22} /> Aulas
                  </Marca>
                ) : (
                  <span className="text-sm text-gray-500 md:pl-[30px]">Aula {k + 1}</span>
                )}
                <CampoValor valor={aula.valor} placeholder="0,00" desligado={!e.aulas.ativo}
                  onChange={v => atualizar(x => ({ ...x, aulas: { ...x.aulas, lista: x.aulas.lista.map((a, idx) => idx === k ? { ...a, valor: v } : a) } }))} />
                <div className="flex items-center gap-2">
                  <select className={entrada} disabled={!e.aulas.ativo} value={aula.professor}
                    onChange={ev => atualizar(x => ({ ...x, aulas: { ...x.aulas, lista: x.aulas.lista.map((a, idx) => idx === k ? { ...a, professor: ev.target.value } : a) } }))}>
                    <option value="">Professor</option>
                    {professores.map(p => <option key={p.id} value={p.nome}>{p.nome}</option>)}
                  </select>
                  {k > 0 && (
                    <button type="button" title="Remover aula" className="text-red-400 hover:text-red-600 text-sm px-1"
                      onClick={() => atualizar(x => ({ ...x, aulas: { ...x.aulas, lista: x.aulas.lista.filter((_, idx) => idx !== k) } }))}>✕</button>
                  )}
                </div>
              </div>
            ))}
            {e.aulas.ativo && e.aulas.lista.length < MAX_AULAS_POR_ESPORTE && (
              <button type="button" className="md:ml-[calc(10rem+1rem)] text-sm text-blue-600 hover:underline"
                onClick={() => atualizar(x => ({ ...x, aulas: { ...x.aulas, lista: [...x.aulas.lista, { id: null, tipo: 'Aula', professor: '', valor: '' }] } }))}>
                + outra aula
              </button>
            )}

            {/* Ranking */}
            <div className={LINHA}>
              <Marca marcado={e.ranking.ativo} onChange={v => atualizar(x => ({ ...x, ranking: { ...x.ranking, ativo: v } }))}>
                <IconeModalidade tipo="Ranking" tamanho={22} /> Ranking
              </Marca>
              <CampoValor valor={e.ranking.valor} placeholder="0,00" desligado={!e.ranking.ativo}
                onChange={v => atualizar(x => ({ ...x, ranking: { ...x.ranking, valor: v } }))} />
              <span />
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
