'use client'

import { useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { periodoDe, type Preset } from '@/lib/painel'
import { janelaDeMeses } from '@/lib/painel-graficos'

export const PRESETS: { id: Preset; nome: string }[] = [
  { id: 'mes_atual', nome: 'Mês atual' },
  { id: 'mes_anterior', nome: 'Mês anterior' },
  { id: '3m', nome: '3 meses' },
  { id: '6m', nome: '6 meses' },
  { id: 'custom', nome: 'Personalizado' },
]

/** Período próprio de cada tema do Painel (atalhos + intervalo de datas). */
export function usePeriodo(hoje: string, inicial: Preset = 'mes_atual') {
  const [preset, setPreset] = useState<Preset>(inicial)
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  const periodo = useMemo(() => periodoDe(preset, hoje, de, ate), [preset, hoje, de, ate])
  return { preset, setPreset, de, setDe, ate, setAte, periodo, hoje }
}
export type EstadoPeriodo = ReturnType<typeof usePeriodo>

export function FiltroPeriodo({ p, nome }: { p: EstadoPeriodo; nome: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
      <div className="inline-flex shrink-0 max-w-[calc(100vw-2rem)] overflow-x-auto rounded-lg border border-gray-200 bg-white" role="group" aria-label={`Período de ${nome}`}>
        {PRESETS.map(x => (
          <button key={x.id} type="button" aria-pressed={p.preset === x.id} onClick={() => p.setPreset(x.id)}
            className={`px-3 h-9 text-sm font-medium whitespace-nowrap transition-colors ${p.preset === x.id ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
            {x.nome}
          </button>
        ))}
      </div>
      {p.preset === 'custom' && (
        <div className="inline-flex shrink-0 items-center gap-2 text-sm text-gray-600">
          <input type="date" value={p.de} max={p.hoje} onChange={e => p.setDe(e.target.value)} className="h-9 w-[8.25rem] border border-gray-200 rounded-lg px-2 text-sm bg-white" aria-label={`De (${nome})`} />
          até
          <input type="date" value={p.ate} max={p.hoje} onChange={e => p.setAte(e.target.value)} className="h-9 w-[8.25rem] border border-gray-200 rounded-lg px-2 text-sm bg-white" aria-label={`Até (${nome})`} />
        </div>
      )}
    </div>
  )
}

export const rotuloDoPeriodo = (inicio: string, fim: string) =>
  inicio === fim ? inicio.split('-').reverse().join('/') : `${inicio.split('-').reverse().join('/')} a ${fim.split('-').reverse().join('/')}`

/** Tema do Painel que abre e fecha pela setinha. Começa fechado: o conteúdo só é desenhado quando aberto. */
export function TemaRecolhivel({ titulo, subtitulo, filtro, children }: {
  titulo: string
  subtitulo?: string
  filtro?: React.ReactNode
  children: React.ReactNode
}) {
  const [aberto, setAberto] = useState(false)
  const id = `tema-${titulo.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  return (
    <section className="mb-4 rounded-xl border border-gray-200 bg-gray-50/50" aria-label={titulo}>
      <button type="button" aria-expanded={aberto} aria-controls={id} onClick={() => setAberto(v => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
        <span>
          <span className="block text-section-title text-gray-900">{titulo}</span>
          {subtitulo && <span className="block text-sm text-gray-500">{subtitulo}</span>}
        </span>
        <ChevronDown size={22} className={`shrink-0 text-gray-500 transition-transform ${aberto ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {aberto && (
        <div id={id} className="px-4 pb-4">
          {filtro && <div className="mb-3">{filtro}</div>}
          {children}
        </div>
      )}
    </section>
  )
}

/* ---------- filtro por meses (1, 3, 6, 12 meses ou datas escolhidas), para os gráficos mensais ---------- */
export const OPCOES_MESES = [1, 3, 6, 12]

export function useJanela(hoje: string, inicial = 6) {
  const [escolha, setEscolha] = useState<number | 'custom'>(inicial)
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  const janela = useMemo(() => {
    if (escolha !== 'custom') return janelaDeMeses(escolha, hoje)
    return de && ate && de <= ate ? { inicio: de, fim: ate } : janelaDeMeses(1, hoje)
  }, [escolha, de, ate, hoje])
  return { escolha, setEscolha, de, setDe, ate, setAte, janela, hoje }
}
export type EstadoJanela = ReturnType<typeof useJanela>

export function FiltroMeses({ j, nome }: { j: EstadoJanela; nome: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
      <div className="inline-flex shrink-0 max-w-[calc(100vw-2rem)] overflow-x-auto rounded-lg border border-gray-200 bg-white" role="group" aria-label={`Período de ${nome}`}>
        {OPCOES_MESES.map(n => (
          <button key={n} type="button" aria-pressed={j.escolha === n} onClick={() => j.setEscolha(n)}
            className={`px-3 h-9 text-sm font-medium whitespace-nowrap transition-colors ${j.escolha === n ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
            {n === 1 ? '1 mês' : `${n} meses`}
          </button>
        ))}
        <button type="button" aria-pressed={j.escolha === 'custom'} onClick={() => j.setEscolha('custom')}
          className={`px-3 h-9 text-sm font-medium whitespace-nowrap transition-colors ${j.escolha === 'custom' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
          Personalizado
        </button>
      </div>
      {j.escolha === 'custom' && (
        <div className="inline-flex shrink-0 items-center gap-2 text-sm text-gray-600">
          <input type="date" value={j.de} max={j.hoje} onChange={e => j.setDe(e.target.value)} className="h-9 w-[8.25rem] border border-gray-200 rounded-lg px-2 text-sm bg-white" aria-label={`De (${nome})`} />
          até
          <input type="date" value={j.ate} max={j.hoje} onChange={e => j.setAte(e.target.value)} className="h-9 w-[8.25rem] border border-gray-200 rounded-lg px-2 text-sm bg-white" aria-label={`Até (${nome})`} />
        </div>
      )}
    </div>
  )
}
