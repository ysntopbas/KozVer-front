import { io } from 'socket.io-client';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'https://kozver-backend.onrender.com';

export const socket = io(SOCKET_URL, {
    withCredentials: true,
    transports: ['websocket'],
    upgrade: false,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    timeout: 10000,
});

socket.on('connect_error', (error) => {
    console.error('Socket bağlantı hatası:', error);
});

socket.on('connect_timeout', () => {
    console.error('Socket bağlantı zaman aşımı');
});

export default socket; 