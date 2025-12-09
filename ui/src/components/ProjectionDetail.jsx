import React, { useState, useEffect } from "react";
import ProjectionService from "../services/projection.service";
import "./ProjectionDetail.css";

export default function ProjectionDetail({ projectionId }) {
  const [projection, setProjection] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProjection = async () => {
      try {
        setLoading(true);
        const data = await ProjectionService.getProjectionDetails(projectionId);
        setProjection(data);
      } catch (error) {
        console.error("Error fetching projection:", error);
      } finally {
        setLoading(false);
      }
    };

    if (projectionId) {
      fetchProjection();
    }
  }, [projectionId]);

  if (loading) {
    return <div>Loading projection details...</div>;
  }

  if (!projection) {
    return <div>Projection not found.</div>;
  }

  const yearlyData = JSON.parse(projection.data_json || "[]");

  const formatCurrency = (value) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value ?? 0);

  return (
    <div className="projection-detail">
      <h2>{projection.name}</h2>

      <div className="projection-summary">
        <div className="summary-item">
          <strong>Years:</strong> {projection.years}
        </div>
        <div className="summary-item">
          <strong>Final Value:</strong> {formatCurrency(projection.final_value)}
        </div>
        <div className="summary-item">
          <strong>Total Contributed:</strong> {formatCurrency(projection.total_contributed)}
        </div>
        <div className="summary-item">
          <strong>Total Growth:</strong> {formatCurrency(projection.total_growth)}
        </div>
      </div>

      <h3>Year-by-Year Breakdown</h3>
      <div className="table-container">
        <table className="yearly-table">
          <thead>
            <tr>
              <th>Year</th>
              {Object.keys(yearlyData[0] || {})
                .filter((key) => key !== "Year")
                .map((key) => (
                  <th key={key}>{key.replace(/_/g, " ")}</th>
                ))}
            </tr>
          </thead>
          <tbody>
            {yearlyData.map((row, idx) => (
              <tr key={idx}>
                <td>{row.Year}</td>
                {Object.entries(row)
                  .filter(([key]) => key !== "Year")
                  .map(([key, value], i) => (
                    <td key={i}>{formatCurrency(value)}</td>
                  ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}