import { Badge, Button, Heading, Text } from "@ds/components";
import type { ProcessState } from "@process";
export function ProcessFlow({ process, selected, onSelect, disabled = false }: { process: ProcessState; selected?: string; onSelect?: (id: string) => void; disabled?: boolean }) {
  return <section className="nh-section" aria-label="סדר שלבי ההגשה">
    <Heading level={2}>שלבי ההגשה</Heading>
    {process.blockedReason && <Text>{process.blockedReason}</Text>}
    {!process.steps.length && <Text>שלבי התהליך טרם התקבלו עבור משרה זו.</Text>}
    <ol className="nh-process-flow">{process.steps.map(step => <li key={step.id} aria-current={selected === step.id ? "step" : undefined}>
      <Heading level={3}>{step.name}</Heading>
      <Badge tone={step.state === "complete" ? "success" : step.state === "blocked" ? "draft" : "pending"}>
        {step.state === "complete" ? "ההערכות הוזנו" : step.state === "blocked" ? "חסום" : "זמין להערכה"}
      </Badge>
      <Text>{step.completed} מתוך {step.total} קריטריונים הושלמו</Text>
      {step.reason && <Text>{step.reason}</Text>}
      {onSelect && <Button type="button" variant="secondary" disabled={disabled || step.state === "blocked"} onClick={() => onSelect(step.id)}>פתיחת השלב</Button>}
    </li>)}</ol>
    <Text>השלמת הערכות אינה אישור ועדה או נעילת ציונים. שלב עם מכסת מעבר מחייב גם החלטת מעבר מוסמכת.</Text>
  </section>;
}
