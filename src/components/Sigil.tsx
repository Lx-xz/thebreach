/** Marca do compêndio: um losango partido — a fenda que dá nome ao acervo. */
export function Sigil({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 2.5 20.5 12 12 21.5 3.5 12z" />
      <path d="M12 2.5 9.4 12l2.6 9.5" opacity=".55" />
      <path d="M12 2.5 14.6 12 12 21.5" opacity=".55" />
    </svg>
  );
}
