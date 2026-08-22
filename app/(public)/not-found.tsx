import { getLanguage } from '@/lib/i18n'
import { PROBLEM } from '@/lib/i18n/problem'
import { Problem } from '@/components/problem'
import { ButtonLink } from '@/components/ui'

/**
 * Loja que não existe, marcação que não é dela, link antigo de uma
 * confirmação. Cai aqui dentro da moldura pública — cabeçalho e rodapé
 * inteiros — para que a saída esteja sempre à mão.
 */
export default async function PublicNotFound() {
  const text = PROBLEM[await getLanguage()]

  return (
    <Problem
      eyebrow={text.notFoundEyebrow}
      title={text.notFoundTitle}
      body={text.notFoundBody}
      actions={
        <>
          <ButtonLink href="/agendar" size="lg">
            {text.book}
          </ButtonLink>
          <ButtonLink href="/" variant="outline" size="lg">
            {text.home}
          </ButtonLink>
        </>
      }
    />
  )
}
