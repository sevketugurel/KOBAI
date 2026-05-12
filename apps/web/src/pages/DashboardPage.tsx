import { useParams, Link } from "react-router-dom";
import { useAnalysis } from "../hooks/useAnalysis";
import { Navbar } from "../components/layout/Navbar";
import { DashboardHeader } from "../components/dashboard/DashboardHeader";
import KPICards from "../components/dashboard/KPICards";
import CashFlowChart from "../components/dashboard/CashFlowChart";
import RiskIndicator from "../components/dashboard/RiskIndicator";
import AgentTrace from "../components/dashboard/AgentTrace";
import { TaxCalendar } from "../components/dashboard/TaxCalendar";
import { TaxRecommendations } from "../components/dashboard/TaxRecommendations";
import { KosgebCards } from "../components/dashboard/KosgebCards";
import ChatPanel from "../components/chat/ChatPanel";
import { Skeleton } from "../components/shared/Skeleton";
import { reportUrl } from "../api/client";
import { AlertCircle } from "lucide-react";

export default function DashboardPage() {
  const { jobId = "" } = useParams();
  const { data, isLoading, error } = useAnalysis(jobId);

  if (error) {
    return (
      <>
        <Navbar showNewAnalysis />
        <main className="max-w-3xl mx-auto px-6 py-12">
          <div className="card p-6 flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center text-red-600 flex-shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h2 className="font-display font-bold text-navy-900">Bir hata oluştu</h2>
              <p className="text-sm text-navy-600 mt-1">{error.message}</p>
              <Link to="/" className="btn-primary mt-4">Ana sayfaya dön</Link>
            </div>
          </div>
        </main>
      </>
    );
  }

  if (isLoading || !data) {
    return (
      <>
        <Navbar showNewAnalysis />
        <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-10 w-32" />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="card p-5 space-y-3">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-7 w-32" />
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="card p-6 space-y-4">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-64 w-full" />
              </div>
              <div className="grid sm:grid-cols-2 gap-6">
                <div className="card p-6 space-y-3"><Skeleton className="h-4 w-32" /><Skeleton className="h-32 w-full" /></div>
                <div className="card p-6 space-y-3"><Skeleton className="h-4 w-32" /><Skeleton className="h-32 w-full" /></div>
              </div>
              <div className="card p-6 space-y-3"><Skeleton className="h-4 w-32" /><Skeleton className="h-24 w-full" /></div>
            </div>
            <div className="lg:col-span-1">
              <div className="card p-6 space-y-3 h-96"><Skeleton className="h-4 w-32" /><Skeleton className="flex-1 w-full" /></div>
            </div>
          </div>
        </main>
      </>
    );
  }

  const income = data.cash_flow_forecast.reduce((a, b) => a + b.income, 0);
  const expense = data.cash_flow_forecast.reduce((a, b) => a + b.expense, 0);
  const net = income - expense;
  const taxBurden = data.cash_flow_forecast.reduce((a, b) => a + b.kdv_payment + b.sgk_payment, 0);

  const periodLabel = data.cash_flow_forecast.length > 0
    ? `${data.cash_flow_forecast[0]!.month} – ${data.cash_flow_forecast[data.cash_flow_forecast.length - 1]!.month}`
    : undefined;

  const handleExport = () => window.open(reportUrl(jobId), "_blank", "noopener,noreferrer");

  return (
    <>
      <Navbar showNewAnalysis />
      <main className="max-w-7xl mx-auto px-6 py-8">
        <DashboardHeader
          businessName="Analiz Sonuçları"
          periodLabel={periodLabel}
          onExportPdf={handleExport}
        />
        <KPICards income={income} expense={expense} net={net} taxBurden={taxBurden} />
        <div className="grid lg:grid-cols-3 gap-6 mt-6">
          <div className="lg:col-span-2 space-y-6">
            <CashFlowChart data={data.cash_flow_forecast} />
            <div className="grid sm:grid-cols-2 gap-6">
              <RiskIndicator
                risk_label={data.risk_label}
                risk_score={data.risk_score}
                explanation={data.risk_explanation}
              />
              <TaxCalendar forecast={data.cash_flow_forecast} />
            </div>
            <TaxRecommendations recommendations={data.tax_recommendations} />
            <KosgebCards suggestions={data.kosgeb_suggestions} />
            <AgentTrace trace={data.agent_trace} />
          </div>
          <div className="lg:col-span-1">
            <ChatPanel jobId={jobId} />
          </div>
        </div>
      </main>
    </>
  );
}
