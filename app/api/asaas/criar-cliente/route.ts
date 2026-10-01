import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const apiKey = process.env.ASAAS_API_KEY || ''

  console.log('API Key length:', apiKey.length)
  console.log('API Key start:', apiKey.substring(0, 15))

  try {
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

    const text = await response.text()
    console.log('Asaas status:', response.status)
    console.log('Asaas response:', text)

    const data = text ? JSON.parse(text) : {}
    return NextResponse.json(data)
  } catch (e: any) {
    console.error('Erro:', e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
