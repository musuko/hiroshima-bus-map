window.addEventListener('load', () => {
    // 1. まず現在地の追跡を開始（ユーザーを待たせない）
    if (typeof window.startGeolocation === 'function') {
        window.startGeolocation();
        console.log("現在地取得を開始しました");
    }

    // 2. 地図が存在すればバス停を読み込む
    if (window.map) {
        loadStopsFromTxt(window.map);

        // --- バス位置の更新処理を追加 ---
        if (typeof window.updateBusPositions === 'function') {
            // 初回実行
            window.updateBusPositions();
            
            // 15秒ごとに繰り返し実行
            setInterval(() => {
                console.log("15秒経過：バス位置を更新します");
                window.updateBusPositions();
            }, 15000);
        }
    } else {
        console.error("Mapが初期化されていません");
    }
});
