import React from 'react';
import ReactLoadingSkeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

export default function SkeletonLoader({ count = 1, height, width, circle = false, className = '', style = {} }) {
  return (
    <ReactLoadingSkeleton
      count={count}
      height={height}
      width={width}
      circle={circle}
      baseColor="#e9ecef"
      highlightColor="#f8f9fa"
      className={className}
      style={{
        borderRadius: circle ? '50%' : '8px',
        ...style
      }}
    />
  );
}

// Preset skeleton components for common use cases
export function SkeletonCard() {
  return (
    <div style={{ padding: '20px', background: '#fff', borderRadius: '12px', marginBottom: '16px' }}>
      <SkeletonLoader height={24} width="60%" style={{ marginBottom: '12px' }} />
      <SkeletonLoader height={16} width="80%" style={{ marginBottom: '8px' }} />
      <SkeletonLoader height={16} width="90%" />
    </div>
  );
}

export function SkeletonTableRow() {
  return (
    <tr>
      <td><SkeletonLoader height={20} width="80%" /></td>
      <td><SkeletonLoader height={20} width="60%" /></td>
      <td><SkeletonLoader height={20} width="70%" /></td>
      <td><SkeletonLoader height={20} width="50%" /></td>
    </tr>
  );
}

export function SkeletonList({ count = 5 }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ 
          padding: '16px', 
          background: '#fff', 
          borderRadius: '12px', 
          marginBottom: '12px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.06)'
        }}>
          <SkeletonLoader height={20} width="40%" style={{ marginBottom: '12px' }} />
          <SkeletonLoader height={16} width="100%" style={{ marginBottom: '8px' }} />
          <SkeletonLoader height={16} width="80%" />
        </div>
      ))}
    </>
  );
}
