import { calculateRmd } from './rmdCalculator';

const getAssetValueForYear = (asset: any, yearOffset: any) => {
  const growthRate = (asset.annual_increase_percent || 0) / 100;
  const baseValue = asset.value || 0;
  const offset = Math.max(0, yearOffset);
  return baseValue * Math.pow(1 + growthRate, offset);
};

const isDisbursementActiveInYear = (disbursement: any, projectionYear: any) => {
  if (!disbursement) return false;
  if (disbursement.start_date) {
    const startYear = new Date(disbursement.start_date).getFullYear();
    if (projectionYear < startYear) {
      return false;
    }
  }
  if (disbursement.end_date) {
    const endYear = new Date(disbursement.end_date).getFullYear();
    if (projectionYear > endYear) {
      return false;
    }
  }
  return true;
};

export const buildTaxableDistributionEntries = ({
  autoDisbursements = [],
  assets = [],
  userSettings = {},
  currentYear,
  targetYear = 0,
  includeInactive = false,
}: any) => {
  if (!Array.isArray(autoDisbursements) || autoDisbursements.length === 0 || !currentYear) {
    return [];
  }

  const projectionYear = currentYear + targetYear;

  return autoDisbursements.flatMap((disbursement: any) => {
    if (!disbursement || disbursement.distribution_type !== 'taxable_ira' || !disbursement.source_asset_id) {
      return [];
    }

    const startYear = disbursement.start_date ? new Date(disbursement.start_date).getFullYear() : null;
    const endYear = disbursement.end_date ? new Date(disbursement.end_date).getFullYear() : null;

    if (!includeInactive && !isDisbursementActiveInYear(disbursement, projectionYear)) {
      return [];
    }
    if (includeInactive && endYear && endYear < currentYear) {
      return [];
    }

    const sourceAsset = assets.find((a: any) => a.id === disbursement.source_asset_id);
    if (!sourceAsset) {
      return [];
    }

    const effectiveProjectionYear = includeInactive && startYear ? startYear : projectionYear;
    const yearOffset = Math.max(0, effectiveProjectionYear - currentYear);
    const sourceValue = getAssetValueForYear(sourceAsset, yearOffset);

    let transferAmount = 0;
    if (disbursement.use_rmd && userSettings?.person1_birthdate) {
      const overrideKey = effectiveProjectionYear;
      let overrideVal = disbursement.rmd_overrides ? (disbursement.rmd_overrides[overrideKey] ?? disbursement.rmd_overrides[String(overrideKey)]) : null;
      if (overrideVal != null && overrideVal !== '') {
        transferAmount = Number(overrideVal) || 0;
      } else {
        const spouseBirthdate = userSettings.person2_birthdate || null;
        const rmdResult = calculateRmd(userSettings.person1_birthdate, Math.abs(sourceValue), effectiveProjectionYear, spouseBirthdate);
        transferAmount = rmdResult?.rmd_amount || 0;
      }
    } else if (disbursement.transfer_type === 'percentage') {
      transferAmount = Math.abs(sourceValue) * ((Number(disbursement.transfer_value) || 0) / 100.0);
    } else {
      const numericValue = Number(disbursement.transfer_value);
      transferAmount = Number.isFinite(numericValue) ? Math.abs(numericValue) : 0;
    }

    if (!transferAmount || transferAmount <= 0) {
      return [];
    }

    return [{
      syntheticId: `taxable-distribution-${disbursement.id}-${projectionYear}`,
      description: "Taxable distribution",
      category: disbursement.name || 'Taxable distribution',
      yearly_value: transferAmount,
      start_date: disbursement.start_date || null,
      end_date: disbursement.end_date || null,
      taxable: true,
      annual_increase_percent: 0,
      frequency: 'yearly',
      linked_item_type: null as any,
      percentage: null as any,
      syntheticTaxableDistribution: true,
    }];
  });
};
