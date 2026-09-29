import type { ReactNode } from "react";
import { cx } from "@/components/ui/controls";

export interface DataTableProps<T> {
  caption: string;
  headers: readonly ReactNode[];
  rows: ReadonlyArray<ReadonlyArray<T>>;
  renderCell: (value: T, rowIndex: number, colIndex: number) => ReactNode;
  cellClassName?: (value: T, rowIndex: number, colIndex: number) => string | undefined;
  /** Numeric columns are right-aligned. */
  alignRight?: (colIndex: number) => boolean;
  maxHeight?: string;
}

/** Scrollable preview table with a sticky header and row numbers. */
export function DataTable<T>({
  caption,
  headers,
  rows,
  renderCell,
  cellClassName,
  alignRight,
  maxHeight = "max-h-[62vh]",
}: DataTableProps<T>) {
  return (
    <div className={cx("overflow-auto rounded-2xl border border-line bg-white shadow-sm", maxHeight)} tabIndex={0} role="region" aria-label={caption}>
      <table className="w-full border-collapse text-left text-xs">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 z-10 bg-paper">
          <tr>
            <th scope="col" className="border-b border-line px-3 py-2 text-right font-medium text-muted">
              #
            </th>
            {headers.map((h, i) => (
              <th
                key={i}
                scope="col"
                className={cx(
                  "border-b border-line px-3 py-2 font-semibold whitespace-nowrap text-navy",
                  alignRight?.(i) && "text-right",
                )}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {rows.map((row, r) => (
            <tr key={r} className="odd:bg-white even:bg-paper/60 hover:bg-mint/40">
              <td className="border-b border-line/60 px-3 py-1.5 text-right text-muted">{r + 1}</td>
              {row.map((value, c) => (
                <td
                  key={c}
                  className={cx(
                    "max-w-[18rem] truncate border-b border-line/60 px-3 py-1.5 whitespace-nowrap",
                    alignRight?.(c) && "text-right",
                    cellClassName?.(value, r, c),
                  )}
                >
                  {renderCell(value, r, c)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function NullCell() {
  return <span className="text-muted/80 italic">null</span>;
}
