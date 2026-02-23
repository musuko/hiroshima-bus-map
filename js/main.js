// js/main.js の末尾

/**
 * 画面の回転角に応じて、ヘッダーの位置（左右）と文字の向きを同期させる
 */
function syncHeaderWithOrientation() {
    const body = document.body;
    const header = document.querySelector('.header');
    const headerText = document.querySelector('.header-text');
    if (!header || !headerText) return;

    // 横画面判定（幅が高さより大きい場合）
    if (window.innerWidth > window.innerHeight) {
        // 回転角取得
        let angle = 0;
        if (window.screen && window.screen.orientation) {
            angle = window.screen.orientation.angle;
        } else if (typeof window.orientation !== 'undefined') {
            angle = window.orientation;
        }

        body.style.flexDirection = "row"; // 横並びモード

        if (angle === 90) {
            // 【時計回り回転】ヘッダーは「右端」へ、文字は「時計回り」に
            header.style.order = "1"; 
            header.style.width = "40px";
            header.style.height = "100vh";
            header.style.borderLeft = "1px solid #ddd";
            header.style.borderRight = "none";
            headerText.style.transform = "rotate(90deg)";
            
        } else if (angle === -90 || angle === 270) {
            // 【反時計回り回転】ヘッダーは「左端」へ、文字は「反時計回り」に
            header.style.order = "0"; 
            header.style.width = "40px";
            header.style.height = "100vh";
            header.style.borderRight = "1px solid #ddd";
            header.style.borderLeft = "none";
            headerText.style.transform = "rotate(-90deg)";
        }
        
        // 横画面時は共通で line-height をリセット
        header.style.lineHeight = "normal";

    } else {
        // 【縦画面】標準レイアウト
        body.style.flexDirection = "column";
        header.style.order = "";
        header.style.width = "100%";
        header.style.height = "50px";
        header.style.lineHeight = "50px";
        header.style.borderRight = "none";
        header.style.borderLeft = "none";
        headerText.style.transform = "none";
    }

    // 地図の再描画（サイズ変更を即座に反映）
    if (window.map) {
        // 少し遅延させるとブラウザのレンダリング確定後に実行されるので確実です
        setTimeout(() => {
            const center = window.map.getCenter();
            window.map.invalidateSize();
            window.map.panTo(center, { animate: false });
        }, 150);
    }
}

// イベント登録（1つの関数に集約）
window.addEventListener('resize', syncHeaderWithOrientation);
window.addEventListener('orientationchange', syncHeaderWithOrientation);

// 起動時に実行
document.addEventListener('DOMContentLoaded', syncHeaderWithOrientation);
