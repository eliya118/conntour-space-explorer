import { useVirtualizer } from "@tanstack/react-virtual";
import React, { useEffect, useRef, useState } from "react";

interface VirtualGridProps<T> {
  items: T[];
  getKey: (item: T) => string | number;
  renderItem: (item: T) => React.ReactNode;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  columnsMode?: "responsive" | "single";
  estimateSize?: number;
  resetKey?: string | number | null;
  empty?: React.ReactNode;
  footer?: React.ReactNode;
}

function columnsForWidth(width: number): number {
  if (width >= 960) {
    return 3;
  }
  if (width >= 560) {
    return 2;
  }
  return 1;
}

function VirtualGrid<T>({
  items,
  getKey,
  renderItem,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  columnsMode = "responsive",
  estimateSize = 420,
  resetKey,
  empty,
  footer,
}: VirtualGridProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);
  const requestedCount = useRef(0);
  const [columns, setColumns] = useState(columnsMode === "single" ? 1 : 1);

  useEffect(() => {
    if (columnsMode === "single") {
      setColumns(1);
      return;
    }
    const element = parentRef.current;
    if (!element) {
      return;
    }
    const update = () => setColumns(columnsForWidth(element.clientWidth));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [columnsMode]);

  useEffect(() => {
    requestedCount.current = 0;
    parentRef.current?.scrollTo({ top: 0 });
  }, [resetKey]);

  const rowCount = Math.ceil(items.length / columns);
  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan: 2,
  });

  const virtualRows = virtualizer.getVirtualItems();

  useEffect(() => {
    const element = parentRef.current;
    const lastItem = virtualRows[virtualRows.length - 1];
    if (!element || element.clientHeight === 0 || !lastItem) {
      return;
    }
    if (lastItem.index < rowCount - 1 || !hasNextPage || isFetchingNextPage) {
      return;
    }
    if (requestedCount.current === items.length) {
      return;
    }
    requestedCount.current = items.length;
    fetchNextPage();
  }, [virtualRows, rowCount, hasNextPage, isFetchingNextPage, fetchNextPage, items.length]);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div ref={parentRef} className="min-h-0 flex-1 overflow-auto px-4 py-4">
        {items.length === 0 ? (
          <div className="py-16 text-center text-gray-500">{empty}</div>
        ) : (
          <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
            {virtualRows.map((virtualRow) => {
              const start = virtualRow.index * columns;
              const rowItems = items.slice(start, start + columns);
              return (
                <div
                  key={virtualRow.key}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  className="absolute left-0 top-0 w-full pb-6"
                  style={{ transform: `translateY(${virtualRow.start}px)` }}
                >
                  <div
                    className="grid gap-6"
                    style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
                  >
                    {rowItems.map((item) => (
                      <div key={getKey(item)}>{renderItem(item)}</div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {footer && <div className="shrink-0 border-t px-4 py-2 text-sm text-gray-500">{footer}</div>}
    </div>
  );
}

export default VirtualGrid;
