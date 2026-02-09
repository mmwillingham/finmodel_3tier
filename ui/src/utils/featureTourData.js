export const featureDetails = [
  {
    id: 'accounts',
    title: 'Accounts',
    shortDescription:
      'Create and organize accounts so balances and ownership flow through the model.',
    description:
      'Set up household accounts, connect external institutions, and define ownership and display balances. Accounts are the foundation for projections, reporting, and automation across the application.',
    targetIds: ['nav-accounts'],
    route: '/accounts'
  },
  {
    id: 'connected-accounts',
    title: 'Connected Accounts',
    shortDescription:
      'Connect external institutions to sync balances automatically.',
    description:
      'Securely connect bank and brokerage institutions to sync balances into your accounts and assets. Keep the model current without manual updates.',
    targetIds: ['accounts-connected'],
    route: '/accounts'
  },
  {
    id: 'categories',
    title: 'Assets / Liabilities / Income / Expenses',
    shortDescription:
      'Model what you own, owe, earn, and spend with timing and growth.',
    description:
      'Record assets and debts with balances, growth, and payment terms. Add income streams and expenses with timing, inflation, and categories so projections reflect real-world cash flow.',
    targetIds: ['nav-assets', 'nav-liabilities', 'nav-income', 'nav-expenses'],
    route: '/assets'
  },
  {
    id: 'net-worth',
    title: 'Net Worth (projection)',
    shortDescription:
      'Track how your net worth evolves based on contributions and market growth.',
    description:
      'See projected net worth over time based on assets, liabilities, contributions, and market assumptions. Use this view to spot inflection points and long-term trends.',
    targetIds: ['nav-net-worth'],
    route: '/app',
    dashboardView: 'balance-sheet-projection',
    cashFlowView: null
  },
  {
    id: 'cash-flow',
    title: 'Cash Flow (projection)',
    shortDescription:
      'Visualize inflows and outflows over time to spot shortfalls early.',
    description:
      'Visualize inflows and outflows by month or year with retirement transitions and income changes. This helps you spot shortfalls and understand where cash is going.',
    targetIds: ['nav-cash-flow'],
    route: '/app',
    dashboardView: 'cashflow-projection',
    cashFlowView: null
  },
  {
    id: 'custom-charts',
    title: 'Custom Charts and Tables',
    shortDescription:
      'Build custom views and reports tailored to the questions you care about.',
    description:
      'Build custom charts and tables from modeled data to answer specific questions. Save views and compare results across scenarios.',
    targetIds: ['nav-custom-charts'],
    route: '/app',
    dashboardView: 'custom-charts',
    customChartView: 'list'
  },
  {
    id: 'cash-handling',
    title: 'Cash Handling',
    shortDescription:
      'Define cash reserve targets and how surplus or shortfalls are handled.',
    description:
      'Configure cash reserve targets and how excess or shortfall cash is handled. Keep liquidity while optimizing where cash sits across accounts.',
    targetIds: ['nav-cash-handling'],
    route: '/app',
    dashboardView: 'cash-handling'
  },
  {
    id: 'surplus-asset',
    title: 'Automatic Transfers - Surplus Asset',
    shortDescription:
      'Route excess cash to a designated surplus asset automatically.',
    description:
      'Define surplus asset accounts that automatically receive excess cash. The system routes surplus funds based on your rules to keep idle cash invested.',
    targetIds: ['nav-automatic-transfers', 'auto-transfers-surplus-tab'],
    route: '/automatic-transfers'
  },
  {
    id: 'auto-disbursements',
    title: 'Automatic Transfers - Auto-Disbursements',
    shortDescription:
      'Automate transfers out of assets to cover expenses or withdrawals.',
    description:
      'Set up scheduled or conditional disbursements to cover expenses or planned withdrawals. Automate transfers out of assets to meet cash needs without manual steps.',
    targetIds: ['nav-automatic-transfers', 'auto-transfers-disbursements-tab'],
    route: '/automatic-transfers'
  },
  {
    id: 'tax-handling',
    title: 'Tax Handling',
    shortDescription:
      'Configure tax assumptions and taxability for accurate projections.',
    description:
      'Configure tax assumptions, filing status, and taxability of income and withdrawals. The model uses these settings to estimate tax impact in projections.',
    targetIds: ['nav-tax-handling'],
    route: '/settings/tax-handling'
  },
  {
    id: 'profile',
    title: 'Profile',
    shortDescription:
      'Personalize the plan with retirement timing and baseline assumptions.',
    description:
      'Manage personal details, retirement timeline, and baseline assumptions. Profile settings personalize calculations across the application.',
    targetIds: ['settings-profile'],
    route: '/settings/profile'
  },
  {
    id: 'authorized-users',
    title: 'Authorized Users',
    shortDescription:
      'Invite trusted collaborators and control what they can access.',
    description:
      'Invite and manage additional users who can view or edit the plan. Control access for advisors, spouses, or family members.',
    targetIds: ['settings-authorized-users'],
    route: '/settings/authorized-users'
  },
  {
    id: 'what-if',
    title: 'What If',
    shortDescription:
      'Run scenarios to compare outcomes before making decisions.',
    description:
      'Run scenario analysis by changing assumptions such as returns, retirement date, and expenses. Compare outcomes and evaluate trade-offs before making decisions.',
    targetIds: ['nav-what-if'],
    route: '/app',
    dashboardView: 'what-if',
    cashFlowView: null
  },
  {
    id: 'document-vault',
    title: 'Document Vault',
    shortDescription:
      'Store important files securely with folders and descriptions.',
    description:
      'Securely store and organize important documents with folders, descriptions, and downloads. Keep plan-related files in one place.',
    targetIds: ['nav-document-vault'],
    route: '/documents'
  }
];

export const tourSteps = [
  ...featureDetails.map((feature) => ({
    title: feature.title,
    description: feature.shortDescription,
    targetIds: feature.targetIds || [],
    route: feature.route,
    dashboardView: feature.dashboardView,
    cashFlowView: feature.cashFlowView,
    customChartView: feature.customChartView
  })),
  {
    title: 'Wrap Up',
    description:
      'You have seen the core areas of the application. Use the tour anytime to refresh what each section covers.',
    targetIds: []
  }
];
