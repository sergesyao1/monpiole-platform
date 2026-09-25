import { createBrowserRouter, RouterProvider } from "react-router";

import { managedApplicationRoutes } from "./managed-routes.js";

const router = createBrowserRouter(managedApplicationRoutes);

export function App() {
  return <RouterProvider router={router} />;
}
