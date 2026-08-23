# Continuar daqui

Uma página. O resto está nos ficheiros do fim.

---

## 1 · Pôr a correr (10 minutos)

Precisa de **Node 22** e de **uma base Postgres só sua** — um projecto
Supabase gratuito é o caminho mais curto. **Nunca aponte para a base de
produção:** é o salão a sério, com clientes a marcar.

```bash
git clone https://github.com/Voux-Sistemas/salao.git
cd salao
npm install
cp .env.example .env          # preencha DATABASE_URL e SESSION_SECRET
npm run db:migrate            # cria o esquema
node scripts/seed-real.mjs    # enche com o salão verdadeiro
npm run dev                   # http://localhost:3000
```

`SESSION_SECRET` gera-se com:
`node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`

**Entrar** em `/entrar`. O `seed-real.mjs` dá a toda a gente a mesma
palavra-passe de arranque, `nohora2026` — **serve só para a base que
está na sua máquina**. Em produção essa senha já não abre nada: foi
apagada pelo `scripts/arrancar.mjs`, e cada pessoa tem a sua.


| Telefone | Quem | Vê |
|---|---|---|
| `+351934730344` | Nohora Ramirez | tudo, nas duas lojas |
| `+351930000001` | Ariadna | só a agenda dela |
| `+351930000003` | Nana | só a agenda dela |

---

## 2 · Onde parámos

O sistema está **completo e no ar** em <https://salaonr.netlify.app>.
Agenda, comanda, caixa, clientes, comissões, montra pública e funil de
marcação — tudo feito e a funcionar.

Entrou o **conteúdo verdadeiro do salão**: 67 serviços com preço, as
duas lojas (Valongo e Maia), as cinco profissionais com escalas, e as
nove fotografias.

Fechou a **passagem do telemóvel**: o preçário já se lê num ecrã de
bolso, as categorias abrem ao toque, o funil encolheu de 9863 para
2249 px, os campos deixaram de dar zoom no iPhone e os alvos de toque
estão todos nos 44 px.

E fechou a **preparação para abrir a casa**:

- **As fotografias passaram a trabalhar.** Estavam quase todas na
  galeria do fim da montra. Agora abrem a página, ilustram cada casa
  na escolha de loja e podem ilustrar cada serviço — a coluna
  `service.image_url` e um selector, na gestão, que oferece as nove
  fotografias da casa em vez de pedir um endereço. Sem fotografia sai
  o monograma sobre papel (`components/photo.tsx`), que é o desenho
  normal e não uma falha.
- **A ligação à base passou a ser cifrada.** O condutor não pedia TLS
  e o Supabase aceita texto simples: nomes, telefones e a própria
  senha da ligação iam pela internet em claro. `lib/db.ts` agora
  obriga a `ssl: 'require'` fora de casa.
- **Morreu a palavra-passe partilhada.** O seed dava a mesma senha às
  cinco pessoas e essa senha está escrita num repositório público —
  quem lesse o código entrava como dona, na rede toda. O
  `scripts/arrancar.mjs` apagou-a em produção e fechou as sessões
  abertas com ela.
- **Saiu o nível «Suporte»**, que era uma porta a mais para uma casa
  com três degraus.
- **`scripts/estado.mjs`** diz, numa página, o que está na base e o
  que falta antes de alguém usar isto a sério.

**Falta o mesmo do outro lado: a gestão ao computador.**

---

## 3 · O que fazer a seguir

Por esta ordem. Está tudo detalhado em
[PENDENCIAS.md](PENDENCIAS.md) secção B e em [ROADMAP.md](ROADMAP.md).

1. **A gestão ao computador** — é aqui que está o trabalho todo. Os
   ecrãs de `app/(desk)/` foram desenhados a pensar no telemóvel e ao
   computador desperdiçam a largura. Agenda, caixa, clientes,
   comissões: aproveitar o ecrã grande em vez de esticar o pequeno.
2. **Nomes compridos nos cartões da agenda** — "Balayage / Babylights /
   Ombré · cabelo comprido" corta a meio.
3. **O funil ao computador** — corre numa coluna só e dá 6500 px de
   scroll, quando a montra e a loja já usam duas.

A ênfase vem do cliente: **a cliente vê tudo no telemóvel** (montra,
funil, loja — e o ecrã da profissional também). **A gestão vê-se ao
computador**, e aí é aproveitar a largura em vez de a desperdiçar.

Se mexer no telemóvel, o que já lá está: `components/price-list.tsx`
(a linha do preçário), `components/collapse-group.tsx` (a categoria que
fecha) e a classe `.toque` em `app/globals.css` (estica a área do dedo
sem mexer no desenho).

---

## 4 · Três coisas que o vão morder

**1. O que sai para fora passa sempre por `public_alias`.**
Publicar o nome de uma profissional ao lado das horas livres publica a
escala dela — a que horas trabalha, quando falta, quando vai de férias.
Hoje as cinco mostram o nome próprio, porque foi isso que a casa quis;
quem não quiser o seu na montra escreve outro em `staff.public_alias`,
na gestão, e passa a ser esse que aparece. **Se escrever uma consulta a
`staff` numa página pública, é `coalesce(s.public_alias, s.name)` — no
`select` e no `order by`.** Chegou a estar «Profissional 1..5» como
reserva e era isso que as clientes liam na montra.

**2. As clientes e as marcações são inventadas.** O salão é verdadeiro;
o movimento não. Existe para os relatórios não estarem vazios. Apaga-se
com `MOVIMENTO = false` no topo do `seed-real.mjs`.

**3. Dos 67 serviços, 46 têm um tempo que eu inventei.** O horário das
lojas, as habilidades da Filipa e as comissões também. Parecem dados,
são suposições — estão todas em [PENDENCIAS.md](PENDENCIAS.md), cada
uma com a pergunta que a fecha. Não as trate como verdade.

---

## 5 · Regras de casa

- **Segredos nunca vão para o Git.** O `.env` está ignorado. As chaves
  de produção vivem no Netlify. Peça-as por canal privado.
- **Contra produção, só de propósito.** Tudo passa pelo mesmo
  invólucro, que lê o `.env.production.local` e nunca põe a senha na
  linha de comandos:

  | | |
  |---|---|
  | `node scripts/_prod.mjs estado` | o que lá está e o que falta (só lê) |
  | `node scripts/_prod.mjs migrate` | aplica as migrações que faltam |
  | `node scripts/_prod.mjs senha +351…` | dá palavra-passe a uma pessoa; escreve-se à mão, não aparece no ecrã |
  | `node scripts/_prod.mjs arrancar` | apaga senhas partilhadas e nomes públicos de reserva |
  | `node scripts/_prod.mjs limpar --a-serio` | apaga o movimento inventado, guarda lojas, preçário e equipa |
  | `node scripts/_prod.mjs seed-real --apagar-tudo` | **`truncate cascade`.** Só numa base vazia. |
- **Migrações só para a frente.** Nunca edite uma que já correu; crie
  outra com data mais alta.
- **Antes do commit:** `npm run typecheck` e `npm run build`.
- **Estilo:** aspas simples, sem ponto e vírgula, comentários em
  português de Portugal a explicar *porquê*. Leia o ficheiro à volta
  antes de escrever nele.
- **O WhatsApp não é uma integração.** O sistema não envia nada
  sozinho: prepara a mensagem, abre a conversa, uma pessoa carrega no
  botão. Foi decidido assim.
- **A área da equipa não se traduz.** Só a superfície da cliente fala
  inglês e espanhol.

---

## 6 · Onde está o resto

| | |
|---|---|
| [README.md](README.md) | O sistema por dentro: quem vê o quê, as regras que o sustentam, o mapa das pastas. **Leia antes de mexer em `lib/`.** |
| [PENDENCIAS.md](PENDENCIAS.md) | O que falta perguntar à dona e o que falta afinar |
| [ROADMAP.md](ROADMAP.md) | O plano por fases |
| [CONTEUDO.md](CONTEUDO.md) | O preçário, serviço a serviço, com a origem de cada duração |
| [EQUIPA.md](EQUIPA.md) | As cinco profissionais, escalas e lacunas |

```
app/(public)/   montra, funil, área da cliente
app/(desk)/     hoje · agenda · avisos · caixa · clientes · gestão
lib/            as regras — availability, booking, comanda, cash, commissions
supabase/       migrações, por ordem de data
scripts/        migrar, semear, sessões de pré-visualização
```

**Acessos a pedir:** GitHub (`Voux-Sistemas/salao`), Netlify (`salaonr`),
Supabase. Para trabalhar no dia-a-dia não precisa de nenhum deles — a
sua base e o `seed-real.mjs` dão-lhe o salão inteiro.
