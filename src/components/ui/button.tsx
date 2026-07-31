import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        accion:
          "bg-cyan-brand text-cyan-brand-foreground font-bold shadow-glow active:scale-[0.98] hover:brightness-110",
        contorno:
          "border-2 border-cyan-brand bg-transparent text-cyan-brand font-semibold active:scale-[0.98] hover:bg-cyan-brand/10",
        alerta:
          "bg-gold-brand text-gold-brand-foreground font-bold active:scale-[0.98] hover:brightness-110",
        exito:
          "bg-success text-success-foreground font-bold active:scale-[0.98] hover:brightness-110",
        peligro:
          "bg-danger text-danger-foreground font-bold active:scale-[0.98] hover:brightness-110",
        neutro:
          "border-2 border-border bg-secondary text-foreground font-semibold active:scale-[0.98] hover:bg-secondary/70",
      },
      size: {
        default: "min-h-[60px] px-5 py-3 text-base [&_svg]:size-5",
        sm: "min-h-[48px] rounded-md px-4 text-base [&_svg]:size-5",
        lg: "min-h-[60px] rounded-md px-8 text-lg [&_svg]:size-6",
        icon: "size-[60px] [&_svg]:size-6",
        grande: "min-h-[60px] w-full rounded-xl px-6 text-lg [&_svg]:size-6",
        gigante: "min-h-[80px] w-full rounded-xl px-6 text-xl [&_svg]:size-7",
        medio: "min-h-[60px] rounded-xl px-5 text-base [&_svg]:size-5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
