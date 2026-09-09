/**
 * Acesso ao acervo. O repo `breach` é tratado como banco de dados remoto,
 * consultado pela API do GitHub durante o build.
 *
 * Duas fontes possíveis, na ordem:
 *  1. BREACH_LOCAL_PATH — pasta local com o acervo (desenvolvimento offline).
 *  2. API do GitHub — árvore de arquivos + raw.githubusercontent (padrão).
 *
 * Tudo é memoizado no processo: o build estático gera dezenas de páginas e
 * cada arquivo do acervo é buscado uma única vez.
 */

import { readFile as fsReadFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

export const SOURCE = {
  owner: process.env.BREACH_OWNER ?? 'Lx-xz',
  repo: process.env.BREACH_REPO ?? 'breach',
  ref: process.env.BREACH_REF ?? 'main',
} as const;

export const REPO_URL = `https://github.com/${SOURCE.owner}/${SOURCE.repo}`;

export function githubUrlFor(filePath: string): string {
  return `${REPO_URL}/blob/${SOURCE.ref}/${filePath}`;
}

const LOCAL_ROOT = process.env.BREACH_LOCAL_PATH
  ? path.resolve(process.env.BREACH_LOCAL_PATH)
  : null;

const usingLocal = Boolean(LOCAL_ROOT && existsSync(LOCAL_ROOT));

/**
 * O acervo é um repositório privado, então toda leitura passa pela API do
 * GitHub autenticada. O token vem de BREACH_TOKEN — explícito de propósito,
 * para não capturar por engano um GITHUB_TOKEN de outro escopo.
 */
function authHeaders(): Record<string, string> {
  const token = process.env.BREACH_TOKEN;
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'compendio-breach-site',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function request(url: string, accept?: string): Promise<string> {
  const headers = authHeaders();
  if (accept) headers.Accept = accept;

  let lastError: unknown = null;
  // A rede do build pode falhar por motivo transitório; três tentativas bastam.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      // force-cache: a leitura acontece no build e o resultado é estático.
      const response = await fetch(url, { headers, cache: 'force-cache' });
      if (response.ok) return response.text();
      // 404 e 401 são definitivos: não adianta repetir.
      if (response.status === 404 || response.status === 401 || response.status === 403) {
        throw new Error(
          `Sem acesso ao acervo (${response.status}) em ${url}. ` +
            `O repositório é privado: defina BREACH_TOKEN com um token de leitura.`,
        );
      }
      lastError = new Error(`${response.status} ${response.statusText} — ${url}`);
    } catch (error) {
      lastError = error;
      if (error instanceof Error && error.message.startsWith('Sem acesso')) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 400 * 2 ** attempt));
  }
  throw new Error(
    `Falha ao ler o acervo em ${url}. ` +
      `Verifique a conexão ou aponte BREACH_LOCAL_PATH para uma cópia local. ` +
      `Causa: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
  );
}

let treeCache: Promise<string[]> | null = null;

/** Todos os caminhos `.md` do acervo, em ordem alfabética. */
export function listMarkdownFiles(): Promise<string[]> {
  treeCache ??= usingLocal ? listLocal() : listRemote();
  return treeCache;
}

async function listLocal(): Promise<string[]> {
  const root = LOCAL_ROOT as string;
  const found: string[] = [];
  const walk = async (dir: string): Promise<void> => {
    const entries = await readdir(path.join(root, dir), { withFileTypes: true });
    for (const entry of entries) {
      const rel = dir ? `${dir}/${entry.name}` : entry.name;
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      if (entry.isDirectory()) await walk(rel);
      else if (entry.name.endsWith('.md')) found.push(rel);
    }
  };
  await walk('');
  return found.sort();
}

interface GitTreeResponse {
  tree?: Array<{ path: string; type: string }>;
  truncated?: boolean;
}

async function listRemote(): Promise<string[]> {
  const url = `https://api.github.com/repos/${SOURCE.owner}/${SOURCE.repo}/git/trees/${SOURCE.ref}?recursive=1`;
  const payload = JSON.parse(await request(url)) as GitTreeResponse;
  const files = (payload.tree ?? [])
    .filter((node) => node.type === 'blob' && node.path.endsWith('.md'))
    .map((node) => node.path)
    .sort();
  if (files.length === 0) {
    throw new Error(`O acervo ${SOURCE.owner}/${SOURCE.repo}@${SOURCE.ref} não retornou documentos.`);
  }
  return files;
}

const fileCache = new Map<string, Promise<string>>();

/** Conteúdo bruto de um documento do acervo. */
export function readMarkdown(filePath: string): Promise<string> {
  let pending = fileCache.get(filePath);
  if (!pending) {
    // A API de conteúdo, e não raw.githubusercontent, porque o acervo é privado.
    pending = usingLocal
      ? fsReadFile(path.join(LOCAL_ROOT as string, filePath), 'utf8')
      : request(
          `https://api.github.com/repos/${SOURCE.owner}/${SOURCE.repo}/contents/${filePath
            .split('/')
            .map(encodeURIComponent)
            .join('/')}?ref=${encodeURIComponent(SOURCE.ref)}`,
          'application/vnd.github.raw',
        );
    fileCache.set(filePath, pending);
  }
  return pending;
}

export function sourceDescription(): string {
  return usingLocal ? `local:${LOCAL_ROOT}` : `${SOURCE.owner}/${SOURCE.repo}@${SOURCE.ref}`;
}
