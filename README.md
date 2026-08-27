# Salão — agendamento e gestão

Sistema de marcações para um salão de beleza com mais do que uma loja.
Feito para ser aberto ao balcão às nove da manhã e usado o dia inteiro:
agenda, comanda, caixa, avisos, clientes — e uma montra pública onde a
cliente marca sozinha.

Next.js (App Router) · Postgres no Supabase, por SQL directo · Netlify.

> **Chegou agora ao projecto?** Leia primeiro o
> [CONTINUAR.md](CONTINUAR.md) — uma página: põe-no a correr, diz onde
> parámos e o que fazer a seguir. Este ficheiro é o resto.

---

## Quem usa, e o que vê

| Nível | Onde manda |
|---|---|
| **Dona** | A rede toda. |
| **Gerente** | Só as lojas dela. **Não vê** o catálogo da rede nem as regras de comissão. |
| **Profissional** | Só a agenda dela. |

Um papel guarda-se com uma loja associada; **sem loja quer dizer a rede
toda**. Pedir uma loja a que não se tem acesso responde **"não existe"** —
nunca "acesso negado". A cliente não é um destes níveis: entra por uma
porta própria, com código, e vê só o que é dela.

---

## Pôr de pé

### 1. Supabase

1. Cria o projecto.
2. **Project Settings › Database › Connection string › URI** e copia a
   ligação do *pooler* em modo transacção (porta `6543`).
3. Põe essa ligação no `.env` como `DATABASE_URL` e corre as migrações.
   São os ficheiros numerados de `supabase/migrations/`, aplicados pela
   ordem do nome. Não se conta aqui quantos são: o número muda a cada
   alteração ao esquema e um número escrito à mão fica errado no dia
   seguinte — o `db:status` diz sempre a verdade.

   ```bash
   npm run db:status    # o que falta aplicar
   npm run db:migrate   # aplica o que falta, pela ordem do nome
   ```

   Só precisa da `DATABASE_URL` — sem Docker, sem `psql`, sem CLI da
   Supabase. Cada ficheiro entra num lote só: ou entra todo, ou não
   entra. O que já correu fica registado em `public.schema_migrations`,
   por isso repetir o comando não repete trabalho.

   Alternativas: `npx supabase link --project-ref O_TEU_REF && npm run
   db:push`, ou colar cada ficheiro no SQL Editor da Supabase pela ordem
   do nome.

> **A ordem importa, e o conjunto também.** As restrições de exclusão que
> impedem duas marcações na mesma pessoa ou no mesmo equipamento vêm com
> as tabelas (`…120000`, `…120200`, `…120300`); as funções de precedência
> de preço e de comissão, e o fecho de acesso por RLS, vêm no fim
> (`…120600`). Um sistema com metade das migrações arranca — e mente.

### 2. Ambiente

Copia `.env.example` para `.env` e preenche. **O `.env` não vai para o
Git** — está no `.gitignore`, e o `.env.example` só tem marcadores.

| Variável | Para que serve |
|---|---|
| `DATABASE_URL` | A ligação do pooler (porta 6543). |
| `SESSION_SECRET` | Assina os cookies de sessão e os códigos. `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` |
| `SETUP_CODE` | Protege o `/comecar`. Depois de existir dona, deixa de servir. |
| `NEXT_PUBLIC_SITE_URL` | Endereço público. É a raiz dos links do WhatsApp, do `robots.txt`, do `sitemap.xml` e da imagem de partilha. |

As mesmas quatro variáveis vão para o Netlify em **Site settings ›
Environment variables**.

### 3. Netlify

Liga o repositório do GitHub. O `netlify.toml` já diz o resto: `npm run
build`, Node 22, e o plugin `@netlify/plugin-nextjs`.

### 4. A primeira conta

Com o site no ar, abre **`/comecar`**. Pede o código de instalação, o
nome da rede e a primeira conta de dona. **Este ecrã desaparece mal
exista uma dona** — e "desaparece" quer mesmo dizer *não existe*.

Não há dados de exemplo de propósito: o que se semeia numa base de dados
de produção fica lá. A ordem para encher a casa é

**Unidades → Serviços → Equipa → Comissões.**

Uma loja precisa de horário de semana antes de dar horas. Uma pessoa
precisa de loja, habilidade e escala aberta antes de aparecer na agenda —
cada ficha diz-te em voz alta o que lhe falta.

---

## Correr aqui

```bash
npm install
npm run dev        # http://localhost:3000
npm run typecheck  # tsc --noEmit
npm run build
```

---

## Os guiões

Correm fora do Next. Todos vão à base pela mesma porta — o
`scripts/_ligar.mjs`, que é quem decide o TLS: nada de cifra em
`localhost`, cifra obrigatória em tudo o resto.

| Guião | O que faz |
|---|---|
| `npm run estado` | Diz o que está na base e o que falta antes de abrir: quem não tem senha, quem não tem horário, lojas sem fotografia, movimento de teste por limpar. **Só lê.** |
| `npm run db:status` | Que migrações faltam aplicar. |
| `npm run db:migrate` | Aplica-as, pela ordem do nome. |
| `npm run senha -- +351…` | Define a palavra-passe de uma pessoa. A senha é pedida no terminal e não fica no histórico. |
| `npm run arrancar` | Tira a palavra-passe partilhada do arranque a quem ainda a tenha e fecha as sessões abertas com ela. |
| `node scripts/limpar.mjs --a-serio` | Apaga clientes, marcações, pagamentos, caixa e comissões. Guarda lojas, preçário, equipa, escalas, fotografias e senhas. |
| `node scripts/equipa.mjs` | Deixa um só profissional, «Profissional 1», com o catálogo todo; apaga os outros nomes de ensaio e recria os acessos de serviço que faltarem. **Corre depois do `limpar`** — trabalho feito trava o apagar. |
| `node scripts/seed-real.mjs` | Enche uma base **vazia** com a casa real e movimento de ensaio. Nunca em produção depois de a casa abrir. |

Por omissão vão à `DATABASE_URL` do `.env` — a base local. Para os
mandar à Supabase há o `scripts/_prod.mjs`, que lê o
`.env.production.local` (fora do git) e passa a `DATABASE_URL` dele ao
guião:

```bash
node scripts/_prod.mjs estado
node scripts/_prod.mjs migrate
node scripts/_prod.mjs senha +351…
```

---

## As regras que sustentam o resto

Isto não é estilo: é o que impede o sistema de mentir.

- **Dinheiro é cêntimo inteiro.** Nunca vírgula flutuante.
- **As datas guardam-se em UTC** e convertem-se na berma, com o fuso da
  loja. Duas lojas podem estar em fusos diferentes.
- **O preço e a duração congelam** no momento da marcação. Mudar a tabela
  amanhã não mexe no que já foi marcado.
- **Cancelar apaga os blocos de ocupação.** A hora volta a estar livre no
  mesmo instante.
- **Remarcar cria uma marcação nova** que aponta para a antiga. Não se
  edita a hora de uma marcação.
- **Trocar de escala é fechar a antiga e abrir uma nova.** Corrigir uma
  vigência que já correu mudaria o passado da agenda.
- **A sobreposição é problema da base de dados.** Quem decide é uma
  restrição de exclusão, não o código — dois pedidos ao mesmo segundo
  não podem ganhar os dois.
- **A comissão é derivada mas persistida**, gerada no fecho da comanda,
  linha a linha, com a percentagem congelada e o desconto rateado.
- **A comanda É a marcação.** Não há duas entidades.
- **O telefone é a identidade da cliente**, único na rede — a mesma
  pessoa nas duas lojas é uma ficha só.

### O WhatsApp

**O sistema não envia nada sozinho.** Prepara a mensagem, abre a conversa,
e uma pessoa carrega no botão. Não há integração, não há trabalhador de
fundo, não há agendador — há uma ligação `wa.me` e um registo de envio.

Isto vale também para o código de acesso da cliente: ela pede, o código
fica em **Avisos › Códigos de acesso**, e alguém da casa manda-o.

Mandar a confirmação **não é** a cliente confirmar.

### Línguas

A superfície da cliente — montra, funil, área de conta — fala português,
inglês e espanhol, escolhidos num selector que grava um cookie. **A área
da equipa não se traduz.**

### Quando algo corre mal

Cada lado tem o seu ecrã: o público na língua da cliente e com a montra
à volta, o do balcão em português e dentro do painel. Se nem o layout
sobreviver, entra o `app/global-error.tsx` — esse desenha-se a si
próprio, com as cores escritas à mão, porque a essa altura já não há
folha de estilos.

Uma página que não existe responde **404**, nunca «não tem
permissão» — dizer isso confirmaria que a coisa existe, e a barra de
endereço passaria a servir de mapa da rede.

### O travão das portas públicas

Entrar, pedir código, confirmar código e marcar têm limite de
repetição. A contagem vive na base de dados (`rate_limit`), não na
memória do servidor: em produção o servidor não é um só, e um contador
em memória guardaria um processo e deixaria os outros de porta aberta.

### O cartão do link

`/loja/[loja]` e `/agendar/[loja]` — os dois endereços que se colam numa
conversa — levam título, descrição e a imagem da casa. A imagem é
`app/opengraph-image.png`, gerada por `npm run og:image` a partir do
logotipo; está no repositório, não se constrói no Netlify. A área da
equipa e os passos pessoais do funil ficam fora do índice.

---

## O que este sistema deliberadamente não faz

Stock e consumo de produto · pacotes, fidelização e cupões · ficha de
anamnese · conversa interna · avaliação dentro do sistema · marcação
recorrente · facturação fiscal · aplicação nativa · lista de espera
automática.

Não é esquecimento. Cada uma destas coisas traz um mundo atrás, e a casa
funciona sem elas.

---

## O mapa

```
app/
  (public)/     montra, funil de marcação, área da cliente
  (auth)/       instalação e entrada da equipa
  (desk)/       hoje · agenda · avisos · caixa · clientes · gestão
lib/            regras — availability, booking, comanda, cash, commissions…
components/     as peças de que os ecrãs são feitos
supabase/       migrações
scripts/        migrações, sementes, manutenção — ver «Os guiões»
public/fotos/   as nove fotografias da casa
```

O nome da casa vive na base de dados (`org.name`, `unit.name`). O
`lib/branding.ts` só guarda o que aparece **antes** de haver rede criada.
