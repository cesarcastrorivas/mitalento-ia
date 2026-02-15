import React, { useId } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    icon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
    label,
    error,
    icon,
    className = '',
    id,
    ...props
}) => {
    const generatedId = useId();
    const inputId = id || props.name || generatedId;

    return (
        <div className="flex flex-col gap-1.5 w-full">
            {label && (
                <label
                    htmlFor={inputId}
                    className="text-sm font-medium text-text-secondary ml-1"
                >
                    {label}
                </label>
            )}
            <div className="relative">
                {icon && (
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted">
                        {icon}
                    </div>
                )}
                <input
                    id={inputId}
                    className={`
            w-full px-5 py-4 rounded-2xl
            bg-gray-100/80 border-0
            text-text-primary placeholder:text-text-muted
            focus:outline-none focus:ring-0 focus:bg-white focus:shadow-sm
            transition-all duration-300
            ${icon ? 'pl-12' : ''}
            ${error ? 'bg-red-50 text-red-900 placeholder:text-red-300' : ''}
            ${className}
          `}
                    {...props}
                />
            </div>
            {error && (
                <p className="text-xs text-red-500 ml-1 mt-0.5">{error}</p>
            )}
        </div>
    );
};
