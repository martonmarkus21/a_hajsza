import { FiSearch, FiX } from 'react-icons/fi';

type CkTableSearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Külső wrapper (pl. `w-full md:w-96`) */
  className?: string;
  /** További osztályok az inputon (pl. `py-2.5 w-full`) */
  inputClassName?: string;
};

export default function CkTableSearchInput({
  value,
  onChange,
  placeholder,
  className = '',
  inputClassName = '',
}: CkTableSearchInputProps) {
  const hasText = value.length > 0;
  return (
    <div className={`relative group ${className}`}>
      <FiSearch className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400 transition-colors group-focus-within:text-orange-500" />
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`ck-input pl-11 ${hasText ? 'pr-10' : ''} ${inputClassName}`.trim()}
      />
      {hasText && (
        <button
          type="button"
          aria-label="Keresés törlése"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-gray-500 transition-colors hover:bg-white/10 hover:text-white"
          onClick={() => onChange('')}
        >
          <FiX className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
