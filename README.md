<p align="center">
  <img src="./assets/nexthire-logo.png" alt="NEXTHIRE logo" width="760" />
</p>

# NEXTHIRE

מערכת לניהול תהליך גיוס ותיחור. המימוש הנוכחי במאגר הוא שרת ה־Backend של קבוצה ב׳, ב־Node.js, TypeScript, Express, MongoDB ו־Mongoose.

## המסמך המחייב והיקף העבודה

מקור הדרישות הוא [המסמך הסופי של המרצה — Backend ומסד נתונים](<docs/שלב הבא - Backend ומסד נתונים.pdf>). הוא קודם למסמכי התכנון הישנים במאגר.

המערכת הכוללת כוללת 13 ישויות: `User`, `Authorization`, `Company`, `Candidate`, `Position`, `JobCategory`, `Stage`, `Criterion`, `Application`, `EvaluationScore`, `TenderSummary`, `Document`, `StatusLog`.

קבוצה ב׳ מממשת רק את ארבע הישויות הבאות:

| מודל | תפקיד | שדות פעילים |
| --- | --- | --- |
| `Candidate` | פרטי המועמד | `fullName`, `idNumber`, `phone`, `email` |
| `Application` | מועמדות למשרה | `positionId`, `candidateId`, `companyId`, `hourlyRateBid`, `resumeUrl`, `passedThreshold`, `rejectionReason` |
| `EvaluationScore` | הערכה לפי קריטריון | `applicationId`, `criterionId`, `interviewerId`, `actualValue`, `computedScore`, `notes`, `evaluatedAt` |
| `TenderSummary` | סיכום תוצאות המועמדות | `applicationId`, `totalQualityScore`, `priceScore`, `finalWeightedScore`, `rankPosition`, `isWinner`, `committeeApproverId`, `awardLetterUrl` |

החלטות המימוש שאושרו בשלב זה:

- `Candidate.idNumber` הוא שדה חובה, ללא הגדרת ייחודיות.
- `Application.resumeUrl` הוא שדה חובה.
- `TenderSummary.applicationId` מוגדר כ־`unique` עם `ref: "Application"`.
- יתר השדות אינם מוגדרים כחובה, ולא נוספו להם ערכי ברירת מחדל.
- `EvaluationScore.actualValue` מוגדר ב־TypeScript כ־`number | boolean` וב־Mongoose כ־`Schema.Types.Mixed`. אין כרגע ולידציה נוספת שמגבילה את Mixed לשני הסוגים בזמן ריצה.
- `Application.currentStage` מופיע במסמך, אך נשאר כהערת TODO בלבד עד לאישור סוגו; הוא אינו שדה פעיל ואינו מקושר ל־`Stage`.
- אין `timestamps` ואין `versionKey`. MongoDB יוצר את המזהה הטכני `_id`.

כל הקשרים הממומשים מוגדרים כ־`ObjectId` עם `ref`:

| שדה | מודל יעד |
| --- | --- |
| `Application.positionId` | `Position` |
| `Application.candidateId` | `Candidate` |
| `Application.companyId` | `Company` |
| `EvaluationScore.applicationId` | `Application` |
| `EvaluationScore.criterionId` | `Criterion` |
| `EvaluationScore.interviewerId` | `User` |
| `TenderSummary.applicationId` | `Application` |
| `TenderSummary.committeeApproverId` | `User` |

המודלים של קבוצות א׳ וג׳ משמשים כ־reference בלבד ואינם ממומשים כאן. הגדרת `ref` אינה בדיקה שהרשומה המקושרת קיימת.

## מבנה השרת

```text
src/
  config/database.ts                 חיבור ל־MongoDB וטעינת הגדרות הסביבה
  models/                            ארבעת הממשקים וה־Schemas של קבוצה ב׳
  repository/repository.ts           Repository<T> גנרי עם חמש פעולות CRUD
  repository/index.ts                יצירת Repository לכל אחד מארבעת המודלים
  controllers/generic.controller.ts  טיפול גנרי בבקשות ובתגובות HTTP
  routes/generic.routes.ts           יצירת נתיבי CRUD גנריים
  routes/index.ts                    חיבור ארבע הישויות לנתיבי ה־API
  middleware/error-handler.ts        טיפול מרכזי בשגיאות
  scripts/check-database.ts          בדיקת חיבור למסד הנתונים
  app.ts                             הגדרת Express, JSON, CORS והנתיבים
  server.ts                          חיבור למסד והפעלת השרת
tests/                               בדיקות Repository, Controller, Routes ושרת
docs/                                מסמך המרצה
```

פעולות `add`, `getAll`, `getById`, `update`, `remove` ממומשות פעם אחת ב־`Repository<T>`. אותו Controller ואותה פונקציית יצירת Routes משמשים את ארבעת המודלים.

## התקנה והרצה מקומית

נדרשים Node.js עם npm ושרת MongoDB פעיל. MongoDB Compass מאפשר לצפות בנתונים; השרת מתחבר ישירות ל־MongoDB באמצעות Mongoose.

מתוך תיקיית הפרויקט:

```bash
npm ci
```

בהתקנה ראשונה, אם עדיין אין קובץ `.env`, העתיקו את `.env.example` לשם `.env`. ב־PowerShell:

```powershell
Copy-Item .env.example .env
```

ההגדרות לדוגמה הן:

```dotenv
MONGODB_URI=mongodb://127.0.0.1:27017/nexthire_group_b
PORT=3000
CORS_ORIGIN=http://localhost:5173
```

`CORS_ORIGIN` מגדיר את כתובת הלקוח המותרת, ויכול להכיל כמה כתובות מופרדות בפסיקים. `.env` מוחרג מ־Git; במאגר נשמר רק `.env.example`.

בדיקת החיבור והפעלת השרת בפיתוח:

```bash
npm run db:check
npm run dev
```

להרצה ללא מעקב אחר שינויים:

```bash
npm start
```

בברירת המחדל השרת זמין ב־`http://127.0.0.1:3000`. הוא מתחיל לקבל בקשות רק לאחר החיבור למסד ויצירת האינדקסים. הנתיב `/` אינו מוגדר ומחזיר 404; אפשר לבדוק בדפדפן את `/api/candidates`.

## נתיבי API

| ישות | נתיב בסיס |
| --- | --- |
| `Candidate` | `/api/candidates` |
| `Application` | `/api/applications` |
| `EvaluationScore` | `/api/evaluation-scores` |
| `TenderSummary` | `/api/tender-summaries` |

לכל נתיב בסיס זמינות אותן פעולות:

| בקשה | פעולה | תגובת הצלחה |
| --- | --- | --- |
| `POST /` | הוספה | `201` עם הרשומה |
| `GET /` | קריאת כל הרשומות | `200` עם מערך |
| `GET /:id` | קריאת רשומה לפי מזהה | `200` עם הרשומה |
| `PATCH /:id` | עדכון שדות ברשומה | `200` עם הרשומה המעודכנת |
| `DELETE /:id` | מחיקה | `204` ללא גוף תגובה |

לדוגמה: `GET /api/candidates` או `PATCH /api/candidates/:id`. הפרמטר `id` הוא `_id` של MongoDB, ולא `idNumber` של המועמד. בבקשות הוספה ועדכון יש לשלוח אובייקט JSON עם `Content-Type: application/json`.

השרת מחזיר `400` לנתונים או מזהה לא תקינים, `404` לרשומה חסרה בקריאה או עדכון ולנתיב לא קיים, ו־`409` להתנגשות באינדקס ייחודי. מחיקת מזהה תקין שאין עבורו רשומה מחזירה גם היא `204`.

## בדיקות

```bash
npm run typecheck
npm test
```

הבדיקות כוללות פעולות CRUD, ניתוב ארבע הישויות, תגובות HTTP, ולידציה, ייחודיות וטיפול בשגיאות. בדיקות האינטגרציה משתמשות במסדי נתונים זמניים ומנקות אותם בסיום. להרצת כל הבדיקות נדרש גם MongoDB מקומי פעיל.

אפשר להריץ בנפרד `npm run test:controller`, `npm run test:routes` או `npm run test:app`.

## המשך הפיתוח

קיימים מודלים, חיבור למסד ו־API גנרי ל־CRUD. חישוב ציונים וסיכומי מכרז, שינוי דירוגים, מעבר בין שלבים, אימות משתמשים והרשאות וחיבור ממשק React עדיין אינם ממומשים בשרת זה. כרגע שדות הציונים והדירוגים נשמרים לפי הנתונים שנשלחים; הם אינם מחושבים אוטומטית.

לוגיקה עסקית תתווסף בנפרד בהתאם למסמך ולהנחיות המאושרות, תוך שימוש ב־Repository המשותף.

## מסמכי תכנון קודמים ועבודה משותפת

הקבצים `README תכנון מערכת.md` ו־`NextHire תכנון מערכת.html` נשמרו כתיעוד של התכנון הישן. הם עשויים להכיל שמות ישויות, שדות וכללים שאינם תואמים למסמך הסופי; אין להשתמש בהם כמפרט למימוש הנוכחי.

לעבודה משותפת פותחים ענף למשימה, מעלים אליו את השינויים ופותחים Pull Request לבדיקה ולמיזוג ל־`main`.
