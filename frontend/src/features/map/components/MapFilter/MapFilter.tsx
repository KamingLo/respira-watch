"use client";

interface MapFilterProps {
  selectedCategories: string[];
  onChange: (categories: string[]) => void;
}

export default function MapFilter({
  selectedCategories,
  onChange,
}: MapFilterProps) {
  const categories = ["ISPA", "Diare"];
  const allSelected = categories.every((category) =>
    selectedCategories.includes(category)
  );

  const toggleCategory = (category: string) => {
    const nextCategories = selectedCategories.includes(category)
      ? selectedCategories.filter((item) => item !== category)
      : [...selectedCategories, category];

    onChange(nextCategories);
  };

  return (
    <div aria-label="Filter kategori laporan" className="flex flex-wrap gap-2">
      <button
        type="button"
        aria-pressed={allSelected}
        onClick={() => onChange(categories)}
        className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
          allSelected
            ? "border-green-800 bg-green-800 text-white"
            : "border-green-800 text-green-800 hover:bg-green-50"
        }`}
      >
        Semua
      </button>
      {categories.map((category) => {
        const selected = selectedCategories.includes(category);

        return (
          <button
            key={category}
            type="button"
            aria-pressed={selected}
            onClick={() => toggleCategory(category)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              selected
                ? "border-green-800 bg-green-800 text-white"
                : "border-green-800 text-green-800 hover:bg-green-50"
            }`}
          >
            {category}
          </button>
        );
      })}
    </div>
  );
}