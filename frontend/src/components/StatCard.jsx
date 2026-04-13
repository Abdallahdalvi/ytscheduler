/**
 * Stat Card Component
 * Display KPI metrics with icon, value, and label
 */

import { Info } from 'lucide-react'

export function StatCard({ 
  icon, 
  value, 
  label, 
  infoText,
  sparkData,
  trend, 
  colorClass = 'purple',
  onClick,
  className = ''
}) {
  const hasSpark = Array.isArray(sparkData) && sparkData.length > 1
  const data = hasSpark ? sparkData.map((n) => Number(n) || 0) : []
  const min = hasSpark ? Math.min(...data) : 0
  const max = hasSpark ? Math.max(...data) : 0
  const range = Math.max(1, max - min)
  const points = hasSpark
    ? data.map((v, i) => `${(i / (data.length - 1)) * 100},${30 - ((v - min) / range) * 24}`).join(' ')
    : ''

  return (
    <div 
      className={`stat-card ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {icon && (
        <div className={`stat-icon ${colorClass}`}>
          {typeof icon === 'string' ? icon : icon}
        </div>
      )}
      <div className="stat-content">
        {value !== undefined && (
          <div className="stat-value">{value}</div>
        )}
        {label && (
          <div className="stat-label-row">
            <div className="stat-label">{label}</div>
            {infoText ? (
              <span
                className="stat-info-trigger"
                role="img"
                aria-label={`How ${label} is calculated: ${infoText}`}
                title={infoText}
              >
                <Info size={12} />
              </span>
            ) : null}
          </div>
        )}
        {trend && <div className="stat-trend">{trend}</div>}
        {hasSpark ? (
          <div className="stat-graph-wrap" aria-hidden="true">
            <svg viewBox="0 0 100 32" preserveAspectRatio="none" className={`stat-graph ${colorClass}`}>
              <polyline points={points} className="stat-graph-line" />
            </svg>
          </div>
        ) : null}
      </div>
    </div>
  )
}

/**
 * Stat Cards Grid
 */
export function StatCardsGrid({ children, className = '' }) {
  return (
    <div className={`stats-grid ${className}`}>
      {children}
    </div>
  )
}
