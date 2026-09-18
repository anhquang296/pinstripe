import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';

const { API_DOCS_URL = 'http://localhost:3000/docs' } = process.env;

export default defineConfig({
  redirects: {
    '/api-reference': API_DOCS_URL,
  },
  integrations: [
    starlight({
      title: 'VXR Billing Engine',
      tableOfContents: false,
      defaultLocale: 'root',
      locales: {
        root: { label: 'Tiếng Việt', lang: 'vi' },
      },
      sidebar: [
        { label: 'Bắt đầu', slug: 'getting-started' },
        { label: 'Hướng dẫn', items: [{ autogenerate: { directory: 'guides' } }] },
        { label: 'Resources', slug: 'resources' },
        { label: 'API Reference', link: API_DOCS_URL },
      ],
    }),
  ],
});
