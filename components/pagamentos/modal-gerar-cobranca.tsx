'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { CriarCobrancaAsaas } from './criar-cobranca-asaas'

interface ModalGerarCobrancaProps {
  isOpen: boolean
  onClose: () => void
  movimentacao: {
    id: string
    valor: number
    data_vencimento: string | null
  }
  aluno: {
    id: string
    nome: string
  }
}

export function ModalGerarCobranca({
  isOpen,
  onClose,
  movimentacao,
  aluno,
}: ModalGerarCobrancaProps) {
  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-lg z-50 w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 p-4">
          <h2 className="text-lg font-semibold text-gray-900">Gerar Cobrança</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <CriarCobrancaAsaas
            alunoId={aluno.id}
            alunoNome={aluno.nome}
            pagamentoId={movimentacao.id}
            valor={movimentacao.valor}
            dataVencimento={movimentacao.data_vencimento || new Date().toISOString().split('T')[0]}
            onSuccess={() => {
              setTimeout(onClose, 2000)
            }}
          />
        </div>
      </div>
    </>
  )
}
