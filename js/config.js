// js/config.js (新規作成イメージ)
const BUS_COMPANIES = [
    {
        id: 'hiroden',
        name: '広電バス',
        staticPath: './info/hiroden/',
        realtimeUrl: 'https://hiroden-api.vercel.app/api/get-bus',
        active: true
    },
    {
        id: 'hirobus',
        name: '広島バス',
        staticPath: './info/hirobus/',
        realtimeUrl: 'https://hirobus-api.vercel.app/api/get-bus', // 仮
        active: true
    }
    // 今後ここに追加するだけで全機能が対応する
];
