import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "sm";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

/** The single button primitive; `type` defaults to "button" to avoid accidental submits. */
export function Button({
  variant = "primary",
  size = "md",
  type = "button",
  className,
  ...rest
}: ButtonProps) {
  const classes = [
    "btn",
    `btn--${variant}`,
    size === "sm" ? "btn--sm" : null,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return <button type={type} className={classes} {...rest} />;
}
