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

**Entrar** em `/entrar`, palavra-passe `nohora2026`:

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

Acabou de entrar o **conteúdo verdadeiro do salão**: 67 serviços com
preço, as duas lojas (Valongo e Maia), as cinco profissionais com
escalas, e as nove fotografias.

**Falta afinar os ecrãs para o aparelho em que vão ser usados.** É o
próximo trabalho, e é o único.

---

## 3 · O que fazer a seguir

Por esta ordem. Está tudo detalhado em
[PENDENCIAS.md](PENDENCIAS.md) secção B e em [ROADMAP.md](ROADMAP.md).

1. **Preçário no telemóvel** — a coluna da duração é estreita de mais:
   "1 h 30" parte em duas linhas e o pontilhado desaparece quando o
   nome do serviço encavalita. Acontece em `/` e em `/loja/[loja]`.
2. **A montra ficou comprida** — 67 serviços de enfiada dão quase
   10 000 px de scroll no telemóvel. Provavelmente quer categorias
   fechadas, a abrir ao toque.
3. **O funil todo a 390 px** — auditar passo a passo com o polegar:
   alvos de toque grandes, sem zoom acidental, sem teclado a tapar o
   botão.
4. **Nomes compridos nos cartões da agenda** — "Balayage / Babylights /
   Ombré · cabelo comprido" corta a meio.

A ênfase vem do cliente: **a cliente vê tudo no telemóvel** (montra,
funil, loja — e o ecrã da profissional também). **A gestão vê-se ao
computador**, e aí é aproveitar a largura em vez de a desperdiçar.

---

## 4 · Três coisas que o vão morder

**1. O nome verdadeiro de uma profissional nunca sai para fora.**
Publicá-lo ao lado das horas livres publica a escala dela — a que horas
trabalha, quando falta, quando vai de férias. E elas são independentes.
Por isso existe `staff.public_alias`: para fora é `Profissional 1..5`,
na gestão continuam os nomes. **Se escrever uma consulta a `staff`
numa página pública, é `coalesce(s.public_alias, s.name)` — no `select`
e no `order by`.** A ordenação alfabética entrega os nomes sem mostrar
nenhum.

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
- **Contra produção, só de propósito:** `node scripts/_prod.mjs migrate`
  e `node scripts/_prod.mjs seed-real --apagar-tudo`. O `--apagar-tudo`
  é literal — o seed começa por um `truncate cascade`.
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
