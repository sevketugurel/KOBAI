import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/utils";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export interface CardHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export interface CardBodyProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  padded?: boolean;
}

function CardRoot({ className, children, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        "bg-surface rounded-xl border border-border shadow-card",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

function CardHeader({ title, subtitle, action, className }: CardHeaderProps) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 p-6 border-b border-border",
        className,
      )}
    >
      <div className="min-w-0">
        <h3 className="font-display text-base font-semibold text-navy-900">
          {title}
        </h3>
        {subtitle ? (
          <p className="text-sm text-navy-500 mt-1">{subtitle}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function CardBody({ className, children, padded = true, ...rest }: CardBodyProps) {
  return (
    <div className={cn(padded && "p-6", className)} {...rest}>
      {children}
    </div>
  );
}

type CardComponent = typeof CardRoot & {
  Header: typeof CardHeader;
  Body: typeof CardBody;
};

export const Card = CardRoot as CardComponent;
Card.Header = CardHeader;
Card.Body = CardBody;

export default Card;
