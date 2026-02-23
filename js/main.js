/**
 * 画面の回転角に応じて、ヘッダーの位置と文字の向きを同期させる
 */
function syncHeaderWithOrientation() {
    const body = document.body;
    const header = document.querySelector('.header');
    const headerText = document.querySelector('.header-text');
    if (!header || !headerText) return;

    // モバイル端末（タッチ操作可能）かつ、横長画面の場合のみ実行
    const isMobile = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    const isLandscape = window.innerWidth > window.innerHeight;

    if (isMobile && isLandscape) {
        // --- スマホ横持ち時の特殊レイアウト ---
        let angle = 0;
        if (window.screen && window.screen.orientation) {
            angle = window.screen.orientation.angle;
        } else if (typeof window.orientation !== 'undefined') {
            angle = window.orientation;
        }

        body.style.flexDirection = "row"; 

        if (angle === 90) {
            // 時計回り（右端ヘッダー）
            header.style.order = "1";
            header.style.width = "40px";
            header.style.height = "100vh";
            headerText.style.transform = "rotate(90deg)";
        } else {
            // 反時計回り（左端ヘッダー）
            header.style.order = "0";
            header.style.width = "40px";
            header.style.height = "100vh";
            headerText.style.transform = "rotate(-90deg)";
        }
        header.style.lineHeight = "normal";
    } else {
        // --- PC または 縦持ち時の標準レイアウト ---
        body.style.flexDirection = "column";
        header.style.order = "";
        header.style.width = "100%";
        header.style.height = "50px";
        header.style.lineHeight = "50px";
        headerText.style.transform = "none";
    }

    // 地図のサイズ更新
    if (window.map) {
        window.map.invalidateSize();
    }
}

// 既存の load イベントに統合してバスの描画を邪魔しないようにする
window.addEventListener('load', async () => {
    // 1. レイアウトの初期設定
    syncHeaderWithOrientation();

    // 2. 現在地の開始
    if (typeof window.startGeolocation === 'function') {
        window.startGeolocation();
    }

    // 3. GTFS準備
    if (typeof window.prepareGtfsData === 'function') {
        await window.prepareGtfsData();
    }

    // 4. バスと地図の初期化
    if (window.map) {
        if (typeof loadAllStops === 'function') loadAllStops();
        
        if (typeof window.updateBusPositions === 'function') {
            window.updateBusPositions();
            setInterval(() => window.updateBusPositions(), 15000);
        }
    }
});

// 回転イベント
window.addEventListener('resize', syncHeaderWithOrientation);
window.addEventListener('orientationchange', syncHeaderWithOrientation);
