import React, { useState } from 'react';
import { io } from 'socket.io-client';
import { SnackbarProvider } from 'notistack';
import { ThemeProvider } from '@mui/material';
import { theme } from './theme';
import Login from './components/Login';
import ChatRoom from './components/ChatRoom';

const SOCKET_SERVER = process.env.REACT_APP_SOCKET_SERVER || 'https://kozver-backend.onrender.com';

const socket = io(SOCKET_SERVER, {
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    transports: ['websocket', 'polling']
});

function App() {
    const [username, setUsername] = useState('');

    const handleJoin = (name) => {
        if (name.length < 3 || name.length > 20) {
            alert('Kullanıcı adı 3-20 karakter arasında olmalıdır!');
            return;
        }
        if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
            alert('Kullanıcı adı sadece harf, rakam, alt çizgi ve tire içerebilir!');
            return;
        }
        setUsername(name);
    };

    const handleLeave = () => {
        setUsername('');
    };

    return (
        <ThemeProvider theme={theme}>
            <SnackbarProvider 
                maxSnack={3} 
                anchorOrigin={{ 
                    vertical: 'top', 
                    horizontal: 'right' 
                }}
                autoHideDuration={3000}
            >
                {!username ? (
                    <Login onJoin={handleJoin} />
                ) : (
                    <ChatRoom 
                        socket={socket} 
                        username={username} 
                        onLeave={handleLeave}
                    />
                )}
            </SnackbarProvider>
        </ThemeProvider>
    );
}

export default App;
