window.addEventListener('load', () => {
    loadStopsFromZip();

    // 初回
    setTimeout(updateBusPositions, 15000);

    // 定期更新
    setInterval(updateBusPositions, 15000);

     startGeolocation(); // ← これ追加
});
