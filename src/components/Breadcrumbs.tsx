'use client';

import Link from 'next/link';
import styles from './Breadcrumbs.module.css';
import { ChevronRight } from 'lucide-react';

export interface BreadcrumbItem {
    label: string;
    href?: string;
    emoji?: string;
}

interface BreadcrumbsProps {
    items: BreadcrumbItem[];
}

export default function Breadcrumbs({ items }: BreadcrumbsProps) {
    return (
        <nav className={styles.breadcrumbs} aria-label="Navegación">
            {items.map((item, index) => {
                const isLast = index === items.length - 1;

                return (
                    <span key={index} className={styles.item}>
                        {index > 0 && (
                            <ChevronRight size={14} className={styles.separator} />
                        )}
                        {isLast || !item.href ? (
                            <span className={`${styles.label} ${isLast ? styles.current : ''}`}>
                                {item.emoji && <span className={styles.emoji}>{item.emoji}</span>}
                                {item.label}
                            </span>
                        ) : (
                            <Link href={item.href} className={styles.link}>
                                {item.emoji && <span className={styles.emoji}>{item.emoji}</span>}
                                {item.label}
                            </Link>
                        )}
                    </span>
                );
            })}
        </nav>
    );
}
