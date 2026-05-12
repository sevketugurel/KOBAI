import { useState } from "react";
import type { AgentStep } from "../../api/types";

export default function AgentTrace({ trace, isLoading = false }: { trace: AgentStep[]; isLoading?: boolean }) {
  return (
    <div className="border border-stone-200 rounded p-4 bg-white/60">
      <h3 className="font-semibold mb-2">Ajan ne yapıyor?</h3>
      {isLoading && <div className="text-sm text-stone-600 animate-pulse">Ajanlar çalışıyor…</div>}
      <ul className="space-y-1">
        {trace.map((s, i) => <StepRow key={i} step={s} />)}
      </ul>
    </div>
  );
}

function StepRow({ step }: { step: AgentStep }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="border-b border-stone-100 last:border-0">
      <button onClick={() => setOpen(o => !o)} className="w-full flex justify-between py-2 text-left text-sm">
        <span><span className="inline-block px-2 py-0.5 rounded bg-stone-200 mr-2">{step.agent_name}</span>{step.action}</span>
        <span className="text-stone-500">{step.duration_ms} ms · ★{step.confidence.toFixed(1)}</span>
      </button>
      {open && <pre className="text-xs bg-stone-50 p-2 rounded overflow-auto">{JSON.stringify(step.output, null, 2)}</pre>}
    </li>
  );
}
