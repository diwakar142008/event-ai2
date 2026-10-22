import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "burgundy" | "outline" | "light" | "ghost";
type Size = "md" | "sm";

const styles: Record<Variant, string> = {
  primary: "btn btn-primary",
  burgundy: "btn btn-burgundy",
  outline: "btn btn-outline",
  light: "btn btn-light",
  ghost: "btn btn-ghost",
};

export function Button({
  children,
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode; variant?: Variant; size?: Size }) {
  return (
    <button
      {...props}
      className={`${styles[variant]} ${size === "sm" ? "min-h-[38px] px-4 text-[11px]" : ""} ${className}`}
    >
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  children,
  variant = "primary",
  size = "md",
  className = "",
}: {
  href: string;
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  className?: string;
}) {
  return (
    <Link href={href} className={`${styles[variant]} ${size === "sm" ? "min-h-[38px] px-4 text-[11px]" : ""} ${className}`}>
      {children}
    </Link>
  );
}
