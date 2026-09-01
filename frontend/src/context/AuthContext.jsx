import { createContext, useContext, useEffect, useState } from 'react';

const AuthContext = createContext(null);

function readStoredUser() {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch {
        // Corrupted/manually-edited localStorage shouldn't white-screen the app.
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        return null;
    }
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(readStoredUser);
    const [isAdmin, setIsAdmin] = useState(() => Boolean(localStorage.getItem('adminToken')));

    useEffect(() => {
        const onUnauthorized = (e) => {
            if (e.detail?.tokenKey === 'adminToken') setIsAdmin(false);
            else setUser(null);
        };
        window.addEventListener('auth:unauthorized', onUnauthorized);
        return () => window.removeEventListener('auth:unauthorized', onUnauthorized);
    }, []);

    const login = (token, userData) => {
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(userData));
        setUser(userData);
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
    };

    const adminLogin = (token) => {
        localStorage.setItem('adminToken', token);
        setIsAdmin(true);
    };

    const adminLogout = () => {
        localStorage.removeItem('adminToken');
        setIsAdmin(false);
    };

    return (
        <AuthContext.Provider value={{ user, setUser, login, logout, isAdmin, adminLogin, adminLogout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
    return ctx;
}
