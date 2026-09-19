import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { map } from 'lodash-es';
import { afterEach, describe, expect, it, vi } from 'vitest';

import DataTable from './DataTable';

interface Customer {
  id: string;
  name: string;
  email: string;
  currency: string;
}

const CUSTOMERS: Customer[] = [
  { id: 'cus_1', name: 'Kate Moore', email: 'kate@acme.test', currency: 'vnd' },
  { id: 'cus_2', name: 'John Smith', email: 'john@acme.test', currency: 'usd' },
];

function setup(overrides: { rows?: Customer[]; onRowAction?: (customer: Customer) => void } = {}) {
  const { rows = CUSTOMERS, onRowAction } = overrides;

  const columns = [
    {
      key: 'name',
      label: 'Tên',
      isRowHeader: true,
      renderCell: (customer: Customer) => {
        return customer.name;
      },
    },
    {
      key: 'email',
      label: 'Email',
      renderCell: (customer: Customer) => {
        return customer.email;
      },
    },
    {
      key: 'currency',
      label: 'Tiền tệ',
      renderCell: (customer: Customer) => {
        return customer.currency;
      },
    },
  ];

  const view = render(
    <DataTable label="Khách hàng" columns={columns} rows={rows} onRowAction={onRowAction} />,
  );

  return { columns, view };
}

function findBodyRows() {
  const [, ...bodyRows] = screen.getAllByRole('row');

  return bodyRows;
}

afterEach(() => {
  cleanup();
});

describe('DataTable', () => {
  it('renders every column and cell when rows are present on the first render', () => {
    setup();

    expect(screen.getAllByRole('columnheader')).toHaveLength(3);
    expect(findBodyRows()).toHaveLength(2);

    for (const bodyRow of findBodyRows()) {
      expect(within(bodyRow).getAllByRole('rowheader')).toHaveLength(1);
      expect(within(bodyRow).getAllByRole('gridcell')).toHaveLength(2);
    }
  });

  it('keeps its columns when rows arrive after the first render', () => {
    const { columns, view } = setup({ rows: [] });

    view.rerender(<DataTable label="Khách hàng" columns={columns} rows={CUSTOMERS} />);

    expect(screen.getAllByRole('columnheader')).toHaveLength(3);
    expect(map(findBodyRows(), 'textContent')).toEqual([
      'Kate Moorekate@acme.testvnd',
      'John Smithjohn@acme.testusd',
    ]);
  });

  it('calls onRowAction with the clicked row', () => {
    const onRowAction = vi.fn();
    setup({ onRowAction });

    fireEvent.click(screen.getByText('John Smith'));

    expect(onRowAction).toHaveBeenCalledWith(CUSTOMERS[1]);
  });
});
