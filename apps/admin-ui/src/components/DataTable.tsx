import { Button, EmptyState, Spinner, Table } from '@heroui/react';
import { createColumnHelper, flexRender, tableFeatures, useTable } from '@tanstack/react-table';
import { get, head, isEmpty, keyBy, map, size } from 'lodash-es';
import type { ReactNode } from 'react';
import { useMemo } from 'react';

interface DataTableColumn<TRow> {
  key: string;
  label: string;
  isRowHeader?: boolean;
  renderCell: (row: TRow) => ReactNode;
}

interface DataTableProps<TRow extends { id: string }> {
  label: string;
  columns: DataTableColumn<TRow>[];
  rows: TRow[];
  emptyMessage?: string;
  isLoading?: boolean;
  hasMore?: boolean;
  hasPrevious?: boolean;
  onRowAction?: (row: TRow) => void;
  onNext?: () => void;
  onPrevious?: () => void;
}

const features = tableFeatures({});

export default function DataTable<TRow extends { id: string }>({
  label,
  columns,
  rows,
  emptyMessage = 'Chưa có dữ liệu.',
  isLoading,
  hasMore,
  hasPrevious,
  onRowAction,
  onNext,
  onPrevious,
}: DataTableProps<TRow>) {
  const hasPagination = Boolean(onNext) || Boolean(onPrevious);

  const columnsByKey = useMemo(() => {
    return keyBy(columns, 'key');
  }, [columns]);

  const columnDefs = useMemo(() => {
    const columnHelper = createColumnHelper<typeof features, TRow>();

    return map(columns, (column) => {
      return columnHelper.display({
        id: column.key,
        header: column.label,
        cell: (info) => {
          return column.renderCell(info.row.original);
        },
      });
    });
  }, [columns]);

  const table = useTable({
    features,
    columns: columnDefs,
    data: rows,
    getRowId: (row) => {
      return row.id;
    },
  });

  const headers = get(head(table.getHeaderGroups()), 'headers', []);

  return (
    <div className="border-app-border-soft flex flex-col rounded-md border bg-surface">
      <Table>
        <Table.ScrollContainer>
          <Table.Content aria-label={label}>
            <Table.Header>
              {map(headers, (header) => {
                return (
                  <Table.Column
                    key={header.id}
                    id={header.id}
                    isRowHeader={get(columnsByKey, [header.id, 'isRowHeader'], false)}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </Table.Column>
                );
              })}
            </Table.Header>

            <Table.Body
              renderEmptyState={() => {
                return (
                  <EmptyState>
                    {isLoading ? <Spinner size="sm" /> : null}
                    {isLoading ? 'Đang tải…' : emptyMessage}
                  </EmptyState>
                );
              }}
            >
              {map(table.getRowModel().rows, (row) => {
                return (
                  <Table.Row
                    key={row.id}
                    id={row.id}
                    onAction={
                      onRowAction
                        ? () => {
                            onRowAction(row.original);
                          }
                        : undefined
                    }
                  >
                    {map(row.getAllCells(), (cell) => {
                      return (
                        <Table.Cell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </Table.Cell>
                      );
                    })}
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>

      {hasPagination ? (
        <div className="border-app-border-soft flex items-center justify-between border-t px-3 py-2">
          <span className="text-app-label text-[12px]">
            {isEmpty(rows) ? 'Không có mục nào' : `${size(rows)} mục trên trang này`}
          </span>

          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" isDisabled={!hasPrevious} onPress={onPrevious}>
              Trước
            </Button>
            <Button size="sm" variant="ghost" isDisabled={!hasMore} onPress={onNext}>
              Sau
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
