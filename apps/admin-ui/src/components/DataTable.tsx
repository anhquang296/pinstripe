import { Button, EmptyState, Spinner, Table } from '@heroui/react';
import { isEmpty, map, size } from 'lodash-es';
import type { ReactNode } from 'react';

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

  return (
    <div className="border-app-border-soft flex flex-col rounded-md border bg-surface">
      <Table>
        <Table.ScrollContainer>
          <Table.Content aria-label={label}>
            <Table.Header>
              {map(columns, (column) => {
                return (
                  <Table.Column key={column.key} id={column.key} isRowHeader={column.isRowHeader}>
                    {column.label}
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
              {map(rows, (row) => {
                return (
                  <Table.Row
                    key={row.id}
                    id={row.id}
                    onAction={
                      onRowAction
                        ? () => {
                            onRowAction(row);
                          }
                        : undefined
                    }
                  >
                    {map(columns, (column) => {
                      return (
                        <Table.Cell key={column.key} id={column.key}>
                          {column.renderCell(row)}
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
