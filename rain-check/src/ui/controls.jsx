import { useEffect, useState } from 'preact/hooks';
import { Check, Undo2 } from './icons.js';

export function Field({ label, wide, hint, children }) {
  return (
    <label class={`field${wide ? ' wide' : ''}`}>
      <span class="field-label">{label}</span>
      {children}
      {hint && <span class="field-hint">{hint}</span>}
    </label>
  );
}

const capFirst = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export function Select({ value, options, onChange }) {
  return (
    <select class="input" value={value} onChange={(e) => onChange(e.currentTarget.value)}>
      {Object.entries(options).map(([k, o]) => (
        <option key={k} value={k}>
          {capFirst(o.label)}
        </option>
      ))}
    </select>
  );
}

// A number box that lets you type freely and commits only valid numbers.
export function NumberInput({ value, onCommit, min = 0, label }) {
  const [text, setText] = useState(String(value));
  useEffect(() => {
    if (parseFloat(text) !== value) setText(String(value));
  }, [value]);
  return (
    <input
      class="input"
      inputMode="decimal"
      value={text}
      aria-label={label}
      onInput={(e) => {
        const t = e.currentTarget.value;
        setText(t);
        const n = parseFloat(t);
        if (Number.isFinite(n) && n >= min) onCommit(n);
      }}
      onBlur={() => {
        const n = parseFloat(text);
        if (!Number.isFinite(n) || n < min) setText(String(value));
      }}
    />
  );
}

export function Slider({ label, display, value, min, max, step = 1, onChange }) {
  return (
    <label class="slider">
      <span class="slider-top">
        <span>{label}</span>
        <strong>{display}</strong>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onInput={(e) => onChange(Number(e.currentTarget.value))} />
    </label>
  );
}

// Pill that logs something for today, and undoes it on a second tap.
export function LogToggle({ on, onClick, icon, label, onLabel }) {
  return (
    <button class={`pill${on ? ' pill-on' : ''}`} onClick={onClick} aria-pressed={on} title={on ? 'Tap to undo' : undefined}>
      {on ? <Check size={15} aria-hidden="true" /> : icon}
      {on ? onLabel : label}
      {on && <Undo2 size={13} aria-hidden="true" class="pill-undo" />}
    </button>
  );
}

export function Segmented({ label, value, options, onChange, small }) {
  return (
    <div class={`seg${small ? ' seg-small' : ''}`} role="group" aria-label={label}>
      {options.map(([k, text]) => (
        <button key={k} aria-pressed={value === k} onClick={() => onChange(k)}>
          {text}
        </button>
      ))}
    </div>
  );
}

// A button that needs a second tap within a few seconds, for things that can't be undone.
export function ConfirmButton({ onConfirm, children, confirmText, class: cls = '', icon }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      class={`${cls}${armed ? ' danger' : ''}`}
      onClick={() => {
        if (armed) {
          setArmed(false);
          onConfirm();
        } else setArmed(true);
      }}
    >
      {icon}
      {armed ? confirmText : children}
    </button>
  );
}
