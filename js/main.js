/**
 * スマホの回転方向（物理的位置）に合わせてヘッダー位置と文字向きを同期
 */
function syncHeaderWithOrientation() {
    const body = document.body;
    const header = document.querySelector('.header');
    const headerText = document.querySelector('.header-text');
    if (!header || !headerText) return;

    const width = window.innerWidth;
    const height = window.innerHeight;
    const isLandscape = width > height;
    
    // PC判定（1024px以上）
    const isPC = width >= 1024;

    if (isLandscape && !isPC) {
        // --- スマホ横持ち ---
        let angle = 0;
        if (window.screen && window.screen.orientation) {
            angle = window.screen.orientation.angle;
        } else if (typeof window.orientation !== 'undefined') {
            angle = window.orientation;
        }

        header.style.width = "40px";
        header.style.height = "100vh";
        header.style.lineHeight = "normal";

        // 物理的な位置関係を「flex-direction」で直感的に制御
        if (angle === 90) {
            // 【時計回り】上(ヘッダー)は「右」にくる
            // row-reverse にすると、要素の並びが [地図 | ヘッダー] となり、右端に寄る
            body.style.flexDirection = "row-reverse";
            headerText.style.transform = "rotate(90deg)";
            header.style.borderLeft = "1px solid #ddd";
            header.style.borderRight = "none";
        } else {
            // 【反時計回り】上(ヘッダー)は「左」にくる
            // row にすると、要素の並びが [ヘッダー | 地図] となり、左端に寄る
            body.style.flexDirection = "row";
            headerText.style.transform = "rotate(-90deg)";
            header.style.borderRight = "1px solid #ddd";
            header.style.borderLeft = "none";
        }
    } else {
        // --- PC または スマホ縦持ち ---
        body.style.flexDirection = "column";
        header.style.order = "";
        header.style.width = "100%";
        header.style.height = "50px";
        header.style.lineHeight = "50px";
        header.style.borderRight = "none";
        header.style.borderLeft = "none";
        headerText.style.transform = "none";
    }

    // 地図のサイズ更新（PCで真っ白にならないよう、不必要な再描画を避ける）
    if (window.map) {
        window.map.invalidateSize();
    }
}

// 起動・回転・リサイズすべてのイベント
window.addEventListener('load', async () => {
    // 1. まずデータを読み込む（これが最優先）
    if (typeof window.prepareGtfsData === 'function') {
        await window.prepareGtfsData();
    }

    // 2. バスの更新を開始
    if (window.map && typeof window.updateBusPositions === 'function') {
        window.updateBusPositions();
        setInterval(() => window.updateBusPositions(), 15000);
    }

    // 3. 最後にレイアウトを調整
    syncHeaderWithOrientation();
});

window.addEventListener('resize', syncHeaderWithOrientation);
window.addEventListener('orientationchange', syncHeaderWithOrientation);
