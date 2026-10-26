// Figuras dos esportes (SVG simples, legíveis em tamanho pequeno).
const BOLA_TENIS = '#C8E03A'

type Props = { nome: string; tamanho?: number }

export default function IconeEsporte({ nome, tamanho = 22 }: Props) {
  const comum = { width: tamanho, height: tamanho, viewBox: '0 0 24 24', fill: 'none', stroke: '#374151', strokeWidth: 1.4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, role: 'img', 'aria-label': nome }

  if (nome === 'Tênis') {
    // Raquete de cordas + bola amarela
    return (
      <svg {...comum}>
        <title>{nome}</title>
        <g transform="rotate(-40 10 10)">
          <ellipse cx="10" cy="8" rx="4.6" ry="6.2" />
          <path d="M10 1.8v12.4M5.4 8h9.2M6.4 4.6h7.2M6.4 11.4h7.2" strokeWidth="0.8" />
          <path d="M10 14.2v6" strokeWidth="2.2" />
        </g>
        <circle cx="19" cy="6" r="3" fill={BOLA_TENIS} stroke="#6b7a12" />
        <path d="M16.3 5c1.4.9 3.4.9 5.4 0" stroke="#fff" strokeWidth="0.9" />
      </svg>
    )
  }

  if (nome === 'Beach Tênis') {
    // Raquete maciça (sem cordas, com furinhos) + bola
    return (
      <svg {...comum}>
        <title>{nome}</title>
        <g transform="rotate(-40 10 10)">
          <ellipse cx="10" cy="8" rx="4.8" ry="6.4" fill="#FDE7C2" />
          <circle cx="8" cy="6" r="0.6" fill="#374151" stroke="none" />
          <circle cx="12" cy="6" r="0.6" fill="#374151" stroke="none" />
          <circle cx="10" cy="8.4" r="0.6" fill="#374151" stroke="none" />
          <circle cx="8" cy="10.8" r="0.6" fill="#374151" stroke="none" />
          <circle cx="12" cy="10.8" r="0.6" fill="#374151" stroke="none" />
          <path d="M10 14.4v5.6" strokeWidth="2.6" />
        </g>
        <circle cx="19" cy="6" r="3" fill="#F59E0B" stroke="#92400e" />
      </svg>
    )
  }

  if (nome === 'Pickleball') {
    // Pá retangular de cantos arredondados + bola furada
    return (
      <svg {...comum}>
        <title>{nome}</title>
        <g transform="rotate(-35 10 10)">
          <rect x="5.2" y="1.4" width="9.6" height="11.6" rx="3.2" fill="#BFE3F2" />
          <path d="M10 13v6.6" strokeWidth="2.6" />
        </g>
        <circle cx="19" cy="17.5" r="3.2" fill="#FFF7C2" stroke="#9a8a10" />
        <circle cx="18" cy="16.6" r="0.55" fill="#9a8a10" stroke="none" />
        <circle cx="20.2" cy="17" r="0.55" fill="#9a8a10" stroke="none" />
        <circle cx="19" cy="19" r="0.55" fill="#9a8a10" stroke="none" />
      </svg>
    )
  }

  // Padel: raquete redonda/em gota, toda furada + bola
  return (
    <svg {...comum}>
      <title>{nome}</title>
      <g transform="rotate(-40 10 10)">
        <path d="M10 1.6c3.6 0 5.6 2.4 5.6 5.4 0 2.8-2 5.2-5.6 6.4C6.4 12.2 4.4 9.8 4.4 7c0-3 2-5.4 5.6-5.4z" fill="#D8F1D0" />
        <circle cx="8" cy="5" r="0.55" fill="#374151" stroke="none" />
        <circle cx="12" cy="5" r="0.55" fill="#374151" stroke="none" />
        <circle cx="10" cy="7.2" r="0.55" fill="#374151" stroke="none" />
        <circle cx="7.4" cy="8.6" r="0.55" fill="#374151" stroke="none" />
        <circle cx="12.6" cy="8.6" r="0.55" fill="#374151" stroke="none" />
        <circle cx="10" cy="10.6" r="0.55" fill="#374151" stroke="none" />
        <path d="M10 13.4v6.4" strokeWidth="2.6" />
      </g>
      <circle cx="19" cy="6" r="3" fill={BOLA_TENIS} stroke="#6b7a12" />
    </svg>
  )
}
