import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../../lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50 terminal-text",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground border border-primary/50 hover:bg-primary/80 hover:border-primary hover:shadow-lg hover:shadow-primary/25",
        destructive:
          "bg-destructive text-destructive-foreground border border-destructive/50 hover:bg-destructive/80 hover:border-destructive hover:shadow-lg hover:shadow-destructive/25",
        outline:
          "border border-border bg-background hover:bg-secondary hover:text-secondary-foreground hover:border-primary/50",
        secondary:
          "bg-secondary text-secondary-foreground border border-secondary/50 hover:bg-secondary/80 hover:border-secondary",
        ghost: "hover:bg-secondary/50 hover:text-accent-foreground border border-transparent hover:border-border/50",
        link: "text-primary underline-offset-4 hover:underline border-none",
      },
      size: {
        default: "h-9 px-4 py-2 rounded-sm",
        sm: "h-8 px-3 text-xs rounded-sm", 
        lg: "h-10 px-8 rounded-sm",
        icon: "h-9 w-9 rounded-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }