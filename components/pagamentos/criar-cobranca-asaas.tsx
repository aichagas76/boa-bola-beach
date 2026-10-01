'use client'

import { useState } from 'react'
import { Copy, ExternalLink, Loader } from 'lucide-react'

interface CriarCobrancaAsaasProps {
  alunoId: string
  alunoNome: string
  pagamentoId: string
  valor: number
  dataVencimento: string
  onSuccess?: (paymentUrl: string) => void
}

export function CriarCobrancaAsaas({
  alunoId,
  alunoNome,
  pagamentoId,
  valor,
  dataVencimento,
  onSuccess,
}: CriarCobrancaAsaasProps) {
  const [loading, setLoading] = useState(false)
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const handleCriarCobranca = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/pagamentos/criar-asaas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alunoId,
          pagamentoId,
          valor,
          dataVencimento,
          descricao: `Cobrança - ${alunoNome}`,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao criar cobrança')
      }

      setPaymentUrl(data.paymentUrl)
      onSuccess?.(data.paymentUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = () => {
    if (paymentUrl) {
      navigator.clipboard.writeText(paymentUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (paymentUrl) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full" />
          <h3 className="font-semibold text-green-900">Cobrança criada com sucesso!</h3>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-green-700 uppercase">Link de Pagamento</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={paymentUrl}
              readOnly
              className="flex-1 bg-white border border-green-200 rounded px-3 py-2 text-sm text-gray-600"
            />
            <button
              onClick={copyToClipboard}
              className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition-colors flex items-center gap-1"
              title="Copiar link"
            >
              <Copy size={16} />
              {copied ? 'Copiado!' : 'Copiar'}
            </button>
          </div>
        </div>

        <div className="flex gap-2">
          <a
            href={paymentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-semibold transition-colors flex items-center justify-center gap-2"
          >
            <ExternalLink size={16} />
            Abrir Link de Pagamento
          </a>
        </div>

        <p className="text-xs text-green-700">
          ✓ Compartilhe o link com o cliente ou abra para testar
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
      <div className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Aluno:</span>
          <span className="font-semibold">{alunoNome}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Valor:</span>
          <span className="font-semibold">R$ {valor.toFixed(2).replace('.', ',')}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Vencimento:</span>
          <span className="font-semibold">{new Date(dataVencimento).toLocaleDateString('pt-BR')}</span>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-3">
          <p className="text-sm text-red-700">⚠️ {error}</p>
        </div>
      )}

      <button
        onClick={handleCriarCobranca}
        disabled={loading}
        className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded transition-colors flex items-center justify-center gap-2 min-h-[48px]"
      >
        {loading ? (
          <>
            <Loader size={18} className="animate-spin" />
            Criando cobrança...
          </>
        ) : (
          '💳 Gerar Link de Pagamento (Asaas)'
        )}
      </button>

      <p className="text-xs text-gray-500 text-center">
        Suporta PIX, Boleto e Cartão de Crédito
      </p>
    </div>
  )
}
