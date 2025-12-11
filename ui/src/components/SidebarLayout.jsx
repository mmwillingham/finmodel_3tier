import React, { useState, useEffect, useCallback } from "react";
import CashFlowService from "../services/cashflow.service";
import AssetService from "../services/asset.service";
import LiabilityService from "../services/liability.service";
import ProjectionDetail from "./ProjectionDetail";
import CashFlowView from "./CashFlowView";
import AssetView from "./AssetView";
import LiabilityView from "./LiabilityView";
import BalanceSheetProjection from "./BalanceSheetProjection";
import CashFlowOverview from "./CashFlowOverview";
import SettingsModal from "./SettingsModal";
import "./SidebarLayout.css";
import SettingsService from "../services/settings.service";
import CustomChartList from "./CustomChartList";
import CustomChartForm from "./CustomChartForm";
import CustomChartView from "./CustomChartView";

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
  const [projectionYears, setProjectionYears] = useState(30);
  const [showChartTotals, setShowChartTotals] = useState(true);
  const [customChartView, setCustomChartView] = useState(null);
  const [selectedChartId, setSelectedChartId] = useState(null);
  const [chartToViewId, setChartToViewId] = useState(null);

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
      const [inc, exp, ast, lib, settingsRes] = await Promise.all([
        CashFlowService.list(true),
        CashFlowService.list(false),
        AssetService.list(),
        LiabilityService.list(),
        SettingsService.getSettings(),
      ]);

      setIncomeItems(inc.data || []);
      setExpenseItems(exp.data || []);
      setAssets(ast.data || []);
      setLiabilities(lib.data || []);
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
        const [inc, exp, ast, lib, settingsRes] = await Promise.all([
          CashFlowService.list(true),
          CashFlowService.list(false),
          AssetService.list(),
          LiabilityService.list(),
          SettingsService.getSettings(),
        ]);
        setIncomeItems(inc.data || []);
        setExpenseItems(exp.data || []);
        setAssets(ast.data || []);
        setLiabilities(lib.data || []);
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
    setLoading(false);
  };

  const refreshAssets = async () => {
    if (!loading) setLoading(true);
    const ast = await AssetService.list();
    setAssets(ast.data || []);
    setLoading(false);
  };

  const refreshLiabilities = async () => {
    if (!loading) setLoading(true);
    const lib = await LiabilityService.list();
    setLiabilities(lib.data || []);
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
          </section>

          <section className="nav-section">
            <h3>Items Management</h3>
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
            <button
              className={`nav-btn ${view === 'cashflow' && cashFlowView === 'income' ? 'active' : ''}`}
              onClick={() => { setView('cashflow'); setCashFlowView('income'); }}
            >
              Income Items
            </button>
            <button
              className={`nav-btn ${view === 'cashflow' && cashFlowView === 'expense' ? 'active' : ''}`}
              onClick={() => { setView('cashflow'); setCashFlowView('expense'); }}
            >
              Expenses
            </button>
          </section>

          <section className="nav-section">
            <h3>Settings</h3>
            <button 
              className={`nav-btn ${view === 'settings' ? 'active' : ''}`} 
              onClick={() => setView('settings')}
            >
              General Settings
            </button>
          </section>

          <section className="nav-section">
            <h3>Custom Charts</h3>
            <button 
              className={`nav-btn ${view === 'custom-charts' && customChartView === 'list' ? 'active' : ''}`} 
              onClick={() => { setView('custom-charts'); setCustomChartView('list'); }}
            >
              View All Charts
            </button>
            <button 
              className={`nav-btn ${view === 'custom-charts' && customChartView === 'create' ? 'active' : ''}`} 
              onClick={() => { setView('custom-charts'); setCustomChartView('create'); }}
            >
              Create New Chart
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
          </div>
        )}

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
            />
          </div>
        )}

        {!loading && view === "assets" && (
          <div className="assets-view">
            <AssetView 
              assets={assets}
              refreshAssets={refreshAssets}
            />
          </div>
        )}
        {!loading && view === "liabilities" && (
          <div className="liabilities-view">
            <LiabilityView 
              liabilities={liabilities}
              refreshLiabilities={refreshLiabilities}
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

        {!loading && view === "settings" && (
          <div className="settings">
            <h2>Settings</h2>
            <SettingsModal 
              onClose={() => setView('new-home')} 
              isOpen={true}
              onSettingsSaved={refreshSettings}
            />
          </div>
        )}

        {!loading && view === "custom-charts" && customChartView === "list" && (
          <div className="custom-charts-list">
            <CustomChartList onEditChart={handleEditChart} onCreateNewChart={handleCreateNewChart} onViewChart={handleViewChart} />
          </div>
        )}

        {!loading && view === "custom-charts" && (customChartView === "create" || customChartView === "edit") && 
          assetCategories.length > 0 && 
          liabilityCategories.length > 0 && 
          incomeCategories.length > 0 && 
          expenseCategories.length > 0 && (
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
            />
          </div>
        )}
      </main>
    </div>
  );
}
