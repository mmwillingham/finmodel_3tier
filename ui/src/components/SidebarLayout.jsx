import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import CashFlowService from "../services/cashflow.service";
import AssetService from "../services/asset.service";
import LiabilityService from "../services/liability.service";
import AccountService from "../services/account.service";
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

export default function SidebarLayout() {
  const { viewingUserId, userSettings } = useAuth();
  const [view, setView] = useState("new-home");
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
  const [projectionYears, setProjectionYears] = useState(30);
  const [showChartTotals, setShowChartTotals] = useState(true);
  const [customChartView, setCustomChartView] = useState(null);
  const [selectedChartId, setSelectedChartId] = useState(null);
  const [chartToViewId, setChartToViewId] = useState(null);
  const [wizardOpen, setWizardOpen] = useState(null); // 'profile', 'categories', 'accounts', or null

  const refreshSettings = useCallback(async () => {
    try {
      const settingsRes = await SettingsService.getSettings();
      setProjectionYears(settingsRes.data.projection_years || 30);
      setShowChartTotals(settingsRes.data.show_chart_totals ?? true);
    } catch (e) {
      console.error("Failed to refresh settings", e);
    }
  }, []);

  const refreshAllData = useCallback(async () => {
    setLoading(true);
    try {
      const [inc, exp, ast, lib, accs, settingsRes, autoDisburs] = await Promise.all([
        CashFlowService.list(true, viewingUserId),
        CashFlowService.list(false, viewingUserId),
        AssetService.list(viewingUserId),
        LiabilityService.list(viewingUserId),
        AccountService.getAllAccounts(viewingUserId).catch(() => []), // Don't fail if accounts endpoint doesn't exist yet
        SettingsService.getSettings(),
        AutoDisbursementService.getAllAutoDisbursements().catch(() => []), // NEW: Load auto-disbursements
      ]);

      setIncomeItems(inc.data || []);
      setExpenseItems(exp.data || []);
      setAssets(ast.data || []);
      setLiabilities(lib.data || []);
      setAccounts(accs || []);
      setAutoDisbursements(autoDisburs || []); // NEW: Set auto-disbursements
      setProjectionYears(settingsRes.data.projection_years || 30);
      setShowChartTotals(settingsRes.data.show_chart_totals ?? true);

      const uniqueAssetCategories = [...new Set(ast.data.map(item => item.category))].filter(Boolean);
      setAssetCategories(uniqueAssetCategories);
      
      const uniqueLiabilityCategories = [...new Set(lib.data.map(item => item.category || ''))];
      setLiabilityCategories(uniqueLiabilityCategories);
      
      const uniqueIncomeCategories = [...new Set(inc.data.map(item => item.category))].filter(Boolean);
      setIncomeCategories(uniqueIncomeCategories);
      
      const uniqueExpenseCategories = [...new Set(exp.data.map(item => item.category))].filter(Boolean);
      setExpenseCategories(uniqueExpenseCategories);

    } catch (e) {
      console.error("Failed to load initial data", e);
    } finally {
      setLoading(false);
    }
  }, [viewingUserId]);

  useEffect(() => {
    const load = async () => {
      try {
      const [inc, exp, ast, lib, accs, settingsRes, autoDisburs] = await Promise.all([
        CashFlowService.list(true, viewingUserId),
        CashFlowService.list(false, viewingUserId),
        AssetService.list(viewingUserId),
        LiabilityService.list(viewingUserId),
        AccountService.getAllAccounts(viewingUserId).catch(() => []), // Don't fail if accounts endpoint doesn't exist yet
        SettingsService.getSettings(),
        AutoDisbursementService.getAllAutoDisbursements().catch(() => []), // NEW: Load auto-disbursements
      ]);
        setIncomeItems(inc.data || []);
        setExpenseItems(exp.data || []);
        setAssets(ast.data || []);
        setLiabilities(lib.data || []);
        setAccounts(accs || []);
        setAutoDisbursements(autoDisburs || []); // NEW: Set auto-disbursements
        setProjectionYears(settingsRes.data.projection_years || 30);
        setShowChartTotals(settingsRes.data.show_chart_totals ?? true);

        const uniqueAssetCategories = [...new Set(ast.data.map(item => item.category))].filter(Boolean);
        setAssetCategories(uniqueAssetCategories);
        
        const uniqueLiabilityCategories = [...new Set(lib.data.map(item => item.category || ''))];
        setLiabilityCategories(uniqueLiabilityCategories);
        
        const uniqueIncomeCategories = [...new Set(inc.data.map(item => item.category))].filter(Boolean);
        setIncomeCategories(uniqueIncomeCategories);
        
        const uniqueExpenseCategories = [...new Set(exp.data.map(item => item.category))].filter(Boolean);
        setExpenseCategories(uniqueExpenseCategories);
      } catch (e) {
        console.error("Failed to load cashflow, assets, or liabilities", e);
      } finally {
        setLoading(false);
      }
    };
    load();
    
    // Listen for category updates from CategorySettingsPage
    const handleCategoryUpdate = () => {
      console.log("Categories updated event received, refreshing all data.");
      refreshAllData(); // Refresh all data when categories are updated
    };
    window.addEventListener('categoriesUpdated', handleCategoryUpdate);
    
    return () => {
      window.removeEventListener('categoriesUpdated', handleCategoryUpdate);
    };
  }, [refreshSettings, refreshAllData, viewingUserId]); // Refresh when viewingUserId changes

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

  const handleMouseDown = (e) => {
    if (!sidebarRef.current) return;
    setIsResizing(true);
    startXRef.current = e.clientX;
    startWidthRef.current = sidebarRef.current.offsetWidth;
    e.preventDefault();
    e.stopPropagation();
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

  return (
    <div className="sidebar-layout">
      <aside className="sidebar" ref={sidebarRef} style={{ width: `${sidebarWidth}px` }}>
        <div 
          className="sidebar-resize-handle"
          onMouseDown={handleMouseDown}
        />
        <nav className="sidebar-nav">
          <section className="nav-section">
            <h3>Dashboard</h3>
            <button 
              className={`nav-btn ${view === 'new-home' ? 'active' : ''}`} 
              onClick={() => { setView('new-home'); setCashFlowView(null); }}
            >
              Home
            </button>
            
            <button
              className={`nav-btn ${view === 'balance-sheet-projection' ? 'active' : ''}`}
              onClick={() => { setView('balance-sheet-projection'); setCashFlowView(null); }}
            >
              Balance Sheet Projections
            </button>
            
            <button
              className={`nav-btn ${view === 'cashflow-projection' ? 'active' : ''}`}
              onClick={() => { setView('cashflow-projection'); setCashFlowView(null); }}
            >
              Cash Flow Projections
            </button>
            <button
              className={`nav-btn ${view === 'monte-carlo' ? 'active' : ''}`}
              onClick={() => { setView('monte-carlo'); setCashFlowView(null); }}
            >
              Monte Carlo Projections
            </button>
          </section>

          <section className="nav-section">
            <h3>Net Worth</h3>
            <button
              className={`nav-btn ${view === 'assets' ? 'active' : ''}`}
              onClick={() => { setView('assets'); setCashFlowView(null); }}
            >
              Assets
            </button>
            <button
              className={`nav-btn ${view === 'liabilities' ? 'active' : ''}`}
              onClick={() => { setView('liabilities'); setCashFlowView(null); }}
            >
              Liabilities
            </button>
          </section>

          <section className="nav-section">
            <h3>Cash Flow</h3>
            <button
              className={`nav-btn ${view === 'cashflow' && cashFlowView === 'income' ? 'active' : ''}`}
              onClick={() => { setView('cashflow'); setCashFlowView('income'); }}
            >
              Income
            </button>
            <button
              className={`nav-btn ${view === 'cashflow' && cashFlowView === 'expense' ? 'active' : ''}`}
              onClick={() => { setView('cashflow'); setCashFlowView('expense'); }}
            >
              Expenses
            </button>
          </section>


          <section className="nav-section">
            <h3>Custom Charts and Tables</h3>
            <button 
              className={`nav-btn ${view === 'custom-charts' && customChartView === 'list' ? 'active' : ''}`} 
              onClick={() => { setView('custom-charts'); setCustomChartView('list'); }}
            >
              View
            </button>
          </section>

          <section className="nav-section">
            <h3>Document Vault</h3>
            <button 
              className="nav-btn" 
              onClick={() => { window.location.href = '/documents'; }}
            >
              📁 My Documents
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
        
        {!loading && view === "new-home" && (
          <motion.div 
            className="dashboard-welcome"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <h2>Welcome to the Financial Projector!</h2>
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
              <h3 style={{ marginTop: 0, marginBottom: '20px', color: '#282c34' }}>Walk Me Through</h3>
              <p style={{ marginBottom: '25px', color: '#666' }}>
                New to the Financial Projector? Follow these guided wizards to set up your profile and organize your financial data.
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
                  <p>Enter your personal information, address, and tax filing status.</p>
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
                  <p>Organize your assets, liabilities, income, and expenses with categories.</p>
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
                  <p>Add your financial institution accounts (banks, brokerages, etc.).</p>
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
                  <p>Add your assets (checking, savings, investments, real estate, etc.).</p>
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
                  <p>Add your liabilities (mortgages, loans, credit cards, etc.).</p>
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
                  <p>Add your income sources (salary, rental income, investments, etc.).</p>
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
                  <p>Add your expenses (housing, food, transportation, etc.).</p>
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
                  <p>Set up automatic transfers between accounts and surplus asset handling.</p>
                </motion.div>
              </div>
            </motion.div>
          </motion.div>
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
              projectionYears={projectionYears}
              formatCurrency={formatCurrency}
              showChartTotals={showChartTotals}
            />
          </div>
        )}

        {!loading && view === "cashflow-projection" && (
          <div className="cashflow-overview-wrapper">
            <CashFlowOverview
              incomeItems={incomeItems}
              expenseItems={expenseItems}
              projectionYears={projectionYears}
              formatCurrency={formatCurrency}
              assets={assets}
              userSettings={userSettings}
              autoDisbursements={autoDisbursements}
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
              projectionYears={projectionYears}
              formatCurrency={formatCurrency}
            />
          </div>
        )}

        {!loading && view === "assets" && (
          <div className="assets-view">
            <AssetView 
              assets={assets}
              refreshAssets={refreshAssets}
              accounts={accounts}
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
              validCategories={cashFlowView === 'expense' ? (userSettings?.expense_categories || []) : (userSettings?.income_categories || [])}
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
              projectionYears={projectionYears}
              formatCurrency={formatCurrency}
              onBack={() => { setView('custom-charts'); setCustomChartView('list'); setChartToViewId(null); }}
              onEdit={handleEditChart}
            />
          </div>
        )}
      </main>
    </div>
  );
}
