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
        BUS_ICON_SIZE: 20,       // バスアイコンのサイズ
                
        // ★追加：デザイナーが自由にいじれるアイコンのHTMLひな形
        // {color} の部分が自動的に会社の色に置き換わります
        BUS_ICON_HTML: `<div style="
            width: 16px; 
            height: 16px; 
            background-color: {color}; 
            border: 2px solid #000000;
            border-radius: 2px;
            box-shadow: 1px 1px 3px rgba(0,0,0,0.4);
        "></div>`
    },
    // UIの設定
    UI: {
        TIMETABLE_MAX_HEIGHT: "250px", // 時刻表のスクロール高さ
        BUS_REALTIME_INTERVAL: 15000   // バス位置更新の間隔
    },
    // バス会社ごとのデザイン設定（共通バス停 shared を含む）
    COMPANIES: {
        hiroden: { color: '#008000', textColor: '#008000' },
        hirobus: { color: '#FF0000', textColor: '#FF0000' },
        hiroko: { color: '#e67f12', textColor: '#e67f12' },
        geiyo: { color: '#ff834d', textColor: '#ff834d' },
        bihoku: { color: '#0000FF', textColor: '#0000FF' },
        jrchugokubus: { color: '#0072ba', textColor: '#0072ba' },
        bonbus: { color: '#008000', textColor: '#008000' },
        forble: { color: '#dc143c', textColor: '#dc143c' },
        ohnoheart: { color: '#4169e1', textColor: '#4169e1' },
        kure_seikatsu: { color: '#83ff4d', textColor: '#83ff4d' },
        hatsukaichi_jishu: { color: '#ff00ff', textColor: '#ff00ff' },
        ato: { color: '#3c3eca', textColor: '#3c3eca' },
        onomichi: { color: '#128E49', textColor: '#128E49' },
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
    },
        {
        id: 'hiroko',
        name: '広島交通',
        staticPath: './info/hiroko/',
        realtimeUrl: `${window.API_BASE_URL}/api/get-all-realtime?id=10`,
        active: true,
        visible: true   // ★追加
    },
    {
        id: 'geiyo',
        name: '芸陽バス',
        staticPath: './info/geiyo/',
        realtimeUrl: `${window.API_BASE_URL}/api/get-all-realtime?id=11`,
        active: true,
        visible: true   // ★追加
    },
    {
        id: 'bihoku',
        name: '備北バス',
        staticPath: './info/bihoku/',
        realtimeUrl: `${window.API_BASE_URL}/api/get-all-realtime?id=12`,
        active: true,
        visible: true   // ★追加
    },
    {
        id: 'jrchugokubus',
        name: 'JRバス',
        staticPath: './info/jrchugokubus/',
        realtimeUrl: `${window.API_BASE_URL}/api/get-all-realtime?id=15`,
        active: true,
        visible: true   // ★追加
    },
    {
        id: 'bonbus',
        name: 'ボンバス',
        staticPath: './info/bonbus/',
        realtimeUrl: `${window.API_BASE_URL}/api/get-all-realtime?id=13`,
        active: true,
        visible: true   // ★追加
    },
    {
        id: 'forble',
        name: 'フォーブル',
        staticPath: './info/forble/',
        realtimeUrl: `${window.API_BASE_URL}/api/get-all-realtime?id=14`,
        active: true,
        visible: true   // ★追加
    },
    {
        id: 'ohnoheart',
        name: 'おおのハートバス',
        staticPath: './info/ohnoheart/',
        realtimeUrl: `${window.API_BASE_URL}/api/get-all-realtime?id=17`,
        active: true,
        visible: true   // ★追加
    },
    {
        id: 'kure_seikatsu',
        name: '呉生活バス',
        staticPath: './info/kure_seikatsu/',
        realtimeUrl: `${window.API_BASE_URL}/api/get-all-realtime?id=18`,
        active: true,
        visible: true   // ★追加
    },
    {
        id: 'hatsukaichi_jishu',
        name: '廿日市自主運行バス',
        staticPath: './info/hatsukaichi_jishu/',
        realtimeUrl: `${window.API_BASE_URL}/api/get-all-realtime?id=19`,
        active: true,
        visible: true   // ★追加
    },
    {
        id: 'ato',
        name: '朝日交通',
        staticPath: './info/ato/',
        realtimeUrl: `${window.API_BASE_URL}/api/get-all-realtime?id=54`,
        active: true,
        visible: true   // ★追加
    },
    {
        id: 'onomichi',
        name: 'おのみちバス',
        staticPath: './info/onomichi/',
        realtimeUrl: `${window.API_BASE_URL}/api/get-all-realtime?id=53`,
        active: true,
        visible: true   // ★追加
    }
];

console.log("✅ config.js ロード完了");
