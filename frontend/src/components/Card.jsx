/**
 * Reusable Card Component
 * Base container for content with consistent styling
 */

export function Card({ children, className = '', ...props }) {
  return (
    <div className={`card ${className}`} {...props}>
      {children}
    </div>
  )
}

/**
 * Card Header - Title & Actions
 */
export function CardHeader({ title, subtitle, action, className = '' }) {
  return (
    <div className={`card-header ${className}`}>
      <div>
        {title && <h3 className="card-title">{title}</h3>}
        {subtitle && <p className="card-subtitle">{subtitle}</p>}
      </div>
      {action && <div className="card-actions">{action}</div>}
    </div>
  )
}

/**
 * Card Body - Content wrapper
 */
export function CardBody({ children, className = '' }) {
  return <div className={`card-body ${className}`}>{children}</div>
}

/**
 * Card Footer
 */
export function CardFooter({ children, className = '' }) {
  return <div className={`card-footer ${className}`}>{children}</div>
}
