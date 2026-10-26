import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rotuloMes, ultimosMeses, resumoPorMes, totaisDoPeriodo, faturamentoPorProfessor, alunosPorModalidade } from '../lib/relatorios.ts'

const mov = (o) => ({ tipo: 'Entrada', status: 'Recebido', valor: 100, data: '2026-10-05', data_pagamento: null, professor_id: null, professor_nome: null, esporte_nome: null, ...o })

test('rótulo e lista de meses atravessam o ano', () => {
  assert.equal(rotuloMes('2026-10'), 'out/26')
  assert.deepEqual(ultimosMeses('2026-02-15', 4), ['2025-11', '2025-12', '2026-01', '2026-02'])
  assert.deepEqual(ultimosMeses('2026-10-26', 1), ['2026-10'])
})

test('faturamento bruto só conta entradas recebidas; despesas só saídas pagas', () => {
  const movs = [
    mov({ valor: 300 }),
    mov({ valor: 50, status: 'Não recebido' }),
    mov({ tipo: 'Saída', status: 'Pago', valor: 120 }),
    mov({ tipo: 'Saída', status: 'Pendente', valor: 999 }),
  ]
  const [l] = resumoPorMes(movs, ['2026-10'])
  assert.deepEqual([l.bruto, l.despesas, l.lucro], [300, 120, 180])
})
test('o mês vale pela data do pagamento, não pelo vencimento', () => {
  const movs = [mov({ data: '2026-09-28', data_pagamento: '2026-10-02', valor: 80 })]
  const r = resumoPorMes(movs, ['2026-09', '2026-10'])
  assert.deepEqual(r.map(x => x.bruto), [0, 80])
})
test('lucro pode ser negativo e os totais fecham', () => {
  const movs = [mov({ valor: 100 }), mov({ tipo: 'Saída', status: 'Pago', valor: 250 })]
  const linhas = resumoPorMes(movs, ['2026-10'])
  assert.equal(linhas[0].lucro, -150)
  assert.deepEqual(totaisDoPeriodo(linhas), { bruto: 100, despesas: 250, lucro: -150 })
})
test('centavos não acumulam erro de ponto flutuante', () => {
  const movs = [mov({ valor: 0.1 }), mov({ valor: 0.2 })]
  assert.equal(resumoPorMes(movs, ['2026-10'])[0].bruto, 0.3)
})

test('faturamento por professor, separado por esporte e ordenado', () => {
  const movs = [
    mov({ valor: 200, professor_id: 'p1', professor_nome: 'Ana', esporte_nome: 'Beach Tênis' }),
    mov({ valor: 100, professor_id: 'p1', professor_nome: 'Ana', esporte_nome: 'Padel' }),
    mov({ valor: 500, professor_id: 'p2', professor_nome: 'Rui', esporte_nome: 'Beach Tênis' }),
    mov({ valor: 70, professor_id: 'p2', professor_nome: 'Rui', esporte_nome: 'Beach Tênis', status: 'Não recebido' }),
    mov({ valor: 40 }), // sem professor: fora
    mov({ valor: 60, professor_id: 'p1', professor_nome: 'Ana', esporte_nome: 'Beach Tênis', data: '2026-01-10' }), // fora do período
  ]
  const { dados, esportes } = faturamentoPorProfessor(movs, ['2026-10'])
  assert.deepEqual(esportes, ['Beach Tênis', 'Padel'])
  assert.deepEqual(dados.map(d => [d.professor, d.total]), [['Rui', 500], ['Ana', 300]])
  assert.equal(dados[1]['Padel'], 100)
})
test('professor sem esporte informado aparece como Sem esporte', () => {
  const { esportes } = faturamentoPorProfessor([mov({ professor_id: 'p1', professor_nome: 'Ana' })], ['2026-10'])
  assert.deepEqual(esportes, ['Sem esporte'])
})

test('alunos por modalidade: só ativos, uma vez por esporte+modalidade', () => {
  const alunos = [{ id: 'a', status: 'Ativo' }, { id: 'b', status: 'Ativo' }, { id: 'c', status: 'Inativo' }]
  const mats = [
    { aluno_id: 'a', tipo: 'Clubinho', unidade_id: 'u1', acesso_duas_unidades: false, esporte_nome: 'Beach Tênis' },
    { aluno_id: 'a', tipo: 'Aula', unidade_id: 'u1', acesso_duas_unidades: false, esporte_nome: 'Beach Tênis' },
    { aluno_id: 'a', tipo: 'Aula', unidade_id: 'u1', acesso_duas_unidades: false, esporte_nome: 'Beach Tênis' }, // 2ª aula: não conta de novo
    { aluno_id: 'b', tipo: 'Clubinho', unidade_id: 'u1', acesso_duas_unidades: false, esporte_nome: 'Padel' },
    { aluno_id: 'c', tipo: 'Clubinho', unidade_id: 'u1', acesso_duas_unidades: false, esporte_nome: 'Beach Tênis' }, // inativo
  ]
  const { dados, esportes } = alunosPorModalidade(alunos, mats, null)
  assert.deepEqual(esportes, ['Beach Tênis', 'Padel'])
  const clubinho = dados.find(d => d.modalidade === 'Clubinho')
  assert.deepEqual([clubinho['Beach Tênis'], clubinho['Padel'], clubinho.total], [1, 1, 2])
  assert.equal(dados.find(d => d.modalidade === 'Aulas').total, 1)
})
test('alunos por modalidade respeita a unidade e inclui o combo', () => {
  const alunos = [{ id: 'a', status: 'Ativo' }, { id: 'b', status: 'Ativo' }, { id: 'c', status: 'Ativo' }]
  const mats = [
    { aluno_id: 'a', tipo: 'Clubinho', unidade_id: 'u1', acesso_duas_unidades: false, esporte_nome: 'Beach Tênis' },
    { aluno_id: 'b', tipo: 'Clubinho', unidade_id: 'u2', acesso_duas_unidades: false, esporte_nome: 'Beach Tênis' },
    { aluno_id: 'c', tipo: 'Clubinho', unidade_id: 'u2', acesso_duas_unidades: true, esporte_nome: 'Beach Tênis' },
  ]
  assert.equal(alunosPorModalidade(alunos, mats, 'u1').dados[0].total, 2) // a + combo c
  assert.equal(alunosPorModalidade(alunos, mats, 'u2').dados[0].total, 2) // b + c
})
