export const isMac = navigator.userAgent.toLowerCase().includes('mac');

export function formatKey(key: string): string {
    if (!isMac) return key;

    switch (key.toLowerCase()) {
        case 'ctrl':
        case 'control':
            return '⌘';
        case 'alt':
            return 'Option';
        case 'windows':
        case 'win':
            return '⌘';
        default:
            return key;
    }
}

export function formatShortcut(shortcutString: string): string {
    if (!isMac) return shortcutString;

    // Replace common Windows modifier keys with their Mac equivalents.
    // E.g. "Ctrl+B" -> "Cmd+B", "Ctrl+Alt+Enter" -> "Cmd+Option+Enter"
    return shortcutString
        .replace(/\bCtrl\b/gi, '⌘')
        .replace(/\bControl\b/gi, '⌘')
        .replace(/\bAlt\b/gi, 'Option')
        .replace(/\bWin\b/gi, '⌘')
        .replace(/\bWindows\b/gi, '⌘');
}
