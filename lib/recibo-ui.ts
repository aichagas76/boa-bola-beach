import { avisar } from '@/lib/avisos-ui'
import { htmlDoRecibo, montarRecibo, type DadosRecibo } from '@/lib/recibo'

/** Abre o recibo numa janela, com o logo, pronta para imprimir ou salvar em PDF. */
export function abrirRecibo(dados: DadosRecibo) {
  const recibo = montarRecibo(dados)
  const janela = window.open('', '_blank', 'width=900,height=700')
  if (!janela) { avisar('O navegador bloqueou a janela do recibo. Libere os pop-ups deste site e clique de novo.'); return }
  janela.document.write(htmlDoRecibo(recibo, dados.unidade, `${window.location.origin}/BB%20logo.jpg`))
  janela.document.close()
}
