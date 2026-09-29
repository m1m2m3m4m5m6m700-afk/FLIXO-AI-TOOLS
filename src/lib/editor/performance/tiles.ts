export type Tile = Readonly<{
  x: number;
  y: number;
  width: number;
  height: number;
}>;

export const enumerateTiles = (
  width: number,
  height: number,
  tileSize = 512,
): readonly Tile[] => {
  if (!Number.isInteger(width) || width < 1 || !Number.isInteger(height) || height < 1) throw new Error('TILE_DIMENSIONS_INVALID');
  if (!Number.isInteger(tileSize) || tileSize < 1) throw new Error('TILE_SIZE_INVALID');

  const tiles: Tile[] = [];
  for (let y = 0; y < height; y += tileSize) {
    for (let x = 0; x < width; x += tileSize) {
      tiles.push(Object.freeze({
        x,
        y,
        width: Math.min(tileSize, width - x),
        height: Math.min(tileSize, height - y),
      }));
    }
  }
  return Object.freeze(tiles);
};
