import { lazy } from "react";
import { createRoute } from "@tanstack/react-router";
import { rootRoute } from "./__root";

export const localizedQuickFlowRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/$locale/quickflow/$workflowId",
  head: () => ({
    meta: [
      { title: 'FLIXO QuickFlow' },
      { name: 'robots', content: 'noindex, nofollow, noarchive' },
    ],
  }),
  component: lazy(() =>
    import("./quickflow/localized-quickflow-page").then((module) => ({
      default: module.LocalizedQuickFlowPage,
    })),
  ),
});
