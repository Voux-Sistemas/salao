'use client'

import { useEffect, useState } from 'react'

/**
 * O LINK QUE ELA GUARDA — a segunda porta.
 *
 * A sessão que nasce ao marcar resolve o caso normal: marcou no
 * telemóvel, desmarca no telemóvel. Este link é para o outro caso — o
 * computador do trabalho, o telemóvel do marido, o navegador que ela
 * limpou.
 *
 * VEM DELA, E NÃO DO SALÃO. Foi essa a razão de existir: a mensagem de
 * confirmação depende de alguém a enviar, e ao balcão ninguém tem tempo.
 * Um link que ela copia no acto não depende de ninguém.
 *
 * É CLIENTE POR CAUSA DO «COPIAR», e mais nada. O botão precisa da área
 * de transferência do navegador, que não existe no servidor. Sem ele o
 * endereço continua lá, à vista, para se copiar à mão — que é o que
 * acontece nos navegadores que recusam a permissão.
 */
export function GuardarLink({ chave }: { chave: string }) {
  const [copiado, setCopiado] = useState(false)

  const caminho = `/m/${chave}`

  /*
    O ENDEREÇO COMPLETO SÓ EXISTE NO NAVEGADOR — e tem de aparecer só
    depois de a página assentar.

    Lê-lo durante o desenho dava a resposta certa no navegador e a
    errada no servidor, que não tem `window`: o React comparava as duas
    e queixava-se de hidratação. Fica no `useEffect`, que só corre do
    lado de cá, e até lá mostra-se o caminho — que já se lê e já se
    copia à mão.
  */
  const [inteiro, setInteiro] = useState(caminho)
  useEffect(() => {
    setInteiro(`${window.location.origin}${caminho}`)
  }, [caminho])

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(inteiro)
      setCopiado(true)
      window.setTimeout(() => setCopiado(false), 2400)
    } catch {
      // Navegador que recusa a área de transferência: o endereço está à
      // vista e copia-se à mão. Não vale um aviso de erro.
    }
  }

  return (
    <div className="mt-8 border-t border-[var(--line-soft)] pt-6">
      <p className="text-[0.8125rem] font-semibold text-[var(--ink)]">
        Vai usar outro aparelho?
      </p>
      <p className="mt-1 text-[0.8125rem] leading-relaxed text-[var(--ink-muted)]">
        Guarde este link. Abre esta marcação em qualquer telemóvel ou
        computador, sem precisar de entrar.
      </p>

      <div className="mt-3 flex items-center gap-3 rounded-[var(--radius)] bg-[var(--surface-2)] px-3 py-2.5">
        <code className="min-w-0 flex-1 break-all font-mono text-[0.6875rem] text-[var(--ink-muted)]">
          {inteiro}
        </code>
        <button
          type="button"
          onClick={copiar}
          className="shrink-0 text-[0.75rem] font-semibold text-[var(--accent)] underline-offset-2 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          {copiado ? 'Copiado' : 'Copiar'}
        </button>
      </div>

      <p className="mt-2 text-[0.6875rem] leading-relaxed text-[var(--ink-faint)]">
        O link abre só esta marcação — não mostra mais nada da sua conta.
      </p>
    </div>
  )
}
