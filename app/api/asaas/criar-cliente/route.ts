import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const body = await req.json()

  const apiKey = process.env.ASAAS_API_KEY || ''

  const response = await fetch('https://api.asaas.com/v3/customers', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'access_token': apiKey
    },
    body: JSON.stringify({
      name: body.nome,
      mobilePhone: body.celular.replace(/\D/g, ''),
      cpfCnpj: body.cpf.replace(/\D/g, ''),
      externalReference: body.aluno_id
    })
  })

  const data = await response.json()
  return NextResponse.json(data)
}
