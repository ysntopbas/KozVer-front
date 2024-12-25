import React, { useState } from 'react';
import { Box, Button, TextField, Typography, Paper } from '@mui/material';
import styled from 'styled-components';
import { colors } from '../theme';

const LoginContainer = styled(Box)`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
    background-color: ${colors.main};
`;

const LoginCard = styled(Paper)`
    padding: 32px;
    border-radius: 8px;
    width: 100%;
    max-width: 400px;
    background-color: ${colors.sidebar};
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
`;

const Form = styled('form')`
    display: flex;
    flex-direction: column;
    gap: 20px;
    margin-top: 24px;
`;

const Login = ({ onJoin }) => {
    const [username, setUsername] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (username.trim()) {
            onJoin(username);
        }
    };

    return (
        <LoginContainer>
            <LoginCard>
                <Typography variant="h4" align="center" gutterBottom sx={{ color: 'white' }}>
                    Kozver Chat
                </Typography>
                <Typography variant="body1" align="center" sx={{ color: 'text.secondary' }}>
                    Kullanıcı adınızı girerek sohbete katılın
                </Typography>
                <Form onSubmit={handleSubmit}>
                    <TextField
                        label="Kullanıcı Adı"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                        fullWidth
                        variant="filled"
                        sx={{
                            '& .MuiFilledInput-root': {
                                backgroundColor: 'rgba(0, 0, 0, 0.1)',
                            }
                        }}
                    />
                    <Button 
                        variant="contained" 
                        type="submit" 
                        fullWidth
                        size="large"
                        sx={{
                            height: '48px',
                            fontSize: '16px',
                        }}
                    >
                        Katıl
                    </Button>
                </Form>
            </LoginCard>
        </LoginContainer>
    );
};

export default Login; 