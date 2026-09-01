import axios from 'axios';

const USER_API_BASE = import.meta.env.VITE_USER_API || 'http://localhost:4000/api';
const ADMIN_API_BASE = import.meta.env.VITE_ADMIN_API || 'http://localhost:5000/api';

export const USER_HOST = USER_API_BASE.replace(/\/api\/?$/, '');

function createApiClient(baseURL, tokenKey) {
    const client = axios.create({ baseURL });

    client.interceptors.request.use((config) => {
        const token = localStorage.getItem(tokenKey);
        if (token) config.headers.Authorization = `Bearer ${token}`;
        return config;
    });

    client.interceptors.response.use(
        (res) => res,
        (err) => {
            if (err.response?.status === 401) {
                localStorage.removeItem(tokenKey);
                if (tokenKey === 'token') localStorage.removeItem('user');
                window.dispatchEvent(new CustomEvent('auth:unauthorized', { detail: { tokenKey } }));
            }
            return Promise.reject(err);
        }
    );

    return client;
}

export const userApi = createApiClient(USER_API_BASE, 'token');
export const adminApi = createApiClient(ADMIN_API_BASE, 'adminToken');

// Every catch block in the app funnels through this so error shapes are handled once
// instead of each page guessing at err.response?.data?.message.
export function getErrorMessage(err, fallback = 'Something went wrong. Please try again.') {
    if (err.code === 'ERR_NETWORK') return 'Could not reach the server. Please check your connection and try again.';
    return err.response?.data?.message || fallback;
}
