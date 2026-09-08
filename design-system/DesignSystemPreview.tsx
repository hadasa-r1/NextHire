// RecruitFlow — preview page for all shared UI components.
// Mount on a dev-only route (e.g. /design-system) so the 3 groups can
// check they're using the same visual building blocks.
//
// The examples below (field names, statuses...) are illustrative only —
// they are NOT the official field list for the project.
// Each group designs its own data model after the analysis week.

import "./tokens.css";
import "./components.css";
import { Heading, Text, Field, Input, Textarea, Select, Button, Badge, Card, Table } from "./components";

export default function DesignSystemPreview() {
  return (
    <div className="rf-showcase">

      <section className="rf-showcase-section">
        <Heading level={1}>מערכת העיצוב של RecruitFlow</Heading>
        <Text>
          כל הרכיבים המשותפים בין שלוש הקבוצות. הדוגמאות במסך הזה הן להמחשה בלבד —
          לא רשימת השדות הרשמית של הפרויקט.
        </Text>
      </section>

      <section className="rf-showcase-section">
        <Heading level={2}>כותרות וטקסט</Heading>
        <div className="rf-showcase-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: 10 }}>
          <Heading level={1}>כותרת ראשית</Heading>
          <Heading level={2}>כותרת משנה</Heading>
          <Heading level={3}>כותרת קטנה</Heading>
          <Text>טקסט רגיל, לגוף התוכן והתיאורים.</Text>
        </div>
      </section>

      <section className="rf-showcase-section">
        <Heading level={2}>שדות טופס</Heading>
        <Field label="שם המשרה" hint="דוגמה בלבד">
          <Input placeholder="לדוגמה: מפתח תוכנה" />
        </Field>
        <Field label="תיאור התפקיד">
          <Textarea placeholder="תיאור חופשי..." />
        </Field>
        <Field label="תפקיד המשתמש">
          <Select defaultValue="">
            <option value="" disabled>בחרו תפקיד</option>
            <option value="manager">מנהל מקצועי</option>
            <option value="referent">רפרנט</option>
            <option value="committee">ועדת מכרזים</option>
          </Select>
        </Field>
      </section>

      <section className="rf-showcase-section">
        <Heading level={2}>כפתורים</Heading>
        <div className="rf-showcase-row">
          <Button variant="primary">שמירה</Button>
          <Button variant="secondary">ביטול</Button>
          <Button variant="danger">מחיקה</Button>
        </div>
      </section>

      <section className="rf-showcase-section">
        <Heading level={2}>תגיות סטטוס</Heading>
        <div className="rf-showcase-row">
          <Badge tone="draft">טיוטה</Badge>
          <Badge tone="pending">ממתין לאישור</Badge>
          <Badge tone="published">פורסם</Badge>
          <Badge tone="success">נבחר מועמד</Badge>
        </div>
      </section>

      <section className="rf-showcase-section">
        <Heading level={2}>כרטיס</Heading>
        <Card>
          <Heading level={3}>PMO</Heading>
          <Text>דוגמה של כרטיס תוכן — כותרת קטנה + טקסט, על רקע מוגבה.</Text>
        </Card>
      </section>

      <section className="rf-showcase-section">
        <Heading level={2}>טבלה</Heading>
        <Table>
          <thead>
            <tr>
              <th>שם המועמד</th>
              <th>ציון</th>
              <th>סטטוס</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>דוגמה א׳</td>
              <td className="num">87</td>
              <td><Badge tone="success">נבחר</Badge></td>
            </tr>
            <tr>
              <td>דוגמה ב׳</td>
              <td className="num">72</td>
              <td><Badge tone="draft">לא נבחר</Badge></td>
            </tr>
          </tbody>
        </Table>
      </section>

    </div>
  );
}
