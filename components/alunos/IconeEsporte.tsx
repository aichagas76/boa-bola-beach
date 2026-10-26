// Figuras dos esportes: a bola de cada esporte, grande e fácil de enxergar mesmo em tamanho pequeno.
type Props = { nome: string; tamanho?: number }

export default function IconeEsporte({ nome, tamanho = 22 }: Props) {
  const comum = { width: tamanho, height: tamanho, viewBox: '0 0 24 24', role: 'img', 'aria-label': nome }

  if (nome === 'Tênis') {
    // Bola de tênis: verde-amarelada com as duas curvas brancas
    return (
      <svg {...comum}>
        <title>{nome}</title>
        <circle cx="12" cy="12" r="10.5" fill="#C8E03A" stroke="#7c8a14" strokeWidth="1" />
        <path d="M3.3 6.2c4.2 1.4 6.4 5 6 11.6M20.7 17.8c-4.2-1.4-6.4-5-6-11.6" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    )
  }

  if (nome === 'Padel') {
    // Bola de padel: amarelo vivo, duas linhas brancas finas (em cima e embaixo) e o nome escrito no meio
    return (
      <svg {...comum}>
        <title>{nome}</title>
        <circle cx="12" cy="12" r="10.5" fill="#E4EA1F" stroke="#7c8a14" strokeWidth="1" />
        <path d="M3 7.6c5.4-1.8 12.6-1.8 18 0M3 16.4c5.4 1.8 12.6 1.8 18 0" fill="none" stroke="#fff" strokeWidth="1" strokeLinecap="round" />
        <text x="12" y="13.8" textAnchor="middle" fontSize="5" fontWeight="800" fontFamily="Arial, Helvetica, sans-serif" fill="#1f2937">PADEL</text>
      </svg>
    )
  }

  if (nome === 'Beach Tênis') {
    // Bola de beach tênis (pressão reduzida): duas cores, amarelo-limão e laranja, divididas por uma curva em S
    return (
      <svg {...comum}>
        <title>{nome}</title>
        <defs>
          <clipPath id="bola-beach-tenis"><circle cx="12" cy="12" r="10.5" /></clipPath>
        </defs>
        <g clipPath="url(#bola-beach-tenis)">
          <rect width="24" height="24" fill="#D9EB2F" />
          <path d="M0 0H24V5C15 2 8 7 10 13C11.5 18 6 22 0 20Z" fill="#FF6A1A" />
        </g>
        <circle cx="12" cy="12" r="10.5" fill="none" stroke="#7c6a10" strokeWidth="1" />
      </svg>
    )
  }

  if (nome === 'Pickleball') {
    // Bola de pickleball: plástico amarelo com furos
    return (
      <svg {...comum}>
        <title>{nome}</title>
        <circle cx="12" cy="12" r="10.5" fill="#FDE047" stroke="#a16207" strokeWidth="1" />
        {[[12, 6], [7.2, 9], [16.8, 9], [12, 12.2], [7, 15.4], [17, 15.4], [12, 18.2], [9.6, 4.8], [14.4, 4.8]].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="1.35" fill="#a16207" />
        ))}
      </svg>
    )
  }

  // Esporte novo, ainda sem figura própria: bola neutra
  return (
    <svg {...comum}>
      <title>{nome}</title>
      <circle cx="12" cy="12" r="10.5" fill="#E5E7EB" stroke="#6B7280" strokeWidth="1" />
    </svg>
  )
}
