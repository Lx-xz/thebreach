'use client';

import { useRef, useState } from 'react';
import { ImagePlus, Star } from 'lucide-react';
import { garantirHero, lerTitulo } from '@/lib/breach/cabecalho';
import { EXTENSOES, NOME_HERO, ehImagem, pastaDe } from '@/lib/breach/imagens';
import { bytesParaBase64, type Mudanca } from '@/lib/breach/github';
import { slugify } from '@/lib/breach/slug';

export interface ImagemPronta {
  /** Caminho no acervo. */
  path: string;
  base64: string;
  /** URL local, para a prévia mostrar antes do site reconstruir. */
  objectURL: string;
  hero: boolean;
}

interface Props {
  /** Caminho do documento aberto. */
  path: string;
  bruto: string;
  arquivos: Set<string> | null;
  /** Imagens escolhidas nesta sessão e ainda não gravadas. */
  pendentes: ImagemPronta[];
  onPendentes: (imagens: ImagemPronta[]) => void;
  /** Troca o markdown — para a citação do hero e a da imagem no cursor. */
  onTexto: (bruto: string) => void;
  /** Insere um trecho na posição do cursor da área de texto. */
  onInserir: (trecho: string) => void;
  /** Abre a mudança de caminho, para um documento solto virar entidade. */
  onVirarEntidade: () => void;
}

/** A extensão do arquivo, em minúsculas e sem o ponto. */
function extensaoDe(nome: string): string {
  return (nome.split('.').pop() ?? '').toLowerCase();
}

async function lerComoBase64(arquivo: File): Promise<{ base64: string; objectURL: string }> {
  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  return { base64: bytesParaBase64(bytes), objectURL: URL.createObjectURL(arquivo) };
}

/**
 * Ilustrações de uma entidade (CONVENCOES.md §8).
 *
 * As imagens moram na pasta da entidade, ao lado do `README.md` — não há árvore
 * de imagens separada. `hero` é nome reservado: é a ilustração de abertura, uma
 * por entidade. As demais têm nome livre e **só aparecem se o texto as citar**,
 * por caminho relativo, no ponto em que devem aparecer.
 */
export function Ilustracoes({
  path,
  bruto,
  arquivos,
  pendentes,
  onPendentes,
  onTexto,
  onInserir,
  onVirarEntidade,
}: Props) {
  const [erro, setErro] = useState('');
  const heroInput = useRef<HTMLInputElement>(null);
  const outraInput = useRef<HTMLInputElement>(null);

  // Hero é ilustração de entidade, e entidade é pasta (§6 e §8): um documento
  // solto não tem onde guardar o dele.
  const ehEntidade = /(^|\/)README\.md$/i.test(path);
  const pasta = pastaDe(path);

  const heroAtual = arquivos
    ? EXTENSOES.map((ext) => `${pasta ? `${pasta}/` : ''}${NOME_HERO}.${ext}`).find((c) =>
        arquivos.has(c),
      ) ?? null
    : null;

  const escolher = async (lista: FileList | null, hero: boolean): Promise<void> => {
    setErro('');
    const arquivosEscolhidos = Array.from(lista ?? []);
    if (!arquivosEscolhidos.length) return;

    const novas: ImagemPronta[] = [];
    for (const arquivo of arquivosEscolhidos) {
      const ext = extensaoDe(arquivo.name);
      if (!ehImagem(arquivo.name)) {
        setErro(`${arquivo.name}: o acervo aceita ${EXTENSOES.join(', ')}.`);
        return;
      }
      const { base64, objectURL } = await lerComoBase64(arquivo);
      // §8: nome descritivo, na mesma grafia dos nomes de pasta.
      const nome = hero
        ? `${NOME_HERO}.${ext}`
        : `${slugify(arquivo.name.replace(/\.[^.]+$/, ''))}.${ext}`;
      novas.push({ path: `${pasta ? `${pasta}/` : ''}${nome}`, base64, objectURL, hero });
    }

    onPendentes([...pendentes.filter((p) => !novas.some((n) => n.path === p.path)), ...novas]);

    if (hero) {
      // A citação é o que faz a ilustração aparecer também na leitura pelo
      // GitHub; no site, `rehypeSemHeroRepetido` já a tira do corpo.
      const nome = novas[0].path.split('/').pop() ?? '';
      onTexto(garantirHero(bruto, nome, lerTitulo(bruto) ?? ''));
    } else {
      for (const nova of novas) {
        const nome = nova.path.split('/').pop() ?? '';
        const legenda = nome.replace(/\.[^.]+$/, '').replace(/-/g, ' ');
        onInserir(`\n![${legenda}](${nome})\n`);
      }
    }
  };

  if (!ehEntidade) {
    return (
      <div className="painel__corpo">
        <p className="editor__dica">
          Pelo §8, a ilustração de abertura é de uma <strong>entidade</strong>, e pelo §6 entidade é
          pasta. Este documento é um arquivo solto: não há pasta dele onde a imagem possa morar.
        </p>
        <button type="button" className="editor__botao" onClick={onVirarEntidade}>
          Transformar em entidade
        </button>
        <p className="editor__dica">
          <code>{path}</code> viraria <code>{path.replace(/\.md$/i, '/README.md')}</code>, com as
          citações acertadas no mesmo commit.
        </p>
      </div>
    );
  }

  return (
    <div className="painel__corpo">
      {erro ? <p className="editor__estado editor__estado--erro">{erro}</p> : null}

      <div className="editor__acoes">
        <button type="button" className="editor__botao" onClick={() => heroInput.current?.click()}>
          <Star size={15} aria-hidden="true" />
          {heroAtual ? 'Trocar a ilustração de abertura' : 'Pôr ilustração de abertura'}
        </button>
        <button type="button" className="editor__botao" onClick={() => outraInput.current?.click()}>
          <ImagePlus size={15} aria-hidden="true" />
          Acrescentar imagem
        </button>
      </div>

      <input
        ref={heroInput}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => void escolher(event.target.files, true)}
      />
      <input
        ref={outraInput}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(event) => void escolher(event.target.files, false)}
      />

      <p className="editor__dica">
        {heroAtual ? (
          <>
            Abertura de hoje: <code>{heroAtual.split('/').pop()}</code>.{' '}
          </>
        ) : null}
        Imagem que não é a de abertura só aparece se o texto a citar — a citação entra no ponto do
        cursor.
      </p>

      {pendentes.length ? (
        <ul className="ilustracoes__lista">
          {pendentes.map((imagem) => (
            <li key={imagem.path}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imagem.objectURL} alt="" />
              <code>{imagem.path.split('/').pop()}</code>
              {imagem.hero ? <span className="ilustracoes__marca">abertura</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * As imagens escolhidas viram mudanças de arquivo.
 *
 * Trocar o hero por outro de extensão diferente **precisa** apagar o antigo no
 * mesmo commit: `ilustracaoDe` escolhe por ordem de extensão, e um `hero.png`
 * esquecido venceria o `hero.webp` novo.
 */
export function mudancasDeImagem(pendentes: ImagemPronta[], heroAtual: string | null): Mudanca[] {
  const mudancas: Mudanca[] = pendentes.map((imagem) => ({
    tipo: 'binario' as const,
    path: imagem.path,
    base64: imagem.base64,
  }));

  const heroNovo = pendentes.find((imagem) => imagem.hero);
  if (heroNovo && heroAtual && heroAtual !== heroNovo.path) {
    mudancas.push({ tipo: 'remover', path: heroAtual });
  }
  return mudancas;
}
