import type { ReportCategory, ReportSeverity } from "@/types/report.types";

export interface ComplaintClassification {
  category: ReportCategory;
  symptoms: string[];
  severity: ReportSeverity;
  age?: number;
  sickCount: number;
  confidence: number;
  reasoning: string;
  recommendedAction: string;
  meta: {
    usedFallback: boolean;
    provider: string;
  };
}

export interface ComplaintClassificationResponse {
  success: boolean;
  message?: string;
  data: ComplaintClassification;
}
