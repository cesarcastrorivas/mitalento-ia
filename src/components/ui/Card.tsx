import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    hover?: boolean;
    glass?: boolean;
    padded?: boolean;
}

export const Card: React.FC<CardProps> = ({
    children,
    className = '',
    hover = true,
    glass = false,
    padded = true,
    ...props
}) => {
    const baseStyles = 'rounded-[24px] transition-all duration-240 ease-[cubic-bezier(0.4,0,0.2,1)]';

    const styles = glass
        ? 'bg-white/5 backdrop-blur-xl border border-white/10'
        : 'bg-bg-surface shadow-[0px_1px_2px_rgba(0,0,0,0.04),0px_8px_24px_rgba(0,0,0,0.06)]';

    const hoverStyles = hover
        ? 'hover:-translate-y-0.5 hover:shadow-[0px_4px_12px_rgba(0,0,0,0.08),0px_16px_32px_rgba(0,0,0,0.10)]'
        : '';

    const paddingStyles = padded ? 'p-6' : '';

    return (
        <div
            className={`${baseStyles} ${styles} ${hoverStyles} ${paddingStyles} ${className}`}
            {...props}
        >
            {children}
        </div>
    );
};
