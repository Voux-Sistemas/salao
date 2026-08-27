# Plano de acção

Um item de cada vez, por esta ordem. Cada bloco só arranca quando o
anterior estiver fechado — assim nada se faz duas vezes.

---

> **Estado.** As fases 0 a 4 estão feitas: o conteúdo real está no
> site, o funil e a agenda funcionam no telemóvel, a gestão aproveita o
> ecrã largo, e as fotos das duas lojas estão carregadas. Falta o ecrã
> para a dona trocar essas fotos sozinha (4.3) e a Fase 5.
>
> O que ela ainda não disse está suprido por palpites, arrolados em
> `PENDENCIAS.md`.

---

## Fase 0 — O que preciso de si (bloqueia tudo o resto)

Isto vem primeiro de propósito. Afinar ecrãs contra dados de mentira e
depois trocar pelo conteúdo real é fazer o trabalho duas vezes: nomes
verdadeiros são mais compridos, o preçário verdadeiro tem outro
tamanho, e as fotos verdadeiras têm outra forma. Com o conteúdo certo
lá dentro, o que se afina fica afinado.

- [x] **0.1 — Preçário e serviços.** Formato em `CONTEUDO.md`.
- [x] **0.2 — Fotos das duas lojas.** Ficheiros para uma pasta; eu trato
      do resto.
- [x] **0.3 — Dados reais das lojas.** Morada, telefone, WhatsApp,
      horário de funcionamento de cada uma.
- [x] **0.4 — Equipa.** Nomes, que serviços cada uma faz, em que loja.

---

## Fase 1 — Telemóvel: mini-site e marcação

O que a cliente vê. É aqui que quase todo o tráfego vai bater, e vem
de telemóvel.

- [x] 1.1 — Auditar cada ecrã público num telemóvel real (390x844) e
      apontar tudo o que parte.
- [x] 1.2 — Mini-site (`/loja/[loja]`): fotos, horário, mapa, botão de
      marcar sempre à mão.
- [x] 1.3 — Funil (`/agendar/...`): escolher serviços, profissional,
      dia e hora com o polegar. Alvos de toque grandes, sem zoom
      acidental, sem teclado a tapar o botão.
- [x] 1.4 — Confirmação e `/pronto`: o ecrã que ela mostra à porta.

## Fase 2 — Telemóvel: o ecrã da profissional

- [x] 2.1 — Repensar a `agenda-grid` para telemóvel. Hoje é uma grelha
      de horas x colunas: não cabe. Para a profissional a coluna é uma
      só (ela própria), portanto vira lista vertical do dia.
- [x] 2.2 — Comanda no telemóvel: abrir, juntar serviços, receber,
      fechar — tudo com uma mão.
- [x] 2.3 — Botão de WhatsApp da cliente a um toque.

## Fase 3 — Computador: a gestão

A dona e a gerente trabalham sentadas ao computador. Aqui a ênfase
inverte-se: aproveitar o ecrã largo em vez de o desperdiçar.

- [x] 3.1 — Agenda de dia inteiro com todas as profissionais lado a
      lado, sem fazer scroll horizontal.
- [x] 3.2 — Painel da dona: números e gráficos a usar a largura toda.
- [x] 3.3 — Tabelas de gestão (serviços, equipa, clientes, comissões)
      com mais colunas visíveis de uma vez.
- [x] 3.4 — Caixa: fecho lado a lado com o contado.

## Fase 4 — Fotos: onde vivem

- [x] 4.1 — Decidir o sítio: pasta no repositório (simples, muda com um
      deploy) ou Supabase Storage (muda sem deploy, precisa de ecrã).
- [x] 4.2 — Encher a `unit_photo` das duas lojas.
- [ ] 4.3 — Se for Storage: ecrã de carregar fotos na gestão da loja.

## Fase 5 — Antes de abrir ao público

- [x] 5.1 — Apagar a rede de demonstração.
- [ ] 5.2 — Contas reais, senhas reais, `SETUP_CODE` novo.
- [x] 5.3 — Domínio proprio e `NEXT_PUBLIC_SITE_URL` a apontar para ele.
