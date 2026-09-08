// RecruitFlow — shared UI components used by all 3 groups.
// Import from any screen: import { Button, Input, ... } from "../design-system/components";
import type { ReactNode, InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes, ButtonHTMLAttributes } from "react";

// ---------- Headings & text ----------

export function Heading({ level = 2, children }: { level?: 1 | 2 | 3; children: ReactNode }) {
  const Tag = (`h${level}` as unknown) as "h1" | "h2" | "h3";
  return <Tag className={`rf-heading rf-heading--${level}`}>{children}</Tag>;
}

export function Text({ children }: { children: ReactNode }) {
  return <p className="rf-text">{children}</p>;
}

// ---------- Form fields ----------

type FieldProps = { label: string; hint?: string; children: ReactNode };

export function Field({ label, hint, children }: FieldProps) {
  return (
    <div className="rf-field">
      <label className="rf-label">{label}</label>
      {children}
      {hint && <span className="rf-field-hint">{hint}</span>}
    </div>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className="rf-input" {...props} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className="rf-textarea" {...props} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className="rf-select" {...props} />;
}

// ---------- Buttons ----------

type ButtonVariant = "primary" | "secondary" | "danger";

export function Button({
  variant = "primary",
  children,
  ...rest
}: { variant?: ButtonVariant } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={`rf-button rf-button--${variant}`} {...rest}>
      {children}
    </button>
  );
}

// ---------- Status badge ----------

type BadgeTone = "draft" | "pending" | "published" | "success";

export function Badge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  return <span className={`rf-badge rf-badge--${tone}`}>{children}</span>;
}

// ---------- Card ----------

export function Card({ children }: { children: ReactNode }) {
  return <div className="rf-card">{children}</div>;
}

// ---------- Table ----------

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="rf-table-wrap">
      <table className="rf-table">{children}</table>
    </div>
  );
}
