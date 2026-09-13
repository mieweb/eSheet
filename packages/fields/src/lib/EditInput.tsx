/** Labeled text input row used by builder-canvas edit views. */
export function EditInput({
  id,
  label,
  value,
  onChange,
  placeholder,
  hint,
  type = 'text',
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
  type?: string;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="ms:block ms:text-sm ms:font-medium ms:text-mstextmuted ms:mb-1"
      >
        {label}
      </label>
      <input
        id={id}
        aria-label={label}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="ms:px-3 ms:py-2 ms:h-10 ms:w-full ms:border ms:border-msborder ms:bg-mssurface ms:text-mstext ms:rounded-lg ms:focus:border-msprimary ms:focus:ring-1 ms:focus:ring-msprimary/30 ms:outline-none ms:transition-colors"
      />
      {hint && <p className="ms:mt-1 ms:text-xs ms:text-mstextmuted">{hint}</p>}
    </div>
  );
}
