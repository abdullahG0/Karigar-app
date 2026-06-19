// Change this to your PC's local IP when testing on a physical device.
// Find it with: ipconfig (Windows) or ifconfig (Mac/Linux)
export const API_BASE_URL = 'http://192.168.1.21:3001/api';
export const SOCKET_URL   = API_BASE_URL.replace(/\/api\/?$/, '');
