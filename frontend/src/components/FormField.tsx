import type { ReactNode, InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes } from 'react'

type FormFieldProps = {
  label: string
  hint?: string
  required?: boolean
  className?: string
  children: ReactNode
}

type FormSectionProps = {
  eyebrow?: string
  title?: string
  children: ReactNode
}

export function FormField({ label, hint, required = false, className = '', children }: FormFieldProps) {
  return (
    <label className={`form-field ${className}`.trim()}>
      <div className="form-label form-label-space">
        {label}
        {required ? ' *' : ''}
      </div>
      {children}
      {hint ? <div className="form-hint form-hint-space">{hint}</div> : null}
    </label>
  )
}

export function FormInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className="input" {...props} />
}

export function FormTextarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className="textarea" {...props} />
}

type FormSelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  children: ReactNode
}

export function FormSelect({ children, ...props }: FormSelectProps) {
  return <select className="input" {...props}>{children}</select>
}

export function FormSection({ eyebrow, title, children }: FormSectionProps) {
  return (
    <section className="form-section">
      {eyebrow || title ? (
        <div className="form-section-header">
          {eyebrow ? (
            <div className={`form-section-eyebrow ${title ? 'mb-1' : ''}`.trim()}>
              {eyebrow}
            </div>
          ) : null}
          {title ? <div className="card-title">{title}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  )
}