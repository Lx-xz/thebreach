import type { Metadata } from 'next';
import { LayoutPicker } from '@/components/LayoutPicker';
import { PageHead } from '@/components/content';

export const metadata: Metadata = {
  title: 'Layouts',
  description: 'Quatro apresentações possíveis para o mesmo acervo: Grimório, Códice, Atlas e Escriba.',
};

export default function LayoutsPage() {
  return (
    <div className="stack">
      <PageHead
        eyebrow="Escolha"
        title="Quatro layouts para o mesmo acervo"
        lede="O conteúdo é sempre o mesmo — vem do repositório breach. O que muda é a apresentação: tipografia, estrutura da página, densidade e ornamento. Clique em um para aplicar ao site inteiro e navegue à vontade antes de decidir."
      />

      <LayoutPicker detailed />

      <section className="panel">
        <p className="panel__title">Como isto funciona</p>
        <div className="prose">
          <p>
            Os quatro layouts compartilham exatamente o mesmo HTML. A troca acontece por um atributo{' '}
            <code>data-layout</code> no elemento raiz do documento, e cada layout é uma folha de estilo que
            reposiciona e reveste as mesmas peças. Por isso a troca é instantânea, não recarrega a página e
            não duplica componente nenhum.
          </p>
          <p>
            A escolha fica guardada no navegador e é reaplicada antes da primeira pintura da página, para
            que não haja piscar de layout ao navegar.
          </p>
        </div>
      </section>
    </div>
  );
}
