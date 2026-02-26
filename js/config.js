/**
 * js/config.js
 * 全体の設定管理
 */

// 1. APIの基点URL
window.API_BASE_URL = "https://hiroden-api.vercel.app";

// 2. アプリケーションの詳細設定
window.APP_CONFIG = {
    // 地図表示の設定
    MAP: {
        STOP_RADIUS: 6,         // バス停の見た目の半径
        STOP_WEIGHT: 15,        // バス停の当たり判定の太さ
        BUS_ICON_SIZE: 20       // バスアイコンのサイズ
    },
    // UIの設定
    UI: {
        TIMETABLE_MAX_HEIGHT: "250px", // 時刻表のスクロール高さ
        BUS_REALTIME_INTERVAL: 15000   // バス位置更新の間隔
    },
    // バス会社ごとのデザイン設定（共通バス停 shared を含む）
    COMPANIES: {
        hiroden: { color: '#ADFF2F', textColor: '#008000' },
        hirobus: { color: '#FF0000', textColor: '#e60012' },
        shared:  { color: '#A020F0', textColor: '#800080' }
    }
};

// 3. 会社情報の定義
window.BUS_COMPANIES =[
    {
        id: 'hiroden',
        name: '広電バス',
        staticPath: './info/hiroden/',
        realtimeUrl: `${window.API_BASE_URL}/api/get-all-realtime?id=8`,
        active: true,   // 起動時にデータを読み込むか
        visible: true   // 地図上に表示するか（チェックボックスと連動）★追加
    },
    {
        id: 'hirobus',
        name: '広島バス',
        staticPath: './info/hirobus/',
        realtimeUrl: `${window.API_BASE_URL}/api/get-all-realtime?id=9`,
        active: true,
        visible: true   // ★追加
    }
];

console.log("✅ config.js ロード完了");
