import type { GuiInputSpriteScanItem, SpriteMetadataEntry } from "../../shared/gui-types";

interface SpriteMetadataTableProps {
  sprites: GuiInputSpriteScanItem[];
  selectedPath: string | null;
  selectedPaths: string[];
  onSelect(sprite: GuiInputSpriteScanItem, event: React.MouseEvent<HTMLTableRowElement>): void;
  onToggleInclude(sprite: GuiInputSpriteScanItem): void;
  onUpdate(sprite: GuiInputSpriteScanItem, patch: SpriteMetadataEntry): void;
  onMove(sprite: GuiInputSpriteScanItem, action: "up" | "down" | "top" | "bottom"): void;
}

export function SpriteMetadataTable({ sprites, selectedPath, selectedPaths, onSelect, onToggleInclude, onUpdate, onMove }: SpriteMetadataTableProps) {
  const selectedSet = new Set(selectedPaths);

  return (
    <div className="tableWrap metadataTableWrap">
      <table className="spriteTable metadataTable">
        <thead>
          <tr>
            <th>Use</th>
            <th>Order</th>
            <th>Source</th>
            <th>Export</th>
            <th>Group</th>
            <th>Tags</th>
            <th>Pivot</th>
            <th>Trim</th>
            <th>Crop</th>
            <th>Move</th>
          </tr>
        </thead>
        <tbody>
          {sprites.map((sprite) => (
            <tr
              key={sprite.relativePath}
              className={[
                sprite.relativePath === selectedPath ? "selectedRow" : "",
                selectedSet.has(sprite.relativePath) ? "multiSelectedRow" : "",
                sprite.status === "invalid" ? "invalidRow" : "",
                sprite.status === "missing" ? "missingRow" : ""
              ].filter(Boolean).join(" ")}
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
              <td title={sprite.relativePath}>{sprite.relativePath}</td>
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
                  <option value="default">Default</option>
                  <option value="auto">Auto</option>
                  <option value="none">None</option>
                  <option value="manual">Manual</option>
                </select>
              </td>
              <td title={formatCrop(sprite)}>{formatCrop(sprite)}</td>
              <td>
                <div className="moveButtons">
                  <button type="button" title="Move up" onClick={(event) => { event.stopPropagation(); onMove(sprite, "up"); }}>Up</button>
                  <button type="button" title="Move down" onClick={(event) => { event.stopPropagation(); onMove(sprite, "down"); }}>Dn</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
