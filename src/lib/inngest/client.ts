import { Inngest } from 'inngest';

// Create Inngest client
export const inngest = new Inngest({
    id: '9jarooms',
    name: '9jaRooms',
    isDev: process.env.NODE_ENV !== 'production',
});
