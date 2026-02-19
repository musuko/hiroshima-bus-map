// ページ読み込み完了後に実行
window.addEventListener('load', () => {
    // map.jsで定義したグローバルなmapを渡す
    if (window.map) {
        loadStopsFromCsv(window.map);
    } else {
        console.error("Mapが初期化されていません");
    }
     startGeolocation();
});
