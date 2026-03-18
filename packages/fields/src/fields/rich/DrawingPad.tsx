/// <reference lib="dom" />
import React from 'react';

// ---------------------------------------------------------------------------
// Types (exported so Signature / Diagram field components can re-use)
// ---------------------------------------------------------------------------

/** A single normalized point (0..1 fraction of the canvas design dimensions). */
export interface NormalizedPoint {
  x: number;
  y: number;
}

/** One stroke captured during a drawing session. */
export interface Stroke {
  tool: 'pen' | 'eraser';
  color: string;
  size: number;
  /** All points stored as normalized coordinates so the drawing scales losslessly. */
  points: NormalizedPoint[];
}

/**
 * The persisted drawing payload.
 * `baseWidth` / `baseHeight` record the design dimensions used when the drawing
 * was created — they are stored for reference but strokes are always replayed
 * from their normalized coordinates, so resizing never distorts geometry.
 */
export interface DrawingData {
  strokes: Stroke[];
  baseWidth: number;
  baseHeight: number;
}

/** The value emitted by the `onChange` callback after every stroke. */
export interface DrawingPadPayload {
  /** JSON-stringified `DrawingData`. Empty string when the canvas is cleared. */
  strokes: string;
  /** Base64 PNG export of the composite display canvas. Empty string when cleared. */
  image: string;
}

/** Configuration knobs for a `DrawingPad` instance. */
export interface DrawingPadConfig {
  /**
   * Logical design width in CSS pixels.
   * Together with `baseHeight`, this establishes the aspect ratio.
   * The canvas will fill its container width while preserving this ratio.
   * Default: 600
   */
  baseWidth?: number;
  /** Default: 300 */
  baseHeight?: number;
  /** Initial pen colour. Default: '#000000' */
  strokeColor?: string;
  /** Initial pen size in logical pixels. Default: 2 */
  strokeWidth?: number;
  /** Eraser square half-size. Default: 20 */
  eraserWidth?: number;
  /** Show the eraser tool button. Default: false */
  hasEraser?: boolean;
  /** Canvas fill colour used as background. Default: '#ffffff' */
  backgroundColor?: string;
}

export interface DrawingPadProps {
  config?: DrawingPadConfig;
  /** Optional background image (base64 data-URL or remote URL) drawn beneath user strokes. */
  backgroundImage?: string;
  /** Text shown centred on an empty canvas. */
  placeholder?: string;
  /**
   * JSON-stringified `DrawingData` to pre-load.
   * Changing this prop replaces the current drawing.
   */
  existingData?: string;
  onChange?: (payload: DrawingPadPayload) => void;
  disabled?: boolean;
}

// ---------------------------------------------------------------------------
// DrawingPad
// ---------------------------------------------------------------------------

export const DrawingPad = React.memo(function DrawingPad({
  config = {},
  backgroundImage,
  placeholder = 'Draw here',
  existingData,
  onChange,
  disabled = false,
}: DrawingPadProps) {
  const {
    baseWidth = 600,
    baseHeight = 300,
    strokeColor = '#000000',
    strokeWidth = 2,
    eraserWidth = 20,
    hasEraser = false,
    backgroundColor = '#ffffff',
  } = config;

  // ---- DOM / canvas refs --------------------------------------------------

  /** The canvas the user sees — composites background + drawing layer. */
  const displayRef = React.useRef<HTMLCanvasElement>(null);
  /**
   * Hidden off-screen canvas that stores only user strokes.
   * Separating layers means the eraser clears stroke pixels without touching
   * the background image.
   */
  const drawingRef = React.useRef<HTMLCanvasElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // ---- Mutable drawing state (refs to avoid re-render on every stroke) ---

  const isDrawingRef = React.useRef(false);
  /** Last pointer position as a normalized point (0..1). */
  const lastNormRef = React.useRef<NormalizedPoint>({ x: 0, y: 0 });
  const strokesRef = React.useRef<Stroke[]>([]);
  const undoStackRef = React.useRef<Stroke[]>([]);
  const bgImageRef = React.useRef<HTMLImageElement | null>(null);
  const bgLoadedRef = React.useRef(false);

  // ---- React state (drives toolbar UI re-renders) -------------------------

  const [displaySize, setDisplaySize] = React.useState({
    width: baseWidth,
    height: baseHeight,
  });
  const [currentTool, setCurrentTool] = React.useState<'pen' | 'eraser'>('pen');
  const [currentColor, setCurrentColor] = React.useState(strokeColor);
  const [currentSize, setCurrentSize] = React.useState(strokeWidth);
  const [canUndo, setCanUndo] = React.useState(false);
  const [canRedo, setCanRedo] = React.useState(false);
  const [hasStrokes, setHasStrokes] = React.useState(false);

  // ---- Stable DPR helper --------------------------------------------------

  const getDPR = () =>
    typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

  // ---- Canvas backing-store setup -----------------------------------------

  /**
   * Resize a canvas element's backing store to `w × h` CSS pixels scaled by DPR.
   * The 2D context is scaled so all subsequent draw calls use CSS coordinates.
   *
   * IMPORTANT: every call resets the transformation matrix, so this must be
   * called before drawing, never during a stroke.
   */
  const setupCanvas = React.useCallback(
    (canvas: HTMLCanvasElement, w: number, h: number) => {
      const dpr = getDPR();
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return ctx;
    },
    []
  );

  // ---- Background layer draw ----------------------------------------------

  const drawBackground = React.useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, w, h);

      const img = bgImageRef.current;
      if (!img || !bgLoadedRef.current) return;

      // Fit image inside canvas with uniform padding, preserving aspect ratio.
      const padding = 6;
      const aw = w - padding * 2;
      const ah = h - padding * 2;
      const imgR = img.naturalWidth / img.naturalHeight;
      const areaR = aw / ah;
      let dw: number, dh: number;
      if (imgR > areaR) {
        dw = aw;
        dh = aw / imgR;
      } else {
        dh = ah;
        dw = ah * imgR;
      }
      const x = padding + (aw - dw) / 2;
      const y = padding + (ah - dh) / 2;
      ctx.drawImage(img, x, y, dw, dh);
    },
    [backgroundColor]
  );

  // ---- Composite display canvas -------------------------------------------

  /**
   * Rebuild the visible display canvas from:
   *   1. Background colour + optional background image
   *   2. Placeholder text (only when no strokes exist)
   *   3. The hidden drawing layer
   */
  const composite = React.useCallback(
    (w: number, h: number) => {
      const display = displayRef.current;
      const drawing = drawingRef.current;
      if (!display || !drawing) return;

      const ctx = display.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);
      drawBackground(ctx, w, h);

      if (strokesRef.current.length === 0) {
        const fontSize = Math.max(12, Math.min(16, w / 36));
        ctx.font = `${fontSize}px sans-serif`;
        ctx.fillStyle = '#b0b0b0';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(placeholder, w / 2, h / 2);
      }

      // Blit drawing layer on top — use element dimensions for source so the
      // DPR-scaled backing store maps correctly to logical coordinates.
      ctx.drawImage(drawing, 0, 0, drawing.width, drawing.height, 0, 0, w, h);
    },
    [drawBackground, placeholder]
  );

  // ---- Stroke redraw from normalized points --------------------------------

  /**
   * Replay all recorded strokes onto the drawing layer using the current
   * display dimensions. Called after resize, undo/redo, or data load.
   */
  const redrawStrokes = React.useCallback(
    (w: number, h: number) => {
      const drawing = drawingRef.current;
      if (!drawing) return;

      const ctx = drawing.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, drawing.width, drawing.height);

      for (const stroke of strokesRef.current) {
        if (stroke.tool === 'eraser') {
          const half = eraserWidth / 2;
          for (const pt of stroke.points) {
            ctx.clearRect(
              pt.x * w - half,
              pt.y * h - half,
              eraserWidth,
              eraserWidth
            );
          }
        } else {
          if (stroke.points.length === 1) {
            const pt = stroke.points[0];
            ctx.fillStyle = stroke.color;
            ctx.beginPath();
            ctx.arc(
              pt.x * w,
              pt.y * h,
              Math.max(1, stroke.size / 2),
              0,
              Math.PI * 2
            );
            ctx.fill();
            continue;
          }
          ctx.strokeStyle = stroke.color;
          ctx.lineWidth = stroke.size;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.beginPath();
          stroke.points.forEach((pt, i) => {
            const px = pt.x * w;
            const py = pt.y * h;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          });
          ctx.stroke();
        }
      }
    },
    [eraserWidth]
  );

  // ---- Full repaint helper -------------------------------------------------

  const repaint = React.useCallback(
    (w: number, h: number) => {
      redrawStrokes(w, h);
      composite(w, h);
    },
    [redrawStrokes, composite]
  );

  // ---- Coordinate helpers -------------------------------------------------

  /**
   * Convert a pointer client position to a normalized point (0..1 fractions
   * of the canvas logical dimensions). This is the single canonical transform:
   *
   *   nx = (clientX - rect.left) / rect.width
   *   ny = (clientY - rect.top)  / rect.height
   *
   * Using `rect.width / rect.height` (the CSS rendered size) rather than raw
   * canvas dimensions means the math is DPR-transparent.
   */
  const toNorm = React.useCallback(
    (clientX: number, clientY: number): NormalizedPoint | null => {
      const canvas = displayRef.current;
      if (!canvas) return null;
      const r = canvas.getBoundingClientRect();
      return {
        x: Math.max(0, Math.min(1, (clientX - r.left) / r.width)),
        y: Math.max(0, Math.min(1, (clientY - r.top) / r.height)),
      };
    },
    []
  );

  // ---- Drawing segment (incremental, called during pointer-move) ----------

  /**
   * Paint a single line segment directly onto the drawing layer.
   * Coordinates are in logical CSS pixels (not normalized).
   * Called every pointer-move to give immediate visual feedback before a full
   * repaint would be needed.
   */
  const drawSegment = React.useCallback(
    (
      x0: number,
      y0: number,
      x1: number,
      y1: number,
      tool: 'pen' | 'eraser',
      color: string,
      size: number
    ) => {
      const drawing = drawingRef.current;
      const display = displayRef.current;
      if (!drawing || !display) return;

      const dCtx = drawing.getContext('2d');
      if (!dCtx) return;
      const { width: w, height: h } = displaySize;

      if (tool === 'eraser') {
        const half = eraserWidth / 2;
        dCtx.clearRect(x0 - half, y0 - half, eraserWidth, eraserWidth);
        dCtx.clearRect(x1 - half, y1 - half, eraserWidth, eraserWidth);
      } else {
        if (x0 === x1 && y0 === y1) {
          dCtx.fillStyle = color;
          dCtx.beginPath();
          dCtx.arc(x0, y0, Math.max(1, size / 2), 0, Math.PI * 2);
          dCtx.fill();
        } else {
          dCtx.strokeStyle = color;
          dCtx.lineWidth = size;
          dCtx.lineCap = 'round';
          dCtx.lineJoin = 'round';
          dCtx.beginPath();
          dCtx.moveTo(x0, y0);
          dCtx.lineTo(x1, y1);
          dCtx.stroke();
        }
      }

      // Fast composite — cheaper than full repaint mid-stroke.
      composite(w, h);
    },
    [eraserWidth, composite, displaySize]
  );

  // ---- Change emission ----------------------------------------------------

  const emitChange = React.useCallback(() => {
    if (!onChange) return;
    const display = displayRef.current;
    const image = display ? display.toDataURL('image/png') : '';
    const data: DrawingData = {
      strokes: strokesRef.current,
      baseWidth,
      baseHeight,
    };
    onChange({ strokes: JSON.stringify(data), image });
  }, [onChange, baseWidth, baseHeight]);

  // ---- Pointer handlers ---------------------------------------------------

  const handleDown = React.useCallback(
    (clientX: number, clientY: number) => {
      if (disabled) return;
      const norm = toNorm(clientX, clientY);
      if (!norm) return;

      isDrawingRef.current = true;
      lastNormRef.current = norm;

      // Snapshot tool state at stroke start so the stroke is self-consistent.
      strokesRef.current = [
        ...strokesRef.current,
        {
          tool: currentTool,
          color: currentColor,
          size: currentSize,
          points: [norm],
        },
      ];
      undoStackRef.current = []; // clear redo history on new stroke
      setHasStrokes(true);
      setCanUndo(true);
      setCanRedo(false);

      // Render an immediate dot/erase mark even if the pointer doesn't move.
      const { width: w, height: h } = displaySize;
      drawSegment(
        norm.x * w,
        norm.y * h,
        norm.x * w,
        norm.y * h,
        currentTool,
        currentColor,
        currentSize
      );
    },
    [
      disabled,
      toNorm,
      currentTool,
      currentColor,
      currentSize,
      displaySize,
      drawSegment,
    ]
  );

  const handleMove = React.useCallback(
    (clientX: number, clientY: number) => {
      if (!isDrawingRef.current) return;
      const norm = toNorm(clientX, clientY);
      if (!norm) return;

      const { width: w, height: h } = displaySize;
      const last = lastNormRef.current;

      drawSegment(
        last.x * w,
        last.y * h,
        norm.x * w,
        norm.y * h,
        currentTool,
        currentColor,
        currentSize
      );

      // Append to current stroke's point list.
      const current = strokesRef.current[strokesRef.current.length - 1];
      if (current) current.points.push(norm);

      lastNormRef.current = norm;
    },
    [toNorm, drawSegment, currentTool, currentColor, currentSize, displaySize]
  );

  const handleUp = React.useCallback(() => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    emitChange();
  }, [emitChange]);

  // ---- Mouse event bindings -----------------------------------------------

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    handleDown(e.clientX, e.clientY);
  };
  const onMouseMove = (e: React.MouseEvent) => handleMove(e.clientX, e.clientY);
  const onMouseUp = () => handleUp();
  const onMouseLeave = () => {
    if (isDrawingRef.current) handleUp();
  };

  // ---- Touch event bindings (passive:false required for preventDefault) ---

  React.useEffect(() => {
    const canvas = displayRef.current;
    if (!canvas) return;

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      const t = e.touches[0];
      if (t) handleDown(t.clientX, t.clientY);
    };
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const t = e.touches[0];
      if (t) handleMove(t.clientX, t.clientY);
    };
    const onTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      handleUp();
    };

    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });
    return () => {
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
    };
  }, [handleDown, handleMove, handleUp]);

  // ---- Background image load ----------------------------------------------

  React.useEffect(() => {
    if (!backgroundImage) {
      bgImageRef.current = null;
      bgLoadedRef.current = false;
      repaint(displaySize.width, displaySize.height);
      return;
    }
    const img = new Image();
    img.onload = () => {
      bgImageRef.current = img;
      bgLoadedRef.current = true;
      repaint(displaySize.width, displaySize.height);
    };
    img.onerror = () => {
      bgImageRef.current = null;
      bgLoadedRef.current = false;
    };
    img.src = backgroundImage;
  }, [backgroundImage]); // intentionally omit repaint from deps — fires only when source changes

  // ---- Existing data load -------------------------------------------------

  React.useEffect(() => {
    strokesRef.current = [];
    setHasStrokes(false);
    setCanUndo(false);
    setCanRedo(false);

    if (!existingData) {
      repaint(displaySize.width, displaySize.height);
      return;
    }
    try {
      const data = JSON.parse(existingData) as DrawingData;
      if (Array.isArray(data.strokes)) {
        strokesRef.current = data.strokes;
        setHasStrokes(data.strokes.length > 0);
        setCanUndo(data.strokes.length > 0);
      }
    } catch {
      // corrupt / legacy data — start empty
    }
    repaint(displaySize.width, displaySize.height);
  }, [existingData]); // intentionally omit repaint from deps — fires only when source data changes

  // ---- Aspect-ratio preserving responsive resize --------------------------

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observe = () => {
      const w = container.getBoundingClientRect().width;
      if (w <= 0) return;
      const h = (w * baseHeight) / baseWidth;
      setDisplaySize({ width: w, height: h });
    };

    observe();
    const ro = new ResizeObserver(observe);
    ro.observe(container);
    return () => ro.disconnect();
  }, [baseWidth, baseHeight]);

  // ---- Rebuild both canvases when displaySize changes ---------------------

  React.useEffect(() => {
    const display = displayRef.current;
    const drawing = drawingRef.current;
    if (!display || !drawing || displaySize.width <= 0) return;

    const { width: w, height: h } = displaySize;
    setupCanvas(display, w, h);
    setupCanvas(drawing, w, h);
    repaint(w, h);
  }, [displaySize, setupCanvas, repaint]);

  // ---- Undo / redo / clear ------------------------------------------------

  const undo = React.useCallback(() => {
    const stroke = strokesRef.current.pop();
    if (stroke) undoStackRef.current.push(stroke);
    const { width: w, height: h } = displaySize;
    setCanUndo(strokesRef.current.length > 0);
    setCanRedo(undoStackRef.current.length > 0);
    setHasStrokes(strokesRef.current.length > 0);
    repaint(w, h);
  }, [displaySize, repaint]);

  const redo = React.useCallback(() => {
    const stroke = undoStackRef.current.pop();
    if (stroke) strokesRef.current.push(stroke);
    const { width: w, height: h } = displaySize;
    setCanUndo(strokesRef.current.length > 0);
    setCanRedo(undoStackRef.current.length > 0);
    setHasStrokes(strokesRef.current.length > 0);
    repaint(w, h);
  }, [displaySize, repaint]);

  const clear = React.useCallback(() => {
    strokesRef.current = [];
    undoStackRef.current = [];
    const { width: w, height: h } = displaySize;
    setHasStrokes(false);
    setCanUndo(false);
    setCanRedo(false);
    repaint(w, h);
    onChange?.({ strokes: '', image: '' });
  }, [displaySize, repaint, onChange]);

  // ---- Cursors ------------------------------------------------------------

  const penCursor = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 20h4L18.5 9.5a2.828 2.828 0 1 0-4-4L4 16v4'/%3E%3Cpath d='m13.5 6.5 4 4'/%3E%3C/svg%3E") 2 22, crosshair`;
  const eraserCursor = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M19 20H8.5l-4.21-4.3a1 1 0 0 1 0-1.41l10-10a1 1 0 0 1 1.41 0l5 5a1 1 0 0 1 0 1.41L11.5 20'/%3E%3Cpath d='M18 13.3 11.7 7'/%3E%3C/svg%3E") 2 22, cell`;

  // Colour palette (the same three as the old QB DrawingCanvas)
  const COLOR_PALETTE = ['#000000', '#ef4444', '#3b82f6'];

  // ---- Render -------------------------------------------------------------

  return (
    <div ref={containerRef} className="drawing-pad ms:w-full">
      {/* Display canvas + overlaid action buttons */}
      <div className="drawing-pad-canvas-wrapper ms:relative ms:rounded ms:overflow-hidden ms:border ms:border-msborder">
        <canvas
          ref={displayRef}
          style={{
            width: `${displaySize.width}px`,
            height: `${displaySize.height}px`,
            display: 'block',
            touchAction: 'none',
            cursor: disabled
              ? 'default'
              : currentTool === 'eraser'
              ? eraserCursor
              : penCursor,
          }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseLeave}
        />
        {/* Off-screen drawing layer — never displayed directly */}
        <canvas ref={drawingRef} style={{ display: 'none' }} />

        {/* Undo / redo / clear overlay */}
        {!disabled && (hasStrokes || canUndo || canRedo) && (
          <div className="drawing-pad-actions ms:absolute ms:top-2 ms:right-2 ms:flex ms:gap-1">
            <button
              type="button"
              onClick={undo}
              disabled={!canUndo}
              title="Undo"
              className="drawing-pad-undo ms:w-7 ms:h-7 ms:flex ms:items-center ms:justify-center ms:rounded ms:bg-mssurface ms:text-mstext ms:border ms:border-msborder ms:hover:bg-msbackground ms:disabled:opacity-40 ms:disabled:cursor-not-allowed ms:outline-none ms:focus:outline-none ms:cursor-pointer"
            >
              <svg
                className="ms:w-3.5 ms:h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                />
              </svg>
            </button>
            <button
              type="button"
              onClick={redo}
              disabled={!canRedo}
              title="Redo"
              className="drawing-pad-redo ms:w-7 ms:h-7 ms:flex ms:items-center ms:justify-center ms:rounded ms:bg-mssurface ms:text-mstext ms:border ms:border-msborder ms:hover:bg-msbackground ms:disabled:opacity-40 ms:disabled:cursor-not-allowed ms:outline-none ms:focus:outline-none ms:cursor-pointer"
            >
              <svg
                className="ms:w-3.5 ms:h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 10H11a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6"
                />
              </svg>
            </button>
            <button
              type="button"
              onClick={clear}
              title="Clear"
              className="drawing-pad-clear ms:w-7 ms:h-7 ms:flex ms:items-center ms:justify-center ms:rounded ms:bg-msdanger/10 ms:text-msdanger ms:border ms:border-msdanger/20 ms:hover:bg-msdanger/20 ms:outline-none ms:focus:outline-none ms:cursor-pointer"
            >
              <svg
                className="ms:w-3.5 ms:h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Toolbar */}
      {!disabled && (
        <div className="drawing-pad-toolbar ms:flex ms:gap-1.5 ms:mt-1.5 ms:items-center">
          {/* Pen */}
          <button
            type="button"
            onClick={() => setCurrentTool('pen')}
            title="Pen"
            className={`drawing-pad-pen-btn ms:w-7 ms:h-7 ms:flex ms:items-center ms:justify-center ms:rounded ms:border ms:outline-none ms:focus:outline-none ms:cursor-pointer ms:transition-colors ${
              currentTool === 'pen'
                ? 'ms:bg-msprimary ms:text-mstextsecondary ms:border-msprimary'
                : 'ms:bg-msbackground ms:text-mstext ms:border-msborder ms:hover:bg-msbackgroundsecondary'
            }`}
          >
            <svg
              className="ms:w-3.5 ms:h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 20h4L18.5 9.5a2.828 2.828 0 1 0-4-4L4 16v4m9.5-13.5 4 4"
              />
            </svg>
          </button>

          {/* Eraser (optional) */}
          {hasEraser && (
            <button
              type="button"
              onClick={() => setCurrentTool('eraser')}
              title="Eraser"
              className={`drawing-pad-eraser-btn ms:w-7 ms:h-7 ms:flex ms:items-center ms:justify-center ms:rounded ms:border ms:outline-none ms:focus:outline-none ms:cursor-pointer ms:transition-colors ${
                currentTool === 'eraser'
                  ? 'ms:bg-msprimary ms:text-mstextsecondary ms:border-msprimary'
                  : 'ms:bg-msbackground ms:text-mstext ms:border-msborder ms:hover:bg-msbackgroundsecondary'
              }`}
            >
              <svg
                className="ms:w-3.5 ms:h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 20H8.5l-4.21-4.3a1 1 0 0 1 0-1.41l10-10a1 1 0 0 1 1.41 0l5 5a1 1 0 0 1 0 1.41L11.5 20m6.5-6.7-6.3-6.3"
                />
              </svg>
            </button>
          )}

          {/* Only show colour + size pickers when drawing with pen */}
          {currentTool === 'pen' && (
            <>
              <div className="ms:w-px ms:h-5 ms:bg-msborder ms:shrink-0" />

              {/* Colour swatches */}
              {COLOR_PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCurrentColor(c)}
                  title={c}
                  style={{ backgroundColor: c }}
                  className={`drawing-pad-color-btn ms:w-5 ms:h-5 ms:rounded-full ms:border-0 ms:outline-none ms:focus:outline-none ms:cursor-pointer ms:transition-all ms:shrink-0 ${
                    currentColor === c
                      ? 'ms:ring-2 ms:ring-msprimary ms:ring-offset-1'
                      : 'ms:hover:scale-110'
                  }`}
                />
              ))}

              {/* Custom colour picker */}
              <div
                title="Custom colour"
                className={`drawing-pad-custom-color ms:relative ms:w-5 ms:h-5 ms:rounded-full ms:overflow-hidden ms:cursor-pointer ms:shrink-0 ms:transition-all ${
                  !COLOR_PALETTE.includes(currentColor)
                    ? 'ms:ring-2 ms:ring-msprimary ms:ring-offset-1'
                    : 'ms:hover:scale-110'
                }`}
                style={{
                  backgroundColor: COLOR_PALETTE.includes(currentColor)
                    ? '#808080'
                    : currentColor,
                }}
              >
                <input
                  type="color"
                  value={
                    COLOR_PALETTE.includes(currentColor)
                      ? '#808080'
                      : currentColor
                  }
                  onChange={(e) => setCurrentColor(e.target.value)}
                  className="ms:absolute ms:inset-0 ms:w-full ms:h-full ms:opacity-0 ms:cursor-pointer"
                />
              </div>

              <div className="ms:w-px ms:h-5 ms:bg-msborder ms:shrink-0" />

              {/* Size buttons */}
              {([1, 2, 3] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setCurrentSize(s)}
                  title={`${s}px`}
                  className={`drawing-pad-size-btn ms:w-7 ms:h-7 ms:flex ms:items-center ms:justify-center ms:rounded ms:border ms:outline-none ms:focus:outline-none ms:cursor-pointer ms:transition-all ${
                    currentSize === s
                      ? 'ms:bg-msprimary ms:border-msprimary'
                      : 'ms:bg-msbackground ms:border-msborder ms:hover:bg-msbackgroundsecondary'
                  }`}
                >
                  <div
                    className={`ms:rounded-full ${
                      currentSize === s
                        ? 'ms:bg-mstextsecondary'
                        : 'ms:bg-mstext'
                    }`}
                    style={{ width: s * 3, height: s * 3 }}
                  />
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
});
