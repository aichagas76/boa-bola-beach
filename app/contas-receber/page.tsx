import { redirect } from 'next/navigation'

// Agora fica no Financeiro, na aba Contas a receber
export default function ContasReceber() {
  redirect('/financeiro?aba=receber')
}
