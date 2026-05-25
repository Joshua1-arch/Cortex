import { Slot } from "@radix-ui/react-slot";
import { Loader2 } from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { clsx } from "clsx";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  isLoading?: boolean;
  loadingText?: ReactNode;
  asChild?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    children,
    disabled,
    isLoading = false,
    loadingText = "Processing...",
    asChild = false,
    type = "button",
    ...props
  },
  ref,
) {
  const Component = asChild ? Slot : "button";

  return (
    <Component
      ref={ref}
      type={type}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      className={clsx(
        "inline-flex items-center justify-center gap-3 rounded-[20px] border border-[#24432b] bg-[linear-gradient(90deg,#61f58f_0%,#d9f06c_100%)] px-5 py-3.5 text-sm font-semibold text-[#071108] shadow-[0_14px_34px_rgba(67,175,92,0.24)] transition-all duration-200 ease-out hover:-translate-y-[1px] hover:brightness-105 active:translate-y-[1px] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7cf694] focus-visible:ring-offset-2 focus-visible:ring-offset-[#070c08] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:brightness-100 disabled:active:translate-y-0 disabled:active:scale-100",
        className,
      )}
      {...props}
    >
      {isLoading ? (
        <>
          <Loader2 className="size-4 animate-spin" />
          <span>{loadingText}</span>
        </>
      ) : (
        children
      )}
    </Component>
  );
});
