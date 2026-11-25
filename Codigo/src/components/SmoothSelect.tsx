import { useId, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import './SmoothSelect.css'

export type SmoothOption = { value: string; label: string }

/** Select-like dropdown whose list slides open slowly (a native <select> list can't be animated). */
export function SmoothSelect({ value, options, onChange }: {
  value: string
  options: SmoothOption[]
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const index = Math.max(0, options.findIndex(option => option.value === value))
  const choose = (next: string) => { onChange(next); setOpen(false) }

  return <div className={'smooth-select' + (open ? ' is-open' : '')}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }}
    onKeyDown={event => {
      if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); setOpen(false) }
      else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        if (!open) { setOpen(true); return }
        const step = event.key === 'ArrowDown' ? 1 : -1
        onChange(options[(index + step + options.length) % options.length].value)
      }
    }}>
    <button type="button" className="smooth-select__button" aria-haspopup="listbox" aria-expanded={open}
      aria-controls={id} onClick={event => { event.preventDefault(); setOpen(o => !o) }}>
      <span>{options[index]?.label}</span>
      <ChevronDown size={18} aria-hidden="true" />
    </button>
    <div className="smooth-select__panel">
      <ul id={id} role="listbox" className="smooth-select__list">
        {options.map(option => <li key={option.value} role="option" aria-selected={option.value === value}
          onMouseDown={event => event.preventDefault()}
          onClick={event => { event.preventDefault(); choose(option.value) }}>
          {option.label}
          {option.value === value && <Check size={15} aria-hidden="true" />}
        </li>)}
      </ul>
    </div>
  </div>
}
