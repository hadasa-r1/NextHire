import { createBrowserRouter, Navigate, useParams } from "react-router-dom";
import { Card } from "@ds/components";
import DesignSystemPreview from "@ds/DesignSystemPreview";
import { candidatePoolDestination } from "@/features/applications/application-fields";
import { CandidatesPage } from "@/features/candidates/CandidatesPage";
import { CandidateFormPage } from "@/features/candidates/CandidateFormPage";
import { CandidateDetailsPage } from "@/features/candidates/CandidateDetailsPage";
import { PositionsPage } from "@/features/positions/PositionsPage";
import { HomePage } from "@/features/home/HomePage";
import { ApplicationsPage } from "@/features/applications/ApplicationsPage";
import { ApplicationImportPage } from "@/features/applications/ApplicationImportPage";
import { ApplicationFormPage } from "@/features/applications/ApplicationFormPage";
import { ApplicationDetailsPage } from "@/features/applications/ApplicationDetailsPage";
import { EvaluationPage } from "@/features/evaluations/EvaluationPage";
import { TenderSummaryPage } from "@/features/tender-summary/TenderSummaryPage";
import { PageLayout } from "@/shared/PageLayout";
import { PageState } from "@/shared/PageState";

function CandidatePoolPage() { return <Navigate replace to={candidatePoolDestination(useParams().positionId)} />; }

function RouteErrorPage() {
  return <PageLayout title="לא ניתן להציג את הדף"><Card>
    <PageState kind="error" message="אירעה שגיאה בפתיחת הדף. ניתן לחזור לרשימת המועמדים דרך הניווט." />
  </Card></PageLayout>;
}

export const router = createBrowserRouter([
  { path: "/", element: <HomePage />, errorElement: <RouteErrorPage /> },
  { path: "/positions", element: <PositionsPage />, errorElement: <RouteErrorPage /> },
  { path: "/positions/:positionId/import", element: <ApplicationImportPage />, errorElement: <RouteErrorPage /> },
  { path: "/positions/:positionId/candidates", element: <ApplicationsPage />, errorElement: <RouteErrorPage /> },
  { path: "/candidates", element: <CandidatesPage />, errorElement: <RouteErrorPage /> },
  { path: "/candidates/new", element: <CandidateFormPage />, errorElement: <RouteErrorPage /> },
  { path: "/candidates/:candidateId/edit", element: <CandidateFormPage />, errorElement: <RouteErrorPage /> },
  { path: "/candidates/:candidateId", element: <CandidateDetailsPage />, errorElement: <RouteErrorPage /> },
  { path: "/applications", element: <ApplicationsPage />, errorElement: <RouteErrorPage /> },
  { path: "/applications/new", element: <ApplicationFormPage />, errorElement: <RouteErrorPage /> },
  { path: "/applications/:applicationId/edit", element: <ApplicationFormPage />, errorElement: <RouteErrorPage /> },
  { path: "/applications/:applicationId", element: <ApplicationDetailsPage />, errorElement: <RouteErrorPage /> },
  { path: "/applications/:applicationId/evaluation", element: <EvaluationPage />, errorElement: <RouteErrorPage /> },
  { path: "/positions/:positionId/tender-summary", element: <TenderSummaryPage />, errorElement: <RouteErrorPage /> },
  { path: "/positions/:positionId/candidate-pool", element: <CandidatePoolPage />, errorElement: <RouteErrorPage /> },
  { path: "/design-system", element: <DesignSystemPreview />, errorElement: <RouteErrorPage /> },
  { path: "*", element: <Navigate to="/" replace /> },
]);
