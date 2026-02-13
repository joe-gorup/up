import React from 'react';
import InputMask from 'react-input-mask';

// Design System - Consistent Input Styling
const INPUT_BASE_CLASSES = "w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-base";

interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  required?: boolean;
  helpText?: string;
}

interface PhoneInputProps extends Omit<FormInputProps, 'type' | 'children'> {
  mask?: string;
}

// Standard Input Component
export function FormInput({ 
  label, 
  error, 
  required, 
  helpText, 
  className = "", 
  ...props 
}: FormInputProps) {
  const inputClasses = `${INPUT_BASE_CLASSES} ${className} ${error ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`;
  
  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <input
        className={inputClasses}
        {...props}
      />
      {helpText && (
        <p className="text-xs text-gray-500">{helpText}</p>
      )}
      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}

// Phone Input with Masking
export function PhoneInput({ 
  label, 
  error, 
  required, 
  helpText, 
  className = "", 
  mask = "(999) 999-9999",
  value,
  onChange,
  placeholder,
  ...props 
}: PhoneInputProps) {
  const inputClasses = `${INPUT_BASE_CLASSES} ${className} ${error ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`;
  
  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <InputMask
        mask={mask}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={inputClasses}
      />
      {helpText && (
        <p className="text-xs text-gray-500">{helpText}</p>
      )}
      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}

// Select Input Component
interface SelectInputProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  required?: boolean;
  helpText?: string;
}

export function SelectInput({ 
  label, 
  error, 
  required, 
  helpText, 
  className = "", 
  children,
  ...props 
}: SelectInputProps) {
  const selectClasses = `${INPUT_BASE_CLASSES} ${className} ${error ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`;
  
  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <select
        className={selectClasses}
        {...props}
      >
        {children}
      </select>
      {helpText && (
        <p className="text-xs text-gray-500">{helpText}</p>
      )}
      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}

// Export the base classes for custom components
export { INPUT_BASE_CLASSES };