/**
 * スマホの回転方向と位置を物理法則に合わせる
 */
function syncHeaderWithOrientation() {
    const body = document.body;
    const header = document.querySelector('.header');
    const headerText = document.querySelector('.header-text');
    const mapContainer = document.getElementById('map');
    if (!header || !headerText || !mapContainer) return;

    const width = window.innerWidth;
    const height = window.innerHeight;

    // PC（幅1024以上）または縦持ちは常に「上ヘッダー」
    if (width >= 1024 || height > width) {
        body.style.flexDirection = "column";
        header.style.width = "100%";
        header.style.height = "50px";
        header.style.lineHeight = "50px";
        headerText.style.transform = "none";
        
        // 地図の幅をリセット
        mapContainer.style.width = "100%";
    } else {
        // --- スマホ横持ち ---
        let angle = window.orientation || (window.screen.orientation && window.screen.orientation.angle) || 0;

        header.style.width = "40px";
        header.style.height = "100vh";
        header.style.lineHeight = "normal";

        // 地図の幅を「ヘッダー分を引いた残り」に明示的に固定
        mapContainer.style.width = "calc(100vw - 40px)";

        // 【最終修正：物理配置】
        // スマホを時計回りに倒すと、ブラウザは「90度」を返しますが、
        // あなたの端末ではこれが「左」を指している可能性があるため、逆転させます。
        if (angle === 90) {
            body.style.flexDirection = "row"; // ヘッダーを左配置
            headerText.style.transform = "rotate(-90deg)";
            header.style.borderRight = "1px solid #ddd";
            header.style.borderLeft = "none";
        } else {
            body.style.flexDirection = "row-reverse"; // ヘッダーを右配置
            headerText.style.transform = "rotate(90deg)";
            header.style.borderLeft = "1px solid #ddd";
            header.style.borderRight = "none";
        }
    }

    // 地図の描画崩れ（半分グレー）を防ぐため、サイズを再計算
    if (window.map) {
        setTimeout(() => {
            window.map.invalidateSize();
        }, 300); // 余裕を持って300ms待機
    }
}

// 起動シーケンス
window.addEventListener('load', async () => {
    // 1. レイアウト初期化
    syncHeaderWithOrientation();

    // 2. 現在地の取得（エラーで止まらないようtry-catch）
    try {
        if (typeof window.startGeolocation === 'function') {
            window.startGeolocation();
        }
    } catch (e) { console.error("現在地エラー:", e); }

    // 3. データ読み込み
    if (typeof window.prepareGtfsData === 'function') {
        await window.prepareGtfsData();
    }

    // 4. バス更新
    if (window.map && typeof window.updateBusPositions === 'function') {
        window.updateBusPositions();
        setInterval(() => window.updateBusPositions(), 15000);
    }
});

window.addEventListener('resize', syncHeaderWithOrientation);
window.addEventListener('orientationchange', syncHeaderWithOrientation);
