import { createContext, useCallback, useContext, useRef, useState } from 'react';

const ToastContext = createContext(null);

let nextId = 1;

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);
    const timers = useRef(new Map());

    const dismiss = useCallback((id) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
        clearTimeout(timers.current.get(id));
        timers.current.delete(id);
    }, []);

    const push = useCallback((message, type) => {
        const id = nextId++;
        setToasts((prev) => [...prev, { id, message, type }]);
        timers.current.set(id, setTimeout(() => dismiss(id), 5000));
    }, [dismiss]);

    const toast = {
        success: (message) => push(message, 'success'),
        error: (message) => push(message, 'error'),
        info: (message) => push(message, 'info')
    };

    return (
        <ToastContext.Provider value={toast}>
            {children}
            <div className="toast-stack" role="status" aria-live="polite">
                {toasts.map((t) => (
                    <div key={t.id} className={`toast toast-${t.type}`}>
                        <span>{t.message}</span>
                        <button className="toast-dismiss" aria-label="Dismiss" onClick={() => dismiss(t.id)}>×</button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}

export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used within a ToastProvider');
    return ctx;
}
