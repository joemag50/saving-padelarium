type DepthSortable = Phaser.GameObjects.GameObject & {
  y: number;
  setDepth: (value: number) => unknown;
};

export function applyDepthSort(gameObject: DepthSortable, y: number) {
  gameObject.setDepth(y);
}

export function sortByDepth(objects: DepthSortable[]) {
  objects.forEach((object) => {
    applyDepthSort(object, object.y);
  });
}
