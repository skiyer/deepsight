export type PageMode = 'analysis' | 'wiki';

export type WikiGenerationStatus = 'idle' | 'running' | 'done' | 'error' | 'canceled';

export type WikiGenerationPhase = 'scanning' | 'drafting' | 'writing' | '';

export interface WikiGenerationState {
  status: WikiGenerationStatus;
  phase: WikiGenerationPhase;
  pct: number; // 0-100
  message: string;
  page: string;
  error: string;
}
