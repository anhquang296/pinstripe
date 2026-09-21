import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import DataTable from './DataTable';
import EntityCell from './EntityCell';

function setup(overrides: { id?: string; name?: string } = {}) {
  const { id = 'cus_1', name } = overrides;

  const writeText = vi.fn().mockResolvedValue(undefined);

  vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });

  render(<EntityCell id={id} name={name} />);

  return { writeText };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('EntityCell', () => {
  it('renders the name above the id when a name is given', () => {
    setup({ name: 'Công ty TNHH Hoàng Long' });

    expect(screen.getByText('Công ty TNHH Hoàng Long').textContent).toBe('Công ty TNHH Hoàng Long');
    expect(screen.getByText('cus_1').className).toContain('text-app-label');
  });

  it('renders the id as the only line when no name is given', () => {
    setup();

    expect(screen.getByText('cus_1').className).toContain('font-medium');
  });

  it('writes the id to the clipboard when the copy button is pressed', async () => {
    const { writeText } = setup({ name: 'Công ty TNHH Hoàng Long' });

    fireEvent.click(screen.getByRole('button', { name: 'Sao chép ID' }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('cus_1');
    });
  });

  it('does not open the row drawer when the copy button inside a table row is pressed', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const onRowAction = vi.fn();

    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });

    render(
      <DataTable
        label="Khách hàng"
        rows={[{ id: 'cus_1' }]}
        onRowAction={onRowAction}
        columns={[
          {
            key: 'name',
            label: 'Khách hàng',
            isRowHeader: true,
            renderCell: (customer: { id: string }) => {
              return <EntityCell id={customer.id} name="Công ty TNHH Hoàng Long" />;
            },
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Sao chép ID' }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('cus_1');
    });

    expect(onRowAction).not.toHaveBeenCalled();
  });
});
