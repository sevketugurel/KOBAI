import { useParams } from "react-router-dom";
import { useAnalysis } from "../hooks/useAnalysis";
import KPICards from "../components/dashboard/KPICards";
import CashFlowChart from "../components/dashboard/CashFlowChart";
import RiskIndicator from "../components/dashboard/RiskIndicator";
import AgentTrace from "../components/dashboard/AgentTrace";
import ChatPanel from "../components/chat/ChatPanel";
import LoadingSpinner from "../components/shared/LoadingSpinner";
import { reportUrl } from "../api/client";

export default function DashboardPage() {
  const { jobId = "" } = useParams();
  const { data, isLoading, error } = useAnalysis(jobId);

  if (error) return <div className="p-6 text-red-700">Hata: {error.message}</div>;
  if (isLoading || !data) return <div className="p-6"><LoadingSpinner label="Analiz hazırlanıyor…" /></div>;

  const income = data.cash_flow_forecast.reduce((a, b) => a + b.income, 0);
  const expense = data.cash_flow_forecast.reduce((a, b) => a + b.expense, 0);
  const net = income - expense;
  const taxBurden = data.cash_flow_forecast.reduce((a, b) => a + b.kdv_payment + b.sgk_payment, 0);

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-6">
      <header className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Analiz Sonucu</h1>
        <a href={reportUrl(jobId)} className="px-4 py-2 bg-emerald-600 text-white rounded">PDF Raporu indir</a>
      </header>
      <KPICards income={income} expense={expense} net={net} taxBurden={taxBurden} />
      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <CashFlowChart data={data.cash_flow_forecast} />
          <RiskIndicator risk_label={data.risk_label} risk_score={data.risk_score} explanation={data.risk_explanation} />
          <AgentTrace trace={data.agent_trace} />
        </div>
        <div className="h-[600px]"><ChatPanel jobId={jobId} /></div>
      </div>
    </main>
  );
}
