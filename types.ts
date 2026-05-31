
export interface ItemAnalysis {
  name: string;
  category: string;
  description: string;
  keyFeatures: string[];
}

export interface ReviewOutput {
  reviewText: string;
  rating: number;
  pros: string[];
  cons: string[];
  sentiment: 'positive' | 'negative' | 'neutral';
}

export interface ComparisonItem {
  analysis: ItemAnalysis;
  review: ReviewOutput | null;
  imagePreview: string | null;
}

export interface ComparisonData {
  summary: string;
  featureComparison: {
    feature: string;
    values: { [productName: string]: string };
  }[];
  sentimentComparison: {
    productName: string;
    sentiment: string;
    score: number;
  }[];
}

export type InputMode = 'upload' | 'camera' | 'link';

export interface StyleMirror {
  text?: string;
  image?: string;
  reviewerName?: string;
  reviewerUrl?: string;
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  analysis: ItemAnalysis;
  review: ReviewOutput;
  imagePreview: string | null;
}

export interface AppState {
  isAnalyzing: boolean;
  isGeneratingReview: boolean;
  isComparing: boolean;
  analysis: ItemAnalysis | null;
  review: ReviewOutput | null;
  error: string | null;
  imagePreview: string | null;
  styleMirror: StyleMirror;
  comparisonList: ComparisonItem[];
  comparisonResult: ComparisonData | null;
  history: HistoryItem[];
}
