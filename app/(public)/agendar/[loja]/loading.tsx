/**
 * O que se vê enquanto o funil procura o primeiro dia com vaga.
 *
 * Não é um símbolo a girar: é o esqueleto da página que vem a seguir —
 * a tira dos dias e os cartões — para que nada salte de sítio quando o
 * conteúdo chegar. O Next mostra isto sozinho, sem ninguém lhe chamar.
 *
 * `aria-hidden` porque não há aqui nada para ler; quem ouve o ecrã fica
 * com o `aria-busy` da região, e não com dezassete caixas vazias.
 */
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8" aria-busy="true">
      <span className="sr-only">A carregar…</span>

      <div aria-hidden className="space-y-6">
        {/* o título da loja */}
        <div className="a-carregar h-7 w-2/5" />

        {/* a tira dos dias */}
        <div className="flex gap-2 overflow-hidden">
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="a-carregar h-16 w-14 shrink-0" />
          ))}
        </div>

        {/* os cartões das horas */}
        <div className="space-y-3">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="a-carregar h-20 w-full" />
          ))}
        </div>
      </div>
    </div>
  )
}
