import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { GuiInputSpriteScanItem, SpriteMetadataEntry } from "../../shared/gui-types";

interface SpriteMetadataTableProps {
  sprites: GuiInputSpriteScanItem[];
  selectedPath: string | null;
  selectedPaths: string[];
  onSelect(sprite: GuiInputSpriteScanItem, event: React.MouseEvent<HTMLTableRowElement>): void;
  onToggleInclude(sprite: GuiInputSpriteScanItem): void;
  onUpdate(sprite: GuiInputSpriteScanItem, patch: SpriteMetadataEntry): void;
  onMove(sprite: GuiInputSpriteScanItem, action: "up" | "down" | "top" | "bottom"): void;
  onReorderVisible?(draggedRelativePath: string, targetRelativePath: string): void;
}

export function SpriteMetadataTable({
  sprites,
  selectedPath,
  selectedPaths,
  onSelect,
  onToggleInclude,
  onUpdate,
  onMove,
  onReorderVisible
}: SpriteMetadataTableProps) {
  const { t } = useTranslation(["common", "options", "sprites"]);
  const selectedSet = new Set(selectedPaths);
  const [draggingPath, setDraggingPath] = useState<string | null>(null);
  const [dropTargetPath, setDropTargetPath] = useState<string | null>(null);

  function handleDragStart(event: React.DragEvent<HTMLTableRowElement>, sprite: GuiInputSpriteScanItem) {
    if (!onReorderVisible) {
      return;
    }

    setDraggingPath(sprite.relativePath);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", sprite.relativePath);
  }

  function handleDragOver(event: React.DragEvent<HTMLTableRowElement>, sprite: GuiInputSpriteScanItem) {
    if (!onReorderVisible || !draggingPath || draggingPath === sprite.relativePath) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropTargetPath(sprite.relativePath);
  }

  function handleDrop(event: React.DragEvent<HTMLTableRowElement>, sprite: GuiInputSpriteScanItem) {
    if (!onReorderVisible) {
      return;
    }

    event.preventDefault();
    const dragged = event.dataTransfer.getData("text/plain") || draggingPath;

    if (dragged && dragged !== sprite.relativePath) {
      onReorderVisible(dragged, sprite.relativePath);
    }

    setDraggingPath(null);
    setDropTargetPath(null);
  }

  function clearDragState() {
    setDraggingPath(null);
    setDropTargetPath(null);
  }

  return (
    <div className="tableWrap metadataTableWrap">
      <table className="spriteTable metadataTable">
        <thead>
          <tr>
            <th>{t("sprites:table.use")}</th>
            <th>{t("sprites:table.order")}</th>
            <th>{t("sprites:table.source")}</th>
            <th>{t("sprites:table.export")}</th>
            <th>{t("sprites:table.group")}</th>
            <th>{t("sprites:table.tags")}</th>
            <th>{t("sprites:table.pivot")}</th>
            <th>{t("sprites:table.trim")}</th>
            <th>{t("sprites:table.crop")}</th>
            <th>{t("sprites:table.move")}</th>
          </tr>
        </thead>
        <tbody>
          {sprites.map((sprite) => (
            <tr
              key={sprite.relativePath}
              className={[
                sprite.relativePath === selectedPath ? "selectedRow" : "",
                selectedSet.has(sprite.relativePath) ? "multiSelectedRow" : "",
                draggingPath === sprite.relativePath ? "draggingRow" : "",
                dropTargetPath === sprite.relativePath ? "dropTargetRow" : "",
                sprite.status === "invalid" ? "invalidRow" : "",
                sprite.status === "missing" ? "missingRow" : "",
                !sprite.include ? "excludedRow" : ""
              ].filter(Boolean).join(" ")}
              draggable={Boolean(onReorderVisible)}
              onDragStart={(event) => handleDragStart(event, sprite)}
              onDragOver={(event) => handleDragOver(event, sprite)}
              onDragLeave={() => {
                if (dropTargetPath === sprite.relativePath) {
                  setDropTargetPath(null);
                }
              }}
              onDrop={(event) => handleDrop(event, sprite)}
              onDragEnd={clearDragState}
              onClick={(event) => onSelect(sprite, event)}
              title={sprite.validationMessage || sprite.relativePath}
            >
              <td>
                <input
                  type="checkbox"
                  checked={sprite.include}
                  onChange={(event) => {
                    event.stopPropagation();
                    onToggleInclude(sprite);
                  }}
                  onClick={(event) => event.stopPropagation()}
                />
              </td>
              <td>{sprite.order ?? "-"}</td>
              <td title={sprite.relativePath}>
                <div className="spriteNameCell">
                  <span>{sprite.relativePath}</span>
                  <SpriteBadges sprite={sprite} />
                </div>
              </td>
              <td title={sprite.exportName}>
                <input
                  value={sprite.nameOverride ?? ""}
                  placeholder={sprite.originalName}
                  onChange={(event) => onUpdate(sprite, { nameOverride: event.target.value })}
                  onClick={(event) => event.stopPropagation()}
                />
              </td>
              <td title={sprite.group}>
                <input
                  value={sprite.group}
                  onChange={(event) => onUpdate(sprite, { group: event.target.value })}
                  onClick={(event) => event.stopPropagation()}
                />
              </td>
              <td title={sprite.tags.join(", ")}>
                <input
                  value={sprite.tags.join(", ")}
                  onChange={(event) => onUpdate(sprite, {
                    tags: event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean)
                  })}
                  onClick={(event) => event.stopPropagation()}
                />
              </td>
              <td>{sprite.pivotX.toFixed(2)}, {sprite.pivotY.toFixed(2)}</td>
              <td>
                <select
                  value={sprite.trimMode}
                  onChange={(event) => onUpdate(sprite, { trimMode: event.target.value as SpriteMetadataEntry["trimMode"] })}
                  onClick={(event) => event.stopPropagation()}
                >
                  <option value="default">{t("options:values.defaultTrim")}</option>
                  <option value="auto">{t("options:values.autoTrim")}</option>
                  <option value="none">{t("options:values.noTrim")}</option>
                  <option value="manual">{t("options:values.manualCrop")}</option>
                </select>
              </td>
              <td title={formatCrop(sprite)}>{formatCrop(sprite)}</td>
              <td>
                <div className="moveButtons">
                  <button type="button" title={t("common:actions.top")} onClick={(event) => { event.stopPropagation(); onMove(sprite, "top"); }}>{t("common:actions.top")}</button>
                  <button type="button" title={t("common:actions.up")} onClick={(event) => { event.stopPropagation(); onMove(sprite, "up"); }}>{t("common:actions.up")}</button>
                  <button type="button" title={t("common:actions.down")} onClick={(event) => { event.stopPropagation(); onMove(sprite, "down"); }}>{t("common:actions.down")}</button>
                  <button type="button" title={t("common:actions.bottom")} onClick={(event) => { event.stopPropagation(); onMove(sprite, "bottom"); }}>{t("common:actions.bottom")}</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SpriteBadges({ sprite }: { sprite: GuiInputSpriteScanItem }) {
  const { t } = useTranslation(["sprites"]);
  const badges: string[] = [];

  if (!sprite.include) {
    badges.push(t("sprites:badges.excluded"));
  }

  if (sprite.nameOverride) {
    badges.push(t("sprites:badges.renamed"));
  }

  if (sprite.trimMode === "manual" || sprite.crop) {
    badges.push(t("sprites:badges.manualCrop"));
  }

  if (sprite.status === "invalid") {
    badges.push(t("sprites:badges.invalid"));
  }

  if (sprite.status === "missing") {
    badges.push(t("sprites:badges.missing"));
  }

  if (badges.length === 0) {
    return null;
  }

  return (
    <span className="spriteBadges">
      {badges.map((badge) => <span key={badge} className="badge">{badge}</span>)}
    </span>
  );
}

function formatCrop(sprite: GuiInputSpriteScanItem): string {
  if (sprite.crop) {
    return `${sprite.crop.x},${sprite.crop.y},${sprite.crop.w},${sprite.crop.h}`;
  }

  if (sprite.autoTrimRect) {
    return `auto ${sprite.autoTrimRect.x},${sprite.autoTrimRect.y},${sprite.autoTrimRect.w},${sprite.autoTrimRect.h}`;
  }

  return "-";
}
