import { createBrowserRouter, Navigate } from "react-router-dom";
import DesignSystemPreview from "@ds/DesignSystemPreview";
import { CandidatePoolPage } from "@/features/candidate-pool/CandidatePoolPage";
import { CandidatesPage } from "@/features/candidates/CandidatesPage";
import { HomePage } from "@/features/home/HomePage";

export const router = createBrowserRouter([
  { path: "/", element: <HomePage /> },
  { path: "/candidates", element: <CandidatesPage /> },
  {
    // Page 13 — Internal Candidate Pool for a single position.
    path: "/positions/:positionId/candidate-pool",
    element: <CandidatePoolPage />,
  },
  {
    // Dev-only shared component gallery (design-system/DesignSystemPreview.tsx).
    path: "/design-system",
    element: <DesignSystemPreview />,
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);
