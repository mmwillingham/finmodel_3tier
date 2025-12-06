// utils/ChartConfig.js

import { Line } from 'react-chartjs-2';

// Standard colors and line styles (matching your original Python code intent)
const LINE_STYLES = ['#4CAF50', '#2196F3', '#FF9800', '#F44336', '#9C27B0', '#00BCD4', '#8BC34A', '#FFEB3B'];
const LINE_DASHES = [0, [5, 5], [1, 1], [5, 10], [3, 10, 1, 10], [3, 5, 1, 5, 1, 5]];

// Function to generate the Chart.js data object
export const generateChartData = (projectionData) => {
    if (!projectionData || !projectionData.yearly_data) return { labels: [], datasets: [] };

    const yearlyData = projectionData.yearly_data;
    const years = yearlyData.Year;
    const totalBalanceData = yearlyData['Total Projected Balance'];
    
    // Get all account keys (e.g., "Account 1 Balance", "Account 2 Balance")
    const accountKeys = Object.keys(yearlyData).filter(key => key.includes('Balance') && !key.includes('Total'));
    
    // The account names were part of the input, which should be included if you reload the full inputs, 
    // but for simplicity, we'll use the generated keys here.
    
    let datasets = [];

    // 1. Add individual account datasets
    accountKeys.forEach((key, index) => {
        const color = LINE_STYLES[index % LINE_STYLES.length];
        const dash = LINE_DASHES[index % LINE_DASHES.length];

        datasets.push({
            label: key.replace(' Balance', ''), // Clean up the label for the legend
            data: yearlyData[key],
            borderColor: color,
            borderWidth: 2,
            borderDash: dash,
            pointRadius: 1,
            fill: false,
            tension: 0.1
        });
    });

    // 2. Add the TOTAL portfolio line (highlighted)
    datasets.push({
        label: 'TOTAL PORTFOLIO',
        data: totalBalanceData,
        borderColor: '#ffffff', // White line for contrast
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 5,
        pointRadius: 4,
        tension: 0.3,
        fill: false,
    });

    return {
        labels: years.map(y => `Year ${y}`),
        datasets: datasets,
    };
};

// Function to define the Chart.js options
export const chartOptions = (finalValue) => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: {
            position: 'top',
        },
        title: {
            display: true,
            text: 'Individual Account Growth vs. Total Portfolio',
            font: { size: 16 }
        },
        // Tooltip formatting for currency
        tooltip: {
             callbacks: {
                 label: function(context) {
                     let label = context.dataset.label || '';
                     if (label) {
                         label += ': ';
                     }
                     if (context.parsed.y !== null) {
                         label += new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(context.parsed.y);
                     }
                     return label;
                 }
             }
        }
    },
    scales: {
        y: {
            title: {
                display: true,
                text: 'Projected Balance',
            },
            // Y-axis currency formatting
            ticks: {
                callback: function(value) {
                    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(value);
                }
            }
        }
    }
});
