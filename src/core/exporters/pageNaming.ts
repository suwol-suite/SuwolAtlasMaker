export function getAtlasPageImageName(atlasName: string, pageIndex: number, pageCount: number): string {
  return pageCount === 1 ? `${atlasName}.png` : `${atlasName}_${pageIndex}.png`;
}
