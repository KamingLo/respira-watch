import type { ReportAgeGroup } from "@/types/report.types";

export const getAgeGroupForAge = (age: number): ReportAgeGroup => {
  if (age <= 5) return "balita";
  if (age <= 12) return "anak";
  if (age <= 17) return "remaja";
  if (age <= 59) return "dewasa";
  return "lansia";
};
