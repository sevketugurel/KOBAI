import { useState } from "react";

type CompanyType = "Şahıs Şirketi" | "Limited Şirketi" | "Anonim Şirket";
type Sector = "Perakende" | "Gıda & İçecek" | "Hizmet" | "İmalat";
type Period = "3m" | "6m" | "12m";
const PERIOD_LABEL: Record<Period, string> = { "3m": "Son 3 ay", "6m": "Son 6 ay", "12m": "Son 1 yıl" };

export interface OnboardingPayload { company_type: CompanyType; sector: Sector; period: Period; }

export default function OnboardingWizard({ onComplete }: { onComplete: (p: OnboardingPayload) => void }) {
  const [step, setStep] = useState(0);
  const [companyType, setCompanyType] = useState<CompanyType>("Şahıs Şirketi");
  const [sector, setSector] = useState<Sector>("Perakende");
  const [period, setPeriod] = useState<Period>("6m");

  return (
    <div className="max-w-xl mx-auto p-6 bg-white/60 border border-stone-200 rounded">
      <div className="flex gap-2 mb-6">
        {[0,1,2].map(i => <div key={i} className={`h-2 flex-1 rounded ${i <= step ? "bg-emerald-500" : "bg-stone-200"}`} />)}
      </div>
      {step === 0 && (
        <fieldset>
          <legend className="font-semibold mb-2">Şirket türünüz?</legend>
          {(["Şahıs Şirketi","Limited Şirketi","Anonim Şirket"] as CompanyType[]).map(opt => (
            <label key={opt} className="block py-1">
              <input type="radio" name="ct" checked={companyType===opt} onChange={() => setCompanyType(opt)} /> {opt}
            </label>
          ))}
        </fieldset>
      )}
      {step === 1 && (
        <fieldset>
          <legend className="font-semibold mb-2">Sektörünüz?</legend>
          {(["Perakende","Gıda & İçecek","Hizmet","İmalat"] as Sector[]).map(opt => (
            <label key={opt} className="block py-1">
              <input type="radio" name="se" checked={sector===opt} onChange={() => setSector(opt)} /> {opt}
            </label>
          ))}
        </fieldset>
      )}
      {step === 2 && (
        <fieldset>
          <legend className="font-semibold mb-2">Analiz dönemi?</legend>
          {(Object.keys(PERIOD_LABEL) as Period[]).map(p => (
            <label key={p} className="block py-1">
              <input type="radio" name="pr" checked={period===p} onChange={() => setPeriod(p)} /> {PERIOD_LABEL[p]}
            </label>
          ))}
        </fieldset>
      )}
      <div className="flex justify-between mt-6">
        <button disabled={step===0} onClick={() => setStep(s => s-1)} className="px-3 py-1 border rounded disabled:opacity-40">Geri</button>
        {step < 2
          ? <button onClick={() => setStep(s => s+1)} className="px-3 py-1 bg-emerald-600 text-white rounded">İleri</button>
          : <button onClick={() => onComplete({ company_type: companyType, sector, period })} className="px-3 py-1 bg-emerald-600 text-white rounded">Analizi Başlat</button>}
      </div>
    </div>
  );
}
