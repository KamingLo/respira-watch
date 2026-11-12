"use client";

interface MapFilterProps {
  selectedCategories: string[];
  onChange: (categories: string[]) => void;
}

const categories = [
  { label: "ISPA", color: "#047857" },
  { label: "Diare", color: "#F59E0B" },
];

export default function MapFilter({
  selectedCategories,
  onChange,
}: MapFilterProps) {
  function toggleCategory(category: string) {
    const updated = selectedCategories.includes(category)
      ? selectedCategories.filter((item) => item !== category)
      : [...selectedCategories, category];

    onChange(updated);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {categories.map((category) => {
        const active = selectedCategories.includes(category.label);

        return (
          <button
            key={category.label}
            type="button"
            onClick={() => toggleCategory(category.label)}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
              active
                ? "border-green-700 bg-green-50 text-green-800"
                : "border-gray-200 bg-white text-gray-500"
            }`}
          >
            <span
              className="mr-2 inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: category.color }}
            />
            {category.label}
          </button>
        );
      })}
    </div>
  );
}
