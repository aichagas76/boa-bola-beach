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
    // A bola de padel é igual à de tênis; a raquete (maciça, furada) junto diferencia os dois
    return (
      <svg {...comum}>
        <title>{nome}</title>
        <g transform="rotate(-38 9 10)">
          <path d="M9 1.2c3.7 0 5.8 2.5 5.8 5.6 0 2.9-2.1 5.4-5.8 6.6-3.7-1.2-5.8-3.7-5.8-6.6C3.2 3.7 5.3 1.2 9 1.2z" fill="#BFDBFE" stroke="#1E3A8A" strokeWidth="1.1" />
          <circle cx="7" cy="4.8" r="0.7" fill="#1E3A8A" />
          <circle cx="11" cy="4.8" r="0.7" fill="#1E3A8A" />
          <circle cx="9" cy="7" r="0.7" fill="#1E3A8A" />
          <circle cx="6.4" cy="8.8" r="0.7" fill="#1E3A8A" />
          <circle cx="11.6" cy="8.8" r="0.7" fill="#1E3A8A" />
          <circle cx="9" cy="10.6" r="0.7" fill="#1E3A8A" />
          <path d="M9 13.4v7.4" stroke="#1E3A8A" strokeWidth="2.4" strokeLinecap="round" />
        </g>
        <circle cx="17" cy="17" r="5.4" fill="#C8E03A" stroke="#7c8a14" strokeWidth="1" />
        <path d="M12.7 14.4c2.3.6 3.6 2.4 3.4 5.2M21.3 19.6c-2.3-.6-3.6-2.4-3.4-5.2" fill="none" stroke="#fff" strokeWidth="1.1" strokeLinecap="round" />
      </svg>
    )
  }

  if (nome === 'Beach Tênis') {
    // Bola de beach tênis: laranja, mais macia, com a costura em areia
    return (
      <svg {...comum}>
        <title>{nome}</title>
        <circle cx="12" cy="12" r="10.5" fill="#FB923C" stroke="#9a3412" strokeWidth="1" />
        <path d="M3.3 6.2c4.2 1.4 6.4 5 6 11.6M20.7 17.8c-4.2-1.4-6.4-5-6-11.6" fill="none" stroke="#FEF3C7" strokeWidth="1.7" strokeLinecap="round" />
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
