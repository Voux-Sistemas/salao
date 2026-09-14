/**
 * AS MARCAÇÕES QUE O TELEMÓVEL GUARDA.
 *
 * Cada recibo escreve a chave da marcação num cookie do próprio
 * navegador, e o botão «Remarcar» lê-o do lado do servidor — é assim que
 * a cliente vê as marcações dela sem escrever nada e sem código.
 *
 * ESCREVE-SE NO NAVEGADOR, NO RECIBO, E NUNCA NA ACÇÃO DE MARCAR. Essa
 * acção partiu duas vezes por lhe porem um cookie em cima (ver o
 * histórico de 4 de setembro); o recibo já é depois de a marcação estar
 * gravada, e ali um cookie não arrisca nada.
 *
 * Não é segredo nenhum a mais do que o link: a chave é a mesma que vai no
 * endereço `/m/…`. Guardam-se as últimas doze — a casa não tem clientes
 * com doze marcações por vir, e o cookie fica pequeno.
 */

export const COOKIE_MARCACOES = 'nr_marcacoes'

const MAXIMO = 12
const UM_ANO = 60 * 60 * 24 * 365

export function lerChaves(valor: string | undefined | null): string[] {
  if (!valor) return []
  return decodeURIComponent(valor).split('.').filter(Boolean)
}

/** Só no navegador. Junta as chaves novas às que lá estavam. */
export function guardarChaves(novas: readonly string[]): void {
  if (typeof document === 'undefined' || novas.length === 0) return
  const actual = document.cookie
    .split('; ')
    .find((c) => c.startsWith(`${COOKIE_MARCACOES}=`))
    ?.slice(COOKIE_MARCACOES.length + 1)
  const todas = [...new Set([...novas, ...lerChaves(actual)])].slice(0, MAXIMO)
  const seguro = location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${COOKIE_MARCACOES}=${encodeURIComponent(todas.join('.'))}; Path=/; Max-Age=${UM_ANO}; SameSite=Lax${seguro}`
}
