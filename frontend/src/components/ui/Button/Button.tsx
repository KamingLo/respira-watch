"use client";

interface ButtonProps {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "outline" | "danger";
  size?: "small" | "medium" | "large";
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  fullWidth?: boolean;
  onClick?: () => void;
  className?: string;
}

export default function Button({
  children,
  variant = "primary",
  size = "medium",
  type = "button",
  disabled = false,
  fullWidth = false,
  onClick,
  className = "",
}: ButtonProps) {
  const baseStyles =
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg font-semibold transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50";

  const variants = {
    primary: "bg-green-700 text-white hover:bg-green-800",
    secondary: "bg-green-100 text-green-800 hover:bg-green-200",
    outline:
      "border border-green-700 bg-transparent text-green-700 hover:bg-green-50",
    danger: "bg-red-600 text-white hover:bg-red-700",
  };

  const sizes = {
    small: "px-3.5 py-2 text-xs",
    medium: "px-5 py-3 text-sm",
    large: "px-6 py-3.5 text-base",
  };

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${
        fullWidth ? "w-full" : ""
      } ${className}`}
    >
      {children}
    </button>
  );
}
