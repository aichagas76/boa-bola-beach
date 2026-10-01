import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const body = await req.json()

  const response = await fetch('https://api.asaas.com/v3/customers', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'access_token': process.env.ASAAS_API_KEY!
    },
    body: JSON.stringify({
      name: body.nome,
      mobilePhone: body.celular.replace(/\D/g, ''),
      cpfCnpj: body.cpf.replace(/\D/g, ''),
      externalReference: body.aluno_id
    })
  })

  console.log('Asaas status:', response.status)
  const data = await response.json()
  console.log('Asaas response:', JSON.stringify(data))
  return NextResponse.json(data)
}
