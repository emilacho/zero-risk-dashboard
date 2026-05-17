"use client"
/**
 * Combobox · Sprint #8 P1 component · Radix Popover + Downshift integration.
 *
 * Filterable autocomplete · keyboard-accessible · WAI-ARIA combobox pattern
 * supplied by Downshift's useCombobox · positioning + portal supplied by
 * Radix Popover (collision detection · sideOffset · anchor-relative).
 *
 * Use cases · client picker (search 100+ clients) · agent picker · workflow
 * picker · model picker · any "type-to-narrow + select-one" UX. Generic over
 * the item shape via the `itemToString` + `renderItem` props.
 *
 * Accessibility · combobox role · aria-expanded · aria-controls · aria-activedescendant ·
 * listbox/option roles · arrow-key navigation · Enter/Tab selects · Esc closes.
 */
import * as Popover from "@radix-ui/react-popover"
import { useCombobox } from "downshift"
import { useId, useMemo, useState } from "react"
import { MagnifyingGlass, CaretDown, X } from "@phosphor-icons/react/dist/ssr"

export interface ComboboxProps<T> {
  /** All items · filtered locally by inputValue · for remote search wrap in your own debounce */
  items: T[]
  /** Currently selected item · null for cleared state */
  value: T | null
  /** Selection change callback */
  onChange: (item: T | null) => void
  /** Render label for an item · used for filtering match + input display */
  itemToString: (item: T | null) => string
  /** Optional custom row renderer · default uses itemToString */
  renderItem?: (item: T, opts: { isHighlighted: boolean; isSelected: boolean }) => React.ReactNode
  /** Placeholder when input is empty · default "Search..." */
  placeholder?: string
  /** Label rendered above input (visually hidden if undefined) */
  label?: string
  /** aria-label when label is undefined · default "Combobox" */
  ariaLabel?: string
  /** Container className */
  className?: string
  /** Lumen rim hue for the dropdown panel · default cyan */
  rim?: "cyan" | "violet" | "amber" | "emerald" | "rose"
  /** Optional empty-state message · default "No matches." */
  emptyMessage?: string
  /** Disable the input · default false */
  disabled?: boolean
}

export function Combobox<T>({
  items,
  value,
  onChange,
  itemToString,
  renderItem,
  placeholder = "Search...",
  label,
  ariaLabel = "Combobox",
  className = "",
  rim = "cyan",
  emptyMessage = "No matches.",
  disabled = false,
}: ComboboxProps<T>) {
  const labelId = useId()
  const [inputValue, setInputValue] = useState(itemToString(value))

  const filtered = useMemo(() => {
    const q = inputValue.trim().toLowerCase()
    if (!q) return items
    return items.filter((item) => itemToString(item).toLowerCase().includes(q))
  }, [items, inputValue, itemToString])

  const {
    isOpen,
    getLabelProps,
    getInputProps,
    getMenuProps,
    getItemProps,
    getToggleButtonProps,
    highlightedIndex,
    selectedItem,
    openMenu,
    closeMenu,
    reset,
  } = useCombobox({
    items: filtered,
    selectedItem: value,
    inputValue,
    itemToString: (item) => itemToString(item),
    onInputValueChange: ({ inputValue: v }) => setInputValue(v ?? ""),
    onSelectedItemChange: ({ selectedItem: item }) => {
      onChange(item ?? null)
      setInputValue(item ? itemToString(item) : "")
    },
  })

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation()
    reset()
    onChange(null)
    setInputValue("")
  }

  return (
    <div className={`relative ${className}`}>
      {label && (
        <label
          {...getLabelProps({ id: labelId })}
          className="mb-1.5 block text-[10px] font-mono uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]"
        >
          {label}
        </label>
      )}
      <Popover.Root
        open={isOpen}
        onOpenChange={(open) => {
          if (!open) closeMenu()
          else openMenu()
        }}
      >
        <Popover.Anchor asChild>
          <div className="relative flex items-center">
            <MagnifyingGlass
              className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]"
              aria-hidden
            />
            <input
              {...getInputProps({
                "aria-label": label ? undefined : ariaLabel,
                disabled,
                onFocus: () => openMenu(),
                onClick: () => openMenu(),
              })}
              placeholder={placeholder}
              className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background)/0.6)] py-1.5 pl-9 pr-16 text-[12px] text-foreground placeholder:text-[hsl(var(--muted-foreground))] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--ring))] disabled:opacity-50"
            />
            <div className="absolute right-1 flex items-center gap-0.5">
              {value && !disabled && (
                <button
                  type="button"
                  onClick={handleClear}
                  aria-label="Clear selection"
                  className="rounded p-1 text-[hsl(var(--muted-foreground))] hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--ring))]"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
              <button
                type="button"
                {...getToggleButtonProps({ disabled })}
                aria-label={isOpen ? "Close options" : "Open options"}
                className="rounded p-1 text-[hsl(var(--muted-foreground))] hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--ring))]"
              >
                <CaretDown
                  className={`h-3 w-3 transition-transform ${isOpen ? "rotate-180" : ""}`}
                />
              </button>
            </div>
          </div>
        </Popover.Anchor>
        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={4}
            avoidCollisions
            onOpenAutoFocus={(e) => e.preventDefault()}
            className="surface-card rim-instr z-50 w-[var(--radix-popover-trigger-width)] min-w-[260px] overflow-hidden p-0 shadow-[0_24px_60px_-12px_hsl(var(--background)/0.8)]"
            data-rim={rim}
          >
            <ul
              {...getMenuProps()}
              className="relative z-[2] max-h-[280px] overflow-y-auto py-1"
            >
              {filtered.length === 0 ? (
                <li className="px-3 py-3 text-center text-[12px] text-[hsl(var(--muted-foreground))]">
                  {emptyMessage}
                </li>
              ) : (
                filtered.map((item, i) => {
                  const isHighlighted = highlightedIndex === i
                  const isSelected = selectedItem === item
                  return (
                    <li
                      key={`${itemToString(item)}-${i}`}
                      {...getItemProps({ item, index: i })}
                      className={`cursor-pointer px-3 py-2 text-[12px] transition-colors ${
                        isHighlighted
                          ? "bg-[hsl(var(--primary-glow)/0.08)] text-foreground"
                          : "text-[hsl(var(--muted-foreground))]"
                      } ${isSelected ? "font-semibold text-[hsl(var(--accent))]" : ""}`}
                    >
                      {renderItem
                        ? renderItem(item, { isHighlighted, isSelected })
                        : itemToString(item)}
                    </li>
                  )
                })
              )}
            </ul>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  )
}
