import React, { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from '../context/AuthContext';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { Line, Bar, Chart } from "react-chartjs-2";
import { Alert, Box, Button, Checkbox, FormControl, FormControlLabel, InputLabel, List, ListItem, ListItemText, MenuItem, Paper, Select, Slider, Stack, Tab, Tabs, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from "@mui/material";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import { calculateTaxableIncome } from '../utils/taxCalculator';
import { calculateRmd } from '../utils/rmdCalculator';
import { calculateYearFraction } from '../utils/dateUtils';
import { buildTaxableDistributionEntries } from '../utils/taxableDistribution';
import { projectionActionButtonSx, projectionSectionCardSx, projectionTableContainerSx } from "../utils/projectionUiStyles";
import ProjectionService from '../services/projection.service';

// Register Chart.js components for combo charts
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, ArcElement);

// Constants to identify the tax expense items (must match backend)
const FEDERAL_TAX_EXPENSE_DESCRIPTION = "Federal Income Tax (Calculated)";
const STATE_TAX_EXPENSE_DESCRIPTION = "State Income Tax (Calculated)";

const CASH_ASSET_KEYWORDS = ['cash', 'checking', 'savings', 'money market', 'deposit'];
const getCashAssetIds = (userSettings, assets) => {
  const configured = userSettings?.cash_asset_ids || [];
  if (Array.isArray(configured) && configured.length > 0) {
    return configured;
  }
  if (!Array.isArray(assets) || assets.length === 0) {
    return [];
  }
  return assets
    .filter(asset => {
      const category = (asset?.category || '').toString().toLowerCase();
      return CASH_ASSET_KEYWORDS.some(keyword => category.includes(keyword));
    })
    .map(asset => asset.id)
    .filter(Boolean);
};

// Simplified Sankey Diagram Component
function SankeyDiagram({ incomeItems = [], expenseItems = [], assets = [], userSettings = null, cashFlowProjection = null, baseModel = null, formatCurrency, currentYear, projectionYears = 30, selectedYear = 0, autoDisbursements = [], viewMode = 'sankey', includeTransfers = true, stateTaxProjectionValue = 0 }) {
  // Ensure formatCurrency has a default
  const safeFormatCurrency = formatCurrency || ((v) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v ?? 0)
  );

  const cashAssetIds = getCashAssetIds(userSettings, assets);
  const cashInSourceIds = userSettings?.cash_in_source_ids || [];
  const cashOutSourceIds = userSettings?.cash_out_source_ids || [];

  const baseIncomeItems = cashInSourceIds.length === 0 
    ? (incomeItems || [])
    : (incomeItems || []).filter(item => cashInSourceIds.includes(item?.id));
  
  const includedExpenseItems = cashOutSourceIds.length === 0 
    ? (expenseItems || [])
    : (expenseItems || []).filter(item => cashOutSourceIds.includes(item?.id));
  
  const assetProjections = {};
  assets.forEach(asset => {
    const growthRate = (asset.annual_increase_percent || 0) / 100;
    assetProjections[asset.id] = [];
    for (let yearIndex = 0; yearIndex <= projectionYears; yearIndex++) {
      const value = (asset.value || 0) * Math.pow(1 + growthRate, yearIndex);
      assetProjections[asset.id].push(value);
    }
  });

  const taxableDistributionItems = buildTaxableDistributionEntries({
    autoDisbursements,
    assets,
    currentYear,
    targetYear: selectedYear,
    userSettings,
  });

  const allIncomeItems = [...baseIncomeItems, ...taxableDistributionItems];

  // Group income by category
  const incomeByCategory = {};
  allIncomeItems.forEach(item => {
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
  
  // Calculate totals for the selected year
  const inflationRate = (userSettings?.default_inflation_percent || 2.0) / 100;
  const year = selectedYear; // Year offset (0 = current year)
  let totalCashIn = 0;
  let totalCashOut = 0;
  
  // Calculate income totals by category for selected year
  const incomeCategoryTotals = {};
  let totalTaxableIncome = 0; // Track taxable income for tax calculations
  const currentProjectionYear = currentYear + year;
  
  Object.keys(incomeByCategory).forEach(category => {
    let categoryTotal = 0;
      incomeByCategory[category].forEach(item => {
      // Check if item is active in this year and calculate proration
      const yearFraction = calculateYearFraction(item.start_date, item.end_date, currentProjectionYear);
      
      if (yearFraction <= 0) {
        // Item is not active in this year
        return;
      }
      
      let itemValue = item.yearly_value || 0;
      
      // Handle dynamic items (linked to assets) - check both linked_item_id and linked_asset_ids
      const isDynamicAssetLinked = item.linked_item_type === "asset" && item.percentage !== null && item.percentage !== undefined;
      if (isDynamicAssetLinked) {
        // Get linked asset IDs - check linked_asset_ids first, then linked_item_id
        let linkedAssetIds = [];
        if (item.linked_asset_ids && Array.isArray(item.linked_asset_ids) && item.linked_asset_ids.length > 0) {
          linkedAssetIds = item.linked_asset_ids;
        } else if (item.linked_item_id) {
          linkedAssetIds = [item.linked_item_id];
        }
        
        // Calculate dividend from linked assets
        if (linkedAssetIds.length > 0) {
          let totalAssetValue = 0;
          linkedAssetIds.forEach(assetId => {
            const projectedAssetValue = assetProjections[assetId]?.[year] || 0;
            totalAssetValue += projectedAssetValue;
          });
          itemValue = totalAssetValue * (item.percentage / 100.0);
        } else {
          // Fallback: if no linked assets found, treat as fixed
          const growthRate = (item.annual_increase_percent || 0) / 100;
          itemValue = itemValue * Math.pow(1 + growthRate, year);
        }
      } else {
        // Fixed value item - apply growth rate
        const growthRate = (item.annual_increase_percent || 0) / 100;
        itemValue = itemValue * Math.pow(1 + growthRate, year);
      }
      
      // Prorate the value based on how many months the item is active in this year
      itemValue = itemValue * yearFraction;
      
      // Count as taxable income if taxable
      if (item.taxable) {
        totalTaxableIncome += itemValue;
      }
      
      // Check if this is a reinvested dividend - exclude from cash flow
      const isDividend = (item.category?.toLowerCase().includes('dividend') || item.description?.toLowerCase().includes('dividend'));
      const shouldReinvest = isDividend && item.reinvest_dividends;
      
      // If not reinvested, add to category total (cash flow)
      if (!shouldReinvest) {
        categoryTotal += itemValue;
      }
    });
    incomeCategoryTotals[category] = categoryTotal;
    totalCashIn += categoryTotal;
  });
  
  // Calculate expense totals by category for selected year
  const expenseCategoryTotals = {};
  let totalTaxDeductibleExpenses = 0; // Track tax-deductible expenses for tax calculation
  const federalTaxExpenseItem = includedExpenseItems.find(item => item.description === FEDERAL_TAX_EXPENSE_DESCRIPTION);
  
  // Process expenses (excluding federal tax expense item)
  Object.keys(expenseByCategory).forEach(category => {
    let categoryTotal = 0;
      expenseByCategory[category].forEach(item => {
      // Skip federal tax expense item - it will be handled separately
      if (item.description === FEDERAL_TAX_EXPENSE_DESCRIPTION) {
        return;
      }
      
      // Check if item is active in this year and calculate proration
      const yearFraction = calculateYearFraction(item.start_date, item.end_date, currentProjectionYear);
      
      if (yearFraction <= 0) {
        // Item is not active in this year
        return;
      }
      
      let itemValue = item.yearly_value || 0;
      
      // Handle dynamic items (linked to assets or income)
      if (item.linked_item_id && item.linked_item_type === "asset" && item.percentage !== null && item.percentage !== undefined) {
        const projectedAssetValue = assetProjections[item.linked_item_id]?.[year] || 0;
        itemValue = projectedAssetValue * (item.percentage / 100.0);
      } else if (item.linked_item_id && item.linked_item_type === "income" && item.percentage !== null && item.percentage !== undefined) {
        // Expense linked to income - calculate based on linked income value
        const linkedIncomeItem = allIncomeItems.find(i => i.id === item.linked_item_id);
        if (linkedIncomeItem) {
          // Calculate the linked income value for this year
          let linkedIncomeValue = linkedIncomeItem.yearly_value || 0;
          
          // Check if linked income is also dynamic (linked to asset)
          if (linkedIncomeItem.linked_item_id && linkedIncomeItem.linked_item_type === "asset" && linkedIncomeItem.percentage !== null && linkedIncomeItem.percentage !== undefined) {
            const projectedAssetValue = assetProjections[linkedIncomeItem.linked_item_id]?.[year] || 0;
            linkedIncomeValue = projectedAssetValue * (linkedIncomeItem.percentage / 100.0);
          } else {
            // Fixed income - apply growth rate
            const growthRate = (linkedIncomeItem.annual_increase_percent || 0) / 100;
            linkedIncomeValue = linkedIncomeValue * Math.pow(1 + growthRate, year);
          }
          
          // Prorate linked income value based on its active period
          const linkedIncomeYearFraction = calculateYearFraction(linkedIncomeItem.start_date, linkedIncomeItem.end_date, currentProjectionYear);
          linkedIncomeValue = linkedIncomeValue * linkedIncomeYearFraction;
          
          // Calculate expense as percentage of linked income
          itemValue = linkedIncomeValue * (item.percentage / 100.0);
        } else {
          // Linked income item not found - use fixed value with inflation from item
          const itemInflationRate = (item.inflation_percent !== null && item.inflation_percent !== undefined) 
            ? (item.inflation_percent / 100) 
            : 0; // Use 0 if not specified (no inflation)
          itemValue = itemValue * Math.pow(1 + itemInflationRate, year);
        }
      } else {
        // Fixed value item - apply inflation rate from item, not default
        const itemInflationRate = (item.inflation_percent !== null && item.inflation_percent !== undefined) 
          ? (item.inflation_percent / 100) 
          : inflationRate; // Fallback to default if not specified
        itemValue = itemValue * Math.pow(1 + itemInflationRate, year);
      }
      
      // Prorate the value based on how many months the item is active in this year
      itemValue = itemValue * yearFraction;
      
      // Count tax-deductible expenses for tax calculation
      if (item.tax_deductible) {
        totalTaxDeductibleExpenses += itemValue;
      }
      
      categoryTotal += itemValue;
    });
    if (categoryTotal > 0) {
      expenseCategoryTotals[category] = categoryTotal;
      totalCashOut += categoryTotal;
    }
  });
  
  // Calculate federal taxes if the expense item exists
  let federalTax = 0;
  if (federalTaxExpenseItem && userSettings) {
    // Use calculateYearFraction to handle one-time items properly
    const taxYearFraction = calculateYearFraction(federalTaxExpenseItem.start_date, federalTaxExpenseItem.end_date, currentProjectionYear);
    
    if (taxYearFraction > 0) {
      try {
        const taxResult = calculateTaxableIncome(
          totalTaxableIncome,
          totalTaxDeductibleExpenses,
          userSettings.tax_filing_status || "Single",
          userSettings.person1_birthdate,
          userSettings.person2_birthdate,
          currentProjectionYear
        );
        federalTax = taxResult.taxOwed || 0;
        const taxCategory = federalTaxExpenseItem.category || 'Taxes';
        const combinedTax = (federalTax || 0) + (userSettings.calculate_state_tax ? stateTaxProjectionValue : 0);
        if (combinedTax > 0) {
          if (!expenseCategoryTotals[taxCategory]) {
            expenseCategoryTotals[taxCategory] = 0;
          }
          expenseCategoryTotals[taxCategory] += combinedTax;
          totalCashOut += combinedTax;
        }
      } catch (error) {
      }
    }
  }
  
  // Calculate beginning balance for selected year
  // Use BASE model's beginning balance for this year to ensure consistency
  // The beginning balance should be the accumulated ending balance from previous years
  let beginningBalance = 0;
  
  if (baseModel && baseModel.beginningBalances && baseModel.beginningBalances[year] !== undefined) {
    // Use BASE model's beginning balance for this year (which is accumulated from previous years)
    beginningBalance = baseModel.beginningBalances[year] || 0;
  } else {
    // Fallback: Calculate initial cash balance if BASE model not available
    const cashAssets = assets.filter(a => cashAssetIds.includes(a.id));
    cashAssets.forEach(asset => {
      beginningBalance += asset.value || 0;
    });
  }
  
  // Calculate transfers to cash assets (surplus transfers and auto-disbursements)
  const transferSources = {};
  const transferSinks = {}; // For negative surplus (deficit) from cash assets
  
  // Surplus transfer to cash asset (positive surplus adds to cash)
  // Debug logging for Sankey surplus transfer
  const netCashFlow = totalCashIn - totalCashOut;
  
  // Check if surplus asset is configured and is a cash asset
  const hasSurplusAsset = userSettings?.surplus_asset_id && cashAssetIds.includes(userSettings.surplus_asset_id);
  
  if (hasSurplusAsset) {
    if (netCashFlow > 0) {
      // Get surplus asset name
      const surplusAsset = assets.find(a => a.id === userSettings.surplus_asset_id);
      const surplusAssetName = surplusAsset ? surplusAsset.name : 'Surplus Asset';
      transferSources[`Surplus Transfer to ${surplusAssetName}`] = netCashFlow;
      // Don't add to totalCashIn - this is already included in the net cash flow
    } else if (netCashFlow < 0) {
      // Negative surplus (deficit) - cash goes out
      const surplusAsset = assets.find(a => a.id === userSettings.surplus_asset_id);
      const surplusAssetName = surplusAsset ? surplusAsset.name : 'Surplus Asset';
      transferSinks[`Deficit from ${surplusAssetName}`] = Math.abs(netCashFlow);
      // Don't add to totalCashOut - this is already included in the net cash flow
    } else {
    }
  } else {
  }
  
  // Debug: Log transferSources to verify surplus transfer is being added
  
  // Auto-disbursements that target cash assets
  // Calculate the same way as BASE model for consistency
  if (autoDisbursements && Array.isArray(autoDisbursements)) {
    try {
      // Pre-calculate asset projections for this year (same as BASE model)
      const assetProjectionsForYear = {};
      assets.forEach(asset => {
        const growthRate = (asset.annual_increase_percent || 0) / 100;
        let assetValue = asset.value || 0;
        
        // Use calculateYearFraction to handle one-time items and partial years properly
        const yearFraction = calculateYearFraction(asset.start_date, asset.end_date, currentProjectionYear);
        if (yearFraction > 0) {
          assetValue = assetValue * Math.pow(1 + growthRate, year);
        } else {
          assetValue = 0; // Asset is not active in this year
        }
        assetProjectionsForYear[asset.id] = assetValue;
      });
      
      autoDisbursements.forEach(ad => {
        if (!ad || !ad.target_asset_id || !cashAssetIds.includes(ad.target_asset_id)) {
          return;
        }
        if (ad.distribution_type === 'taxable_ira') {
          return;
        }
        // Use calculateYearFraction to handle one-time items properly
        const disbursementYearFraction = calculateYearFraction(ad.start_date, ad.end_date, currentProjectionYear);
        
        if (disbursementYearFraction > 0) {
          // Calculate transfer amount the same way as BASE model
          const sourceAsset = assets.find(a => a.id === ad.source_asset_id);
          if (sourceAsset && assetProjectionsForYear[sourceAsset.id] !== undefined) {
            const sourceValue = assetProjectionsForYear[sourceAsset.id];
            let transferAmount = 0;
            
            if (ad.transfer_type === 'percentage') {
              transferAmount = sourceValue * ((ad.transfer_value || 0) / 100.0);
            } else if (ad.transfer_type === 'fixed' || ad.transfer_type === 'dollar_amount') {
              transferAmount = ad.transfer_value || 0;
            }
            
            if (transferAmount > 0) {
              const targetAsset = assets.find(a => a.id === ad.target_asset_id);
              const sourceName = sourceAsset ? sourceAsset.name : 'Source';
              const targetName = targetAsset ? targetAsset.name : 'Target';
              const transferLabel = `Auto-Disbursement: ${sourceName} → ${targetName}`;
              transferSources[transferLabel] = (transferSources[transferLabel] || 0) + transferAmount;
            }
          }
        }
      });
      
      // Also handle auto-disbursements that SOURCE cash assets (cash going out)
      autoDisbursements.forEach(ad => {
        if (!ad || !ad.source_asset_id || !cashAssetIds.includes(ad.source_asset_id) || cashAssetIds.includes(ad.target_asset_id)) {
          return; // Skip if source is not cash asset, or if target is also cash asset (handled above)
        }
        if (ad.distribution_type === 'taxable_ira') {
          return;
        }
        // Use calculateYearFraction to handle one-time items properly
        const disbursementYearFraction = calculateYearFraction(ad.start_date, ad.end_date, currentProjectionYear);
        
        if (disbursementYearFraction > 0) {
          // Calculate transfer amount the same way as BASE model
          const sourceAsset = assets.find(a => a.id === ad.source_asset_id);
          if (sourceAsset && assetProjectionsForYear[sourceAsset.id] !== undefined) {
            const sourceValue = assetProjectionsForYear[sourceAsset.id];
            let transferAmount = 0;
            
            if (ad.transfer_type === 'percentage') {
              transferAmount = sourceValue * ((ad.transfer_value || 0) / 100.0);
            } else if (ad.transfer_type === 'fixed' || ad.transfer_type === 'dollar_amount') {
              transferAmount = ad.transfer_value || 0;
            }
            
            if (transferAmount > 0) {
              const sourceName = sourceAsset ? sourceAsset.name : 'Source';
              const targetAsset = assets.find(a => a.id === ad.target_asset_id);
              const targetName = targetAsset ? targetAsset.name : 'Target';
              const transferLabel = `Auto-Disbursement: ${sourceName} → ${targetName}`;
              transferSinks[transferLabel] = (transferSinks[transferLabel] || 0) + transferAmount;
            }
          }
        }
      });
    } catch (error) {
    }
  }
  
  // Handle deficit (negative surplus) the same way as BASE model
  // If surplus asset is a cash asset and we have a deficit, add it to cashOut
  let adjustedCashOut = totalCashOut;
  if (userSettings?.surplus_asset_id && cashAssetIds.includes(userSettings.surplus_asset_id)) {
    const netCashFlow = totalCashIn - totalCashOut;
    if (netCashFlow < 0) {
      // Deficit reduces cash (handled as additional cash out, matching BASE model)
      adjustedCashOut += Math.abs(netCashFlow);
    }
  }
  
  // Calculate ending balance (beginning balance + cash in - cash out)
  // Use BASE model's ending balance if available to ensure consistency
  let endingBalance;
  if (baseModel && baseModel.endingBalances && baseModel.endingBalances[year] !== undefined) {
    endingBalance = baseModel.endingBalances[year] || 0;
  } else {
    endingBalance = beginningBalance + totalCashIn - adjustedCashOut;
  }
  
  // Determine whether to display transfers
  const activeTransferSources = includeTransfers ? transferSources : {};
  const activeTransferSinks = includeTransfers ? transferSinks : {};

  // Include transfer sources in income values for scaling
  const allIncomeValues = [...Object.values(incomeCategoryTotals), ...Object.values(activeTransferSources)].filter(v => v && v > 0);
  
  // Find maximum values for proportional scaling
  const incomeValues = Object.values(incomeCategoryTotals).filter(v => v && v > 0);
  const expenseValues = Object.values(expenseCategoryTotals).filter(v => v && v > 0);
  
  // Calculate max values safely
  let maxIncomeValue = 1; // Default to 1 to avoid division by zero
  if (allIncomeValues.length > 0) {
    try {
      maxIncomeValue = Math.max(...allIncomeValues);
    } catch (e) {
      maxIncomeValue = allIncomeValues[0] || 1;
    }
  }
  
  let maxExpenseValue = 1; // Default to 1 to avoid division by zero
  // Only use expense values for scaling (don't include ending balance)
  if (expenseValues.length > 0) {
    try {
      maxExpenseValue = Math.max(...expenseValues);
    } catch (e) {
      maxExpenseValue = expenseValues[0] || 1;
    }
  }
  
  // Flow width configuration - scales from min to max based on flow proportion
  // Using square root scaling to make differences more visible
  const minFlowWidth = 2;
  const maxFlowWidth = 30; // Maximum arrow width in pixels (increased for better visibility)
  
  // Layout dimensions
  const width = 1200;
  const leftColumnX = 50;
  const centerColumnX = width / 2 - 50;
  const rightColumnX = width - 200;
  const columnWidth = 150;
  const nodeHeight = 30;
  const nodeSpacing = 40;
  const startY = 50;
  
  // Sort categories by value (highest first)
  const incomeCategories = Object.keys(incomeByCategory).sort((a, b) => {
    const aValue = incomeCategoryTotals[a] || 0;
    const bValue = incomeCategoryTotals[b] || 0;
    return bValue - aValue; // Descending order
  });
  
  const expenseCategories = Object.keys(expenseByCategory).sort((a, b) => {
    const aValue = expenseCategoryTotals[a] || 0;
    const bValue = expenseCategoryTotals[b] || 0;
    return bValue - aValue; // Descending order
  });
  
  // Calculate node positions first to determine actual height needed
  let currentY = startY;
  const nodePositions = {};
  
  // Left side: Cash Balance Jan 1 at the top
  nodePositions['beginning_balance'] = { x: leftColumnX, y: currentY, width: columnWidth, height: nodeHeight };
  currentY += nodeHeight + nodeSpacing;
  
  // Left side (transfer sources - surplus and auto-disbursements to cash assets)
  Object.keys(activeTransferSources).forEach(transferLabel => {
    nodePositions[`transfer_${transferLabel}`] = { x: leftColumnX, y: currentY, width: columnWidth, height: nodeHeight };
    currentY += nodeHeight + nodeSpacing;
  });
  
  // Left side (income sources) - sorted by value, highest first
  incomeCategories.forEach(category => {
    nodePositions[`source_${category}`] = { x: leftColumnX, y: currentY, width: columnWidth, height: nodeHeight };
    currentY += nodeHeight + nodeSpacing;
  });
  
  const maxLeftY = currentY;
  
  // Right side: Cash Balance Dec 31 at the top
  currentY = startY;
  nodePositions['ending_balance'] = { x: rightColumnX, y: currentY, width: columnWidth, height: nodeHeight };
  currentY += nodeHeight + nodeSpacing;
  
  // Right side (transfer sinks - negative surplus/deficit from cash assets)
  Object.keys(activeTransferSinks).forEach(transferLabel => {
    nodePositions[`transfer_sink_${transferLabel}`] = { x: rightColumnX, y: currentY, width: columnWidth, height: nodeHeight };
    currentY += nodeHeight + nodeSpacing;
  });
  
  // Right side (expense sinks) - sorted by value, highest first
  expenseCategories.forEach(category => {
    nodePositions[`sink_${category}`] = { x: rightColumnX, y: currentY, width: columnWidth, height: nodeHeight };
    currentY += nodeHeight + nodeSpacing;
  });
  
  const maxRightY = currentY + 50; // Add bottom padding for expenses
  
  // Calculate height needed for expenses first
  const expenseHeight = Math.max(maxLeftY, maxRightY);
  
  // Center (wallet) - position in the middle of the expense area
  const walletY = expenseHeight / 2 - nodeHeight / 2;
  nodePositions['wallet'] = { x: centerColumnX, y: walletY, width: columnWidth, height: nodeHeight };
  
  // Calculate actual height needed
  const calculatedHeight = Math.max(600, expenseHeight);
  
  const height = calculatedHeight;

  const piePalette = ['#4CAF50', '#2196F3', '#FFC107', '#FF5722', '#9C27B0', '#00BCD4', '#FF9800', '#E53935', '#00897B', '#7E57C2'];

  const buildPieChartEntries = (categoryTotals) => {
    return Object.entries(categoryTotals || {})
      .map(([label, value]) => ({
        label: label || 'Other',
        value: Math.max(value || 0, 0),
      }))
      .filter(entry => entry.value > 0);
  };

  const buildPieChartData = (entries, colorMapper) => {
    if (!entries || entries.length === 0) {
      return null;
    }

    const labels = entries.map(entry => entry.label);
    const data = entries.map(entry => entry.value);
    const backgroundColor = labels.map((label, index) => {
      const defaultColor = piePalette[index % piePalette.length];
      return typeof colorMapper === 'function' ? colorMapper(label, index, defaultColor) : defaultColor;
    });

    return {
      labels,
      datasets: [
        {
          data,
          backgroundColor,
          borderColor: '#fff',
          borderWidth: 2,
        },
      ],
    };
  };

  const pieChartOptions = {
    maintainAspectRatio: false,
    responsive: true,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          boxWidth: 12,
          padding: 12,
        },
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const value = Number(context.raw) || 0;
            const dataset = context.dataset?.data || [];
            const total = dataset.reduce((sum, datum) => sum + (Number(datum) || 0), 0);
            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
            return `${context.label || 'Value'}: ${safeFormatCurrency(value)} (${percentage}%)`;
          },
        },
      },
    },
  };

  const extendTotalsWithTransfers = (totals, transfers) => {
    const combined = { ...(totals || {}) };
    Object.entries(transfers || {}).forEach(([label, amount]) => {
      const value = Number(amount) || 0;
      if (value <= 0 || !label) {
        return;
      }
      if (combined[label]) {
        return;
      }
      combined[label] = value;
    });
    return combined;
  };

  const getIncomeSliceColor = (label, index, defaultColor) => {
    if (typeof label === 'string' && label.toLowerCase().includes('surplus transfer')) {
      return '#9E9E9E';
    }
    return defaultColor;
  };

  const getExpenseSliceColor = (label, index, defaultColor) => {
    if (typeof label === 'string' && label.toLowerCase().includes('deficit')) {
      return '#9E9E9E';
    }
    return defaultColor;
  };

  const includeTransferTotals = includeTransfers && viewMode === 'sankey';
  const incomePieTotals = includeTransferTotals
    ? extendTotalsWithTransfers(incomeCategoryTotals, transferSources)
    : { ...incomeCategoryTotals };
  const expensePieTotals = includeTransferTotals
    ? extendTotalsWithTransfers(expenseCategoryTotals, transferSinks)
    : { ...expenseCategoryTotals };
  const incomePieEntries = buildPieChartEntries(incomePieTotals);
  const incomePieChartData = buildPieChartData(incomePieEntries, getIncomeSliceColor);
  const expensePieEntries = buildPieChartEntries(expensePieTotals);
  const expensePieChartData = buildPieChartData(expensePieEntries, getExpenseSliceColor);
  const incomePieEntriesSorted = [...incomePieEntries].sort((a, b) => (b.value || 0) - (a.value || 0));
  const expensePieEntriesSorted = [...expensePieEntries].sort((a, b) => (b.value || 0) - (a.value || 0));
  const incomePieTotal = incomePieEntries.reduce((sum, entry) => sum + (entry.value || 0), 0);
  const expensePieTotal = expensePieEntries.reduce((sum, entry) => sum + (entry.value || 0), 0);
  const formatPercent = (value, total) => {
    if (!total || total === 0) {
      return '0.0%';
    }
    return `${((value / total) * 100).toFixed(1)}%`;
  };

  if (viewMode === 'pie') {
    const paneStyle = {
      flex: '1 1 320px',
      minWidth: '300px',
      backgroundColor: 'white',
      borderRadius: '8px',
      border: '1px solid #e0e0e0',
      padding: '20px',
      boxShadow: '0 4px 16px rgba(15, 23, 42, 0.08)',
    };

    const tableCardStyle = {
      flex: '1 1 300px',
      minWidth: '280px',
      backgroundColor: '#fff',
      borderRadius: '8px',
      border: '1px solid #e0e0e0',
      padding: '16px',
      boxShadow: '0 2px 8px rgba(15, 23, 42, 0.06)',
    };

    const tableHeaderCell = {
      textAlign: 'left',
      padding: '6px 8px',
      fontSize: '0.85em',
      color: '#555',
    };

    const tableValueCell = {
      padding: '6px 8px',
      borderTop: '1px solid #f0f0f0',
      fontSize: '0.9em',
      color: '#333',
    };

    return (
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={paneStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px' }}>
            <h4 style={{ margin: 0 }}>Cash In Categories</h4>
            <span style={{ fontSize: '0.9em', color: '#555' }}>{safeFormatCurrency(incomePieTotal)}</span>
          </div>
          {incomePieChartData ? (
            <div style={{ minHeight: '320px' }}>
              <Chart type="pie" data={incomePieChartData} options={pieChartOptions} />
            </div>
          ) : (
            <p style={{ margin: 0, color: '#555', fontSize: '0.9em' }}>No cash in data available for this year.</p>
          )}
        </div>
        <div style={paneStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px' }}>
            <h4 style={{ margin: 0 }}>Cash Out Categories</h4>
            <span style={{ fontSize: '0.9em', color: '#555' }}>{safeFormatCurrency(expensePieTotal)}</span>
          </div>
          {expensePieChartData ? (
            <div style={{ minHeight: '320px' }}>
              <Chart type="pie" data={expensePieChartData} options={pieChartOptions} />
            </div>
          ) : (
            <p style={{ margin: 0, color: '#555', fontSize: '0.9em' }}>No expenses available for this year.</p>
          )}
        </div>
        <div style={{ marginTop: '12px', width: '100%', display: 'flex', flexWrap: 'wrap', gap: '24px' }}>
          <div style={tableCardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px' }}>
              <h5 style={{ margin: 0 }}>Cash In Data</h5>
              <span style={{ fontSize: '0.85em', color: '#777' }}>{incomePieEntries.length} categories</span>
            </div>
            {incomePieEntriesSorted.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={tableHeaderCell}>Category</th>
                      <th style={{ ...tableHeaderCell, textAlign: 'right' }}>Amount</th>
                      <th style={{ ...tableHeaderCell, textAlign: 'right' }}>Percent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {incomePieEntriesSorted.map(entry => (
                      <tr key={`income-table-${entry.label}`}>
                        <td style={tableValueCell}>{entry.label}</td>
                        <td style={{ ...tableValueCell, textAlign: 'right' }}>{safeFormatCurrency(entry.value)}</td>
                        <td style={{ ...tableValueCell, textAlign: 'right' }}>{formatPercent(entry.value, incomePieTotal)}</td>
                      </tr>
                    ))}
                    <tr>
                      <td style={{ padding: '6px 8px', borderTop: '1px solid #222', fontSize: '0.9em', fontWeight: '600', color: '#111' }}>Total</td>
                      <td style={{ padding: '6px 8px', borderTop: '1px solid #222', fontSize: '0.9em', fontWeight: '600', color: '#111', textAlign: 'right' }}>{safeFormatCurrency(incomePieTotal)}</td>
                      <td style={{ padding: '6px 8px', borderTop: '1px solid #222', fontSize: '0.9em', fontWeight: '600', color: '#111', textAlign: 'right' }}>{formatPercent(incomePieTotal, incomePieTotal)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ margin: 0, color: '#555', fontSize: '0.9em' }}>No cash in categories to show.</p>
            )}
          </div>
          <div style={tableCardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px' }}>
              <h5 style={{ margin: 0 }}>Cash Out Data</h5>
              <span style={{ fontSize: '0.85em', color: '#777' }}>{expensePieEntries.length} categories</span>
            </div>
            {expensePieEntriesSorted.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={tableHeaderCell}>Category</th>
                      <th style={{ ...tableHeaderCell, textAlign: 'right' }}>Amount</th>
                      <th style={{ ...tableHeaderCell, textAlign: 'right' }}>Percent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expensePieEntriesSorted.map(entry => (
                      <tr key={`expense-table-${entry.label}`}>
                        <td style={tableValueCell}>{entry.label}</td>
                        <td style={{ ...tableValueCell, textAlign: 'right' }}>{safeFormatCurrency(entry.value)}</td>
                        <td style={{ ...tableValueCell, textAlign: 'right' }}>{formatPercent(entry.value, expensePieTotal)}</td>
                      </tr>
                    ))}
                    <tr>
                      <td style={{ padding: '6px 8px', borderTop: '1px solid #222', fontSize: '0.9em', fontWeight: '600', color: '#111' }}>Total</td>
                      <td style={{ padding: '6px 8px', borderTop: '1px solid #222', fontSize: '0.9em', fontWeight: '600', color: '#111', textAlign: 'right' }}>{safeFormatCurrency(expensePieTotal)}</td>
                      <td style={{ padding: '6px 8px', borderTop: '1px solid #222', fontSize: '0.9em', fontWeight: '600', color: '#111', textAlign: 'right' }}>{formatPercent(expensePieTotal, expensePieTotal)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ margin: 0, color: '#555', fontSize: '0.9em' }}>No expenses categories to show.</p>
            )}
          </div>
        </div>
      </div>
    );
  }
  
  // Early return if no data
  if (incomeCategories.length === 0 && expenseCategories.length === 0) {
    return (
      <div style={{ padding: '20px', backgroundColor: '#fff3cd', border: '1px solid #ffeaa7', borderRadius: '4px', marginBottom: '20px' }}>
        <strong>Note:</strong> No income or expense data available to display in the Sankey Diagram.
      </div>
    );
  }
  
  return (
    <div style={{ width: '100%', display: 'block' }}>
      <svg width={width} height={height} style={{ display: 'block' }}>
        {/* Cash Balance Jan 1 (left side, above income) */}
        {(() => {
          const pos = nodePositions['beginning_balance'];
          const nodeWidth = columnWidth;
          
          return (
            <g key="beginning_balance">
              <rect
                x={pos.x}
                y={pos.y}
                width={nodeWidth}
                height={pos.height}
                fill="#FF9800"
                stroke="#F57C00"
                strokeWidth="2"
                rx="4"
              />
              <text
                x={pos.x + nodeWidth + 10}
                y={pos.y + pos.height / 2}
                fill="#333"
                fontSize="12"
                fontWeight="bold"
                dominantBaseline="middle"
              >
                Cash Balance Jan 1: {safeFormatCurrency(beginningBalance)}
              </text>
            </g>
          );
        })()}
        
        {/* Transfer source nodes (left) - Surplus transfers and auto-disbursements to cash */}
        {Object.keys(activeTransferSources).map((transferLabel) => {
          const pos = nodePositions[`transfer_${transferLabel}`];
          const value = activeTransferSources[transferLabel] || 0;
          const nodeWidth = columnWidth;
          
          // Check if this is a Surplus transfer (gray) or Auto-Disbursement (orange)
          const isSurplusTransfer = transferLabel.startsWith('Surplus Transfer to');
          const nodeFill = isSurplusTransfer ? "#9E9E9E" : "#FF9800"; // Gray for surplus, orange for auto-disbursements
          const nodeStroke = isSurplusTransfer ? "#616161" : "#F57C00"; // Darker gray for surplus, darker orange for auto-disbursements
          
          return (
            <g key={`transfer_${transferLabel}`}>
              <rect
                x={pos.x}
                y={pos.y}
                width={nodeWidth}
                height={pos.height}
                fill={nodeFill}
                stroke={nodeStroke}
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
                {transferLabel}: {safeFormatCurrency(value || 0)}
              </text>
            </g>
          );
        })}
        
        {/* Source nodes (left) - Income categories */}
        {incomeCategories.map((category, idx) => {
          const pos = nodePositions[`source_${category}`];
          const value = incomeCategoryTotals[category] || 0;
          // Use fixed width for all nodes
          const nodeWidth = columnWidth;
          
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
                {category}: {safeFormatCurrency(value || 0)}
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
        
        {/* Cash Balance Dec 31 (right side, above expenses) */}
        {(() => {
          const pos = nodePositions['ending_balance'];
          const nodeWidth = columnWidth;
          const nodeFill = endingBalance < 0 ? "#F44336" : "#2196F3";
          const nodeStroke = endingBalance < 0 ? "#C62828" : "#1565C0";
          const labelText = endingBalance < 0 ? `Cash Balance Dec 31: ${safeFormatCurrency(endingBalance)}` : `Cash Balance Dec 31: ${safeFormatCurrency(endingBalance)}`;
          
          return (
            <g key="ending_balance">
              <rect
                x={pos.x - nodeWidth}
                y={pos.y}
                width={nodeWidth}
                height={pos.height}
                fill={nodeFill}
                stroke={nodeStroke}
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
                {labelText}
              </text>
            </g>
          );
        })()}
        
        {/* Transfer sink nodes (right) - Negative surplus/deficit from cash assets */}
        {Object.keys(activeTransferSinks).map((transferLabel) => {
          const pos = nodePositions[`transfer_sink_${transferLabel}`];
          const value = activeTransferSinks[transferLabel] || 0;
          const nodeWidth = columnWidth;
          
          // Deficit transfers are gray
          const nodeFill = "#9E9E9E"; // Gray for deficit
          const nodeStroke = "#616161"; // Darker gray for deficit
          
          return (
            <g key={`transfer_sink_${transferLabel}`}>
              <rect
                x={pos.x - nodeWidth}
                y={pos.y}
                width={nodeWidth}
                height={pos.height}
                fill={nodeFill}
                stroke={nodeStroke}
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
                {transferLabel}: {safeFormatCurrency(value || 0)}
              </text>
            </g>
          );
        })}
        
        {/* Sink nodes (right) - Expense categories */}
        {expenseCategories.map((category, idx) => {
          const pos = nodePositions[`sink_${category}`];
          const value = expenseCategoryTotals[category] || 0;
          // Use fixed width for all nodes
          const nodeWidth = columnWidth;
          
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
                {category}: {safeFormatCurrency(value || 0)}
              </text>
            </g>
          );
        })}
        
        
        {/* Flow lines from transfer sources (surplus and auto-disbursements) to wallet */}
        {Object.keys(activeTransferSources).map((transferLabel) => {
          const pos = nodePositions[`transfer_${transferLabel}`];
          const value = activeTransferSources[transferLabel] || 0;
          
          // Check if this is a Surplus transfer (gray) or Auto-Disbursement (orange)
          const isSurplusTransfer = transferLabel.startsWith('Surplus Transfer to');
          const flowColor = isSurplusTransfer ? "#9E9E9E" : "#FF9800"; // Gray for surplus, orange for auto-disbursements
          
          // Calculate proportional width: scale based on maxIncomeValue
          const flowProportion = maxIncomeValue > 0 ? value / maxIncomeValue : 0;
          const sqrtProportion = Math.sqrt(flowProportion);
          const strokeWidth = minFlowWidth + (sqrtProportion * (maxFlowWidth - minFlowWidth));
          
          const walletPos = nodePositions['wallet'];
          
          return (
            <path
              key={`flow_transfer_${transferLabel}`}
              d={`M ${pos.x + columnWidth} ${pos.y + pos.height / 2} 
                  L ${walletPos.x} ${walletPos.y + walletPos.height / 2}`}
              fill="none"
              stroke={flowColor}
              strokeWidth={strokeWidth}
              opacity="0.6"
              strokeLinecap="round"
              strokeDasharray="5,5"
            />
          );
        })}
        
        {/* Flow lines from income sources to wallet */}
        {incomeCategories.map((category, idx) => {
          const sourcePos = nodePositions[`source_${category}`];
          const walletPos = nodePositions['wallet'];
          const value = incomeCategoryTotals[category] || 0;
          // Calculate proportional width: scale based on maxIncomeValue
          // Use square root scaling to make differences more visible
          const flowProportion = maxIncomeValue > 0 ? value / maxIncomeValue : 0;
          const sqrtProportion = Math.sqrt(flowProportion); // Square root makes smaller values more distinguishable
          const strokeWidth = minFlowWidth + (sqrtProportion * (maxFlowWidth - minFlowWidth));
          
          return (
            <path
              key={`flow_source_${category}`}
              d={`M ${sourcePos.x + columnWidth} ${sourcePos.y + sourcePos.height / 2} 
                  L ${walletPos.x} ${walletPos.y + walletPos.height / 2}`}
              fill="none"
              stroke="#4CAF50"
              strokeWidth={strokeWidth}
              opacity="0.6"
              strokeLinecap="round"
            />
          );
        })}
        
        {/* Flow lines from wallet to transfer sinks (negative surplus/deficit) */}
        {Object.keys(activeTransferSinks).map((transferLabel) => {
          const walletPos = nodePositions['wallet'];
          const sinkPos = nodePositions[`transfer_sink_${transferLabel}`];
          const value = activeTransferSinks[transferLabel] || 0;
          
          // Deficit flow lines are gray
          const flowColor = "#9E9E9E"; // Gray for deficit
          
          // Calculate proportional width: scale based on maxExpenseValue
          const flowProportion = maxExpenseValue > 0 ? value / maxExpenseValue : 0;
          const sqrtProportion = Math.sqrt(flowProportion);
          const strokeWidth = minFlowWidth + (sqrtProportion * (maxFlowWidth - minFlowWidth));
          
          // Attach to the left edge of the transfer sink box
          const sinkLeftEdge = sinkPos.x - columnWidth;
          
          return (
            <path
              key={`flow_transfer_sink_${transferLabel}`}
              d={`M ${walletPos.x + walletPos.width} ${walletPos.y + walletPos.height / 2} 
                  L ${sinkLeftEdge} ${sinkPos.y + sinkPos.height / 2}`}
              fill="none"
              stroke={flowColor}
              strokeWidth={strokeWidth}
              opacity="0.6"
              strokeLinecap="round"
              strokeDasharray="5,5"
            />
          );
        })}
        
        {/* Flow lines from wallet to sinks */}
        {expenseCategories.map((category, idx) => {
          const walletPos = nodePositions['wallet'];
          const sinkPos = nodePositions[`sink_${category}`];
          const value = expenseCategoryTotals[category] || 0;
          // Calculate proportional width: scale based on maxExpenseValue
          // Use square root scaling to make differences more visible
          const flowProportion = maxExpenseValue > 0 ? value / maxExpenseValue : 0;
          const sqrtProportion = Math.sqrt(flowProportion); // Square root makes smaller values more distinguishable
          const strokeWidth = minFlowWidth + (sqrtProportion * (maxFlowWidth - minFlowWidth));
          
          // Attach to the left edge of the expense category box
          const sinkLeftEdge = sinkPos.x - columnWidth;
          
          return (
            <path
              key={`flow_sink_${category}`}
              d={`M ${walletPos.x + walletPos.width} ${walletPos.y + walletPos.height / 2} 
                  L ${sinkLeftEdge} ${sinkPos.y + sinkPos.height / 2}`}
              fill="none"
              stroke="#F44336"
              strokeWidth={strokeWidth}
              opacity="0.6"
              strokeLinecap="round"
            />
          );
        })}
        
      </svg>
    </div>
  );
}

function TabPanel({ children, value, index }) {
  return (
    <div role="tabpanel" hidden={value !== index} aria-hidden={value !== index}>
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

export default function CashFlowOverview({ incomeItems = [], expenseItems = [], projectionYears = 30, formatCurrency, assets = [], userSettings = null, autoDisbursements = [], liabilities = [], compact = false, showProjectionYearSelector = false, onProjectionYearsChange, maxProjectionYears, isLimitedPlan = false }) {
  const { currentUser } = useAuth();
  const currentYear = new Date().getFullYear();
  const chartRef = useRef(null);
  const baseChartRef = useRef(null);
  const tableRef = useRef(null);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'base', 'sankey'
  const [sankeyYear, setSankeyYear] = useState(0); // Year offset for Sankey diagram (0 = current year)
  const [sankeyViewMode, setSankeyViewMode] = useState('pie'); // Toggle between Sankey and Pie charts
  const [includeTransfers, setIncludeTransfers] = useState(false);
  const [projectionData, setProjectionData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [useSeparateYAxis, setUseSeparateYAxis] = useState(true); // Toggle for separate y-axis in BASE model
  const [showTotalAssets, setShowTotalAssets] = useState(false); // Toggle for showing Total Assets in BASE model
  const [sliderProjectionYears, setSliderProjectionYears] = useState(projectionYears ?? 30);
  const missingDataMessage = "No data yet. Add income and/or expenses to generate projections.";

  const getProjectionErrorMessage = (err) => {
    const detail = err?.response?.data?.detail;
    if (detail && typeof detail === "string") return detail;
    if (err?.response?.status === 403) return missingDataMessage;
    return err?.message || "Failed to calculate projections";
  };
  // Ensure formatCurrency has a default
  const safeFormatCurrency = formatCurrency || ((v) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v ?? 0)
  );

  useEffect(() => {
    setSliderProjectionYears(projectionYears ?? 30);
  }, [projectionYears]);

  const cashAssetIds = useMemo(() => userSettings?.cash_asset_ids || [], [userSettings?.cash_asset_ids]);
  const autoDisbursementCashFlowAdjustments = useMemo(() => {
    const totalYears = Math.max((projectionYears ?? 0), 0) + 1;
    const transferSourcesByYear = Array.from({ length: totalYears }, () => 0);
    const transferSinksByYear = Array.from({ length: totalYears }, () => 0);

    if (!autoDisbursements || autoDisbursements.length === 0 || !assets || assets.length === 0) {
      return { transferSourcesByYear, transferSinksByYear };
    }

    const assetProjections = {};
    assets.forEach(asset => {
      assetProjections[asset.id] = [];
      for (let year = 0; year < totalYears; year++) {
        const projectionYear = currentYear + year;
        const assetYearFraction = calculateYearFraction(asset.start_date, asset.end_date, projectionYear);
        if (assetYearFraction > 0) {
          const growthRate = (asset.annual_increase_percent || 0) / 100;
          const assetValue = (asset.value || 0) * Math.pow(1 + growthRate, year);
          assetProjections[asset.id].push(assetValue);
        } else {
          assetProjections[asset.id].push(0);
        }
      }
    });

    autoDisbursements.forEach(ad => {
      if (!ad) {
        return;
      }

      for (let year = 0; year < totalYears; year++) {
        const projectionYear = currentYear + year;
        const disbursementYearFraction = calculateYearFraction(ad.start_date, ad.end_date, projectionYear);
        if (disbursementYearFraction <= 0) {
          continue;
        }

        const sourceAsset = assets.find(asset => asset.id === ad.source_asset_id);
        let sourceValue = assetProjections[ad.source_asset_id]?.[year] || 0;
        if (projectionData && Array.isArray(projectionData) && projectionData[year] && sourceAsset?.name) {
          const projectionKey = `${sourceAsset.name}_Value`;
          if (projectionData[year][projectionKey] != null) {
            sourceValue = projectionData[year][projectionKey];
          }
        }
        let transferAmount = 0;
        if (ad.use_rmd && userSettings?.person1_birthdate) {
          const overrideKey = projectionYear;
          const overrideVal = ad.rmd_overrides ? (ad.rmd_overrides[overrideKey] ?? ad.rmd_overrides[String(overrideKey)]) : null;
          if (overrideVal != null && overrideVal !== '') {
            transferAmount = Number(overrideVal) || 0;
          } else {
            const spouseBirthdate = userSettings.person2_birthdate || null;
            const rmdResult = calculateRmd(userSettings.person1_birthdate, Math.abs(sourceValue), projectionYear, spouseBirthdate);
            transferAmount = rmdResult?.rmd_amount || 0;
          }
        } else if (ad.transfer_type === 'percentage') {
          transferAmount = sourceValue * ((ad.transfer_value || 0) / 100.0);
        } else if (ad.transfer_type === 'fixed' || ad.transfer_type === 'dollar_amount') {
          transferAmount = ad.transfer_value || 0;
        }

        if (transferAmount <= 0) {
          continue;
        }

        if (cashAssetIds.includes(ad.target_asset_id)) {
          transferSourcesByYear[year] += transferAmount;
        }

        if (cashAssetIds.includes(ad.source_asset_id) && !cashAssetIds.includes(ad.target_asset_id)) {
          transferSinksByYear[year] += transferAmount;
        }
      }
    });

    return {
      transferSourcesByYear,
      transferSinksByYear
    };
  }, [autoDisbursements, assets, projectionYears, currentYear, cashAssetIds, projectionData, userSettings?.person1_birthdate, userSettings?.person2_birthdate]);

  // Fetch projection data from backend
  const fetchProjectionData = useCallback(async () => {
    if (!assets || !liabilities) {
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Convert assets to ProjectedAccountCreate format
      const assetAccounts = (assets || []).map(asset => ({
        name: asset.name,
        account_type: 'asset',
        initial_value: asset.value || 0,
        contribution: 0.0,
        growth_rate: asset.annual_increase_percent || 0,
        loan_type: null,
        principal_amount: null,
        interest_rate: null,
        loan_term_months: null,
        loan_start_date: null,
        monthly_payment: null,
        start_date: asset.start_date || null,
        end_date: asset.end_date || null
      }));

      // Convert liabilities to ProjectedAccountCreate format
      const liabilityAccounts = (liabilities || []).map(liability => ({
        name: liability.name,
        account_type: 'liability',
        initial_value: -(Math.abs(liability.value || 0)), // Negative for liabilities
        contribution: 0.0,
        growth_rate: liability.annual_increase_percent || 0,
        loan_type: liability.loan_type || null,
        principal_amount: liability.principal_amount || null,
        interest_rate: liability.interest_rate || null,
        loan_term_months: liability.loan_term_months || null,
        loan_start_date: liability.loan_start_date || null,
        monthly_payment: liability.monthly_payment || null,
        start_date: liability.start_date || null,
        end_date: liability.end_date || null
      }));

      // Convert income items to ProjectedAccountCreate format
      const incomeAccounts = (incomeItems || []).map(income => {
        let accountName = income.description;
        
        if (income.linked_item_type === "asset" && income.percentage !== null && income.percentage !== undefined) {
          if (income.linked_asset_ids && income.linked_asset_ids.length > 0) {
            const linkedAssets = assets.filter(a => income.linked_asset_ids.includes(a.id));
            if (linkedAssets.length > 0) {
              const assetNames = linkedAssets.map(a => a.name).join(',');
              accountName = `${income.description}|LINKED:${assetNames}|PERCENTAGE:${income.percentage}`;
            }
          } else if (income.linked_item_id) {
            const linkedAsset = assets.find(a => a.id === income.linked_item_id);
            if (linkedAsset) {
              accountName = `${income.description}|LINKED:${linkedAsset.name}|PERCENTAGE:${income.percentage}`;
            }
          }
        }
        
        let incomeStartDate = income.start_date || null;
        let incomeEndDate = income.end_date || null;
        if (income.frequency === 'one-time') {
          const oneTimeDate = incomeStartDate || incomeEndDate;
          if (oneTimeDate) {
            incomeStartDate = oneTimeDate;
            incomeEndDate = oneTimeDate;
          }
        }
        
        return {
          name: accountName,
          account_type: 'income',
          initial_value: 0.0,
          contribution: income.linked_item_type !== "asset" ? (income.yearly_value || 0) / 12 : 0.0,
          growth_rate: income.annual_increase_percent || 0,
          loan_type: null,
          principal_amount: null,
          interest_rate: null,
          loan_term_months: null,
          loan_start_date: null,
          monthly_payment: null,
          start_date: incomeStartDate,
          end_date: incomeEndDate,
          cash_flow_item_id: income.id || null  // Pass the income item ID for reinvest_dividends lookup
        };
      });

      // Convert expense items to ProjectedAccountCreate format
      const expenseAccounts = (expenseItems || []).map(expense => {
        let accountName = expense.description;
        
        if (expense.linked_item_type === "income" && expense.percentage !== null && expense.percentage !== undefined) {
          const linkedIncomeItem = incomeItems.find(i => i.id === expense.linked_item_id);
          if (linkedIncomeItem) {
            accountName = `${expense.description}|LINKED_INCOME:${linkedIncomeItem.description}|PERCENTAGE:${expense.percentage}`;
          }
        } else if (expense.linked_item_type === "asset" && expense.percentage !== null && expense.percentage !== undefined) {
          if (expense.linked_asset_ids && expense.linked_asset_ids.length > 0) {
            const linkedAssets = assets.filter(a => expense.linked_asset_ids.includes(a.id));
            if (linkedAssets.length > 0) {
              const assetNames = linkedAssets.map(a => a.name).join(',');
              accountName = `${expense.description}|LINKED:${assetNames}|PERCENTAGE:${expense.percentage}`;
            }
          } else if (expense.linked_item_id) {
            const linkedAsset = assets.find(a => a.id === expense.linked_item_id);
            if (linkedAsset) {
              accountName = `${expense.description}|LINKED:${linkedAsset.name}|PERCENTAGE:${expense.percentage}`;
            }
          }
        }
        
        let expenseStartDate = expense.start_date || null;
        let expenseEndDate = expense.end_date || null;
        if (expense.frequency === 'one-time') {
          const oneTimeDate = expenseStartDate || expenseEndDate;
          if (oneTimeDate) {
            expenseStartDate = oneTimeDate;
            expenseEndDate = oneTimeDate;
          }
        }
        
        return {
          name: accountName,
          account_type: 'expense',
          initial_value: 0.0,
          contribution: -(expense.yearly_value || 0) / 12, // Negative for expenses
          growth_rate: expense.inflation_percent || 0,
          loan_type: null,
          principal_amount: null,
          interest_rate: null,
          loan_term_months: null,
          loan_start_date: null,
          monthly_payment: null,
          start_date: expenseStartDate,
          end_date: expenseEndDate,
          cash_flow_item_id: expense.id || null  // Pass the expense item ID for tax_deductible lookup
        };
      });

      const allAccounts = [...assetAccounts, ...liabilityAccounts, ...incomeAccounts, ...expenseAccounts];
      
      const projectionRequest = {
        plan_name: "Cash Flow Projection",
        years: projectionYears,
        accounts: allAccounts
      };

      // Check if a "Cash Flow Projection" already exists and update it, otherwise create new
      let projectionId = null;
      let canUpdate = false;
      try {
        const existingProjections = await ProjectionService.getProjections();
        const existing = existingProjections.find(p => p.name === "Cash Flow Projection");
        if (existing) {
          // Only attempt update if we own the projection
          if (existing.owner_id === currentUser?.id) {
            projectionId = existing.id;
            canUpdate = true;
          }
        }
      } catch (e) {
      }

      let projection;
      if (projectionId && canUpdate) {
        try {
          projection = await ProjectionService.updateProjection(projectionId, projectionRequest);
        } catch (err) {
          // If update fails for any reason, create a new one
          projection = await ProjectionService.createProjection(projectionRequest);
        }
      } else {
        projection = await ProjectionService.createProjection(projectionRequest);
      }

      // Notify auto-disbursements to refresh RMD values after projection run.
      window.dispatchEvent(new CustomEvent('rmdRefreshRequested', { detail: { source: 'cashFlowOverviewProjection', projectionId: projection.id || projectionId } }));

      // Parse the data_json
      if (projection.data_json) {
        const parsedData = JSON.parse(projection.data_json);
        setProjectionData(parsedData);
      } else {
        const fullProjection = await ProjectionService.getProjectionDetails(projection.id || projectionId);
        if (fullProjection.data_json) {
          const parsedData = JSON.parse(fullProjection.data_json);
          setProjectionData(parsedData);
        }
      }
    } catch (err) {
      setError(getProjectionErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [assets, liabilities, incomeItems, expenseItems, projectionYears]);

  // Track critical field changes that affect projections
  // This ensures projections recalculate when key fields change, even if array references stay the same
  const projectionDependencyHash = useMemo(() => {
    // Create a hash of all critical fields that affect projections
    const hashes = [];
    
    // Income items: track values, dates, rates, linking, and dividend reinvestment
    if (incomeItems && incomeItems.length > 0) {
      hashes.push('income:' + incomeItems.map(item => 
        `${item.id}:${item.yearly_value || 0}:${item.annual_increase_percent || 0}:${item.start_date || ''}:${item.end_date || ''}:${item.frequency || ''}:${item.taxable || false}:${item.linked_item_id || ''}:${item.linked_item_type || ''}:${item.percentage || ''}:${JSON.stringify(item.linked_asset_ids || [])}:${item.reinvest_dividends || false}:${item.reinvestment_account_id || ''}:${item.contributes_to_asset_id || ''}`
      ).join('|'));
    }
    
    // Expense items: track values, dates, rates, linking, and asset contributions
    if (expenseItems && expenseItems.length > 0) {
      hashes.push('expense:' + expenseItems.map(item => 
        `${item.id}:${item.yearly_value || 0}:${item.inflation_percent || 0}:${item.start_date || ''}:${item.end_date || ''}:${item.frequency || ''}:${item.tax_deductible || false}:${item.linked_item_id || ''}:${item.linked_item_type || ''}:${item.percentage || ''}:${JSON.stringify(item.linked_asset_ids || [])}:${item.contributes_to_asset_id || ''}`
      ).join('|'));
    }
    
    // Assets: track values, growth rates, dates, and account relationships (for retirement account detection)
    if (assets && assets.length > 0) {
      hashes.push('asset:' + assets.map(item => 
        `${item.id}:${item.value || 0}:${item.annual_increase_percent || 0}:${item.start_date || ''}:${item.end_date || ''}:${item.account_id || ''}`
      ).join('|'));
    }
    
    // Liabilities: track values, rates, dates, and loan-specific fields
    if (liabilities && liabilities.length > 0) {
      hashes.push('liability:' + liabilities.map(item => 
        `${item.id}:${item.value || item.principal_amount || 0}:${item.annual_increase_percent || 0}:${item.interest_rate || 0}:${item.loan_type || ''}:${item.loan_term_months || ''}:${item.monthly_payment || ''}:${item.loan_start_date || ''}:${item.start_date || ''}:${item.end_date || ''}`
      ).join('|'));
    }
    
    return hashes.join('||');
  }, [incomeItems, expenseItems, assets, liabilities]);

  useEffect(() => {
    fetchProjectionData();
  }, [fetchProjectionData, projectionDependencyHash]);

  // Parse projection data into the format needed for charts/tables
  const parseProjectionData = () => {
    if (!projectionData || !Array.isArray(projectionData) || projectionData.length === 0) {
      return {
        years: [],
        incomeValues: [],
        expenseValues: [],
        surplus: [],
        baseModel: {
          years: [],
          beginningBalances: [],
          cashInValues: [],
          cashOutValues: [],
          endingBalances: []
        }
      };
    }

    const years = projectionData.map((dp, index) => dp.Year || (currentYear + index));
    const incomeValues = projectionData.map(dp => dp["Total Income Flow"] || 0);
    const expenseValues = projectionData.map(dp => Math.abs(dp["Total Expense Flow"] || 0)); // Convert to positive for display
    const surplus = projectionData.map(dp => dp["Net Cash Flow"] || 0);

    // Calculate BASE model from cash assets
    const cashAssetIds = getCashAssetIds(userSettings, assets);
    const cashAssets = (assets || []).filter(a => cashAssetIds.includes(a.id));
    
    // Get cash asset names for looking up balances in projection data
    const cashAssetNames = cashAssets.map(a => a.name);

    const beginningBalances = [];
    const cashInValues = [];
    const cashOutValues = [];
    const endingBalances = [];

    projectionData.forEach((dp, index) => {
      // Calculate ending balance from actual cash asset balances in backend data
      // Backend stores asset balances as "AssetName_Value" in projection data
      let endingBalance = 0;
      cashAssetNames.forEach(assetName => {
        const balanceKey = `${assetName}_Value`;
        const assetBalance = dp[balanceKey] || 0;
        // Sum all balances, including negative ones (deficits are valid)
        endingBalance += assetBalance;
      });
      
      // Beginning balance is the previous year's ending balance
      // For first year, use initial cash asset values
      if (index === 0) {
        let initialBalance = 0;
        cashAssets.forEach(asset => {
          initialBalance += asset.value || 0;
        });
        beginningBalances.push(initialBalance);
      } else {
        beginningBalances.push(endingBalances[index - 1]);
      }
      
      cashInValues.push(dp["Total Income Flow"] || 0);
      cashOutValues.push(Math.abs(dp["Total Expense Flow"] || 0));
      endingBalances.push(endingBalance);
    });

    return {
      years,
      incomeValues,
      expenseValues,
      surplus,
      baseModel: {
        years: years.map((y, i) => i), // Use year indices
        beginningBalances,
        cashInValues,
        cashOutValues,
        endingBalances,
        totalAssets: projectionData.map(dp => dp["Total Assets"] || 0) // Add Total Assets array
      }
    };
  };

  // OLD calculateCashFlowProjection function - DEPRECATED, now using backend
  const calculateCashFlowProjection_OLD = () => {
    const years = [];
    const incomeValues = [];
    const expenseValues = [];
    const surplus = [];
    const surplusAssetTransfers = []; // NEW: Transfers to surplus asset
    const autoDisbursementTransfers = {}; // NEW: Track each auto-disbursement

    // Initialize auto-disbursement transfer arrays
    if (autoDisbursements && Array.isArray(autoDisbursements)) {
      autoDisbursements.forEach(ad => {
        if (ad && ad.id) {
          autoDisbursementTransfers[ad.id] = [];
        }
      });
    }

    // Pre-calculate asset projections for all years (needed for dynamic items and transfers)
    const assetProjections = {};
    assets.forEach(asset => {
      assetProjections[asset.id] = [];
      for (let year = 0; year <= projectionYears; year++) {
        const projectionYear = currentYear + year;
        // Use calculateYearFraction to handle one-time items and partial years properly
        const yearFraction = calculateYearFraction(asset.start_date, asset.end_date, projectionYear);
        if (yearFraction > 0) {
          const growthRate = (asset.annual_increase_percent || 0) / 100;
          let assetValue = asset.value * Math.pow(1 + growthRate, year);
          // For partial years, we don't prorate asset values (they represent year-end values)
          // But we should still respect the year fraction to know if asset exists
          assetProjections[asset.id].push(assetValue);
        } else {
          // Asset is not active in this year
          assetProjections[asset.id].push(0);
        }
      }
    });

    for (let year = 0; year <= projectionYears; year++) {
      years.push(year);
      
      let totalIncome = 0;
      let totalTaxableIncome = 0; // Track taxable income for tax calculations
      let totalTaxDeductibleExpenses = 0; // Track tax-deductible expenses
      const reinvestedDividendsByAsset = {}; // Track dividend reinvestments by asset
      const currentProjectionYear = currentYear + year;
      
      incomeItems.forEach((item) => {
        // Check if item is active in this year and calculate proration
        const yearFraction = calculateYearFraction(item.start_date, item.end_date, currentProjectionYear);
        
        if (yearFraction <= 0) {
          // Item is not active in this year, skip it
          return;
        }
        
        let itemValue = item.yearly_value;
        
        // Handle dynamic items (linked to assets) - check both linked_item_id and linked_asset_ids
        const isDynamicAssetLinked = item.linked_item_type === "asset" && item.percentage !== null && item.percentage !== undefined;
        if (isDynamicAssetLinked) {
          // Get linked asset IDs - check linked_asset_ids first, then linked_item_id
          let linkedAssetIds = [];
          if (item.linked_asset_ids && Array.isArray(item.linked_asset_ids) && item.linked_asset_ids.length > 0) {
            linkedAssetIds = item.linked_asset_ids;
          } else if (item.linked_item_id) {
            linkedAssetIds = [item.linked_item_id];
          }
          
          // Calculate dividend from linked assets
          if (linkedAssetIds.length > 0) {
            let totalAssetValue = 0;
            linkedAssetIds.forEach(assetId => {
              if (assetProjections[assetId] && assetProjections[assetId][year] !== undefined) {
                totalAssetValue += assetProjections[assetId][year];
              }
            });
            itemValue = totalAssetValue * (item.percentage / 100.0);
          } else {
            // Fallback: if no linked assets found, treat as fixed
            const growthRate = (item.annual_increase_percent || 0) / 100;
            itemValue = item.yearly_value * Math.pow(1 + growthRate, year);
          }
        } else {
          // Fixed value item - apply growth rate
          const growthRate = (item.annual_increase_percent || 0) / 100;
          itemValue = item.yearly_value * Math.pow(1 + growthRate, year);
        }
        
        // Prorate the value based on how many months the item is active in this year
        itemValue = itemValue * yearFraction;
        
        // Count as taxable income if taxable
        if (item.taxable) {
          totalTaxableIncome += itemValue;
        }
        
        // Check if this is a reinvested dividend
        const isDividend = (item.category?.toLowerCase().includes('dividend') || item.description?.toLowerCase().includes('dividend'));
        const shouldReinvest = isDividend && item.reinvest_dividends;
        
        // If reinvested, don't add to totalIncome (cash flow) but track for asset addition
        if (shouldReinvest) {
          // Determine which asset to add to
          let targetAssetId = item.reinvestment_account_id;
          if (!targetAssetId && item.linked_item_id && item.linked_item_type === "asset") {
            // Default to source asset if no reinvestment account specified
            targetAssetId = item.linked_item_id;
          }
          
          if (targetAssetId && assetProjections[targetAssetId]) {
            if (!reinvestedDividendsByAsset[targetAssetId]) {
              reinvestedDividendsByAsset[targetAssetId] = 0;
            }
            reinvestedDividendsByAsset[targetAssetId] += itemValue;
            // Add to asset projection for this year and future years (will compound with growth)
            for (let futureYear = year; futureYear <= projectionYears; futureYear++) {
              const growthRate = assets.find(a => a.id === targetAssetId)?.annual_increase_percent || 0;
              if (assetProjections[targetAssetId][futureYear] !== undefined) {
                assetProjections[targetAssetId][futureYear] += itemValue * Math.pow(1 + growthRate / 100, futureYear - year);
              }
            }
          }
          // Don't add to totalIncome - dividends are reinvested, not received as cash
        } else {
          // Not reinvested - add to income (cash flow)
          totalIncome += itemValue;
        }
      });

      let totalExpenses = 0;
      const federalTaxExpenseItem = expenseItems.find(item => item.description === FEDERAL_TAX_EXPENSE_DESCRIPTION);
      const regularExpenseItems = expenseItems.filter(item => item.description !== FEDERAL_TAX_EXPENSE_DESCRIPTION);
      
      // Process regular expenses first (excluding federal tax expense)
      regularExpenseItems.forEach((item) => {
        // Check if item is active in this year and calculate proration
        const yearFraction = calculateYearFraction(item.start_date, item.end_date, currentProjectionYear);
        
        if (yearFraction <= 0) {
          // Item is not active in this year, skip it
          return;
        }
        
        let itemValue = item.yearly_value;
        
        // Handle dynamic items (linked to assets or income)
        if (item.linked_item_id && item.linked_item_type === "asset" && item.percentage !== null && item.percentage !== undefined) {
          // Find the linked asset
          const linkedAsset = assets.find(a => a.id === item.linked_item_id);
          if (linkedAsset && assetProjections[linkedAsset.id] && assetProjections[linkedAsset.id][year] !== undefined) {
            // Recalculate based on projected asset value for this year
            const projectedAssetValue = assetProjections[linkedAsset.id][year];
            itemValue = projectedAssetValue * (item.percentage / 100.0);
          }
        } else if (item.linked_item_id && item.linked_item_type === "income" && item.percentage !== null && item.percentage !== undefined) {
          // Expense linked to income - calculate based on linked income value
          const linkedIncomeItem = incomeItems.find(i => i.id === item.linked_item_id);
          if (linkedIncomeItem) {
            // Calculate the linked income value for this year
            let linkedIncomeValue = linkedIncomeItem.yearly_value || 0;
            
            // Check if linked income is also dynamic (linked to asset) - check both linked_item_id and linked_asset_ids
            const isNestedDynamicAssetLinked = linkedIncomeItem.linked_item_type === "asset" && linkedIncomeItem.percentage !== null && linkedIncomeItem.percentage !== undefined;
            if (isNestedDynamicAssetLinked) {
              // Get linked asset IDs - check linked_asset_ids first, then linked_item_id
              let nestedLinkedAssetIds = [];
              if (linkedIncomeItem.linked_asset_ids && Array.isArray(linkedIncomeItem.linked_asset_ids) && linkedIncomeItem.linked_asset_ids.length > 0) {
                nestedLinkedAssetIds = linkedIncomeItem.linked_asset_ids;
              } else if (linkedIncomeItem.linked_item_id) {
                nestedLinkedAssetIds = [linkedIncomeItem.linked_item_id];
              }
              
              // Calculate dividend from linked assets
              if (nestedLinkedAssetIds.length > 0) {
                let totalAssetValue = 0;
                nestedLinkedAssetIds.forEach(assetId => {
                  const linkedAsset = assets.find(a => a.id === assetId);
                  if (linkedAsset && assetProjections[linkedAsset.id] && assetProjections[linkedAsset.id][year] !== undefined) {
                    totalAssetValue += assetProjections[linkedAsset.id][year];
                  }
                });
                linkedIncomeValue = totalAssetValue * (linkedIncomeItem.percentage / 100.0);
              } else {
                // Fallback: if no linked assets found, treat as fixed
                const growthRate = (linkedIncomeItem.annual_increase_percent || 0) / 100;
                linkedIncomeValue = linkedIncomeValue * Math.pow(1 + growthRate, year);
              }
            } else {
              // Fixed income - apply growth rate
              const growthRate = (linkedIncomeItem.annual_increase_percent || 0) / 100;
              linkedIncomeValue = linkedIncomeValue * Math.pow(1 + growthRate, year);
            }
            
            // Prorate linked income value based on its active period
            const linkedIncomeYearFraction = calculateYearFraction(linkedIncomeItem.start_date, linkedIncomeItem.end_date, currentProjectionYear);
            linkedIncomeValue = linkedIncomeValue * linkedIncomeYearFraction;
            
            // Calculate expense as percentage of linked income
            itemValue = linkedIncomeValue * (item.percentage / 100.0);
          } else {
            // Linked income item not found - use fixed value with inflation from item
            const itemInflationRate = (item.inflation_percent !== null && item.inflation_percent !== undefined) 
              ? (item.inflation_percent / 100) 
              : 0; // Use 0 if not specified (no inflation)
            itemValue = item.yearly_value * Math.pow(1 + itemInflationRate, year);
          }
        } else {
          // Fixed value item - apply inflation rate
          const inflationRate = (item.inflation_percent || 0) / 100;
          itemValue = item.yearly_value * Math.pow(1 + inflationRate, year);
        }
        
        // Prorate the value based on how many months the item is active in this year
        itemValue = itemValue * yearFraction;
        
        // Count tax-deductible expenses for tax calculation
        if (item.tax_deductible) {
          totalTaxDeductibleExpenses += itemValue;
        }
        
        totalExpenses += itemValue;
      });
      
      // Calculate federal taxes if the expense item exists
      let federalTax = 0;
      if (federalTaxExpenseItem && userSettings) {
          // Use calculateYearFraction to handle one-time items properly
          const taxYearFraction = calculateYearFraction(federalTaxExpenseItem.start_date, federalTaxExpenseItem.end_date, currentProjectionYear);
          
          if (taxYearFraction > 0) {
          try {
            const taxResult = calculateTaxableIncome(
              totalTaxableIncome,
              totalTaxDeductibleExpenses,
              userSettings.tax_filing_status || "Single",
              userSettings.person1_birthdate,
              userSettings.person2_birthdate,
              currentProjectionYear
            );
            federalTax = taxResult.taxOwed || 0;
            // Add taxes to total expenses
            totalExpenses += federalTax;
          } catch (error) {
          }
        }
      }

      const yearSurplus = totalIncome - totalExpenses;
      
      // Calculate surplus asset transfer (surplus/deficit goes to surplus asset)
      let surplusTransfer = 0;
      if (userSettings && userSettings.surplus_asset_id) {
        surplusTransfer = yearSurplus; // Positive = surplus, negative = deficit
      }
      
      // Calculate auto-disbursement transfers
      if (autoDisbursements && Array.isArray(autoDisbursements)) {
        autoDisbursements.forEach(ad => {
          if (!ad || !ad.id) return;
          if (!autoDisbursementTransfers[ad.id]) {
            autoDisbursementTransfers[ad.id] = [];
          }
          
          // Check if disbursement is active for this year
          const currentProjectionYear = currentYear + year;
          // Use calculateYearFraction to handle one-time items properly
          const disbursementYearFraction = calculateYearFraction(ad.start_date, ad.end_date, currentProjectionYear);
          
          if (disbursementYearFraction > 0) {
            const sourceAsset = assets.find(a => a.id === ad.source_asset_id);
            if (sourceAsset && assetProjections[sourceAsset.id] && assetProjections[sourceAsset.id][year] !== undefined) {
              const sourceValue = assetProjections[sourceAsset.id][year];
              let transferAmount = 0;
              
              if (ad.transfer_type === 'percentage') {
                transferAmount = sourceValue * ((ad.transfer_value || 0) / 100.0);
              } else if (ad.transfer_type === 'fixed' || ad.transfer_type === 'dollar_amount') {
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
      }

      incomeValues.push(totalIncome);
      expenseValues.push(totalExpenses);
      surplus.push(yearSurplus);
      surplusAssetTransfers.push(surplusTransfer);
    }

    return { years, incomeValues, expenseValues, surplus, surplusAssetTransfers, autoDisbursementTransfers };
  };

  // BASE Model calculation (Beginning, Additions, Subtractions, Ending)
  const calculateBaseModel = () => {
    const cashAssetIds = getCashAssetIds(userSettings, assets);
    const cashInSourceIds = userSettings?.cash_in_source_ids || [];
    const cashOutSourceIds = userSettings?.cash_out_source_ids || [];
    
    // Filter assets to only cash assets
    const cashAssets = assets.filter(a => cashAssetIds.includes(a.id));
    
    // Debug logging for BASE model cash assets
    
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
        const projectionYear = currentYear + year;
        // Use calculateYearFraction to handle one-time items and partial years properly
        const yearFraction = calculateYearFraction(asset.start_date, asset.end_date, projectionYear);
        if (yearFraction > 0) {
          const growthRate = (asset.annual_increase_percent || 0) / 100;
          let assetValue = asset.value * Math.pow(1 + growthRate, year);
          // For partial years, we don't prorate asset values (they represent year-end values)
          // But we should still respect the year fraction to know if asset exists
          assetProjections[asset.id].push(assetValue);
        } else {
          // Asset is not active in this year
          assetProjections[asset.id].push(0);
        }
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
      let totalTaxableIncome = 0; // Track taxable income for tax calculations
      const reinvestedDividendsByAsset = {}; // Track dividend reinvestments by asset
      const inflationRate = (userSettings?.default_inflation_percent || 2.0) / 100;
      
      includedIncomeItems.forEach(item => {
        const currentProjectionYear = currentYear + year;
        
        // Check if item is active in this year and calculate proration
        const yearFraction = calculateYearFraction(item.start_date, item.end_date, currentProjectionYear);
        
        if (yearFraction <= 0) {
          // Item is not active in this year
          return;
        }
        
        let itemValue = item.yearly_value || 0;
        
        // Handle dynamic items (linked to assets) - check both linked_item_id and linked_asset_ids
        const isDynamicAssetLinked = item.linked_item_type === "asset" && item.percentage !== null && item.percentage !== undefined;
        if (isDynamicAssetLinked) {
          // Get linked asset IDs - check linked_asset_ids first, then linked_item_id
          let linkedAssetIds = [];
          if (item.linked_asset_ids && Array.isArray(item.linked_asset_ids) && item.linked_asset_ids.length > 0) {
            linkedAssetIds = item.linked_asset_ids;
          } else if (item.linked_item_id) {
            linkedAssetIds = [item.linked_item_id];
          }
          
          // Calculate dividend from linked assets
          if (linkedAssetIds.length > 0) {
            let totalAssetValue = 0;
            linkedAssetIds.forEach(assetId => {
              if (assetProjections[assetId] && assetProjections[assetId][year] !== undefined) {
                totalAssetValue += assetProjections[assetId][year];
              }
            });
            itemValue = totalAssetValue * (item.percentage / 100.0);
          } else {
            // Fallback: if no linked assets found, treat as fixed
            const growthRate = (item.annual_increase_percent || 0) / 100;
            itemValue = itemValue * Math.pow(1 + growthRate, year);
          }
        } else {
          // Fixed value item - apply growth rate
          const growthRate = (item.annual_increase_percent || 0) / 100;
          itemValue = itemValue * Math.pow(1 + growthRate, year);
        }
        
        // Prorate the value based on how many months the item is active in this year
        itemValue = itemValue * yearFraction;
        
        // Count as taxable income if taxable
        if (item.taxable) {
          totalTaxableIncome += itemValue;
        }
        
        // Check if this is a reinvested dividend - exclude from cash flow
        const isDividend = (item.category?.toLowerCase().includes('dividend') || item.description?.toLowerCase().includes('dividend'));
        const shouldReinvest = isDividend && item.reinvest_dividends;
        
        if (shouldReinvest) {
          // Determine which asset to add to
          let targetAssetId = item.reinvestment_account_id;
          if (!targetAssetId && item.linked_item_type === "asset") {
            // Use first linked asset if no reinvestment account specified
            if (item.linked_asset_ids && Array.isArray(item.linked_asset_ids) && item.linked_asset_ids.length > 0) {
              targetAssetId = item.linked_asset_ids[0];
            } else if (item.linked_item_id) {
              targetAssetId = item.linked_item_id;
            }
          }
          if (targetAssetId) {
            // Track for adding to asset projection
            if (!reinvestedDividendsByAsset[targetAssetId]) {
              reinvestedDividendsByAsset[targetAssetId] = 0;
            }
            reinvestedDividendsByAsset[targetAssetId] += itemValue;
          }
          // Don't add to cashIn - dividends are reinvested, not received as cash
        } else {
          // Not reinvested - add to cash flow
          cashIn += itemValue;
        }
      });
      
      // Calculate Cash Out (Subtractions) - move before using cashOut
      let cashOut = 0;
      let totalTaxDeductibleExpenses = 0; // Track tax-deductible expenses for tax calculation
      const currentProjectionYear = currentYear + year;
      let federalTaxExpenseItem = null;
      const regularExpenseItems = [];
      
      // Separate federal tax expense item from regular expenses
      includedExpenseItems.forEach(item => {
        if (item.description === FEDERAL_TAX_EXPENSE_DESCRIPTION) {
          federalTaxExpenseItem = item;
        } else {
          regularExpenseItems.push(item);
        }
      });
      
      // Process regular expenses first (excluding federal tax expense)
      regularExpenseItems.forEach(item => {
        // Check if item is active in this year and calculate proration
        const yearFraction = calculateYearFraction(item.start_date, item.end_date, currentProjectionYear);
        
        if (yearFraction <= 0) {
          // Item is not active in this year
          return;
        }
        
        let itemValue = item.yearly_value || 0;
        
        // Handle dynamic items (linked to assets or income)
        if (item.linked_item_id && item.linked_item_type === "asset" && item.percentage !== null && item.percentage !== undefined) {
          const linkedAsset = assets.find(a => a.id === item.linked_item_id);
          if (linkedAsset && assetProjections[linkedAsset.id] && assetProjections[linkedAsset.id][year] !== undefined) {
            const projectedAssetValue = assetProjections[linkedAsset.id][year];
            itemValue = projectedAssetValue * (item.percentage / 100.0);
          }
        } else if (item.linked_item_id && item.linked_item_type === "income" && item.percentage !== null && item.percentage !== undefined) {
          // Expense linked to income - calculate based on linked income value
          const linkedIncomeItem = includedIncomeItems.find(i => i.id === item.linked_item_id);
          if (linkedIncomeItem) {
            // Calculate the linked income value for this year
            let linkedIncomeValue = linkedIncomeItem.yearly_value || 0;
            
            // Check if linked income is also dynamic (linked to asset) - check both linked_item_id and linked_asset_ids
            const isNestedDynamicAssetLinked = linkedIncomeItem.linked_item_type === "asset" && linkedIncomeItem.percentage !== null && linkedIncomeItem.percentage !== undefined;
            if (isNestedDynamicAssetLinked) {
              // Get linked asset IDs - check linked_asset_ids first, then linked_item_id
              let nestedLinkedAssetIds = [];
              if (linkedIncomeItem.linked_asset_ids && Array.isArray(linkedIncomeItem.linked_asset_ids) && linkedIncomeItem.linked_asset_ids.length > 0) {
                nestedLinkedAssetIds = linkedIncomeItem.linked_asset_ids;
              } else if (linkedIncomeItem.linked_item_id) {
                nestedLinkedAssetIds = [linkedIncomeItem.linked_item_id];
              }
              
              // Calculate dividend from linked assets
              if (nestedLinkedAssetIds.length > 0) {
                let totalAssetValue = 0;
                nestedLinkedAssetIds.forEach(assetId => {
                  const linkedAsset = assets.find(a => a.id === assetId);
                  if (linkedAsset && assetProjections[linkedAsset.id] && assetProjections[linkedAsset.id][year] !== undefined) {
                    totalAssetValue += assetProjections[linkedAsset.id][year];
                  }
                });
                linkedIncomeValue = totalAssetValue * (linkedIncomeItem.percentage / 100.0);
              } else {
                // Fallback: if no linked assets found, treat as fixed
                const growthRate = (linkedIncomeItem.annual_increase_percent || 0) / 100;
                linkedIncomeValue = linkedIncomeValue * Math.pow(1 + growthRate, year);
              }
            } else {
              // Fixed income - apply growth rate
              const growthRate = (linkedIncomeItem.annual_increase_percent || 0) / 100;
              linkedIncomeValue = linkedIncomeValue * Math.pow(1 + growthRate, year);
            }
            
            // Prorate linked income value based on its active period
            const linkedIncomeYearFraction = calculateYearFraction(linkedIncomeItem.start_date, linkedIncomeItem.end_date, currentProjectionYear);
            linkedIncomeValue = linkedIncomeValue * linkedIncomeYearFraction;
            
            // Calculate expense as percentage of linked income
            itemValue = linkedIncomeValue * (item.percentage / 100.0);
          } else {
            // Linked income item not found - use fixed value with inflation
            const inflationRate = (item.inflation_percent || 0) / 100;
            itemValue = itemValue * Math.pow(1 + inflationRate, year);
          }
        } else {
          // Fixed value item - apply inflation rate
          const inflationRate = (item.inflation_percent || 0) / 100;
          itemValue = itemValue * Math.pow(1 + inflationRate, year);
        }
        
        // Prorate expense value based on its active period
        itemValue = itemValue * yearFraction;
        
        // Count tax-deductible expenses for tax calculation
        if (item.tax_deductible) {
          totalTaxDeductibleExpenses += itemValue;
        }
        
        cashOut += itemValue;
      });
      
      // Calculate federal taxes if the expense item exists
      let federalTax = 0;
      if (federalTaxExpenseItem && userSettings) {
          // Use calculateYearFraction to handle one-time items properly
          const taxYearFraction = calculateYearFraction(federalTaxExpenseItem.start_date, federalTaxExpenseItem.end_date, currentProjectionYear);
          
          if (taxYearFraction > 0) {
          try {
            const taxResult = calculateTaxableIncome(
              totalTaxableIncome,
              totalTaxDeductibleExpenses,
              userSettings.tax_filing_status || "Single",
              userSettings.person1_birthdate,
              userSettings.person2_birthdate,
              currentProjectionYear
            );
            federalTax = taxResult.taxOwed || 0;
            // Add taxes to cash out
            cashOut += federalTax;
          } catch (error) {
          }
        }
      }
      
      // Add transfers from auto-disbursements that target cash assets
      if (autoDisbursements && Array.isArray(autoDisbursements)) {
        autoDisbursements.forEach(ad => {
          if (!ad) return;
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
              } else if (ad.transfer_type === 'fixed' || ad.transfer_type === 'dollar_amount') {
                transferAmount = ad.transfer_value || 0;
              }
              cashIn += transferAmount;
            }
          }
        }
      });
      }
      
      // Add reinvested dividends to asset projections
      Object.keys(reinvestedDividendsByAsset).forEach(assetId => {
        const dividendAmount = reinvestedDividendsByAsset[assetId];
        if (assetProjections[assetId] && assetProjections[assetId][year] !== undefined) {
          // Add reinvested dividends to this asset's value for this year
          // This will compound with growth for future years
          assetProjections[assetId][year] += dividendAmount;
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
      if (autoDisbursements && Array.isArray(autoDisbursements)) {
        autoDisbursements.forEach(ad => {
          if (!ad) return;
        if (cashAssetIds.includes(ad.source_asset_id) && !cashAssetIds.includes(ad.target_asset_id)) {
          const currentProjectionYear = currentYear + year;
          // Use calculateYearFraction to handle one-time items properly
          const disbursementYearFraction = calculateYearFraction(ad.start_date, ad.end_date, currentProjectionYear);
          
          if (disbursementYearFraction > 0) {
            const sourceAsset = assets.find(a => a.id === ad.source_asset_id);
            if (sourceAsset && assetProjections[sourceAsset.id] && assetProjections[sourceAsset.id][year] !== undefined) {
              const sourceValue = assetProjections[sourceAsset.id][year];
              let transferAmount = 0;
              
              if (ad.transfer_type === 'percentage') {
                transferAmount = sourceValue * ((ad.transfer_value || 0) / 100.0);
              } else if (ad.transfer_type === 'fixed' || ad.transfer_type === 'dollar_amount') {
                transferAmount = ad.transfer_value || 0;
              }
              cashOut += transferAmount;
            }
          }
        }
      });
      }
      
      // Add reinvested dividends to cash assets (if they're cash assets)
      // This affects the ending balance calculation
      let reinvestedDividendsToCash = 0;
      Object.keys(reinvestedDividendsByAsset).forEach(assetId => {
        const dividendAmount = reinvestedDividendsByAsset[assetId];
        if (cashAssetIds.includes(parseInt(assetId))) {
          reinvestedDividendsToCash += dividendAmount;
        }
        // Also update asset projections for future growth calculations
        if (assetProjections[assetId] && assetProjections[assetId][year] !== undefined) {
          assetProjections[assetId][year] += dividendAmount;
          // Update future year projections to reflect this addition
          for (let futureYear = year + 1; futureYear <= projectionYears; futureYear++) {
            const growthRate = assets.find(a => a.id === parseInt(assetId))?.annual_increase_percent || 0;
            if (assetProjections[assetId][futureYear] !== undefined) {
              assetProjections[assetId][futureYear] += dividendAmount * Math.pow(1 + growthRate / 100, futureYear - year);
            }
          }
        }
      });
      
      // Calculate Ending Balance (Available Cash)
      // Include reinvested dividends to cash assets in the ending balance
      const endingBalance = currentBalance + cashIn - cashOut + reinvestedDividendsToCash;
      
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

  // Parse projection data from backend
  const parsedData = parseProjectionData();
  const selectedProjectionEntry = projectionData?.find(dp => dp.Year === currentYear + sankeyYear) ?? projectionData?.[sankeyYear];
  const categoryStateTaxProjectionValue = Math.max(0, Math.abs(selectedProjectionEntry?.[`${STATE_TAX_EXPENSE_DESCRIPTION}_Value`] || 0));
  const { transferSourcesByYear: autoDisbursementSources, transferSinksByYear: autoDisbursementSinks } = autoDisbursementCashFlowAdjustments;
  const hasSurplusCashAsset = Boolean(userSettings?.surplus_asset_id && cashAssetIds.includes(userSettings.surplus_asset_id));
  const surplusArray = parsedData.surplus || [];
  const surplusTransfers = surplusArray.map(value => (hasSurplusCashAsset && value > 0 ? value : 0));
  const deficitTransfers = surplusArray.map(value => (hasSurplusCashAsset && value < 0 ? Math.abs(value) : 0));
  const adjustedIncomeValues = (parsedData.incomeValues || []).map((value, index) => {
    const surplusAddition = includeTransfers ? (surplusTransfers[index] || 0) : 0;
    const autoTransferIn = includeTransfers ? (autoDisbursementSources[index] || 0) : 0;
    return (value || 0) + surplusAddition + autoTransferIn;
  });
  const adjustedExpenseValues = (parsedData.expenseValues || []).map((value, index) => {
    const deficitAddition = includeTransfers ? (deficitTransfers[index] || 0) : 0;
    const autoTransferOut = includeTransfers ? (autoDisbursementSinks[index] || 0) : 0;
    return (value || 0) + deficitAddition + autoTransferOut;
  });
  const adjustedSurplus = adjustedIncomeValues.map((value, index) => value - (adjustedExpenseValues[index] || 0));

  // Use parsed data or fallback to empty
  const cashFlowProjection = {
    years: parsedData.years,
    incomeValues: adjustedIncomeValues,
    expenseValues: adjustedExpenseValues,
    surplus: adjustedSurplus,
    surplusAssetTransfers: surplusTransfers, // Surplus when positive
    autoDisbursementTransfers: {} // TODO: Add auto-disbursement transfers from backend if needed
  };
  
  const baseModel = parsedData.baseModel;
  const displayBaseModel = baseModel ? {
    ...baseModel,
    cashInValues: cashFlowProjection.incomeValues || baseModel.cashInValues || [],
    cashOutValues: cashFlowProjection.expenseValues || baseModel.cashOutValues || [],
    endingBalances: (baseModel.beginningBalances || []).map((beginning, index) => {
      const cashIn = (cashFlowProjection.incomeValues || [])[index] || 0;
      const cashOut = (cashFlowProjection.expenseValues || [])[index] || 0;
      return (beginning || 0) + cashIn - cashOut;
    })
  } : baseModel;
  
  if (loading) {
    return <div>Loading projections. Please be patient...</div>;
  }
  
  if (error) {
    return <div>{error === missingDataMessage ? error : `Error: ${error}`}</div>;
  }

  // Build datasets array dynamically
  // Add transfer lines BEFORE surplus so they render on top
  const datasets = [
    {
      label: "Cash In",
      data: cashFlowProjection?.incomeValues || [],
      borderColor: "rgb(75, 192, 75)",
      backgroundColor: "rgba(75, 192, 75, 0.2)",
      order: 3, // Render first (lower order = rendered first, behind others)
    },
    {
      label: "Cash Out",
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

  // Removed surplus asset transfer - it's a duplicate of Surplus

  // Add auto-disbursement transfers - add after transfers so they render on top
  if (autoDisbursements && Array.isArray(autoDisbursements)) {
    autoDisbursements.forEach(ad => {
      if (!ad || !ad.id) return;
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
  }

  const cashFlowChartData = {
    labels: (cashFlowProjection?.years || []), // Years are already absolute years from backend
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
        text: `Model My Retirement - Income & Expense Projection${userSettings?.person1_first_name && userSettings?.person1_last_name ? ` - ${userSettings.person1_first_name} ${userSettings.person1_last_name}` : ''}`,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  const compactCashFlowChartOptions = {
    ...chartOptions,
    maintainAspectRatio: false,
    plugins: {
      ...chartOptions.plugins,
      legend: {
        ...chartOptions.plugins.legend,
        position: "bottom",
      },
      title: {
        ...chartOptions.plugins.title,
        display: false,
      },
    },
    scales: {
      ...chartOptions.scales,
      x: {
        ...(chartOptions.scales.x || {}),
        grid: {
          ...(chartOptions.scales.x?.grid || {}),
          display: false,
        },
      },
      y: {
        ...(chartOptions.scales.y || {}),
        beginAtZero: true,
      },
    },
  };

  if (compact) {
    return (
      <div className="cashflow-compact-chart">
        <Line data={cashFlowChartData} options={compactCashFlowChartOptions} height={200} />
      </div>
    );
  }

  // Show all years in tables
  const displayYears = cashFlowProjection?.years || [];

  // Download functions (reusing from ProjectionDetail.js pattern)
  const handleDownloadChartPng = (chartRef, filename) => {
    if (chartRef.current) {
      const link = document.createElement('a');
      link.download = `${filename.replace(/\s/g, '_')}.png`;
      link.href = chartRef.current.toBase64Image('image/png', 1);
      link.click();
    } else {
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
      // Removed surplus asset transfer header - it's a duplicate of Surplus
      if (autoDisbursements && Array.isArray(autoDisbursements)) {
        autoDisbursements.forEach(ad => {
          if (!ad || !ad.id) return;
        if (cashFlowProjection.autoDisbursementTransfers && cashFlowProjection.autoDisbursementTransfers[ad.id]) {
          const sourceAsset = assets.find(a => a.id === ad.source_asset_id);
          const targetAsset = assets.find(a => a.id === ad.target_asset_id);
          const sourceName = sourceAsset ? sourceAsset.name : 'Source';
          const targetName = targetAsset ? targetAsset.name : 'Target';
          csvHeaders.push(`Auto-Disbursement: ${sourceName} → ${targetName}`);
        }
      });
      }
      
      const formattedData = (cashFlowProjection?.years || []).map((year, yearIndex) => {
        const row = {
          Year: year, // Year is already absolute from backend
          'Cash In': cashFlowProjection?.incomeValues?.[yearIndex] || 0,
          'Cash Out': cashFlowProjection?.expenseValues?.[yearIndex] || 0,
          Surplus: cashFlowProjection?.surplus?.[yearIndex] || 0,
        };
        
        // Removed surplus asset transfer - it's a duplicate of Surplus
        
        if (autoDisbursements && Array.isArray(autoDisbursements)) {
          autoDisbursements.forEach(ad => {
            if (!ad || !ad.id) return;
            if (cashFlowProjection?.autoDisbursementTransfers?.[ad.id]) {
            const sourceAsset = assets.find(a => a.id === ad.source_asset_id);
            const targetAsset = assets.find(a => a.id === ad.target_asset_id);
            const sourceName = sourceAsset ? sourceAsset.name : 'Source';
            const targetName = targetAsset ? targetAsset.name : 'Target';
            row[`Auto-Disbursement: ${sourceName} → ${targetName}`] = cashFlowProjection.autoDisbursementTransfers[ad.id][yearIndex] || 0;
            }
          });
        }
        
        return row;
      });
      
      const csvString = convertToCsv(formattedData, csvHeaders, formatCurrency);
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${filename.replace(/\s/g, '_')}.csv`;
      link.click();
    } else {
    }
  };

  // BASE Model Chart Data (Combo: Bar + Line)
  const baseChartData = {
    labels: (cashFlowProjection?.years || []), // Use same years as cash flow projection
    datasets: [
      {
        type: 'bar',
        label: 'Cash In',
        data: displayBaseModel?.cashInValues || [],
        backgroundColor: 'rgba(75, 192, 75, 0.6)',
        borderColor: 'rgb(75, 192, 75)',
        borderWidth: 1,
        order: 2,
      },
      {
        type: 'bar',
        label: 'Cash Out',
        data: displayBaseModel?.cashOutValues || [],
        backgroundColor: 'rgba(255, 99, 99, 0.6)',
        borderColor: 'rgb(255, 99, 99)',
        borderWidth: 1,
        order: 2,
      },
      {
        type: 'line',
        label: 'Available Cash',
        data: displayBaseModel?.endingBalances || [],
        borderColor: 'rgb(153, 102, 255)',
        backgroundColor: 'rgba(153, 102, 255, 0.2)',
        borderWidth: 3,
        fill: false,
        tension: 0.1,
        pointRadius: 4,
        pointHoverRadius: 6,
        order: 1,
        yAxisID: useSeparateYAxis ? 'y1' : 'y', // Use separate axis if enabled, otherwise use main axis
      },
      ...(showTotalAssets ? [{
        type: 'line',
        label: 'Total Assets',
        data: displayBaseModel?.totalAssets || [],
        borderColor: 'rgb(255, 165, 0)',
        backgroundColor: 'rgba(255, 165, 0, 0.2)',
        borderWidth: 2,
        borderDash: [5, 5],
        fill: false,
        tension: 0.1,
        pointRadius: 3,
        pointHoverRadius: 5,
        order: 1,
        yAxisID: useSeparateYAxis ? 'y1' : 'y', // Use same axis as Available Cash
      }] : []),
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
        text: `Model My Retirement - BASE Model (Beginning, Additions, Subtractions, Ending)${userSettings?.person1_first_name && userSettings?.person1_last_name ? ` - ${userSettings.person1_first_name} ${userSettings.person1_last_name}` : ''}`,
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
          text: useSeparateYAxis ? 'Cash In / Out ($)' : 'Amount ($)',
        },
        ticks: {
          callback: function(value) {
            return safeFormatCurrency(value);
          }
        }
      },
      ...(useSeparateYAxis ? {
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
        }
      } : {}),
    },
  };

  const activeAutoDisbursementColumns = (autoDisbursements || [])
    .filter(ad => cashFlowProjection?.autoDisbursementTransfers?.[ad.id]);

  const autoDisbursementHeaders = activeAutoDisbursementColumns.map(ad => {
    const sourceAsset = assets.find(a => a.id === ad.source_asset_id);
    const targetAsset = assets.find(a => a.id === ad.target_asset_id);
    const sourceName = sourceAsset ? sourceAsset.name : 'Source';
    const targetName = targetAsset ? targetAsset.name : 'Target';
    return {
      id: ad.id,
      label: `Auto-Disbursement: ${sourceName} → ${targetName}`,
    };
  });

  return (
    <Box sx={{ width: "100%" }}>
      <Paper variant="outlined" sx={projectionSectionCardSx}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          alignItems="center"
          justifyContent="space-between"
        >
          <Typography variant="h5" fontWeight="600">
            Cash Flow Projections
          </Typography>
          {showProjectionYearSelector && (
            <Stack sx={{ width: { xs: "100%", md: 300 } }} spacing={0.5}>
              <Typography variant="body2" color="text.secondary">
                Projection Years: <strong>{sliderProjectionYears}</strong>
              </Typography>
              <Slider
                id="cashflow-overview-years"
                size="small"
                min={0}
                max={maxProjectionYears ?? 50}
                step={1}
                value={sliderProjectionYears}
                valueLabelDisplay="auto"
                onChange={(_, value) => setSliderProjectionYears(Number(value))}
                onChangeCommitted={(_, value) => onProjectionYearsChange?.(Number(value))}
              />
              {isLimitedPlan && maxProjectionYears !== undefined && (
                <Typography variant="body2" color="text.secondary">
                  Free plan max {maxProjectionYears} years. <a href="/pricing">Upgrade</a>
                </Typography>
              )}
            </Stack>
          )}
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          Track cash in, cash out, and yearly surplus trends across projection scenarios.
        </Typography>
        <Tabs
          value={activeTab}
          onChange={(_, value) => setActiveTab(value)}
          textColor="primary"
          indicatorColor="primary"
          variant="scrollable"
          allowScrollButtonsMobile
          sx={{ mt: 2 }}
          aria-label="Cash flow overview tabs"
        >
          <Tab label="Overview" value="overview" />
          <Tab label="BASE Model" value="base" />
          <Tab label="Category View" value="sankey" />
        </Tabs>
      </Paper>

      <TabPanel value={activeTab} index="overview">
        <Paper variant="outlined" sx={projectionSectionCardSx}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            justifyContent="space-between"
            alignItems="center"
            spacing={2}
            sx={{ mb: 2 }}
          >
            <FormControlLabel
              control={
                <Checkbox
                  checked={includeTransfers}
                  onChange={(e) => setIncludeTransfers(e.target.checked)}
                />
              }
              label="Include Surplus/Deficit Transfers"
            />
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Button
                size="small"
                variant="contained"
                sx={projectionActionButtonSx}
                onClick={() => handleDownloadChartPng(chartRef, "Income_Expense_Projection")}
              >
                Download PNG
              </Button>
              <Button
                size="small"
                variant="contained"
                sx={projectionActionButtonSx}
                onClick={() => handleDownloadChartPdf(chartRef, "Income_Expense_Projection")}
              >
                Download PDF
              </Button>
            </Stack>
          </Stack>
          <Box>
            <Line ref={chartRef} data={cashFlowChartData} options={chartOptions} />
          </Box>
        </Paper>

        <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            alignItems="center"
            justifyContent="space-between"
            spacing={2}
            sx={{ mb: 2 }}
          >
            <Typography variant="subtitle1" fontWeight="600">
              Cash Flow Table
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Button
                size="small"
                variant="contained"
                sx={projectionActionButtonSx}
                onClick={() => handleDownloadTablePdf(tableRef, "Cash_Flow_Overview_Table")}
              >
                Download PDF
              </Button>
              <Button
                size="small"
                variant="contained"
                sx={projectionActionButtonSx}
                onClick={() => handleDownloadCashFlowCsv("Cash_Flow_Overview_Table")}
              >
                Download CSV
              </Button>
            </Stack>
          </Stack>
          <TableContainer sx={{ ...projectionTableContainerSx, maxHeight: 440 }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Year</TableCell>
                  <TableCell align="right">Cash In</TableCell>
                  <TableCell align="right">Cash Out</TableCell>
                  <TableCell align="right">Surplus</TableCell>
                  {autoDisbursementHeaders.map((column) => (
                    <TableCell key={column.id} align="right">
                      {column.label}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {displayYears.map((year, yearIndex) => (
                  <TableRow key={year}>
                    <TableCell>{year}</TableCell>
                    <TableCell align="right">
                      {safeFormatCurrency(cashFlowProjection?.incomeValues?.[yearIndex] || 0)}
                    </TableCell>
                    <TableCell align="right">
                      {safeFormatCurrency(cashFlowProjection?.expenseValues?.[yearIndex] || 0)}
                    </TableCell>
                    <TableCell align="right">
                      {safeFormatCurrency(cashFlowProjection?.surplus?.[yearIndex] || 0)}
                    </TableCell>
                    {autoDisbursementHeaders.map((column) => (
                      <TableCell key={column.id} align="right">
                        {safeFormatCurrency(
                          cashFlowProjection?.autoDisbursementTransfers?.[column.id]?.[yearIndex] || 0
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </TabPanel>

      <TabPanel value={activeTab} index="base">
        <Typography variant="h6" fontWeight="600" gutterBottom>
          BASE Model (Beginning, Additions, Subtractions, Ending)
        </Typography>
        {(!userSettings?.cash_asset_ids || userSettings.cash_asset_ids.length === 0) ? (
          <Alert severity="warning" variant="outlined" sx={{ mb: 3 }}>
            <>
              <Typography variant="body2" fontWeight="600">
                Note:
              </Typography>
              <Typography variant="body2">
                Please configure cash assets in Cash Handling then refresh your browser to view the BASE Model.
              </Typography>
              <Typography variant="body2" fontStyle="italic">
                After updating settings, please refresh the page to see the changes.
              </Typography>
            </>
          </Alert>
        ) : (
          <>
            <Paper variant="outlined" sx={projectionSectionCardSx}>
              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={2}
                alignItems="center"
                justifyContent="flex-start"
                sx={{ mb: 2 }}
              >
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={useSeparateYAxis}
                      onChange={(e) => setUseSeparateYAxis(e.target.checked)}
                    />
                  }
                  label="Use separate y-axis for Available Cash"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={showTotalAssets}
                      onChange={(e) => setShowTotalAssets(e.target.checked)}
                    />
                  }
                  label="Show Total Assets"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={includeTransfers}
                      onChange={(e) => setIncludeTransfers(e.target.checked)}
                    />
                  }
                  label="Include Surplus/Deficit Transfers"
                />
              </Stack>
              <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ mb: 2 }}>
                <Button
                  size="small"
                  variant="contained"
                  sx={projectionActionButtonSx}
                  onClick={() => handleDownloadChartPng(baseChartRef, "BASE_Model")}
                >
                  Download PNG
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  sx={projectionActionButtonSx}
                  onClick={() => handleDownloadChartPdf(baseChartRef, "BASE_Model")}
                >
                  Download PDF
                </Button>
              </Stack>
              <Box>
                <Chart ref={baseChartRef} type="bar" data={baseChartData} options={baseChartOptions} />
              </Box>
            </Paper>
            <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
              <Stack
                direction={{ xs: "column", md: "row" }}
                alignItems="center"
                justifyContent="space-between"
                sx={{ mb: 2 }}
              >
                <Typography variant="subtitle1" fontWeight="600">
                  BASE Model Table
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  <strong>Visual Cue:</strong> The purple line represents Available Cash.
                  If it slopes down, you are spending more than you earn; if it slopes up, your available spending power is growing.
                </Typography>
              </Stack>
              <TableContainer sx={{ ...projectionTableContainerSx, maxHeight: 440 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Year</TableCell>
                      <TableCell align="right">Beginning Balance</TableCell>
                      <TableCell align="right">Cash In (Additions)</TableCell>
                      <TableCell align="right">Cash Out (Subtractions)</TableCell>
                      <TableCell align="right">Ending Balance (Available Cash)</TableCell>
                      {showTotalAssets && <TableCell align="right">Total Assets</TableCell>}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {displayYears.map((year, yearIndex) => (
                      <TableRow key={year}>
                        <TableCell>{year}</TableCell>
                        <TableCell align="right">
                          {safeFormatCurrency(displayBaseModel?.beginningBalances?.[yearIndex] || 0)}
                        </TableCell>
                        <TableCell align="right">
                          {safeFormatCurrency(displayBaseModel?.cashInValues?.[yearIndex] || 0)}
                        </TableCell>
                        <TableCell align="right">
                          {safeFormatCurrency(displayBaseModel?.cashOutValues?.[yearIndex] || 0)}
                        </TableCell>
                        <TableCell align="right">
                          {safeFormatCurrency(displayBaseModel?.endingBalances?.[yearIndex] || 0)}
                        </TableCell>
                        {showTotalAssets && (
                          <TableCell align="right">
                            {safeFormatCurrency(displayBaseModel?.totalAssets?.[yearIndex] || 0)}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </>
        )}
      </TabPanel>

      <TabPanel value={activeTab} index="sankey">
        <Paper variant="outlined" sx={projectionSectionCardSx}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", md: "center" }}
            spacing={2}
          >
            <Typography variant="h6" fontWeight="600">
              Category View
            </Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center" flexWrap="wrap">
              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel id="sankey-year-label">Year</InputLabel>
                <Select
                  labelId="sankey-year-label"
                  id="sankey-year-select"
                  value={sankeyYear}
                  label="Year"
                  onChange={(e) => setSankeyYear(parseInt(e.target.value, 10))}
                >
                  {Array.from({ length: Math.min(projectionYears + 1, 31) }, (_, i) => (
                    <MenuItem key={i} value={i}>
                      {currentYear + i}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel id="sankey-view-label">View</InputLabel>
                <Select
                  labelId="sankey-view-label"
                  id="sankey-view-select"
                  value={sankeyViewMode}
                  label="View"
                  onChange={(e) => setSankeyViewMode(e.target.value)}
                >
                  <MenuItem value="sankey">Sankey Diagram</MenuItem>
                  <MenuItem value="pie">Pie Charts</MenuItem>
                </Select>
              </FormControl>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={includeTransfers}
                    onChange={(e) => setIncludeTransfers(e.target.checked)}
                  />
                }
                label="Include Surplus/Deficit Transfers"
              />
            </Stack>
          </Stack>
          <Box
            sx={{
              position: "relative",
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 2,
              bgcolor: "background.paper",
              width: "100%",
              overflowY: "auto",
              overflowX: "auto",
              maxHeight: { xs: "auto", md: "70vh" },
            }}
          >
            <Box sx={{ width: "100%", minWidth: 1200, p: 2, display: "block" }}>
              {(() => {
                try {
                  if (!userSettings?.cash_asset_ids || userSettings.cash_asset_ids.length === 0) {
                    return (
                      <Alert severity="warning" variant="outlined">
                        <Typography variant="body2" fontWeight="600">
                          Note:
                        </Typography>
                        <Typography variant="body2">
                          Please configure cash assets in Cash Handling then refresh your browser to view the Sankey Diagram.
                        </Typography>
                        <Typography variant="body2" fontStyle="italic">
                          After updating settings, please refresh the page to see the changes.
                        </Typography>
                      </Alert>
                    );
                  }
                  try {
                    const sankeyKey = `sankey-${sankeyYear}-${userSettings?.surplus_asset_id || "none"}-${baseModel ? "hasBaseModel" : "noBaseModel"}-${cashFlowProjection ? "hasProjection" : "noProjection"}-${sankeyViewMode}-${includeTransfers ? "withTransfers" : "noTransfers"}`;
                    return (
                      <SankeyDiagram
                        key={sankeyKey}
                        incomeItems={incomeItems || []}
                        expenseItems={expenseItems || []}
                        assets={assets || []}
                        userSettings={userSettings}
                        cashFlowProjection={cashFlowProjection}
                        baseModel={baseModel}
                        formatCurrency={safeFormatCurrency}
                        currentYear={currentYear}
                        projectionYears={projectionYears}
                        selectedYear={sankeyYear}
                        autoDisbursements={autoDisbursements || []}
                        viewMode={sankeyViewMode}
                        includeTransfers={includeTransfers}
                        stateTaxProjectionValue={categoryStateTaxProjectionValue}
                      />
                    );
                  } catch (innerError) {
                    return (
                      <Alert severity="error" variant="outlined">
                        <Typography variant="subtitle2" fontWeight="600">
                          Error:
                        </Typography>
                        <Typography variant="body2">
                          Failed to render Sankey Diagram. Please check the console for details.
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {innerError?.message || "Unknown error"}
                        </Typography>
                      </Alert>
                    );
                  }
                } catch (renderError) {
                  return (
                    <Alert severity="error" variant="outlined">
                      <Typography variant="subtitle2" fontWeight="600">
                        Error:
                      </Typography>
                      <Typography variant="body2">
                        Failed to render Sankey Diagram. Please check the console for details.
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {renderError?.message || "Unknown error"}
                      </Typography>
                    </Alert>
                  );
                }
              })()}
            </Box>
          </Box>
        </Paper>
        {sankeyViewMode !== "pie" && (
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle1" fontWeight="600" gutterBottom>
              How to read:
            </Typography>
            <List dense disablePadding>
              <ListItem disablePadding>
                <ListItemText primary="Left side shows cash sources (income) grouped by category" />
              </ListItem>
              <ListItem disablePadding>
                <ListItemText primary="Center shows your wallet/main account (total cash)" />
              </ListItem>
              <ListItem disablePadding>
                <ListItemText primary="Right side shows where cash goes (expenses by category and available cash/savings)" />
              </ListItem>
              <ListItem disablePadding>
                <ListItemText primary="Line thickness represents the flow amount" />
              </ListItem>
            </List>
          </Paper>
        )}
      </TabPanel>
    </Box>
  );
}
