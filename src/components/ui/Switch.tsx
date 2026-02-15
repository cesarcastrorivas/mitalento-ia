import React from 'react';

interface SwitchProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    label?: string;
    description?: string;
    disabled?: boolean;
}

export const Switch: React.FC<SwitchProps> = ({
    checked,
    onChange,
    label,
    description,
    disabled = false,
}) => {
    return (
        <label
            className={`flex items-center gap-3 cursor-pointer select-none group ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
            <button
                type="button"
                role="switch"
                aria-checked={checked}
                disabled={disabled}
                onClick={() => !disabled && onChange(!checked)}
                className={`
                    relative inline-flex h-6 w-11 flex-shrink-0 rounded-full
                    transition-colors duration-200 ease-in-out
                    focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:ring-offset-2
                    ${checked
                        ? 'bg-gradient-to-r from-purple-600 to-violet-500'
                        : 'bg-slate-200 group-hover:bg-slate-300'
                    }
                `}
            >
                <span
                    className={`
                        pointer-events-none inline-block h-5 w-5 transform rounded-full
                        bg-white shadow-md ring-0 transition-transform duration-200 ease-in-out
                        ${checked ? 'translate-x-[22px]' : 'translate-x-[2px]'}
                        mt-[2px]
                    `}
                />
            </button>
            {(label || description) && (
                <div className="flex flex-col">
                    {label && (
                        <span className="text-sm font-medium text-slate-700">
                            {label}
                        </span>
                    )}
                    {description && (
                        <span className="text-xs text-slate-400">
                            {description}
                        </span>
                    )}
                </div>
            )}
        </label>
    );
};
