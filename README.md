<p align="center">
  <img src="./assets/nexthire-logo.png" alt="NEXTHIRE logo" width="760" />
</p>

# NEXTHIRE

מערכת לניהול תהליך גיוס ותיחור. המימוש הנוכחי כולל שרת של קבוצה ב׳ ב־Node.js, TypeScript, Express, MongoDB ו־Mongoose, וממשק משתמש ב־React, TypeScript ו־Vite.

## התנסות בממשק

להתנסות מקומית בהוספה ועריכה של מועמדים והגשות, הגדירו `VITE_LOCAL_DEMO=true` בקובץ `client/.env.local` והפעילו `npm run dev:server` ו־`npm run dev:client` בשני טרמינלים. במחשב הפיתוח הנוכחי ההגדרה כבר קיימת. פתחו `http://localhost:5173/candidates`.

מצב ההדגמה פועל רק בפיתוח ב־localhost. השמירה היא למסד המקומי; ההרשאות ואפשרויות המשרות והחברות הן להדגמה בלבד. שמירת הערכות, ניקוד RATIO/DIRECT וסימון מעבר סף או דחייה פעילים עם `NEXTHIRE_LOCAL_WORKFLOW=true` ב־`server/.env`. חישוב מפ״ל והחלטות זכייה עדיין ממתינים לכללים החסרים. להוראות מלאות ולגבולות המצב ראו [תיעוד הלקוח](client/README.md#התנסות-מקומית). הלוגו המקורי מחובר כעת לכותרת המסכים המשותפת.

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
- `EvaluationScore.actualValue` מוגדר ב־TypeScript כ־`number | boolean` וב־Mongoose כ־`Schema.Types.Mixed`. נוספה ולידציה שמגבילה את Mixed לבוליאני או למספר סופי גם בזמן ריצה.
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

## מבנה הפרויקט

```text
server/
  src/
    config/database.ts                 חיבור ל־MongoDB
    models/                            ארבעת המודלים של קבוצה ב׳
    repository/                        Repository גנרי ומופעים למודלים
    controllers/                       Controller גנרי
    routes/                            נתיבי API
    middleware/                        טיפול בשגיאות
    scripts/                           בדיקת החיבור למסד
    app.ts                             הגדרת Express
    server.ts                          הפעלת השרת
  tests/                               בדיקות השרת
  .env                                 הגדרות מקומיות, מוחרגות מ־Git
  .env.example                         דוגמת הגדרות
  package.json                         חבילות ופקודות השרת
  tsconfig.json                        הגדרות TypeScript לשרת
client/
  src/
    features/                          מסכי הבית והמועמדים
    design-system/                     רכיבי עיצוב ו־CSS משותפים למסכים
    api/                               קריאות לשרת
    types/                             טיפוסים בצד הלקוח
    router.tsx                         ניווט בין המסכים
    main.tsx                           כניסה לאפליקציית React
  package.json                         חבילות ופקודות הלקוח
  tsconfig.json                        הגדרות TypeScript ללקוח
  vite.config.ts                       הגדרות Vite והעברת בקשות לשרת
docs/                                  מסמך המרצה
assets/                                נכסי תיעוד, כולל לוגו ה־README
package.json                           פקודות משותפות ו־npm workspaces
package-lock.json                      גרסאות החבילות של שני הצדדים
```

פעולות `add`, `getAll`, `getById`, `update`, `remove` ממומשות פעם אחת ב־`server/src/repository/repository.ts`. אותו Controller ואותה פונקציית יצירת Routes משמשים את ארבעת המודלים.

## התקנה והרצה מקומית

נדרשים Node.js עם npm ושרת MongoDB פעיל. MongoDB Compass מאפשר לצפות בנתונים; השרת מתחבר ישירות ל־MongoDB באמצעות Mongoose.

פתחו ב־VS Code את תיקיית הפרויקט שמכילה יחד את `server` ואת `client`. כל הפקודות הבאות רצות מהתיקייה הזאת.

בהתקנה ראשונה התקינו את החבילות של שני הצדדים:

```bash
npm ci
```

אם עדיין אין `server/.env`, צרו אותו מהדוגמה. ב־PowerShell:

```powershell
if (!(Test-Path server/.env)) { Copy-Item server/.env.example server/.env }
```

ההגדרות לדוגמה הן:

```dotenv
MONGODB_URI=mongodb://127.0.0.1:27017/nexthire_group_b
PORT=3000
CORS_ORIGIN=http://localhost:5173
```

ההגדרות נשמרות ב־`server/.env`, שמוחרג מ־Git. התקנת npm אחת בשורש משותפת לשני הצדדים באמצעות workspaces; אין צורך להתקין בכל תיקייה בנפרד.

בטרמינל הראשון הפעילו את השרת:

```bash
npm run dev:server
```

בטרמינל שני, מאותה תיקיית פרויקט, הפעילו את הממשק:

```bash
npm run dev:client
```

השאירו את שני הטרמינלים פועלים ופתחו `http://localhost:5173` בדפדפן. לעצירה לחצו `Ctrl+C` בכל טרמינל. אם Vite מציג פורט אחר משום ש־5173 תפוס, השתמשו בכתובת שמופיעה בטרמינל.

ה־API זמין בברירת המחדל ב־`http://127.0.0.1:3000`; Vite מעביר אליו בקשות `/api`. אם משנים את פורט השרת, יש לעדכן גם את יעד ה־proxy ב־`client/vite.config.ts`. אפשר לבדוק את השרת ב־`http://127.0.0.1:3000/api/candidates`; הנתיב `/` בשרת מחזיר 404.

פקודות נוספות מהשורש:

| פקודה | פעולה |
| --- | --- |
| `npm run dev` | הפעלת השרת בפיתוח, כמו `dev:server` |
| `npm start` | הפעלת השרת ללא מעקב אחר שינויים |
| `npm run db:check` | בדיקת חיבור MongoDB |
| `npm run typecheck` | בדיקת TypeScript של השרת ושל הלקוח |
| `npm test` | בדיקות השרת |
| `npm run build` | בדיקת טיפוסים ובניית הלקוח לתיקיית `client/dist` |

אפשר גם להריץ `npm run dev` מתוך `server` או מתוך `client` כדי להפעיל את הצד המתאים.

מסכי הלקוח: `/` דף הבית, `/candidates` רשימת המועמדים, `/positions/<positionId>/candidate-pool` מועמדויות למשרה קיימת, ו־`/design-system` תצוגת רכיבי העיצוב. המידע מגיע ממסד הנתונים שאליו השרת מחובר; הורדת הקוד אינה מעתיקה נתונים ממחשבים אחרים.

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

## מסכי המועמדים והרשאות

נוספו רשימת מועמדים עם פעולות, טופס אחד להוספה ולעריכה, ופרטי מועמד עם טבלת ההגשות שלו. הפריסה משותפת, בעברית וב־RTL, עם מצבי טעינה, שגיאה ורשימה ריקה.

המסכים מוכנים לחיבור להרשאות מקבוצה ג׳. עד להעברת `loadSession` ל־`AuthProvider`, מוצגת הודעה שהמשתמש והרשאותיו טרם התקבלו; לא ניתנות הרשאות אוטומטיות. אכיפת הרשאות בשרת עדיין ממתינה לחיבור של קבוצה ג׳. פרטי החיבור והנתיבים נמצאים ב־[תיעוד הלקוח](client/README.md).

להרצת בדיקות הלקוח מהשורש: `npm test -w client`.
## מסכי ההגשות

נוספו רשימת הגשות לפי משרה, טופס משותף להוספה ולעריכה, ופרטי הגשה עם טבלת הערכות. כפתורי ההגשות במסך פרטי המועמד מחוברים למסכים אלו. הנתיבים מתחילים ב־`/applications`.

להפעלת בחירת משרות וחברות יש לחבר את `ReferenceDataProvider` לממשק קבוצה א׳; החיבור להרשאות קבוצה ג׳ עדיין נדרש. שמירת הערכות, חישוב ניקוד ומעבר סף או דחייה ממומשים. חישוב מפ״ל והחלטות זכייה ממתינים להנחיות העסקיות החסרות. פרטים ב־[תיעוד הלקוח](client/README.md).
## מסכי הערכה ומפ״ל

נוספו `/applications/:applicationId/evaluation` ו־`/positions/:positionId/tender-summary`, עם ניווט מתוך ההגשה והרשאות לפי משאב. טופס ההערכה מחובר לקריטריונים ולשירות חישוב ושמירה בשרת, והמפ״ל מציג סיכומים שכבר נשמרו ופירוט הערכות. לא הומצאו נוסחאות, דירוג או החלטות זכייה. החיבורים והפעולות שעדיין חסומים מפורטים ב־[תיעוד הלקוח](client/README.md).
## המשך הפיתוח

קיימים ארבעת המודלים, חיבור למסד ו־CRUD גנרי, מסכי מועמדים והגשות, העלאת קורות חיים מקומית, שמירת הערכות וחישוב ניקוד בשרת, ופקודות מעבר סף ודחייה. נתיבי workflow בודקים הרשאות ומקבלים זהות מראיין מהשרת; ראו [חוזה ההערכות](client/src/integrations/EVALUATIONS.md). נדרשים עדיין חיבור ממשקי קבוצות א׳ וג׳, אימות ואכיפת הרשאות ל־CRUD הגנרי, נוסחאות המפ״ל וכללי הזכייה, והגדרת currentStage. כתובות מסך המאגר הישן מפנות כעת לרשימת ההגשות הפעילה של אותה משרה; פרמטרים ישנים בכתובת אינם מגדירים מצב תהליך.

לוגיקה עסקית תתווסף בנפרד בהתאם למסמך ולהנחיות המאושרות, תוך שימוש ב־Repository המשותף.

## מסמכי תכנון קודמים ועבודה משותפת

הקבצים `README תכנון מערכת.md` ו־`NextHire תכנון מערכת.html` נשמרו כתיעוד של התכנון הישן. הם עשויים להכיל שמות ישויות, שדות וכללים שאינם תואמים למסמך הסופי; אין להשתמש בהם כמפרט למימוש הנוכחי.

לעבודה משותפת פותחים ענף למשימה, מעלים אליו את השינויים ופותחים Pull Request לבדיקה ולמיזוג ל־`main`.

בדיקות הפורמט של תעודת זהות, טלפון, דוא״ל, קישורים וערכים מספריים משותפות ללקוח ולשרת; ראו [כללי התקינות והטיפול בנתוני ההדגמה הישנים](client/README.md#בדיקות-תקינות-של-שדות).
