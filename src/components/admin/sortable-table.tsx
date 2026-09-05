"use client";

import { useMemo, useState, type ReactNode } from "react";

// Sorting lives on the client rather than in the URL: these lists are
// already fully loaded, and a round trip to reorder rows that are sitting
// in memory is latency for nothing. It also means the sort survives a
// filter change without either one having to know about the other.

export type Column<T> = {
  key: string;
  label: string;
  /** Absent for a column that can't be ordered, like an actions cell. */
  sort?: (row: T) => string | number;
  /** Which way the first click sorts. Counts read high-first, names A-Z. */
  initial?: "asc" | "desc";
  className?: string;
  render: (row: T) => ReactNode;
};

export type Filter = {
  id: string;
  label: string;
  count: number;
};

export function SortableTable<T>({
  rows,
  columns,
  rowKey,
  filters,
  activeFilter,
  onFilter,
  rowClassName,
  empty = "Aucune donnée.",
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  filters?: Filter[];
  activeFilter?: string;
  onFilter?: (id: string) => void;
  rowClassName?: (row: T) => string;
  empty?: string;
}) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [direction, setDirection] = useState<"asc" | "desc">("desc");

  const sorted = useMemo(() => {
    const column = columns.find((c) => c.key === sortKey);
    if (!column?.sort) return rows;

    const factor = direction === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = column.sort!(a);
      const vb = column.sort!(b);
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * factor;
      return String(va).localeCompare(String(vb), "fr") * factor;
    });
  }, [rows, columns, sortKey, direction]);

  function toggle(column: Column<T>) {
    if (!column.sort) return;
    if (sortKey === column.key) {
      setDirection((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(column.key);
    setDirection(column.initial ?? "desc");
  }

  return (
    <div className="flex flex-col gap-3">
      {filters && filters.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          {filters.map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => onFilter?.(filter.id)}
              // The count is on the chip on purpose: a filter that leads
              // to an empty table looks broken unless it told you first.
              className={`px-2 py-1 font-mono text-xs ${
                activeFilter === filter.id
                  ? "bg-neutral-800 text-neutral-100"
                  : "text-neutral-500 hover:text-neutral-200"
              }`}
            >
              {filter.label}
              <span className="ml-1.5 text-neutral-600">{filter.count}</span>
            </button>
          ))}
        </div>
      )}

      {sorted.length === 0 ? (
        <p className="py-6 text-center font-mono text-xs text-neutral-600">{empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse font-mono text-xs">
            <thead>
              <tr className="border-b border-neutral-900">
                {columns.map((column) => {
                  const active = sortKey === column.key;
                  return (
                    <th
                      key={column.key}
                      aria-sort={
                        active
                          ? direction === "asc"
                            ? "ascending"
                            : "descending"
                          : undefined
                      }
                      className="px-2 py-2 text-left text-[0.65rem] tracking-wide text-neutral-600 uppercase"
                    >
                      {column.sort ? (
                        <button
                          type="button"
                          onClick={() => toggle(column)}
                          className={`flex items-center gap-1 uppercase hover:text-neutral-200 ${
                            active ? "text-neutral-200" : ""
                          }`}
                        >
                          {column.label}
                          <span aria-hidden="true" className="text-[0.6rem]">
                            {active ? (direction === "asc" ? "▲" : "▼") : "↕"}
                          </span>
                        </button>
                      ) : (
                        column.label
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => (
                <tr
                  key={rowKey(row)}
                  className={`border-b border-neutral-900/60 hover:bg-neutral-900/40 ${
                    rowClassName?.(row) ?? ""
                  }`}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={`px-2 py-2 align-top text-neutral-300 ${column.className ?? ""}`}
                    >
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
