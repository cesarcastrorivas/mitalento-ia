import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'tertiary';
    size?: 'sm' | 'md' | 'lg';
    isLoading?: boolean;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
    children,
    variant = 'primary',
    size = 'md',
    isLoading = false,
    leftIcon,
    rightIcon,
    className = '',
    disabled,
    ...props
}) => {
    const baseStyles = 'inline-flex items-center justify-center font-semibold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed outline-none';

    // Primary: subtle gradient, Roundedness lg (1rem)
    // Secondary: CTA. secondary_container (#ffb14b) with on_secondary? high-contrast.
    // Tertiary: No background, bold primary text.
    const variants = {
        primary: 'bg-[linear-gradient(135deg,var(--color-primary),var(--color-primary-container))] text-white hover:brightness-110 shadow-[0_4px_14px_rgba(71,30,82,0.2)] hover:shadow-[0_6px_20px_rgba(71,30,82,0.3)] hover:-translate-y-0.5 rounded-2xl',
        secondary: 'bg-secondary-container text-[#111c2d] hover:brightness-105 shadow-sm hover:shadow-md hover:-translate-y-0.5 rounded-2xl',
        tertiary: 'bg-transparent text-primary hover:bg-primary/5 rounded-2xl',
    };

    const sizes = {
        sm: 'text-sm px-4 py-2 gap-2',
        md: 'text-base px-6 py-3 gap-2.5',
        lg: 'text-lg px-8 py-4 gap-3',
    };

    return (
        <button
            className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
            disabled={disabled || isLoading}
            {...props}
        >
            {isLoading && (
                <svg className="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
            )}
            {!isLoading && leftIcon && <span className="flex-shrink-0">{leftIcon}</span>}
            {children}
            {!isLoading && rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
        </button>
    );
};
