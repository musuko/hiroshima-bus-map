window.addEventListener('load', () => {
    loadStopsFromZip();

    // 初回
    setTimeout(updateBusPositions, 5000);

    // 定期更新
    setInterval(updateBusPositions, 60000);

     startGeolocation(); // ← これ追加
});
