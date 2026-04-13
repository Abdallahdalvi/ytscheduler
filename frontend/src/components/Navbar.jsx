/**
 * Premium Navbar Component
 * Top navigation bar with title, filters, and user actions
 */

import { ChevronDown, Settings } from 'lucide-react'

export function Navbar({ 
  title, 
  subtitle,
  filters,
  actions,
  userInitial = 'U'
}) {
  return (
    <nav className="topbar">
      {/* Left section - Title */}
      <div className="topbar-left">
        <div>
          <h1 className="topbar-title">{title}</h1>
          {subtitle && <p className="topbar-subtitle">{subtitle}</p>}
        </div>
      </div>

      {/* Center section - Filters */}
      {filters && (
        <div className="topbar-filters">
          {filters}
        </div>
      )}

      {/* Right section - Actions & User */}
      <div className="topbar-actions">
        {actions && <div className="topbar-actions-group">{actions}</div>}
        
        {/* User Avatar */}
        <div className="topbar-avatar" title="Profile">
          {userInitial}
        </div>

        {/* Settings Icon */}
        <button className="btn btn-ghost" title="Settings">
          <Settings size={18} />
        </button>
      </div>
    </nav>
  )
}

/**
 * Filter Button Component
 */
export function FilterButton({ label, icon: Icon, active, onClick }) {
  return (
    <button 
      className={`btn btn-secondary ${active ? 'active' : ''}`}
      onClick={onClick}
    >
      {Icon && <Icon size={16} />}
      {label}
      <ChevronDown size={14} />
    </button>
  )
}
