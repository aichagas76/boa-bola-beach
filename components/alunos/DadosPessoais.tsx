'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
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
}

const campo = 'w-full border rounded-md px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#7DC421]'
const ok = 'border-gray-200'
const ruim = 'border-red-300 bg-red-50'

function Rotulo({ children }: { children: React.ReactNode }) {
  return <label className="text-label text-gray-500 block mb-0.5">{children}</label>
}
function Erro({ texto }: { texto?: string | null }) {
  return texto ? <div className="text-xs text-red-600 mt-0.5">{texto}</div> : null
}

/** Pergunta ao banco se o CPF já existe em qualquer unidade (sem mostrar de quem é). Se a consulta falhar, não bloqueia. */
export async function cpfJaCadastrado(cpf: string, ignorarAlunoId?: string) {
  const { data, error } = await supabase.rpc('cpf_ja_cadastrado', { p_cpf: cpf, p_ignorar: ignorarAlunoId ?? null })
  return error ? false : data === true
}

type Props = {
  form: FormAluno
  onChange: (f: FormAluno) => void
  erros: ErrosAluno
  mostrarErros: boolean // true depois da primeira tentativa de salvar
  alunoId?: string
  onCpfDuplicado?: (duplicado: boolean) => void
}

/** Dados pessoais em poucas linhas: Nome/CPF/Celular, depois Nascimento/Sexo/Cadastro/Vencimento. */
export default function DadosPessoais({ form, onChange, erros, mostrarErros, alunoId, onCpfDuplicado }: Props) {
  const [tocados, setTocados] = useState<Record<string, boolean>>({})
  const [erroCpfLocal, setErroCpfLocal] = useState<string | null>(null)
  const set = (p: Partial<FormAluno>) => onChange({ ...form, ...p })
  const marca = (k: string) => setTocados(t => ({ ...t, [k]: true }))
  const ver = (k: keyof ErrosAluno) => (mostrarErros || tocados[k]) ? erros[k] : undefined

  async function aoSairDoCpf() {
    marca('cpf')
    const e = erroCPF(form.cpf)
    setErroCpfLocal(e)
    if (!e) onCpfDuplicado?.(await cpfJaCadastrado(form.cpf, alunoId))
  }

  const erroDoCpf = ver('cpf') ?? (tocados.cpf ? erroCpfLocal : undefined)

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 mb-3">
      <div className="flex items-center justify-between mb-3">
        <div className="text-th text-gray-400">Dados pessoais</div>
        <label className="flex items-center gap-2 cursor-pointer">
          <span className={`text-xs font-medium ${form.status === 'Ativo' ? 'text-green-700' : 'text-gray-500'}`}>{form.status}</span>
          <div className="relative">
            <input type="checkbox" className="sr-only" checked={form.status === 'Ativo'}
              onChange={e => set({ status: e.target.checked ? 'Ativo' : 'Inativo' })} />
            <div className={`w-9 h-5 rounded-full transition-colors ${form.status === 'Ativo' ? 'bg-green-500' : 'bg-gray-300'}`}></div>
            <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.status === 'Ativo' ? 'translate-x-4' : ''}`}></div>
          </div>
        </label>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-12 gap-x-3 gap-y-2.5">
        <div className="col-span-2 md:col-span-6">
          <Rotulo>Nome completo</Rotulo>
          <input className={`${campo} ${ver('nome') ? ruim : ok}`} placeholder="Nome completo do aluno" value={form.nome}
            onChange={e => set({ nome: e.target.value })} onBlur={() => marca('nome')} />
          <Erro texto={ver('nome')} />
        </div>
        <div className="col-span-1 md:col-span-3">
          <Rotulo>CPF</Rotulo>
          <input className={`${campo} ${erroDoCpf ? ruim : ok}`} placeholder="000.000.000-00" inputMode="numeric" value={form.cpf}
            onChange={e => { set({ cpf: mascaraCPF(e.target.value) }); setErroCpfLocal(null); onCpfDuplicado?.(false) }}
            onBlur={aoSairDoCpf} />
          <Erro texto={erroDoCpf} />
        </div>
        <div className="col-span-1 md:col-span-3">
          <Rotulo>Celular</Rotulo>
          <input className={`${campo} ${ver('celular') ? ruim : ok}`} placeholder="(00) 90000-0000" inputMode="tel" value={form.celular}
            onChange={e => set({ celular: mascaraCelular(e.target.value) })} onBlur={() => marca('celular')} />
          <Erro texto={ver('celular')} />
        </div>

        <div className="col-span-1 md:col-span-3">
          <Rotulo>Nascimento</Rotulo>
          <input type="date" className={`${campo} ${ok}`} value={form.data_nascimento} onChange={e => set({ data_nascimento: e.target.value })} />
        </div>
        <div className="col-span-1 md:col-span-3">
          <Rotulo>Sexo</Rotulo>
          <select className={`${campo} ${ok}`} value={form.sexo} onChange={e => set({ sexo: e.target.value })}>
            <option value="">Selecionar</option>
            <option value="M">Masculino</option>
            <option value="F">Feminino</option>
          </select>
        </div>
        <div className="col-span-1 md:col-span-3">
          <Rotulo>Cadastro</Rotulo>
          <input type="date" className={`${campo} ${ok}`} value={form.data_cadastro} onChange={e => set({ data_cadastro: e.target.value })} />
        </div>
        <div className="col-span-1 md:col-span-3">
          <Rotulo>Vencimento</Rotulo>
          <input type="date" className={`${campo} ${ver('data_vencimento') ? ruim : ok}`} value={form.data_vencimento}
            onChange={e => set({ data_vencimento: e.target.value })} onBlur={() => marca('data_vencimento')} />
          <Erro texto={ver('data_vencimento')} />
        </div>
      </div>
    </div>
  )
}
