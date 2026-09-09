# Compêndio Breach — site

Representação visual do acervo em [`Lx-xz/breach`](https://github.com/Lx-xz/breach).

O repositório do acervo é tratado como **banco de dados**: o site não guarda
cópia do conteúdo. Durante o build ele consulta a API do GitHub, lê os arquivos
markdown, entende as convenções do acervo (cabeçalho de metadados, seções
numeradas, marcadores de confiabilidade) e gera páginas estáticas.

**Status:** quatro layouts em avaliação. A escolha final ainda não foi feita.

---

## Tecnologias

| Peça | O quê | Por quê |
|---|---|---|
| Next.js 15 (App Router) | framework | Export estático — roda no GitHub Pages sem servidor. |
| TypeScript | tipos | O modelo do acervo é descrito em `src/lib/breach/types.ts`. |
| Sass (`.scss`) | estilo | Sem Tailwind. Tokens em custom properties, um arquivo por layout. |
| lucide-react | ícones | — |
| unified / remark / rehype | markdown → HTML | Tabelas GFM e três transformações próprias (ver abaixo). |
| fuse.js | busca | Índice gerado no build, busca no navegador, sem servidor. |
| next/font | fontes | Google Fonts servidas do próprio domínio, sem requisição externa. |

---

## A camada de acesso ao acervo

Tudo em `src/lib/breach/`:

| Arquivo | Papel |
|---|---|
| `source.ts` | Acesso bruto. API do GitHub (árvore + conteúdo) ou pasta local. Memoiza tudo. |
| `parse.ts` | Lê um documento: título, cabeçalho, texto de abertura, seções e subseções. |
| `markers.ts` | Os seis marcadores de `CONVENCOES.md` §1, com contagem por documento. |
| `markdown.ts` | Pipeline markdown → HTML com as transformações próprias. |
| `api.ts` | Consultas usadas pelas páginas: categorias, documentos, índice, alterações, busca. |
| `slug.ts` | Caminho no repo → rota no site. |

Três transformações fazem o acervo virar site:

1. **Marcadores viram selos.** `` `[CRENÇA — Ordem dos Vigias]` `` vira um selo
   colorido com a fonte interna destacada ao lado.
2. **Referências viram links.** `` `04-bestiario/dragoes.md` `` e os links
   markdown para arquivos `.md` passam a apontar para a rota equivalente.
3. **Tabelas ganham rolagem própria**, para não estourar a largura da página.

Seções cujo conteúdo é apenas `[LACUNA]` são reconhecidas e apresentadas como
lacuna declarada — não são escondidas. A distância entre o que está definido e
o que falta é conteúdo, como no acervo.

---

## Os quatro layouts

O HTML é o mesmo nos quatro. A troca acontece por um atributo `data-layout` no
elemento raiz, e cada layout é uma folha de estilo que reposiciona e reveste as
mesmas peças (`src/styles/layouts/`). Por isso a troca é instantânea, não
recarrega a página e não duplica componente nenhum. A escolha fica no
`localStorage` e é reaplicada antes da primeira pintura.

| Layout | Ideia |
|---|---|
| **Grimório** | O tomo. Pergaminho emoldurado, serifa, versalete, capitular, fleurões. |
| **Códice** | Documentação. Árvore à esquerda, sumário à direita, denso e sem ornamento. |
| **Atlas** | Mosaico. Cartões grandes, cor pastel por categoria, muito ar. |
| **Escriba** | Manuscrito. Coluna estreita, tipografia grande, zero cromo. |

Há também tema claro e escuro, independente do layout.

---

## Rodar localmente

```bash
npm install

# Opção A — ler o acervo do GitHub (repositório privado, exige token de leitura)
BREACH_TOKEN=<token com Contents:Read em Lx-xz/breach> npm run dev

# Opção B — ler uma cópia local do acervo, sem rede
BREACH_LOCAL_PATH=../breach npm run dev
```

### Variáveis

| Variável | Padrão | Para quê |
|---|---|---|
| `BREACH_TOKEN` | — | Token de leitura do acervo. Obrigatório sem `BREACH_LOCAL_PATH`. |
| `BREACH_LOCAL_PATH` | — | Pasta local com o acervo. Tem prioridade sobre a API. |
| `BREACH_OWNER` / `BREACH_REPO` / `BREACH_REF` | `Lx-xz` / `breach` / `main` | Onde está o acervo. |
| `NEXT_PUBLIC_BASE_PATH` | vazio | Prefixo da URL no GitHub Pages (`/thebreach`). |

No fluxo de publicação o prefixo vem da variável de repositório `SITE_BASE_PATH`
quando definida, e de `/thebreach` caso contrário. Com domínio próprio, defina-a
como vazia.

---

## Publicação

`.github/workflows/deploy.yml` constrói e publica no GitHub Pages. Ele roda
quando este repositório recebe push, uma vez por dia, sob demanda e quando o
acervo avisa que mudou.

### O que precisa estar configurado

1. **Segredo `BREACH_TOKEN` neste repositório** — um token de acesso pessoal de
   escopo fino com permissão `Contents: Read` em `Lx-xz/breach`. Sem ele o build
   para com mensagem explicando o que falta.
2. **Pages no modo GitHub Actions** — em *Settings › Pages › Source: GitHub
   Actions*. Isto precisa ser feito à mão: o token padrão das Actions não tem
   permissão para ligar o Pages sozinho.
3. **Segredo `SITE_DISPATCH_TOKEN` no repositório do acervo** *(opcional)* — um
   token com permissão de escrita em Actions aqui, para que um commit no acervo
   dispare a reconstrução do site em minutos em vez de esperar o build diário.

### Sobre repositórios privados

Tanto o acervo quanto este repositório são privados. O GitHub Pages só publica
a partir de repositório privado nos planos pagos; no plano gratuito, publicar
exige tornar **este** repositório público — o que também torna público o
conteúdo do acervo, já que ele fica embutido no HTML gerado. O acervo em si
continua privado nos dois casos.
