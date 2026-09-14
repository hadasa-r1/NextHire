import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";

import "@ds/tokens.css";
import "@ds/components.css";
import "@/shared/layout.css";

import { AuthProvider, type SessionLoader } from "@/auth/AuthProvider";
import { ReferenceDataProvider, type ReferenceLoader } from "@/integrations/ReferenceDataProvider";
import { EvaluationProvider, type EvaluationServices } from "@/integrations/EvaluationProvider";
import { DemoBanner } from "@/demo/DemoBanner";
import { isLocalDemo } from "@/demo/demo-mode";
import { router } from "@/router";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("The root element is missing.");
const root = createRoot(rootElement);

async function startClient() {
  let loadSession: SessionLoader | undefined;
  let loadOptions: ReferenceLoader | undefined;
  let services: EvaluationServices | undefined;
  let demo = false;

  // Vite removes this branch and its fixture module from production builds.
  if (import.meta.env.DEV && isLocalDemo(import.meta.env.DEV, import.meta.env.VITE_LOCAL_DEMO, window.location.hostname)) {
    const local = await import("@/demo/local-demo");
    loadSession = local.loadDemoSession;
    loadOptions = local.loadDemoOptions;
    services = local.demoEvaluationServices;
    demo = true;
  }
  // Outside local demo, supply Group C/Group A authenticated integrations here.
  // No permissions are granted automatically in normal or production mode.
  root.render(
    <StrictMode>
      <DemoBanner enabled={demo} />
      <AuthProvider {...(loadSession ? { loadSession } : {})}>
        <ReferenceDataProvider {...(loadOptions ? { loadOptions } : {})}>
          <EvaluationProvider {...(services ? { services } : {})}>
            <RouterProvider router={router} />
          </EvaluationProvider>
        </ReferenceDataProvider>
      </AuthProvider>
    </StrictMode>,
  );
}
startClient().catch(() => {
  root.render(<p role="alert" dir="rtl">לא ניתן להפעיל את הממשק. יש לרענן את הדף ולנסות שוב.</p>);
});

