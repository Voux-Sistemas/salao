/**
 * O QUE PODE IR PARA A BASE COMO IDENTIFICADOR.
 *
 * Um identificador chega quase sempre de fora: da barra de endereço, de
 * um campo escondido do formulário, de um endereço partilhado no
 * WhatsApp. E o Postgres não é tolerante — dar-lhe um texto que não seja
 * um UUID não devolve «não encontrei», levanta erro. O que a cliente vê
 * não é o aviso limpo que o código já tinha preparado; é o ecrã
 * vermelho.
 *
 * Esta verificação já existia, escrita à mão, em doze ficheiros, com
 * dois nomes diferentes — e faltava exactamente nos dois sítios onde a
 * cliente lhe podia tocar: o formulário de cancelamento e a rota das
 * imagens. É o que acontece a uma regra que se copia em vez de se
 * guardar num sítio só.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value: string): boolean {
  return UUID.test(value)
}
