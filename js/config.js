/**
 * js/config.js
 * 全体の設定管理
 */

// APIの基点
window.API_BASE_URL = "https://hiroden-api.vercel.app";

// アプリケーションの詳細設定
window.APP_CONFIG = {
    // 地図表示の設定
    MAP: {
        STOP_RADIUS: 6,         // バス停の見た目の半径
        STOP_WEIGHT: 15,        // バス停の当たり判定（透明な縁）の太さ
        BUS_ICON_SIZE: 20       // バスアイコンのサイズ
    },
    // UIの設定
    UI: {
        TIMETABLE_MAX_HEIGHT: "200px", // 時刻表のスクロール高さ
        BUS_REALTIME_INTERVAL: 15000   // バス位置更新の間隔（ミリ秒）
    },
    // バス会社ごとのデザイン設定
    COMPANIES: {
        hiroden: {
            color: '#ADFF2F', // 黄緑
            textColor: '#008000'
        },
        hirobus: {
            color: '#FF0000', // 赤
            textColor: '#e60012'
        }
    }
};

// 会社情報の定義
window.BUS_COMPANIES = [
    {
        id: 'hiroden',
        name: '広電バス',
        staticPath: './info/hiroden/',
        realtimeUrl: `${window.API_BASE_URL}/api/get-all-realtime?id=8`,
        active: true
    },
    {
        id: 'hirobus',
        name: '広島バス',
        staticPath: './info/hirobus/',
        realtimeUrl: `${window.API_BASE_URL}/api/get-all-realtime?id=9`,
        active: true
    }
];
