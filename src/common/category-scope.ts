/**
 * Ids of a category and every category beneath it.
 *
 * Listings are stored on the most specific category, so a parent page (search,
 * autocomplete, browse counts) has to include its descendants. The visited set
 * stops the walk if stored data contains a cycle, matching the ancestor walks
 * used for facet schemas.
 */
export function categoryScope(
  categoryId: number,
  categories: readonly { id: number; parentCategoryId: number | null }[],
): Set<number> {
  const childrenByParent = new Map<number, number[]>();
  for (const category of categories) {
    if (category.parentCategoryId == null) continue;
    const children = childrenByParent.get(category.parentCategoryId) ?? [];
    children.push(category.id);
    childrenByParent.set(category.parentCategoryId, children);
  }

  const scope = new Set<number>();
  const queue = [categoryId];
  while (queue.length > 0) {
    const id = queue.pop() as number;
    if (scope.has(id)) continue;
    scope.add(id);
    queue.push(...(childrenByParent.get(id) ?? []));
  }

  return scope;
}
