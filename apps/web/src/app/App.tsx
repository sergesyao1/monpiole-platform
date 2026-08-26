import { createBrowserRouter, RouterProvider } from "react-router";

import { applicationRoutes } from "./routes.js";
const router = createBrowserRouter(applicationRoutes);

export function App() {
  return <RouterProvider router={router} />;
}
