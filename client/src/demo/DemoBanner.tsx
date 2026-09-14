import { Text } from "@ds/components";

export function DemoBanner({ enabled }: { enabled: boolean }) {
  if (!enabled) return null;
  return <aside className="nh-demo-banner" aria-label="מצב הדגמה מקומי">
    <Text><strong>מצב הדגמה מקומי</strong> — אפשר להוסיף ולערוך מועמדים והגשות. השינויים נשמרים במסד המקומי.
      ההרשאות, המשרות והחברות הן להדגמה. ניתן לשמור הערכות, לסמן מעבר סף ולתעד דחייה; חישוב המפ״ל והחלטות הזכייה ממתינים להגדרת הכללים.</Text>
  </aside>;
}

