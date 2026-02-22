const BUS_COMPANIES = [
    {
        id: 'hiroden',
        name: '広電バス',
        staticPath: './info/hiroden/',
        // id=8 を指定
        realtimeUrl: 'https://hiroden-api.vercel.app/api/get-bus?id=8',
        active: true
    },
    {
        id: 'hirobus',
        name: '広島バス',
        staticPath: './info/hirobus/',
        // id=9 を指定
        realtimeUrl: 'https://hiroden-api.vercel.app/api/get-bus?id=9',
        active: true
    }
];
