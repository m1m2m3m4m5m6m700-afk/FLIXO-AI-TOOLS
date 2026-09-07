import { lazy } from "react";
import { createRoute } from "@tanstack/react-router";
import { rootRoute } from "./__root";

export const enQuickFlowRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/en/quickflow/$workflowId",
  head: () => ({
    meta: [
      { title: "QuickFlow | FLIXO" },
      {
        name: "description",
        content: "Run a deterministic FLIXO image workflow locally in your browser.",
      },
      { name: "robots", content: "noindex,follow" },
    ],
  }),
  component: lazy(() =>
    import("./quickflow/en-quickflow-page").then((module) => ({ default: module.EnQuickFlowPage })),
  ),
});
