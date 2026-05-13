import type { ReactNode } from "react";
import { cn } from "../../lib/utils";
import { EmptyState } from "./EmptyState";

export type ColumnAlign = "left" | "right" | "center";

export interface Column<T> {
  key: keyof T | string;
  header: string;
  render?: (row: T) => ReactNode;
  align?: ColumnAlign;
  className?: string;
  width?: string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  keyField: keyof T;
  loading?: boolean;
  emptyTitle?: string;
  emptyMessage?: string;
  emptyIcon?: ReactNode;
  emptyAction?: ReactNode;
  className?: string;
  skeletonRows?: number;
}

const ALIGN_CLASSES: Record<ColumnAlign, string> = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
};

export function DataTable<T>({
  columns,
  rows,
  keyField,
  loading = false,
  emptyTitle = "Kayıt bulunamadı",
  emptyMessage,
  emptyIcon,
  emptyAction,
  className,
  skeletonRows = 5,
}: DataTableProps<T>) {
  return (
    <div
      className={cn(
        "overflow-x-auto rounded-xl border border-border bg-surface",
        className,
      )}
    >
      <table className="w-full text-sm">
        <thead className="bg-navy-50">
          <tr>
            {columns.map((col, i) => (
              <th
                key={String(col.key) + i}
                scope="col"
                style={col.width ? { width: col.width } : undefined}
                className={cn(
                  "text-xs font-semibold uppercase tracking-wide text-navy-600 px-4 py-3",
                  ALIGN_CLASSES[col.align ?? "left"],
                  col.className,
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: skeletonRows }).map((_, rowIdx) => (
              <tr key={`skeleton-${rowIdx}`} className="border-t border-border">
                {columns.map((col, colIdx) => (
                  <td
                    key={`skeleton-${rowIdx}-${colIdx}`}
                    className="px-4 py-3"
                  >
                    <div className="skeleton h-4 w-full" />
                  </td>
                ))}
              </tr>
            ))
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="p-0">
                <EmptyState
                  icon={emptyIcon}
                  title={emptyTitle}
                  message={emptyMessage}
                  action={emptyAction}
                />
              </td>
            </tr>
          ) : (
            rows.map((row, idx) => (
              <tr
                key={String(row[keyField])}
                className="border-t border-border hover:bg-navy-50/50 transition-colors animate-slide-up"
                style={{ animationDelay: `${Math.min(idx, 10) * 30}ms` }}
              >
                {columns.map((col, colIdx) => {
                  const content = col.render
                    ? col.render(row)
                    : (row[col.key as keyof T] as ReactNode);
                  return (
                    <td
                      key={String(col.key) + colIdx}
                      className={cn(
                        "px-4 py-3 text-navy-700",
                        ALIGN_CLASSES[col.align ?? "left"],
                        col.className,
                      )}
                    >
                      {content as ReactNode}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default DataTable;
