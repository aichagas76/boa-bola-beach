/** Cabeçalho que só aparece ao imprimir ou salvar em PDF. */
export function CabecalhoImpressao({ titulo, linhas, unidade }: { titulo: string; linhas: string[]; unidade?: string }) {
  const geradoEm = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  return (
    <div className="hidden print:block mb-5 border-b-2 border-gray-800 pb-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/BB logo.jpg" alt="Boa Bola Beach" style={{ height: '64px', width: 'auto', objectFit: 'contain' }} />
          <div>
            <div className="text-xl font-bold text-gray-900">Boa Bola Beach</div>
            {unidade && <div className="text-sm text-gray-600">{unidade}</div>}
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-semibold text-gray-900">{titulo}</div>
          {linhas.map(l => <div key={l} className="text-sm text-gray-600">{l}</div>)}
          <div className="text-xs text-gray-500 mt-1">Emitido em {geradoEm}</div>
        </div>
      </div>
    </div>
  )
}

export function BotaoImprimir({ desabilitado }: { desabilitado?: boolean }) {
  return (
    <button type="button" disabled={desabilitado} onClick={() => window.print()}
      className="inline-flex items-center gap-2 h-9 px-3 text-sm border border-gray-200 rounded-lg text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 print:hidden">
      Imprimir / salvar PDF
    </button>
  )
}
