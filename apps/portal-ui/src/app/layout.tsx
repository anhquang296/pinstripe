import './globals.css';

import { ProviderRegistry } from '@providers/ProviderRegistry';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

interface RootLayoutProps {
  children: ReactNode;
}

export const metadata: Metadata = {
  title: 'Cổng nhà xe · Pinstripe',
  description: 'Theo dõi công nợ, hóa đơn và gói dịch vụ của nhà xe',
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="vi">
      <body>
        <ProviderRegistry>{children}</ProviderRegistry>
      </body>
    </html>
  );
}
