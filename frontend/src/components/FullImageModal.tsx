import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { Source } from "../types";

interface FullImageModalProps {
  source: Source;
  onClose: () => void;
}

const MIN_WIDTH = 320;
const MIN_HEIGHT = 240;
const MARGIN = 8;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;

type Edges = { left: boolean; right: boolean; top: boolean; bottom: boolean };

function initialSize(): { width: number; height: number } {
  return {
    width: Math.min(880, Math.round(window.innerWidth * 0.9)),
    height: Math.min(640, Math.round(window.innerHeight * 0.85)),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

const HANDLES: Array<{ edges: Edges; label: string; className: string }> = [
  {
    edges: { left: true, right: false, top: false, bottom: false },
    label: "Resize from the left",
    className: "left-0 top-3 bottom-3 w-2 cursor-ew-resize",
  },
  {
    edges: { left: false, right: true, top: false, bottom: false },
    label: "Resize from the right",
    className: "right-0 top-3 bottom-3 w-2 cursor-ew-resize",
  },
  {
    edges: { left: false, right: false, top: true, bottom: false },
    label: "Resize from the top",
    className: "top-0 left-3 right-3 h-2 cursor-ns-resize",
  },
  {
    edges: { left: false, right: false, top: false, bottom: true },
    label: "Resize from the bottom",
    className: "bottom-0 left-3 right-3 h-2 cursor-ns-resize",
  },
  {
    edges: { left: true, right: false, top: true, bottom: false },
    label: "Resize from the top left",
    className: "left-0 top-0 h-4 w-4 cursor-nwse-resize",
  },
  {
    edges: { left: false, right: true, top: true, bottom: false },
    label: "Resize from the top right",
    className: "right-0 top-0 h-4 w-4 cursor-nesw-resize",
  },
  {
    edges: { left: true, right: false, top: false, bottom: true },
    label: "Resize from the bottom left",
    className: "bottom-0 left-0 h-4 w-4 cursor-nesw-resize",
  },
  {
    edges: { left: false, right: true, top: false, bottom: true },
    label: "Resize from the bottom right",
    className: "bottom-0 right-0 h-4 w-4 cursor-nwse-resize",
  },
];

const FullImageModal: React.FC<FullImageModalProps> = ({ source, onClose }) => {
  const [size, setSize] = useState(initialSize);
  const [origin, setOrigin] = useState<{ top: number; left: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);

  const changeZoom = (nextZoom: number) => {
    const clamped = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
    setZoom(clamped);
    if (clamped <= 1) {
      setPan({ x: 0, y: 0 });
    }
  };

  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [source.id]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        changeZoom(zoom + ZOOM_STEP);
      } else if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        changeZoom(zoom - ZOOM_STEP);
      } else if (event.key === "0") {
        event.preventDefault();
        changeZoom(1);
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [onClose, zoom]);

  const startPan = (event: React.PointerEvent<HTMLDivElement>) => {
    if (zoom <= 1) {
      return;
    }
    event.preventDefault();
    const viewport = event.currentTarget;
    const rect = viewport.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const startPan = pan;
    setIsPanning(true);
    viewport.setPointerCapture(event.pointerId);

    const onMove = (moveEvent: PointerEvent) => {
      const maxX = ((zoom - 1) * rect.width) / 2;
      const maxY = ((zoom - 1) * rect.height) / 2;
      setPan({
        x: clamp(startPan.x + moveEvent.clientX - startX, -maxX, maxX),
        y: clamp(startPan.y + moveEvent.clientY - startY, -maxY, maxY),
      });
    };
    const onUp = () => {
      setIsPanning(false);
      viewport.removeEventListener("pointermove", onMove);
      viewport.removeEventListener("pointerup", onUp);
    };
    viewport.addEventListener("pointermove", onMove);
    viewport.addEventListener("pointerup", onUp);
  };

  const startResize = (event: React.PointerEvent<HTMLButtonElement>, edges: Edges) => {
    event.preventDefault();
    event.stopPropagation();
    const frame = event.currentTarget.parentElement;
    if (!frame) {
      return;
    }

    const rect = frame.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const startWidth = rect.width;
    const startHeight = rect.height;
    const startLeft = rect.left;
    const startTop = rect.top;
    setOrigin({ top: startTop, left: startLeft });

    const onMove = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      let width = startWidth;
      let height = startHeight;
      let left = startLeft;
      let top = startTop;

      if (edges.right) {
        width = clamp(startWidth + dx, MIN_WIDTH, window.innerWidth - startLeft - MARGIN);
      }
      if (edges.left) {
        width = clamp(startWidth - dx, MIN_WIDTH, startLeft + startWidth - MARGIN);
        left = startLeft + startWidth - width;
      }
      if (edges.bottom) {
        height = clamp(startHeight + dy, MIN_HEIGHT, window.innerHeight - startTop - MARGIN);
      }
      if (edges.top) {
        height = clamp(startHeight - dy, MIN_HEIGHT, startTop + startHeight - MARGIN);
        top = startTop + startHeight - height;
      }

      setSize({ width, height });
      setOrigin({ top, left });
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return createPortal(
    <div className="fixed inset-0 z-50 bg-black/70" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Full image of ${source.name}`}
        className="fixed flex flex-col overflow-hidden rounded-lg bg-neutral-950 shadow-2xl"
        style={{
          width: size.width,
          height: size.height,
          top: origin ? origin.top : "50%",
          left: origin ? origin.left : "50%",
          transform: origin ? "none" : "translate(-50%, -50%)",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 bg-white px-4 py-3">
          <h2 className="truncate text-lg font-semibold text-gray-900">{source.name}</h2>
          <div className="flex shrink-0 items-center gap-2">
            <div className="flex items-center rounded border" aria-label="Image zoom controls">
              <button
                type="button"
                aria-label="Zoom out"
                title="Zoom out"
                className="px-3 py-1 text-lg leading-none hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={zoom <= MIN_ZOOM}
                onClick={() => changeZoom(zoom - ZOOM_STEP)}
              >
                −
              </button>
              <button
                type="button"
                aria-label="Reset zoom"
                title="Reset zoom"
                className="min-w-16 border-x px-2 py-1 text-sm hover:bg-gray-100"
                onClick={() => changeZoom(1)}
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                type="button"
                aria-label="Zoom in"
                title="Zoom in"
                className="px-3 py-1 text-lg leading-none hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={zoom >= MAX_ZOOM}
                onClick={() => changeZoom(zoom + ZOOM_STEP)}
              >
                +
              </button>
            </div>
            <button
              type="button"
              className="rounded border px-3 py-1 text-sm hover:bg-gray-100"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
        <div
          className={`relative min-h-0 flex-1 overflow-hidden bg-neutral-950 ${
            zoom > 1 ? (isPanning ? "cursor-grabbing" : "cursor-grab") : ""
          }`}
          onPointerDown={startPan}
          onDoubleClick={() => changeZoom(zoom === 1 ? 2 : 1)}
        >
          <img
            src={source.image_url ?? ""}
            alt={source.name}
            draggable={false}
            className="h-full w-full select-none object-contain"
            style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
          />
        </div>
        {HANDLES.map((handle) => (
          <button
            key={handle.label}
            type="button"
            aria-label={handle.label}
            className={`absolute z-10 ${handle.className}`}
            onPointerDown={(event) => startResize(event, handle.edges)}
          />
        ))}
      </div>
    </div>,
    document.body
  );
};

export default FullImageModal;
