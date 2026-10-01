interface MobileTableProps {
  columns: Array<{
    key: string
    label: string
    mobile?: boolean
  }>
  data: Array<Record<string, any>>
  renderCell?: (key: string, value: any, row: Record<string, any>) => React.ReactNode
}

export function MobileTable({ columns, data, renderCell }: MobileTableProps) {
  const mobileColumns = columns.filter(col => col.mobile !== false)

  return (
    <div className="space-y-3">
      {data.map((row, idx) => (
        <div
          key={idx}
          className="bg-white border border-gray-200 rounded-lg p-4 space-y-3"
        >
          {mobileColumns.map((col) => (
            <div key={col.key} className="flex justify-between items-start gap-4">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex-shrink-0">
                {col.label}
              </label>
              <div className="text-sm text-gray-900 text-right flex-1">
                {renderCell
                  ? renderCell(col.key, row[col.key], row)
                  : row[col.key]}
              </div>
            </div>
          ))}
        </div>
      ))}

      {data.length === 0 && (
        <div className="text-center py-8 text-gray-400 text-sm">
          Nenhum registro encontrado
        </div>
      )}
    </div>
  )
}
