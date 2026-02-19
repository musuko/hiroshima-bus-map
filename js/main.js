window.addEventListener('load', () => {
    // 1. まず現在地の追跡を開始（ユーザーを待たせない）
    if (typeof window.startGeolocation === 'function') {
        window.startGeolocation();
        console.log("現在地取得を開始しました");
    }

    // 2. 地図が存在すればバス停を読み込む
    if (window.map) {
        loadStopsFromCsv(window.map);
    } else {
        console.error("Mapが初期化されていません");
    }
});
