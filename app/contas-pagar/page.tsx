import { redirect } from 'next/navigation'

// Agora fica no Financeiro, na aba Contas a pagar
export default function ContasPagar() {
  redirect('/financeiro?aba=pagar')
}
