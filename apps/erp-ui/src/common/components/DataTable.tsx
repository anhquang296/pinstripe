import { HardDrive } from '@gravity-ui/icons';
import { EmptyState, Pagination, Spinner, Table } from '@heroui/react';
import { createColumnHelper, flexRender, tableFeatures, useTable } from '@tanstack/react-table';
import { get, head, isEmpty, keyBy, map, size } from 'lodash-es';
import type { ReactNode } from 'react';
import { useMemo } from 'react';

interface DataTableColumn<TRow> {
  key: string;
  label: string;
  isRowHeader?: boolean;
  align?: 'end';
  renderCell: (row: TRow) => ReactNode;
}

interface DataTableProps<TRow extends { id: string }> {
  label: string;
  columns: DataTableColumn<TRow>[];
  rows: TRow[];
  toolbar?: ReactNode;
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
  toolbar,
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

  const isEndAligned = (columnKey: string) => {
    return get(columnsByKey, [columnKey, 'align']) === 'end';
  };

  const dataTable = (
    <Table>
      <Table.ScrollContainer>
        <Table.Content aria-label={label}>
          <Table.Header>
            {map(headers, (header) => {
              return (
                <Table.Column
                  key={header.id}
                  id={header.id}
                  className={isEndAligned(header.id) ? 'text-end' : undefined}
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
                <EmptyState className="h-full w-full flex flex-col justify-center items-center">
                  {isLoading ? (
                    <Spinner size="sm" />
                  ) : (
                    <div className="flex flex-col justify-center items-center gap-2 pt-4 pb-2">
                      <HardDrive className="size-5 text-muted" />
                      <span className="text-sm text-muted">{emptyMessage}</span>
                    </div>
                  )}
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
                    const cellContent = flexRender(cell.column.columnDef.cell, cell.getContext());

                    if (isEndAligned(cell.column.id)) {
                      return (
                        <Table.Cell key={cell.id} className="text-end">
                          <div className="flex justify-end gap-1">{cellContent}</div>
                        </Table.Cell>
                      );
                    }

                    return <Table.Cell key={cell.id}>{cellContent}</Table.Cell>;
                  })}
                </Table.Row>
              );
            })}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>

      {hasPagination ? (
        <Table.Footer>
          <Pagination size="sm" className="w-full">
            <Pagination.Summary>
              {isEmpty(rows) ? 'Không có mục nào' : `${size(rows)} mục trên trang này`}
            </Pagination.Summary>
            <Pagination.Content>
              <Pagination.Item>
                <Pagination.Previous isDisabled={!hasPrevious} onPress={onPrevious}>
                  <Pagination.PreviousIcon />
                  <span>Trước</span>
                </Pagination.Previous>
              </Pagination.Item>
              <Pagination.Item>
                <Pagination.Next isDisabled={!hasMore} onPress={onNext}>
                  <span>Sau</span>
                  <Pagination.NextIcon />
                </Pagination.Next>
              </Pagination.Item>
            </Pagination.Content>
          </Pagination>
        </Table.Footer>
      ) : null}
    </Table>
  );

  if (toolbar) {
    return (
      <div className="flex flex-col gap-3">
        {toolbar}
        {dataTable}
      </div>
    );
  }

  return dataTable;
}
