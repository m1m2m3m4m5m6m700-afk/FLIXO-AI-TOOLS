import { lazy } from "react";
import { createRoute } from "@tanstack/react-router";
import { rootRoute } from "./__root";

export const arQuickFlowRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/ar/quickflow/$workflowId",
  head: () => ({
    meta: [
      { title: "QuickFlow | فليكسو" },
      {
        name: "description",
        content: "نفّذ سلسلة معالجة حتمية للصورة محليًا داخل المتصفح مع الحفاظ على الخصوصية.",
      },
      { name: "robots", content: "noindex,follow" },
    ],
  }),
  component: lazy(() =>
    import("./quickflow/ar-quickflow-page").then((module) => ({ default: module.ArQuickFlowPage })),
  ),
});
