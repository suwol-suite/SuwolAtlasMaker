import { useTranslation } from "react-i18next";
import type { GuiAtlasJsonSprite } from "../../shared/gui-types";

interface SpriteTableProps {
  sprites: GuiAtlasJsonSprite[];
  selectedName: string | null;
  onSelect(sprite: GuiAtlasJsonSprite): void;
}

export function SpriteTable({ sprites, selectedName, onSelect }: SpriteTableProps) {
  const { t } = useTranslation(["common", "sprites"]);

  return (
    <div className="tableWrap">
      <table className="spriteTable">
        <thead>
          <tr>
            <th>{t("sprites:table.name")}</th>
            <th>{t("sprites:table.page")}</th>
            <th>{t("sprites:table.rect")}</th>
            <th>{t("sprites:table.rotated")}</th>
            <th>{t("sprites:table.trimmed")}</th>
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
              <td>{sprite.rotated ? t("common:states.yes") : t("common:states.no")}</td>
              <td>{sprite.trimmed ? t("common:states.yes") : t("common:states.no")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
