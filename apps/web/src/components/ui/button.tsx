import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { LoaderCircle } from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "../../lib/cn";

const buttonVariants = cva(
  [
    "relative inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-control font-medium",
    "transition-[background-color,color,box-shadow,transform,border-color] duration-180 ease-ghost",
    "active:translate-y-px disabled:pointer-events-none disabled:opacity-45",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
    "[&_svg]:size-4 [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        primary: "bg-forest text-porcelain shadow-soft hover:bg-forest-2 dark:bg-petal dark:text-forest dark:hover:bg-petal-soft",
        secondary: "border border-border bg-surface text-fg shadow-soft hover:border-border-strong hover:bg-surface-muted",
        ghost: "text-fg-muted hover:bg-surface-muted hover:text-fg",
        danger: "border border-punch/25 bg-surface text-punch hover:border-punch/40 hover:bg-punch/8 dark:text-petal",
        accent: "bg-punch text-white shadow-soft hover:bg-punch-deep",
        inverse: "bg-petal text-forest hover:bg-petal-soft",
      },
      size: {
        sm: "h-8 px-3 text-sm",
        md: "h-10 px-4 text-sm",
        lg: "h-12 px-5 text-base",
        icon: "size-9",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    /** Render as the child element (e.g. a Next `Link`) while keeping button styling. */
    asChild?: boolean;
    /** Shows a spinner, disables the button and keeps its width stable. */
    loading?: boolean;
    /** Icon rendered before the label. */
    icon?: ReactNode;
  };

/** Variants: primary (forest) · secondary · ghost · danger · accent (punch, key agent actions) · inverse (petal, for forest surfaces). */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, asChild = false, loading = false, icon, disabled, children, type, ...props },
  ref,
) {
  const classes = cn(buttonVariants({ variant, size }), className);
  if (asChild) {
    return (
      <Slot ref={ref} className={classes} {...props}>
        {children}
      </Slot>
    );
  }
  return (
    <button
      ref={ref}
      type={type ?? "button"}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <LoaderCircle aria-hidden className="motion-safe:animate-spin" /> : icon}
      {children}
    </button>
  );
});

export { buttonVariants };
