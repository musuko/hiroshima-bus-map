// js/main.js

window.addEventListener('load', async () => {
    // 1. まず現在地の追跡を開始
    if (typeof window.startGeolocation === 'function') {
        window.startGeolocation();
        console.log("現在地取得を開始しました");
    }

    // 2. GTFS辞書の準備（もしあれば）
    if (typeof window.prepareGtfsData === 'function') {
        await window.prepareGtfsData();
    }

    // 3. 地図と機能の初期化
    if (window.map) {
        // バス停の読み込み (stops.js内の関数名に合わせてください)
        if (typeof loadAllStops === 'function') {
            loadAllStops();
        }

        // バス位置の更新
        if (typeof window.updateBusPositions === 'function') {
            // 初回実行
            window.updateBusPositions();
            
            // 15秒ごとに定期更新
            setInterval(() => {
                console.log("15秒経過：バス位置を更新します");
                window.updateBusPositions();
            }, 15000);
        }
    } else {
        console.error("Mapが初期化されていません");
    }
}); // <--- ここで正しく閉じます

// 回転時の中央維持ロジック（loadの外に置くのが一般的です）
window.addEventListener('resize', () => {
    if (window.map) {
        const center = window.map.getCenter();
        // 地図のサイズ変更を認識させる
        window.map.invalidateSize();
        // 元の中央座標に即座に戻す
        window.map.panTo(center, { animate: false });
    }
});

// main.js の末尾などに追加

function adjustHeaderRotation() {
    const header = document.querySelector('.header');
    if (!header) return;

    // 横画面の時だけ判定
    if (window.innerWidth > window.innerHeight) {
        // angle が 90 なら時計回り、-90(または270) なら反時計回り
        const angle = window.screen.orientation ? window.screen.orientation.angle : window.orientation;

        if (angle === 90) {
            // 時計回り：上から下へ
            header.style.transform = "rotate(90deg)";
        } else if (angle === -90 || angle === 270) {
            // 反時計回り：上から下へ（逆回転させて向きを維持）
            header.style.transform = "rotate(-90deg)";
        }
    } else {
        // 縦画面の時は回転をリセット
        header.style.transform = "none";
    }
}

// 画面サイズ変更時と回転時に実行
window.addEventListener('resize', adjustHeaderRotation);
window.addEventListener('orientationchange', adjustHeaderRotation);
// 起動時にも一度実行
adjustHeaderRotation();
