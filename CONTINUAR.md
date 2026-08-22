# Continuar daqui

Para quem chega ao projecto agora. Em vinte minutos tem o salão a
correr na sua máquina, com o preçário verdadeiro e a agenda cheia.

Se só quer perceber o que é isto, leia o [README](README.md) primeiro —
explica as regras que sustentam o resto. Este ficheiro é a parte
prática: pôr de pé, saber onde estamos, e o que fazer a seguir.

---

## 1 · Pôr de pé

### O que precisa antes de começar

- **Node 22** (a mesma versão que o Netlify usa)
- **Uma base Postgres só sua.** Não aponte para a de produção — é o
  salão a sério, com clientes a marcar. Ver abaixo.
- **Git** e acesso ao repositório

### Uma base de dados para si

Três caminhos, do mais fácil ao mais próximo de produção:

| | Como | Bom para |
|---|---|---|
| **A** | Um projecto Supabase gratuito só seu | Igual a produção, zero instalação, funciona em qualquer máquina |
| **B** | `docker run -e POSTGRES_PASSWORD=x -p 5432:5432 postgres:17` | Rápido, se já tem Docker |
| **C** | Postgres 17 instalado à mão | Se não quer nem Docker nem nuvem |

Seja qual for, precisa das extensões `btree_gist` e `pgcrypto` — as
migrações criam-nas sozinhas, mas o utilizador tem de poder criá-las.
No Supabase pode; num Postgres seu, use o superutilizador.

### Os cinco comandos

```bash
git clone https://github.com/Voux-Sistemas/salao.git
cd salao
npm install
cp .env.example .env          # e preencha, ver abaixo
npm run db:migrate            # cria o esquema todo
node scripts/seed-real.mjs    # enche com o salão verdadeiro
npm run dev                   # http://localhost:3000
```

### O `.env`

O `.env` **nunca vai para o Git** — está no `.gitignore`, e o
`.env.example` só tem marcadores. Cada um tem o seu.

```
DATABASE_URL="...a sua base, não a de produção..."
SESSION_SECRET="..."          # node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
SETUP_CODE="qualquer-coisa"
SUPPORT_PHONES=""             # vazio, de propósito — ver README
NEXT_PUBLIC_SITE_URL="http://localhost:3000"
```

### Entrar

O `seed-real.mjs` cria as contas verdadeiras. **Palavra-passe
`nohora2026`** (só vale na sua máquina; em produção são outras):

| Telefone | Quem | Vê |
|---|---|---|
| `+351934730344` | Nohora Ramirez | tudo, nas duas lojas |
| `+351930000001` | Ariadna | só a agenda dela |
| `+351930000002` | Adyr | só a agenda dela |
| `+351930000003` | Nana | só a agenda dela |
| `+351930000004` | Filipa | só a agenda dela |

Para espreitar a área da cliente sem pedir código por WhatsApp:

```bash
node scripts/preview-auth.mjs ./sessoes
```

Escreve *storage states* do Playwright — um por pessoa, mais um de
cliente. Serve para automatizar ecrãs; o cookie lá dentro também se
cola à mão no navegador.

---

## 2 · Onde estamos

O sistema está **completo e no ar** em <https://salaonr.netlify.app>,
ligado à Supabase. O conteúdo verdadeiro do salão já entrou.

### O que existe

Quatro níveis de acesso (Suporte, Dona, Gerente, Profissional), montra
pública em três línguas, funil de marcação, agenda, comanda, caixa,
avisos, clientes, comissões. As regras que sustentam tudo isso estão no
[README](README.md) e **não são negociáveis** — cêntimos inteiros, UTC,
preço congelado na marcação, a tranca do overbooking na base de dados e
não no código, a comanda É a marcação.

### Uma regra que não está no README

**O nome verdadeiro de uma profissional nunca sai para fora.**

Publicar "Ariadna" ao lado das horas livres publica a escala dela: a
que horas trabalha, quando falta, quando vai de férias. Qualquer pessoa
abre o funil, anda duas semanas para a frente e fica a saber. E elas são
independentes.

Por isso existe `staff.public_alias`. Para fora é `Profissional 1..5`;
dentro da gestão continuam os nomes. Sete sítios foram fechados —
incluindo a **ordenação**, que entregava o alfabeto dos nomes reais sem
mostrar um único nome.

> Se escrever uma consulta a `staff` numa página de `app/(public)/` ou
> num componente que ela use, é `coalesce(s.public_alias, s.name)` — no
> `select` **e** no `order by`. Não há excepção.

### O que está lá dentro que é mentira

O `seed-real.mjs` semeia dois blocos. O salão (lojas, preçário, equipa,
fotos) é verdadeiro. As **clientes e as marcações são inventadas** —
seis semanas de histórico, o dia de hoje a meio, três semanas à frente,
caixa aberto. Existem para os relatórios não estarem vazios.

Some com uma linha: `MOVIMENTO = false` no topo do ficheiro.

### O que é palpite meu

De 67 serviços, a dona deu o tempo de 12. **Os outros 46 têm um tempo
que eu inventei.** O horário das lojas, as habilidades da Filipa e as
comissões também. Tudo arrolado em [PENDENCIAS.md](PENDENCIAS.md), cada
um com a pergunta que o fecha. Não mexa nos números sem ler isso —
parecem dados, são suposições.

---

## 3 · O que fazer a seguir

O [ROADMAP.md](ROADMAP.md) manda. A Fase 0 está fechada; segue-se a
**Fase 1 — telemóvel: mini-site e marcação**.

A ênfase, que vem do cliente e não de mim:

- **A cliente vê tudo no telemóvel.** Montra, funil, página da loja: é
  aí que quase todo o tráfego bate. O ecrã da profissional também.
- **A gestão vê-se ao computador.** A dona trabalha sentada. Aqui a
  ênfase inverte-se: aproveitar a largura em vez de a desperdiçar.

Não é regra, é onde cada ecrã vai ser mesmo usado.

Os três primeiros trabalhos concretos estão em
[PENDENCIAS.md](PENDENCIAS.md), secção B — o preçário no telemóvel, a
montra que ficou com dez mil píxeis de scroll, e os nomes compridos nos
cartões da agenda.

---

## 4 · Regras de casa

**Segredos nunca vão para o Git.** O `.env` está ignorado e o
`.env.example` só tem marcadores. As chaves de produção vivem no
Netlify (*Site settings › Environment variables*) e na cabeça de quem
as criou. Peça-as a quem já as tem — não as ponha numa conversa, num
*issue*, nem num commit.

**Contra produção, só de propósito.** Há um invólucro que lê o
`.env.production.local` (ignorado pelo Git) sem a senha passar pela
linha de comandos:

```bash
node scripts/_prod.mjs migrate                    # aplica migrações
node scripts/_prod.mjs seed-real --apagar-tudo    # APAGA e semeia de novo
```

O `--apagar-tudo` é obrigatório fora da sua máquina, e é literal: o
seed começa por um `truncate cascade`. O `seed.mjs` — o de
demonstração, com dois salões inventados em Lisboa — recusa-se a correr
fora de `localhost`.

**Migrações só para a frente.** Nunca edite um ficheiro em
`supabase/migrations/` que já correu: crie outro, com data mais alta. O
que já entrou fica registado em `public.schema_migrations`.

**Antes de cada commit:**

```bash
npm run typecheck    # tsc --noEmit
npm run build
```

**O estilo do código é para seguir, não para discutir.** Aspas simples,
sem ponto e vírgula, comentários em português de Portugal a explicar
*porquê* — nunca *o quê*. Leia o ficheiro à volta antes de escrever
nele.

**O WhatsApp não é uma integração.** O sistema não envia nada sozinho:
prepara a mensagem, abre a conversa, e uma pessoa carrega no botão. Não
há API, não há agendador, não há trabalhador de fundo. Se um dia
parecer que falta isso — não falta, foi decidido assim.

**A área da equipa não se traduz.** Só a superfície da cliente fala
inglês e espanhol.

---

## 5 · Os mapas

| Ficheiro | O que lá está |
|---|---|
| [README.md](README.md) | O sistema: quem vê o quê, as regras, o mapa das pastas |
| [ROADMAP.md](ROADMAP.md) | O plano por fases, um item de cada vez |
| [PENDENCIAS.md](PENDENCIAS.md) | O que falta perguntar à dona e o que falta afinar |
| [CONTEUDO.md](CONTEUDO.md) | O preçário verdadeiro, serviço a serviço, com a origem de cada duração |
| [EQUIPA.md](EQUIPA.md) | As cinco profissionais, escalas e lacunas |
| [ENTREGA.md](ENTREGA.md) | A lista de entrega original, já riscada |

E o código:

```
app/(public)/     montra, funil de marcação, área da cliente
app/(auth)/       instalação e entrada da equipa
app/(desk)/       hoje · agenda · avisos · caixa · clientes · gestão
lib/              as regras — availability, booking, comanda, cash, commissions
components/       as peças de que os ecrãs são feitos
supabase/         migrações, por ordem de data
scripts/          migrar, semear, sessões de pré-visualização
```

---

## 6 · Acessos a pedir

Nada disto se resolve por código. Peça a quem já tem:

- [ ] **GitHub** — colaborador em `Voux-Sistemas/salao`
- [ ] **Netlify** — o site `salaonr`, para ver deploys e variáveis
- [ ] **Supabase** — o projecto de produção (só para ler, no início)
- [ ] **As variáveis de ambiente de produção**, se for mexer no
      `_prod.mjs`. Por canal privado, nunca por escrito no repositório.
