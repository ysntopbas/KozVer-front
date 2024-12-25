import { createTheme } from '@mui/material';

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#5865F2', // Discord'un mavi rengi
    },
    background: {
      default: '#36393f', // Discord'un arka plan rengi
      paper: '#2f3136', // Discord'un sidebar rengi
    },
    text: {
      primary: '#dcddde',
      secondary: '#8e9297',
    },
  },
});

export const colors = {
  sidebar: '#2f3136',
  main: '#36393f',
  hover: '#34373c',
  activeItem: '#42464D',
  divider: '#42464D',
  buttonHover: '#4752C4',
  green: '#3ba55d',
  red: '#ed4245',
}; 