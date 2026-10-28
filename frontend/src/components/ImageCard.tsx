import React, { memo, useState } from "react";

import { formatDate } from "../lib/format";
import { Source } from "../types";
import FullImageModal from "./FullImageModal";

interface ImageCardProps {
  source: Source;
  confidence?: number;
  onOpen: (source: Source) => void;
}

const ImageCard = memo(function ImageCard({ source, confidence, onOpen }: ImageCardProps) {
  const [fullImageOpen, setFullImageOpen] = useState(false);
  const dateLabel = formatDate(source.launch_date);
  const confidenceLabel =
    confidence === undefined ? null : `${Math.round(confidence * 100)}% match`;

  return (
    <article
      className="flex h-full cursor-pointer flex-col overflow-hidden rounded-lg bg-white shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      role="button"
      tabIndex={0}
      onClick={() => onOpen(source)}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) {
          return;
        }
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(source);
        }
      }}
    >
      {source.image_url && (
        <img src={source.image_url} alt={source.name} className="h-48 w-full object-cover" />
      )}
      <div className="flex flex-1 flex-col p-4">
        <div className="mb-2 flex items-start justify-between gap-2">
          <h2 className="text-xl font-semibold">{source.name}</h2>
          {confidenceLabel && (
            <span className="shrink-0 rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
              {confidenceLabel}
            </span>
          )}
        </div>
        <p className="mb-2 line-clamp-3 text-gray-600">{source.description}</p>
        {(source.center || dateLabel) && (
          <p className="mb-4 text-sm text-gray-500">{[source.center, dateLabel].filter(Boolean).join(" · ")}</p>
        )}
        <div className="mt-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="inline-flex h-7 items-center rounded-md bg-gray-900 px-2.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-gray-700"
            onClick={(event) => {
              event.stopPropagation();
              onOpen(source);
            }}
          >
            Details
          </button>
          {source.image_url && (
            <button
              type="button"
              className="inline-flex h-7 items-center rounded-md border border-gray-300 bg-white px-2.5 text-xs font-medium text-gray-800 shadow-sm transition-colors hover:border-gray-400 hover:bg-gray-50"
              onClick={(event) => {
                event.stopPropagation();
                setFullImageOpen(true);
              }}
            >
              View full image
            </button>
          )}
        </div>
      </div>
      {fullImageOpen && source.image_url && (
        <FullImageModal source={source} onClose={() => setFullImageOpen(false)} />
      )}
    </article>
  );
});

export default ImageCard;
