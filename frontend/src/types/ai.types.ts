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

export interface ClusterAiSummary {
  clusterId: string;
  clusterCode: string;
  statistics: {
    clusterId: string;
    clusterCode: string;
    category: ReportCategory;
    status: string;
    riskStatus: string;
    riskColor: string;
    colorHex: string;
    riskLevel: string;
    kelurahan: {
      id: string;
      code?: string;
      name?: string;
      kecamatan?: string;
      kota?: string;
      provinsi?: string;
    } | null;
    centerCoordinates: [number, number];
    radiusMeters: number;
    reportCount: number;
    totalSickCount: number;
    averageAqi: number;
    dominantSymptoms: string[];
    severityDistribution: {
      ringan: number;
      sedang: number;
      berat: number;
      kritis: number;
    };
    ageStatistics: {
      minAge: number;
      maxAge: number;
      averageAge: number;
    };
    firstDetectedAt: string;
    lastUpdatedAt: string;
  };
  aiSummary: {
    headline: string;
    executiveSummary: string;
    environmentalCorrelation: string;
    recommendedInterventions: string[];
    urgencyNotes: string;
  };
  cache: {
    cacheKey: string;
    ttlSeconds: number;
    cached: boolean;
    generatedAt: string;
    expiresAt: string;
  };
  meta: {
    provider: "gemini" | "deterministic_fallback";
    model: string;
    usedFallback: boolean;
    fallbackReason?: string;
    fallbackErrorCode?: string;
  };
}
