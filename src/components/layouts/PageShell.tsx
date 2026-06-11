import { ReactNode } from 'react'

interface PageShellProps {
  title: string
  description?: string
  icon?: ReactNode
  actions?: ReactNode
  children: ReactNode
  contentClassName?: string
}

export default function PageShell({
  actions,
  children,
  contentClassName = '',
}: PageShellProps) {
  return (
    <div className="content-typography h-full flex flex-col bg-gray-50">
      {actions && (
        <header className="bg-gray-50 drag-region">
          <div className="max-w-6xl mx-auto px-8 pb-3 pt-7">
            <div className="no-drag flex justify-end">{actions}</div>
          </div>
        </header>
      )}

      <div className="flex-1 overflow-y-auto p-8">
        <div className={`max-w-6xl mx-auto ${contentClassName}`}>
          {children}
        </div>
      </div>
    </div>
  )
}
