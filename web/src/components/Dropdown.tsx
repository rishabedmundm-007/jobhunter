import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Option } from '../utils/preferenceOptions'

interface BaseDropdownProps {
  label: string
  options: Option[]
  placeholder?: string
  error?: boolean
  searchable?: boolean
}

interface SingleDropdownProps extends BaseDropdownProps {
  multi?: false
  value: string
  onChange: (value: string) => void
}

interface MultiDropdownProps extends BaseDropdownProps {
  multi: true
  value: string[]
  onChange: (value: string[]) => void
}

type DropdownProps = SingleDropdownProps | MultiDropdownProps

export default function Dropdown(props: DropdownProps) {
  const { label, options, placeholder = 'Select…', error, searchable } = props
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onEscape)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onEscape)
    }
  }, [])

  useEffect(() => {
    if (!open) setSearch('')
  }, [open])

  const selectedLabels = props.multi
    ? options.filter(o => props.value.includes(o.value)).map(o => o.label)
    : options.find(o => o.value === props.value)?.label

  const summary = props.multi
    ? props.value.length === 0
      ? placeholder
      : props.value.length <= 2
        ? (selectedLabels as string[]).join(', ')
        : `${props.value.length} selected`
    : selectedLabels || placeholder

  const isSelected = (value: string) => (props.multi ? props.value.includes(value) : props.value === value)

  const selectOption = (value: string) => {
    if (props.multi) {
      const next = props.value.includes(value)
        ? props.value.filter(v => v !== value)
        : [...props.value, value]
      props.onChange(next)
    } else {
      props.onChange(value)
      setOpen(false)
    }
  }

  const filteredOptions = searchable && search.trim()
    ? options.filter(o => o.label.toLowerCase().includes(search.trim().toLowerCase()))
    : options

  return (
    <div ref={rootRef} className="relative">
      <label className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300">{label}</label>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`glass-input flex w-full items-center justify-between rounded-xl px-4 py-2.5 text-left text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
          error ? 'ring-2 ring-red-400' : ''
        } ${(props.multi ? props.value.length === 0 : !props.value) ? 'text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-slate-200'}`}
      >
        <span className="truncate">{summary}</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }} className="ml-2 flex-shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true">
          ⌄
        </motion.span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="glass-solid absolute z-20 mt-2 w-full overflow-hidden rounded-xl shadow-xl"
          >
            {searchable && (
              <div className="border-b border-slate-100 p-2">
                <input
                  autoFocus
                  type="text"
                  role="searchbox"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Type to search…"
                  aria-label={`Search ${label}`}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
            )}
            <ul
              role="listbox"
              aria-multiselectable={props.multi}
              className="max-h-56 overflow-y-auto p-1.5"
            >
              {filteredOptions.map(opt => {
                const selected = isSelected(opt.value)
                return (
                  <li
                    key={opt.value}
                    role="option"
                    aria-selected={selected}
                    onClick={() => selectOption(opt.value)}
                    className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
                      selected ? 'bg-indigo-50 font-medium text-indigo-800' : 'text-slate-700 dark:text-slate-300 hover:bg-indigo-50/60'
                    }`}
                  >
                    {props.multi && (
                      <span
                        aria-hidden="true"
                        className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border ${
                          selected ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 dark:border-slate-600'
                        }`}
                      >
                        {selected && '✓'}
                      </span>
                    )}
                    <span className="truncate">{opt.label}</span>
                  </li>
                )
              })}
              {filteredOptions.length === 0 && (
                <li className="px-3 py-4 text-center text-sm text-slate-400 dark:text-slate-500">No matches</li>
              )}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
