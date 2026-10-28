import React from "react";

import { Source } from "../types";

interface ImageCardProps {
  source: Source;
  confidence?: number;
  onOpen: () => void;
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

const ImageCard: React.FC<ImageCardProps> = ({ source, confidence, onOpen }) => {
  const dateLabel = formatDate(source.launch_date);
  const confidenceLabel =
    confidence === undefined ? null : `${Math.round(confidence * 100)}% match`;

  return (
    <article
      className="flex h-full cursor-pointer flex-col overflow-hidden rounded-lg bg-white shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) {
          return;
        }
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
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
        {dateLabel && <p className="mb-4 text-sm text-gray-500">{dateLabel}</p>}
        <div className="mt-auto flex flex-wrap gap-2">
          <span className="inline-block rounded bg-blue-500 px-4 py-2 text-white">Details</span>
          {source.image_url && (
            <a
              href={source.image_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded border border-blue-500 px-4 py-2 text-blue-600 hover:bg-blue-50"
              onClick={(event) => event.stopPropagation()}
            >
              View Full Image
            </a>
          )}
        </div>
      </div>
    </article>
  );
};

export default ImageCard;
