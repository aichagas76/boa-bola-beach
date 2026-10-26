'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { UserRound } from 'lucide-react'
import { mascaraCPF, mascaraCelular, erroCPF, type ErrosAluno } from '@/lib/aluno-validacao'

export type FormAluno = {
  nome: string
  celular: string
  cpf: string
  sexo: string
  data_nascimento: string
  data_cadastro: string
  data_vencimento: string
  observacao: string
  status: string
  tem_responsavel: boolean // só da tela: marca que o aluno tem responsável
  responsavel_nome: string
  responsavel_cpf: string
  responsavel_celular: string
}

const campo = 'w-full h-10 border rounded-lg px-3 text-sm bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500'
const ok = 'border-gray-200'
const ruim = 'border-red-300 bg-red-50'

function Rotulo({ children }: { children: React.ReactNode }) {
  return <label className="text-sm text-gray-700 block mb-1">{children}</label>
}
function Erro({ texto }: { texto?: string | null }) {
  return texto ? <div className="text-xs text-red-600 mt-1">{texto}</div> : null
}

/** Pergunta ao banco se já existe aluno com este nome em qualquer unidade (CPF pode repetir; nome não). Se a consulta falhar, não bloqueia: o banco também recusa. */
export async function nomeJaCadastrado(nome: string, ignorarAlunoId?: string) {
  const { data, error } = await supabase.rpc('nome_ja_cadastrado', { p_nome: nome, p_ignorar: ignorarAlunoId ?? null })
  return error ? false : data === true
}

/** Chave "Ativo" do canto superior da página. */
export function ChaveStatus({ status, onChange }: { status: string; onChange: (s: string) => void }) {
  const ativo = status === 'Ativo'
  return (
    <label className="flex items-center gap-2.5 cursor-pointer select-none">
      <span className={`text-sm font-medium ${ativo ? 'text-green-600' : 'text-gray-500'}`}>{status}</span>
      <div className="relative">
        <input type="checkbox" className="sr-only" checked={ativo} onChange={e => onChange(e.target.checked ? 'Ativo' : 'Inativo')} />
        <div className={`w-11 h-6 rounded-full transition-colors ${ativo ? 'bg-green-500' : 'bg-gray-300'}`}></div>
        <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${ativo ? 'translate-x-5' : ''}`}></div>
      </div>
    </label>
  )
}

type Props = {
  form: FormAluno
  onChange: (f: FormAluno) => void
  erros: ErrosAluno
  mostrarErros: boolean // true depois da primeira tentativa de salvar
  alunoId?: string
  onNomeDuplicado?: (duplicado: boolean) => void
}

/** Cartão "Dados pessoais": Nome / CPF / Celular e, abaixo, Nascimento / Sexo / Cadastro / Vencimento. */
export default function DadosPessoais({ form, onChange, erros, mostrarErros, alunoId, onNomeDuplicado }: Props) {
  const [tocados, setTocados] = useState<Record<string, boolean>>({})
  const [erroCpfLocal, setErroCpfLocal] = useState<string | null>(null)
  const [erroCpfRespLocal, setErroCpfRespLocal] = useState<string | null>(null)
  const set = (p: Partial<FormAluno>) => onChange({ ...form, ...p })
  const marca = (k: string) => setTocados(t => ({ ...t, [k]: true }))
  const ver = (k: keyof ErrosAluno) => (mostrarErros || tocados[k]) ? erros[k] : undefined
  // Com responsável, o CPF do aluno é opcional: só avisa se foi digitado errado
  const erroLocalDoCpf = tocados.cpf && (!form.tem_responsavel || form.cpf) ? erroCpfLocal : undefined
  const erroDoCpf = ver('cpf') ?? erroLocalDoCpf
  const erroDoCpfResp = ver('responsavel_cpf') ?? (tocados.responsavel_cpf ? erroCpfRespLocal : undefined)

  return (
    <section className="bg-white border border-gray-200 rounded-2xl p-5 mb-4 shadow-sm">
      <h2 className="flex items-center gap-2.5 text-sm font-bold uppercase tracking-wide text-blue-950 mb-4">
        <span className="h-7 w-7 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center"><UserRound size={16} /></span>
        Dados pessoais
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-x-4 gap-y-3.5">
        <div className="md:col-span-6">
          <div className="flex items-center justify-between">
            <Rotulo>Nome completo</Rotulo>
            <label className="inline-flex items-center gap-2 text-sm text-blue-950 font-medium cursor-pointer select-none mb-1">
              <input type="checkbox" className="h-[18px] w-[18px] accent-blue-600" checked={form.tem_responsavel}
                onChange={e => set({ tem_responsavel: e.target.checked })} />
              Responsável
            </label>
          </div>
          <input className={`${campo} ${ver('nome') ? ruim : ok}`} placeholder="Nome completo do aluno" value={form.nome}
            onChange={e => { set({ nome: e.target.value }); onNomeDuplicado?.(false) }}
            onBlur={async () => { marca('nome'); if (form.nome.trim().length >= 3) onNomeDuplicado?.(await nomeJaCadastrado(form.nome, alunoId)) }} />
          <Erro texto={ver('nome')} />
        </div>
        <div className="md:col-span-3">
          <Rotulo>{form.tem_responsavel ? 'CPF (opcional)' : 'CPF'}</Rotulo>
          <input className={`${campo} ${erroDoCpf ? ruim : ok}`} placeholder="000.000.000-00" inputMode="numeric" value={form.cpf}
            onChange={e => { set({ cpf: mascaraCPF(e.target.value) }); setErroCpfLocal(null) }}
            onBlur={() => { marca('cpf'); setErroCpfLocal(erroCPF(form.cpf)) }} />
          <Erro texto={erroDoCpf} />
        </div>
        <div className="md:col-span-3">
          <Rotulo>Celular</Rotulo>
          <input className={`${campo} ${ver('celular') ? ruim : ok}`} placeholder="(00) 90000-0000" inputMode="tel" value={form.celular}
            onChange={e => set({ celular: mascaraCelular(e.target.value) })} onBlur={() => marca('celular')} />
          <Erro texto={ver('celular')} />
        </div>

        {form.tem_responsavel && (
          <div className="md:col-span-12 rounded-xl border border-blue-100 bg-blue-50/50 p-4">
            <div className="text-sm font-semibold text-blue-950 mb-0.5">Responsável pela cobrança</div>
            <p className="text-xs text-gray-500 mb-3">Os pagamentos e os avisos de cobrança vão para o responsável.</p>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-x-4 gap-y-3">
              <div className="md:col-span-6">
                <Rotulo>Nome do responsável</Rotulo>
                <input className={`${campo} ${ver('responsavel_nome') ? ruim : ok}`} placeholder="Nome completo do responsável" value={form.responsavel_nome}
                  onChange={e => set({ responsavel_nome: e.target.value })} onBlur={() => marca('responsavel_nome')} />
                <Erro texto={ver('responsavel_nome')} />
              </div>
              <div className="md:col-span-3">
                <Rotulo>CPF</Rotulo>
                <input className={`${campo} ${erroDoCpfResp ? ruim : ok}`} placeholder="000.000.000-00" inputMode="numeric" value={form.responsavel_cpf}
                  onChange={e => { set({ responsavel_cpf: mascaraCPF(e.target.value) }); setErroCpfRespLocal(null) }}
                  onBlur={() => { marca('responsavel_cpf'); setErroCpfRespLocal(erroCPF(form.responsavel_cpf)) }} />
                <Erro texto={erroDoCpfResp} />
              </div>
              <div className="md:col-span-3">
                <Rotulo>Celular</Rotulo>
                <input className={`${campo} ${ver('responsavel_celular') ? ruim : ok}`} placeholder="(00) 90000-0000" inputMode="tel" value={form.responsavel_celular}
                  onChange={e => set({ responsavel_celular: mascaraCelular(e.target.value) })} onBlur={() => marca('responsavel_celular')} />
                <Erro texto={ver('responsavel_celular')} />
              </div>
            </div>
          </div>
        )}

        <div className="md:col-span-3">
          <Rotulo>Nascimento</Rotulo>
          <input type="date" className={`${campo} ${ok}`} value={form.data_nascimento} onChange={e => set({ data_nascimento: e.target.value })} />
        </div>
        <div className="md:col-span-3">
          <Rotulo>Sexo</Rotulo>
          <select className={`${campo} ${ok}`} value={form.sexo} onChange={e => set({ sexo: e.target.value })}>
            <option value="">Selecionar</option>
            <option value="M">Masculino</option>
            <option value="F">Feminino</option>
          </select>
        </div>
        <div className="md:col-span-3">
          <Rotulo>Cadastro</Rotulo>
          <input type="date" className={`${campo} ${ok}`} value={form.data_cadastro} onChange={e => set({ data_cadastro: e.target.value })} />
        </div>
        <div className="md:col-span-3">
          <Rotulo>Vencimento</Rotulo>
          <input type="date" className={`${campo} ${ver('data_vencimento') ? ruim : ok}`} value={form.data_vencimento}
            onChange={e => set({ data_vencimento: e.target.value })} onBlur={() => marca('data_vencimento')} />
          <Erro texto={ver('data_vencimento')} />
        </div>
      </div>
    </section>
  )
}
