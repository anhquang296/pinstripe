import { toast as sonner } from 'sonner';

export interface ToastOptions {
  isError?: boolean;
}

export const toast = {
  show(message: string, { isError = false }: ToastOptions = {}): void {
    if (isError) {
      sonner.error(message);

      return;
    }

    sonner.success(message);
  },
};
