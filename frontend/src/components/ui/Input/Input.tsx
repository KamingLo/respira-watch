"use client";

import type { ReactNode } from "react";

interface InputProps {
  label?: string;
  placeholder?: string;
  type?: string;
  name?: string;
  value?: string;
  onChange?: (value: string) => void;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  icon?: ReactNode;
}

export default function Input({
  label,
  placeholder,
  type = "text",
  name,
  value,
  onChange,
  error,
  disabled = false,
  required = false,
  icon,
}: InputProps) {
  return (
    <div className="flex w-full flex-col gap-2">
      {label && (
        <label
          htmlFor={name}
          className="text-xs font-bold text-[#244c3b]"
        >
          {label}
          {required && <span className="text-red-600"> *</span>}
        </label>
      )}

      <div className="relative">
        {icon && (
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#075c3b]">
            {icon}
          </span>
        )}

        <input
          id={name}
          name={name}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange?.(event.target.value)}
          disabled={disabled}
          required={required}
          className={`w-full rounded-2xl border bg-[#e5efea] py-4 pr-4 text-sm font-semibold text-[#234936] outline-none transition placeholder:text-[#688273] focus:border-green-700 focus:ring-2 focus:ring-green-100 disabled:cursor-not-allowed disabled:bg-gray-100 ${
            icon ? "pl-11" : "pl-4"
          } ${error ? "border-red-500" : "border-[#b7d7c8]"}`}
        />
      </div>

      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}
