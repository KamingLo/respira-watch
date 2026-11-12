"use client";

import { useState } from "react";

export default function useMap() {
  const [selectedCategories, setSelectedCategories] =
    useState<string[]>(["ISPA", "Diare"]);

  return {
    selectedCategories,
    setSelectedCategories,
  };
}
