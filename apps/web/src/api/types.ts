/** Fatura kalemi — backend InvoiceItem birebir karşılığı. */
export interface InvoiceItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  kdv_rate: number;
}

export interface InvoiceData {
  invoice_id: string;
  vendor_name: string;
  vendor_tax_no: string | null;
  date: string;
  due_date: string | null;
  items: InvoiceItem[];
  subtotal: number;
  kdv_amount: number;
  total_amount: number;
  currency: string;
  category: string;
  raw_text: string | null;
}

export interface AgentStep {
  agent_name: string;
  action: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  duration_ms: number;
  confidence: number;
}

export type RiskLabel = "green" | "yellow" | "red";
export type JobStatus = "pending" | "processing" | "completed" | "failed";

export interface CashFlowMonth {
  month: string;
  income: number;
  expense: number;
  net: number;
  kdv_payment: number;
  sgk_payment: number;
  cumulative: number;
}

export interface TaxRecommendation {
  recommendation: string;
  source: string;
  article: string;
  confidence: number;
  action: string;
}

export interface KosgebSuggestion {
  title: string;
  detail: string;
  url?: string;
}

export interface AnalysisResult {
  job_id: string;
  status: JobStatus;
  invoices: InvoiceData[];
  cash_flow_forecast: CashFlowMonth[];
  risk_score: number;
  risk_label: RiskLabel;
  risk_explanation: string;
  tax_recommendations: TaxRecommendation[];
  kosgeb_suggestions: KosgebSuggestion[];
  agent_trace: AgentStep[];
  created_at: string;
  completed_at: string | null;
  error: string | null;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResponse {
  content: string;
  sources: Array<Record<string, unknown>>;
}

export interface AnalyzeRequest {
  invoice_ids: string[];
  company_type: string;
  sector: string;
  period: string;
}
