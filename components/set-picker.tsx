import {useEffect, useId, useRef, useState} from 'react';
import {ChevronDown, Check} from 'lucide-react';
import {useLang} from '@/lib/i18n';
import {SETS, type SetInfo} from '@/lib/sets';

/** Set title that doubles as a set selector (design option A). */
export function SetPicker({value, onChange}: {value: string; onChange: (code: string) => void}) {
  const {lang, tr} = useLang();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null), id = useId();
  const current = SETS.find(s => s.code === value) || SETS[0];
  const name = (s: SetInfo) => (lang === 'en' ? s.name_en : s.name_ja);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);
  return <div ref={root} className="relative">
    <p className="text-primary text-sm mb-2 tracking-widest">{current.name_en.toUpperCase()} · {current.code}</p>
    <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
      <button type="button" aria-haspopup="listbox" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}
        className="group inline-flex items-center gap-3 rounded-lg text-left focus-visible:outline-2 focus-visible:outline-primary">
        <span>{name(current)}</span>
        <span className="inline-flex size-7 sm:size-8 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors group-hover:border-primary/60 group-hover:text-primary">
          <ChevronDown className={'size-4 transition-transform ' + (open ? 'rotate-180' : '')}/>
        </span>
        <span className="sr-only">{tr('セットを選択', 'Choose a set')}</span>
      </button>
    </h1>
    {open && <ul id={id} role="listbox" aria-label={tr('セット', 'Set')} className="absolute left-0 top-full z-30 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-border bg-popover p-1.5 shadow-2xl">
      {SETS.map((s, i) => {
        const selected = s.code === current.code;
        return <li key={s.code || i} role="option" aria-selected={selected} aria-disabled={!s.available}>
          <button type="button" disabled={!s.available} onClick={() => { onChange(s.code); setOpen(false); }}
            className={'flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm text-left ' + (selected ? 'bg-accent' : s.available ? 'hover:bg-accent/60' : 'opacity-45 cursor-not-allowed')}>
            <span className="flex items-center gap-3 min-w-0"><span className="font-mono font-bold text-primary w-10 shrink-0">{s.code || '???'}</span><span className="truncate">{name(s)}</span></span>
            {selected ? <Check className="size-4 text-primary shrink-0"/> : !s.available && <span className="text-xs text-muted-foreground shrink-0">{tr('近日公開', 'Coming soon')}</span>}
          </button>
        </li>;
      })}
    </ul>}
  </div>;
}
