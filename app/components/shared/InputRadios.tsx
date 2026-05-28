interface RadioOption {
  value: string;
  label: string;
}

interface InputRadiosProps {
  legend: string;
  name: string;
  options: RadioOption[];
  optional?: boolean;
  legendLarge?: boolean;
  disabled?: boolean;
  // Controlled
  value?: string;
  onChange?: (value: string) => void;
  // Uncontrolled
  defaultValue?: string;
}

export default function InputRadios({
  legend,
  name,
  options,
  optional = false,
  legendLarge = false,
  disabled = false,
  value,
  onChange,
  defaultValue,
}: Readonly<InputRadiosProps>) {
  const isControlled = value !== undefined;

  return (
    <fieldset className="kern-fieldset" disabled={disabled}>
      <legend className={`kern-label${legendLarge ? "kern-label--large" : ""}`}>
        {legend}
        {optional && <span className="kern-label__optional"> - Optional</span>}
      </legend>
      <div className="kern-fieldset__body">
        {options.map((option) => {
          const id = `${name}-${option.value}`;
          const radioProps = isControlled
            ? {
                checked: value === option.value,
                onChange: onChange ? () => onChange(option.value) : undefined,
              }
            : { defaultChecked: defaultValue === option.value };

          return (
            <div key={option.value} className="kern-form-check">
              <input
                className="kern-form-check__radio"
                id={id}
                name={name}
                type="radio"
                value={option.value}
                {...radioProps}
              />
              <label className="kern-label" htmlFor={id}>
                {option.label}
              </label>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
