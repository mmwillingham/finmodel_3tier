import React, { useEffect, useState, useRef } from "react";
import { useAuth } from '../context/AuthContext';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { Line, Bar } from "react-chartjs-2";
import { Box, Button, FormControl, InputLabel, LinearProgress, MenuItem, Paper, Select, Slider, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from "@mui/material";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { calculateTaxableIncome } from '../utils/taxCalculator';
import { calculateYearFraction } from '../utils/dateUtils';
import { projectionActionButtonSx, projectionSecondaryButtonSx, projectionSectionCardSx, projectionTableContainerSx } from "../utils/projectionUiStyles";

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend);

// Constant to identify the federal tax expense item (must match backend)
const FEDERAL_TAX_EXPENSE_DESCRIPTION = "Federal Income Tax (Calculated)";

export default function MonteCarloProjections({ incomeItems, expenseItems, assets, liabilities, projectionYears, formatCurrency, showProjectionYearSelector = false, onProjectionYearsChange, maxProjectionYears, isLimitedPlan = false }) {
  const { userSettings } = useAuth();
  const currentYear = new Date().getFullYear();
  const chartRef = useRef(null);
  const tableRef = useRef(null);
  const [numSimulations, setNumSimulations] = useState(1000);
  const [volatility, setVolatility] = useState(15); // Standard deviation for growth rates as percentage
  const [results, setResults] = useState(null);
  const [simulationSeries, setSimulationSeries] = useState(null);
  const [selectedView, setSelectedView] = useState("fan");
  const [successRate, setSuccessRate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sliderProjectionYears, setSliderProjectionYears] = useState(projectionYears ?? 30);

  useEffect(() => {
    setSliderProjectionYears(projectionYears ?? 30);
  }, [projectionYears]);

  const runMonteCarloSimulation = () => {
    setLoading(true);
    setResults(null);
    setSimulationSeries(null);
    setSuccessRate(null);
    setSelectedView("fan");

    // Run simulations in batches to avoid blocking UI
    setTimeout(() => {
      const simulationResults = [];
      
      for (let sim = 0; sim < numSimulations; sim++) {
        const yearlyData = [];
        
        // Pre-calculate base projections for THIS simulation (each simulation needs its own copy)
        // Note: Contributions from expenses will be added during the year-by-year loop
        const baseAssetProjections = {};
        assets.forEach(asset => {
          baseAssetProjections[asset.name] = [];
          for (let i = 0; i <= projectionYears; i++) {
            const projectionYear = currentYear + i;
            // Check if asset is active for this year (respects end_date)
            const yearFraction = calculateYearFraction(asset.start_date, asset.end_date, projectionYear);
            if (yearFraction > 0) {
              const growthRate = (asset.annual_increase_percent || 0) / 100;
              // Calculate asset value with growth, but contributions will be added later
              const assetValue = asset.value * Math.pow(1 + growthRate, i);
              baseAssetProjections[asset.name].push(assetValue);
            } else {
              // Asset has ended, set value to 0
              baseAssetProjections[asset.name].push(0);
            }
          }
        });
        
        // Track contributions to assets by year (will be applied after growth)
        const assetContributionsByYear = {};
        assets.forEach(asset => {
          assetContributionsByYear[asset.name] = new Array(projectionYears + 1).fill(0);
        });
        
        // Track reinvested dividends by asset for this simulation
        const reinvestedDividendsByAsset = {};
        
        for (let year = 0; year <= projectionYears; year++) {
          // Calculate income with random variation
          let totalIncome = 0;
          let totalTaxableIncome = 0; // Track taxable income for tax calculations
          
          incomeItems.forEach(item => {
            const currentProjectionYear = currentYear + year;
            // Calculate year fraction to handle one-time items and partial years
            const yearFraction = calculateYearFraction(item.start_date, item.end_date, currentProjectionYear);
            if (yearFraction === 0) {
              // Item is not active in this year, skip it
              return;
            }
            
            let itemValue = item.yearly_value;
            
            if (item.linked_item_id && item.linked_item_type === "asset" && item.percentage !== null) {
              const linkedAsset = assets.find(a => a.id === item.linked_item_id);
              if (linkedAsset && baseAssetProjections[linkedAsset.name]) {
                // Add random variation to asset value, then calculate percentage
                const baseValue = baseAssetProjections[linkedAsset.name][year];
                const variation = (Math.random() * volatility * 2 - volatility) / 100; // -volatility to +volatility %
                const variedValue = baseValue * (1 + variation);
                itemValue = variedValue * (item.percentage / 100.0);
              }
            } else {
              // Add random variation to fixed income
              const variation = (Math.random() * volatility * 2 - volatility) / 100;
              const increaseRate = (item.annual_increase_percent || 0) / 100;
              itemValue = item.yearly_value * Math.pow(1 + increaseRate, year) * (1 + variation);
            }
            
            // Apply year fraction to prorate for one-time items and partial years
            itemValue = itemValue * yearFraction;
            
            // Count as taxable income if taxable
            if (item.taxable) {
              totalTaxableIncome += itemValue;
            }
            
            // Check if this is a reinvested dividend - exclude from cash flow
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
              
              if (targetAssetId) {
                const targetAsset = assets.find(a => a.id === targetAssetId);
                if (targetAsset && baseAssetProjections[targetAsset.name]) {
                  // Add to asset projection for future years (will compound with growth)
                  const assetKey = targetAsset.name;
                  if (!reinvestedDividendsByAsset[assetKey]) {
                    reinvestedDividendsByAsset[assetKey] = {};
                  }
                  if (!reinvestedDividendsByAsset[assetKey][year]) {
                    reinvestedDividendsByAsset[assetKey][year] = 0;
                  }
                  reinvestedDividendsByAsset[assetKey][year] += itemValue;
                  // Update base projections for future years in this simulation
                  for (let futureYear = year; futureYear <= projectionYears; futureYear++) {
                    const growthRate = targetAsset.annual_increase_percent || 0;
                    if (baseAssetProjections[assetKey][futureYear] !== undefined) {
                      baseAssetProjections[assetKey][futureYear] += itemValue * Math.pow(1 + growthRate / 100, futureYear - year);
                    }
                  }
                }
              }
              // Don't add to totalIncome - dividends are reinvested, not received as cash
            } else {
              // Not reinvested - add to income (cash flow)
              totalIncome += itemValue;
            }
          });

          // Calculate expenses with random variation
          let totalExpenses = 0;
          let totalTaxDeductibleExpenses = 0; // Track tax-deductible expenses for tax calculation
          const federalTaxExpenseItem = expenseItems.find(item => item.description === FEDERAL_TAX_EXPENSE_DESCRIPTION);
          const regularExpenseItems = expenseItems.filter(item => item.description !== FEDERAL_TAX_EXPENSE_DESCRIPTION);
          
          // Process regular expenses first (excluding federal tax expense)
          regularExpenseItems.forEach(item => {
            const currentProjectionYear = currentYear + year;
            // Calculate year fraction to handle one-time items and partial years
            const yearFraction = calculateYearFraction(item.start_date, item.end_date, currentProjectionYear);
            if (yearFraction === 0) {
              // Item is not active in this year, skip it
              return;
            }

            let itemValue = item.yearly_value;
            
            if (item.linked_item_id && item.linked_item_type === "asset" && item.percentage !== null) {
              const linkedAsset = assets.find(a => a.id === item.linked_item_id);
              if (linkedAsset && baseAssetProjections[linkedAsset.name]) {
                const baseValue = baseAssetProjections[linkedAsset.name][year];
                const variation = (Math.random() * volatility * 2 - volatility) / 100;
                const variedValue = baseValue * (1 + variation);
                itemValue = variedValue * (item.percentage / 100.0);
              }
            } else if (item.linked_item_id && item.linked_item_type === "income" && item.percentage !== null) {
              // Expense linked to income - calculate based on linked income value
              const linkedIncomeItem = incomeItems.find(i => i.id === item.linked_item_id);
              if (linkedIncomeItem) {
                // Calculate the linked income value for this year
                let linkedIncomeValue = linkedIncomeItem.yearly_value || 0;
                
                // Check if linked income is also dynamic (linked to asset)
                if (linkedIncomeItem.linked_item_id && linkedIncomeItem.linked_item_type === "asset" && linkedIncomeItem.percentage !== null) {
                  const linkedAsset = assets.find(a => a.id === linkedIncomeItem.linked_item_id);
                  if (linkedAsset && baseAssetProjections[linkedAsset.name]) {
                    const baseValue = baseAssetProjections[linkedAsset.name][year];
                    const variation = (Math.random() * volatility * 2 - volatility) / 100;
                    const variedValue = baseValue * (1 + variation);
                    linkedIncomeValue = variedValue * (linkedIncomeItem.percentage / 100.0);
                  }
                } else {
                  // Fixed income - apply growth rate with variation
                  const variation = (Math.random() * volatility * 2 - volatility) / 100;
                  const increaseRate = (linkedIncomeItem.annual_increase_percent || 0) / 100;
                  linkedIncomeValue = linkedIncomeItem.yearly_value * Math.pow(1 + increaseRate, year) * (1 + variation);
                }
                
                // Apply year fraction to linked income for one-time items and partial years
                const linkedIncomeYearFraction = calculateYearFraction(linkedIncomeItem.start_date, linkedIncomeItem.end_date, currentProjectionYear);
                linkedIncomeValue = linkedIncomeValue * linkedIncomeYearFraction;
                
                // Calculate expense as percentage of linked income
                itemValue = linkedIncomeValue * (item.percentage / 100.0);
              } else {
                // Linked income item not found - use fixed value with inflation and variation
                const variation = (Math.random() * volatility * 2 - volatility) / 100;
                const inflationRate = (item.inflation_percent || 2.0) / 100;
                itemValue = item.yearly_value * Math.pow(1 + inflationRate, year) * (1 + variation);
              }
            } else {
              // Add random variation to fixed expenses
              const variation = (Math.random() * volatility * 2 - volatility) / 100;
              const inflationRate = (item.inflation_percent || 2.0) / 100;
              itemValue = item.yearly_value * Math.pow(1 + inflationRate, year) * (1 + variation);
            }
            
            // Apply year fraction to prorate for one-time items and partial years
            itemValue = itemValue * yearFraction;
            
            // Count tax-deductible expenses for tax calculation
            if (item.tax_deductible) {
              totalTaxDeductibleExpenses += itemValue;
            }
            
            totalExpenses += itemValue;
            
            // Handle expenses that contribute to assets
            if (item.contributes_to_asset_id) {
              const targetAsset = assets.find(a => a.id === item.contributes_to_asset_id);
              if (targetAsset && assetContributionsByYear[targetAsset.name]) {
                // Track contribution for this year (will be added to asset after growth)
                assetContributionsByYear[targetAsset.name][year] += itemValue;
              }
            }
          });
        
          // Calculate federal taxes if the expense item exists
          let federalTax = 0;
          if (federalTaxExpenseItem && userSettings) {
            const currentProjectionYear = currentYear + year;
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

          // Calculate net cash flow
          const netCashFlow = totalIncome - totalExpenses;
          
          // Apply contributions to assets for this year (after growth has been applied)
          assets.forEach(asset => {
            const contribution = assetContributionsByYear[asset.name][year] || 0;
            if (contribution > 0 && baseAssetProjections[asset.name][year] !== undefined) {
              // Add contribution to current year
              baseAssetProjections[asset.name][year] += contribution;
              
              // Apply growth to contribution for future years
              const growthRate = (asset.annual_increase_percent || 0) / 100;
              for (let futureYear = year + 1; futureYear <= projectionYears; futureYear++) {
                if (baseAssetProjections[asset.name][futureYear] !== undefined) {
                  const yearsOfGrowth = futureYear - year;
                  baseAssetProjections[asset.name][futureYear] += contribution * Math.pow(1 + growthRate, yearsOfGrowth);
                }
              }
            }
          });
          
          // Add net cash flow (surplus/deficit) to a cash asset if specified, otherwise to first cash-like asset
          // This ensures net worth includes accumulated cash flow
          if (netCashFlow !== 0 && assets.length > 0) {
            let targetAsset = null;
            
            // Try to use surplus asset from user settings
            if (userSettings && userSettings.surplus_asset_id) {
              targetAsset = assets.find(a => a.id === userSettings.surplus_asset_id);
            }
            
            // If no surplus asset specified, try to find a cash/checking asset
            if (!targetAsset) {
              targetAsset = assets.find(a => 
                a.category && (a.category.toLowerCase().includes('cash') || 
                               a.category.toLowerCase().includes('checking') ||
                               a.category.toLowerCase().includes('savings'))
              );
            }
            
            // Fallback to first asset if no cash asset found
            if (!targetAsset && assets.length > 0) {
              targetAsset = assets[0];
            }
            
            if (targetAsset && baseAssetProjections[targetAsset.name]) {
              // Add net cash flow to this asset for current and future years
              baseAssetProjections[targetAsset.name][year] += netCashFlow;
              
              // Apply growth to surplus for future years
              const growthRate = (targetAsset.annual_increase_percent || 0) / 100;
              for (let futureYear = year + 1; futureYear <= projectionYears; futureYear++) {
                if (baseAssetProjections[targetAsset.name][futureYear] !== undefined) {
                  const yearsOfGrowth = futureYear - year;
                  baseAssetProjections[targetAsset.name][futureYear] += netCashFlow * Math.pow(1 + growthRate, yearsOfGrowth);
                }
              }
            }
          }
          
          // Calculate net worth (simplified - sum of assets minus liabilities)
          let totalAssets = 0;
          assets.forEach(asset => {
            const baseValue = baseAssetProjections[asset.name][year];
            const variation = (Math.random() * volatility * 2 - volatility) / 100;
            totalAssets += baseValue * (1 + variation);
          });

          let totalLiabilities = 0;
          liabilities.forEach(liability => {
            const projectionYear = currentYear + year;
            // Check if liability is active for this year (respects end_date)
            const yearFraction = calculateYearFraction(liability.start_date, liability.end_date, projectionYear);
            if (yearFraction > 0) {
              const growthRate = (liability.annual_increase_percent || 0) / 100;
              const liabilityValue = liability.value * Math.pow(1 + growthRate, year);
              totalLiabilities += liabilityValue;
            }
            // If liability has ended (yearFraction === 0), don't add to total (value is 0)
          });

          const netWorth = totalAssets - totalLiabilities;

          yearlyData.push({
            year: currentYear + year,
            income: totalIncome,
            expenses: totalExpenses,
            netCashFlow: netCashFlow,
            netWorth: netWorth
          });
        }

        simulationResults.push(yearlyData);
      }

      // Calculate statistics across all simulations
      const statistics = [];
      for (let year = 0; year <= projectionYears; year++) {
        const yearData = {
          year: currentYear + year,
          netCashFlow: {
            values: simulationResults.map(sim => sim[year].netCashFlow).sort((a, b) => a - b),
          },
          netWorth: {
            values: simulationResults.map(sim => sim[year].netWorth).sort((a, b) => a - b),
          }
        };

        const getPercentile = (sortedArray, percentile) => {
          const index = Math.floor(sortedArray.length * percentile / 100);
          return sortedArray[index] || 0;
        };

        yearData.netCashFlow.p10 = getPercentile(yearData.netCashFlow.values, 10);
        yearData.netCashFlow.p25 = getPercentile(yearData.netCashFlow.values, 25);
        yearData.netCashFlow.p50 = getPercentile(yearData.netCashFlow.values, 50); // Median
        yearData.netCashFlow.p75 = getPercentile(yearData.netCashFlow.values, 75);
        yearData.netCashFlow.p90 = getPercentile(yearData.netCashFlow.values, 90);
        yearData.netCashFlow.mean = yearData.netCashFlow.values.reduce((a, b) => a + b, 0) / yearData.netCashFlow.values.length;

        yearData.netWorth.p10 = getPercentile(yearData.netWorth.values, 10);
        yearData.netWorth.p25 = getPercentile(yearData.netWorth.values, 25);
        yearData.netWorth.p50 = getPercentile(yearData.netWorth.values, 50);
        yearData.netWorth.p75 = getPercentile(yearData.netWorth.values, 75);
        yearData.netWorth.p90 = getPercentile(yearData.netWorth.values, 90);
        yearData.netWorth.mean = yearData.netWorth.values.reduce((a, b) => a + b, 0) / yearData.netWorth.values.length;

        statistics.push(yearData);
      }

      setResults(statistics);
      setSimulationSeries(simulationResults);
      const terminalValues = simulationResults
        .map(sim => sim[projectionYears]?.netWorth ?? 0)
        .filter((value) => typeof value === "number");
      if (terminalValues.length > 0) {
        const successCount = terminalValues.filter(value => value > 0).length;
        setSuccessRate((successCount / terminalValues.length) * 100);
      } else {
        setSuccessRate(null);
      }
      setLoading(false);
      // Notify auto-disbursements to refresh RMD values after simulation run.
      window.dispatchEvent(new CustomEvent('rmdRefreshRequested', { detail: { source: 'monteCarloSimulation' } }));
    }, 100);
  };

  const exportToPDF = async () => {
    if (!chartRef.current || !results) return;

    try {
      const canvas = await html2canvas(chartRef.current, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      
      const pdf = new jsPDF('landscape', 'pt', [canvas.width, canvas.height]);
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save(`monte-carlo-projection-${currentYear}.pdf`);
    } catch (error) {
    }
  };

  const netWorthChartData = results ? {
    labels: results.map(d => d.year),
    datasets: [
      {
        label: '10th Percentile',
        data: results.map(d => d.netWorth.p10),
        borderColor: 'rgba(255, 99, 132, 0.5)',
        backgroundColor: 'rgba(255, 99, 132, 0.1)',
        borderDash: [5, 5],
        fill: false,
      },
      {
        label: '25th Percentile',
        data: results.map(d => d.netWorth.p25),
        borderColor: 'rgba(255, 159, 64, 0.5)',
        backgroundColor: 'rgba(255, 159, 64, 0.1)',
        borderDash: [3, 3],
        fill: false,
      },
      {
        label: 'Median (50th)',
        data: results.map(d => d.netWorth.p50),
        borderColor: 'rgba(54, 162, 235, 1)',
        backgroundColor: 'rgba(54, 162, 235, 0.1)',
        fill: false,
      },
      {
        label: 'Mean',
        data: results.map(d => d.netWorth.mean),
        borderColor: 'rgba(75, 192, 192, 1)',
        backgroundColor: 'rgba(75, 192, 192, 0.1)',
        borderDash: [2, 2],
        fill: false,
      },
      {
        label: '75th Percentile',
        data: results.map(d => d.netWorth.p75),
        borderColor: 'rgba(255, 159, 64, 0.5)',
        backgroundColor: 'rgba(255, 159, 64, 0.1)',
        borderDash: [3, 3],
        fill: false,
      },
      {
        label: '90th Percentile',
        data: results.map(d => d.netWorth.p90),
        borderColor: 'rgba(255, 99, 132, 0.5)',
        backgroundColor: 'rgba(255, 99, 132, 0.1)',
        borderDash: [5, 5],
        fill: false,
      },
    ],
  } : null;

  const netCashFlowChartData = results ? {
    labels: results.map(d => d.year),
    datasets: [
      {
        label: '10th Percentile',
        data: results.map(d => d.netCashFlow.p10),
        borderColor: 'rgba(255, 99, 132, 0.5)',
        backgroundColor: 'rgba(255, 99, 132, 0.1)',
        borderDash: [5, 5],
        fill: false,
      },
      {
        label: '25th Percentile',
        data: results.map(d => d.netCashFlow.p25),
        borderColor: 'rgba(255, 159, 64, 0.5)',
        backgroundColor: 'rgba(255, 159, 64, 0.1)',
        borderDash: [3, 3],
        fill: false,
      },
      {
        label: 'Median (50th)',
        data: results.map(d => d.netCashFlow.p50),
        borderColor: 'rgba(54, 162, 235, 1)',
        backgroundColor: 'rgba(54, 162, 235, 0.1)',
        fill: false,
      },
      {
        label: 'Mean',
        data: results.map(d => d.netCashFlow.mean),
        borderColor: 'rgba(75, 192, 192, 1)',
        backgroundColor: 'rgba(75, 192, 192, 0.1)',
        borderDash: [2, 2],
        fill: false,
      },
      {
        label: '75th Percentile',
        data: results.map(d => d.netCashFlow.p75),
        borderColor: 'rgba(255, 159, 64, 0.5)',
        backgroundColor: 'rgba(255, 159, 64, 0.1)',
        borderDash: [3, 3],
        fill: false,
      },
      {
        label: '90th Percentile',
        data: results.map(d => d.netCashFlow.p90),
        borderColor: 'rgba(255, 99, 132, 0.5)',
        backgroundColor: 'rgba(255, 99, 132, 0.1)',
        borderDash: [5, 5],
        fill: false,
      },
    ],
  } : null;

  const finalYearIndex = projectionYears;
  const terminalNetWorthSeries = simulationSeries
    ? simulationSeries.map(sim => sim[finalYearIndex]?.netWorth ?? 0)
    : [];

  const spaghettiSamples = simulationSeries ? simulationSeries.slice(0, 50) : [];
  const spaghettiChartData = spaghettiSamples.length && results ? {
    labels: results.map(d => d.year),
    datasets: spaghettiSamples.map((sim, idx) => ({
      label: `Sim ${idx + 1}`,
      data: sim.map(point => point.netWorth),
      borderColor: `rgba(33, 150, 243, ${0.3 + (idx % 10) * 0.05})`,
      borderWidth: 1,
      pointRadius: 0,
      fill: false,
      tension: 0.3,
    })),
  } : null;

  const histogramData = terminalNetWorthSeries.length ? (() => {
    const binCount = 12;
    const minValue = Math.min(...terminalNetWorthSeries);
    const maxValue = Math.max(...terminalNetWorthSeries);
    const range = Math.max(maxValue - minValue, 1);
    const binSize = range / binCount;
    const bins = new Array(binCount).fill(0);
    terminalNetWorthSeries.forEach(value => {
      let index = Math.floor((value - minValue) / binSize);
      if (index >= binCount) index = binCount - 1;
      if (index < 0) index = 0;
      bins[index]++;
    });
    const labels = bins.map((_, index) => {
      const start = minValue + index * binSize;
      const end = start + binSize;
      return `${formatCurrency(start)} - ${formatCurrency(end)}`;
    });
    return {
      labels,
      datasets: [
        {
          label: `Terminal Net Worth (${currentYear + projectionYears})`,
          data: bins,
          backgroundColor: 'rgba(75, 192, 192, 0.6)',
        },
      ],
    };
  })() : null;

  const histogramOptions = {
    responsive: true,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: (context) => `${context.parsed.y} simulations`,
        },
      },
      title: {
        display: true,
        text: `Terminal Net Worth Distribution (${currentYear + projectionYears})`,
      },
    },
    scales: {
      x: {
        ticks: {
          callback: (value, index) => {
            const label = histogramData?.labels?.[index];
            return label ? label.split(' - ')[0] : '';
          },
        },
      },
      y: {
        beginAtZero: true,
      },
    },
  };

  const userLabelSuffix = userSettings?.person1_first_name && userSettings?.person1_last_name
    ? ` - ${userSettings.person1_first_name} ${userSettings.person1_last_name}`
    : '';

  const chartTitleFor = (label) => `Monte Carlo ${label}${userLabelSuffix}`;

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: chartTitleFor('Projections'),
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'End of Year',
        },
      },
      y: {
        beginAtZero: false,
        ticks: {
          callback: (value) => formatCurrency(value),
        },
      },
    },
  };

  const fanChartOptions = {
    ...chartOptions,
    plugins: {
      ...chartOptions.plugins,
      title: {
        ...chartOptions.plugins.title,
        text: chartTitleFor('Fan Chart - Net Worth'),
      },
    },
  };

  const spaghettiChartOptions = {
    ...chartOptions,
    plugins: {
      ...chartOptions.plugins,
      legend: {
        display: false,
      },
      title: {
        ...chartOptions.plugins.title,
        text: chartTitleFor('Spaghetti Plot'),
      },
    },
  };

  return (
    <Box sx={{ width: "100%" }}>
      <Paper variant="outlined" sx={projectionSectionCardSx}>
        <Typography variant="h5" fontWeight="600" gutterBottom>
          Monte Carlo Projections
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Run probabilistic simulations to see the range of possible financial outcomes.
        </Typography>

        {showProjectionYearSelector && (
          <Stack sx={{ width: { xs: "100%", md: 300 }, mb: 2 }} spacing={0.5}>
            <Typography variant="body2" color="text.secondary">
              Projection Years: <strong>{sliderProjectionYears}</strong>
            </Typography>
            <Slider
              id="monte-carlo-years"
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

        <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ xs: "stretch", md: "flex-end" }}>
          <TextField
            id="num-simulations"
            label="Simulations"
            type="number"
            size="small"
            value={numSimulations}
            onChange={(e) => setNumSimulations(parseInt(e.target.value, 10) || 1000)}
            inputProps={{ min: 100, max: 10000, step: 100 }}
            helperText="Number of simulations to run"
          />
          <TextField
            id="volatility"
            label="Volatility (%)"
            type="number"
            size="small"
            value={volatility}
            onChange={(e) => setVolatility(parseFloat(e.target.value) || 15)}
            inputProps={{ min: 0, max: 50, step: 1 }}
            helperText="Standard deviation for random growth variation"
          />
          <Stack direction="row" spacing={1}>
            <Button onClick={runMonteCarloSimulation} disabled={loading} variant="contained" sx={projectionActionButtonSx}>
              {loading ? "Running Simulations..." : "Run Monte Carlo Simulation"}
            </Button>
            {results && (
              <Button onClick={exportToPDF} variant="outlined" sx={projectionSecondaryButtonSx}>
                Export to PDF
              </Button>
            )}
          </Stack>
        </Stack>
        {loading && <LinearProgress sx={{ mt: 2 }} />}
      </Paper>

      {results && (
        <Box ref={chartRef}>
          <Paper variant="outlined" sx={projectionSectionCardSx}>
            <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2}>
              <FormControl size="small" sx={{ minWidth: 220 }}>
                <InputLabel id="monte-carlo-view-label">View</InputLabel>
                <Select
                  labelId="monte-carlo-view-label"
                  id="monte-carlo-view"
                  value={selectedView}
                  label="View"
                  onChange={(e) => setSelectedView(e.target.value)}
                >
                  <MenuItem value="fan">Fan Chart</MenuItem>
                  <MenuItem value="spaghetti">Spaghetti Plot</MenuItem>
                  <MenuItem value="histogram">Terminal Value Histogram</MenuItem>
                  <MenuItem value="success">Success Rate</MenuItem>
                </Select>
              </FormControl>
              <Paper variant="outlined" sx={{ p: 2, minWidth: 260 }}>
                <Typography variant="body2" color="text.secondary">Success Rate</Typography>
                <Typography variant="h4" fontWeight="600">
                  {successRate !== null ? `${successRate.toFixed(1)}%` : "Calculating..."}
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(100, Math.max(0, successRate ?? 0))}
                  sx={{ mt: 1, mb: 1, height: 8, borderRadius: 4 }}
                />
                <Typography variant="caption" color="text.secondary">
                  % of simulations with terminal net worth &gt; 0
                </Typography>
              </Paper>
            </Stack>
          </Paper>

          {selectedView === 'fan' && (
            <Paper variant="outlined" sx={projectionSectionCardSx}>
              <Typography variant="h6" fontWeight="600" gutterBottom>
                Net Worth Projections (Fan Chart)
              </Typography>
              <Box sx={{ height: 400 }}>
                <Line data={netWorthChartData} options={fanChartOptions} />
              </Box>
            </Paper>
          )}

          {selectedView === 'spaghetti' && (
            <Paper variant="outlined" sx={projectionSectionCardSx}>
              <Typography variant="h6" fontWeight="600" gutterBottom>
                Spaghetti Plot
              </Typography>
              <Box sx={{ height: 400 }}>
                {spaghettiChartData ? (
                  <Line data={spaghettiChartData} options={spaghettiChartOptions} />
                ) : (
                  <Typography>No simulation data available yet.</Typography>
                )}
              </Box>
            </Paper>
          )}

          {selectedView === 'histogram' && (
            <Paper variant="outlined" sx={projectionSectionCardSx}>
              <Typography variant="h6" fontWeight="600" gutterBottom>
                Terminal Value Distribution Histogram
              </Typography>
              <Box sx={{ height: 400 }}>
                {histogramData ? (
                  <Bar data={histogramData} options={histogramOptions} />
                ) : (
                  <Typography>No distribution data available yet.</Typography>
                )}
              </Box>
            </Paper>
          )}

          {selectedView === 'success' && (
            <Paper variant="outlined" sx={projectionSectionCardSx}>
              <Typography variant="h6" fontWeight="600">Success Rate Details</Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>Success = terminal net worth &gt; 0</Typography>
              <Typography variant="h4" fontWeight="600">
                {successRate !== null ? `${successRate.toFixed(1)}%` : 'Calculating...'}
              </Typography>
              <LinearProgress
                variant="determinate"
                value={Math.min(100, Math.max(0, successRate ?? 0))}
                sx={{ mt: 1, mb: 1.5, height: 10, borderRadius: 4 }}
              />
              <Typography variant="body2" color="text.secondary">
                Confidence the Monte Carlo projection ends in positive net worth.
              </Typography>
            </Paper>
          )}

          <Paper variant="outlined" sx={projectionSectionCardSx}>
            <Typography variant="h6" fontWeight="600" gutterBottom>
              Statistical Summary - Net Worth
            </Typography>
            <TableContainer sx={projectionTableContainerSx}>
              <Table size="small" ref={tableRef}>
                <TableHead>
                  <TableRow>
                    <TableCell>EoY</TableCell>
                    <TableCell align="right">10th %ile</TableCell>
                    <TableCell align="right">25th %ile</TableCell>
                    <TableCell align="right">Median</TableCell>
                    <TableCell align="right">Mean</TableCell>
                    <TableCell align="right">75th %ile</TableCell>
                    <TableCell align="right">90th %ile</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {results.map((stat, index) => (
                    <TableRow key={index}>
                      <TableCell>{stat.year}</TableCell>
                      <TableCell align="right">{formatCurrency(stat.netWorth.p10)}</TableCell>
                      <TableCell align="right">{formatCurrency(stat.netWorth.p25)}</TableCell>
                      <TableCell align="right"><strong>{formatCurrency(stat.netWorth.p50)}</strong></TableCell>
                      <TableCell align="right">{formatCurrency(stat.netWorth.mean)}</TableCell>
                      <TableCell align="right">{formatCurrency(stat.netWorth.p75)}</TableCell>
                      <TableCell align="right">{formatCurrency(stat.netWorth.p90)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>

          <Paper variant="outlined" sx={projectionSectionCardSx}>
            <Typography variant="h6" fontWeight="600" gutterBottom>
              Net Cash Flow Projections
            </Typography>
            <Box sx={{ height: 400 }}>
              <Line data={netCashFlowChartData} options={{
                ...chartOptions,
                plugins: {
                  ...chartOptions.plugins,
                  title: {
                    ...chartOptions.plugins.title,
                    text: `Monte Carlo Net Cash Flow Projections${userSettings?.person1_first_name && userSettings?.person1_last_name ? ` - ${userSettings.person1_first_name} ${userSettings.person1_last_name}` : ''}`,
                  },
                },
              }} />
            </Box>
          </Paper>

          <Paper variant="outlined" sx={{ ...projectionSectionCardSx, mb: 0 }}>
            <Typography variant="h6" fontWeight="600" gutterBottom>
              Statistical Summary - Net Cash Flow
            </Typography>
            <TableContainer sx={projectionTableContainerSx}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>EoY</TableCell>
                    <TableCell align="right">10th %ile</TableCell>
                    <TableCell align="right">25th %ile</TableCell>
                    <TableCell align="right">Median</TableCell>
                    <TableCell align="right">Mean</TableCell>
                    <TableCell align="right">75th %ile</TableCell>
                    <TableCell align="right">90th %ile</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {results.map((stat, index) => (
                    <TableRow key={index}>
                      <TableCell>{stat.year}</TableCell>
                      <TableCell align="right">{formatCurrency(stat.netCashFlow.p10)}</TableCell>
                      <TableCell align="right">{formatCurrency(stat.netCashFlow.p25)}</TableCell>
                      <TableCell align="right"><strong>{formatCurrency(stat.netCashFlow.p50)}</strong></TableCell>
                      <TableCell align="right">{formatCurrency(stat.netCashFlow.mean)}</TableCell>
                      <TableCell align="right">{formatCurrency(stat.netCashFlow.p75)}</TableCell>
                      <TableCell align="right">{formatCurrency(stat.netCashFlow.p90)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Box>
      )}
    </Box>
  );
}

