import { createBrowserRouter } from "react-router-dom";

import { AppShell } from "@/app/layouts/AppShell";
import { WorkspacePage } from "@/pages/WorkspacePage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [{ index: true, element: <WorkspacePage /> }],
  },
]);
