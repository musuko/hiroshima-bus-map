/**
 * スマホの回転方向と位置を物理法則に合わせる
 */
function syncHeaderWithOrientation() {
    const body = document.body;
    const header = document.querySelector('.header');
    const headerText = document.querySelector('.header-text');
    if (!header || !headerText) return;

    const width = window.innerWidth;
    const height = window.innerHeight;

    // PC（幅1024以上）または縦持ちは常に「上ヘッダー」
    if (width >= 1024 || height > width) {
        body.style.flexDirection = "column";
        header.style.width = "100%";
        header.style.height = "50px";
        headerText.style.transform = "none";
    } else {
        // --- スマホ横持ち ---
        let angle = window.orientation || (window.screen.orientation && window.screen.orientation.angle) || 0;

        header.style.width = "40px";
        header.style.height = "100vh";

        // 【物理修正】
        // angle 90 (時計回り)  -> 上部は右へ行く
        // angle -90 (反時計回り) -> 上部は左へ行く
        if (angle === 90) {
            body.style.flexDirection = "row-reverse"; // 右にヘッダー
            headerText.style.transform = "rotate(90deg)";
        } else if (angle === -90 || angle === 270) {
            body.style.flexDirection = "row"; // 左にヘッダー
            headerText.style.transform = "rotate(-90deg)";
        }
    }

    if (window.map) {
        setTimeout(() => { window.map.invalidateSize(); }, 200);
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
