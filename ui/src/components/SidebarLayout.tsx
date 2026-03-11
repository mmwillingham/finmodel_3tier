import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { useLocation, useNavigate, NavLink } from "react-router-dom";
import { Box, Paper } from "@mui/material";
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import CashFlowService from "../services/cashflow.service";
import AssetService from "../services/asset.service";
import LiabilityService from "../services/liability.service";
import AccountService from "../services/account.service";
import AuthService from "../services/auth.service";
import { useAuth } from "../context/AuthContext";
import { SkeletonList } from "./Skeleton";
import ProjectionDetail from "./ProjectionDetail";
import CashFlowView from "./CashFlowView";
import AssetView from "./AssetView";
import LiabilityView from "./LiabilityView";
import BalanceSheetProjection from "./BalanceSheetProjection";
import CashFlowOverview from "./CashFlowOverview";
import "./SidebarLayout.css";
import SettingsService from "../services/settings.service";
import { useSettingsContext } from "../context/SettingsContext";
import CustomChartList from "./CustomChartList";
import CustomChartForm from "./CustomChartForm";
import CustomChartView from "./CustomChartView";
import MonteCarloProjections from "./MonteCarloProjections";
import ProfileSetupWizard from "./wizards/ProfileSetupWizard";
import CategoriesSetupWizard from "./wizards/CategoriesSetupWizard";
import AccountsSetupWizard from "./wizards/AccountsSetupWizard";
import AutomaticTransfersSetupWizard from "./wizards/AutomaticTransfersSetupWizard";
import AssetsSetupWizard from "./wizards/AssetsSetupWizard";
import LiabilitiesSetupWizard from "./wizards/LiabilitiesSetupWizard";
import IncomeSetupWizard from "./wizards/IncomeSetupWizard";
import ExpensesSetupWizard from "./wizards/ExpensesSetupWizard";
import AutoDisbursementService from "../services/auto_disbursement.service";
import AccountsSettingsPage from "../pages/AccountsSettingsPage";
import AutoDisbursementSettingsPage from "../pages/AutoDisbursementSettingsPage";
import DocumentVaultPage from "../pages/DocumentVaultPage";
import CashHandlingPage from "../pages/CashHandlingPage";
import ChangePasswordModal from "./ChangePasswordModal";
import CategorySettingsPage from "../pages/CategorySettingsPage";
import ProfileSettingsPage from "../pages/ProfileSettingsPage";
import ApplicationSettingsPage from "../pages/ApplicationSettingsPage";
import TaxHandlingPage from "../pages/TaxHandlingPage";
import UserManagementPage from "../pages/UserManagementPage";
import DefaultCategoriesPage from "../pages/DefaultCategoriesPage";
import DefaultFoldersPage from "../pages/DefaultFoldersPage";
import HelpPage from "../pages/HelpPage";
import AboutPage from "../pages/AboutPage";
import ExportImportPage from "../pages/ExportImportPage";
import ReferAFriendPage from "../pages/ReferAFriendPage";
import AuthorizedUsersPage from "../pages/AuthorizedUsersPage";
import AccountSwitcherPage from "../pages/AccountSwitcherPage";
import WhatIfPage from "../pages/WhatIfPage";

ChartJS.register(ArcElement, Tooltip, Legend);

export default function SidebarLayout() {
  const MOBILE_BREAKPOINT = 768;
  const { viewingUserId, userSettings, currentUser, login } = useAuth();
  const typedUserSettings: any = userSettings;
  const { settings } = useSettingsContext();
  const location = useLocation();
  const navigate = useNavigate();
  const [view, setView] = useState("new-home"); // Default to home view
  const [cashFlowView, setCashFlowView] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedProjectionId] = useState<any>(null);
  const [incomeItems, setIncomeItems] = useState<any[]>([]);
  const [expenseItems, setExpenseItems] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  const [liabilities, setLiabilities] = useState<any[]>([]);
  const [assetCategories, setAssetCategories] = useState<string[]>([]);
  const [liabilityCategories, setLiabilityCategories] = useState<string[]>([]);
  const [incomeCategories, setIncomeCategories] = useState<string[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<string[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [autoDisbursements, setAutoDisbursements] = useState<any[]>([]); // NEW: For cash flow transfers
  const [projectionYears, setProjectionYears] = useState(20);
  const [projectionYearsOverride, setProjectionYearsOverride] = useState<any>(null);
  const [subscriptionLimits, setSubscriptionLimits] = useState<any>(null);
  const [showChartTotals, setShowChartTotals] = useState(true);
  const [customChartView, setCustomChartView] = useState<any>(null);
  const [activeTooltip, setActiveTooltip] = useState<any>(null);
  const [tooltipPosition, setTooltipPosition] = useState<any>({ top: 0, left: 0 });
  const [selectedChartId, setSelectedChartId] = useState<any>(null);
  const [chartToViewId, setChartToViewId] = useState<any>(null);
  const [wizardOpen, setWizardOpen] = useState<any>(null); // 'profile', 'categories', 'accounts', or null
  const [isWalkthroughModalOpen, setIsWalkthroughModalOpen] = useState(false);
  const [showPasswordChangeModal, setShowPasswordChangeModal] = useState(false);
  const [viewingUserSettings, setViewingUserSettings] = useState<any>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [dashboardSimulation, setDashboardSimulation] = useState<any>({ successRate: null, confidenceAboveTarget: null, loading: false });
  const toggleTooltip = (id: any, event: any) => {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    const newPosition = {
      top: rect.top + window.scrollY + rect.height / 2,
      left: rect.left + window.scrollX - 8,
    };
    setTooltipPosition(newPosition);
    setActiveTooltip((prev: any) => (prev === id ? null : id));
  };

  useEffect(() => {
    const handleClickOutside = () => {
      setActiveTooltip(null);
    };
    window.addEventListener("pointerdown", handleClickOutside);
    return () => {
      window.removeEventListener("pointerdown", handleClickOutside);
    };
  }, []);
  const currentYear = new Date().getFullYear();
  const [homeProjectionYears, setHomeProjectionYears] = useState(Math.max(1, Number(projectionYears) || 20));
  const [desiredNetWorthTarget, setDesiredNetWorthTarget] = useState(250000);
  const [marketVariability, setMarketVariability] = useState(12);
  const totalAssets = assets.reduce((sum: any, asset: any) => sum + (asset.value || 0), 0);
  const totalLiabilitiesValue = liabilities.reduce((sum: any, liability: any) => sum + ((liability.value || liability.principal_amount) || 0), 0);
  const netWorth = totalAssets - totalLiabilitiesValue;
  const totalIncome = incomeItems.reduce((sum: any, item: any) => sum + (item.yearly_value || 0), 0);
  const totalExpenses = expenseItems.reduce((sum: any, item: any) => sum + (item.yearly_value || 0), 0);
  const cashFlowNet = totalIncome - totalExpenses;
  const netWorthPercent = totalAssets ? Math.min(100, Math.max(0, (netWorth / totalAssets) * 100)) : 0;
  const expenseRatio = totalIncome ? Math.min(100, Math.max(0, (totalExpenses / totalIncome) * 100)) : 0;
  const projectionYearsEffective = projectionYearsOverride ?? projectionYears;
  const currentYearSurplusDeficit = cashFlowNet;

  useEffect(() => {
    setHomeProjectionYears(Math.max(1, Number(projectionYearsEffective) || 20));
  }, [projectionYearsEffective]);

  const projectedNetWorth = useMemo(() => {
    if (!Array.isArray(assets) || !Array.isArray(liabilities)) {
      return netWorth;
    }
    const years = Math.max(0, Number(homeProjectionYears) || 0);
    const assetFuture = assets.reduce((sum: any, asset: any) => {
      const base = Number(asset.value) || 0;
      const growth = (Number(asset.annual_increase_percent) || 0) / 100;
      return sum + base * Math.pow(1 + growth, years);
    }, 0);
    const liabilityFuture = liabilities.reduce((sum: any, liability: any) => {
      const base = Number(liability.value ?? liability.principal_amount) || 0;
      const growth = (Number(liability.annual_increase_percent) || 0) / 100;
      return sum + base * Math.pow(1 + growth, years);
    }, 0);
    const cashFlowGrowthRate = 0.02;
    const surplusFuture = (Number(cashFlowNet) || 0) * (years + 1) * (1 + cashFlowGrowthRate * Math.max(0, years - 1) / 2);
    return assetFuture - liabilityFuture + surplusFuture;
  }, [assets, liabilities, homeProjectionYears, cashFlowNet, netWorth]);

  const assetAllocationData = useMemo(() => {
    if (!assets.length) {
      return null;
    }
    const grouped = assets.reduce((acc: any, asset: any) => {
      const category = asset.category || "Other";
      acc[category] = (acc[category] || 0) + (Number(asset.value) || 0);
      return acc;
    }, {});
    const labels = Object.keys(grouped);
    const values = Object.values(grouped);
    if (!labels.length) {
      return null;
    }
    const palette = ["#38bdf8", "#34d399", "#fbbf24", "#a78bfa", "#fb7185", "#22d3ee", "#94a3b8"];
    return {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: labels.map((_: any, i: any) => palette[i % palette.length]),
          borderColor: "rgba(2, 6, 23, 0.92)",
          borderWidth: 2,
        },
      ],
    };
  }, [assets]);

  const individualAssetAllocationData = useMemo(() => {
    if (!assets.length) {
      return null;
    }
    const sortedAssets = [...assets]
      .map((asset: any) => ({
        name: asset.name || "Unnamed Asset",
        value: Number(asset.value) || 0,
      }))
      .filter((asset: any) => asset.value > 0)
      .sort((a: any, b: any) => b.value - a.value);
    if (!sortedAssets.length) {
      return null;
    }
    const topCount = 8;
    const topAssets = sortedAssets.slice(0, topCount);
    const remainingTotal = sortedAssets.slice(topCount).reduce((sum: any, asset: any) => sum + asset.value, 0);
    const labels = topAssets.map((asset: any) => asset.name);
    const values = topAssets.map((asset: any) => asset.value);
    if (remainingTotal > 0) {
      labels.push("Other Assets");
      values.push(remainingTotal);
    }
    const palette = ["#38bdf8", "#34d399", "#fbbf24", "#a78bfa", "#fb7185", "#22d3ee", "#94a3b8", "#60a5fa", "#f472b6"];
    return {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: labels.map((_: any, i: any) => palette[i % palette.length]),
          borderColor: "rgba(2, 6, 23, 0.92)",
          borderWidth: 2,
        },
      ],
    };
  }, [assets]);

  const incomeAllocationData = useMemo(() => {
    if (!incomeItems.length) {
      return null;
    }
    const grouped = incomeItems.reduce((acc: any, item: any) => {
      const category = item.category || "Other";
      acc[category] = (acc[category] || 0) + (Number(item.yearly_value) || 0);
      return acc;
    }, {});
    const labels = Object.keys(grouped);
    const values = Object.values(grouped).map((val: any) => Math.abs(Number(val) || 0));
    if (!labels.length) {
      return null;
    }
    const palette = ["#38bdf8", "#34d399", "#fbbf24", "#a78bfa", "#fb7185", "#22d3ee", "#94a3b8"];
    return {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: labels.map((_: any, i: any) => palette[i % palette.length]),
          borderColor: "rgba(2, 6, 23, 0.92)",
          borderWidth: 2,
        },
      ],
    };
  }, [incomeItems]);

  const expenseAllocationData = useMemo(() => {
    if (!expenseItems.length) {
      return null;
    }
    const grouped = expenseItems.reduce((acc: any, item: any) => {
      const category = item.category || "Other";
      acc[category] = (acc[category] || 0) + (Number(item.yearly_value) || 0);
      return acc;
    }, {});
    const labels = Object.keys(grouped);
    const values = Object.values(grouped).map((val: any) => Math.abs(Number(val) || 0));
    if (!labels.length) {
      return null;
    }
    const palette = ["#38bdf8", "#34d399", "#fbbf24", "#a78bfa", "#fb7185", "#22d3ee", "#94a3b8"];
    return {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: labels.map((_: any, i: any) => palette[(i + 3) % palette.length]),
          borderColor: "rgba(2, 6, 23, 0.92)",
          borderWidth: 2,
        },
      ],
    };
  }, [expenseItems]);

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: true,
    aspectRatio: 1,
    plugins: {
      legend: { display: false },
    },
  };

  const assetCharts = [
    {
      key: "asset-category",
      label: "Category Allocation",
      data: assetAllocationData,
      emptyText: "No asset data available.",
    },
    {
      key: "asset-individual",
      label: "Individual Assets",
      data: individualAssetAllocationData,
      emptyText: "No asset data available.",
    },
    {
      key: "income",
      label: "Income Allocation",
      data: incomeAllocationData,
      emptyText: "No income data available.",
    },
    {
      key: "expenses",
      label: "Expense Allocation",
      data: expenseAllocationData,
      emptyText: "No expense data available.",
    },
  ];

  const loadViewingUserSettings = useCallback(async () => {
    if (!viewingUserId) {
      setViewingUserSettings(null);
      return;
    }

    try {
      const response = await SettingsService.getSettings(viewingUserId);
      setViewingUserSettings(response.data);
    } catch (error: any) {
      setViewingUserSettings(null);
    }
  }, [viewingUserId]);

  // Check if password change is required on mount or when currentUser changes
  useEffect(() => {
    // Check navigation state first
    if (location.state?.mustChangePassword) {
      setShowPasswordChangeModal(true);
      // Clear the state to avoid showing it again on refresh
      navigate(location.pathname, { replace: true, state: {} });
    } else if (currentUser && currentUser.must_change_password) {
      // Also check currentUser directly in case the state wasn't passed
      setShowPasswordChangeModal(true);
    }
  }, [location.state, currentUser, navigate, location.pathname]);

  useEffect(() => {
    loadViewingUserSettings();
  }, [loadViewingUserSettings]);

  useEffect(() => {
    let isMounted = true;
    const loadLimits = async () => {
      try {
        const response = await SettingsService.getSubscriptionLimits();
        if (isMounted) {
          setSubscriptionLimits(response.data);
        }
      } catch (error: any) {
        if (isMounted) {
          setSubscriptionLimits(null);
        }
      }
    };
    loadLimits();
    return () => {
      isMounted = false;
    };
  }, [currentUser?.id]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return;
    }
    const media = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
    const updateFromMedia = () => {
      const mobile = media.matches;
      setIsMobile(mobile);
      setIsSidebarOpen(!mobile);
    };
    updateFromMedia();
    if (media.addEventListener) {
      media.addEventListener("change", updateFromMedia);
    } else if (media.addListener) {
      media.addListener(updateFromMedia);
    }
    return () => {
      if (media.removeEventListener) {
        media.removeEventListener("change", updateFromMedia);
      } else if (media.removeListener) {
        media.removeListener(updateFromMedia);
      }
    };
  }, []);

  useEffect(() => {
    if (!isMobile) {
      return;
    }
    document.body.style.overflow = isSidebarOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobile, isSidebarOpen]);

  useEffect(() => {
    const handleToggle = () => {
      setIsSidebarOpen((prev: any) => !prev);
    };
    const handleClose = () => {
      setIsSidebarOpen(false);
    };
    window.addEventListener("sidebar:toggle", handleToggle);
    window.addEventListener("sidebar:close", handleClose);
    return () => {
      window.removeEventListener("sidebar:toggle", handleToggle);
      window.removeEventListener("sidebar:close", handleClose);
    };
  }, []);

  useEffect(() => {
    if (!isMobile) {
      return;
    }
    const handleEdgeTouchStart = (e: any) => {
      if (isSidebarOpen) {
        return;
      }
      const touch = e.touches[0];
      if (touch.clientX > 20) {
        return;
      }
      touchStartXRef.current = touch.clientX;
      touchCurrentXRef.current = touch.clientX;
    };

    const handleEdgeTouchMove = (e: any) => {
      if (touchStartXRef.current === null) {
        return;
      }
      touchCurrentXRef.current = e.touches[0].clientX;
    };

    const handleEdgeTouchEnd = () => {
      if (touchStartXRef.current === null) {
        return;
      }
      const deltaX = touchCurrentXRef.current - touchStartXRef.current;
      touchStartXRef.current = null;
      touchCurrentXRef.current = null;
      if (deltaX > 60) {
        setIsSidebarOpen(true);
      }
    };

    window.addEventListener("touchstart", handleEdgeTouchStart);
    window.addEventListener("touchmove", handleEdgeTouchMove);
    window.addEventListener("touchend", handleEdgeTouchEnd);
    return () => {
      window.removeEventListener("touchstart", handleEdgeTouchStart);
      window.removeEventListener("touchmove", handleEdgeTouchMove);
      window.removeEventListener("touchend", handleEdgeTouchEnd);
    };
  }, [isMobile, isSidebarOpen]);

  useEffect(() => {
    if (!viewingUserId || viewingUserId === currentUser?.id) {
      return;
    }
    if (viewingUserSettings) {
      setProjectionYears(viewingUserSettings.projection_years || 20);
      setShowChartTotals(viewingUserSettings.show_chart_totals ?? true);
    }
  }, [viewingUserId, viewingUserSettings, currentUser?.id]);

  useEffect(() => {
    if (viewingUserId && viewingUserId !== currentUser?.id) {
      return;
    }
    const effectiveSettings = viewingUserSettings || userSettings;
    const preferredYears = effectiveSettings?.projection_years ?? 20;
    if (preferredYears !== projectionYears) {
      setProjectionYears(preferredYears);
    }
  }, [viewingUserId, viewingUserSettings, userSettings, currentUser?.id, projectionYears]);

  useEffect(() => {
    setProjectionYearsOverride(null);
  }, [view, customChartView]);

  useEffect(() => {
    if (!subscriptionLimits?.is_limited || subscriptionLimits.max_projection_years == null) {
      return;
    }
    const maxYears = subscriptionLimits.max_projection_years;
    if (projectionYearsOverride !== null && projectionYearsOverride > maxYears) {
      setProjectionYearsOverride(maxYears);
    }
  }, [subscriptionLimits, projectionYearsOverride]);

  const maxProjectionYears = subscriptionLimits?.is_limited ? subscriptionLimits.max_projection_years : null;
  const isLimitedPlan = Boolean(subscriptionLimits?.is_limited);

  useEffect(() => {
    const years = Math.max(1, Math.min(maxProjectionYears ?? 50, Number(homeProjectionYears) || 20));
    if (!assets.length && !liabilities.length && !incomeItems.length && !expenseItems.length) {
      setDashboardSimulation({ successRate: null, confidenceAboveTarget: null, loading: false });
      return;
    }
    let cancelled = false;
    setDashboardSimulation((prev: any) => ({ ...prev, loading: true }));
    const runs = 300;
    setTimeout(() => {
      const terminalValues = [];
      for (let i = 0; i < runs; i++) {
        let value = Number(netWorth) || 0;
        for (let year = 0; year < years; year++) {
          const returnBand = Math.max(0.02, (Number(marketVariability) || 12) / 100);
          const randomReturn = 0.05 + (Math.random() - 0.5) * returnBand * 2;
          const randomCashFlowFactor = 1 + (Math.random() - 0.5) * Math.max(0.08, returnBand * 1.5);
          const yearlySurplus = (Number(cashFlowNet) || 0) * randomCashFlowFactor;
          value = value * (1 + randomReturn) + yearlySurplus;
        }
        terminalValues.push(value);
      }
      const successRate = (terminalValues.filter((v: any) => v > 0).length / runs) * 100;
      const confidenceAboveTarget = (terminalValues.filter((v: any) => v > (Number(desiredNetWorthTarget) || 0)).length / runs) * 100;
      if (!cancelled) {
        setDashboardSimulation({
          successRate,
          confidenceAboveTarget,
          loading: false,
        });
      }
    }, 0);
    return () => {
      cancelled = true;
    };
  }, [assets.length, liabilities.length, incomeItems.length, expenseItems.length, homeProjectionYears, netWorth, cashFlowNet, desiredNetWorthTarget, marketVariability, maxProjectionYears]);

  const projectThroughYear = currentYear + homeProjectionYears;
  const handleProjectThroughYearChange = (value: any) => {
    if (!Number.isFinite(value)) {
      return;
    }
    const maxYears = subscriptionLimits?.is_limited ? subscriptionLimits.max_projection_years : 50;
    const boundedYear = Math.min(Math.max(value, currentYear + 1), currentYear + maxYears);
    setHomeProjectionYears(Math.max(1, boundedYear - currentYear));
  };

  const handleProjectionYearsChange = (value: any) => {
    const maxYears = subscriptionLimits?.is_limited ? subscriptionLimits.max_projection_years : null;
    const nextValue = maxYears != null ? Math.min(value, maxYears) : value;
    setProjectionYearsOverride(nextValue);
  };

  // Handle password change completion - refresh user data from context
  const handlePasswordChangeComplete = () => {
    // The password change endpoint already clears must_change_password flag
    // Check currentUser again to see if it was cleared
    if (currentUser && !currentUser.must_change_password) {
      setShowPasswordChangeModal(false);
    }
  };

  const refreshAllData = useCallback(async () => {
    setLoading(true);
    try {
      const [inc, exp, ast, lib, accs, autoDisburs] = await Promise.all([
        CashFlowService.list(true, viewingUserId),
        CashFlowService.list(false, viewingUserId),
        AssetService.list(viewingUserId),
        LiabilityService.list(viewingUserId),
        AccountService.getAllAccounts(viewingUserId).catch((): any[] => []), // Don't fail if accounts endpoint doesn't exist yet
        AutoDisbursementService.getAllAutoDisbursements(viewingUserId).catch((): any[] => []), // NEW: Load auto-disbursements
      ]);

      setIncomeItems(inc.data || []);
      setExpenseItems(exp.data || []);
      setAssets(ast.data || []);
      setLiabilities(lib.data || []);
      setAccounts(accs || []);
      setAutoDisbursements(autoDisburs || []); // NEW: Set auto-disbursements

      const uniqueAssetCategories = [...new Set(ast.data.map((item: any) => item.category))].filter(Boolean);
      setAssetCategories(uniqueAssetCategories);
      
      const uniqueLiabilityCategories = [...new Set(lib.data.map((item: any) => item.category || ''))];
      setLiabilityCategories(uniqueLiabilityCategories);
      
      const uniqueIncomeCategories = [...new Set(inc.data.map((item: any) => item.category))].filter(Boolean);
      setIncomeCategories(uniqueIncomeCategories);
      
      const uniqueExpenseCategories = [...new Set(exp.data.map((item: any) => item.category))].filter(Boolean);
      setExpenseCategories(uniqueExpenseCategories);

    } catch (e: any) {
    } finally {
      setLoading(false);
    }
  }, [viewingUserId]);

  // Detect settings routes and update view accordingly
  useEffect(() => {
    const path = location.pathname;
    if (path === '/app' || path === '/' || path === '') {
      setView('new-home');
      setCashFlowView(null);
    } else if (path === '/accounts' || path === '/settings/accounts') {
      setView('accounts');
    } else if (path === '/assets') {
      setView('assets');
    } else if (path === '/liabilities') {
      setView('liabilities');
    } else if (path === '/cashflow/income') {
      setView('cashflow');
      setCashFlowView('income');
    } else if (path === '/cashflow/expense') {
      setView('cashflow');
      setCashFlowView('expense');
    } else if (path === '/automatic-transfers' || path === '/settings/auto-disbursements') {
      setView('automatic-transfers');
    } else if (path === '/categories' || path === '/settings/categories') {
      setView('settings-categories');
    } else if (path === '/documents') {
      setView('documents');
    } else if (path === '/settings/application') {
      setView('settings-application');
    } else if (path === '/settings/tax-handling') {
      setView('settings-tax-handling');
    } else if (path === '/settings/profile') {
      setView('settings-profile');
    } else if (path === '/settings/account-switcher') {
      setView('settings-account-switcher');
    } else if (path === '/settings/export-import') {
      setView('settings-export-import');
    } else if (path === '/settings/refer-a-friend') {
      setView('settings-refer-a-friend');
    } else if (path === '/settings/help') {
      setView('settings-help');
    } else if (path === '/settings/about') {
      setView('settings-about');
    } else if (path === '/settings/authorized-users') {
      setView('settings-authorized-users');
    } else if (path === '/settings/admin/users') {
      setView('settings-admin-users');
    } else if (path === '/settings/admin/global-categories') {
      setView('settings-admin-global-categories');
    } else if (path === '/settings/admin/default-folders') {
      setView('settings-admin-default-folders');
    } else if (path === '/settings/admin/document-vault-defaults') {
      setView('settings-admin-document-vault-defaults');
    }
  }, [location.pathname]);

  useEffect(() => {
    if (!location.state?.dashboardView) {
      return;
    }
    applyDashboardState(location.state);
    const { dashboardView, cashFlowView, customChartView, selectedChartId, chartToViewId, ...restState } = location.state;
    navigate(location.pathname, { replace: true, state: restState });
    if (dashboardView === "walkthrough") {
      setIsWalkthroughModalOpen(true);
    }
  }, [location.state, location.pathname, navigate]);

  useEffect(() => {
    if (isMobile) {
      setIsSidebarOpen(false);
    }
  }, [isMobile, location.pathname]);

  useEffect(() => {
    refreshAllData();
    
    // Listen for category updates from CategorySettingsPage
    const handleCategoryUpdate = () => {
      refreshAllData(); // Refresh all data when categories are updated
    };
    window.addEventListener('categoriesUpdated', handleCategoryUpdate);
    
    // Listen for navigation to home from Header
    const handleNavigateToHome = () => {
      setView('new-home');
      setCashFlowView(null);
      setCustomChartView(null);
      setSelectedChartId(null);
      setChartToViewId(null);
    };
    window.addEventListener('navigateToHome', handleNavigateToHome);
    
    return () => {
      window.removeEventListener('categoriesUpdated', handleCategoryUpdate);
      window.removeEventListener('navigateToHome', handleNavigateToHome);
    };
  }, [refreshAllData, viewingUserId]); // Refresh when viewingUserId changes

  const formatCurrency = (v: any) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(v ?? 0);

  const tooltipTexts = {
    projection: `Deterministic likelihood of reaching desired net worth at end of projection year.`,
  };

  const parseNumericInput = (value: any) => {
    if (value == null) return NaN;
    const cleaned = String(value).replace(/[^\d.-]/g, "");
    return Number(cleaned);
  };

  const renderMuiPageShell = (content: any) => (
    <Box sx={{ py: 1 }}>
      <Paper className="page-shell-card" variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 2 }}>
        {content}
      </Paper>
    </Box>
  );

    const refreshCashflow = async () => {
    if (!loading) setLoading(true);
    const [inc, exp] = await Promise.all([
      CashFlowService.list(true, viewingUserId),
      CashFlowService.list(false, viewingUserId),
    ]);
    setIncomeItems(inc.data || []);
    setExpenseItems(exp.data || []);
    
    const uniqueIncomeCategories = [...new Set((inc.data || []).map((item: any) => item.category))].filter(Boolean);
    setIncomeCategories(uniqueIncomeCategories);
    
    const uniqueExpenseCategories = [...new Set((exp.data || []).map((item: any) => item.category))].filter(Boolean);
    setExpenseCategories(uniqueExpenseCategories);

    setLoading(false);
  };

  const refreshAssets = async () => {
    if (!loading) setLoading(true);
    const ast = await AssetService.list(viewingUserId);
    setAssets(ast.data || []);
    
    const uniqueAssetCategories = [...new Set((ast.data || []).map((item: any) => item.category))].filter(Boolean);
    setAssetCategories(uniqueAssetCategories);
    
    setLoading(false);
  };

  const refreshLiabilities = async () => {
    if (!loading) setLoading(true);
    const lib = await LiabilityService.list(viewingUserId);
    setLiabilities(lib.data || []);
    
    const uniqueLiabilityCategories = [...new Set((lib.data || []).map((item: any) => item.category || ''))];
    setLiabilityCategories(uniqueLiabilityCategories);
    
    setLoading(false);
  };

  const handleEditChart = useCallback((chartId: any) => {
    setView('custom-charts');
    setCustomChartView('edit');
    setSelectedChartId(chartId);
  }, []);

  const handleCreateNewChart = useCallback(() => {
    setView('custom-charts');
    setCustomChartView('create');
    setSelectedChartId(null);
  }, []);

  const handleViewChart = useCallback((chartId: any) => {
    setView('custom-charts');
    setCustomChartView('view');
    setChartToViewId(chartId);
  }, []);

  const [sidebarWidth, setSidebarWidth] = useState(250);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<any>(null);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);
  const touchStartXRef = useRef<any>(null);
  const touchCurrentXRef = useRef<any>(null);

  const walkthroughOverlayStyle = useMemo(() => {
    if (isMobile || !isSidebarOpen) {
      return undefined;
    }
    return { left: `${sidebarWidth}px` };
  }, [isMobile, isSidebarOpen, sidebarWidth]);

  const handleMouseDown = (e: any) => {
    if (!sidebarRef.current) return;
    setIsResizing(true);
    startXRef.current = e.clientX;
    startWidthRef.current = sidebarRef.current.offsetWidth;
    e.preventDefault();
    e.stopPropagation();
  };

  const handleTouchStart = (e: any) => {
    if (!isMobile || !isSidebarOpen) {
      return;
    }
    const touch = e.touches[0];
    touchStartXRef.current = touch.clientX;
    touchCurrentXRef.current = touch.clientX;
  };

  const handleTouchMove = (e: any) => {
    if (!isMobile || !isSidebarOpen || touchStartXRef.current === null) {
      return;
    }
    const touch = e.touches[0];
    touchCurrentXRef.current = touch.clientX;
  };

  const handleTouchEnd = () => {
    if (!isMobile || !isSidebarOpen || touchStartXRef.current === null) {
      return;
    }
    const deltaX = touchCurrentXRef.current - touchStartXRef.current;
    touchStartXRef.current = null;
    touchCurrentXRef.current = null;
    if (deltaX < -60) {
      setIsSidebarOpen(false);
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: any) => {
      if (!isResizing) return;
      const deltaX = e.clientX - startXRef.current;
      const newWidth = startWidthRef.current + deltaX;
      // Constrain between 150px and 600px
      if (newWidth >= 150 && newWidth <= 600) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isResizing]);

  const handleNavSelection = (arg?: any) => {
    const closeWalkthroughModal = arg?.closeWalkthroughModal ?? true;
    if (isMobile) {
      setIsSidebarOpen(false);
    }
    if (closeWalkthroughModal) {
      setIsWalkthroughModalOpen(false);
    }
  };

  const handleDocumentVaultNav = (event: any) => {
    event.preventDefault();
    handleNavSelection();
    navigate('/documents', {
      state: {
        ...(location.state || {}),
        documentVaultResetAt: Date.now(),
      },
    });
  };

  const applyDashboardState = (state: any) => {
    if (!state?.dashboardView) {
      return;
    }
    setView(state.dashboardView);
    if (state.cashFlowView !== undefined) {
      setCashFlowView(state.cashFlowView);
    }
    if (state.customChartView !== undefined) {
      setCustomChartView(state.customChartView);
    }
    if (state.selectedChartId !== undefined) {
      setSelectedChartId(state.selectedChartId);
    }
    if (state.chartToViewId !== undefined) {
      setChartToViewId(state.chartToViewId);
    }
  };

  const openDashboardView = (dashboardView: any, extraState = {}, options: any = {}) => {
    const closeWalkthroughModal = options.closeWalkthroughModal ?? true;
    const nextState = { ...(location.state || {}), dashboardView, ...extraState };
    navigate("/app", { state: nextState });
    if (location.pathname === "/app") {
      applyDashboardState(nextState);
    }
    handleNavSelection({ closeWalkthroughModal });
  };

  const wizardCards = [
    { key: "profile", title: "📋 Setup Profile", description: "Enter your personal info and tax filing status" },
    { key: "categories", title: "🏷️ Setup Categories", description: "Organize your financial categories" },
    { key: "accounts", title: "🏦 Setup Accounts", description: "Add your financial institution accounts" },
    { key: "assets", title: "💰 Setup Assets", description: "Add your assets (bank accounts, real estate, etc.)" },
    { key: "liabilities", title: "📉 Setup Liabilities", description: "Add your debts (loans, credit cards, etc.)" },
    { key: "income", title: "💵 Setup Income", description: "Add your income (salary, interest, etc.)" },
    { key: "expenses", title: "💸 Setup Expenses", description: "Add your expenses (housing, food, fuel, etc.)" },
    { key: "automatic-transfers", title: "🔄 Setup Automatic Transfers", description: "Set up automatic transfers between accounts" },
  ];

  return (
    <div className={`sidebar-layout ${isMobile ? "sidebar-layout--mobile" : ""}`}>
      {isMobile && isSidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)} />
      )}
      {isMobile && !isSidebarOpen && (
        <button
          type="button"
          className="mobile-menu-hint"
          onClick={() => setIsSidebarOpen(true)}
        >
          ☰ Menu
        </button>
      )}
      <aside
        className={`sidebar ${isMobile ? "sidebar--mobile" : ""} ${isSidebarOpen ? "sidebar--open" : "sidebar--closed"}`}
        ref={sidebarRef}
        style={!isMobile ? { width: `${sidebarWidth}px` } : undefined}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div 
          className="sidebar-resize-handle"
          onMouseDown={handleMouseDown}
        />
        <nav className="sidebar-nav">
          <section className="nav-section">
            <h3>MY DATA</h3>
            <NavLink
              to="/app"
              className={() => `nav-btn ${view === 'new-home' ? 'active' : ''}`}
              onClick={(e: any) => {
                e.preventDefault();
                openDashboardView('new-home', {
                  cashFlowView: null,
                  customChartView: null,
                  selectedChartId: null,
                  chartToViewId: null,
                });
              }}
            >
              Home
            </NavLink>
            <button
              className={`nav-btn ${view === 'walkthrough' ? 'active' : ''}`}
              onClick={() => {
                setView('walkthrough');
                setIsWalkthroughModalOpen(true);
                openDashboardView('walkthrough');
                handleNavSelection({ closeWalkthroughModal: false });
              }}
            >
              Walkthrough
            </button>
            <NavLink
              to="/documents"
              className={({ isActive }) => `nav-btn ${isActive ? 'active' : ''}`}
              onClick={handleDocumentVaultNav}
              data-tour-id="nav-document-vault"
            >
              Document Vault
            </NavLink>
            <NavLink
              to="/accounts"
              className={({ isActive }) => `nav-btn ${isActive ? 'active' : ''}`}
              onClick={handleNavSelection}
              data-tour-id="nav-accounts"
            >
              Accounts
            </NavLink>
            <NavLink
              to="/categories"
              className={({ isActive }) => `nav-btn ${isActive || view === 'settings-categories' ? 'active' : ''}`}
              onClick={handleNavSelection}
            >
              Categories
            </NavLink>
            <NavLink
              to="/assets"
              className={({ isActive }) => `nav-btn ${isActive ? 'active' : ''}`}
              onClick={handleNavSelection}
              data-tour-id="nav-assets"
            >
              Assets
            </NavLink>
            <NavLink
              to="/liabilities"
              className={({ isActive }) => `nav-btn ${isActive ? 'active' : ''}`}
              onClick={handleNavSelection}
              data-tour-id="nav-liabilities"
            >
              Liabilities / Debts
            </NavLink>
            <NavLink
              to="/cashflow/income"
              className={({ isActive }) => `nav-btn ${isActive ? 'active' : ''}`}
              onClick={handleNavSelection}
              data-tour-id="nav-income"
            >
              Income
            </NavLink>
            <NavLink
              to="/cashflow/expense"
              className={({ isActive }) => `nav-btn ${isActive ? 'active' : ''}`}
              onClick={handleNavSelection}
              data-tour-id="nav-expenses"
            >
              Expenses
            </NavLink>
            <NavLink
              to="/automatic-transfers"
              className={({ isActive }) => `nav-btn ${isActive ? 'active' : ''}`}
              onClick={handleNavSelection}
              data-tour-id="nav-automatic-transfers"
            >
              Automatic Transfers
            </NavLink>
            <button
              className={`nav-btn ${view === 'cash-handling' ? 'active' : ''}`}
              onClick={() => openDashboardView('cash-handling')}
              data-tour-id="nav-cash-handling"
            >
              Cash Handling
            </button>
            <NavLink
              to="/settings/tax-handling"
              className={({ isActive }) => `nav-btn ${isActive || view === 'settings-tax-handling' ? 'active' : ''}`}
              onClick={handleNavSelection}
              data-tour-id="nav-tax-handling"
            >
              Tax Handling
            </NavLink>
          </section>

          <section className="nav-section">
            <h3>DASHBOARD</h3>
            <button
              className={`nav-btn ${view === 'balance-sheet-projection' ? 'active' : ''}`}
              onClick={() => openDashboardView('balance-sheet-projection', { cashFlowView: null })}
              data-tour-id="nav-net-worth"
            >
              Net Worth
            </button>
            
            <button
              className={`nav-btn ${view === 'cashflow-projection' ? 'active' : ''}`}
              onClick={() => openDashboardView('cashflow-projection', { cashFlowView: null })}
              data-tour-id="nav-cash-flow"
            >
              Cash Flow
            </button>
            <button
              className={`nav-btn ${view === 'monte-carlo' ? 'active' : ''}`}
              onClick={() => openDashboardView('monte-carlo', { cashFlowView: null })}
            >
              Monte Carlo
            </button>
            <button 
              className={`nav-btn ${view === 'custom-charts' && customChartView === 'list' ? 'active' : ''}`} 
              onClick={() => openDashboardView('custom-charts', { customChartView: 'list', selectedChartId: null, chartToViewId: null })}
              data-tour-id="nav-custom-charts"
            >
              Custom
            </button>
            <button 
              className={`nav-btn ${view === 'what-if' ? 'active' : ''}`} 
              onClick={() => openDashboardView('what-if', { cashFlowView: null })}
              data-tour-id="nav-what-if"
            >
              What If?
            </button>
          </section>
        </nav>
      </aside>

      <main className="main-content">
        {loading && (
          <div style={{ padding: '20px' }}>
            <SkeletonList count={6} />
          </div>
        )}
        
        {!loading && view === "documents" && (
          renderMuiPageShell(<DocumentVaultPage hideSidebar={true} />)
        )}

        {!loading && view === "settings-admin-document-vault-defaults" && (
          renderMuiPageShell(<DocumentVaultPage hideSidebar={true} initialTab="defaults" adminPortal={true} />)
        )}

        {!loading && view === "accounts" && (
          renderMuiPageShell(<AccountsSettingsPage />)
        )}

        {!loading && view === "automatic-transfers" && (
          renderMuiPageShell(<AutoDisbursementSettingsPage />)
        )}

        {!loading && view === "cash-handling" && (
          renderMuiPageShell(<CashHandlingPage />)
        )}

        {/* Settings Pages */}
        {!loading && view === "settings-categories" && (
          renderMuiPageShell(<CategorySettingsPage />)
        )}

        {!loading && view === "settings-profile" && (
          renderMuiPageShell(<ProfileSettingsPage />)
        )}

        {!loading && view === "settings-tax-handling" && (
          renderMuiPageShell(<TaxHandlingPage />)
        )}

        {!loading && view === "settings-application" && (
          renderMuiPageShell(<ApplicationSettingsPage />)
        )}

        {!loading && view === "settings-authorized-users" && (
          renderMuiPageShell(<AuthorizedUsersPage />)
        )}

        {!loading && view === "settings-export-import" && (
          renderMuiPageShell(<ExportImportPage />)
        )}

        {!loading && view === "settings-refer-a-friend" && (
          renderMuiPageShell(<ReferAFriendPage />)
        )}

        {!loading && view === "settings-help" && (
          renderMuiPageShell(<HelpPage />)
        )}

        {!loading && view === "settings-about" && (
          renderMuiPageShell(<AboutPage />)
        )}

        {!loading && view === "settings-account-switcher" && (
          renderMuiPageShell(<AccountSwitcherPage />)
        )}

        {!loading && view === "settings-admin-users" && (
          renderMuiPageShell(<UserManagementPage />)
        )}

        {!loading && view === "settings-admin-global-categories" && (
          renderMuiPageShell(<DefaultCategoriesPage />)
        )}

        {!loading && view === "settings-admin-default-folders" && (
          renderMuiPageShell(<DefaultFoldersPage />)
        )}

        {!loading && (view === "new-home" || view === null || view === undefined) && (location.pathname === "/app" || location.pathname === "/") && (
          <div className="dashboard-home-screen">

{/* removing Dashboard Welcome Screen until we have a better way to present it */}

{/*}            <motion.div 
              className="dashboard-welcome"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <h2>Dashboard</h2>
              <p>Quick snapshot of your financial model and projection confidence.</p>
              <button
                type="button"
                className="btn-primary-modern dashboard-walkthrough-btn"
                onClick={() => {
                  setView('walkthrough');
                  setIsWalkthroughModalOpen(true);
                }}
              >
                Open Walkthrough
              </button>
            </motion.div>
            */}
            <div className="dashboard-kpi-grid">
              <div className="metric-card metric-card--kpi">
                <div className="metric-title">Net Worth</div>
                <div className="metric-value">{formatCurrency(netWorth)}</div>
              </div>
              <div className="metric-card metric-card--kpi">
                <div className="metric-title">Assets</div>
                <div className="metric-value">{formatCurrency(totalAssets)}</div>
              </div>
              <div className="metric-card metric-card--kpi">
                <div className="metric-title">Liabilities</div>
                <div className="metric-value">{formatCurrency(totalLiabilitiesValue)}</div>
              </div>
              <div className="metric-card metric-card--kpi">
                <div className="metric-title">Current Year Surplus / Deficit</div>
                <div className={`metric-value ${currentYearSurplusDeficit >= 0 ? "metric-value--positive" : "metric-value--negative"}`}>
                  {formatCurrency(currentYearSurplusDeficit)}
                </div>
              </div>
            </div>
              <div className="dashboard-insight-grid">
              <div className="metric-card metric-card--chart metric-card--asset-pair">
                <div className="metric-title">Asset Allocation</div>
                <div className="asset-pair-charts">
                  {assetCharts.map((chart: any) => (
                    <div className="asset-pair-chart" key={chart.key}>
                      <div className="metric-subtext">{chart.label}</div>
                      <div className="metric-chart metric-chart--small metric-chart--donut">
                        {chart.data ? (
                          <Doughnut data={chart.data} options={doughnutOptions} />
                        ) : (
                          <div className="metric-empty-text">{chart.emptyText}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="metric-card metric-card--kpi metric-card--scenario">
                <div className="metric-title">Retirement Confidence Scenario</div>
                <div className="scenario-header-row">
                  <div className="scenario-through">
                    <label htmlFor="project-through-input">Run Projection through</label>
                    <div className="scenario-through-controls">
                      <input
                        id="project-through-input"
                        type="number"
                        min={currentYear + 1}
                        max={currentYear + (subscriptionLimits?.is_limited ? subscriptionLimits.max_projection_years : 50)}
                        value={projectThroughYear}
                        onChange={(e: any) => handleProjectThroughYearChange(Number(e.target.value))}
                      />
                      <span>{homeProjectionYears} years</span>
                    </div>
                  </div>
                  <div className="scenario-market">
                    <label htmlFor="market-variability-input" className="market-label">Market Variability</label>
                    <input
                      id="market-variability-input"
                      type="number"
                      min={1}
                      max={80}
                      step={1}
                      value={marketVariability}
                      onChange={(e: any) => setMarketVariability(Number(e.target.value))}
                    />
                  </div>
                </div>
                <div className="scenario-slider-group">
                  <label htmlFor="desired-networth-slider">
                    Desired Net Worth at end of period
                  </label>
                  <div className="scenario-input-row">
                    <input
                      id="desired-networth-slider"
                      type="range"
                      min={1}
                      max={50000000}
                      value={desiredNetWorthTarget}
                      onChange={(e: any) => setDesiredNetWorthTarget(Number(e.target.value))}
                    />
                    <span className="scenario-input-value">
                      <strong>{formatCurrency(desiredNetWorthTarget)}</strong>
                    </span>
                  </div>
                </div>
                <div className="scenario-results-grid">
                  <div>
                    <div className="metric-subtext tooltip-label tooltip-label--confidence">
                      <button
                        type="button"
                        className="tooltip-trigger tooltip-trigger--inline"
                        onClick={(event: any) => toggleTooltip("projection", event)}
                      >
                        <span className="tooltip-icon" />
                      </button>
{/*}                      <span>Confidence Net Worth {`>`} {formatCurrency(desiredNetWorthTarget)}</span> */}
                      <span className="scenario-confidence-label">Confidence Level</span>
                      <span className="metric-value metric-value--inline">
                        {dashboardSimulation.confidenceAboveTarget == null ? "Calculating..." : `${dashboardSimulation.confidenceAboveTarget.toFixed(1)}%`}
                      </span>
                      {activeTooltip === "projection" && (
                        <div
                          className="tooltip-popup"
                          style={{ top: tooltipPosition.top, left: tooltipPosition.left }}
                          onClick={(e: any) => e.stopPropagation()}
                        >
                          {tooltipTexts.projection}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          <div className="dashboard-metrics">
              <div className="metric-card metric-card--chart">
                <div className="metric-link">
                  <NavLink
                    to="/app"
                    className="metric-link-anchor"
                    onClick={(e: any) => {
                      e.preventDefault();
                      openDashboardView('balance-sheet-projection', { cashFlowView: null });
                    }}
                  >
                    View Net Worth Projection →
                  </NavLink>
                </div>
                <div className="metric-title">Net Worth</div>
                <div className="metric-chart">
                  <BalanceSheetProjection
                    assets={assets}
                    liabilities={liabilities}
                    incomeItems={incomeItems}
                    expenseItems={expenseItems}
                    projectionYears={projectionYears}
                    formatCurrency={formatCurrency}
                    showChartTotals={showChartTotals}
                    compact
                    onProjectionYearsChange={handleProjectionYearsChange}
                    maxProjectionYears={maxProjectionYears}
                  />
                </div>
                <div className="metric-summary">
                  <div className="metric-value">{formatCurrency(netWorth)}</div>
                </div>
              </div>
              <div className="metric-card metric-card--chart">
                <div className="metric-link">
                  <NavLink
                    to="/app"
                    className="metric-link-anchor"
                    onClick={(e: any) => {
                      e.preventDefault();
                      openDashboardView('cashflow-projection', { cashFlowView: null });
                    }}
                  >
                    View Cash Flow Projection →
                  </NavLink>
                </div>
                <div className="metric-title">Cash Flow</div>
                <div className="metric-chart">
                  <CashFlowOverview
                    incomeItems={incomeItems}
                    expenseItems={expenseItems}
                    projectionYears={projectionYears}
                    formatCurrency={formatCurrency}
                    assets={assets}
                    userSettings={viewingUserSettings || userSettings}
                    autoDisbursements={autoDisbursements}
                    liabilities={liabilities}
                    compact
                  />
                </div>
                <div className="metric-summary">
                  <div className="metric-value">{formatCurrency(cashFlowNet)}</div>
                  <div className="metric-subtext">Income {formatCurrency(totalIncome)} · Expenses {formatCurrency(totalExpenses)}</div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Wizard Modals */}
        <ProfileSetupWizard
          isOpen={wizardOpen === 'profile'}
          onClose={() => setWizardOpen(null)}
          onComplete={() => {
            refreshAllData();
            setWizardOpen(null);
          }}
        />
        <CategoriesSetupWizard
          isOpen={wizardOpen === 'categories'}
          onClose={() => setWizardOpen(null)}
          onComplete={() => {
            refreshAllData();
            setWizardOpen(null);
          }}
        />
        <AccountsSetupWizard
          isOpen={wizardOpen === 'accounts'}
          onClose={() => setWizardOpen(null)}
          onComplete={() => {
            refreshAllData();
            setWizardOpen(null);
          }}
        />
        <AutomaticTransfersSetupWizard
          isOpen={wizardOpen === 'automatic-transfers'}
          onClose={() => setWizardOpen(null)}
          onComplete={() => {
            refreshAllData();
            setWizardOpen(null);
          }}
        />
        <AssetsSetupWizard
          isOpen={wizardOpen === 'assets'}
          onClose={() => setWizardOpen(null)}
          onComplete={() => {
            refreshAllData();
            setWizardOpen(null);
          }}
        />
        <LiabilitiesSetupWizard
          isOpen={wizardOpen === 'liabilities'}
          onClose={() => setWizardOpen(null)}
          onComplete={() => {
            refreshAllData();
            setWizardOpen(null);
          }}
        />
        <IncomeSetupWizard
          isOpen={wizardOpen === 'income'}
          onClose={() => setWizardOpen(null)}
          onComplete={() => {
            refreshAllData();
            setWizardOpen(null);
          }}
        />
        <ExpensesSetupWizard
          isOpen={wizardOpen === 'expenses'}
          onClose={() => setWizardOpen(null)}
          onComplete={() => {
            refreshAllData();
            setWizardOpen(null);
          }}
        />

        {/* Projection Detail might still be needed if accessed directly or via a new component */}
        {!loading && view === "detail" && selectedProjectionId && (
          renderMuiPageShell(
            <div className="projection-detail">
              <h2>Projection Detail</h2>
              <ProjectionDetail 
                projectionId={selectedProjectionId} 
                onEdit={() => {}}
                onDelete={() => {}}
              />
            </div>
          )
        )}

        {!loading && view === "balance-sheet-projection" && (
          renderMuiPageShell(
            <div className="balance-sheet-projection-wrapper">
              <BalanceSheetProjection 
                assets={assets}
                liabilities={liabilities}
                incomeItems={incomeItems}
                expenseItems={expenseItems}
                projectionYears={projectionYearsOverride ?? projectionYears}
                formatCurrency={formatCurrency}
                showChartTotals={showChartTotals}
                showProjectionYearSelector
                onProjectionYearsChange={handleProjectionYearsChange}
                maxProjectionYears={maxProjectionYears}
                isLimitedPlan={isLimitedPlan}
              />
            </div>
          )
        )}

        {!loading && view === "cashflow-projection" && (
          renderMuiPageShell(
            <div className="cashflow-overview-wrapper">
              <CashFlowOverview
                incomeItems={incomeItems}
                expenseItems={expenseItems}
                projectionYears={projectionYearsOverride ?? projectionYears}
                formatCurrency={formatCurrency}
                assets={assets}
              userSettings={viewingUserSettings || userSettings}
                autoDisbursements={autoDisbursements}
                liabilities={liabilities}
                showProjectionYearSelector
                onProjectionYearsChange={handleProjectionYearsChange}
                maxProjectionYears={maxProjectionYears}
                isLimitedPlan={isLimitedPlan}
              />
            </div>
          )
        )}

        {!loading && view === "monte-carlo" && (
          renderMuiPageShell(
            <div className="monte-carlo-wrapper">
              <MonteCarloProjections
                incomeItems={incomeItems}
                expenseItems={expenseItems}
                assets={assets}
                liabilities={liabilities}
                projectionYears={projectionYearsOverride ?? projectionYears}
                formatCurrency={formatCurrency}
                showProjectionYearSelector
                onProjectionYearsChange={handleProjectionYearsChange}
                maxProjectionYears={maxProjectionYears}
                isLimitedPlan={isLimitedPlan}
              />
            </div>
          )
        )}

        {!loading && view === "assets" && (
          renderMuiPageShell(
            <div className="assets-view">
              <AssetView 
                assets={assets}
                refreshAssets={refreshAssets}
                refreshCashflow={refreshCashflow}
                accounts={accounts}
                validCategories={viewingUserId && viewingUserId !== currentUser?.id ? assetCategories : ((typedUserSettings?.asset_categories || []) as string[])}
              />
            </div>
          )
        )}
        {!loading && view === "liabilities" && (
          renderMuiPageShell(
            <div className="liabilities-view">
              <LiabilityView 
                liabilities={liabilities}
                refreshLiabilities={refreshLiabilities}
                refreshCashflow={refreshCashflow}
              />
            </div>
          )
        )}

        {!loading && view === "cashflow" && (
          renderMuiPageShell(
            <div className="cashflow-view">
              <CashFlowView 
                key={`cashflow-${cashFlowView}-${expenseCategories.join(',')}-${incomeCategories.join(',')}-${expenseItems.length}-${incomeItems.length}`}
                type={cashFlowView}
                incomeItems={incomeItems}
                expenseItems={expenseItems}
                refreshCashflow={refreshCashflow}
                validCategories={
                  viewingUserId && viewingUserId !== currentUser?.id 
                    ? (cashFlowView === 'expense' ? expenseCategories : incomeCategories)
                    : (cashFlowView === 'expense'
                      ? ((typedUserSettings?.expense_categories || []) as any[])
                      : ((typedUserSettings?.income_categories || []) as any[]))
                }
                assets={assets}
                autoDisbursements={autoDisbursements}
              />
            </div>
          )
        )}


        {!loading && view === "custom-charts" && customChartView === "list" && (
          renderMuiPageShell(
            <div className="custom-charts-list">
              <CustomChartList onEditChart={handleEditChart} onCreateNewChart={handleCreateNewChart} onViewChart={handleViewChart} />
            </div>
          )
        )}

        {!loading && view === "custom-charts" && (customChartView === "create" || customChartView === "edit") && (
          renderMuiPageShell(
            <div className="custom-charts-form">
              <CustomChartForm 
                chartId={selectedChartId} 
                onChartSaved={() => { setView('custom-charts'); setCustomChartView('list'); refreshAllData(); }}
                onCancel={() => { setView('custom-charts'); setCustomChartView('list'); }}
                assets={assets}
                liabilities={liabilities}
                incomeItems={incomeItems}
                expenseItems={expenseItems}
                projectionYears={projectionYears}
                assetCategories={assetCategories}
                liabilityCategories={liabilityCategories}
                incomeCategories={incomeCategories}
                expenseCategories={expenseCategories}
                accounts={accounts}
              />
            </div>
          )
        )}

        {!loading && view === "custom-charts" && customChartView === "view" && chartToViewId && (
          renderMuiPageShell(
            <div className="custom-charts-view">
              <CustomChartView 
                chartId={chartToViewId}
                assets={assets}
                liabilities={liabilities}
                incomeItems={incomeItems}
                expenseItems={expenseItems}
                projectionYears={projectionYearsOverride ?? projectionYears}
                formatCurrency={formatCurrency}
                onBack={() => { setView('custom-charts'); setCustomChartView('list'); setChartToViewId(null); }}
                onEdit={handleEditChart}
                showProjectionYearSelector
                onProjectionYearsChange={handleProjectionYearsChange}
                maxProjectionYears={maxProjectionYears}
                isLimitedPlan={isLimitedPlan}
              />
            </div>
          )
        )}

        {!loading && view === "what-if" && (
          renderMuiPageShell(<WhatIfPage />)
        )}

        {!loading && view === "walkthrough" && (
          renderMuiPageShell(
            <div className="walkthrough-page-shell">
              <h2>Walkthrough</h2>
              <p>Use the guided setup wizards to initialize your model quickly.</p>
              <button
                type="button"
                className="btn-primary-modern"
                onClick={() => setIsWalkthroughModalOpen(true)}
              >
                Open Walkthrough Modal
              </button>
            </div>
          )
        )}
      </main>
      {isWalkthroughModalOpen && (
        <div
          className="walkthrough-modal-overlay"
          style={walkthroughOverlayStyle}
          onClick={() => setIsWalkthroughModalOpen(false)}
        >
          <div className="walkthrough-modal-card" onClick={(e: any) => e.stopPropagation()}>
            <div className="walkthrough-modal-header">
              <h3>Walkthrough Wizards</h3>
              <button type="button" className="walkthrough-modal-close" onClick={() => setIsWalkthroughModalOpen(false)}>✕</button>
            </div>
            <p className="walk-me-through-description">
              New to Model My Retirement? Follow these guided wizards to set up your profile and organize your financial data.
            </p>
            <div className="wizard-cards">
              {wizardCards.map((wizard: any, idx: any) => (
                <motion.div
                  key={wizard.key}
                  className="wizard-card"
                  onClick={() => {
                    setIsWalkthroughModalOpen(false);
                    setWizardOpen(wizard.key);
                  }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22, delay: idx * 0.03 }}
                >
                  <h4>{wizard.title}</h4>
                  <p>{wizard.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      )}
      <ChangePasswordModal 
        isOpen={showPasswordChangeModal}
        onClose={async () => {
          // Only allow closing if password has been changed (must_change_password is false)
          // Refresh user data first to get the latest must_change_password flag
          try {
            const updatedUser = await AuthService.getCurrentUser();
            if (updatedUser && !updatedUser.must_change_password) {
              setShowPasswordChangeModal(false);
              // Refresh AuthContext to update currentUser
              await login();
            }
          } catch (error: any) {
            // If we can't check, assume password was changed
            setShowPasswordChangeModal(false);
          }
        }}
        requireChange={currentUser?.must_change_password || false}
      />
    </div>
  );
}
