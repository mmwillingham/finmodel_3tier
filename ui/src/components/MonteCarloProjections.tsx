import React, { useEffect, useState, useRef } from "react";
import { useAuth } from '../context/AuthContext';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { Line, Bar } from "react-chartjs-2";
import { Box, Button, FormControl, InputLabel, LinearProgress, MenuItem, Paper, Select, Slider, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from "@mui/material";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import { calculateTaxableIncome } from '../utils/taxCalculator';
import { calculateYearFraction } from '../utils/dateUtils';
import ProjectionService from '../services/projection.service';
import { projectionActionButtonSx, projectionSecondaryButtonSx, projectionSectionCardSx, projectionTableContainerSx } from "../utils/projectionUiStyles";
import { createDarkLineChartOptions, darkChartPanelSx, DARK_CHART_SERIES_COLORS } from "../utils/darkChartTheme";

type FinancialRecord = Record<string, any>;
type ProjectionAccountPayload = {
  name: string;
  account_type: string;
  initial_value: number;
  contribution: number;
  growth_rate: number;
  loan_type: string | null;
  principal_amount: number | null;
  interest_rate: number | null;
  loan_term_months: number | null;
  loan_start_date: string | null;
  monthly_payment: number | null;
  start_date: string | null;
  end_date: string | null;
  cash_flow_item_id?: string | number | null;
};

interface MonteCarloProjectionsProps {
  incomeItems: FinancialRecord[];
  expenseItems: FinancialRecord[];
  assets: FinancialRecord[];
  liabilities: FinancialRecord[];
  projectionYears: number;
  formatCurrency: (value: number) => string;
  showProjectionYearSelector?: boolean;
  onProjectionYearsChange?: (years: number) => void;
  maxProjectionYears?: number;
  isLimitedPlan?: boolean;
}

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler);

// Constant to identify the federal tax expense item (must match backend)
const FEDERAL_TAX_EXPENSE_DESCRIPTION = "Federal Income Tax (Calculated)";

export default function MonteCarloProjections({ incomeItems, expenseItems, assets, liabilities, projectionYears, formatCurrency, showProjectionYearSelector = false, onProjectionYearsChange, maxProjectionYears, isLimitedPlan = false }: MonteCarloProjectionsProps) {
  const { userSettings } = useAuth();
  const typedUserSettings: any = userSettings;
  const currentYear = new Date().getFullYear();
  const chartRef = useRef<any>(null);
  const tableRef = useRef<any>(null);
  const deterministicBaselineCacheRef = useRef<{ key: string; baseline: number[] | null } | null>(null);
  const [numSimulations, setNumSimulations] = useState(1000);
  const [volatility, setVolatility] = useState(15); // Standard deviation for growth rates as percentage
  const [results, setResults] = useState<any[] | null>(null);
  const [simulationSeries, setSimulationSeries] = useState<any[][] | null>(null);
  const [selectedView, setSelectedView] = useState("fan");
  const [successRate, setSuccessRate] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [sliderProjectionYears, setSliderProjectionYears] = useState(projectionYears ?? 30);

  useEffect(() => {
    setSliderProjectionYears(projectionYears ?? 30);
  }, [projectionYears]);

  const toNumber = (value: any) => {
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    if (typeof value === "string") {
      const parsed = Number(value.replace(/,/g, ""));
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  };

  const parseDateSafe = (value: any): Date | null => {
    if (!value || typeof value !== "string") return null;
    const parsed = new Date(`${value}T00:00:00Z`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const getAmortizedLoanBalance = (
    principal: number,
    annualInterestRatePercent: number,
    loanTermMonths: number,
    loanStartDate: Date,
    calculationDate: Date
  ): number => {
    const monthsPassed = (calculationDate.getUTCFullYear() - loanStartDate.getUTCFullYear()) * 12
      + (calculationDate.getUTCMonth() - loanStartDate.getUTCMonth());

    if (monthsPassed <= 0) return principal;
    if (monthsPassed >= loanTermMonths) return 0;

    if (annualInterestRatePercent === 0) {
      const monthlyPayment = principal / loanTermMonths;
      return Math.max(0, principal - (monthlyPayment * monthsPassed));
    }

    const monthlyInterestRate = (annualInterestRatePercent / 100) / 12;
    const monthlyPayment = (principal * monthlyInterestRate)
      / (1 - Math.pow(1 + monthlyInterestRate, -loanTermMonths));
    const remainingBalance = principal * Math.pow(1 + monthlyInterestRate, monthsPassed)
      - (monthlyPayment / monthlyInterestRate) * (Math.pow(1 + monthlyInterestRate, monthsPassed) - 1);
    return Math.max(0, remainingBalance);
  };

  const horizonYears = Math.max(1, Number(projectionYears) || 1);

  const generateSimulationSeries = (simulationCount: number, localVolatility: number) => {
    const simulationResults: any[][] = [];
    const assetKeys = assets.map((asset: any, index: number) =>
      asset?.id != null ? `asset-id-${asset.id}` : `asset-index-${index}-${asset?.name ?? "asset"}`
    );
    const getAssetKey = (asset: any) => {
      const index = assets.findIndex((candidate: any) => (
        (asset?.id != null && candidate?.id === asset.id) || candidate === asset
      ));
      return index >= 0 ? assetKeys[index] : null;
    };
    for (let sim = 0; sim < simulationCount; sim++) {
      const yearlyData: any[] = [];

      const baseAssetProjections: Record<string, number[]> = {};
      assets.forEach((asset: any, assetIndex: number) => {
        const assetKey = assetKeys[assetIndex];
        baseAssetProjections[assetKey] = [];
        for (let i = 0; i < horizonYears; i++) {
          const projectionYear = currentYear + i;
          const yearFraction = calculateYearFraction(asset.start_date, asset.end_date, projectionYear);
          if (yearFraction > 0) {
            const growthRate = toNumber(asset.annual_increase_percent) / 100;
            const assetValue = toNumber(asset.value) * Math.pow(1 + growthRate, i);
            baseAssetProjections[assetKey].push(assetValue);
          } else {
            baseAssetProjections[assetKey].push(0);
          }
        }
      });

      const getLinkedAssetValueForYear = (assetIds: any[], year: number) => {
        if (!Array.isArray(assetIds) || assetIds.length === 0) return 0;
        return assetIds.reduce((sum: number, assetId: any) => {
          const linkedAsset = assets.find((a: any) => a.id === assetId);
          const linkedAssetKey = linkedAsset ? getAssetKey(linkedAsset) : null;
          if (!linkedAssetKey || !baseAssetProjections[linkedAssetKey]) {
            return sum;
          }
          const baseValue = baseAssetProjections[linkedAssetKey][year] ?? 0;
          const variation = (Math.random() * localVolatility * 2 - localVolatility) / 100;
          return sum + (baseValue * (1 + variation));
        }, 0);
      };

      const assetContributionsByYear: Record<string, number[]> = {};
      assets.forEach((_: any, assetIndex: number) => {
        const assetKey = assetKeys[assetIndex];
        assetContributionsByYear[assetKey] = new Array(horizonYears).fill(0);
      });

      const reinvestedDividendsByAsset: Record<string, Record<number, number>> = {};

      for (let year = 0; year < horizonYears; year++) {
        let totalIncome = 0;
        let totalTaxableIncome = 0;

        incomeItems.forEach((item: any) => {
          const currentProjectionYear = currentYear + year;
          const yearFraction = calculateYearFraction(item.start_date, item.end_date, currentProjectionYear);
          if (yearFraction === 0) {
            return;
          }

          let itemValue = toNumber(item.yearly_value);

          if (item.linked_item_type === "asset" && item.percentage !== null) {
            const linkedAssetIds = Array.isArray(item.linked_asset_ids) && item.linked_asset_ids.length > 0
              ? item.linked_asset_ids
              : (item.linked_item_id ? [item.linked_item_id] : []);
            if (linkedAssetIds.length > 0) {
              const linkedAssetsValue = getLinkedAssetValueForYear(linkedAssetIds, year);
              itemValue = linkedAssetsValue * (toNumber(item.percentage) / 100.0);
            }
          } else {
            const variation = (Math.random() * localVolatility * 2 - localVolatility) / 100;
            const increaseRate = toNumber(item.annual_increase_percent) / 100;
            itemValue = toNumber(item.yearly_value) * Math.pow(1 + increaseRate, year) * (1 + variation);
          }

          itemValue = itemValue * yearFraction;

          if (item.taxable) {
            totalTaxableIncome += itemValue;
          }

          const isDividend = (item.category?.toLowerCase().includes('dividend') || item.description?.toLowerCase().includes('dividend'));
          const shouldReinvest = isDividend && item.reinvest_dividends;

          if (shouldReinvest) {
            let targetAssetId = item.reinvestment_account_id;
            if (!targetAssetId && item.linked_item_id && item.linked_item_type === "asset") {
              targetAssetId = item.linked_item_id;
            }

            if (targetAssetId) {
              const targetAsset = assets.find((a: any) => a.id === targetAssetId);
              const targetAssetKey = targetAsset ? getAssetKey(targetAsset) : null;
              if (targetAsset && targetAssetKey && baseAssetProjections[targetAssetKey]) {
                const assetKey = targetAssetKey;
                if (!reinvestedDividendsByAsset[assetKey]) {
                  reinvestedDividendsByAsset[assetKey] = {};
                }
                if (!reinvestedDividendsByAsset[assetKey][year]) {
                  reinvestedDividendsByAsset[assetKey][year] = 0;
                }
                reinvestedDividendsByAsset[assetKey][year] += itemValue;

                for (let futureYear = year; futureYear < horizonYears; futureYear++) {
                  const growthRate = toNumber(targetAsset.annual_increase_percent);
                  if (baseAssetProjections[assetKey][futureYear] !== undefined) {
                    baseAssetProjections[assetKey][futureYear] += itemValue * Math.pow(1 + growthRate / 100, futureYear - year);
                  }
                }
              }
            }
          } else {
            totalIncome += itemValue;
          }
        });

        let totalExpenses = 0;
        let totalTaxDeductibleExpenses = 0;
        const federalTaxExpenseItem = expenseItems.find((item: any) => item.description === FEDERAL_TAX_EXPENSE_DESCRIPTION);
        const regularExpenseItems = expenseItems.filter((item: any) => item.description !== FEDERAL_TAX_EXPENSE_DESCRIPTION);

        regularExpenseItems.forEach((item: any) => {
          const currentProjectionYear = currentYear + year;
          const yearFraction = calculateYearFraction(item.start_date, item.end_date, currentProjectionYear);
          if (yearFraction === 0) {
            return;
          }

          let itemValue = toNumber(item.yearly_value);

          if (item.linked_item_type === "asset" && item.percentage !== null) {
            const linkedAssetIds = Array.isArray(item.linked_asset_ids) && item.linked_asset_ids.length > 0
              ? item.linked_asset_ids
              : (item.linked_item_id ? [item.linked_item_id] : []);
            if (linkedAssetIds.length > 0) {
              const linkedAssetsValue = getLinkedAssetValueForYear(linkedAssetIds, year);
              itemValue = linkedAssetsValue * (toNumber(item.percentage) / 100.0);
            }
          } else if (item.linked_item_id && item.linked_item_type === "income" && item.percentage !== null) {
            const linkedIncomeItem = incomeItems.find((i: any) => i.id === item.linked_item_id);
            if (linkedIncomeItem) {
              let linkedIncomeValue = toNumber(linkedIncomeItem.yearly_value);

              if (linkedIncomeItem.linked_item_id && linkedIncomeItem.linked_item_type === "asset" && linkedIncomeItem.percentage !== null) {
                const linkedAsset = assets.find((a: any) => a.id === linkedIncomeItem.linked_item_id);
                const linkedAssetKey = linkedAsset ? getAssetKey(linkedAsset) : null;
                if (linkedAssetKey && baseAssetProjections[linkedAssetKey]) {
                  const baseValue = baseAssetProjections[linkedAssetKey][year];
                  const variation = (Math.random() * localVolatility * 2 - localVolatility) / 100;
                  const variedValue = baseValue * (1 + variation);
                  linkedIncomeValue = variedValue * (toNumber(linkedIncomeItem.percentage) / 100.0);
                }
              } else {
                const variation = (Math.random() * localVolatility * 2 - localVolatility) / 100;
                const increaseRate = toNumber(linkedIncomeItem.annual_increase_percent) / 100;
                linkedIncomeValue = toNumber(linkedIncomeItem.yearly_value) * Math.pow(1 + increaseRate, year) * (1 + variation);
              }

              const linkedIncomeYearFraction = calculateYearFraction(linkedIncomeItem.start_date, linkedIncomeItem.end_date, currentProjectionYear);
              linkedIncomeValue = linkedIncomeValue * linkedIncomeYearFraction;
              itemValue = linkedIncomeValue * (toNumber(item.percentage) / 100.0);
            } else {
              const variation = (Math.random() * localVolatility * 2 - localVolatility) / 100;
              const inflationRate = toNumber(item.inflation_percent || 2.0) / 100;
              itemValue = toNumber(item.yearly_value) * Math.pow(1 + inflationRate, year) * (1 + variation);
            }
          } else {
            const variation = (Math.random() * localVolatility * 2 - localVolatility) / 100;
            const inflationRate = toNumber(item.inflation_percent || 2.0) / 100;
            itemValue = toNumber(item.yearly_value) * Math.pow(1 + inflationRate, year) * (1 + variation);
          }

          itemValue = itemValue * yearFraction;

          if (item.tax_deductible) {
            totalTaxDeductibleExpenses += itemValue;
          }

          totalExpenses += itemValue;

          if (item.contributes_to_asset_id) {
            const targetAsset = assets.find((a: any) => a.id === item.contributes_to_asset_id);
            const targetAssetKey = targetAsset ? getAssetKey(targetAsset) : null;
            if (targetAssetKey && assetContributionsByYear[targetAssetKey]) {
              assetContributionsByYear[targetAssetKey][year] += itemValue;
            }
          }
        });

        let federalTax = 0;
        if (federalTaxExpenseItem && userSettings) {
          const currentProjectionYear = currentYear + year;
          const taxYearFraction = calculateYearFraction(federalTaxExpenseItem.start_date, federalTaxExpenseItem.end_date, currentProjectionYear);

          if (taxYearFraction > 0) {
            try {
              const taxResult = calculateTaxableIncome(
                totalTaxableIncome,
                totalTaxDeductibleExpenses,
                typedUserSettings?.tax_filing_status || "Single",
                typedUserSettings?.person1_birthdate,
                typedUserSettings?.person2_birthdate,
                currentProjectionYear
              );
              federalTax = taxResult.taxOwed || 0;
              totalExpenses += federalTax;
            } catch (error: any) {
            }
          }
        }

        const netCashFlow = totalIncome - totalExpenses;

        assets.forEach((asset: any) => {
          const assetKey = getAssetKey(asset);
          if (!assetKey) return;
          const contribution = assetContributionsByYear[assetKey][year] || 0;
          if (contribution > 0 && baseAssetProjections[assetKey][year] !== undefined) {
            baseAssetProjections[assetKey][year] += contribution;

            const growthRate = toNumber(asset.annual_increase_percent) / 100;
            for (let futureYear = year + 1; futureYear < horizonYears; futureYear++) {
              if (baseAssetProjections[assetKey][futureYear] !== undefined) {
                const yearsOfGrowth = futureYear - year;
                baseAssetProjections[assetKey][futureYear] += contribution * Math.pow(1 + growthRate, yearsOfGrowth);
              }
            }
          }
        });

        if (netCashFlow !== 0 && assets.length > 0) {
          // Match backend behavior: only apply surplus/deficit transfer when user explicitly
          // configured a surplus asset. Without it, net cash flow does not modify asset balances.
          const targetAsset = userSettings?.surplus_asset_id
            ? assets.find((a: any) => a.id === userSettings.surplus_asset_id)
            : null;
          const targetAssetKey = targetAsset ? getAssetKey(targetAsset) : null;
          if (targetAsset && targetAssetKey && baseAssetProjections[targetAssetKey]) {
            // End-of-year transfer: included in this year's EOY balance, then grown in future years.
            baseAssetProjections[targetAssetKey][year] += netCashFlow;
            const growthRate = toNumber(targetAsset.annual_increase_percent) / 100;
            for (let futureYear = year + 1; futureYear < horizonYears; futureYear++) {
              if (baseAssetProjections[targetAssetKey][futureYear] !== undefined) {
                const yearsOfGrowth = futureYear - year;
                baseAssetProjections[targetAssetKey][futureYear] += netCashFlow * Math.pow(1 + growthRate, yearsOfGrowth);
              }
            }
          }
        }

        let totalAssets = 0;
        assets.forEach((asset: any) => {
          const assetKey = getAssetKey(asset);
          if (!assetKey) return;
          const baseValue = baseAssetProjections[assetKey][year];
          const variation = (Math.random() * localVolatility * 2 - localVolatility) / 100;
          totalAssets += baseValue * (1 + variation);
        });

        let totalLiabilities = 0;
        liabilities.forEach((liability: any) => {
          const projectionYear = currentYear + year;
          const yearFraction = calculateYearFraction(liability.start_date, liability.end_date, projectionYear);
          if (yearFraction > 0) {
            let liabilityValue = 0;

            const isAmortized = liability.loan_type === "amortized"
              && toNumber(liability.loan_term_months) > 0
              && parseDateSafe(liability.loan_start_date);

            if (isAmortized) {
              const principal = Math.abs(toNumber(liability.principal_amount) || toNumber(liability.value));
              const interestRate = toNumber(liability.interest_rate);
              const termMonths = Math.floor(toNumber(liability.loan_term_months));
              const loanStartDate = parseDateSafe(liability.loan_start_date) as Date;
              const yearEndDate = new Date(Date.UTC(projectionYear, 11, 31, 23, 59, 59, 999));
              liabilityValue = getAmortizedLoanBalance(principal, interestRate, termMonths, loanStartDate, yearEndDate);
            } else {
              const growthRate = toNumber(liability.annual_increase_percent) / 100;
              liabilityValue = toNumber(liability.value) * Math.pow(1 + growthRate, year);
            }

            totalLiabilities += liabilityValue;
          }
        });

        const netWorth = totalAssets - totalLiabilities;

        yearlyData.push({
          year: currentYear + year,
          income: totalIncome,
          expenses: totalExpenses,
          netCashFlow,
          netWorth
        });
      }

      simulationResults.push(yearlyData);
    }

    return simulationResults;
  };

  const buildProjectionRequest = () => {
    const assetAccounts: ProjectionAccountPayload[] = assets.map((asset: FinancialRecord) => ({
      name: asset.name,
      account_type: 'asset',
      initial_value: toNumber(asset.value),
      contribution: 0.0,
      growth_rate: toNumber(asset.annual_increase_percent),
      loan_type: null,
      principal_amount: null,
      interest_rate: null,
      loan_term_months: null,
      loan_start_date: null,
      monthly_payment: null,
      start_date: asset.start_date || null,
      end_date: asset.end_date || null
    }));

    const liabilityAccounts: ProjectionAccountPayload[] = liabilities.map((liability: FinancialRecord) => ({
      name: liability.name,
      account_type: 'liability',
      initial_value: -(Math.abs(toNumber(liability.value))),
      contribution: 0.0,
      growth_rate: toNumber(liability.annual_increase_percent),
      loan_type: liability.loan_type || null,
      principal_amount: liability.principal_amount != null ? toNumber(liability.principal_amount) : null,
      interest_rate: liability.interest_rate != null ? toNumber(liability.interest_rate) : null,
      loan_term_months: liability.loan_term_months != null ? Math.floor(toNumber(liability.loan_term_months)) : null,
      loan_start_date: liability.loan_start_date || null,
      monthly_payment: liability.monthly_payment != null ? toNumber(liability.monthly_payment) : null,
      start_date: liability.start_date || null,
      end_date: liability.end_date || null
    }));

    const incomeAccounts: ProjectionAccountPayload[] = incomeItems.map((income: FinancialRecord) => {
      let accountName = income.description;
      let contribution = 0.0;
      if (income.linked_item_type === "asset" && income.percentage != null) {
        if (Array.isArray(income.linked_asset_ids) && income.linked_asset_ids.length > 0) {
          const linkedAssets = assets.filter((a: any) => income.linked_asset_ids.includes(a.id));
          if (linkedAssets.length > 0) {
            accountName = `${income.description}|LINKED:${linkedAssets.map((a: any) => a.name).join(',')}|PERCENTAGE:${income.percentage}`;
          }
        } else if (income.linked_item_id) {
          const linkedAsset = assets.find((a: any) => a.id === income.linked_item_id);
          if (linkedAsset) {
            accountName = `${income.description}|LINKED:${linkedAsset.name}|PERCENTAGE:${income.percentage}`;
          }
        }
      } else {
        contribution = toNumber(income.yearly_value) / 12;
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
        contribution,
        growth_rate: toNumber(income.annual_increase_percent),
        loan_type: null,
        principal_amount: null,
        interest_rate: null,
        loan_term_months: null,
        loan_start_date: null,
        monthly_payment: null,
        start_date: incomeStartDate,
        end_date: incomeEndDate,
        cash_flow_item_id: income.id
      };
    });

    const expenseAccounts: ProjectionAccountPayload[] = expenseItems.map((expense: FinancialRecord) => {
      let accountName = expense.description;
      let contribution = 0.0;
      if (expense.linked_item_id && expense.linked_item_type === "asset" && expense.percentage != null) {
        const linkedAsset = assets.find((a: any) => a.id === expense.linked_item_id);
        if (linkedAsset) {
          accountName = `${expense.description}|LINKED:${linkedAsset.name}|PERCENTAGE:${expense.percentage}`;
        }
      } else if (expense.linked_item_id && expense.linked_item_type === "income" && expense.percentage != null) {
        const linkedIncome = incomeItems.find((i: any) => i.id === expense.linked_item_id);
        if (linkedIncome) {
          accountName = `${expense.description}|LINKED_INCOME:${linkedIncome.description}|PERCENTAGE:${expense.percentage}`;
        }
      } else {
        contribution = -(toNumber(expense.yearly_value) / 12);
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
        contribution,
        growth_rate: toNumber(expense.inflation_percent),
        loan_type: null,
        principal_amount: null,
        interest_rate: null,
        loan_term_months: null,
        loan_start_date: null,
        monthly_payment: null,
        start_date: expenseStartDate,
        end_date: expenseEndDate,
        cash_flow_item_id: expense.id
      };
    });

    return {
      plan_name: "Balance Sheet Projection",
      years: horizonYears,
      accounts: [...assetAccounts, ...liabilityAccounts, ...incomeAccounts, ...expenseAccounts]
    };
  };

  const buildDeterministicBaselineCacheKey = (projectionRequest: any) => JSON.stringify({
    projectionRequest,
    surplusAssetId: userSettings?.surplus_asset_id ?? null,
    taxFilingStatus: typedUserSettings?.tax_filing_status ?? null,
    person1Birthdate: typedUserSettings?.person1_birthdate ?? null,
    person2Birthdate: typedUserSettings?.person2_birthdate ?? null,
  });

  const fetchDeterministicNetWorthBaseline = async (projectionRequest: any): Promise<number[] | null> => {
    try {
      const cacheKey = buildDeterministicBaselineCacheKey(projectionRequest);
      if (deterministicBaselineCacheRef.current?.key === cacheKey) {
        return deterministicBaselineCacheRef.current.baseline;
      }

      let projection: any = null;
      try {
        const existingProjections = await ProjectionService.getProjections();
        const existing = existingProjections.find((p: FinancialRecord) => p.name === "Balance Sheet Projection");
        if (existing) {
          projection = await ProjectionService.updateProjection(existing.id, projectionRequest);
        }
      } catch (error: any) {
      }

      if (!projection) {
        projection = await ProjectionService.createProjection(projectionRequest);
      }

      let parsedData: any[] = [];
      if (projection?.data_json) {
        parsedData = JSON.parse(projection.data_json);
      } else if (projection?.id) {
        const fullProjection = await ProjectionService.getProjectionDetails(projection.id);
        if (fullProjection?.data_json) {
          parsedData = JSON.parse(fullProjection.data_json);
        }
      }

      if (!Array.isArray(parsedData) || parsedData.length === 0) {
        deterministicBaselineCacheRef.current = { key: cacheKey, baseline: null };
        return null;
      }

      const baseline = parsedData.map((row: any) => toNumber(row["Net Worth"]));
      deterministicBaselineCacheRef.current = { key: cacheKey, baseline };
      return baseline;
    } catch (error: any) {
      return null;
    }
  };

  const runMonteCarloSimulation = async () => {
    setLoading(true);
    setResults(null);
    setSimulationSeries(null);
    setSuccessRate(null);
    setSelectedView("fan");

    try {
      const projectionRequest = buildProjectionRequest();
      const deterministicBaseline = await fetchDeterministicNetWorthBaseline(projectionRequest);
      const randomSeries = generateSimulationSeries(numSimulations, volatility);
      const adjustedSeries = randomSeries.map((sim: any) => sim.map((point: any) => ({ ...point })));

      if (deterministicBaseline && deterministicBaseline.length > 0 && adjustedSeries.length > 0) {
        const yearsToAlign = Math.min(horizonYears, deterministicBaseline.length);
        for (let year = 0; year < yearsToAlign; year++) {
          const simulatedMean = adjustedSeries.reduce((sum: number, sim: any) => sum + (sim[year]?.netWorth ?? 0), 0) / adjustedSeries.length;
          const offset = deterministicBaseline[year] - simulatedMean;
          adjustedSeries.forEach((sim: any) => {
            if (sim[year]) {
              sim[year].netWorth += offset;
            }
          });
        }
      }

      const statistics: any[] = [];
      const getPercentile = (sortedArray: number[], percentile: number): number => {
        const index = Math.floor(sortedArray.length * percentile / 100);
        return sortedArray[index] || 0;
      };

      for (let year = 0; year < horizonYears; year++) {
        const yearData: any = {
          year: currentYear + year,
          netCashFlow: {
            values: adjustedSeries.map((sim: any) => sim[year].netCashFlow).sort((a: any, b: any) => a - b),
          },
          netWorth: {
            values: adjustedSeries.map((sim: any) => sim[year].netWorth).sort((a: any, b: any) => a - b),
          }
        };

        yearData.netCashFlow.p10 = getPercentile(yearData.netCashFlow.values, 10);
        yearData.netCashFlow.p25 = getPercentile(yearData.netCashFlow.values, 25);
        yearData.netCashFlow.p50 = getPercentile(yearData.netCashFlow.values, 50);
        yearData.netCashFlow.p75 = getPercentile(yearData.netCashFlow.values, 75);
        yearData.netCashFlow.p90 = getPercentile(yearData.netCashFlow.values, 90);
        yearData.netCashFlow.mean = yearData.netCashFlow.values.reduce((a: any, b: any) => a + b, 0) / yearData.netCashFlow.values.length;

        yearData.netWorth.p10 = getPercentile(yearData.netWorth.values, 10);
        yearData.netWorth.p25 = getPercentile(yearData.netWorth.values, 25);
        yearData.netWorth.p50 = getPercentile(yearData.netWorth.values, 50);
        yearData.netWorth.p75 = getPercentile(yearData.netWorth.values, 75);
        yearData.netWorth.p90 = getPercentile(yearData.netWorth.values, 90);
        yearData.netWorth.mean = yearData.netWorth.values.reduce((a: any, b: any) => a + b, 0) / yearData.netWorth.values.length;

        statistics.push(yearData);
      }

      setResults(statistics);
      setSimulationSeries(adjustedSeries);

      const terminalValues = adjustedSeries
        .map((sim: any) => sim[horizonYears - 1]?.netWorth ?? 0)
        .filter((value: any) => typeof value === "number");
      if (terminalValues.length > 0) {
        const successCount = terminalValues.filter((value: any) => value > 0).length;
        setSuccessRate((successCount / terminalValues.length) * 100);
      } else {
        setSuccessRate(null);
      }

      setLoading(false);
      window.dispatchEvent(new CustomEvent('rmdRefreshRequested', { detail: { source: 'monteCarloSimulation' } }));
    } catch (error: any) {
      setLoading(false);
    }
  };

  const exportToPDF = async () => {
    if (!chartRef.current || !results) return;

    try {
      const canvas = await html2canvas(chartRef.current, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      
      const pdf = new jsPDF('landscape', 'pt', [canvas.width, canvas.height]);
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save(`monte-carlo-projection-${currentYear}.pdf`);
    } catch (error: any) {
    }
  };

  const netWorthChartData = results ? {
    labels: results.map((d: any) => d.year),
    datasets: [
      {
        label: '10th Percentile',
        data: results.map((d: any) => d.netWorth.p10),
        borderColor: 'rgba(251, 113, 133, 0.75)',
        backgroundColor: 'rgba(251, 113, 133, 0.1)',
        borderDash: [5, 5],
        fill: false,
        pointRadius: 0,
      },
      {
        label: '25th Percentile',
        data: results.map((d: any) => d.netWorth.p25),
        borderColor: 'rgba(251, 191, 36, 0.75)',
        backgroundColor: 'rgba(251, 191, 36, 0.1)',
        borderDash: [3, 3],
        fill: false,
        pointRadius: 0,
      },
      {
        label: 'Median (50th)',
        data: results.map((d: any) => d.netWorth.p50),
        borderColor: DARK_CHART_SERIES_COLORS.expected,
        backgroundColor: 'rgba(56, 189, 248, 0.18)',
        fill: true,
        borderWidth: 2.5,
        pointRadius: 0,
        tension: 0.35,
      },
      {
        label: 'Mean',
        data: results.map((d: any) => d.netWorth.mean),
        borderColor: DARK_CHART_SERIES_COLORS.optimistic,
        backgroundColor: 'rgba(52, 211, 153, 0.1)',
        borderDash: [2, 2],
        fill: false,
        pointRadius: 0,
      },
      {
        label: '75th Percentile',
        data: results.map((d: any) => d.netWorth.p75),
        borderColor: 'rgba(251, 191, 36, 0.75)',
        backgroundColor: 'rgba(251, 191, 36, 0.1)',
        borderDash: [3, 3],
        fill: false,
        pointRadius: 0,
      },
      {
        label: '90th Percentile',
        data: results.map((d: any) => d.netWorth.p90),
        borderColor: 'rgba(251, 113, 133, 0.75)',
        backgroundColor: 'rgba(251, 113, 133, 0.1)',
        borderDash: [5, 5],
        fill: false,
        pointRadius: 0,
      },
    ],
  } : null;

  const netCashFlowChartData = results ? {
    labels: results.map((d: any) => d.year),
    datasets: [
      {
        label: '10th Percentile',
        data: results.map((d: any) => d.netCashFlow.p10),
        borderColor: 'rgba(255, 99, 132, 0.5)',
        backgroundColor: 'rgba(255, 99, 132, 0.1)',
        borderDash: [5, 5],
        fill: false,
      },
      {
        label: '25th Percentile',
        data: results.map((d: any) => d.netCashFlow.p25),
        borderColor: 'rgba(255, 159, 64, 0.5)',
        backgroundColor: 'rgba(255, 159, 64, 0.1)',
        borderDash: [3, 3],
        fill: false,
      },
      {
        label: 'Median (50th)',
        data: results.map((d: any) => d.netCashFlow.p50),
        borderColor: 'rgba(54, 162, 235, 1)',
        backgroundColor: 'rgba(54, 162, 235, 0.1)',
        fill: false,
      },
      {
        label: 'Mean',
        data: results.map((d: any) => d.netCashFlow.mean),
        borderColor: 'rgba(75, 192, 192, 1)',
        backgroundColor: 'rgba(75, 192, 192, 0.1)',
        borderDash: [2, 2],
        fill: false,
      },
      {
        label: '75th Percentile',
        data: results.map((d: any) => d.netCashFlow.p75),
        borderColor: 'rgba(255, 159, 64, 0.5)',
        backgroundColor: 'rgba(255, 159, 64, 0.1)',
        borderDash: [3, 3],
        fill: false,
      },
      {
        label: '90th Percentile',
        data: results.map((d: any) => d.netCashFlow.p90),
        borderColor: 'rgba(255, 99, 132, 0.5)',
        backgroundColor: 'rgba(255, 99, 132, 0.1)',
        borderDash: [5, 5],
        fill: false,
      },
    ],
  } : null;

  const finalYearIndex = Math.max(0, horizonYears - 1);
  const terminalNetWorthSeries = simulationSeries
    ? simulationSeries.map((sim: any) => sim[finalYearIndex]?.netWorth ?? 0)
    : [];

  const spaghettiSamples = simulationSeries ? simulationSeries.slice(0, 50) : [];
  const spaghettiChartData = spaghettiSamples.length && results ? {
    labels: results.map((d: any) => d.year),
    datasets: spaghettiSamples.map((sim: any, idx: any) => ({
      label: `Sim ${idx + 1}`,
      data: sim.map((point: any) => point.netWorth),
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
    terminalNetWorthSeries.forEach((value: any) => {
      let index = Math.floor((value - minValue) / binSize);
      if (index >= binCount) index = binCount - 1;
      if (index < 0) index = 0;
      bins[index]++;
    });
    const labels = bins.map((_: any, index: any) => {
      const start = minValue + index * binSize;
      const end = start + binSize;
      return `${formatCurrency(start)} - ${formatCurrency(end)}`;
    });
    return {
      labels,
      datasets: [
        {
          label: `Terminal Net Worth (${currentYear + finalYearIndex})`,
          data: bins,
          backgroundColor: 'rgba(75, 192, 192, 0.6)',
        },
      ],
    };
  })() : null;

  const histogramOptions: any = {
    responsive: true,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: (context: any) => `${context.parsed.y} simulations`,
        },
      },
      title: {
        display: true,
        text: `Terminal Net Worth Distribution (${currentYear + finalYearIndex})`,
      },
    },
    scales: {
      x: {
        ticks: {
          color: '#94a3b8',
          callback: (_value: number | string, index: number) => {
            const label = histogramData?.labels?.[index];
            return label ? label.split(' - ')[0] : '';
          },
        },
        grid: {
          color: 'rgba(148, 163, 184, 0.16)',
        },
      },
      y: {
        beginAtZero: true,
        ticks: {
          color: '#94a3b8',
        },
        grid: {
          color: 'rgba(148, 163, 184, 0.16)',
        },
      },
    },
  };

  const userLabelSuffix = userSettings?.person1_first_name && userSettings?.person1_last_name
    ? ` - ${userSettings.person1_first_name} ${userSettings.person1_last_name}`
    : '';

  const chartTitleFor = (label: string) => `Monte Carlo ${label}${userLabelSuffix}`;

  const chartOptions: any = createDarkLineChartOptions({
    title: chartTitleFor('Projections'),
    beginAtZero: false,
    xAxisTitle: 'End of Year',
  });

  const fanChartOptions: any = {
    ...chartOptions,
    plugins: {
      ...chartOptions.plugins,
      title: {
        ...chartOptions.plugins.title,
        text: chartTitleFor('Fan Chart - Net Worth'),
      },
    },
  };

  const spaghettiChartOptions: any = {
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
              onChange={(_: any, value: any) => setSliderProjectionYears(Number(value))}
              onChangeCommitted={(_: any, value: any) => onProjectionYearsChange?.(Number(value))}
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
            onChange={(e: any) => setNumSimulations(parseInt(e.target.value, 10) || 1000)}
            inputProps={{ min: 100, max: 10000, step: 100 }}
            helperText="Number of simulations to run"
          />
          <TextField
            id="volatility"
            label="Volatility (%)"
            type="number"
            size="small"
            value={volatility}
            onChange={(e: any) => setVolatility(parseFloat(e.target.value) || 15)}
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
                  onChange={(e: any) => setSelectedView(e.target.value)}
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
              <Box sx={{ ...darkChartPanelSx, height: 400 }}>
                <Line data={netWorthChartData as any} options={fanChartOptions as any} />
              </Box>
            </Paper>
          )}

          {selectedView === 'spaghetti' && (
            <Paper variant="outlined" sx={projectionSectionCardSx}>
              <Typography variant="h6" fontWeight="600" gutterBottom>
                Spaghetti Plot
              </Typography>
              <Box sx={{ ...darkChartPanelSx, height: 400 }}>
                {spaghettiChartData ? (
                  <Line data={spaghettiChartData as any} options={spaghettiChartOptions as any} />
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
              <Box sx={{ ...darkChartPanelSx, height: 400 }}>
                {histogramData ? (
                  <Bar data={histogramData as any} options={histogramOptions as any} />
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
                  {results.map((stat: any, index: any) => (
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
            <Box sx={{ ...darkChartPanelSx, height: 400 }}>
              <Line data={netCashFlowChartData as any} options={{
                ...chartOptions,
                plugins: {
                  ...chartOptions.plugins,
                  title: {
                    ...chartOptions.plugins.title,
                    text: `Monte Carlo Net Cash Flow Projections${userSettings?.person1_first_name && userSettings?.person1_last_name ? ` - ${userSettings.person1_first_name} ${userSettings.person1_last_name}` : ''}`,
                  },
                },
              } as any} />
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
                  {results.map((stat: any, index: any) => (
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

