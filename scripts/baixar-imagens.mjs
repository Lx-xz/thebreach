/**
 * Traz as ilustrações do acervo para dentro do site, antes do build.
 *
 * O repositório `breach` é privado: o navegador não consegue buscar as imagens
 * dele. Este script copia tudo o que estiver sob `imagens/` para
 * `public/acervo/imagens/`, de onde o site as serve como arquivos próprios.
 *
 * Fontes, na mesma ordem do resto da camada de acesso:
 *   1. BREACH_LOCAL_PATH — pasta local com o acervo.
 *   2. API do GitHub, autenticada por BREACH_TOKEN.
 */

import { mkdir, rm, writeFile, readdir, copyFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const OWNER = process.env.BREACH_OWNER ?? 'Lx-xz';
const REPO = process.env.BREACH_REPO ?? 'breach';
const REF = process.env.BREACH_REF ?? 'main';
const PASTA = 'imagens';
const DESTINO = path.join(process.cwd(), 'public', 'acervo');

const local = process.env.BREACH_LOCAL_PATH ? path.resolve(process.env.BREACH_LOCAL_PATH) : null;
const usandoLocal = Boolean(local && existsSync(local));

function cabecalhos(accept) {
  const headers = { Accept: accept, 'User-Agent': 'compendio-breach-site' };
  if (process.env.BREACH_TOKEN) headers.Authorization = `Bearer ${process.env.BREACH_TOKEN}`;
  return headers;
}

async function buscar(url, accept) {
  let ultimoErro = null;
  for (let tentativa = 0; tentativa < 3; tentativa += 1) {
    try {
      const resposta = await fetch(url, { headers: cabecalhos(accept) });
      if (resposta.ok) return resposta;
      if ([401, 403, 404].includes(resposta.status)) {
        throw new Error(
          `Sem acesso ao acervo (${resposta.status}). O repositório é privado: ` +
            'defina BREACH_TOKEN com um token de leitura.',
        );
      }
      ultimoErro = new Error(`${resposta.status} ${resposta.statusText}`);
    } catch (erro) {
      if (erro instanceof Error && erro.message.startsWith('Sem acesso')) throw erro;
      ultimoErro = erro;
    }
    await new Promise((r) => setTimeout(r, 400 * 2 ** tentativa));
  }
  throw new Error(`Falha ao ler ${url}: ${ultimoErro?.message ?? ultimoErro}`);
}

async function listarLocal() {
  const raiz = path.join(local, PASTA);
  if (!existsSync(raiz)) return [];
  const achados = [];
  const andar = async (dir) => {
    for (const entrada of await readdir(path.join(raiz, dir), { withFileTypes: true })) {
      if (entrada.name.startsWith('.')) continue;
      const rel = dir ? `${dir}/${entrada.name}` : entrada.name;
      if (entrada.isDirectory()) await andar(rel);
      else achados.push(`${PASTA}/${rel}`);
    }
  };
  await andar('');
  return achados;
}

async function listarRemoto() {
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/git/trees/${REF}?recursive=1`;
  const dados = await (await buscar(url, 'application/vnd.github+json')).json();
  return (dados.tree ?? [])
    .filter((no) => no.type === 'blob' && no.path.startsWith(`${PASTA}/`))
    .map((no) => no.path);
}

async function baixar(caminho) {
  const alvo = path.join(DESTINO, caminho);
  await mkdir(path.dirname(alvo), { recursive: true });

  if (usandoLocal) {
    await copyFile(path.join(local, caminho), alvo);
    return (await stat(alvo)).size;
  }

  const url =
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/` +
    `${caminho.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(REF)}`;
  const resposta = await buscar(url, 'application/vnd.github.raw');
  const bytes = Buffer.from(await resposta.arrayBuffer());
  await writeFile(alvo, bytes);
  return bytes.length;
}

const arquivos = usandoLocal ? await listarLocal() : await listarRemoto();

// Limpa antes para que uma imagem removida do acervo saia também do site.
await rm(DESTINO, { recursive: true, force: true });

if (arquivos.length === 0) {
  console.log('Acervo sem ilustrações: nada a copiar.');
} else {
  let total = 0;
  for (const caminho of arquivos) {
    total += await baixar(caminho);
  }
  const fonte = usandoLocal ? local : `${OWNER}/${REPO}@${REF}`;
  console.log(
    `${arquivos.length} ilustraç${arquivos.length > 1 ? 'ões' : 'ão'} ` +
      `(${(total / 1024).toFixed(0)} KB) de ${fonte} → public/acervo/`,
  );
}
