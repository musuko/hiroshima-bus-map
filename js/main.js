// js/main.js の末尾など

function adjustHeaderRotation() {
    const textElement = document.querySelector('.header-text');
    if (!textElement) return;

    // 横画面判定
    if (window.innerWidth > window.innerHeight) {
        // 回転角取得（標準的なAPIと古いiOSの両方に対応）
        let angle = 0;
        if (window.screen && window.screen.orientation) {
            angle = window.screen.orientation.angle;
        } else if (typeof window.orientation !== 'undefined') {
            angle = window.orientation;
        }

        // angle 90: 時計回り(右)に倒した / angle -90, 270: 反時計回り(左)に倒した
        if (angle === 90) {
            textElement.style.transform = "rotate(90deg)";
        } else if (angle === -90 || angle === 270) {
            textElement.style.transform = "rotate(-90deg)";
        } else {
            // angle 0 または 180 (逆さま) の時
            textElement.style.transform = "none";
        }
    } else {
        // 縦画面
        textElement.style.transform = "none";
    }

    // 地図のサイズ更新も併せて実行
    if (window.map) {
        const center = window.map.getCenter();
        window.map.invalidateSize();
        window.map.panTo(center, { animate: false });
    }
}

// イベント登録
window.addEventListener('resize', adjustHeaderRotation);
window.addEventListener('orientationchange', adjustHeaderRotation);

// 起動時に実行
document.addEventListener('DOMContentLoaded', adjustHeaderRotation);
