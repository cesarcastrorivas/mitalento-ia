'use client';

import styles from './page.module.css';

export default function ReportsPage() {
    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <h1>Reportes</h1>
                <p>Próximamente: estadísticas detalladas de progreso y rendimiento</p>
            </header>

            <div className="card empty-state">
                <div className="empty-state-icon">📊</div>
                <h3 className="empty-state-title">Reportes en desarrollo</h3>
                <p className="empty-state-description">
                    Esta sección mostrará estadísticas de progreso de estudiantes,
                    tasas de aprobación por módulo y análisis de rendimiento.
                </p>
            </div>
        </div>
    );
}
