import { Slot } from "@radix-ui/react-slot";
import { Loader2 } from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { clsx } from "clsx";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  isLoading?: boolean;
  asChild?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, children, disabled, isLoading = false, asChild = false, type = "button", ...props },
  ref,
) {
  const Component = asChild ? Slot : "button";

  return (
    <Component
      ref={ref}
      type={type}
      disabled={disabled || isLoading}
      className={clsx(
        "inline-flex items-center justify-center gap-3 rounded-[20px] border border-[#24432b] bg-[linear-gradient(90deg,#61f58f_0%,#d9f06c_100%)] px-5 py-3.5 text-sm font-semibold text-[#071108] shadow-[0_14px_34px_rgba(67,175,92,0.24)] transition-all duration-200 ease-out hover:-translate-y-[1px] hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7cf694] focus-visible:ring-offset-2 focus-visible:ring-offset-[#070c08] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:brightness-100",
        className,
      )}
      {...props}
    >
      {isLoading ? (
        <>
          <Loader2 className="size-4 animate-spin" />
          <span>Processing...</span>
        </>
      ) : (
        children
      )}
    </Component>
  );
});
