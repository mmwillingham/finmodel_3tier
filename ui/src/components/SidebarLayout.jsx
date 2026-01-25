import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { useLocation, useNavigate, NavLink } from "react-router-dom";
import CashFlowService from "../services/cashflow.service";
import AssetService from "../services/asset.service";
import LiabilityService from "../services/liability.service";
import AccountService from "../services/account.service";
import AuthService from "../services/auth.service";
import { useAuth } from "../context/AuthContext.jsx";
import { SkeletonList } from "./Skeleton";
import ProjectionDetail from "./ProjectionDetail.jsx";
import CashFlowView from "./CashFlowView";
import AssetView from "./AssetView";
import LiabilityView from "./LiabilityView";
import BalanceSheetProjection from "./BalanceSheetProjection";
import CashFlowOverview from "./CashFlowOverview";
import "./SidebarLayout.css";
import SettingsService from "../services/settings.service";
import { useSettingsContext } from "../context/SettingsContext.jsx";
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
import DocumentsPage from "../pages/DocumentsPage";
import CashHandlingPage from "../pages/CashHandlingPage";
import ChangePasswordModal from "./ChangePasswordModal";
import CategorySettingsPage from "../pages/CategorySettingsPage";
import ProfileSettingsPage from "../pages/ProfileSettingsPage";
import ApplicationSettingsPage from "../pages/ApplicationSettingsPage";
import UserManagementPage from "../pages/UserManagementPage";
import DefaultCategoriesPage from "../pages/DefaultCategoriesPage";
import HelpPage from "../pages/HelpPage";
import AboutPage from "../pages/AboutPage";
import ExportImportPage from "../pages/ExportImportPage";
import ReferAFriendPage from "../pages/ReferAFriendPage";
import AuthorizedUsersPage from "../pages/AuthorizedUsersPage";
import AccountSwitcherPage from "../pages/AccountSwitcherPage";
import WhatIfPage from "../pages/WhatIfPage";

export default function SidebarLayout() {
  const MOBILE_BREAKPOINT = 768;
  const { viewingUserId, userSettings, currentUser, login } = useAuth();
  const { settings } = useSettingsContext();
  const location = useLocation();
  const navigate = useNavigate();
  const [view, setView] = useState("new-home"); // Default to home view
  const [cashFlowView, setCashFlowView] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedProjectionId] = useState(null);
  const [incomeItems, setIncomeItems] = useState([]);
  const [expenseItems, setExpenseItems] = useState([]);
  const [assets, setAssets] = useState([]);
  const [liabilities, setLiabilities] = useState([]);
  const [assetCategories, setAssetCategories] = useState([]);
  const [liabilityCategories, setLiabilityCategories] = useState([]);
  const [incomeCategories, setIncomeCategories] = useState([]);
  const [expenseCategories, setExpenseCategories] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [autoDisbursements, setAutoDisbursements] = useState([]); // NEW: For cash flow transfers
  const [projectionYears, setProjectionYears] = useState(20);
  const [projectionYearsOverride, setProjectionYearsOverride] = useState(null);
  const [subscriptionLimits, setSubscriptionLimits] = useState(null);
  const [showChartTotals, setShowChartTotals] = useState(true);
  const [customChartView, setCustomChartView] = useState(null);
  const [selectedChartId, setSelectedChartId] = useState(null);
  const [chartToViewId, setChartToViewId] = useState(null);
  const [wizardOpen, setWizardOpen] = useState(null); // 'profile', 'categories', 'accounts', or null
  const [showPasswordChangeModal, setShowPasswordChangeModal] = useState(false);
  const [viewingUserSettings, setViewingUserSettings] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const totalAssets = assets.reduce((sum, asset) => sum + (asset.value || 0), 0);
  const totalLiabilitiesValue = liabilities.reduce((sum, liability) => sum + ((liability.value || liability.principal_amount) || 0), 0);
  const netWorth = totalAssets - totalLiabilitiesValue;
  const totalIncome = incomeItems.reduce((sum, item) => sum + (item.yearly_value || 0), 0);
  const totalExpenses = expenseItems.reduce((sum, item) => sum + (item.yearly_value || 0), 0);
  const cashFlowNet = totalIncome - totalExpenses;
  const netWorthPercent = totalAssets ? Math.min(100, Math.max(0, (netWorth / totalAssets) * 100)) : 0;
  const expenseRatio = totalIncome ? Math.min(100, Math.max(0, (totalExpenses / totalIncome) * 100)) : 0;

  const loadViewingUserSettings = useCallback(async () => {
    if (!viewingUserId) {
      setViewingUserSettings(null);
      return;
    }

    try {
      const response = await SettingsService.getSettings(viewingUserId);
      setViewingUserSettings(response.data);
    } catch (error) {
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
      } catch (error) {
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
      setIsSidebarOpen((prev) => !prev);
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
    const handleEdgeTouchStart = (e) => {
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

    const handleEdgeTouchMove = (e) => {
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

  const handleProjectionYearsChange = (value) => {
    const maxYears = subscriptionLimits?.is_limited ? subscriptionLimits.max_projection_years : null;
    const nextValue = maxYears != null ? Math.min(value, maxYears) : value;
    setProjectionYearsOverride(nextValue);
  };

  const maxProjectionYears = subscriptionLimits?.is_limited ? subscriptionLimits.max_projection_years : null;
  const isLimitedPlan = Boolean(subscriptionLimits?.is_limited);

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
        AccountService.getAllAccounts(viewingUserId).catch(() => []), // Don't fail if accounts endpoint doesn't exist yet
        AutoDisbursementService.getAllAutoDisbursements(viewingUserId).catch(() => []), // NEW: Load auto-disbursements
      ]);

      setIncomeItems(inc.data || []);
      setExpenseItems(exp.data || []);
      setAssets(ast.data || []);
      setLiabilities(lib.data || []);
      setAccounts(accs || []);
      setAutoDisbursements(autoDisburs || []); // NEW: Set auto-disbursements

      const uniqueAssetCategories = [...new Set(ast.data.map(item => item.category))].filter(Boolean);
      setAssetCategories(uniqueAssetCategories);
      
      const uniqueLiabilityCategories = [...new Set(lib.data.map(item => item.category || ''))];
      setLiabilityCategories(uniqueLiabilityCategories);
      
      const uniqueIncomeCategories = [...new Set(inc.data.map(item => item.category))].filter(Boolean);
      setIncomeCategories(uniqueIncomeCategories);
      
      const uniqueExpenseCategories = [...new Set(exp.data.map(item => item.category))].filter(Boolean);
      setExpenseCategories(uniqueExpenseCategories);

    } catch (e) {
    } finally {
      setLoading(false);
    }
  }, [viewingUserId]);

  // Detect settings routes and update view accordingly
  useEffect(() => {
    const path = location.pathname;
    if (path === '/' || path === '') {
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
    }
  }, [location.pathname]);

  useEffect(() => {
    if (!location.state?.dashboardView) {
      return;
    }
    applyDashboardState(location.state);
    const { dashboardView, cashFlowView, customChartView, selectedChartId, chartToViewId, ...restState } = location.state;
    navigate(location.pathname, { replace: true, state: restState });
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

  const formatCurrency = (v) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(v ?? 0);

    const refreshCashflow = async () => {
    if (!loading) setLoading(true);
    const [inc, exp] = await Promise.all([
      CashFlowService.list(true, viewingUserId),
      CashFlowService.list(false, viewingUserId),
    ]);
    setIncomeItems(inc.data || []);
    setExpenseItems(exp.data || []);
    
    const uniqueIncomeCategories = [...new Set((inc.data || []).map(item => item.category))].filter(Boolean);
    setIncomeCategories(uniqueIncomeCategories);
    
    const uniqueExpenseCategories = [...new Set((exp.data || []).map(item => item.category))].filter(Boolean);
    setExpenseCategories(uniqueExpenseCategories);

    setLoading(false);
  };

  const refreshAssets = async () => {
    if (!loading) setLoading(true);
    const ast = await AssetService.list(viewingUserId);
    setAssets(ast.data || []);
    
    const uniqueAssetCategories = [...new Set((ast.data || []).map(item => item.category))].filter(Boolean);
    setAssetCategories(uniqueAssetCategories);
    
    setLoading(false);
  };

  const refreshLiabilities = async () => {
    if (!loading) setLoading(true);
    const lib = await LiabilityService.list(viewingUserId);
    setLiabilities(lib.data || []);
    
    const uniqueLiabilityCategories = [...new Set((lib.data || []).map(item => item.category || ''))];
    setLiabilityCategories(uniqueLiabilityCategories);
    
    setLoading(false);
  };

  const handleEditChart = useCallback((chartId) => {
    setView('custom-charts');
    setCustomChartView('edit');
    setSelectedChartId(chartId);
  }, []);

  const handleCreateNewChart = useCallback(() => {
    setView('custom-charts');
    setCustomChartView('create');
    setSelectedChartId(null);
  }, []);

  const handleViewChart = useCallback((chartId) => {
    setView('custom-charts');
    setCustomChartView('view');
    setChartToViewId(chartId);
  }, []);

  const [sidebarWidth, setSidebarWidth] = useState(250);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef(null);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);
  const touchStartXRef = useRef(null);
  const touchCurrentXRef = useRef(null);

  const handleMouseDown = (e) => {
    if (!sidebarRef.current) return;
    setIsResizing(true);
    startXRef.current = e.clientX;
    startWidthRef.current = sidebarRef.current.offsetWidth;
    e.preventDefault();
    e.stopPropagation();
  };

  const handleTouchStart = (e) => {
    if (!isMobile || !isSidebarOpen) {
      return;
    }
    const touch = e.touches[0];
    touchStartXRef.current = touch.clientX;
    touchCurrentXRef.current = touch.clientX;
  };

  const handleTouchMove = (e) => {
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
    const handleMouseMove = (e) => {
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

  const handleNavSelection = () => {
    if (isMobile) {
      setIsSidebarOpen(false);
    }
  };

  const applyDashboardState = (state) => {
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

  const openDashboardView = (dashboardView, extraState = {}) => {
    const nextState = { ...(location.state || {}), dashboardView, ...extraState };
    navigate("/", { state: nextState });
    if (location.pathname === "/") {
      applyDashboardState(nextState);
    }
    handleNavSelection();
  };

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
              to="/"
              className={() => `nav-btn ${view === 'new-home' ? 'active' : ''}`}
              onClick={handleNavSelection}
            >
              Home
            </NavLink>
            <NavLink
              to="/documents"
              className={({ isActive }) => `nav-btn ${isActive ? 'active' : ''}`}
              onClick={handleNavSelection}
            >
              Document Vault
            </NavLink>
            <NavLink
              to="/accounts"
              className={({ isActive }) => `nav-btn ${isActive ? 'active' : ''}`}
              onClick={handleNavSelection}
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
            >
              Assets
            </NavLink>
            <NavLink
              to="/liabilities"
              className={({ isActive }) => `nav-btn ${isActive ? 'active' : ''}`}
              onClick={handleNavSelection}
            >
              Liabilities / Debts
            </NavLink>
            <NavLink
              to="/cashflow/income"
              className={({ isActive }) => `nav-btn ${isActive ? 'active' : ''}`}
              onClick={handleNavSelection}
            >
              Income
            </NavLink>
            <NavLink
              to="/cashflow/expense"
              className={({ isActive }) => `nav-btn ${isActive ? 'active' : ''}`}
              onClick={handleNavSelection}
            >
              Expenses
            </NavLink>
            <NavLink
              to="/automatic-transfers"
              className={({ isActive }) => `nav-btn ${isActive ? 'active' : ''}`}
              onClick={handleNavSelection}
            >
              Automatic Transfers
            </NavLink>
            <button
              className={`nav-btn ${view === 'cash-handling' ? 'active' : ''}`}
              onClick={() => openDashboardView('cash-handling')}
            >
              Cash Handling
            </button>
          </section>

          <section className="nav-section">
            <h3>DASHBOARD</h3>
            <button
              className={`nav-btn ${view === 'balance-sheet-projection' ? 'active' : ''}`}
              onClick={() => openDashboardView('balance-sheet-projection', { cashFlowView: null })}
            >
              Net Worth
            </button>
            
            <button
              className={`nav-btn ${view === 'cashflow-projection' ? 'active' : ''}`}
              onClick={() => openDashboardView('cashflow-projection', { cashFlowView: null })}
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
            >
              Custom
            </button>
            <button 
              className={`nav-btn ${view === 'what-if' ? 'active' : ''}`} 
              onClick={() => openDashboardView('what-if', { cashFlowView: null })}
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
          <DocumentsPage hideSidebar={true} />
        )}

        {!loading && view === "accounts" && (
          <AccountsSettingsPage />
        )}

        {!loading && view === "automatic-transfers" && (
          <AutoDisbursementSettingsPage />
        )}

        {!loading && view === "cash-handling" && (
          <CashHandlingPage />
        )}

        {/* Settings Pages */}
        {!loading && (location.pathname.startsWith("/settings/categories") || location.pathname === "/categories") && (
          <CategorySettingsPage />
        )}

        {!loading && view === "settings-profile" && (
          <ProfileSettingsPage />
        )}

        {!loading && view === "settings-application" && (
          <ApplicationSettingsPage />
        )}

        {!loading && view === "settings-authorized-users" && (
          <AuthorizedUsersPage />
        )}

        {!loading && view === "settings-export-import" && (
          <ExportImportPage />
        )}

        {!loading && view === "settings-refer-a-friend" && (
          <ReferAFriendPage />
        )}

        {!loading && view === "settings-help" && (
          <HelpPage />
        )}

        {!loading && view === "settings-about" && (
          <AboutPage />
        )}

        {!loading && view === "settings-account-switcher" && (
          <AccountSwitcherPage />
        )}

        {!loading && view === "settings-admin-users" && (
          <UserManagementPage />
        )}

        {!loading && view === "settings-admin-global-categories" && (
          <DefaultCategoriesPage />
        )}

        {!loading && (view === "new-home" || view === null || view === undefined) && location.pathname === "/" && (
          <>
            <motion.div 
              className="dashboard-welcome"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
            <h2>Welcome to Model My Retirement!</h2>
            <p>Use the navigation on the left to explore your financial data.</p>
            
            <motion.div 
              className="walk-me-through-section" 
              style={{ 
                marginTop: '40px', 
                padding: '30px', 
                backgroundColor: '#fff', 
                borderRadius: '12px',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.06)'
              }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              {/*<h3 style={{ marginTop: 0, marginBottom: '20px', color: '#282c34' }}>Walk Me Through</h3> */}
              <p style={{ marginBottom: '25px', color: '#666' }}>
                New to Model My Retirement? Follow these guided wizards to set up your profile and organize your financial data.
              </p>
              
              <div className="wizard-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
                <motion.div 
                  className="wizard-card"
                  onClick={() => setWizardOpen('profile')}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <h4>📋 Setup Profile</h4>
                  <p>Enter your personal info and tax filing status</p>
                </motion.div>
                
                <motion.div 
                  className="wizard-card"
                  onClick={() => setWizardOpen('categories')}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.1 }}
                >
                  <h4>🏷️ Setup Categories</h4>
                  <p>Organize your financial categories</p>
                </motion.div>
                
                <motion.div 
                  className="wizard-card"
                  onClick={() => setWizardOpen('accounts')}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.15 }}
                >
                  <h4>🏦 Setup Accounts</h4>
                  <p>Add your financial institution accounts</p>
                </motion.div>
                
                <motion.div 
                  className="wizard-card"
                  onClick={() => setWizardOpen('assets')}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.2 }}
                >
                  <h4>💰 Setup Assets</h4>
                  <p>Add your assets (bank accounts, real estate, etc.)</p>
                </motion.div>
                
                <motion.div 
                  className="wizard-card"
                  onClick={() => setWizardOpen('liabilities')}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.25 }}
                >
                  <h4>📉 Setup Liabilities</h4>
                  <p>Add your debts (loans, credit cards, etc.)</p>
                </motion.div>
                
                <motion.div 
                  className="wizard-card"
                  onClick={() => setWizardOpen('income')}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.3 }}
                >
                  <h4>💵 Setup Income</h4>
                  <p>Add your income (salary, interest, etc.)</p>
                </motion.div>
                
                <motion.div 
                  className="wizard-card"
                  onClick={() => setWizardOpen('expenses')}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.35 }}
                >
                  <h4>💸 Setup Expenses</h4>
                  <p>Add your expenses (housing, food, fuel, etc.)</p>
                </motion.div>
                
                <motion.div 
                  className="wizard-card"
                  onClick={() => setWizardOpen('automatic-transfers')}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.4 }}
                >
                  <h4>🔄 Setup Automatic Transfers</h4>
                  <p>Set up automatic transfers between accounts</p>
                </motion.div>
              </div>
            </motion.div>
          </motion.div>
          <div className="dashboard-metrics">
              <div className="metric-card metric-card--chart">
                <div className="metric-link">
                  <NavLink to="/balance-sheet-projection" className="metric-link-anchor">
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
                  />
                </div>
                <div className="metric-summary">
                  <div className="metric-value">{formatCurrency(netWorth)}</div>
                </div>
              </div>
              <div className="metric-card metric-card--chart">
                <div className="metric-link">
                  <NavLink to="/cashflow-projection" className="metric-link-anchor">
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
          </>
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
          <div className="projection-detail">
            <h2>Projection Detail</h2>
            <ProjectionDetail 
              projectionId={selectedProjectionId} 
              onBack={() => setView("new-home")}
            />
          </div>
        )}

        {!loading && view === "balance-sheet-projection" && (
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
        )}

        {!loading && view === "cashflow-projection" && (
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
        )}

        {!loading && view === "monte-carlo" && (
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
        )}

        {!loading && view === "assets" && (
          <div className="assets-view">
            <AssetView 
              assets={assets}
              refreshAssets={refreshAssets}
              refreshCashflow={refreshCashflow}
              accounts={accounts}
              validCategories={viewingUserId && viewingUserId !== currentUser?.id ? assetCategories : (userSettings?.asset_categories || [])}
            />
          </div>
        )}
        {!loading && view === "liabilities" && (
          <div className="liabilities-view">
            <LiabilityView 
              liabilities={liabilities}
              refreshLiabilities={refreshLiabilities}
              refreshCashflow={refreshCashflow}
            />
          </div>
        )}

        {!loading && view === "cashflow" && (
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
                  : (cashFlowView === 'expense' ? (userSettings?.expense_categories || []) : (userSettings?.income_categories || []))
              }
              assets={assets}
            />
          </div>
        )}


        {!loading && view === "custom-charts" && customChartView === "list" && (
          <div className="custom-charts-list">
            <CustomChartList onEditChart={handleEditChart} onCreateNewChart={handleCreateNewChart} onViewChart={handleViewChart} />
          </div>
        )}

        {!loading && view === "custom-charts" && (customChartView === "create" || customChartView === "edit") && (
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
        )}

        {!loading && view === "custom-charts" && customChartView === "view" && chartToViewId && (
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
        )}

        {!loading && view === "what-if" && (
          <WhatIfPage />
        )}
      </main>
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
          } catch (error) {
            // If we can't check, assume password was changed
            setShowPasswordChangeModal(false);
          }
        }}
        requireChange={currentUser?.must_change_password || false}
      />
    </div>
  );
}
