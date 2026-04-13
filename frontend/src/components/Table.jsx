/**
 * Modern Table Component
 * Consistent table styling across the app
 */

export function Table({ children, className = '' }) {
  return (
    <div className="table-container">
      <table className={`table ${className}`}>
        {children}
      </table>
    </div>
  )
}

export function TableHead({ children, className = '' }) {
  return <thead className={className}>{children}</thead>
}

export function TableBody({ children, className = '' }) {
  return <tbody className={className}>{children}</tbody>
}

export function TableRow({ children, onClick, className = '' }) {
  return (
    <tr 
      className={className} 
      onClick={onClick}
      style={onClick ? { cursor: 'pointer' } : {}}
    >
      {children}
    </tr>
  )
}

export function TableHeader({ children, className = '' }) {
  return <th className={className}>{children}</th>
}

export function TableCell({ children, className = '' }) {
  return <td className={className}>{children}</td>
}
