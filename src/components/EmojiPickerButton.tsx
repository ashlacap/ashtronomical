'use client'

import { useState, useRef, useEffect } from 'react'
import data from '@emoji-mart/data'
import Picker from '@emoji-mart/react'

interface EmojiPickerButtonProps {
  value: string
  onChange: (emoji: string) => void
  name: string
}

export function EmojiPickerButton({ value, onChange, name }: EmojiPickerButtonProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <div className="relative" ref={containerRef}>
      <input type="hidden" name={name} value={value} />
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => e.key === 'Enter' && setOpen((o) => !o)}
        className="rounded-md border border-input bg-background hover:bg-accent transition-colors cursor-pointer"
        aria-label="Pick emoji"
        style={{ width: 40, height: 36, position: 'relative' }}
      >
        <span style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: 20, lineHeight: 1 }}>{value}</span>
      </div>
      {open && (
        <div className="absolute z-50 top-full mt-1 left-0">
          <Picker
            data={data}
            set="native"
            theme="auto"
            onEmojiSelect={(emoji: { native: string }) => {
              onChange(emoji.native)
              setOpen(false)
            }}
            previewPosition="none"
            skinTonePosition="none"
          />
        </div>
      )}
    </div>
  )
}
