# Plano de backup e monitoramento — Boa Bola

Objetivo: se algo der errado (alguém apagar dados sem querer, o banco falhar, o site cair), conseguir **voltar atrás** e **ficar sabendo na hora**.

> Planos e preços do Supabase e da Vercel mudam. Antes de assinar, confira os valores e o que cada plano inclui nos painéis deles.

## 1. Situação hoje (verificada na auditoria)
- O sistema usa o banco de **teste** do Supabase. A confirmação de que existe backup automático depende do plano contratado e **não foi verificada** (a assinatura está aguardando você).
- Não há aviso quando o site ou o banco ficam fora do ar.
- Há um aviso por WhatsApp (`WHATSAPP_ALERTA_URL`) para falhas do webhook do Asaas, do cron e das notificações. Ele só funciona se essas variáveis estiverem preenchidas na Vercel.

## 2. Backup (o que você precisa decidir e fazer)
| Item | O que é | Quem faz |
|---|---|---|
| Plano com backup diário | No plano pago do Supabase (Pro) há backup automático diário, guardado por alguns dias. | Você assina no painel do Supabase |
| Recuperação por ponto no tempo (PITR) | Opcional, pago à parte. Permite voltar o banco a qualquer minuto (ex.: "volte para ontem às 14h"). Recomendado quando o Asaas estiver cobrando de verdade. | Você ativa no painel |
| Backup manual semanal (enquanto não assina) | No painel do Supabase, exportar as tabelas principais (alunos, matrículas, movimentações, pagamentos) em CSV e guardar em uma pasta do Drive com a data. | Você, 5 minutos por semana |
| **Teste de restauração** | Backup que nunca foi restaurado não é garantia. Uma vez por trimestre: restaurar numa cópia e conferir se alunos e valores batem. | Eu preparo o roteiro, você acompanha |

**Ordem recomendada:** (1) assinar o plano Pro; (2) conferir que o backup diário aparece em *Database → Backups*; (3) fazer o primeiro teste de restauração em uma cópia; (4) ligar o PITR antes de ativar a cobrança automática do Asaas.

## 3. Monitoramento
### 3.1 Site e banco no ar (já preparado no código)
- Foi criada a rota **`/api/saude`**. Ela responde `{"ok":true}` quando o site e o banco funcionam, e erro 503 quando o banco falha. Não mostra nenhum dado do negócio.
- Para ser avisada: criar uma conta gratuita no **UptimeRobot** (ou similar) e cadastrar o endereço `https://boa-bola-beach.vercel.app/api/saude`, conferindo a cada 5 minutos, com aviso por e-mail e WhatsApp. (Isso é você quem cadastra: envolve sua conta e seus contatos.)

### 3.2 Erros do sistema
- **Vercel → Logs**: erros das rotas (webhook, cron, cobrança) ficam registrados. Conferir uma vez por semana, ou ligar os alertas de erro da Vercel por e-mail.
- **Supabase → Logs e Advisors**: o painel mostra consultas lentas e avisos de segurança. Conferir uma vez por mês.

### 3.3 Avisos automáticos por WhatsApp
- Conferir que `WHATSAPP_ALERTA_URL` e `WHATSAPP_ALERTA_TELEFONE` estão preenchidos na Vercel. Sem eles, falha do webhook do Asaas passa em silêncio.
- Teste: provocar um aviso de teste e ver se chega no seu WhatsApp.

## 4. Rotina sugerida
| Quando | O que | Quem |
|---|---|---|
| Todo dia | Conferir se a tela de Logs não tem erro do Asaas | Gestoras |
| Toda semana | Exportar CSV (enquanto não houver backup automático); olhar Vercel → Logs | Você |
| Todo mês | Supabase → Advisors; conferir se o último backup aparece | Você / eu |
| Todo trimestre | Teste de restauração | Eu + você |

## 5. Critérios para considerar este item concluído
1. Plano com backup diário contratado e o backup do dia aparecendo no painel.
2. Uma restauração testada numa cópia, com alunos e valores conferidos.
3. Monitor de `/api/saude` ativo e um aviso de teste recebido no WhatsApp.
4. Variáveis de alerta conferidas na Vercel.
5. PITR ligado antes de ativar a cobrança automática do Asaas.
