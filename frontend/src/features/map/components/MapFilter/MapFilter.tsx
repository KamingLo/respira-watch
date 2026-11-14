"use client";

import { Check } from "lucide-react";

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
        className={`min-h-11 rounded-full border px-4 py-2 text-sm font-semibold transition ${
          allSelected
            ? "border-green-800 bg-green-800 text-white"
            : "border-green-800 text-green-800 hover:bg-green-50"
        }`}
      >
        Semua
      </button>
      {categories.map((category) => {
        const selected = selectedCategories.includes(category);
        const selectedClass = allSelected
          ? "border-[#B5D2C3] bg-[#EAF5EE] text-green-800"
          : "border-green-800 bg-green-800 text-white";

        return (
          <button
            key={category}
            type="button"
            aria-pressed={selected}
            onClick={() => toggleCategory(category)}
            className={`inline-flex min-h-11 items-center gap-1 rounded-full border px-4 py-2 text-sm font-semibold transition ${
              selected
                ? selectedClass
                : "border-green-800 text-green-800 hover:bg-green-50"
            }`}
          >
            {selected && <Check aria-hidden="true" size={14} />}
            {category}
          </button>
        );
      })}
    </div>
  );
}