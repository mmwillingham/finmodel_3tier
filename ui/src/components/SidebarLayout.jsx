import React, { useState, useEffect, useCallback } from "react";
import CashFlowService from "../services/cashflow.service";
import AssetService from "../services/asset.service";
import LiabilityService from "../services/liability.service";
import AccountService from "../services/account.service";
import ProjectionDetail from "./ProjectionDetail";
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

export default function SidebarLayout() {
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
      const [inc, exp, ast, lib, accs, settingsRes] = await Promise.all([
        CashFlowService.list(true),
        CashFlowService.list(false),
        AssetService.list(),
        LiabilityService.list(),
        AccountService.getAllAccounts().catch(() => []), // Don't fail if accounts endpoint doesn't exist yet
        SettingsService.getSettings(),
      ]);

      setIncomeItems(inc.data || []);
      setExpenseItems(exp.data || []);
      setAssets(ast.data || []);
      setLiabilities(lib.data || []);
      setAccounts(accs || []);
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
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const [inc, exp, ast, lib, accs, settingsRes] = await Promise.all([
          CashFlowService.list(true),
          CashFlowService.list(false),
          AssetService.list(),
          LiabilityService.list(),
          AccountService.getAllAccounts().catch(() => []), // Don't fail if accounts endpoint doesn't exist yet
          SettingsService.getSettings(),
        ]);
        setIncomeItems(inc.data || []);
        setExpenseItems(exp.data || []);
        setAssets(ast.data || []);
        setLiabilities(lib.data || []);
        setAccounts(accs || []);
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
  }, [refreshSettings, refreshAllData]);

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
      CashFlowService.list(true),
      CashFlowService.list(false),
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
    const ast = await AssetService.list();
    setAssets(ast.data || []);
    
    const uniqueAssetCategories = [...new Set((ast.data || []).map(item => item.category))].filter(Boolean);
    setAssetCategories(uniqueAssetCategories);
    
    setLoading(false);
  };

  const refreshLiabilities = async () => {
    if (!loading) setLoading(true);
    const lib = await LiabilityService.list();
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

  return (
    <div className="sidebar-layout">
      <aside className="sidebar">
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
        </nav>
      </aside>

      <main className="main-content">
        {loading && <div className="loading">Loading...</div>}
        
        {!loading && view === "new-home" && (
          <div className="dashboard-welcome">
            <h2>Welcome to the Financial Projector!</h2>
            <p>Use the navigation on the left to explore your financial data.</p>
            
            <div className="walk-me-through-section" style={{ marginTop: '40px', padding: '30px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #dee2e6' }}>
              <h3 style={{ marginTop: 0, marginBottom: '20px', color: '#282c34' }}>Walk Me Through</h3>
              <p style={{ marginBottom: '25px', color: '#666' }}>
                New to the Financial Projector? Follow these guided wizards to set up your profile and organize your financial data.
              </p>
              
              <div className="wizard-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
                <div className="wizard-card" style={{ padding: '20px', backgroundColor: 'white', borderRadius: '8px', border: '1px solid #dee2e6', cursor: 'pointer', transition: 'all 0.2s' }}
                     onClick={() => setWizardOpen('profile')}
                     onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)'}
                     onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}>
                  <h4 style={{ marginTop: 0, color: '#007bff' }}>📋 Setup Profile</h4>
                  <p style={{ color: '#666', fontSize: '0.9em', marginBottom: 0 }}>
                    Enter your personal information, address, and tax filing status.
                  </p>
                </div>
                
                <div className="wizard-card" style={{ padding: '20px', backgroundColor: 'white', borderRadius: '8px', border: '1px solid #dee2e6', cursor: 'pointer', transition: 'all 0.2s' }}
                     onClick={() => setWizardOpen('categories')}
                     onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)'}
                     onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}>
                  <h4 style={{ marginTop: 0, color: '#007bff' }}>🏷️ Setup Categories</h4>
                  <p style={{ color: '#666', fontSize: '0.9em', marginBottom: 0 }}>
                    Organize your assets, liabilities, income, and expenses with categories.
                  </p>
                </div>
                
                <div className="wizard-card" style={{ padding: '20px', backgroundColor: 'white', borderRadius: '8px', border: '1px solid #dee2e6', cursor: 'pointer', transition: 'all 0.2s' }}
                     onClick={() => setWizardOpen('accounts')}
                     onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)'}
                     onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}>
                  <h4 style={{ marginTop: 0, color: '#007bff' }}>🏦 Setup Accounts</h4>
                  <p style={{ color: '#666', fontSize: '0.9em', marginBottom: 0 }}>
                    Add your financial institution accounts (banks, brokerages, etc.).
                  </p>
                </div>
                
                <div className="wizard-card" style={{ padding: '20px', backgroundColor: 'white', borderRadius: '8px', border: '1px solid #dee2e6', cursor: 'pointer', transition: 'all 0.2s' }}
                     onClick={() => setWizardOpen('assets')}
                     onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)'}
                     onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}>
                  <h4 style={{ marginTop: 0, color: '#007bff' }}>💰 Setup Assets</h4>
                  <p style={{ color: '#666', fontSize: '0.9em', marginBottom: 0 }}>
                    Add your assets (checking, savings, investments, real estate, etc.).
                  </p>
                </div>
                
                <div className="wizard-card" style={{ padding: '20px', backgroundColor: 'white', borderRadius: '8px', border: '1px solid #dee2e6', cursor: 'pointer', transition: 'all 0.2s' }}
                     onClick={() => setWizardOpen('liabilities')}
                     onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)'}
                     onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}>
                  <h4 style={{ marginTop: 0, color: '#007bff' }}>📉 Setup Liabilities</h4>
                  <p style={{ color: '#666', fontSize: '0.9em', marginBottom: 0 }}>
                    Add your liabilities (mortgages, loans, credit cards, etc.).
                  </p>
                </div>
                
                <div className="wizard-card" style={{ padding: '20px', backgroundColor: 'white', borderRadius: '8px', border: '1px solid #dee2e6', cursor: 'pointer', transition: 'all 0.2s' }}
                     onClick={() => setWizardOpen('income')}
                     onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)'}
                     onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}>
                  <h4 style={{ marginTop: 0, color: '#007bff' }}>💵 Setup Income</h4>
                  <p style={{ color: '#666', fontSize: '0.9em', marginBottom: 0 }}>
                    Add your income sources (salary, rental income, investments, etc.).
                  </p>
                </div>
                
                <div className="wizard-card" style={{ padding: '20px', backgroundColor: 'white', borderRadius: '8px', border: '1px solid #dee2e6', cursor: 'pointer', transition: 'all 0.2s' }}
                     onClick={() => setWizardOpen('expenses')}
                     onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)'}
                     onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}>
                  <h4 style={{ marginTop: 0, color: '#007bff' }}>💸 Setup Expenses</h4>
                  <p style={{ color: '#666', fontSize: '0.9em', marginBottom: 0 }}>
                    Add your expenses (housing, food, transportation, etc.).
                  </p>
                </div>
                
                <div className="wizard-card" style={{ padding: '20px', backgroundColor: 'white', borderRadius: '8px', border: '1px solid #dee2e6', cursor: 'pointer', transition: 'all 0.2s' }}
                     onClick={() => setWizardOpen('automatic-transfers')}
                     onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)'}
                     onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}>
                  <h4 style={{ marginTop: 0, color: '#007bff' }}>🔄 Setup Automatic Transfers</h4>
                  <p style={{ color: '#666', fontSize: '0.9em', marginBottom: 0 }}>
                    Set up automatic transfers between accounts and surplus asset handling.
                  </p>
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
              type={cashFlowView}
              incomeItems={incomeItems}
              expenseItems={expenseItems}
              refreshCashflow={refreshCashflow}
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
              onEdit={(chartId) => { setChartToEditId(chartId); setView('custom-charts'); setCustomChartView('edit'); }}
            />
          </div>
        )}
      </main>
    </div>
  );
}
