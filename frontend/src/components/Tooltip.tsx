import React, { useId, useState } from "react";
import { createPortal } from "react-dom";

type TooltipSide = "right" | "right-start" | "bottom" | "bottom-start";

interface TooltipProps {
  label: string;
  side?: TooltipSide;
  className?: string;
  children: React.ReactElement;
}

interface TipBox {
  top: number;
  left: number;
}

function placeTip(rect: DOMRect, side: TooltipSide): TipBox {
  if (side === "right") {
    return { top: rect.top + rect.height / 2, left: rect.right + 10 };
  }
  if (side === "right-start") {
    return { top: rect.top + 8, left: rect.right + 10 };
  }
  if (side === "bottom-start") {
    return { top: rect.bottom + 10, left: rect.left };
  }
  return { top: rect.bottom + 10, left: rect.left + rect.width / 2 };
}

const tipPosition: Record<TooltipSide, string> = {
  right: "-translate-y-1/2",
  "right-start": "",
  bottom: "-translate-x-1/2",
  "bottom-start": "",
};

const tipArrow: Record<TooltipSide, string> = {
  right: "absolute -left-1 top-1/2 -translate-y-1/2 border-y-[5px] border-r-[5px] border-y-transparent border-r-gray-900",
  "right-start": "absolute -left-1 top-3 border-y-[5px] border-r-[5px] border-y-transparent border-r-gray-900",
  bottom: "absolute -top-1 left-1/2 -translate-x-1/2 border-x-[5px] border-b-[5px] border-x-transparent border-b-gray-900",
  "bottom-start": "absolute -top-1 left-3 border-x-[5px] border-b-[5px] border-x-transparent border-b-gray-900",
};

function Tooltip({ label, side = "bottom", className, children }: TooltipProps) {
  const tipId = useId();
  const anchorRef = React.useRef<HTMLSpanElement>(null);
  const [box, setBox] = useState<TipBox | null>(null);

  const show = () => {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }
    setBox(placeTip(rect, side));
  };

  const hide = () => setBox(null);

  return (
    <span
      ref={anchorRef}
      className={className ?? "inline-flex"}
      onMouseEnter={show}
      onMouseLeave={hide}
      onMouseDown={hide}
      onFocus={show}
      onBlur={hide}
    >
      {React.cloneElement(children, { "aria-describedby": box ? tipId : undefined })}
      {box &&
        createPortal(
          <span
            id={tipId}
            role="tooltip"
            style={{ top: box.top, left: box.left }}
            className={`pointer-events-none fixed z-50 whitespace-nowrap rounded-lg bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg ${tipPosition[side]}`}
          >
            <span className={tipArrow[side]} aria-hidden="true" />
            {label}
          </span>,
          document.body,
        )}
    </span>
  );
}

export default Tooltip;
