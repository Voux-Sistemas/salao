import { redirect } from 'next/navigation'

/*
  A ENTRADA POR CÓDIGO SAIU.

  O código não tinha canal nenhum até à cliente: o sistema gerava-o e
  deixava-o nos Avisos à espera de alguém do salão, e ninguém o mandava.
  A dona decidiu: nada de códigos. A cliente muda ou desmarca pelo botão
  «Remarcar», e quem ainda tiver este endereço guardado vai lá parar.
*/
export default function Reencaminha(): never {
  redirect('/remarcar')
}
