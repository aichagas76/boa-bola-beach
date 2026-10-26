// Figuras das modalidades: Clubinho = criança com bola; Aula = capelo; Ranking = medalha.
type Props = { tipo: string; tamanho?: number }

export default function IconeModalidade({ tipo, tamanho = 20 }: Props) {
  if (tipo === 'Clubinho') {
    return (
      <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" role="img" aria-label="Clubinho">
        <title>Clubinho</title>
        <circle cx="11" cy="6.6" r="3.3" fill="#FDD9B5" stroke="#374151" strokeWidth="1" />
        <path d="M7.7 5.8c.4-2.6 1.9-3.8 3.3-3.8s2.9 1.2 3.3 3.8c-1-.9-2.1-1.3-3.3-1.3s-2.3.4-3.3 1.3z" fill="#5b3a1e" />
        <path d="M6.2 21v-5.2c0-2.2 1.8-4 4-4h1.6c2.2 0 4 1.8 4 4V21z" fill="#7DC421" stroke="#374151" strokeWidth="1" strokeLinejoin="round" />
        <path d="M6.6 14.2L4 11.4M15.4 14.2l2.7-2.2" stroke="#374151" strokeWidth="1.6" strokeLinecap="round" fill="none" />
        <circle cx="19.4" cy="9.8" r="2.3" fill="#C8E03A" stroke="#6b7a12" strokeWidth="1" />
      </svg>
    )
  }
  const emoji = tipo === 'Ranking' ? '🥇' : '🎓'
  return <span role="img" aria-label={tipo} title={tipo} style={{ fontSize: tamanho * 0.95, lineHeight: 1 }}>{emoji}</span>
}
