import { useState, useEffect } from "react";
import { showToast } from "../lib/toast.js";
import { emptyDashboardSummary } from "../services/dashboardService.js";
import { emptyReportSummary } from "../services/reportService.js";

export function useAnalytics(repository, businessId, isDemo, products) {
  const [dashboardSummary, setDashboardSummary] = useState(emptyDashboardSummary);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState("");
  const [reportSummary, setReportSummary] = useState(emptyReportSummary);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportsError, setReportsError] = useState("");
  const [reportRange, setReportRange] = useState("weekly");
  const [reportStartDate, setReportStartDate] = useState("");
  const [reportEndDate, setReportEndDate] = useState("");
  const [reportRefreshKey, setReportRefreshKey] = useState(0);

  useEffect(() => {
    if (!isDemo) return;

    repository
      .getDashboardSummary("demo", products)
      .then((summary) => setDashboardSummary(summary));
    setDashboardError("");
    setDashboardLoading(false);
  }, [isDemo, products, repository]);

  useEffect(() => {
    let isMounted = true;

    if (isDemo) return undefined;

    if (!businessId) {
      setDashboardSummary(emptyDashboardSummary);
      setDashboardLoading(false);
      return undefined;
    }

    setDashboardLoading(true);
    setDashboardError("");

    repository
      .getDashboardSummary(businessId)
      .then((nextSummary) => {
        if (isMounted) setDashboardSummary(nextSummary);
      })
      .catch((error) => {
        console.error("Unable to load dashboard", error);
        showToast("Unable to load dashboard");
        if (isMounted) {
          setDashboardSummary(emptyDashboardSummary);
          setDashboardError(error.message || "Unable to load dashboard data.");
        }
      })
      .finally(() => {
        if (isMounted) setDashboardLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isDemo, businessId, repository]);

  useEffect(() => {
    let isMounted = true;

    if (isDemo) {
      repository
        .getReportSummary("demo", {}, products)
        .then((summary) => setReportSummary(summary));
      setReportsError("");
      setReportsLoading(false);
      return undefined;
    }

    if (!businessId) {
      setReportSummary(emptyReportSummary);
      setReportsLoading(false);
      return undefined;
    }

    setReportsLoading(true);
    setReportsError("");

    repository
      .getReportSummary(businessId, {
        range: reportRange,
        startDate: reportStartDate || undefined,
        endDate: reportEndDate || undefined,
      })
      .then((nextSummary) => {
        if (isMounted) setReportSummary(nextSummary);
      })
      .catch((error) => {
        console.error("Unable to load reports", error);
        showToast("Unable to load reports");
        if (isMounted) {
          setReportSummary(emptyReportSummary);
          setReportsError(error.message || "Unable to load reports.");
        }
      })
      .finally(() => {
        if (isMounted) setReportsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isDemo, products, businessId, reportRange, reportStartDate, reportEndDate, reportRefreshKey, repository]);

  const refreshAnalytics = async (bId = businessId) => {
    if (isDemo) {
      const dbSum = await repository.getDashboardSummary("demo", products);
      const rptSum = await repository.getReportSummary("demo", {}, products);
      setDashboardSummary(dbSum);
      setReportSummary(rptSum);
      return;
    }

    if (!bId) return;

    const [nextDashboard, nextReport] = await Promise.allSettled([
      repository.getDashboardSummary(bId),
      repository.getReportSummary(bId, {
        range: reportRange,
        startDate: reportStartDate || undefined,
        endDate: reportEndDate || undefined,
      }),
    ]);

    if (nextDashboard.status === "fulfilled") {
      setDashboardSummary(nextDashboard.value);
    } else {
      console.error("Unable to refresh dashboard", nextDashboard.reason);
      showToast("Unable to refresh dashboard");
    }

    if (nextReport.status === "fulfilled") {
      setReportSummary(nextReport.value);
    } else {
      console.error("Unable to refresh reports", nextReport.reason);
      showToast("Unable to refresh reports");
    }
  };

  const resetAnalytics = () => {
    setDashboardSummary(emptyDashboardSummary);
    setReportSummary(emptyReportSummary);
  };

  return {
    dashboardSummary,
    setDashboardSummary,
    dashboardLoading,
    dashboardError,
    reportSummary,
    setReportSummary,
    reportsLoading,
    reportsError,
    reportRange,
    setReportRange,
    reportStartDate,
    setReportStartDate,
    reportEndDate,
    setReportEndDate,
    refreshReport: () => setReportRefreshKey((value) => value + 1),
    refreshAnalytics,
    resetAnalytics,
  };
}
