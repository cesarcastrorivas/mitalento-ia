'use client';

import React from 'react';

interface AdminPageHeaderProps {
    title: string;
    subtitle?: string;
    icon?: React.ReactNode;
    action?: React.ReactNode;
    className?: string;
}

/**
 * AdminPageHeader — Componente de encabezado compacto para páginas admin.
 * Mobile-first: título pequeño + subtítulo mínimo en mobile, más prominente en desktop.
 * Elimina el espacio vacío superior al usar un diseño comprimido en pantallas pequeñas.
 */
export default function AdminPageHeader({
    title,
    subtitle,
    icon,
    action,
    className = '',
}: AdminPageHeaderProps) {
    return (
        <div className={`admin-page-header ${className}`}>
            <div className="admin-page-header__left">
                {icon && (
                    <div className="admin-page-header__icon">
                        {icon}
                    </div>
                )}
                <div>
                    <h1 className="admin-page-header__title">{title}</h1>
                    {subtitle && (
                        <p className="admin-page-header__subtitle">{subtitle}</p>
                    )}
                </div>
            </div>
            {action && (
                <div className="admin-page-header__action">
                    {action}
                </div>
            )}

            <style jsx>{`
                .admin-page-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 0.75rem;
                    margin-bottom: 0.875rem;
                    min-height: 40px;
                }

                .admin-page-header__left {
                    display: flex;
                    align-items: center;
                    gap: 0.625rem;
                    min-width: 0;
                }

                .admin-page-header__icon {
                    flex-shrink: 0;
                    width: 34px;
                    height: 34px;
                    border-radius: 10px;
                    background: var(--primary-100, #ede9fe);
                    color: var(--primary-700, #6d28d9);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .admin-page-header__title {
                    font-size: 1.1rem;
                    font-weight: 800;
                    color: var(--text-primary, #1e293b);
                    letter-spacing: -0.02em;
                    line-height: 1.2;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    margin: 0;
                }

                .admin-page-header__subtitle {
                    font-size: 0.72rem;
                    color: var(--text-muted, #94a3b8);
                    font-weight: 500;
                    margin: 0.1rem 0 0;
                    line-height: 1.3;
                }

                .admin-page-header__action {
                    flex-shrink: 0;
                }

                /* Desktop: más aire */
                @media (min-width: 768px) {
                    .admin-page-header {
                        margin-bottom: 1.5rem;
                        min-height: 56px;
                    }

                    .admin-page-header__icon {
                        width: 44px;
                        height: 44px;
                        border-radius: 14px;
                    }

                    .admin-page-header__title {
                        font-size: 1.6rem;
                        white-space: normal;
                    }

                    .admin-page-header__subtitle {
                        font-size: 0.875rem;
                        margin-top: 0.25rem;
                    }
                }
            `}</style>
        </div>
    );
}
