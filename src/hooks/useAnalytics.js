import { useState, useEffect, useCallback } from "react";
import { showToast } from "../lib/toast.js";
import { emptyDashboardSummary } from "../services/dashboardService.js";
import { emptyReportSummary } from "../services/reportService.js";

export function useAnalytics(repository, businessId, canViewProfit = true) {
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
    let isMounted = true;

    if (!businessId) {
      setDashboardSummary(emptyDashboardSummary);
      setDashboardLoading(false);
      return undefined;
    }

    setDashboardLoading(true);
    setDashboardError("");

    repository
      .getDashboardSummary(businessId, { includeProfit: canViewProfit })
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
  }, [businessId, repository, canViewProfit]);

  useEffect(() => {
    let isMounted = true;

    if (!businessId) {
      setReportSummary(emptyReportSummary);
      setReportsLoading(false);
      return undefined;
    }

    if (!canViewProfit) {
      setReportSummary(emptyReportSummary);
      setReportsError("");
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
  }, [businessId, reportRange, reportStartDate, reportEndDate, reportRefreshKey, repository, canViewProfit]);

  const refreshAnalytics = useCallback(async (bId = businessId) => {
    if (!bId) return;

    const [nextDashboard, nextReport] = await Promise.allSettled([
      repository.getDashboardSummary(bId, { includeProfit: canViewProfit }),
      canViewProfit
        ? repository.getReportSummary(bId, {
            range: reportRange,
            startDate: reportStartDate || undefined,
            endDate: reportEndDate || undefined,
          })
        : Promise.resolve(emptyReportSummary),
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
  }, [businessId, canViewProfit, repository, reportRange, reportStartDate, reportEndDate]);

  const resetAnalytics = () => {
    setDashboardSummary(emptyDashboardSummary);
    setReportSummary(emptyReportSummary);
  };

  const fetchProductStockTimeline = async (productId) => {
    if (!businessId) return null;
    return repository.getProductStockTimeline(businessId, productId);
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
    fetchProductStockTimeline,
    refreshAnalytics,
    resetAnalytics,
  };
}
