import { cloneElement, useId, type ReactElement, type ReactNode } from "react";

type FieldControlProps = {
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
};

type FieldProps = Readonly<{
  children: ReactElement<FieldControlProps>;
  error?: string;
  help?: ReactNode;
  label: ReactNode;
  optional?: boolean;
}>;

export function Field({ children, error, help, label, optional = false }: FieldProps) {
  const generatedId = useId();
  const controlId = children.props.id ?? `field-${generatedId}`;
  const helpId = help === undefined ? undefined : `${controlId}-help`;
  const errorId = error === undefined ? undefined : `${controlId}-error`;
  const describedBy = [children.props["aria-describedby"], helpId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="ui-field">
      <div className="ui-field__label-row">
        <label htmlFor={controlId}>{label}</label>
        <span aria-hidden="true" className="ui-field__requirement">{optional ? "facultatif" : "*"}</span>
      </div>
      {cloneElement(children, {
        id: controlId,
        "aria-describedby": describedBy,
        "aria-invalid": error === undefined ? undefined : true,
      })}
      {help !== undefined && <p className="ui-field__help" id={helpId}>{help}</p>}
      {error !== undefined && <p className="ui-field__error" id={errorId} role="alert">{error}</p>}
    </div>
  );
}
