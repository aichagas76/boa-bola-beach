import { CartesianGrid } from 'recharts'

/* ---------- formatação brasileira ---------- */
export const brl = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
export const brlCurto = (v: number) => (Math.abs(v) >= 1000 ? `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : String(v))
export const pct = (v: number) => `${v.toLocaleString('pt-BR', { maximumFractionDigits: Math.abs(v) < 10 ? 1 : 0 })}%`
export const tip = (v: unknown) => brl(Number(v ?? 0))

/* ---------- cores com significado fixo (as mesmas em todo o painel) ---------- */
export const COR = {
  recebido: '#16A34A', // dinheiro que entrou / positivo
  marca: '#7DC421', // receita (verde do Boa Bola)
  aVencer: '#F59E0B', // previsto, ainda no prazo
  vencido: '#DC2626', // atrasado / despesa / negativo
  anterior: '#9CA3AF', // comparação com o período anterior
  base: '#2563EB', // base de alunos
  cancelado: '#6B7280',
}
export const COR_ESPORTE: Record<string, string> = {
  'Beach Tênis': '#F97316', 'Tênis': '#84A60F', Padel: '#2563EB', Pickleball: '#EAB308', 'Sem esporte': '#9CA3AF',
}
export const corEsporte = (n: string) => COR_ESPORTE[n] ?? '#6B7280'
export const PALETA_CATEGORIAS = ['#2563EB', '#F97316', '#16A34A', '#EAB308', '#9333EA', '#0891B2', '#DB2777', '#84A60F']
export const COR_STATUS: Record<string, string> = { Pagos: COR.recebido, 'A vencer': COR.aVencer, Vencidos: COR.vencido, Cancelados: COR.cancelado }

/* ---------- padrão dos gráficos ---------- */
export const ALTURA = 240
export const MARGEM = { top: 8, right: 8, left: 0, bottom: 0 }
export const eixoY = { width: 52, tick: { fontSize: 12 }, tickLine: false, axisLine: false } as const
export const eixoX = { tick: { fontSize: 12 }, tickLine: false } as const
export const legenda = { wrapperStyle: { fontSize: 12, paddingTop: 6 } } as const
export const Grade = () => <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />


export function Grafico({ titulo, nota, vazio, mensagemVazio, carregando, altura = ALTURA, children, largo }: { titulo: string; nota?: string; vazio?: boolean; mensagemVazio?: string; carregando?: boolean; altura?: number; children: React.ReactNode; largo?: boolean }) {
  return (
    <div className={`bg-white border border-gray-200 rounded-xl p-4 ${largo ? 'lg:col-span-2' : ''}`}>
      <div className="text-sm font-semibold text-gray-900">{titulo}</div>
      {nota && <div className="text-xs text-gray-500">{nota}</div>}
      <div className="mt-3" style={{ minHeight: altura }}>
        {carregando ? (
          <div className="flex items-center justify-center text-sm text-gray-400" style={{ height: altura }}>Carregando...</div>
        ) : vazio ? (
          <div className="flex items-center justify-center text-center text-sm text-gray-400 px-4" style={{ height: altura }}>{mensagemVazio ?? 'Sem dados neste período'}</div>
        ) : children}
      </div>
    </div>
  )
}
