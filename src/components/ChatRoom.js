import React, { useEffect, useRef, useState } from 'react';
import { Box, Button, Typography, List, ListItem, ListItemText, LinearProgress } from '@mui/material';
import styled from 'styled-components';
import Peer from 'simple-peer';
import { colors } from '../theme';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import ScreenShareIcon from '@mui/icons-material/ScreenShare';
import StopScreenShareIcon from '@mui/icons-material/StopScreenShare';
import LogoutIcon from '@mui/icons-material/Logout';
import PersonIcon from '@mui/icons-material/Person';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import { IconButton, Menu, MenuItem } from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { useSnackbar } from 'notistack';

const RoomContainer = styled(Box)`
  display: flex;
  height: 100vh;
  background-color: ${colors.main};
`;

const Sidebar = styled(Box)`
  width: 240px;
  background-color: ${colors.sidebar};
  color: white;
  display: flex;
  flex-direction: column;
  border-right: 1px solid ${colors.divider};
`;

const SidebarHeader = styled(Box)`
  padding: 20px;
  border-bottom: 1px solid ${colors.divider};
`;

const UsersList = styled(List)`
  flex: 1;
  overflow-y: auto;
  padding: 8px;

  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: ${colors.divider};
    border-radius: 4px;
  }
`;

const UserListItem = styled(ListItem)`
  border-radius: 4px;
  margin: 2px 0;
  
  &:hover {
    background-color: ${colors.hover};
  }
`;

const ControlsContainer = styled(Box)`
  padding: 16px;
  background-color: ${colors.sidebar};
  border-top: 1px solid ${colors.divider};
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const ControlButton = styled(Button)`
  width: 100%;
  justify-content: flex-start;
  padding: 10px 16px;
  text-transform: none;
  border-radius: 4px;
  
  &:hover {
    background-color: ${colors.buttonHover};
  }

  & .MuiButton-startIcon {
    margin-right: 12px;
  }
`;

const MainContent = styled(Box)`
  flex: 1;
  padding: 20px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const ScreenContainer = styled(Box)`
  flex: 1;
  background-color: ${colors.main};
  border-radius: 8px;
  overflow: hidden;

  video {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
`;

const AudioIndicator = styled(Box).attrs(props => ({
  style: {
    height: `${Math.min(props.level * 100, 100)}%`
  }
}))`
  position: absolute;
  right: 45px;
  width: 20px;
  background-color: ${colors.green};
  transition: height 0.1s ease;
  border-radius: 2px;
`;

const ConnectionStatus = styled('span').attrs(props => ({
  style: {
    color: props.status === 'connecting' ? '#faa61a' :
          props.status === 'connected' ? colors.green :
          props.status === 'error' ? colors.red :
          'text.secondary'
  }
}))`
  font-size: 12px;
  margin-top: 4px;
  display: block;
`;

const ChatRoom = ({ socket, username, onLeave }) => {
    const [users, setUsers] = useState([]);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [peers, setPeers] = useState({});
    const audioElements = useRef({});
    const peersRef = useRef({});
    const audioStream = useRef(null);
    const screenStream = useRef(null);
    const [audioState, setAudioState] = useState('MUTED');
    const [userAudioStates, setUserAudioStates] = useState({});
    const { enqueueSnackbar } = useSnackbar();
    const [audioConnections, setAudioConnections] = useState(new Set());
    const [audioLevel, setAudioLevel] = useState(0);
    const [connectionStatus, setConnectionStatus] = useState('disconnected');
    const audioContext = useRef(null);
    const analyser = useRef(null);
    const dataArray = useRef(new Uint8Array(128));

    const updateAudioState = (newState) => {
        setAudioState(newState);
        socket.emit('audio-state-change', {
            username,
            state: newState
        });
    };

    useEffect(() => {
        socket.on('audio-state-update', ({ username, state }) => {
            setUserAudioStates(prev => ({
                ...prev,
                [username]: state
            }));
        });

        return () => {
            if (audioStream.current) {
                audioStream.current.getTracks().forEach(track => track.stop());
            }
            if (screenStream.current) {
                screenStream.current.getTracks().forEach(track => track.stop());
            }
            socket.off('room-users');
            socket.off('voice-signal');
            socket.off('screen-sharing-signal');
            socket.off('audio-state-update');
        };
    }, [socket, username]);

    useEffect(() => {
        socket.on('voice-signal', async ({ from, signal, type }) => {
            console.log(`Ses sinyali alındı: ${from}, tip: ${type}`);
            try {
                let peer = peersRef.current[from];
                
                if (!peer) {
                    console.log(`${from} için yeni peer oluşturuluyor`);
                    peer = createAudioPeer(from, audioStream.current, false);
                    peersRef.current[from] = peer;
                }

                if (type === 'offer' && peer.initiator) {
                    console.log(`Çakışma tespit edildi, peer yeniden oluşturuluyor`);
                    peer.destroy();
                    peer = createAudioPeer(from, audioStream.current, false);
                    peersRef.current[from] = peer;
                }

                await peer.signal(signal);
            } catch (error) {
                console.error(`Sinyal işleme hatası (${from}):`, error);
            }
        });

        return () => socket.off('voice-signal');
    }, []);

    const cleanupAudioConnections = () => {
        if (audioStream.current) {
            audioStream.current.getTracks().forEach(track => track.stop());
            audioStream.current = null;
        }
        Object.values(peersRef.current).forEach(peer => {
            if (peer && peer.destroy) peer.destroy();
        });
        peersRef.current = {};
        setAudioConnections(new Set());
    };

    const createAudioPeer = (targetUser, stream, isInitiator) => {
        console.log(`${targetUser} için yeni peer oluşturuluyor (initiator: ${isInitiator})`);
        
        // Mevcut peer'ı temizle
        if (peersRef.current[targetUser]) {
            console.log(`${targetUser} için mevcut peer temizleniyor`);
            peersRef.current[targetUser].destroy();
            delete peersRef.current[targetUser];
        }

        const peer = new Peer({
            initiator: isInitiator,
            trickle: true, // ICE adaylarının kademeli olarak gönderilmesine izin ver
            stream: stream,
            config: {
                iceTransportPolicy: 'relay', // Sadece TURN sunucularını kullan
                sdpSemantics: 'unified-plan',
                iceServers: [
                    {
                        urls: "stun:stun.relay.metered.ca:80",
                    },
                    {
                        urls: "turn:eu-central.relay.metered.ca:80",
                        username: String(process.env.REACT_APP_TURN_USERNAME),
                        credential: String(process.env.REACT_APP_TURN_CREDENTIAL),
                    },
                    {
                        urls: "turn:eu-central.relay.metered.ca:80?transport=tcp",
                        username: String(process.env.REACT_APP_TURN_USERNAME),
                        credential: String(process.env.REACT_APP_TURN_CREDENTIAL),
                    },
                    {
                        urls: "turn:eu-central.relay.metered.ca:443",
                        username: String(process.env.REACT_APP_TURN_USERNAME),
                        credential: String(process.env.REACT_APP_TURN_CREDENTIAL),
                    },
                    {
                        urls: "turns:eu-central.relay.metered.ca:443?transport=tcp",
                        username: String(process.env.REACT_APP_TURN_USERNAME),
                        credential: String(process.env.REACT_APP_TURN_CREDENTIAL),
                    }
                ]
            }
        });

        // ICE bağlantı durumu değişikliklerini izle
        peer.on('iceStateChange', (state) => {
            console.log(`${targetUser} ICE durumu: ${state}`);
            if (state === 'disconnected' || state === 'failed') {
                console.log(`${targetUser} ile ICE bağlantısı başarısız, yeniden deneniyor`);
                // Peer'ı yeniden oluştur
                peer.destroy();
                const newPeer = createAudioPeer(targetUser, stream, true);
                peersRef.current[targetUser] = newPeer;
            }
        });

        peer.on('connect', () => {
            console.log(`${targetUser} ile bağlantı kuruldu`);
            setConnectionStatus('connected');
        });

        peer.on('signal', signal => {
            console.log(`${targetUser}'a sinyal gönderiliyor:`, signal.type);
            socket.emit('voice-signal', {
                to: targetUser,
                signal,
                type: signal.type
            });
        });

        peer.on('stream', remoteStream => {
            console.log(`${targetUser}'dan ses akışı alındı`);
            if (!audioElements.current[targetUser]) {
                const audio = new Audio();
                audio.srcObject = remoteStream;
                audio.autoplay = true;
                audioElements.current[targetUser] = audio;
            }
        });

        peer.on('error', error => {
            console.error(`${targetUser} peer hatası:`, error.message);
            // Sadece kritik hatalarda yeniden bağlan
            if (error.code === 'ERR_CONNECTION_FAILURE') {
                peer.destroy();
                const newPeer = createAudioPeer(targetUser, stream, true);
                peersRef.current[targetUser] = newPeer;
            }
        });

        peer.on('close', () => {
            console.log(`${targetUser} ile bağlantı kapandı`);
            if (audioElements.current[targetUser]) {
                audioElements.current[targetUser].srcObject = null;
                delete audioElements.current[targetUser];
            }
        });

        return peer;
    };

    const analyzeMicrophoneLevel = () => {
        if (!analyser.current) return;
        
        analyser.current.getByteFrequencyData(dataArray.current);
        const average = dataArray.current.reduce((a, b) => a + b) / dataArray.current.length;
        setAudioLevel(average / 255); // 0-1 arası normalize edilmiş değer
        
        requestAnimationFrame(analyzeMicrophoneLevel);
    };

    const handleMicrophoneOn = async () => {
        try {
            setConnectionStatus('connecting');
            if (!audioStream.current) {
                audioStream.current = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true
                    }
                });
            }

            // Tüm ses track'lerini etkinleştir
            audioStream.current.getAudioTracks().forEach(track => {
                track.enabled = true;
            });

            // Mevcut bağlantıları yenile
            Object.keys(peersRef.current).forEach(user => {
                peersRef.current[user].destroy();
                const newPeer = createAudioPeer(user, audioStream.current, true);
                peersRef.current[user] = newPeer;
            });

            updateAudioState('ACTIVE');
            enqueueSnackbar('Mikrofon açıldı', { variant: 'success' });

            if (!audioContext.current) {
                audioContext.current = new (window.AudioContext || window.webkitAudioContext)();
                analyser.current = audioContext.current.createAnalyser();
                const source = audioContext.current.createMediaStreamSource(audioStream.current);
                source.connect(analyser.current);
                analyzeMicrophoneLevel();
            }

            setConnectionStatus('connected');
        } catch (error) {
            setConnectionStatus('error');
            console.error('Mikrofon açma hatası:', error);
            enqueueSnackbar('Mikrofon açılamadı', { variant: 'error' });
        }
    };

    const handleMicrophoneOff = () => {
        if (audioStream.current) {
            // Sadece track'leri devre dışı bırak, bağlantıları kaldırma
            audioStream.current.getAudioTracks().forEach(track => {
                track.enabled = false;
            });
        }
        updateAudioState('MUTED');
        enqueueSnackbar('Mikrofon kapatıldı', { variant: 'info' });
    };

    const handleSilence = () => {
        if (audioStream.current) {
            // Ses track'lerini devre dışı bırak
            audioStream.current.getAudioTracks().forEach(track => {
                track.enabled = false;
            });
        }
        updateAudioState('SILENCED');
        enqueueSnackbar('Ses susturuldu', { variant: 'info' });
    };

    const handlePeerError = (userId) => {
        if (peersRef.current[userId]) {
            peersRef.current[userId].destroy();
            delete peersRef.current[userId];
        }
        setAudioConnections(prev => {
            const newSet = new Set(prev);
            newSet.delete(userId);
            return newSet;
        });
        enqueueSnackbar(`${userId} ile bağlantı hatası`, { variant: 'error' });
    };

    const handlePeerClose = (userId) => {
        if (peersRef.current[userId]) {
            delete peersRef.current[userId];
        }
        setAudioConnections(prev => {
            const newSet = new Set(prev);
            newSet.delete(userId);
            return newSet;
        });
    };

    const getAudioIcon = (user) => {
        const state = user === username ? audioState : userAudioStates[user];
        switch (state) {
            case 'ACTIVE':
                return <MicIcon sx={{ color: colors.green }} />;
            case 'MUTED':
                return <MicOffIcon sx={{ color: colors.red }} />;
            case 'SILENCED':
                return <VolumeOffIcon sx={{ color: colors.red }} />;
            default:
                return null;
        }
    };

    useEffect(() => {
        socket.emit('join-room', username);

        socket.on('room-users', (roomUsers) => {
            setUsers(roomUsers);
        });

        socket.on('user-joined', ({ username: newUser }) => {
            console.log(`${newUser} odaya katıldı`);
        });

        socket.on('user-left', ({ username: leftUser }) => {
            console.log(`${leftUser} odadan ayrıldı`);
            if (peersRef.current[leftUser]) {
                peersRef.current[leftUser].destroy();
                delete peersRef.current[leftUser];
                setPeers(prev => {
                    const newPeers = { ...prev };
                    delete newPeers[leftUser];
                    return newPeers;
                });
            }
        });

        socket.on('screen-signal', async ({ from, signal }) => {
            try {
                await handleScreenSignal(from, signal);
            } catch (error) {
                console.error('Ekran paylaşımı sinyali işleme hatası:', error);
                enqueueSnackbar('Ekran paylaşımı bağlantısı kurulamadı', { variant: 'error' });
            }
        });

        return () => {
            Object.values(peersRef.current).forEach(peer => {
                if (peer && peer.destroy) peer.destroy();
            });
            socket.off('room-users');
            socket.off('voice-signal');
            socket.off('screen-signal');
        };
    }, [socket, username]);

    const handleScreenSignal = async (from, incomingSignal) => {
        try {
            let peer;
            if (!peersRef.current[`screen-${from}`]) {
                peer = new Peer({
                    initiator: false,
                    trickle: false,
                    config: {
                        iceServers: [
                            {
                                urls: "stun:stun.relay.metered.ca:80",
                            },
                            {
                                urls: "turn:eu-central.relay.metered.ca:80",
                                username: String(process.env.REACT_APP_TURN_USERNAME),
                                credential: String(process.env.REACT_APP_TURN_CREDENTIAL),
                            },
                            {
                                urls: "turn:eu-central.relay.metered.ca:80?transport=tcp",
                                username: String(process.env.REACT_APP_TURN_USERNAME),
                                credential: String(process.env.REACT_APP_TURN_CREDENTIAL),
                            },
                            {
                                urls: "turn:eu-central.relay.metered.ca:443",
                                username: String(process.env.REACT_APP_TURN_USERNAME),
                                credential: String(process.env.REACT_APP_TURN_CREDENTIAL),
                            },
                            {
                                urls: "turns:eu-central.relay.metered.ca:443?transport=tcp",
                                username: String(process.env.REACT_APP_TURN_USERNAME),
                                credential: String(process.env.REACT_APP_TURN_CREDENTIAL),
                            }
                        ]
                    }
                });

                peer.on('signal', signal => {
                    socket.emit('screen-signal', { to: from, signal });
                });

                peer.on('stream', stream => {
                    const screenContainer = document.getElementById('screen-sharing-container');
                    if (screenContainer) {
                        const video = document.createElement('video');
                        video.srcObject = stream;
                        video.style.width = '100%';
                        video.style.height = '100%';
                        video.autoplay = true;
                        video.playsInline = true;
                        screenContainer.innerHTML = '';
                        screenContainer.appendChild(video);
                    }
                });

                peer.on('error', error => {
                    console.error('Ekran paylaşımı peer hatası:', error);
                    enqueueSnackbar('Ekran paylaşımı bağlantı hatası', { variant: 'error' });
                });

                peersRef.current[`screen-${from}`] = peer;
            }

            await peersRef.current[`screen-${from}`].signal(incomingSignal);
        } catch (error) {
            console.error('Ekran paylaşımı sinyali işleme hatası:', error);
            enqueueSnackbar('Ekran paylaşımı bağlantısı kurulamadı', { variant: 'error' });
        }
    };

    const handleScreenShare = async () => {
        try {
            if (!isScreenSharing) {
                const stream = await navigator.mediaDevices.getDisplayMedia({
                    video: {
                        cursor: "always",
                        width: { ideal: 1920 },
                        height: { ideal: 1080 },
                        frameRate: { ideal: 30 }
                    },
                    audio: false
                });

                screenStream.current = stream;

                users.forEach(user => {
                    if (user !== username) {
                        const peer = new Peer({
                            initiator: true,
                            trickle: false,
                            stream,
                            config: {
                                iceServers: [
                                    { urls: 'stun:stun.l.google.com:19302' },
                                    { urls: 'stun:global.stun.twilio.com:3478' }
                                ]
                            }
                        });

                        peer.on('signal', signal => {
                            socket.emit('screen-signal', { to: user, signal });
                        });

                        peer.on('error', error => {
                            console.error('Ekran paylaşımı peer hatası:', error);
                            enqueueSnackbar('Ekran paylaşımı bağlantı hatası', { variant: 'error' });
                        });

                        peersRef.current[`screen-${user}`] = peer;
                    }
                });

                stream.getVideoTracks()[0].onended = () => {
                    handleScreenShareStop();
                };

                setIsScreenSharing(true);
                enqueueSnackbar('Ekran paylaşımı başlatıldı', { variant: 'success' });
            } else {
                handleScreenShareStop();
            }
        } catch (error) {
            console.error('Ekran paylaşımı hatası:', error);
            enqueueSnackbar('Ekran paylaşımı başlatılamadı', { variant: 'error' });
            setIsScreenSharing(false);
        }
    };

    const handleScreenShareStop = () => {
        if (screenStream.current) {
            screenStream.current.getTracks().forEach(track => track.stop());
            screenStream.current = null;
        }

        Object.keys(peersRef.current).forEach(key => {
            if (key.startsWith('screen-')) {
                peersRef.current[key].destroy();
                delete peersRef.current[key];
            }
        });

        const screenContainer = document.getElementById('screen-sharing-container');
        if (screenContainer) screenContainer.innerHTML = '';
        
        setIsScreenSharing(false);
        enqueueSnackbar('Ekran paylaşımı durduruldu', { variant: 'info' });
    };

    // Odaya katılma işleminde ses bağlantılarını otomatik kur
    useEffect(() => {
        const initializeAudioStream = async () => {
            try {
                audioStream.current = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true
                    }
                });

                // Başlangıçta ses track'lerini devre dışı bırak
                audioStream.current.getAudioTracks().forEach(track => {
                    track.enabled = false;
                });

                // Mevcut kullanıcılarla bağlantı kur
                users.forEach(user => {
                    if (user !== username && !peersRef.current[user]) {
                        const peer = createAudioPeer(user, audioStream.current, true);
                        peersRef.current[user] = peer;
                    }
                });
            } catch (error) {
                console.error('Ses akışı başlatma hatası:', error);
                enqueueSnackbar('Ses sistemi başlatılamadı', { variant: 'error' });
            }
        };

        initializeAudioStream();

        return () => {
            if (audioStream.current) {
                audioStream.current.getTracks().forEach(track => track.stop());
            }
        };
    }, [users, username]);

    // Ses durumu değişikliğini izle
    useEffect(() => {
        socket.on('audio-state-change', ({ username: user, state }) => {
            setUserAudioStates(prev => ({
                ...prev,
                [user]: state
            }));
        });

        return () => {
            socket.off('audio-state-change');
        };
    }, []);

    return (
        <RoomContainer>
            <Sidebar>
                <SidebarHeader>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        Kozver Chat
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        {users.length} kullanıcı online
                    </Typography>
                </SidebarHeader>
                
                <UsersList>
                    {users.map((user, index) => (
                        <UserListItem key={index}>
                            <PersonIcon 
                                sx={{ 
                                    mr: 1,
                                    color: (user === username && audioLevel > 0.1) ? colors.green : 
                                          (user === username ? audioState : userAudioStates[user]) === 'ACTIVE' 
                                            ? colors.green 
                                            : 'text.secondary'
                                }} 
                            />
                            <ListItemText 
                                primary={user} 
                                secondary={user === username && (
                                    <ConnectionStatus status={connectionStatus}>
                                        {connectionStatus === 'connecting' && 'Bağlanıyor...'}
                                        {connectionStatus === 'connected' && 'Bağlandı'}
                                        {connectionStatus === 'error' && 'Bağlantı hatası'}
                                    </ConnectionStatus>
                                )}
                                primaryTypographyProps={{
                                    sx: { fontWeight: user === username ? 600 : 400 }
                                }}
                            />
                            {user === username && audioState === 'ACTIVE' && (
                                <AudioIndicator level={audioLevel} />
                            )}
                            {getAudioIcon(user)}
                        </UserListItem>
                    ))}
                </UsersList>

                <ControlsContainer>
                    <ControlButton
                        variant="contained"
                        color="primary"
                        onClick={handleMicrophoneOn}
                        startIcon={<MicIcon />}
                        disabled={audioState === 'ACTIVE'}
                        sx={{
                            backgroundColor: audioState === 'ACTIVE' ? colors.green : undefined,
                            '&:hover': {
                                backgroundColor: audioState === 'ACTIVE' ? colors.green : undefined,
                            }
                        }}
                    >
                        Mikrofonu Aç
                    </ControlButton>

                    <ControlButton
                        variant="contained"
                        color="error"
                        onClick={handleMicrophoneOff}
                        startIcon={<MicOffIcon />}
                        disabled={audioState === 'MUTED'}
                    >
                        Mikrofonu Kapat
                    </ControlButton>

                    <ControlButton
                        variant="contained"
                        color="error"
                        onClick={handleSilence}
                        startIcon={<VolumeOffIcon />}
                        disabled={audioState === 'SILENCED'}
                    >
                        Sustur
                    </ControlButton>
                    
                    <ControlButton
                        variant="contained"
                        color={isScreenSharing ? "error" : "primary"}
                        onClick={handleScreenShare}
                        startIcon={isScreenSharing ? <StopScreenShareIcon /> : <ScreenShareIcon />}
                    >
                        {isScreenSharing ? "Paylaşımı Durdur" : "Ekran Paylaş"}
                    </ControlButton>

                    <ControlButton
                        variant="contained"
                        color="error"
                        onClick={onLeave}
                        startIcon={<LogoutIcon />}
                    >
                        Odadan Ayrıl
                    </ControlButton>
                </ControlsContainer>
            </Sidebar>

            <MainContent>
                <ScreenContainer id="screen-sharing-container" />
            </MainContent>
        </RoomContainer>
    );
};

export default ChatRoom; 