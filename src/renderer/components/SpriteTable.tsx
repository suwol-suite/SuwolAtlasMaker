import type { GuiAtlasJsonSprite } from "../../shared/gui-types";

interface SpriteTableProps {
  sprites: GuiAtlasJsonSprite[];
  selectedName: string | null;
  onSelect(sprite: GuiAtlasJsonSprite): void;
}

export function SpriteTable({ sprites, selectedName, onSelect }: SpriteTableProps) {
  return (
    <div className="tableWrap">
      <table className="spriteTable">
        <thead>
          <tr>
            <th>Name</th>
            <th>Page</th>
            <th>Rect</th>
            <th>Rot</th>
            <th>Trim</th>
          </tr>
        </thead>
        <tbody>
          {sprites.map((sprite) => (
            <tr
              key={sprite.name}
              className={sprite.name === selectedName ? "selectedRow" : ""}
              onClick={() => onSelect(sprite)}
            >
              <td title={sprite.name}>{sprite.name}</td>
              <td>{sprite.page}</td>
              <td>
                {sprite.x}, {sprite.y}, {sprite.w}, {sprite.h}
              </td>
              <td>{sprite.rotated ? "Yes" : "No"}</td>
              <td>{sprite.trimmed ? "Yes" : "No"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
