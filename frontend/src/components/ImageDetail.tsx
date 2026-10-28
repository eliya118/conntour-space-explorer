import { useInfiniteQuery } from "@tanstack/react-query";
import React, { useEffect } from "react";

import { errorMessage, fetchSimilar, nextOffset } from "../api/client";
import { Source } from "../types";
import ImageCard from "./ImageCard";
import VirtualGrid from "./VirtualGrid";

interface ImageDetailProps {
  source: Source;
  onOpenSource: (source: Source) => void;
  onClose: () => void;
}

function formatDate(value: string): string | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString();
}

const ImageDetail: React.FC<ImageDetailProps> = ({ source, onOpenSource, onClose }) => {
  const similar = useInfiniteQuery({
    queryKey: ["similar", source.id],
    queryFn: ({ pageParam }) => fetchSimilar(source.id, pageParam),
    initialPageParam: 0,
    getNextPageParam: nextOffset,
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const items = similar.data?.pages.flatMap((page) => page.items) ?? [];
  const total = similar.data?.pages[0]?.total ?? 0;
  const dateLabel = formatDate(source.launch_date);

  return (
    <div className="fixed inset-0 z-30 flex justify-end bg-black/40" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-xl flex-col bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label={source.name}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b px-4 py-4">
          <div>
            <h2 className="text-2xl font-semibold">{source.name}</h2>
            {source.nasa_id && <p className="text-sm text-gray-500">NASA ID {source.nasa_id}</p>}
          </div>
          <button
            type="button"
            className="rounded border px-3 py-1 text-sm hover:bg-gray-100"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="max-h-[40%] shrink-0 overflow-auto px-4 py-4">
          {source.image_url && (
            <img
              src={source.image_url}
              alt={source.name}
              className="mb-4 max-h-64 w-full rounded object-cover"
            />
          )}
          <dl className="space-y-1 text-sm">
            <div className="flex gap-2">
              <dt className="text-gray-500">Type</dt>
              <dd>{source.type}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-gray-500">Status</dt>
              <dd>{source.status}</dd>
            </div>
            {dateLabel && (
              <div className="flex gap-2">
                <dt className="text-gray-500">Date</dt>
                <dd>{dateLabel}</dd>
              </div>
            )}
          </dl>
          {source.description && <p className="mt-3 text-gray-700">{source.description}</p>}
          {source.keywords.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {source.keywords.map((keyword) => (
                <li key={keyword} className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-700">
                  {keyword}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex min-h-0 flex-1 flex-col border-t">
          <h3 className="shrink-0 px-4 pt-4 text-lg font-semibold">Similar images</h3>
          {similar.isLoading && (
            <div className="flex flex-1 items-center justify-center">
              <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-t-2 border-blue-500" />
            </div>
          )}
          {similar.isError && (
            <p className="px-4 py-6 text-red-500">{errorMessage(similar.error)}</p>
          )}
          {similar.isSuccess && (
            <VirtualGrid
              items={items}
              getKey={(item) => item.source.id}
              columnsMode="single"
              estimateSize={360}
              resetKey={source.id}
              hasNextPage={similar.hasNextPage}
              isFetchingNextPage={similar.isFetchingNextPage}
              fetchNextPage={() => {
                similar.fetchNextPage();
              }}
              empty="No similar images share keywords with this one."
              footer={
                similar.isFetchingNextPage
                  ? "Loading more..."
                  : `Showing ${items.length} of ${total}`
              }
              renderItem={(item) => (
                <ImageCard
                  source={item.source}
                  confidence={item.confidence}
                  onOpen={() => onOpenSource(item.source)}
                />
              )}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default ImageDetail;
