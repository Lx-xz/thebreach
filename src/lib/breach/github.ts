/**
 * Acesso à API do GitHub a partir do navegador, para o modo administrador.
 * Único lugar do lado do cliente que fala com `api.github.com`.
 */

const OWNER = 'Lx-xz';
const REPO = 'breach';
const BRANCH = 'main';

export class GithubApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'GithubApiError';
  }
}

export interface ArquivoLido {
  conteudo: string;
  sha: string;
}

function contentsUrl(path: string): string {
  const encoded = path.split('/').map(encodeURIComponent).join('/');
  return `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encoded}?ref=${BRANCH}`;
}

function headers(token: string): HeadersInit {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
  };
}

/**
 * O acervo é cheio de acentos e travessões: decodificar o base64 com `atob`
 * direto devolve texto corrompido, porque `atob` lê byte a byte em Latin-1.
 * `TextDecoder('utf-8')` sobre os bytes reais é o caminho correto.
 */
function decodeBase64Utf8(base64: string): string {
  const limpo = base64.replace(/\n/g, '');
  const bin = atob(limpo);
  const bytes = Uint8Array.from(bin, (char) => char.charCodeAt(0));
  return new TextDecoder('utf-8').decode(bytes);
}

/** Lê um arquivo do acervo. `null` quando o arquivo não existe. */
export async function lerArquivo(path: string, token: string): Promise<ArquivoLido | null> {
  const response = await fetch(contentsUrl(path), { headers: headers(token) });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new GithubApiError(response.status, `Falha ao ler ${path} (${response.status}).`);
  }
  const payload = (await response.json()) as { content: string; sha: string };
  return { conteudo: decodeBase64Utf8(payload.content), sha: payload.sha };
}
