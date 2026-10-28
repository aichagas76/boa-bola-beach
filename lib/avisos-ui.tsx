'use client'

// Avisos e confirmações do próprio sistema, no lugar das janelas feias do navegador (alert/confirm).
//   avisar('Salvo!')                         -> faixa no canto da tela, some sozinha
//   if (!await confirmar('Excluir?')) return -> janela com Cancelar / Confirmar
// Funciona de qualquer arquivo; o <AvisosHost /> (no layout) é quem desenha.

import { useEffect, useSyncExternalStore } from 'react'
import { AlertCircle, X } from 'lucide-react'

type Aviso = { id: number; texto: string }
type Pergunta = { texto: string; resolver: (v: boolean) => void }

let avisos: Aviso[] = []
let pergunta: Pergunta | null = null
let versao = 0
let seq = 0
const ouvintes = new Set<() => void>()
const emitir = () => { versao++; ouvintes.forEach(f => f()) }

function fechar(id: number) {
  if (!avisos.some(a => a.id === id)) return
  avisos = avisos.filter(a => a.id !== id)
  emitir()
}

export function avisar(texto: string) {
  const id = ++seq
  avisos = [...avisos, { id, texto }]
  emitir()
  setTimeout(() => fechar(id), Math.min(15000, Math.max(5000, texto.length * 70)))
}

export function confirmar(texto: string): Promise<boolean> {
  return new Promise(resolver => {
    // uma pergunta de cada vez: a anterior (se houver) é cancelada
    pergunta?.resolver(false)
    pergunta = { texto, resolver }
    emitir()
  })
}

function responder(v: boolean) {
  const p = pergunta
  pergunta = null
  emitir()
  p?.resolver(v)
}

const assinar = (f: () => void) => { ouvintes.add(f); return () => { ouvintes.delete(f) } }

export function AvisosHost() {
  useSyncExternalStore(assinar, () => versao, () => 0)

  useEffect(() => {
    if (!pergunta) return
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') responder(false) }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [versao]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <div className="fixed top-4 right-4 z-[100] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2" aria-live="polite">
        {avisos.map(a => (
          <div key={a.id} role="alert" className="flex items-start gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 shadow-lg">
            <AlertCircle size={18} className="mt-0.5 shrink-0 text-amber-600" />
            <p className="flex-1 whitespace-pre-line">{a.texto}</p>
            <button type="button" onClick={() => fechar(a.id)} className="shrink-0 text-gray-400 hover:text-gray-600" aria-label="Fechar aviso"><X size={16} /></button>
          </div>
        ))}
      </div>
      {pergunta && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4" onClick={() => responder(false)}>
          <div role="alertdialog" aria-modal="true" className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl" onClick={e => e.stopPropagation()}>
            <p className="whitespace-pre-line text-sm text-gray-800">{pergunta.texto}</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => responder(false)} className="h-10 rounded-lg border border-gray-200 px-4 text-sm text-gray-700 hover:bg-gray-50">Cancelar</button>
              <button type="button" autoFocus onClick={() => responder(true)} className="h-10 rounded-lg bg-[#7DC421] px-4 text-sm font-medium text-white hover:bg-[#6ab01a]">Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
