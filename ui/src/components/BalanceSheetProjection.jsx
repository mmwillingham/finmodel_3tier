import React, { useRef, useState, useEffect, useCallback } from "react";
import { useAuth } from '../context/AuthContext';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { Line, Pie } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, ArcElement, Title, Tooltip, Legend, Filler } from "chart.js";
import { Alert, Box, Button, FormControlLabel, Paper, Slider, Stack, Switch, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from "@mui/material";
import { projectionActionButtonSx, projectionSectionCardSx, projectionTableContainerSx } from "../utils/projectionUiStyles";
import { createDarkLineChartOptions, createDarkPieChartOptions, darkChartPanelSx, DARK_CHART_SERIES_COLORS } from "../utils/darkChartTheme";
import ProjectionService from '../services/projection.service';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ArcElement, Title, Tooltip, Legend, Filler);

export default function BalanceSheetProjection({ assets, liabilities, incomeItems, expenseItems, projectionYears, formatCurrency, showChartTotals, compact = false, showProjectionYearSelector = false, onProjectionYearsChange, maxProjectionYears, isLimitedPlan = false }) {
  const { userSettings, currentUser } = useAuth();
  const currentYear = new Date().getFullYear();
  const overallChartRef = useRef(null);
  const overallTableRef = useRef(null);
  const individualAssetChartRef = useRef(null);
  const individualAssetTableRef = useRef(null);
  const individualLiabilityChartRef = useRef(null);
  const individualLiabilityTableRef = useRef(null);
  const individualAssetPieChartRef = useRef(null);
  const individualLiabilityPieChartRef = useRef(null);
  
  const [loading, setLoading] = useState(true);
  const [projectionData, setProjectionData] = useState(null);
  const [error, setError] = useState(null);
  const [showTotalsInChart, setShowTotalsInChart] = useState(true); // Local state for "Show Totals" checkbox
  const [sliderProjectionYears, setSliderProjectionYears] = useState(projectionYears ?? 30);
  const missingDataMessage = "No data yet. Add assets and/or liabilities to generate projections.";

  const getProjectionErrorMessage = (err) => {
    const detail = err?.response?.data?.detail;
    if (detail && typeof detail === "string") return detail;
    if (err?.response?.status === 403) return missingDataMessage;
    return err?.message || "Failed to calculate projections";
  };

  // Convert assets and liabilities to ProjectedAccountCreate format and call backend
  const fetchProjectionData = useCallback(async () => {
    if (!assets || !liabilities) {
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Convert assets to ProjectedAccountCreate format
      // Note: Expenses that contribute to assets are now handled by the backend
      // We no longer need to pre-calculate contributions here for fixed expenses
      // The backend will query for expenses that contribute to assets and add them after calculating expense flows
      const assetAccounts = assets.map(asset => {
        return {
          name: asset.name,
          account_type: 'asset',
          initial_value: asset.value || 0,
          contribution: 0.0, // Contributions from expenses are now handled by backend
          growth_rate: asset.annual_increase_percent || 0,
          loan_type: null,
          principal_amount: null,
          interest_rate: null,
          loan_term_months: null,
          loan_start_date: null,
          monthly_payment: null,
          start_date: asset.start_date || null,
          end_date: asset.end_date || null
        };
      });

      // Convert liabilities to ProjectedAccountCreate format
      const liabilityAccounts = liabilities.map(liability => ({
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
        // Handle dynamic items (linked to asset)
        let accountName = income.description;
        let contribution = 0.0;
        
        if (income.linked_item_type === "asset" && income.percentage !== null && income.percentage !== undefined) {
          // This is a dynamic item - will be recalculated each year in backend
          // Check for multi-select linked assets first
          if (income.linked_asset_ids && income.linked_asset_ids.length > 0) {
            // Multi-select: Get all linked asset names
            const linkedAssets = assets.filter(a => income.linked_asset_ids.includes(a.id));
            if (linkedAssets.length > 0) {
              const assetNames = linkedAssets.map(a => a.name).join(',');
              accountName = `${income.description}|LINKED:${assetNames}|PERCENTAGE:${income.percentage}`;
            }
          } else if (income.linked_item_id) {
            // Single linked asset (backward compatibility)
            const linkedAsset = assets.find(a => a.id === income.linked_item_id);
            if (linkedAsset) {
              accountName = `${income.description}|LINKED:${linkedAsset.name}|PERCENTAGE:${income.percentage}`;
            }
          }
        } else {
          // Fixed income item
          contribution = income.yearly_value / 12; // Convert yearly to monthly
        }
        
        // Ensure start_date == end_date for one-time income so backend correctly detects them
        let incomeStartDate = income.start_date || null;
        let incomeEndDate = income.end_date || null;
        if (income.frequency === 'one-time') {
          // For one-time income, ensure dates are equal
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
          contribution: contribution,
          growth_rate: income.annual_increase_percent || 0,
          loan_type: null,
          principal_amount: null,
          interest_rate: null,
          loan_term_months: null,
          loan_start_date: null,
          monthly_payment: null,
          start_date: incomeStartDate,
          end_date: incomeEndDate,
          cash_flow_item_id: income.id  // NEW: Store cash_flow_item_id for reliable ID-based lookups
        };
      });

      // Convert expense items to ProjectedAccountCreate format
      // Include ALL expenses (even those that contribute to assets, as they reduce cash flow)
      const expenseAccounts = (expenseItems || []).map(expense => {
          // Handle dynamic items (linked to asset or income)
          let accountName = expense.description;
          let contribution = 0.0;
          
          if (expense.linked_item_id && expense.linked_item_type === "asset" && expense.percentage !== null && expense.percentage !== undefined) {
            // This is a dynamic item - will be recalculated each year in backend
            // Find the linked asset name
            const linkedAsset = assets.find(a => a.id === expense.linked_item_id);
            if (linkedAsset) {
              accountName = `${expense.description}|LINKED:${linkedAsset.name}|PERCENTAGE:${expense.percentage}`;
            }
          } else if (expense.linked_item_id && expense.linked_item_type === "income" && expense.percentage !== null && expense.percentage !== undefined) {
            // This is a dynamic expense linked to income - will be recalculated each year in backend
            // Find the linked income item
            const linkedIncome = incomeItems.find(i => i.id === expense.linked_item_id);
            if (linkedIncome) {
              accountName = `${expense.description}|LINKED_INCOME:${linkedIncome.description}|PERCENTAGE:${expense.percentage}`;
            }
          } else {
            // Fixed expense item
            // For one-time expenses (frequency === 'one-time' or start_date === end_date),
            // yearly_value is the total amount to apply once in that year.
            // For monthly/yearly expenses, yearly_value is the annual amount.
            // In both cases, convert to monthly contribution (divide by 12).
            // The backend will multiply by 12 to get annual, then apply year_fraction.
            // For one-time items, year_fraction = 1.0, so the full amount is applied.
            contribution = -(expense.yearly_value / 12); // Negative for expenses, convert to monthly
          }
          
          // Ensure start_date == end_date for one-time expenses so backend correctly detects them
          let expenseStartDate = expense.start_date || null;
          let expenseEndDate = expense.end_date || null;
          if (expense.frequency === 'one-time') {
            // For one-time expenses, ensure dates are equal
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
            contribution: contribution,
            growth_rate: expense.inflation_percent || 0,
            loan_type: null,
            principal_amount: null,
            start_date: expenseStartDate,
            end_date: expenseEndDate,
            interest_rate: null,
            loan_term_months: null,
            loan_start_date: null,
            monthly_payment: null,
            cash_flow_item_id: expense.id  // NEW: Store cash_flow_item_id for reliable ID-based lookups
          };
        });

      const allAccounts = [...assetAccounts, ...liabilityAccounts, ...incomeAccounts, ...expenseAccounts];
      
      // Create projection request
      const projectionRequest = {
        plan_name: "Balance Sheet Projection",
        years: projectionYears,
        accounts: allAccounts
      };

      // Check if a "Balance Sheet Projection" already exists and update it, otherwise create new
      let projectionId = null;
      let canUpdate = false;
      try {
        const existingProjections = await ProjectionService.getProjections();
        const existing = existingProjections.find(p => p.name === "Balance Sheet Projection");
        if (existing) {
          // Only attempt update if we own the projection
          if (existing.owner_id === currentUser?.id) {
            projectionId = existing.id;
            canUpdate = true;
          } else {
          }
        }
      } catch (e) {
      }

      let projection;
      if (projectionId && canUpdate) {
        try {
          // Try to update existing projection
          projection = await ProjectionService.updateProjection(projectionId, projectionRequest);
        } catch (err) {
          // If update fails for any reason, create a new one
          projection = await ProjectionService.createProjection(projectionRequest);
        }
      } else {
        // Create new projection
        projection = await ProjectionService.createProjection(projectionRequest);
      }

      // Notify auto-disbursements to refresh RMD values after projection run.
      window.dispatchEvent(new CustomEvent('rmdRefreshRequested', { detail: { source: 'balanceSheetProjection', projectionId: projection.id || projectionId } }));

      // Parse the data_json
      if (projection.data_json) {
        const parsedData = JSON.parse(projection.data_json);
        setProjectionData(parsedData);
      } else {
        // Fetch full projection details if data_json not in response
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

  useEffect(() => {
    fetchProjectionData();
  }, [fetchProjectionData]);

  useEffect(() => {
    setSliderProjectionYears(projectionYears ?? 30);
  }, [projectionYears]);

  // Parse projection data into the format needed for charts/tables
  const parseProjectionData = () => {
    if (!projectionData || !Array.isArray(projectionData) || projectionData.length === 0) {
      return {
        years: [],
        totalAssetValues: [],
        totalLiabilityValues: [],
        netWorthValues: [],
        individualAssetProjections: [],
        individualLiabilityProjections: []
      };
    }

    const years = projectionData.map(dp => dp.Year || (currentYear + dp.year - 1));
    const totalAssetValues = projectionData.map(dp => dp["Total Assets"] || 0);
    const totalLiabilityValues = projectionData.map(dp => Math.abs(dp["Total Liabilities"] || 0)); // Convert to positive for display
    const netWorthValues = projectionData.map(dp => dp["Net Worth"] || 0);

    // Extract individual asset projections
    const individualAssetProjections = assets.map(asset => {
      const key = `${asset.name}_Value`;
      const projectedValues = projectionData.map(dp => {
        const value = dp[key] || 0;
        return Math.max(0, value); // Ensure non-negative for assets
      });
      return {
        ...asset,
        projectedValues
      };
    });

    // Extract individual liability projections
    const individualLiabilityProjections = liabilities.map(liability => {
      const key = `${liability.name}_Value`;
      const projectedValues = projectionData.map(dp => {
        const value = dp[key] || 0;
        return Math.abs(value); // Convert to positive for display (backend stores as negative)
      });
      return {
        ...liability,
        projectedValues
      };
    });

    return {
      years,
      totalAssetValues,
      totalLiabilityValues,
      netWorthValues,
      individualAssetProjections,
      individualLiabilityProjections
    };
  };

  const chartOptions = createDarkLineChartOptions({
    title: `Model My Retirement - Overall Financial Snapshot${userSettings?.person1_first_name && userSettings?.person1_last_name ? ` - ${userSettings.person1_first_name} ${userSettings.person1_last_name}` : ''}`,
    beginAtZero: true,
    xAxisTitle: "End of Year",
  });

  // Show every 5th year in tables
  const displayYearsIndices = [];
  if (projectionData && projectionData.length > 0) {
    for (let i = 0; i < projectionData.length; i++) {
      if (i % 5 === 0 || i === projectionData.length - 1) {
        displayYearsIndices.push(i);
      }
    }
  }

  // Download functions
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

  const handleDownloadCombinedProjectionCsv = (filename) => {
    const { years, totalAssetValues, totalLiabilityValues, netWorthValues } = parseProjectionData();
    if (years.length === 0) return;

    const headers = ['Year', 'Total Assets', 'Total Liabilities', 'Net Worth'];
    const csvRows = [headers.join(',')];

    years.forEach((year, index) => {
      const row = [
        year,
        totalAssetValues[index] || 0,
        totalLiabilityValues[index] || 0,
        netWorthValues[index] || 0
      ].map(val => `"${val}"`);
      csvRows.push(row.join(','));
    });

    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename.replace(/\s/g, '_')}.csv`;
    link.click();
  };

  const handleDownloadIndividualProjectionsCsv = (items, filename) => {
    const { years, individualAssetProjections, individualLiabilityProjections } = parseProjectionData();
    if (years.length === 0) return;

    const isAssets = items === individualAssetProjections;
    const headers = ['Name', ...years.map(y => String(y))];
    const csvRows = [headers.join(',')];

    items.forEach(item => {
      const row = [
        item.name,
        ...(isAssets ? item.projectedValues : item.projectedValues).map(val => formatCurrency(val).replace(/[$,]/g, ''))
      ].map(val => `"${val}"`);
      csvRows.push(row.join(','));
    });

    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename.replace(/\s/g, '_')}.csv`;
    link.click();
  };

  if (loading) {
    return (
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Box className="projection-loading-message">
          <Typography>Loading projections. Please be patient...</Typography>
        </Box>
      </Paper>
    );
  }

  if (error) {
    return (
      <Alert severity={error === missingDataMessage ? "info" : "error"} variant="outlined">
        {error === missingDataMessage ? error : `Error: ${error}`}
      </Alert>
    );
  }

  const {
    years,
    totalAssetValues,
    totalLiabilityValues,
    netWorthValues,
    individualAssetProjections,
    individualLiabilityProjections
  } = parseProjectionData();

  if (years.length === 0) {
    return (
      <Alert severity="info" variant="outlined">
        No projection data available
      </Alert>
    );
  }

  // Prepare pie chart data for assets (using last year's data)
  const prepareAssetPieData = () => {
    if (!individualAssetProjections || individualAssetProjections.length === 0) return null;
    const lastIndex = individualAssetProjections[0].projectedValues.length - 1;
    const labels = individualAssetProjections.map(asset => asset.name);
    const data = individualAssetProjections.map(asset => asset.projectedValues[lastIndex]);
    const backgroundColors = individualAssetProjections.map((asset, index) => 
      `hsl(${index * 60}, 70%, 50%)`
    );
    
    return {
      labels,
      datasets: [{
        data,
        backgroundColor: backgroundColors,
        borderColor: '#fff',
        borderWidth: 1
      }]
    };
  };

  // Prepare pie chart data for liabilities (using last year's data)
  const prepareLiabilityPieData = () => {
    if (!individualLiabilityProjections || individualLiabilityProjections.length === 0) return null;
    const lastIndex = individualLiabilityProjections[0].projectedValues.length - 1;
    const labels = individualLiabilityProjections.map(liability => liability.name);
    const data = individualLiabilityProjections.map(liability => liability.projectedValues[lastIndex]);
    const backgroundColors = individualLiabilityProjections.map((liability, index) => 
      `hsl(${index * 60 + 30}, 70%, 50%)`
    );
    
    return {
      labels,
      datasets: [{
        data,
        backgroundColor: backgroundColors,
        borderColor: '#fff',
        borderWidth: 1
      }]
    };
  };

  const assetPieData = prepareAssetPieData();
  const liabilityPieData = prepareLiabilityPieData();
  const lastYear = years.length > 0 ? years[years.length - 1] : currentYear;

  const overallChartData = {
    labels: years,
    datasets: [
      {
        label: "Total Assets",
        data: totalAssetValues,
        borderColor: DARK_CHART_SERIES_COLORS.optimistic,
        backgroundColor: "rgba(52, 211, 153, 0.18)",
        fill: true,
        tension: 0.3,
        pointRadius: 2,
      },
      {
        label: "Total Liabilities",
        data: totalLiabilityValues,
        borderColor: DARK_CHART_SERIES_COLORS.liabilities,
        backgroundColor: "rgba(251, 113, 133, 0.16)",
        fill: true,
        tension: 0.3,
        pointRadius: 2,
      },
      {
        label: "Net Worth",
        data: netWorthValues,
        borderColor: DARK_CHART_SERIES_COLORS.expected,
        backgroundColor: "rgba(56, 189, 248, 0.14)",
        fill: false,
        tension: 0.35,
        pointRadius: 2,
        borderWidth: 2.4,
      },
    ],
  };

  const compactChartOptions = {
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
      <Box className="balance-sheet-compact-chart" sx={{ ...darkChartPanelSx, p: 1.5 }}>
        <Line data={overallChartData} options={compactChartOptions} height={180} />
      </Box>
    );
  }

  return (
    <Box sx={{ width: "100%" }}>
      <Paper variant="outlined" sx={projectionSectionCardSx}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          alignItems={{ xs: "flex-start", md: "center" }}
          justifyContent="space-between"
          spacing={2}
        >
          <Typography variant="h5" fontWeight="600">
            Net Worth Projections
          </Typography>
          {showProjectionYearSelector && (
            <Stack sx={{ width: { xs: "100%", md: 300 } }} spacing={0.5}>
              <Typography variant="body2" color="text.secondary">
                Projection Years: <strong>{sliderProjectionYears}</strong>
              </Typography>
              <Slider
                id="balance-sheet-years"
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
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2, fontStyle: "italic" }}>
          Note: All values are calculated as of December 31st of the specified year.
        </Typography>
      </Paper>

      <Paper variant="outlined" sx={projectionSectionCardSx}>
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems="center" sx={{ mb: 2 }} spacing={2}>
          <Typography variant="h6" fontWeight="600">Overall Financial Snapshot</Typography>
          <Stack direction="row" spacing={1}>
            <Button size="small" variant="contained" sx={projectionActionButtonSx} onClick={() => handleDownloadChartPng(overallChartRef, "Overall_Financial_Snapshot")}>Download PNG</Button>
            <Button size="small" variant="contained" sx={projectionActionButtonSx} onClick={() => handleDownloadChartPdf(overallChartRef, "Overall_Financial_Snapshot")}>Download PDF</Button>
          </Stack>
        </Stack>
        <Box
          sx={{
            ...darkChartPanelSx,
            mt: 1,
            minHeight: 360,
            "& canvas": {
              height: "100% !important",
            },
          }}
        >
          <Line ref={overallChartRef} data={overallChartData} options={chartOptions} />
        </Box>
      </Paper>

      <Paper variant="outlined" sx={{ ...projectionSectionCardSx, mb: 4 }}>
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems="center" sx={{ mb: 2 }} spacing={2}>
          <Typography variant="subtitle1" fontWeight="600">Overall Financial Snapshot Table</Typography>
          <Stack direction="row" spacing={1}>
            <Button size="small" variant="contained" sx={projectionActionButtonSx} onClick={() => handleDownloadTablePdf(overallTableRef, "Overall_Financial_Snapshot_Table")}>Download PDF</Button>
            <Button size="small" variant="contained" sx={projectionActionButtonSx} onClick={() => handleDownloadCombinedProjectionCsv("Overall_Financial_Snapshot_Table")}>Download CSV</Button>
          </Stack>
        </Stack>
        <TableContainer sx={{ ...projectionTableContainerSx, maxHeight: 440 }}>
          <Table stickyHeader size="small" ref={overallTableRef}>
            <TableHead>
              <TableRow>
                <TableCell>EoY</TableCell>
                <TableCell align="right">Total Assets</TableCell>
                <TableCell align="right">Total Liabilities</TableCell>
                <TableCell align="right">Net Worth</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {displayYearsIndices.map((index) => (
                <TableRow key={years[index]}>
                  <TableCell>{years[index]}</TableCell>
                  <TableCell align="right">{formatCurrency(totalAssetValues[index])}</TableCell>
                  <TableCell align="right">{formatCurrency(totalLiabilityValues[index])}</TableCell>
                  <TableCell align="right">{formatCurrency(netWorthValues[index])}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Paper variant="outlined" sx={projectionSectionCardSx}>
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} spacing={2} sx={{ mb: 2 }}>
          <Typography variant="h6" fontWeight="600">Individual Asset Projections</Typography>
          <FormControlLabel
            control={<Switch checked={showTotalsInChart} onChange={(e) => setShowTotalsInChart(e.target.checked)} />}
            label="Show Totals"
          />
        </Stack>
        <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ mb: 2 }}>
          <Button size="small" variant="contained" sx={projectionActionButtonSx} onClick={() => handleDownloadChartPng(individualAssetChartRef, "Individual_Asset_Projections")}>Download PNG</Button>
          <Button size="small" variant="contained" sx={projectionActionButtonSx} onClick={() => handleDownloadChartPdf(individualAssetChartRef, "Individual_Asset_Projections")}>Download PDF</Button>
        </Stack>
        <Box sx={darkChartPanelSx}>
          <Line
            ref={individualAssetChartRef}
            data={{
              labels: years,
              datasets: [
                ...individualAssetProjections.map((asset, index) => ({
                  label: asset.name,
                  data: asset.projectedValues,
                  borderColor: `hsl(${index * 46 + 140}, 78%, 58%)`,
                  backgroundColor: `hsla(${index * 46 + 140}, 78%, 58%, 0.12)`,
                  fill: false,
                  tension: 0.3,
                  pointRadius: 1.5,
                })),
                ...(showTotalsInChart ? [{
                  label: "Total Assets",
                  data: totalAssetValues,
                  borderColor: DARK_CHART_SERIES_COLORS.expected,
                  backgroundColor: "rgba(56, 189, 248, 0.20)",
                  fill: false,
                  borderWidth: 3,
                  pointRadius: 0,
                }] : []),
              ],
            }}
            options={createDarkLineChartOptions({
              title: `Model My Retirement - Individual Asset Projections${userSettings?.person1_first_name && userSettings?.person1_last_name ? ` - ${userSettings.person1_first_name} ${userSettings.person1_last_name}` : ''}`,
              beginAtZero: true,
              xAxisTitle: "End of Year",
            })}
          />
        </Box>
      </Paper>

      {assetPieData && individualAssetProjections.length > 0 && (
        <Paper variant="outlined" sx={projectionSectionCardSx}>
          <Typography variant="subtitle1" fontWeight="600" gutterBottom>
            Asset Distribution - {lastYear}
          </Typography>
          <Box sx={{ maxWidth: 500, mx: "auto" }}>
            <Box sx={darkChartPanelSx}>
              <Pie
                ref={individualAssetPieChartRef}
                data={assetPieData}
                options={createDarkPieChartOptions({
                  title: `Asset Distribution - ${lastYear}`,
                  legendPosition: "right",
                  formatValue: formatCurrency,
                })}
              />
            </Box>
          </Box>
        </Paper>
      )}

      <Paper variant="outlined" sx={{ ...projectionSectionCardSx, mb: 4 }}>
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems="center" sx={{ mb: 2 }} spacing={2}>
          <Typography variant="subtitle1" fontWeight="600">Individual Asset Table</Typography>
          <Stack direction="row" spacing={1}>
            <Button size="small" variant="contained" sx={projectionActionButtonSx} onClick={() => handleDownloadTablePdf(individualAssetTableRef, "Individual_Asset_Projections_Table")}>Download PDF</Button>
            <Button size="small" variant="contained" sx={projectionActionButtonSx} onClick={() => handleDownloadIndividualProjectionsCsv(individualAssetProjections, "Individual_Asset_Projections_Table")}>Download CSV</Button>
          </Stack>
        </Stack>
        <TableContainer sx={projectionTableContainerSx}>
          <Table size="small" ref={individualAssetTableRef}>
            <TableHead>
              <TableRow>
                <TableCell>Asset Name (Category)</TableCell>
                {displayYearsIndices.map((index) => (
                  <TableCell key={years[index]} align="right">{years[index]}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {individualAssetProjections.map((asset) => (
                <TableRow key={asset.id}>
                  <TableCell>{`${asset.name} (${asset.category})`}</TableCell>
                  {displayYearsIndices.map((index) => (
                    <TableCell key={years[index]} align="right">{formatCurrency(asset.projectedValues[index])}</TableCell>
                  ))}
                </TableRow>
              ))}
              <TableRow>
                <TableCell><strong>Total Assets</strong></TableCell>
                {displayYearsIndices.map(index => (
                  <TableCell key={`total-asset-${years[index]}`} align="right"><strong>{formatCurrency(totalAssetValues[index])}</strong></TableCell>
                ))}
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {liabilities.length > 0 && (
        <Paper variant="outlined" sx={projectionSectionCardSx}>
          <Typography variant="h6" fontWeight="600" gutterBottom>
            Individual Liability Projections
          </Typography>
          <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ mb: 2 }}>
            <Button size="small" variant="contained" sx={projectionActionButtonSx} onClick={() => handleDownloadChartPng(individualLiabilityChartRef, "Individual_Liability_Projections")}>Download PNG</Button>
            <Button size="small" variant="contained" sx={projectionActionButtonSx} onClick={() => handleDownloadChartPdf(individualLiabilityChartRef, "Individual_Liability_Projections")}>Download PDF</Button>
          </Stack>
          <Box
            sx={{
              ...darkChartPanelSx,
              minHeight: 360,
              "& canvas": {
                height: "100% !important",
              },
            }}
          >
            <Line
              ref={individualLiabilityChartRef}
              data={{
                labels: years,
                datasets: [
                  ...individualLiabilityProjections.map((liability, index) => ({
                    label: liability.name,
                    data: liability.projectedValues,
                    borderColor: `hsl(${index * 44 + 338}, 84%, 70%)`,
                    backgroundColor: `hsla(${index * 44 + 338}, 84%, 70%, 0.10)`,
                    fill: false,
                    tension: 0.3,
                    pointRadius: 1.5,
                  })),
                  ...(showTotalsInChart ? [{
                    label: "Total Liabilities",
                    data: totalLiabilityValues,
                    borderColor: DARK_CHART_SERIES_COLORS.liabilities,
                    backgroundColor: "rgba(251, 113, 133, 0.16)",
                    fill: false,
                    borderWidth: 3,
                    pointRadius: 0,
                  }] : []),
                ],
              }}
              options={createDarkLineChartOptions({
                title: `Model My Retirement - Individual Liability Projections${userSettings?.person1_first_name && userSettings?.person1_last_name ? ` - ${userSettings.person1_first_name} ${userSettings.person1_last_name}` : ''}`,
                beginAtZero: true,
                xAxisTitle: "End of Year",
              })}
            />
          </Box>
        </Paper>
      )}

      {liabilityPieData && individualLiabilityProjections.length > 0 && (
        <Paper variant="outlined" sx={projectionSectionCardSx}>
          <Typography variant="subtitle1" fontWeight="600" gutterBottom>
            Liability Distribution - {lastYear}
          </Typography>
          <Box sx={{ maxWidth: 500, mx: "auto" }}>
            <Box sx={darkChartPanelSx}>
              <Pie
                ref={individualLiabilityPieChartRef}
                data={liabilityPieData}
                options={createDarkPieChartOptions({
                  title: `Liability Distribution - ${lastYear}`,
                  legendPosition: "right",
                  formatValue: formatCurrency,
                })}
              />
            </Box>
          </Box>
        </Paper>
      )}

      {liabilities.length > 0 && (
        <Paper variant="outlined" sx={{ ...projectionSectionCardSx, mb: 0 }}>
          <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems="center" sx={{ mb: 2 }} spacing={2}>
            <Typography variant="subtitle1" fontWeight="600">Individual Liability Table</Typography>
            <Stack direction="row" spacing={1}>
              <Button size="small" variant="contained" sx={projectionActionButtonSx} onClick={() => handleDownloadTablePdf(individualLiabilityTableRef, "Individual_Liability_Projections_Table")}>Download PDF</Button>
              <Button size="small" variant="contained" sx={projectionActionButtonSx} onClick={() => handleDownloadIndividualProjectionsCsv(individualLiabilityProjections, "Individual_Liability_Projections_Table")}>Download CSV</Button>
            </Stack>
          </Stack>
          <TableContainer sx={projectionTableContainerSx}>
            <Table size="small" ref={individualLiabilityTableRef}>
              <TableHead>
                <TableRow>
                  <TableCell>Liability Name</TableCell>
                  {displayYearsIndices.map((index) => (
                    <TableCell key={years[index]} align="right">{years[index]}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {individualLiabilityProjections.map((liability) => (
                  <TableRow key={liability.id}>
                    <TableCell>{liability.name}</TableCell>
                    {displayYearsIndices.map((index) => (
                      <TableCell key={years[index]} align="right">{formatCurrency(liability.projectedValues[index])}</TableCell>
                    ))}
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell><strong>Total Liabilities</strong></TableCell>
                  {displayYearsIndices.map(index => (
                    <TableCell key={`total-liability-${years[index]}`} align="right"><strong>{formatCurrency(totalLiabilityValues[index])}</strong></TableCell>
                  ))}
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
    </Box>
  );
}
