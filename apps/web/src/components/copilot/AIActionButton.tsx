import { Brain, Lightbulb, ListTodo, Sparkles } from "lucide-react";

import type { AIContextAction } from "../../api/v2";
import { cn } from "../../lib/utils";
import { useTenantAIActionTrigger } from "./TenantAIActionContext";

function iconForVariant(variant?: AIContextAction["variant"]) {
  if (variant === "recommend") return <Lightbulb size={14} />;
  if (variant === "prioritize") return <ListTodo size={14} />;
  if (variant === "explain") return <Brain size={14} />;
  return <Sparkles size={14} />;
}

export default function AIActionButton({
  action,
  className,
  disabled = false,
}: {
  action: AIContextAction;
  className?: string;
  disabled?: boolean;
}) {
  const trigger = useTenantAIActionTrigger();

  return (
    <button
      type="button"
      disabled={disabled || !trigger}
      onClick={() => trigger?.(action)}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-navy-700 transition-colors hover:bg-navy-50 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    >
      {iconForVariant(action.variant)}
      {action.label}
    </button>
  );
}
