import {
  createContext,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";

import type { AIContextAction } from "../../api/v2";

interface TenantAIActionEvent {
  nonce: number;
  action: AIContextAction;
}

interface TenantAIActionContextValue {
  lastAction: TenantAIActionEvent | null;
  triggerAction: (action: AIContextAction) => void;
}

const TenantAIActionContext = createContext<TenantAIActionContextValue | null>(null);

export function TenantAIActionProvider({ children }: PropsWithChildren) {
  const [lastAction, setLastAction] = useState<TenantAIActionEvent | null>(null);

  const value = useMemo<TenantAIActionContextValue>(
    () => ({
      lastAction,
      triggerAction: (action) => {
        setLastAction((current) => ({
          nonce: (current?.nonce ?? 0) + 1,
          action,
        }));
      },
    }),
    [lastAction],
  );

  return (
    <TenantAIActionContext.Provider value={value}>
      {children}
    </TenantAIActionContext.Provider>
  );
}

export function useTenantAIActionTrigger() {
  const context = useContext(TenantAIActionContext);
  return context?.triggerAction ?? null;
}

export function useTenantAIActionEvent() {
  const context = useContext(TenantAIActionContext);
  return context?.lastAction ?? null;
}
