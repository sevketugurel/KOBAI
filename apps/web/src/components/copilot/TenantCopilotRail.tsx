import { Sparkles } from "lucide-react";

import type { TenantPageAIView } from "../../api/v2";
import ChatPanelV2 from "../chat/ChatPanelV2";
import { Card } from "../ui";

function toneClass(tone?: TenantPageAIView["insights"][number]["tone"]) {
  if (tone === "success") return "border-emerald-200 bg-emerald-50/70";
  if (tone === "warning") return "border-amber-200 bg-amber-50/70";
  if (tone === "danger") return "border-red-200 bg-red-50/70";
  return "border-border bg-background";
}

interface TenantCopilotRailProps {
  slug: string;
  sessionId: string;
  view?: TenantPageAIView;
  loading?: boolean;
}

export default function TenantCopilotRail({
  slug,
  sessionId,
  view,
  loading = false,
}: TenantCopilotRailProps) {
  return (
    <aside className="space-y-6 xl:sticky xl:top-6">
      <Card>
        <Card.Header
          title={view?.title ?? "AI Copilot"}
          subtitle={view?.subtitle ?? "Sayfa sinyallerinden türetilen içgörüler"}
          action={
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy-50 text-navy-600">
              <Sparkles size={18} />
            </div>
          }
        />
        <Card.Body className="space-y-4">
          {loading ? (
            <div className="space-y-3">
              <div className="skeleton h-16" />
              <div className="skeleton h-24" />
              <div className="skeleton h-10" />
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-navy-100 bg-navy-50/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-navy-500">
                  Bugünün Yorumu
                </p>
                <p className="mt-2 text-sm leading-6 text-navy-800">
                  {view?.summary ?? "Bu sayfadaki veriler geldikçe AI özeti burada görünür."}
                </p>
              </div>

              <div className="space-y-3">
                {view?.insights?.map((insight) => (
                  <article
                    key={insight.id}
                    className={`rounded-xl border p-4 ${toneClass(insight.tone)}`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-navy-900">{insight.title}</h3>
                      {insight.badge ? (
                        <span className="badge bg-background text-navy-700">{insight.badge}</span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-navy-700">{insight.detail}</p>
                  </article>
                ))}
              </div>
            </>
          )}
        </Card.Body>
      </Card>

      <ChatPanelV2
        slug={slug}
        sessionId={sessionId}
        title="AI Danışman"
        introCopy={view?.summary}
        samplePrompts={view?.sample_prompts}
        quickActions={view?.quick_actions}
      />
    </aside>
  );
}
