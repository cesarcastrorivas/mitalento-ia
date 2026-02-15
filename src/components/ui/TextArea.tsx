import React, { useId } from 'react';

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    label?: string;
    error?: string;
    helperText?: string;
}

export const TextArea: React.FC<TextAreaProps> = ({
    label,
    error,
    helperText,
    className = '',
    id,
    ...props
}) => {
    const generatedId = useId();
    const textareaId = id || props.name || generatedId;

    return (
        <div className="flex flex-col gap-1.5 w-full">
            {label && (
                <label
                    htmlFor={textareaId}
                    className="text-sm font-medium text-slate-700 ml-1"
                >
                    {label}
                </label>
            )}
            <textarea
                id={textareaId}
                className={`
                    w-full px-4 py-3 rounded-xl
                    bg-slate-50 border border-slate-200
                    text-slate-900 placeholder:text-slate-400
                    focus:outline-none focus:bg-white focus:border-purple-400 focus:ring-2 focus:ring-purple-500/15
                    transition-all duration-200 resize-none text-sm
                    ${error ? 'border-red-300 bg-red-50 text-red-900 placeholder:text-red-300 focus:border-red-400 focus:ring-red-500/15' : ''}
                    ${className}
                `}
                {...props}
            />
            {helperText && !error && (
                <p className="text-xs text-slate-400 ml-1">{helperText}</p>
            )}
            {error && (
                <p className="text-xs text-red-500 ml-1">{error}</p>
            )}
        </div>
    );
};
