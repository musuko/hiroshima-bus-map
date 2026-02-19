// js/stops.js

async function loadStopsFromCsv(mapInstance) {
    // 引数がない場合は window.map を、それもなければエラー
    const targetMap = mapInstance || window.map;
    
    if (!targetMap) {
        console.error('地図オブジェクトが見つかりません。');
        return;
    }

    const csvPath = './hiroden/stops.csv';

    try {
        const response = await fetch(csvPath);
        const csvText = await response.text();
        
        // 行に分割
        const rows = csvText.trim().split(/\r?\n/);
        
        // ヘッダー解析（トリムして余計な空白や引用符を消す）
        const headers = rows[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        const idxLat = headers.indexOf('stop_lat');
        const idxLon = headers.indexOf('stop_lon');
        const idxName = headers.indexOf('stop_name');

        console.log("読み込み開始:", csvPath);

        rows.slice(1).forEach((row, index) => {
            const columns = row.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
            
            const lat = parseFloat(columns[idxLat]);
            const lon = parseFloat(columns[idxLon]);
            const name = columns[idxName];

            if (!isNaN(lat) && !isNaN(lon)) {
                // L.marker ではなく L.circleMarker を使用
                L.circleMarker([lat, lon], {
                    radius: 6,           // 円の半径
                    fillColor: "#28a745", // 緑色（広電バス風のグリーン）
                    color: "#ffffff",     // 枠線の色（白）
                    weight: 2,            // 枠線の太さ
                    opacity: 1,           // 枠線の透明度
                    fillOpacity: 0.8      // 塗りつぶしの透明度
                })
                .addTo(targetMap)
                .bindPopup(name);
            }
        });

        console.log(`成功: ${rows.length - 1}件のバス停を表示しました。`);

    } catch (error) {
        console.error('stops.js:39 CSV読込エラー:', error);
    }
}
