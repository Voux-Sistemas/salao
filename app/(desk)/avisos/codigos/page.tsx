import { redirect } from 'next/navigation'

/*
  «CÓDIGOS DE ACESSO» SAIU DOS AVISOS.

  O site deixou de gerar códigos para a cliente — ela muda ou desmarca
  sozinha pelo «Remarcar». Sem códigos, esta lista ficava sempre vazia.
*/
export default function Reencaminha(): never {
  redirect('/avisos')
}
