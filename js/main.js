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
