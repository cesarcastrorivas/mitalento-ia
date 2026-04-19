'use client';

import type { ReactNode } from 'react';

export default function ToolGrid({ children }: { children: ReactNode }) {
    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
            {children}
        </div>
    );
}
