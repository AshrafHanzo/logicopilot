import { useEffect, useRef, useState } from "react";
import { fetchPageObjectUrl } from "../../../api/onboarding";
import { MARK_COLORS, type Mark } from "../../../types/onboarding";

export interface DraftBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A page image with existing marks overlaid; drag to draw a new normalized box. */
export function MarkCanvas({
  documentId,
  page,
  marks,
  labelForMark,
  onDraw,
  disabled,
}: {
  documentId: string;
  page: number;
  marks: Mark[];
  labelForMark: (m: Mark) => string;
  onDraw: (box: DraftBox) => void;
  disabled?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [draft, setDraft] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);

  useEffect(() => {
    let revoked: string | null = null;
    let cancelled = false;
    setImgUrl(null);
    setImgError(false);
    fetchPageObjectUrl(documentId, page)
      .then((url) => {
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        revoked = url;
        setImgUrl(url);
      })
      .catch(() => !cancelled && setImgError(true));
    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [documentId, page]);

  function rel(e: React.MouseEvent) {
    const rect = wrapRef.current!.getBoundingClientRect();
    return {
      x: Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1),
      y: Math.min(Math.max((e.clientY - rect.top) / rect.height, 0), 1),
    };
  }

  function finishDraw() {
    if (!draft) return;
    const w = Math.abs(draft.x1 - draft.x0);
    const h = Math.abs(draft.y1 - draft.y0);
    setDrawing(false);
    if (w < 0.005 || h < 0.005) {
      setDraft(null);
      return;
    }
    onDraw({ x: Math.min(draft.x0, draft.x1), y: Math.min(draft.y0, draft.y1), width: w, height: h });
    setDraft(null);
  }

  if (imgError) {
    return (
      <div className="flex h-96 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
        Could not load the page preview.
      </div>
    );
  }
  if (!imgUrl) {
    return (
      <div className="flex h-96 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-400 dark:border-slate-800 dark:bg-slate-900">
        Loading page…
      </div>
    );
  }

  return (
    <div
      ref={wrapRef}
      onMouseDown={(e) => {
        if (disabled) return;
        e.preventDefault();
        const p = rel(e);
        setDrawing(true);
        setDraft({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
      }}
      onMouseMove={(e) => {
        if (!drawing) return;
        const p = rel(e);
        setDraft((d) => (d ? { ...d, x1: p.x, y1: p.y } : d));
      }}
      onMouseUp={finishDraw}
      onMouseLeave={() => drawing && finishDraw()}
      className={`relative select-none overflow-hidden rounded-xl border border-slate-300 bg-slate-100 dark:border-slate-700 ${
        disabled ? "" : "cursor-crosshair"
      }`}
    >
      <img src={imgUrl} alt={`Page ${page}`} className="block w-full" draggable={false} />
      {marks.map((m) => {
        const color = MARK_COLORS[m.color] ?? "#6366f1";
        return (
          <div
            key={m.id}
            className="absolute rounded-sm border-2"
            style={{
              left: `${m.x * 100}%`,
              top: `${m.y * 100}%`,
              width: `${m.width * 100}%`,
              height: `${m.height * 100}%`,
              borderColor: color,
              backgroundColor: `${color}22`,
            }}
          >
            <span
              className="absolute -top-5 left-0 whitespace-nowrap rounded px-1 text-[10px] font-semibold text-white"
              style={{ backgroundColor: color }}
            >
              {labelForMark(m)}
            </span>
          </div>
        );
      })}
      {draft && (
        <div
          className="absolute rounded-sm border-2 border-dashed border-indigo-600 bg-indigo-500/10"
          style={{
            left: `${Math.min(draft.x0, draft.x1) * 100}%`,
            top: `${Math.min(draft.y0, draft.y1) * 100}%`,
            width: `${Math.abs(draft.x1 - draft.x0) * 100}%`,
            height: `${Math.abs(draft.y1 - draft.y0) * 100}%`,
          }}
        />
      )}
    </div>
  );
}
