import { describe, expect, it } from 'vitest';
import { categoryScope } from './category-scope.js';

describe('categoryScope', () => {
  const tree = [
    { id: 1, parentCategoryId: null },
    { id: 2, parentCategoryId: 1 },
    { id: 3, parentCategoryId: 1 },
    { id: 4, parentCategoryId: 2 },
    { id: 5, parentCategoryId: null },
  ];

  it('returns the category and all of its descendants', () => {
    expect([...categoryScope(1, tree)].sort()).toEqual([1, 2, 3, 4]);
    expect([...categoryScope(2, tree)].sort()).toEqual([2, 4]);
  });

  it('does not include siblings or unrelated roots', () => {
    const scope = categoryScope(2, tree);

    expect(scope.has(3)).toBe(false);
    expect(scope.has(5)).toBe(false);
  });

  it('terminates when stored categories form a cycle', () => {
    const cyclic = [
      { id: 1, parentCategoryId: 3 },
      { id: 2, parentCategoryId: 1 },
      { id: 3, parentCategoryId: 2 },
    ];

    expect([...categoryScope(1, cyclic)].sort()).toEqual([1, 2, 3]);
  });
});
