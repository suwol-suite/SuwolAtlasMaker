import { Maximize2, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import type { GuiAtlasJsonSprite, GuiAtlasPagePreview } from "../../shared/gui-types";
import type { PreviewEmptyReason } from "../../shared/gui-layout";
import { calculatePivotFromStagePoint, calculatePivotPreviewPoint } from "../../shared/gui-utils";
import { calculateSpritePreviewRect } from "../../shared/project";

export type PreviewMode = "fit" | "actual" | "custom";

interface PreviewPanelProps {
  pages: GuiAtlasPagePreview[];
  selectedPageIndex: number;
  selectedSprite: GuiAtlasJsonSprite | null;
  zoom: number;
  mode: PreviewMode;
  onSelectPage(index: number): void;
  onZoomIn(): void;
  onZoomOut(): void;
  onFit(): void;
  onActualSize(): void;
  emptyReason: PreviewEmptyReason;
  onSelectInput(): void;
  onSelectOutput(): void;
  onScan(): void;
  onExport(): void;
  canExport: boolean;
  onPivotChange?(pivot: { pivotX: number; pivotY: number }): void;
}

export function PreviewPanel({
  pages,
  selectedPageIndex,
  selectedSprite,
  zoom,
  mode,
  onSelectPage,
  onZoomIn,
  onZoomOut,
  onFit,
  onActualSize,
  emptyReason,
  onSelectInput,
  onSelectOutput,
  onScan,
  onExport,
  canExport,
  onPivotChange
}: PreviewPanelProps) {
  const { t } = useTranslation(["common", "preview"]);
  const page = pages[selectedPageIndex];
  const [imageFailed, setImageFailed] = useState(false);
  const [draggingPivot, setDraggingPivot] = useState(false);
  const [draftPivot, setDraftPivot] = useState<{ pivotX: number; pivotY: number } | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const effectiveZoom = mode === "fit" ? 1 : zoom;
  const displayedSprite = selectedSprite && draftPivot
    ? { ...selectedSprite, ...draftPivot }
    : selectedSprite;
  const previewRect = useMemo(
    () => page && displayedSprite
      ? calculateSpritePreviewRect(displayedSprite, page, selectedPageIndex, effectiveZoom)
      : null,
    [displayedSprite, effectiveZoom, page, selectedPageIndex]
  );

  useEffect(() => {
    setImageFailed(false);
  }, [page?.url]);

  useEffect(() => {
    setDraftPivot(null);
    setDraggingPivot(false);
  }, [selectedSprite?.name, selectedSprite?.page]);

  const stageStyle = page
    ? buildStageStyle(page.width, page.height, mode, effectiveZoom)
    : undefined;
  const overlayStyle = page && displayedSprite && previewRect
    ? buildOverlayStyle(displayedSprite, page, mode, previewRect)
    : undefined;
  const pivotStyle = page && displayedSprite
    ? buildPivotStyle(displayedSprite, page, mode, effectiveZoom)
    : undefined;

  function calculatePivotFromPointer(event: React.PointerEvent<HTMLDivElement>) {
    if (!page || !selectedSprite || !onPivotChange || !stageRef.current) {
      return null;
    }

    const rect = stageRef.current.getBoundingClientRect();
    return calculatePivotFromStagePoint(
      selectedSprite,
      page,
      event.clientX - rect.left,
      event.clientY - rect.top,
      rect.width,
      rect.height
    );
  }

  function handlePivotPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setDraggingPivot(true);
    stageRef.current?.setPointerCapture(event.pointerId);
    setDraftPivot(calculatePivotFromPointer(event));
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (draggingPivot) {
      setDraftPivot(calculatePivotFromPointer(event));
    }
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (draggingPivot) {
      const pivot = calculatePivotFromPointer(event) ?? draftPivot;
      if (pivot) {
        onPivotChange?.(pivot);
      }
      setDraggingPivot(false);
      setDraftPivot(null);
      stageRef.current?.releasePointerCapture(event.pointerId);
    }
  }

  return (
    <section className="panel previewPanel">
      <div className="panelHeader">
        <h2>{t("preview:title")}</h2>
        <span>{page ? `${page.width}x${page.height}` : t("preview:noAtlas")}</span>
      </div>

      <div className="previewToolbar">
        <button type="button" title={t("common:actions.zoomOut")} aria-label={t("common:actions.zoomOut")} onClick={onZoomOut} disabled={!page}>
          <ZoomOut size={16} />
        </button>
        <button type="button" title={t("common:actions.fit")} className={mode === "fit" ? "tab active" : "tab"} onClick={onFit} disabled={!page}>
          <Maximize2 size={16} />
          {t("common:actions.fit")}
        </button>
        <button type="button" title={t("common:actions.actualSize")} className={mode === "actual" ? "tab active" : "tab"} onClick={onActualSize} disabled={!page}>
          {t("common:actions.actualSize")}
        </button>
        <button type="button" title={t("common:actions.zoomIn")} aria-label={t("common:actions.zoomIn")} onClick={onZoomIn} disabled={!page}>
          <ZoomIn size={16} />
        </button>
        <span>{mode === "fit" ? t("preview:toolbar.fit") : t("preview:toolbar.zoom", { value: `${Math.round(effectiveZoom * 100)}%` })}</span>
      </div>

      {pages.length > 1 && (
        <div className="pageTabs" role="tablist">
          {pages.map((previewPage, index) => (
            <button
              key={previewPage.image}
              className={index === selectedPageIndex ? "tab active" : "tab"}
              type="button"
              onClick={() => onSelectPage(index)}
              title={previewPage.image}
              role="tab"
              aria-selected={index === selectedPageIndex}
            >
              {index}
            </button>
          ))}
        </div>
      )}

      <div className="previewSurface">
        {page ? (
          imageFailed ? (
            <div className="emptyState">{t("preview:imageUnavailable")}</div>
          ) : (
            <div
              ref={stageRef}
              className={mode === "fit" ? "previewStage fit" : "previewStage"}
              style={stageStyle}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={() => setDraggingPivot(false)}
            >
              <img src={page.url} alt={page.image} onError={() => setImageFailed(true)} />
              {overlayStyle && <div className="spriteOverlay" style={overlayStyle} />}
              {pivotStyle && (
                <div
                  className={onPivotChange ? "pivotMarker draggable" : "pivotMarker"}
                  style={pivotStyle}
                  title={t("preview:markers.dragPivot")}
                  onPointerDown={handlePivotPointerDown}
                />
              )}
            </div>
          )
        ) : (
          <PreviewEmptyState
            reason={emptyReason}
            onSelectInput={onSelectInput}
            onSelectOutput={onSelectOutput}
            onScan={onScan}
            onExport={onExport}
            canExport={canExport}
          />
        )}
      </div>

      {imageFailed && <div className="previewWarning">{t("preview:exportUnavailable")}</div>}

      <div className="metadataStrip">
        <span>{page?.image ?? "-"}</span>
        <span>
          {selectedSprite
            ? `${selectedSprite.name}: ${selectedSprite.x}, ${selectedSprite.y}, ${selectedSprite.w}, ${selectedSprite.h}`
            : t("preview:noSpriteSelected")}
        </span>
      </div>
    </section>
  );
}

function PreviewEmptyState({
  reason,
  onSelectInput,
  onSelectOutput,
  onScan,
  onExport,
  canExport
}: {
  reason: PreviewEmptyReason;
  onSelectInput(): void;
  onSelectOutput(): void;
  onScan(): void;
  onExport(): void;
  canExport: boolean;
}) {
  const { t } = useTranslation(["common", "preview", "project"]);
  const activeClass = (target: PreviewEmptyReason) => reason === target ? "active" : "";

  return (
    <div className="previewEmptyState">
      <h3>{t("preview:empty.title")}</h3>
      <ol>
        <li className={activeClass("input")}>{t("preview:empty.input")}</li>
        <li className={activeClass("output")}>{t("preview:empty.output")}</li>
        <li className={activeClass("sprites")}>{t("preview:empty.sprites")}</li>
        <li className={activeClass("atlas")}>{reason === "error" ? t("preview:empty.error") : t("preview:empty.atlas")}</li>
      </ol>
      <div className="previewEmptyActions">
        <button type="button" onClick={onSelectInput}>{t("project:inputFolder.label")}</button>
        <button type="button" onClick={onSelectOutput}>{t("project:outputFolder.label")}</button>
        <button type="button" onClick={onScan}>{t("common:actions.scan")}</button>
        <button type="button" className="primaryButton" onClick={onExport} disabled={!canExport}>{t("common:actions.exportAtlas")}</button>
      </div>
    </div>
  );
}

function buildPivotStyle(
  sprite: GuiAtlasJsonSprite,
  page: GuiAtlasPagePreview,
  mode: PreviewMode,
  zoom: number
): CSSProperties {
  if (mode === "fit") {
    return {
      left: `${((sprite.x + sprite.w * sprite.pivotX) / page.width) * 100}%`,
      top: `${((sprite.y + sprite.h * sprite.pivotY) / page.height) * 100}%`
    };
  }

  const point = calculatePivotPreviewPoint(sprite, zoom);

  return {
    left: point.left,
    top: point.top
  };
}

function buildStageStyle(width: number, height: number, mode: PreviewMode, zoom: number): CSSProperties {
  if (mode === "fit") {
    return {
      width,
      aspectRatio: `${width} / ${height}`
    };
  }

  return {
    width: width * zoom,
    height: height * zoom
  };
}

function buildOverlayStyle(
  sprite: GuiAtlasJsonSprite,
  page: GuiAtlasPagePreview,
  mode: PreviewMode,
  rect: { left: number; top: number; width: number; height: number }
): CSSProperties {
  if (mode === "fit") {
    return {
      left: `${(sprite.x / page.width) * 100}%`,
      top: `${(sprite.y / page.height) * 100}%`,
      width: `${(sprite.w / page.width) * 100}%`,
      height: `${(sprite.h / page.height) * 100}%`
    };
  }

  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height
  };
}
