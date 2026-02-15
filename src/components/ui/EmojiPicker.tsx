import React from 'react';

const EMOJI_OPTIONS = [
    '🎓', '📚', '🎯', '💼', '🚀', '💡', '🏆', '📊',
    '🎬', '🎨', '💰', '🏠', '🤝', '📱', '⚡', '🔑',
    '🌟', '📈', '🧠', '🎤', '💎', '🛠️', '📋', '🔥',
];

interface EmojiPickerProps {
    value: string;
    onChange: (emoji: string) => void;
    label?: string;
}

export const EmojiPicker: React.FC<EmojiPickerProps> = ({
    value,
    onChange,
    label,
}) => {
    return (
        <div className="flex flex-col gap-2">
            {label && (
                <label className="text-sm font-medium text-slate-700 ml-1">
                    {label}
                </label>
            )}
            <div className="grid grid-cols-8 gap-1.5 p-3 bg-slate-50 rounded-xl border border-slate-200">
                {EMOJI_OPTIONS.map((emoji) => (
                    <button
                        key={emoji}
                        type="button"
                        onClick={() => onChange(emoji)}
                        className={`
                            w-9 h-9 flex items-center justify-center text-xl rounded-lg
                            transition-all duration-150 hover:scale-110
                            ${value === emoji
                                ? 'bg-purple-100 ring-2 ring-purple-500 shadow-sm scale-110'
                                : 'hover:bg-white hover:shadow-sm'
                            }
                        `}
                    >
                        {emoji}
                    </button>
                ))}
            </div>
        </div>
    );
};
