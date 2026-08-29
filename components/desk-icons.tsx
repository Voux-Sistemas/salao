import type { ReactNode } from 'react'

/**
 * OS ÍCONES DA CASA, desenhados à mão em traço de 1.5px — o mesmo fio
 * fino da grinalda do logótipo. Nada de bibliotecas: cada glifo é um
 * caminho curto, cor = currentColor, e escala pelo className.
 */
function Glyph({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      {children}
    </svg>
  )
}

/** O dia inteiro num relance: um sol de traço fino. */
export function IconDay({ className }: { className?: string }) {
  return (
    <Glyph className={className}>
      <circle cx="12" cy="12" r="3.6" />
      <path d="M12 3.2v2.1M12 18.7v2.1M3.2 12h2.1M18.7 12h2.1" />
      <path d="M5.9 5.9l1.5 1.5M16.6 16.6l1.5 1.5M18.1 5.9l-1.5 1.5M7.4 16.6l-1.5 1.5" />
    </Glyph>
  )
}

/** A agenda: um calendário com o dia assinalado. */
export function IconAgenda({ className }: { className?: string }) {
  return (
    <Glyph className={className}>
      <rect x="3.75" y="5" width="16.5" height="15" rx="1" />
      <path d="M3.75 9.5h16.5M8 3v3.5M16 3v3.5" />
      <circle cx="8.4" cy="13.6" r="1" fill="currentColor" stroke="none" />
    </Glyph>
  )
}

/** Avisos: o sino do balcão. */
export function IconBell({ className }: { className?: string }) {
  return (
    <Glyph className={className}>
      <path d="M6.2 10.2a5.8 5.8 0 0 1 11.6 0c0 3 .6 4.7 1.5 5.9.3.4 0 .9-.5.9H5.2c-.5 0-.8-.5-.5-.9.9-1.2 1.5-2.9 1.5-5.9Z" />
      <path d="M10.2 19.8a1.9 1.9 0 0 0 3.6 0" />
    </Glyph>
  )
}

/** Caixa: a nota com o círculo ao centro. */
export function IconCash({ className }: { className?: string }) {
  return (
    <Glyph className={className}>
      <rect x="2.75" y="6.5" width="18.5" height="11" rx="1" />
      <circle cx="12" cy="12" r="2.4" />
      <path d="M6 11.4v1.2M18 11.4v1.2" />
    </Glyph>
  )
}

/** Clientes: uma figura de busto, sem rosto. */
export function IconClients({ className }: { className?: string }) {
  return (
    <Glyph className={className}>
      <circle cx="12" cy="8.2" r="3.4" />
      <path d="M5.4 19.6c1.3-3.5 3.8-5.2 6.6-5.2s5.3 1.7 6.6 5.2" />
    </Glyph>
  )
}

/** Gestão: três réguas de afinação. */
export function IconManage({ className }: { className?: string }) {
  return (
    <Glyph className={className}>
      <path d="M4 7h10.1M17.9 7H20" />
      <circle cx="16" cy="7" r="1.8" />
      <path d="M4 12h3.1M10.9 12H20" />
      <circle cx="9" cy="12" r="1.8" />
      <path d="M4 17h7.1M14.9 17H20" />
      <circle cx="13" cy="17" r="1.8" />
    </Glyph>
  )
}

/** Sair: a porta e a seta. */
export function IconSignOut({ className }: { className?: string }) {
  return (
    <Glyph className={className}>
      <path d="M13.5 4.5H7A1.5 1.5 0 0 0 5.5 6v12A1.5 1.5 0 0 0 7 19.5h6.5" />
      <path d="M16 8.5l3.5 3.5L16 15.5M19.5 12H10.5" />
    </Glyph>
  )
}

export function IconClose({ className }: { className?: string }) {
  return (
    <Glyph className={className}>
      <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
    </Glyph>
  )
}

export function IconCheck({ className }: { className?: string }) {
  return (
    <Glyph className={className}>
      <path d="M5.5 12.8l4.2 4.2 8.8-9.6" />
    </Glyph>
  )
}

/** A bolha de conversa — WhatsApp sem logotipo alheio. */
/**
 * O WHATSAPP — E ESTE NÃO É DESENHADO À MANEIRA DA CASA.
 *
 * Todos os outros glifos deste ficheiro são traço de 1.5px. Este é
 * cheio, porque não é um símbolo nosso: é a marca de outra gente, e uma
 * marca redesenhada no fio fino da casa deixa de se reconhecer — que é
 * exactamente o único trabalho que ela tem aqui. Quem nunca leu o botão
 * sabe o que ele faz por causa desta forma.
 *
 * Continua a ser um caminho curto neste ficheiro, sem ir buscar nada a
 * lado nenhum, e continua a pintar-se com `currentColor`.
 */
export function IconWhatsApp({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className={className}
    >
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.86 9.86 0 0 0 4.79 1.21h.01c5.46 0 9.91-4.45 9.91-9.91C21.96 6.45 17.5 2 12.04 2Zm0 18.15h-.01c-1.52 0-3.01-.41-4.31-1.18l-.31-.18-3.2.84.85-3.12-.2-.32a8.19 8.19 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.24-8.23 2.2 0 4.27.86 5.83 2.41a8.18 8.18 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.24 8.23Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.12-.17.25-.64.81-.79.98-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.12-.14.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.23.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.11-.23-.17-.48-.29Z" />
    </svg>
  )
}

export function IconChat({ className }: { className?: string }) {
  return (
    <Glyph className={className}>
      <path d="M12 4.5a7.5 7.5 0 0 0-6.4 11.4l-1.1 3.6 3.7-1A7.5 7.5 0 1 0 12 4.5Z" />
      <path d="M8.8 12h.01M12 12h.01M15.2 12h.01" />
    </Glyph>
  )
}
