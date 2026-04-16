'use client';

import React from 'react';

interface AdminPageHeaderProps {
    title: string;
    subtitle?: string;
    icon?: React.ReactNode;
    action?: React.ReactNode;
    className?: string;
}

export default function AdminPageHeader({
    title,
    subtitle,
    icon,
    action,
    className = '',
}: AdminPageHeaderProps) {
    return (
        <div className={`flex items-center justify-between gap-4 mb-10 min-h-[56px] ${className}`}>
            <div className="flex items-center gap-5 min-w-0">
                {icon && (
                    <div className="w-12 h-12 rounded-2xl bg-[#f5a944] text-white flex items-center justify-center flex-shrink-0 shadow-[0_4px_14px_rgba(17,28,45,0.04)]">
                        {icon}
                    </div>
                )}
                <div>
                     {subtitle && (
                        <h2 className="text-label-md text-[#60356a] mb-1 truncate">{subtitle}</h2>
                    )}
                    <h1 className="text-display-md text-[#60356a] m-0 leading-none truncate">{title}</h1>
                </div>
            </div>
            {action && (
                <div className="flex-shrink-0">
                    {action}
                </div>
            )}
        </div>
    );
}
