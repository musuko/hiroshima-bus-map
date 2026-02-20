window.addEventListener('load', async () => {
    // 1. まず現在地の追跡を開始
    if (typeof window.startGeolocation === 'function') {
        window.startGeolocation();
        console.log("現在地取得を開始しました");
    }

    // 2. GTFS辞書の準備を待つ（これが重要！）
    // timetable.js の prepareGtfsData が完了するのを待ちます
    if (typeof window.prepareGtfsData === 'function') {
        await window.prepareGtfsData();
    }

    // 3. 地図と辞書が揃っていれば開始
    if (window.map) {
        // バス停の読み込み
        if (typeof loadStopsFromTxt === 'function') {
            loadStopsFromTxt(window.map);
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
});
