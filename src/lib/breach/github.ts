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

  /**
   * O arquivo mudou no GitHub depois que esta aba o leu: o `sha` enviado não é
   * mais o da ponta. É erro de outra natureza — não se resolve tentando de novo.
   */
  get conflito(): boolean {
    return this.status === 409;
  }
}

export interface ArquivoLido {
  conteudo: string;
  sha: string;
}

export interface Gravacao {
  /** O `sha` novo do arquivo, para a gravação seguinte não precisar recarregar. */
  sha: string;
  /** Endereço do commit no GitHub, para conferir o que entrou. */
  commitUrl: string;
}

function contentsUrl(path: string): string {
  const encoded = path.split('/').map(encodeURIComponent).join('/');
  return `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encoded}`;
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

/**
 * O espelho exato do decodificador acima. `btoa` sobre o texto estoura em
 * qualquer caractere acima de 0xFF — e o acervo está cheio deles —, então o
 * texto vira bytes UTF-8 antes, e só a cadeia de bytes vai para o `btoa`.
 */
function encodeBase64Utf8(texto: string): string {
  const bytes = new TextEncoder().encode(texto);
  let bin = '';
  // Em pedaços: `String.fromCharCode(...bytes)` de um documento inteiro pode
  // passar do limite de argumentos da chamada.
  for (let i = 0; i < bytes.length; i += 8192) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return btoa(bin);
}

/** A explicação que a própria API deu, quando deu alguma. */
async function motivoDaApi(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { message?: string };
    return typeof payload.message === 'string' ? payload.message : '';
  } catch {
    return '';
  }
}

/** Traduz o código de resposta para uma frase que diz o que fazer a respeito. */
async function erroDeEscrita(response: Response, path: string): Promise<GithubApiError> {
  const motivo = await motivoDaApi(response);
  const sufixo = motivo ? ` O GitHub disse: “${motivo}”.` : '';

  if (response.status === 409) {
    return new GithubApiError(409, `${path} mudou no GitHub depois que esta página o abriu.`);
  }
  if (response.status === 401) {
    return new GithubApiError(401, `O token não vale mais — expirou ou foi revogado.${sufixo}`);
  }
  if (response.status === 403) {
    return new GithubApiError(
      403,
      `O token não tem permissão para gravar. Ele precisa de ` +
        `“Contents: Read and write” em ${OWNER}/${REPO}.${sufixo}`,
    );
  }
  return new GithubApiError(response.status, `Falha ao gravar ${path} (${response.status}).${sufixo}`);
}

/**
 * Todos os arquivos do acervo, numa chamada só.
 *
 * `null` quando o GitHub corta a resposta (`truncated`): melhor a conferência
 * se declarar indisponível do que acusar de quebrada uma referência que existe.
 */
export async function listarArvore(token: string): Promise<Set<string> | null> {
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/git/trees/${BRANCH}?recursive=1`;
  const response = await fetch(url, { headers: headers(token) });
  if (!response.ok) {
    throw new GithubApiError(response.status, `Falha ao listar o acervo (${response.status}).`);
  }
  const payload = (await response.json()) as {
    tree: Array<{ path: string; type: string }>;
    truncated?: boolean;
  };
  if (payload.truncated) return null;
  return new Set(payload.tree.filter((no) => no.type === 'blob').map((no) => no.path));
}

/** Lê um arquivo do acervo. `null` quando o arquivo não existe. */
export async function lerArquivo(path: string, token: string): Promise<ArquivoLido | null> {
  const response = await fetch(`${contentsUrl(path)}?ref=${BRANCH}`, { headers: headers(token) });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new GithubApiError(response.status, `Falha ao ler ${path} (${response.status}).`);
  }
  const payload = (await response.json()) as { content: string; sha: string };
  return { conteudo: decodeBase64Utf8(payload.content), sha: payload.sha };
}

/**
 * Grava um arquivo do acervo, como um commit em `main`.
 *
 * O `sha` é o controle de concorrência: é o do arquivo tal como foi lido. Se
 * outra mão mexeu no arquivo desde então, o GitHub responde 409 em vez de
 * deixar a gravação passar por cima.
 */
export async function gravarArquivo(
  path: string,
  conteudo: string,
  sha: string,
  mensagem: string,
  token: string,
): Promise<Gravacao> {
  const response = await fetch(contentsUrl(path), {
    method: 'PUT',
    headers: { ...headers(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: mensagem,
      content: encodeBase64Utf8(conteudo),
      sha,
      branch: BRANCH,
    }),
  });

  if (!response.ok) throw await erroDeEscrita(response, path);

  const payload = (await response.json()) as {
    content: { sha: string };
    commit: { html_url: string };
  };
  return { sha: payload.content.sha, commitUrl: payload.commit.html_url };
}
