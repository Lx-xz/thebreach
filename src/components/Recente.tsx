'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Clock } from 'lucide-react';
import { esquecerGravado, haQuantoTempo, lerGravado, type Gravado } from '@/lib/breach/recentes';
import { useAppearance } from './AppearanceProvider';

/**
 * A prévia só é baixada quando o Criador pede para ver.
 *
 * Ela carrega o pipeline inteiro do markdown, e nenhum leitor do site deve
 * pagar por isso numa página de leitura — nem o Criador, enquanto só estiver
 * lendo.
 */
const Previa = dynamic(() => import('./Previa').then((modulo) => modulo.Previa), { ssr: false });

interface Props {
  path: string;
  /** Instante em que este site foi construído. */
  geradoEm: string;
}

/**
 * Avisa quando esta página está atrasada em relação ao que você acabou de
 * gravar, e mostra o que foi gravado.
 *
 * O site é estático: entre o commit e a página no ar passa cerca de um minuto.
 * Sem este aviso, a página parece dizer que a gravação não funcionou.
 */
export function Recente({ path, geradoEm }: Props) {
  const { admin } = useAppearance();
  const [gravado, setGravado] = useState<Gravado | null>(null);
  const [vendo, setVendo] = useState(false);

  // Só depois da montagem: `localStorage` não existe na geração do site, e ler
  // durante a renderização faria o servidor e o navegador discordarem.
  useEffect(() => {
    if (!admin) return;
    setGravado(lerGravado(path, geradoEm));
  }, [admin, path, geradoEm]);

  if (!admin || !gravado) return null;

  return (
    <div className="recente">
      <p className="recente__aviso">
        <Clock size={15} aria-hidden="true" />
        Você gravou este documento {haQuantoTempo(gravado.em)}. O site foi publicado antes disso e
        ainda mostra a versão anterior.
      </p>

      <div className="editor__acoes">
        <button
          type="button"
          className="editor__botao"
          onClick={() => setVendo((atual) => !atual)}
        >
          {vendo ? 'Esconder o que você gravou' : 'Ver o que você gravou'}
        </button>
        {gravado.commitUrl ? (
          <a
            className="editor__botao"
            href={gravado.commitUrl}
            target="_blank"
            rel="noreferrer"
          >
            Ver o commit
          </a>
        ) : null}
        <button
          type="button"
          className="editor__botao editor__botao--fraco"
          onClick={() => {
            esquecerGravado(path);
            setGravado(null);
          }}
        >
          Dispensar
        </button>
      </div>

      {vendo ? (
        <>
          <Previa bruto={gravado.conteudo} path={path} arquivos={null} />
          <p className="editor__dica">
            Isto sai do que está guardado neste navegador, não do site. Some sozinho quando a
            publicação alcançar.
          </p>
        </>
      ) : null}
    </div>
  );
}
