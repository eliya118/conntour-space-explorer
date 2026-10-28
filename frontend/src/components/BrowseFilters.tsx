import React, { useEffect, useMemo, useRef, useState } from "react";
import { DateRange, DayPicker } from "react-day-picker";
import "react-day-picker/style.css";

const KEYWORD_PAGE_SIZE = 8;

interface BrowseFiltersProps {
  dateFrom: string;
  dateTo: string;
  center: string;
  keyword: string;
  centers: string[];
  keywords: string[];
  dateMin: string | null;
  dateMax: string | null;
  onDateChange: (dateFrom: string, dateTo: string) => void;
  onCenterChange: (value: string) => void;
  onKeywordChange: (value: string) => void;
  onClear: () => void;
}

type Panel = "date" | "center" | "keyword";

function parseISODate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toISODate(value: Date): string {
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${value.getFullYear()}-${month}-${day}`;
}

function formatLabel(dateFrom: string, dateTo: string): string {
  const format = (value: string) =>
    parseISODate(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  if (dateFrom && dateTo) {
    return `${format(dateFrom)} – ${format(dateTo)}`;
  }
  if (dateFrom) {
    return `From ${format(dateFrom)}`;
  }
  if (dateTo) {
    return `Until ${format(dateTo)}`;
  }
  return "Any date";
}

function monthDate(value: string | null): Date | undefined {
  if (!value) {
    return undefined;
  }
  const date = parseISODate(value);
  return new Date(date.getFullYear(), date.getMonth());
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      className={`h-4 w-4 shrink-0 text-gray-400 transition ${open ? "rotate-180" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M5 7.5 10 12.5 15 7.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface FilterMenuProps {
  label: string;
  emptyLabel: string;
  value: string;
  options: string[];
  open: boolean;
  searchable?: boolean;
  pageSize?: number;
  wide?: boolean;
  onToggle: () => void;
  onSelect: (value: string) => void;
}

const FilterMenu: React.FC<FilterMenuProps> = ({
  label,
  emptyLabel,
  value,
  options,
  open,
  searchable = false,
  pageSize,
  wide = false,
  onToggle,
  onSelect,
}) => {
  const [query, setQuery] = useState("");
  const [loaded, setLoaded] = useState(pageSize ?? options.length);
  const listRef = useRef<HTMLUListElement>(null);
  const sentinelRef = useRef<HTMLLIElement>(null);
  const listId = `${label}-options`;
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return options;
    }
    return options.filter((option) => option.toLowerCase().includes(needle));
  }, [options, query]);
  const shown = pageSize ? visible.slice(0, loaded) : visible;
  const hasMore = shown.length < visible.length;

  useEffect(() => {
    if (!open) {
      setQuery("");
      setLoaded(pageSize ?? options.length);
    }
  }, [open, options.length, pageSize]);

  useEffect(() => {
    setLoaded(pageSize ?? options.length);
    listRef.current?.scrollTo({ top: 0 });
  }, [query, options.length, pageSize]);

  useEffect(() => {
    const root = listRef.current;
    const sentinel = sentinelRef.current;
    if (!open || !hasMore || !pageSize || !root || !sentinel) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setLoaded((current) => current + pageSize);
        }
      },
      { root, rootMargin: "48px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [open, hasMore, pageSize, shown.length]);

  return (
    <div className="relative">
      <button
        type="button"
        className={`inline-flex h-9 max-w-[16rem] items-center gap-2 rounded-full border bg-white px-3 text-sm outline-none ${
          open ? "border-gray-900" : "border-gray-200 hover:border-gray-300"
        }`}
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={onToggle}
      >
        <span className={`truncate ${value ? "text-gray-900" : "text-gray-500"}`}>{value || emptyLabel}</span>
        <Chevron open={open} />
      </button>
      {open && (
        <div
          className={`absolute left-0 top-11 z-20 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg ${
            wide ? "w-80" : "w-64"
          }`}
        >
          {searchable && (
            <div className="border-b border-gray-100 px-3 py-2">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search"
                aria-label={`Search ${label.toLowerCase()}`}
                className="w-full bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
                autoFocus
              />
            </div>
          )}
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label={label}
            className="max-h-64 overflow-auto py-1"
          >
            <li role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={value === ""}
                className="flex w-full items-center px-3 py-2 text-left text-sm text-gray-500 hover:bg-gray-50"
                onClick={() => onSelect("")}
              >
                {emptyLabel}
              </button>
            </li>
            {shown.map((option) => {
              const selected = option === value;
              return (
                <li key={option} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    title={option}
                    className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                      selected ? "text-gray-900" : "text-gray-700"
                    }`}
                    onClick={() => onSelect(option)}
                  >
                    <span className="min-w-0 flex-1 truncate">{option}</span>
                    {selected && (
                      <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4 shrink-0 text-gray-900" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M5 10.5 8.2 14 15 6.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                </li>
              );
            })}
            {visible.length === 0 && <li className="px-3 py-6 text-center text-sm text-gray-400">No matches</li>}
            {hasMore && <li ref={sentinelRef} aria-hidden="true" className="h-px" />}
          </ul>
        </div>
      )}
    </div>
  );
};

const BrowseFilters: React.FC<BrowseFiltersProps> = ({
  dateFrom,
  dateTo,
  center,
  keyword,
  centers,
  keywords,
  dateMin,
  dateMax,
  onDateChange,
  onCenterChange,
  onKeywordChange,
  onClear,
}) => {
  const [panel, setPanel] = useState<Panel | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const canClear = Boolean(dateFrom || dateTo || center || keyword);
  const selected: DateRange | undefined = dateFrom
    ? { from: parseISODate(dateFrom), to: dateTo ? parseISODate(dateTo) : undefined }
    : undefined;

  useEffect(() => {
    if (!panel) {
      return;
    }
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setPanel(null);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPanel(null);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [panel]);

  const toggle = (next: Panel) => setPanel((current) => (current === next ? null : next));

  return (
    <div className="flex flex-wrap items-center gap-2" ref={rootRef}>
      <div className="relative">
        <button
          type="button"
          className={`inline-flex h-9 items-center gap-2 rounded-full border bg-white px-3 text-sm outline-none ${
            panel === "date" ? "border-gray-900" : "border-gray-200 hover:border-gray-300"
          } ${dateFrom || dateTo ? "text-gray-900" : "text-gray-500"}`}
          aria-expanded={panel === "date"}
          aria-label="Date range"
          onClick={() => toggle("date")}
        >
          {formatLabel(dateFrom, dateTo)}
          <Chevron open={panel === "date"} />
        </button>
        {panel === "date" && (
          <div className="browse-calendar absolute left-0 top-11 z-20 rounded-2xl border border-gray-200 bg-white p-2 shadow-lg">
            <DayPicker
              mode="range"
              selected={selected}
              captionLayout="dropdown"
              startMonth={monthDate(dateMin)}
              endMonth={monthDate(dateMax)}
              defaultMonth={selected?.from ?? monthDate(dateMax)}
              onSelect={(range) => {
                const from = range?.from ? toISODate(range.from) : "";
                const to = range?.to ? toISODate(range.to) : "";
                onDateChange(from, to);
                if (from && to && from !== to) {
                  setPanel(null);
                }
              }}
            />
          </div>
        )}
      </div>
      <FilterMenu
        label="NASA center"
        emptyLabel="All centers"
        value={center}
        options={centers}
        open={panel === "center"}
        onToggle={() => toggle("center")}
        onSelect={(value) => {
          onCenterChange(value);
          setPanel(null);
        }}
      />
      <FilterMenu
        label="Keyword"
        emptyLabel="All keywords"
        value={keyword}
        options={keywords}
        searchable
        pageSize={KEYWORD_PAGE_SIZE}
        wide
        open={panel === "keyword"}
        onToggle={() => toggle("keyword")}
        onSelect={(value) => {
          onKeywordChange(value);
          setPanel(null);
        }}
      />
      <button
        type="button"
        className="inline-flex h-9 items-center rounded-full border border-gray-200 bg-white px-3 text-sm text-gray-700 hover:border-gray-300 disabled:cursor-default disabled:text-gray-300 disabled:hover:border-gray-200"
        disabled={!canClear}
        onClick={() => {
          onClear();
          setPanel(null);
        }}
      >
        Clear filters
      </button>
    </div>
  );
};

export default BrowseFilters;
