import React from 'react';

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
    const inputId = id || props.name || 'input-field';

    // Ghost border: 15% opacity outline-variant (rgba(208, 195, 206, 0.40)) but in CSS we can use border-outline-variant/15
    // Wait, outline-variant is #d0c3ce which is approx rgba(208, 195, 206)
    // Tailwind v4 uses color opacity with /15 syntax simply.
    
    return (
        <div className="flex flex-col gap-1.5 w-full">
            {label && (
                <label
                    htmlFor={inputId}
                    className="text-sm font-semibold text-on-surface"
                >
                    {label}
                </label>
            )}
            <div className="relative">
                {icon && (
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-outline-variant">
                        {icon}
                    </div>
                )}
                <input
                    id={inputId}
                    className={`
            w-full px-5 py-4 rounded-xl
            bg-surface-container-lowest 
            border-[1.5px] border-outline-variant/30
            text-on-surface placeholder:text-outline-variant
            focus:outline-none focus:border-primary focus:border-[2px] focus:shadow-[0_0_0_4px_rgba(71,30,82,0.1)]
            transition-all duration-300
            ${icon ? 'pl-12' : ''}
            ${error ? 'bg-red-50 text-error-900 border-error placeholder:text-red-300' : ''}
            ${className}
          `}
                    suppressHydrationWarning
                    {...props}
                />
            </div>
            {error && (
                <p className="text-xs text-error ml-1 mt-0.5">{error}</p>
            )}
        </div>
    );
};
