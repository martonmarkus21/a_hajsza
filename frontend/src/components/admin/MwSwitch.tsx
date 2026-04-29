type MwSwitchSize = 'md' | 'lg';

interface MwSwitchProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  srLabel?: string;
  className?: string;
  size?: MwSwitchSize;
}

const SIZE_STYLES: Record<MwSwitchSize, { track: string; thumb: string }> = {
  md: {
    track: 'w-10 h-6',
    thumb: 'left-1 top-1 w-4 h-4 peer-checked:translate-x-4',
  },
  lg: {
    track: 'w-12 h-7',
    thumb: 'left-1 top-1 w-5 h-5 peer-checked:translate-x-5',
  },
};

export default function MwSwitch({
  checked,
  onChange,
  disabled = false,
  srLabel,
  className = '',
  size = 'md',
}: MwSwitchProps) {
  const sz = SIZE_STYLES[size];
  return (
    <label
      className={`relative inline-flex items-center cursor-pointer flex-shrink-0 ${
        disabled ? 'opacity-50 cursor-not-allowed' : ''
      } ${className}`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-label={srLabel}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only peer"
      />
      <div
        className={`${sz.track} bg-[#404040] peer-focus:outline-none rounded-full peer peer-checked:bg-green-500 transition-colors duration-200`}
      />
      <div
        className={`absolute ${sz.thumb} bg-white rounded-full shadow-sm transition-transform duration-200`}
      />
    </label>
  );
}
