import React, { useRef, useState, useEffect } from "react";
import { useAuth } from '../context/AuthContext';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { Line, Bar, Chart } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend } from 'chart.js';

// Register Chart.js components for combo charts
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend);

// Simplified Sankey Diagram Component
function SankeyDiagram({ incomeItems, expenseItems, assets, userSettings, cashFlowProjection, baseModel, formatCurrency, currentYear, projectionYears }) {
  const cashInSourceIds = userSettings?.cash_in_source_ids || [];
  const cashOutSourceIds = userSettings?.cash_out_source_ids || [];
  
  const includedIncomeItems = cashInSourceIds.length === 0 
    ? incomeItems 
    : incomeItems.filter(item => cashInSourceIds.includes(item.id));
  
  const includedExpenseItems = cashOutSourceIds.length === 0 
    ? expenseItems 
    : expenseItems.filter(item => cashOutSourceIds.includes(item.id));
  
  // Group income by category
  const incomeByCategory = {};
  includedIncomeItems.forEach(item => {
    const category = item.category || 'Other';
    if (!incomeByCategory[category]) {
      incomeByCategory[category] = [];
    }
    incomeByCategory[category].push(item);
  });
  
  // Group expenses by category
  const expenseByCategory = {};
  includedExpenseItems.forEach(item => {
    const category = item.category || 'Other';
    if (!expenseByCategory[category]) {
      expenseByCategory[category] = [];
    }
    expenseByCategory[category].push(item);
  });
  
  // Calculate totals for first year (or average)
  const inflationRate = (userSettings?.default_inflation_percent || 2.0) / 100;
  let totalCashIn = 0;
  let totalCashOut = 0;
  
  // Calculate income totals by category
  const incomeCategoryTotals = {};
  Object.keys(incomeByCategory).forEach(category => {
    let categoryTotal = 0;
    incomeByCategory[category].forEach(item => {
      categoryTotal += item.yearly_value || 0;
    });
    incomeCategoryTotals[category] = categoryTotal;
    totalCashIn += categoryTotal;
  });
  
  // Calculate expense totals by category
  const expenseCategoryTotals = {};
  Object.keys(expenseByCategory).forEach(category => {
    let categoryTotal = 0;
    expenseByCategory[category].forEach(item => {
      categoryTotal += item.yearly_value || 0;
    });
    expenseCategoryTotals[category] = categoryTotal;
    totalCashOut += categoryTotal;
  });
  
  // Calculate available cash (surplus)
  const availableCash = Math.max(0, totalCashIn - totalCashOut);
  
  const totalFlow = Math.max(totalCashIn, totalCashOut + availableCash);
  
  // Layout dimensions
  const width = 1200;
  const height = Math.max(600, (Object.keys(incomeByCategory).length + Object.keys(expenseByCategory).length + 2) * 40);
  const leftColumnX = 50;
  const centerColumnX = width / 2 - 50;
  const rightColumnX = width - 200;
  const columnWidth = 150;
  const nodeHeight = 30;
  const nodeSpacing = 40;
  
  const incomeCategories = Object.keys(incomeByCategory);
  const expenseCategories = Object.keys(expenseByCategory);
  
  // Calculate node positions
  let currentY = 50;
  const nodePositions = {};
  
  // Left side (sources)
  incomeCategories.forEach(category => {
    nodePositions[`source_${category}`] = { x: leftColumnX, y: currentY, width: columnWidth, height: nodeHeight };
    currentY += nodeHeight + nodeSpacing;
  });
  
  // Center (wallet)
  const walletY = height / 2 - nodeHeight / 2;
  nodePositions['wallet'] = { x: centerColumnX, y: walletY, width: columnWidth, height: nodeHeight };
  
  // Right side (sinks)
  currentY = 50;
  expenseCategories.forEach(category => {
    nodePositions[`sink_${category}`] = { x: rightColumnX, y: currentY, width: columnWidth, height: nodeHeight };
    currentY += nodeHeight + nodeSpacing;
  });
  
  // Available cash (always last on right)
  nodePositions['available_cash'] = { x: rightColumnX, y: currentY, width: columnWidth, height: nodeHeight };
  
  return (
    <div style={{ width: '100%', overflowX: 'auto', marginBottom: '20px' }}>
      <svg width={width} height={height} style={{ border: '1px solid #ddd', borderRadius: '4px', backgroundColor: '#f8f9fa' }}>
        {/* Source nodes (left) */}
        {incomeCategories.map((category, idx) => {
          const pos = nodePositions[`source_${category}`];
          const value = incomeCategoryTotals[category];
          const nodeWidth = Math.max(columnWidth, (value / totalFlow) * columnWidth * 2);
          
          return (
            <g key={`source_${category}`}>
              <rect
                x={pos.x}
                y={pos.y}
                width={nodeWidth}
                height={pos.height}
                fill="#4CAF50"
                stroke="#2E7D32"
                strokeWidth="2"
                rx="4"
              />
              <text
                x={pos.x + nodeWidth + 10}
                y={pos.y + pos.height / 2}
                fill="#333"
                fontSize="12"
                dominantBaseline="middle"
              >
                {category}: {safeFormatCurrency(value)}
              </text>
            </g>
          );
        })}
        
        {/* Wallet node (center) */}
        {(() => {
          const pos = nodePositions['wallet'];
          return (
            <g key="wallet">
              <rect
                x={pos.x}
                y={pos.y}
                width={pos.width}
                height={pos.height}
                fill="#2196F3"
                stroke="#1565C0"
                strokeWidth="2"
                rx="4"
              />
              <text
                x={pos.x + pos.width / 2}
                y={pos.y + pos.height / 2}
                fill="white"
                fontSize="12"
                fontWeight="bold"
                textAnchor="middle"
                dominantBaseline="middle"
              >
                Wallet
              </text>
            </g>
          );
        })()}
        
        {/* Sink nodes (right) */}
        {expenseCategories.map((category, idx) => {
          const pos = nodePositions[`sink_${category}`];
          const value = expenseCategoryTotals[category];
          const nodeWidth = Math.max(columnWidth, (value / totalFlow) * columnWidth * 2);
          
          return (
            <g key={`sink_${category}`}>
              <rect
                x={pos.x - nodeWidth}
                y={pos.y}
                width={nodeWidth}
                height={pos.height}
                fill="#F44336"
                stroke="#C62828"
                strokeWidth="2"
                rx="4"
              />
              <text
                x={pos.x - nodeWidth - 10}
                y={pos.y + pos.height / 2}
                fill="#333"
                fontSize="12"
                textAnchor="end"
                dominantBaseline="middle"
              >
                {category}: {safeFormatCurrency(value)}
              </text>
            </g>
          );
        })}
        
        {/* Available cash node */}
        {(() => {
          const pos = nodePositions['available_cash'];
          const nodeWidth = Math.max(columnWidth, (availableCash / totalFlow) * columnWidth * 2);
          
          return (
            <g key="available_cash">
              <rect
                x={pos.x - nodeWidth}
                y={pos.y}
                width={nodeWidth}
                height={pos.height}
                fill="#9C27B0"
                stroke="#6A1B9A"
                strokeWidth="2"
                rx="4"
              />
              <text
                x={pos.x - nodeWidth - 10}
                y={pos.y + pos.height / 2}
                fill="#333"
                fontSize="12"
                fontWeight="bold"
                textAnchor="end"
                dominantBaseline="middle"
              >
                Available Cash: {safeFormatCurrency(availableCash)}
              </text>
            </g>
          );
        })()}
        
        {/* Flow lines from sources to wallet */}
        {incomeCategories.map((category, idx) => {
          const sourcePos = nodePositions[`source_${category}`];
          const walletPos = nodePositions['wallet'];
          const value = incomeCategoryTotals[category];
          const flowHeight = (value / totalFlow) * nodeHeight;
          
          return (
            <path
              key={`flow_source_${category}`}
              d={`M ${sourcePos.x + columnWidth} ${sourcePos.y + sourcePos.height / 2} 
                  L ${walletPos.x} ${walletPos.y + walletPos.height / 2}`}
              fill="none"
              stroke="#4CAF50"
              strokeWidth={Math.max(2, flowHeight)}
              opacity="0.6"
              strokeLinecap="round"
            />
          );
        })}
        
        {/* Flow lines from wallet to sinks */}
        {expenseCategories.map((category, idx) => {
          const walletPos = nodePositions['wallet'];
          const sinkPos = nodePositions[`sink_${category}`];
          const value = expenseCategoryTotals[category];
          const flowHeight = (value / totalFlow) * nodeHeight;
          
          return (
            <path
              key={`flow_sink_${category}`}
              d={`M ${walletPos.x + walletPos.width} ${walletPos.y + walletPos.height / 2} 
                  L ${sinkPos.x} ${sinkPos.y + sinkPos.height / 2}`}
              fill="none"
              stroke="#F44336"
              strokeWidth={Math.max(2, flowHeight)}
              opacity="0.6"
              strokeLinecap="round"
            />
          );
        })}
        
        {/* Flow line from wallet to available cash */}
        {availableCash > 0 && (() => {
          const walletPos = nodePositions['wallet'];
          const cashPos = nodePositions['available_cash'];
          const flowHeight = (availableCash / totalFlow) * nodeHeight;
          
          return (
            <path
              key="flow_available_cash"
              d={`M ${walletPos.x + walletPos.width} ${walletPos.y + walletPos.height / 2} 
                  L ${cashPos.x} ${cashPos.y + cashPos.height / 2}`}
              fill="none"
              stroke="#9C27B0"
              strokeWidth={Math.max(2, flowHeight)}
              opacity="0.6"
              strokeLinecap="round"
            />
          );
        })()}
      </svg>
      
      <div style={{ marginTop: '20px', fontSize: '0.9em', color: '#666' }}>
        <p><strong>How to read:</strong></p>
        <ul style={{ marginLeft: '20px' }}>
          <li>Left side shows cash sources (income) grouped by category</li>
          <li>Center shows your wallet/main account (total cash)</li>
          <li>Right side shows where cash goes (expenses by category and available cash/savings)</li>
          <li>Line thickness represents the flow amount</li>
        </ul>
      </div>
    </div>
  );
}

export default function CashFlowOverview({ incomeItems = [], expenseItems = [], projectionYears = 30, formatCurrency, assets = [], userSettings = null, autoDisbursements = [] }) {
  const currentYear = new Date().getFullYear();
  const chartRef = useRef(null);
  const baseChartRef = useRef(null);
  const tableRef = useRef(null);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'base', 'sankey'
  
  // Ensure formatCurrency has a default
  const safeFormatCurrency = formatCurrency || ((v) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v ?? 0)
  );

  const calculateCashFlowProjection = () => {
    const years = [];
    const incomeValues = [];
    const expenseValues = [];
    const surplus = [];
    const surplusAssetTransfers = []; // NEW: Transfers to surplus asset
    const autoDisbursementTransfers = {}; // NEW: Track each auto-disbursement

    // Initialize auto-disbursement transfer arrays
    autoDisbursements.forEach(ad => {
      autoDisbursementTransfers[ad.id] = [];
    });

    // Pre-calculate asset projections for all years (needed for dynamic items and transfers)
    const assetProjections = {};
    assets.forEach(asset => {
      assetProjections[asset.id] = [];
      for (let year = 0; year <= projectionYears; year++) {
        const growthRate = (asset.annual_increase_percent || 0) / 100;
        let assetValue = asset.value;
        
        // Apply date filters if present
        if (asset.start_date) {
          const startYear = new Date(asset.start_date).getFullYear();
          if (currentYear + year < startYear) {
            assetValue = 0;
          }
        }
        if (asset.end_date) {
          const endYear = new Date(asset.end_date).getFullYear();
          if (currentYear + year > endYear) {
            assetValue = 0;
          }
        }
        
        if (assetValue > 0) {
          assetValue = assetValue * Math.pow(1 + growthRate, year);
        }
        assetProjections[asset.id].push(assetValue);
      }
    });

    for (let year = 0; year <= projectionYears; year++) {
      years.push(year);
      
      let totalIncome = 0;
      incomeItems.forEach((item) => {
        let itemValue = item.yearly_value;
        
        // Handle dynamic items (linked to assets)
        if (item.linked_item_id && item.linked_item_type === "asset" && item.percentage !== null && item.percentage !== undefined) {
          // Find the linked asset
          const linkedAsset = assets.find(a => a.id === item.linked_item_id);
          if (linkedAsset && assetProjections[linkedAsset.id] && assetProjections[linkedAsset.id][year] !== undefined) {
            // Recalculate based on projected asset value for this year
            const projectedAssetValue = assetProjections[linkedAsset.id][year];
            itemValue = projectedAssetValue * (item.percentage / 100.0);
          }
        } else {
          // Fixed value item - apply growth rate
          const growthRate = (item.annual_increase_percent || 0) / 100;
          itemValue = item.yearly_value * Math.pow(1 + growthRate, year);
        }
        
        totalIncome += itemValue;
      });

      let totalExpenses = 0;
      expenseItems.forEach((item) => {
        let itemValue = item.yearly_value;
        
        // Handle dynamic items (linked to assets)
        if (item.linked_item_id && item.linked_item_type === "asset" && item.percentage !== null && item.percentage !== undefined) {
          // Find the linked asset
          const linkedAsset = assets.find(a => a.id === item.linked_item_id);
          if (linkedAsset && assetProjections[linkedAsset.id] && assetProjections[linkedAsset.id][year] !== undefined) {
            // Recalculate based on projected asset value for this year
            const projectedAssetValue = assetProjections[linkedAsset.id][year];
            itemValue = projectedAssetValue * (item.percentage / 100.0);
          }
        } else {
          // Fixed value item - apply inflation rate
          const inflationRate = (item.inflation_percent || 0) / 100;
          itemValue = item.yearly_value * Math.pow(1 + inflationRate, year);
        }
        
        totalExpenses += itemValue;
      });

      const yearSurplus = totalIncome - totalExpenses;
      
      // Calculate surplus asset transfer (surplus/deficit goes to surplus asset)
      let surplusTransfer = 0;
      if (userSettings && userSettings.surplus_asset_id) {
        surplusTransfer = yearSurplus; // Positive = surplus, negative = deficit
      }
      
      // Calculate auto-disbursement transfers
      autoDisbursements.forEach(ad => {
        if (!autoDisbursementTransfers[ad.id]) {
          autoDisbursementTransfers[ad.id] = [];
        }
        
        // Check if disbursement is active for this year
        const startYear = ad.start_date ? new Date(ad.start_date).getFullYear() : currentYear;
        const endYear = ad.end_date ? new Date(ad.end_date).getFullYear() : currentYear + projectionYears;
        const currentProjectionYear = currentYear + year;
        
        if (currentProjectionYear >= startYear && (ad.end_date === null || currentProjectionYear <= endYear)) {
          const sourceAsset = assets.find(a => a.id === ad.source_asset_id);
          if (sourceAsset && assetProjections[sourceAsset.id] && assetProjections[sourceAsset.id][year] !== undefined) {
            const sourceValue = assetProjections[sourceAsset.id][year];
            let transferAmount = 0;
            
            if (ad.transfer_type === 'percentage') {
              transferAmount = sourceValue * ((ad.transfer_value || 0) / 100.0);
            } else if (ad.transfer_type === 'fixed') {
              transferAmount = ad.transfer_value || 0;
            }
            
            autoDisbursementTransfers[ad.id].push(transferAmount);
          } else {
            autoDisbursementTransfers[ad.id].push(0);
          }
        } else {
          // Ensure array exists even if outside date range
          if (!autoDisbursementTransfers[ad.id]) {
            autoDisbursementTransfers[ad.id] = [];
          }
          autoDisbursementTransfers[ad.id].push(0);
        }
      });

      incomeValues.push(totalIncome);
      expenseValues.push(totalExpenses);
      surplus.push(yearSurplus);
      surplusAssetTransfers.push(surplusTransfer);
    }

    return { years, incomeValues, expenseValues, surplus, surplusAssetTransfers, autoDisbursementTransfers };
  };

  // BASE Model calculation (Beginning, Additions, Subtractions, Ending)
  const calculateBaseModel = () => {
    const cashAssetIds = userSettings?.cash_asset_ids || [];
    const cashInSourceIds = userSettings?.cash_in_source_ids || [];
    const cashOutSourceIds = userSettings?.cash_out_source_ids || [];
    
    // Filter assets to only cash assets
    const cashAssets = assets.filter(a => cashAssetIds.includes(a.id));
    
    // Calculate initial cash balance (Beginning Balance for year 0)
    let beginningBalance = 0;
    cashAssets.forEach(asset => {
      beginningBalance += asset.value || 0;
    });
    
    const years = [];
    const beginningBalances = [];
    const cashInValues = [];
    const cashOutValues = [];
    const endingBalances = [];
    
    // Pre-calculate asset projections for ALL assets (needed for dynamic items and auto-disbursements)
    const assetProjections = {};
    assets.forEach(asset => {
      assetProjections[asset.id] = [];
      for (let year = 0; year <= projectionYears; year++) {
        const growthRate = (asset.annual_increase_percent || 0) / 100;
        let assetValue = asset.value;
        
        if (asset.start_date) {
          const startYear = new Date(asset.start_date).getFullYear();
          if (currentYear + year < startYear) assetValue = 0;
        }
        if (asset.end_date) {
          const endYear = new Date(asset.end_date).getFullYear();
          if (currentYear + year > endYear) assetValue = 0;
        }
        
        if (assetValue > 0) {
          assetValue = assetValue * Math.pow(1 + growthRate, year);
        }
        assetProjections[asset.id].push(assetValue);
      }
    });
    
    // Filter income/expense items based on configuration
    const includedIncomeItems = cashInSourceIds.length === 0 
      ? incomeItems 
      : incomeItems.filter(item => cashInSourceIds.includes(item.id));
    
    const includedExpenseItems = cashOutSourceIds.length === 0 
      ? expenseItems 
      : expenseItems.filter(item => cashOutSourceIds.includes(item.id));
    
    let currentBalance = beginningBalance;
    
    for (let year = 0; year <= projectionYears; year++) {
      years.push(year);
      beginningBalances.push(currentBalance);
      
      // Calculate Cash In (Additions)
      let cashIn = 0;
      const inflationRate = (userSettings?.default_inflation_percent || 2.0) / 100;
      
      includedIncomeItems.forEach(item => {
        const startYear = item.start_date ? new Date(item.start_date).getFullYear() : currentYear;
        const endYear = item.end_date ? new Date(item.end_date).getFullYear() : currentYear + projectionYears;
        const currentProjectionYear = currentYear + year;
        
        if (currentProjectionYear >= startYear && currentProjectionYear <= endYear) {
          let itemValue = item.yearly_value || 0;
          
          // Handle dynamic items (linked to assets)
          if (item.linked_item_id && item.linked_item_type === "asset" && item.percentage !== null && item.percentage !== undefined) {
            const linkedAsset = assets.find(a => a.id === item.linked_item_id);
            if (linkedAsset && assetProjections[linkedAsset.id] && assetProjections[linkedAsset.id][year] !== undefined) {
              const projectedAssetValue = assetProjections[linkedAsset.id][year];
              itemValue = projectedAssetValue * (item.percentage / 100.0);
            }
          } else {
            // Fixed value item - apply growth rate
            const growthRate = (item.annual_increase_percent || 0) / 100;
            itemValue = itemValue * Math.pow(1 + growthRate, year);
          }
          
          cashIn += itemValue;
        }
      });
      
      // Calculate Cash Out (Subtractions) - move before using cashOut
      let cashOut = 0;
      includedExpenseItems.forEach(item => {
        const startYear = item.start_date ? new Date(item.start_date).getFullYear() : currentYear;
        const endYear = item.end_date ? new Date(item.end_date).getFullYear() : currentYear + projectionYears;
        const currentProjectionYear = currentYear + year;
        
        if (currentProjectionYear >= startYear && currentProjectionYear <= endYear) {
          let itemValue = item.yearly_value || 0;
          
          // Handle dynamic items (linked to assets)
          if (item.linked_item_id && item.linked_item_type === "asset" && item.percentage !== null && item.percentage !== undefined) {
            const linkedAsset = assets.find(a => a.id === item.linked_item_id);
            if (linkedAsset && assetProjections[linkedAsset.id] && assetProjections[linkedAsset.id][year] !== undefined) {
              const projectedAssetValue = assetProjections[linkedAsset.id][year];
              itemValue = projectedAssetValue * (item.percentage / 100.0);
            }
          } else {
            // Fixed value item - apply inflation rate
            const inflationRate = (item.inflation_percent || 0) / 100;
            itemValue = itemValue * Math.pow(1 + inflationRate, year);
          }
          
          cashOut += itemValue;
        }
      });
      
      // Add transfers from auto-disbursements that target cash assets
      autoDisbursements.forEach(ad => {
        if (cashAssetIds.includes(ad.target_asset_id)) {
          const startYear = ad.start_date ? new Date(ad.start_date).getFullYear() : currentYear;
          const endYear = ad.end_date ? new Date(ad.end_date).getFullYear() : currentYear + projectionYears;
          const currentProjectionYear = currentYear + year;
          
          if (currentProjectionYear >= startYear && currentProjectionYear <= endYear) {
            const sourceAsset = assets.find(a => a.id === ad.source_asset_id);
            if (sourceAsset && assetProjections[sourceAsset.id] && assetProjections[sourceAsset.id][year] !== undefined) {
              const sourceValue = assetProjections[sourceAsset.id][year];
              let transferAmount = 0;
              
              if (ad.transfer_type === 'percentage') {
                transferAmount = sourceValue * ((ad.transfer_value || 0) / 100.0);
              } else if (ad.transfer_type === 'fixed') {
                transferAmount = ad.transfer_value || 0;
              }
              cashIn += transferAmount;
            }
          }
        }
      });
      
      // Add surplus asset transfer if surplus asset is a cash asset
      // Surplus = Cash In - Cash Out (already calculated above)
      const yearSurplus = cashIn - cashOut;
      if (userSettings?.surplus_asset_id && cashAssetIds.includes(userSettings.surplus_asset_id)) {
        if (yearSurplus > 0) {
          // Surplus adds to cash
          // Already included in cashIn calculation above for surplus transfers
        } else if (yearSurplus < 0) {
          // Deficit reduces cash (handled as additional cash out)
          cashOut += Math.abs(yearSurplus);
        }
      }
      
      // Add transfers from auto-disbursements that source cash assets (cash going out)
      autoDisbursements.forEach(ad => {
        if (cashAssetIds.includes(ad.source_asset_id) && !cashAssetIds.includes(ad.target_asset_id)) {
          const startYear = ad.start_date ? new Date(ad.start_date).getFullYear() : currentYear;
          const endYear = ad.end_date ? new Date(ad.end_date).getFullYear() : currentYear + projectionYears;
          const currentProjectionYear = currentYear + year;
          
          if (currentProjectionYear >= startYear && currentProjectionYear <= endYear) {
            const sourceAsset = assets.find(a => a.id === ad.source_asset_id);
            if (sourceAsset && assetProjections[sourceAsset.id] && assetProjections[sourceAsset.id][year] !== undefined) {
              const sourceValue = assetProjections[sourceAsset.id][year];
              let transferAmount = 0;
              
              if (ad.transfer_type === 'percentage') {
                transferAmount = sourceValue * ((ad.transfer_value || 0) / 100.0);
              } else if (ad.transfer_type === 'fixed') {
                transferAmount = ad.transfer_value || 0;
              }
              cashOut += transferAmount;
            }
          }
        }
      });
      
      // Calculate Ending Balance (Available Cash)
      const endingBalance = currentBalance + cashIn - cashOut;
      
      cashInValues.push(cashIn);
      cashOutValues.push(cashOut);
      endingBalances.push(endingBalance);
      
      // Update current balance for next iteration (next year's beginning balance)
      // This happens after pushing so next iteration uses this as beginning
      if (year < projectionYears) {
        currentBalance = endingBalance;
      }
    }
    
    return { years, beginningBalances, cashInValues, cashOutValues, endingBalances };
  };

  let cashFlowProjection;
  let baseModel;
  
  try {
    cashFlowProjection = calculateCashFlowProjection();
    baseModel = calculateBaseModel();
  } catch (error) {
    console.error('Error calculating cash flow projections:', error);
    // Return empty projection data on error
    cashFlowProjection = { years: [], incomeValues: [], expenseValues: [], surplus: [], surplusAssetTransfers: [], autoDisbursementTransfers: {} };
    baseModel = { years: [], beginningBalances: [], cashInValues: [], cashOutValues: [], endingBalances: [] };
  }

  // Build datasets array dynamically
  // Add transfer lines BEFORE surplus so they render on top
  const datasets = [
    {
      label: "Income",
      data: cashFlowProjection?.incomeValues || [],
      borderColor: "rgb(75, 192, 75)",
      backgroundColor: "rgba(75, 192, 75, 0.2)",
      order: 3, // Render first (lower order = rendered first, behind others)
    },
    {
      label: "Expenses",
      data: cashFlowProjection?.expenseValues || [],
      borderColor: "rgb(255, 99, 99)",
      backgroundColor: "rgba(255, 99, 99, 0.2)",
      order: 2,
    },
    {
      label: "Surplus",
      data: cashFlowProjection?.surplus || [],
      borderColor: "rgb(153, 102, 255)",
      backgroundColor: "rgba(153, 102, 255, 0.2)",
      order: 1,
    },
  ];

  // Add surplus asset transfer if configured - add AFTER Surplus so it renders on top
  if (userSettings && userSettings.surplus_asset_id) {
    const surplusAsset = assets.find(a => a.id === userSettings.surplus_asset_id);
    const surplusAssetName = surplusAsset ? surplusAsset.name : 'Surplus Asset';
    datasets.push({
      label: `Transfer to ${surplusAssetName}`,
      data: cashFlowProjection?.surplusAssetTransfers || [],
      borderColor: "rgb(255, 140, 0)", // Brighter orange
      backgroundColor: "rgba(255, 140, 0, 0.3)", // More visible fill
      borderDash: [8, 4], // Longer dashes for better visibility
      pointRadius: 5, // Larger points
      pointHoverRadius: 7,
      pointBackgroundColor: "rgb(255, 140, 0)", // Explicit point color
      spanGaps: false,
      tension: 0.1,
      borderWidth: 3, // Thicker line
      order: 0, // Render last (on top)
    });
  }

  // Add auto-disbursement transfers - add after transfers so they render on top
  autoDisbursements.forEach(ad => {
    if (cashFlowProjection?.autoDisbursementTransfers?.[ad.id] && cashFlowProjection.autoDisbursementTransfers[ad.id].length > 0) {
      const sourceAsset = assets.find(a => a.id === ad.source_asset_id);
      const targetAsset = assets.find(a => a.id === ad.target_asset_id);
      const sourceName = sourceAsset ? sourceAsset.name : 'Source';
      const targetName = targetAsset ? targetAsset.name : 'Target';
      datasets.push({
        label: `Auto-Disbursement: ${sourceName} → ${targetName}`,
        data: cashFlowProjection?.autoDisbursementTransfers?.[ad.id] || [],
        borderColor: "rgb(100, 100, 100)", // Darker gray
        backgroundColor: "rgba(100, 100, 100, 0.2)",
        borderDash: [6, 3], // Dashed line for transfers
        pointRadius: 4,
        pointHoverRadius: 6,
        borderWidth: 2,
        order: 0, // Render on top
      });
    }
  });

  const cashFlowChartData = {
    labels: (cashFlowProjection?.years || []).map(year => currentYear + year), // Adjust labels to current year
    datasets: datasets || [],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: "top",
      },
      title: {
        display: true,
        text: `Financial Project - Income & Expense Projection${userSettings?.person1_first_name && userSettings?.person1_last_name ? ` - ${userSettings.person1_first_name} ${userSettings.person1_last_name}` : ''}`,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  // Show every 5th year in tables
  const displayYears = (cashFlowProjection?.years || []).filter((y) => y % 5 === 0);

  // Download functions (reusing from ProjectionDetail.js pattern)
  const handleDownloadChartPng = (chartRef, filename) => {
    if (chartRef.current) {
      const link = document.createElement('a');
      link.download = `${filename.replace(/\s/g, '_')}.png`;
      link.href = chartRef.current.toBase64Image('image/png', 1);
      link.click();
    } else {
      console.error("Chart ref is not available for PNG download.");
    }
  };

  const handleDownloadChartPdf = (chartRef, filename) => {
    if (chartRef.current) {
      const chartImage = chartRef.current.toBase64Image('image/png', 1);
      const pdf = new jsPDF('l', 'pt', 'a4'); // 'l' for landscape
      const imgProps = pdf.getImageProperties(chartImage);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      pdf.addImage(chartImage, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${filename.replace(/\s/g, '_')}.pdf`);
    } else {
      console.error("Chart ref is not available for PDF download.");
    }
  };

  const handleDownloadTablePdf = async (tableRef, filename) => {
    if (tableRef.current) {
      const canvas = await html2canvas(tableRef.current);
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'pt', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${filename.replace(/\s/g, '_')}.pdf`);
    } else {
      console.error("Table ref is not available for PDF download.");
    }
  };

  const convertToCsv = (dataArray, headers, valueFormatter) => {
    const csvRows = [];
    csvRows.push(headers.join(','));

    dataArray.forEach(row => {
      const values = headers.map(header => {
        let value = row[header] || '';
        if (typeof value === 'number' && valueFormatter) {
          return `"${valueFormatter(value).replace(/"/g, '""')}"`; // Format currency and escape quotes
        }
        return `"${String(value).replace(/"/g, '""')}"`; // Escape double quotes for CSV
      });
      csvRows.push(values.join(','));
    });
    return csvRows.join('\n');
  };

  const handleDownloadCashFlowCsv = (filename) => {
    if (cashFlowProjection?.years?.length > 0) {
      const headers = ['Year', 'Income', 'Expenses', 'Surplus'];
      const surplusAsset = userSettings && userSettings.surplus_asset_id 
        ? assets.find(a => a.id === userSettings.surplus_asset_id) 
        : null;
      const surplusAssetName = surplusAsset ? surplusAsset.name : 'Surplus Transfer';
      
      // Build headers dynamically to include transfers
      let csvHeaders = [...headers];
      if (userSettings && userSettings.surplus_asset_id) {
        csvHeaders.push(`Transfer to ${surplusAssetName}`);
      }
      autoDisbursements.forEach(ad => {
        if (cashFlowProjection.autoDisbursementTransfers && cashFlowProjection.autoDisbursementTransfers[ad.id]) {
          const sourceAsset = assets.find(a => a.id === ad.source_asset_id);
          const targetAsset = assets.find(a => a.id === ad.target_asset_id);
          const sourceName = sourceAsset ? sourceAsset.name : 'Source';
          const targetName = targetAsset ? targetAsset.name : 'Target';
          csvHeaders.push(`Auto-Disbursement: ${sourceName} → ${targetName}`);
        }
      });
      
      const formattedData = (cashFlowProjection?.years || []).map((year, yearIndex) => {
        const row = {
          Year: currentYear + year,
          Income: cashFlowProjection?.incomeValues?.[yearIndex] || 0,
          Expenses: cashFlowProjection?.expenseValues?.[yearIndex] || 0,
          Surplus: cashFlowProjection?.surplus?.[yearIndex] || 0,
        };
        
        if (userSettings && userSettings.surplus_asset_id) {
          row[`Transfer to ${surplusAssetName}`] = cashFlowProjection?.surplusAssetTransfers?.[yearIndex] || 0;
        }
        
        autoDisbursements.forEach(ad => {
          if (cashFlowProjection?.autoDisbursementTransfers?.[ad.id]) {
            const sourceAsset = assets.find(a => a.id === ad.source_asset_id);
            const targetAsset = assets.find(a => a.id === ad.target_asset_id);
            const sourceName = sourceAsset ? sourceAsset.name : 'Source';
            const targetName = targetAsset ? targetAsset.name : 'Target';
            row[`Auto-Disbursement: ${sourceName} → ${targetName}`] = cashFlowProjection.autoDisbursementTransfers[ad.id][yearIndex] || 0;
          }
        });
        
        return row;
      });
      
      const csvString = convertToCsv(formattedData, csvHeaders, formatCurrency);
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${filename.replace(/\s/g, '_')}.csv`;
      link.click();
    } else {
      console.warn("No data available for Cash Flow CSV download.");
    }
  };

  // BASE Model Chart Data (Combo: Bar + Line)
  const baseChartData = {
    labels: (baseModel?.years || []).map(year => currentYear + year),
    datasets: [
      {
        type: 'bar',
        label: 'Cash In',
        data: baseModel?.cashInValues || [],
        backgroundColor: 'rgba(75, 192, 75, 0.6)',
        borderColor: 'rgb(75, 192, 75)',
        borderWidth: 1,
        order: 2,
      },
      {
        type: 'bar',
        label: 'Cash Out',
        data: baseModel?.cashOutValues || [],
        backgroundColor: 'rgba(255, 99, 99, 0.6)',
        borderColor: 'rgb(255, 99, 99)',
        borderWidth: 1,
        order: 2,
      },
      {
        type: 'line',
        label: 'Available Cash',
        data: baseModel?.endingBalances || [],
        borderColor: 'rgb(153, 102, 255)',
        backgroundColor: 'rgba(153, 102, 255, 0.2)',
        borderWidth: 3,
        fill: false,
        tension: 0.1,
        pointRadius: 4,
        pointHoverRadius: 6,
        order: 1,
        yAxisID: 'y1',
      },
    ],
  };

  const baseChartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: `Financial Project - BASE Model (Beginning, Additions, Subtractions, Ending)${userSettings?.person1_first_name && userSettings?.person1_last_name ? ` - ${userSettings.person1_first_name} ${userSettings.person1_last_name}` : ''}`,
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              label += safeFormatCurrency(context.parsed.y);
            }
            return label;
          }
        }
      },
    },
    scales: {
      y: {
        type: 'linear',
        position: 'left',
        beginAtZero: true,
        title: {
          display: true,
          text: 'Cash In / Out ($)',
        },
        ticks: {
          callback: function(value) {
            return safeFormatCurrency(value);
          }
        }
      },
      y1: {
        type: 'linear',
        position: 'right',
        beginAtZero: false,
        title: {
          display: true,
          text: 'Available Cash ($)',
        },
        ticks: {
          callback: function(value) {
            return safeFormatCurrency(value);
          }
        },
        grid: {
          drawOnChartArea: false,
        },
      },
    },
  };

  return (
    <div className="cashflow-overview-container">
      <div style={{ marginBottom: '20px', borderBottom: '2px solid #eee' }}>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <button
            onClick={() => setActiveTab('overview')}
            style={{
              background: activeTab === 'overview' ? '#007bff' : 'transparent',
              color: activeTab === 'overview' ? 'white' : '#555',
              border: 'none',
              padding: '10px 20px',
              fontSize: '1em',
              cursor: 'pointer',
              borderBottom: activeTab === 'overview' ? '2px solid #007bff' : '2px solid transparent',
              fontWeight: activeTab === 'overview' ? 'bold' : 'normal',
              transition: 'all 0.3s ease'
            }}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('base')}
            style={{
              background: activeTab === 'base' ? '#007bff' : 'transparent',
              color: activeTab === 'base' ? 'white' : '#555',
              border: 'none',
              padding: '10px 20px',
              fontSize: '1em',
              cursor: 'pointer',
              borderBottom: activeTab === 'base' ? '2px solid #007bff' : '2px solid transparent',
              fontWeight: activeTab === 'base' ? 'bold' : 'normal',
              transition: 'all 0.3s ease'
            }}
          >
            BASE Model
          </button>
          <button
            onClick={() => setActiveTab('sankey')}
            style={{
              background: activeTab === 'sankey' ? '#007bff' : 'transparent',
              color: activeTab === 'sankey' ? 'white' : '#555',
              border: 'none',
              padding: '10px 20px',
              fontSize: '1em',
              cursor: 'pointer',
              borderBottom: activeTab === 'sankey' ? '2px solid #007bff' : '2px solid transparent',
              fontWeight: activeTab === 'sankey' ? 'bold' : 'normal',
              transition: 'all 0.3s ease'
            }}
          >
            Sankey Diagram
          </button>
        </div>
      </div>

      {activeTab === 'overview' && (
        <>
          <h3>Income & Expense Projection</h3>
          <div style={{ marginBottom: "30px" }}>
            <div className="chart-actions">
              <button onClick={() => handleDownloadChartPng(chartRef, "Income_Expense_Projection")}>Download PNG</button>
              <button onClick={() => handleDownloadChartPdf(chartRef, "Income_Expense_Projection")}>Download PDF</button>
            </div>
            <Line ref={chartRef} data={cashFlowChartData} options={chartOptions} />
          </div>

      <div className="table-actions">
        <button onClick={() => handleDownloadTablePdf(tableRef, "Cash_Flow_Overview_Table")}>Download PDF</button>
        <button onClick={() => handleDownloadCashFlowCsv("Cash_Flow_Overview_Table")}>Download CSV</button>
      </div>
      <table ref={tableRef} className="cashflow-table">
        <thead>
          <tr>
            <th>Year</th>
            <th>Income</th>
            <th>Expenses</th>
            <th>Surplus</th>
            {userSettings && userSettings.surplus_asset_id && (() => {
              const surplusAsset = assets.find(a => a.id === userSettings.surplus_asset_id);
              const surplusAssetName = surplusAsset ? surplusAsset.name : 'Surplus Asset';
              return <th key="surplus-transfer">{`Transfer to ${surplusAssetName}`}</th>;
            })()}
            {autoDisbursements.map(ad => {
              if (!cashFlowProjection?.autoDisbursementTransfers?.[ad.id]) return null;
              const sourceAsset = assets.find(a => a.id === ad.source_asset_id);
              const targetAsset = assets.find(a => a.id === ad.target_asset_id);
              const sourceName = sourceAsset ? sourceAsset.name : 'Source';
              const targetName = targetAsset ? targetAsset.name : 'Target';
              return <th key={ad.id}>{`Auto-Disbursement: ${sourceName} → ${targetName}`}</th>;
            })}
          </tr>
        </thead>
        <tbody>
          {displayYears.map((year) => (
            <tr key={year}>
              <td>{currentYear + year}</td>
              <td>{safeFormatCurrency(cashFlowProjection?.incomeValues?.[year] || 0)}</td>
              <td>{safeFormatCurrency(cashFlowProjection?.expenseValues?.[year] || 0)}</td>
              <td>{safeFormatCurrency(cashFlowProjection?.surplus?.[year] || 0)}</td>
              {userSettings && userSettings.surplus_asset_id && (
                <td>{safeFormatCurrency(cashFlowProjection?.surplusAssetTransfers?.[year] || 0)}</td>
              )}
              {autoDisbursements.map(ad => {
                if (!cashFlowProjection?.autoDisbursementTransfers?.[ad.id]) return null;
                return (
                  <td key={ad.id}>
                    {safeFormatCurrency(cashFlowProjection?.autoDisbursementTransfers?.[ad.id]?.[year] || 0)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
        </>
      )}

      {activeTab === 'base' && (
        <>
          <h3>BASE Model (Beginning, Additions, Subtractions, Ending)</h3>
          {(!userSettings?.cash_asset_ids || userSettings.cash_asset_ids.length === 0) ? (
            <div style={{ padding: '20px', backgroundColor: '#fff3cd', border: '1px solid #ffeaa7', borderRadius: '4px', marginBottom: '20px' }}>
              <strong>Note:</strong> Please configure cash assets in Settings &gt; Application Settings to view the BASE Model.
            </div>
          ) : (
            <>
              <div style={{ marginBottom: "30px" }}>
                <div className="chart-actions">
                  <button onClick={() => handleDownloadChartPng(baseChartRef, "BASE_Model")}>Download PNG</button>
                  <button onClick={() => handleDownloadChartPdf(baseChartRef, "BASE_Model")}>Download PDF</button>
                </div>
                <Chart ref={baseChartRef} type="bar" data={baseChartData} options={baseChartOptions} />
              </div>
              <p style={{ color: '#666', fontSize: '0.9em', marginBottom: '20px' }}>
                <strong>Visual Cue:</strong> The purple line represents your "runway" (Available Cash). 
                If the line slopes down, you are spending more than you earn (even if you have a high balance). 
                If it slopes up, your available spending power is growing.
              </p>
              <table className="cashflow-table" style={{ marginTop: '20px' }}>
                <thead>
                  <tr>
                    <th>Year</th>
                    <th>Beginning Balance</th>
                    <th>Cash In (Additions)</th>
                    <th>Cash Out (Subtractions)</th>
                    <th>Ending Balance (Available Cash)</th>
                  </tr>
                </thead>
                <tbody>
                  {displayYears.map((year) => (
                    <tr key={year}>
                      <td>{currentYear + year}</td>
                      <td>{safeFormatCurrency(baseModel?.beginningBalances?.[year] || 0)}</td>
                      <td>{safeFormatCurrency(baseModel?.cashInValues?.[year] || 0)}</td>
                      <td>{safeFormatCurrency(baseModel?.cashOutValues?.[year] || 0)}</td>
                      <td>{safeFormatCurrency(baseModel?.endingBalances?.[year] || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </>
      )}

      {activeTab === 'sankey' && (
        <>
          <h3>Sankey Diagram</h3>
          {(!userSettings?.cash_asset_ids || userSettings.cash_asset_ids.length === 0) ? (
            <div style={{ padding: '20px', backgroundColor: '#fff3cd', border: '1px solid #ffeaa7', borderRadius: '4px', marginBottom: '20px' }}>
              <strong>Note:</strong> Please configure cash assets in Settings &gt; Application Settings to view the Sankey Diagram.
            </div>
          ) : (
            <SankeyDiagram
              incomeItems={incomeItems}
              expenseItems={expenseItems}
              assets={assets}
              userSettings={userSettings}
              cashFlowProjection={cashFlowProjection}
              baseModel={baseModel}
              formatCurrency={safeFormatCurrency}
              currentYear={currentYear}
              projectionYears={projectionYears}
            />
          )}
        </>
      )}
    </div>
  );
}
