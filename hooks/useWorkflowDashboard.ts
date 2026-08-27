"use client";

import { useEffect, useState } from "react";
import {
  fetchDashboardSummary,
  type DashboardSummaryResponse,
} from "@/lib/client/workflow-api";
import { formatApiError } from "@/lib/client/auth";

export function useWorkflowDashboard() {
  const [data, setData] = useState<DashboardSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => {
    setLoading(true);
    setError(null);
    return fetchDashboardSummary()
      .then((summary) => setData(summary))
      .catch((cause) => setError(formatApiError(cause, "Unable to load workflow dashboard data.")))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    let active = true;
    void fetchDashboardSummary()
      .then((summary) => {
        if (active) setData(summary);
      })
      .catch((cause) => {
        if (active) setError(formatApiError(cause, "Unable to load workflow dashboard data."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return { data, loading, error, refresh };
}

export default useWorkflowDashboard;
