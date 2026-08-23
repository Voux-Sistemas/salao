/**
 * O PREÇÁRIO.
 *
 * A montra e a página da loja mostram a mesma lista com a mesma forma;
 * vive aqui para não haver duas versões a divergir. Quem fecha as
 * categorias ao telemóvel é o `CollapseGroup`, partilhado com o funil.
 */

/**
 * UMA LINHA DO PREÇÁRIO.
 *
 * Ao computador é a linha de ementa de sempre: nome, pontilhado,
 * duração, preço. Ao telemóvel não sobra largura para quatro colunas —
 * era aí que o "1 h 30" partia ao meio — por isso o nome fica com a
 * linha toda e a duração e o preço descem para a linha de baixo, uma em
 * cada ponta. Sempre, mesmo quando o nome era curto: assim os preços
 * caem todos à mesma distância e a lista lê-se de um golpe.
 */
export function PriceLine({
  name,
  duration,
  price,
  from,
  description,
}: {
  name: string
  duration: string
  price: string
  /** O "desde" que antecede o preço na montra. Na loja não existe. */
  from?: string
  description?: string | null
}) {
  return (
    <li className="mt-5 first:mt-0">
      <div className="sm:flex sm:items-baseline sm:gap-3">
        <span className="text-[0.9375rem] text-[var(--ink)]">{name}</span>
        <span className="hidden flex-1 translate-y-[-3px] border-b border-dotted border-[var(--line)] sm:block" />
        {/* `sm:contents` desfaz esta caixa acima dos 640px: os dois filhos
            passam a ser colunas da linha de cima, a seguir ao pontilhado. */}
        <div className="mt-0.5 flex items-baseline justify-between gap-3 sm:contents">
          <span className="whitespace-nowrap tabular text-[0.75rem] text-[var(--ink-faint)]">
            {duration}
          </span>
          <span className="whitespace-nowrap tabular text-[0.9375rem] text-[var(--ink-muted)]">
            {from ? <span className="text-[0.75rem] text-[var(--ink-faint)]">{from} </span> : null}
            {price}
          </span>
        </div>
      </div>
      {description ? (
        <p className="mt-1.5 max-w-md text-[0.75rem] leading-relaxed text-[var(--ink-faint)]">
          {description}
        </p>
      ) : null}
    </li>
  )
}
