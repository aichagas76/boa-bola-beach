import { timingSafeEqual } from 'node:crypto'

/** Compara dois textos sem vazar tamanho/conteúdo pelo tempo de resposta. */
export function textoIgual(a: string | null | undefined, b: string | null | undefined) {
  if (!a || !b) return false
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  return ba.length === bb.length && timingSafeEqual(ba, bb)
}

/** Confere "Authorization: Bearer <segredo>". Sem segredo configurado, nega sempre. */
export function bearerValido(header: string | null, segredo: string | undefined) {
  if (!segredo) return false
  return textoIgual(header, `Bearer ${segredo}`)
}
