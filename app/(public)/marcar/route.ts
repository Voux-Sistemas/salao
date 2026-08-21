import { redirect } from 'next/navigation'

/**
 * O endereco curto do cartaz e da bio do Instagram.
 * So reencaminha para o funil.
 */
export function GET(): never {
  redirect('/agendar')
}
