import { lazy } from "react";
import { createRoute } from "@tanstack/react-router";
import { rootRoute } from "./__root";

export const localizedQuickFlowRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/$locale/quickflow/$workflowId",
  component: lazy(() =>
    import("./quickflow/localized-quickflow-page").then((module) => ({
      default: module.LocalizedQuickFlowPage,
    })),
  ),
});
