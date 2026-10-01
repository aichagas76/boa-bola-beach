import { supabase } from '@/lib/supabase'
import { SendNotificationData, Notification } from './types'
import { getTemplate } from './templates'

/**
 * Send a notification (stores in database for processing)
 * In production, this would integrate with Twilio, AWS SNS, etc.
 */
export async function sendNotification(data: SendNotificationData) {
  try {
    const template = getTemplate(data.tipo)
    if (!template) {
      throw new Error(`Template not found for type: ${data.tipo}`)
    }

    const titulo = template.titulo
    const mensagem = template.corpo(data.dados || {})

    const { error } = await supabase.from('notificacoes').insert({
      aluno_id: data.aluno_id,
      tipo: data.tipo,
      titulo,
      mensagem,
      celular: data.celular,
      status: 'pendente',
      tentativas: 0,
      data_criacao: new Date().toISOString(),
    })

    if (error) throw error

    return { success: true, message: 'Notification queued' }
  } catch (error) {
    console.error('Error sending notification:', error)
    throw error
  }
}

/**
 * Get notifications for a student
 */
export async function getNotifications(alunoId: string) {
  const { data, error } = await supabase
    .from('notificacoes')
    .select('*')
    .eq('aluno_id', alunoId)
    .order('data_criacao', { ascending: false })

  if (error) throw error
  return data as Notification[]
}

/**
 * Send payment reminders (run daily)
 * Checks for payments due in the next 3 days
 */
export async function sendPaymentReminders() {
  try {
    const { data: alunos } = await supabase
      .from('alunos')
      .select('id, nome, celular, data_vencimento')
      .eq('status', 'Ativo')

    if (!alunos) return { sent: 0 }

    let sent = 0

    for (const aluno of alunos) {
      if (!aluno.data_vencimento || !aluno.celular) continue

      const vencimento = new Date(aluno.data_vencimento + 'T00:00:00')
      const hoje = new Date()
      const diasAte = Math.ceil((vencimento.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))

      // Send reminder if payment is due in 1-3 days
      if (diasAte > 0 && diasAte <= 3) {
        const { data: matriculas } = await supabase
          .from('matriculas')
          .select('valor')
          .eq('aluno_id', aluno.id)

        const valor = matriculas?.reduce((acc, m) => acc + (m.valor ?? 0), 0) || 0

        await sendNotification({
          aluno_id: aluno.id,
          celular: aluno.celular,
          tipo: 'payment_reminder',
          dados: {
            nome: aluno.nome,
            dias: diasAte,
            data_vencimento: vencimento.toLocaleDateString('pt-BR'),
            valor: valor.toFixed(2),
          },
        })

        sent++
      }
    }

    console.log(`Payment reminders sent: ${sent}`)
    return { sent }
  } catch (error) {
    console.error('Error sending payment reminders:', error)
    throw error
  }
}

/**
 * Send overdue payment alerts (run daily)
 */
export async function sendOverdueAlerts() {
  try {
    const { data: movimentacoes } = await supabase
      .from('movimentacoes')
      .select('id, aluno_ref_id, valor, data_vencimento, status')
      .eq('tipo', 'Entrada')
      .eq('status', 'Não recebido')

    if (!movimentacoes) return { sent: 0 }

    let sent = 0
    const processedAlunos = new Set<string>()

    for (const mov of movimentacoes) {
      if (!mov.aluno_ref_id || processedAlunos.has(mov.aluno_ref_id)) continue

      if (!mov.data_vencimento) continue

      const vencimento = new Date(mov.data_vencimento + 'T00:00:00')
      const hoje = new Date()
      const diasAtrasado = Math.floor((hoje.getTime() - vencimento.getTime()) / (1000 * 60 * 60 * 24))

      if (diasAtrasado > 0) {
        const { data: alunos } = await supabase
          .from('alunos')
          .select('nome, celular')
          .eq('id', mov.aluno_ref_id)
          .single()

        if (alunos?.celular) {
          await sendNotification({
            aluno_id: mov.aluno_ref_id,
            celular: alunos.celular,
            tipo: 'payment_overdue',
            dados: {
              nome: alunos.nome,
              dias_atrasado: diasAtrasado,
              data_vencimento: vencimento.toLocaleDateString('pt-BR'),
              valor: (mov.valor ?? 0).toFixed(2),
            },
          })

          processedAlunos.add(mov.aluno_ref_id)
          sent++
        }
      }
    }

    console.log(`Overdue alerts sent: ${sent}`)
    return { sent }
  } catch (error) {
    console.error('Error sending overdue alerts:', error)
    throw error
  }
}
