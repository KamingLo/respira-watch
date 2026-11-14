export const normalizeMapCategory = (category: string): string =>
  category.trim().toUpperCase();

export const isMapCategorySelected = (
  category: string,
  selectedCategories: readonly string[]
): boolean => {
  const normalizedCategory = normalizeMapCategory(category);
  return selectedCategories.some(
    (selectedCategory) =>
      normalizeMapCategory(selectedCategory) === normalizedCategory
  );
};
