import path from 'node:path';

/**
 * O site é publicado como export estático no GitHub Pages.
 * Em project pages a URL é https://<user>.github.io/<repo>/, por isso o basePath.
 * Em desenvolvimento (ou com domínio próprio) basta deixar NEXT_PUBLIC_BASE_PATH vazio.
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  sassOptions: {
    includePaths: [path.join(process.cwd(), 'src/styles')],
  },
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

export default nextConfig;
