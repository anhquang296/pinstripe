import './styles/globals.css';

import { ProviderRegistry } from '@providers/ProviderRegistry';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

const container = document.getElementById('root');

if (container) {
  createRoot(container).render(
    <StrictMode>
      <ProviderRegistry />
    </StrictMode>,
  );
} else {
  throw new Error('main() missing #root container in index.html');
}
