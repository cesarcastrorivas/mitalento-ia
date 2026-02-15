import React from 'react';

interface BadgeProps {
    children: React.ReactNode;
    variant?: 'primary' | 'success' | 'warning' | 'danger' | 'neutral';
    className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
    children,
    variant = 'primary',
    className = '',
}) => {
    const variants = {
        primary: 'bg-primary-500/10 text-primary-700',
        success: 'bg-green-500/10 text-green-700',
        warning: 'bg-accent-500/10 text-accent-700',
        danger: 'bg-red-500/10 text-red-700',
        neutral: 'bg-gray-100 text-gray-600',
    };

    return (
        <span className={`
      inline-flex items-center px-2.5 py-0.5 
      rounded-full text-xs font-semibold 
      ${variants[variant]} 
      ${className}
    `}>
            {children}
        </span>
    );
};
