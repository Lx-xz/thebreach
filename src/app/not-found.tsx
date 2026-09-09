import Link from 'next/link';
import { PageHead } from '@/components/content';

export default function NotFound() {
  return (
    <div>
      <PageHead
        eyebrow="404"
        title="Nada registrado aqui"
        lede="Esta entidade não existe no acervo — ou ainda não foi documentada. Nada é inventado para preencher a lacuna."
      />
      <p className="card__text">
        <Link href="/">Voltar ao compêndio</Link>
      </p>
    </div>
  );
}
