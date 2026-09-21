import { Card } from '@heroui/react';
import type { ReactNode } from 'react';

interface AuthCardProps {
  title: string;
  description: string;
  children: ReactNode;
}

export default function AuthCard({ title, description, children }: AuthCardProps) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <Card.Header className="flex flex-col gap-1">
          <Card.Title>{title}</Card.Title>
          <Card.Description>{description}</Card.Description>
        </Card.Header>
        <Card.Content className="flex flex-col gap-4">{children}</Card.Content>
      </Card>
    </main>
  );
}
