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
            const stopId = columns[headers.indexOf('stop_id')]; // stop_id を取得

            if (!isNaN(lat) && !isNaN(lon)) {
                // L.marker ではなく L.circleMarker を使用
                L.circleMarker([lat, lon], {
                    radius: 8,           // 円の半径
                    fillColor: "#28a745", // 緑色（広電バス風のグリーン）
                    color: "#ffffff",     // 枠線の色（白）
                    // --- ここからが判定を広げる設定 ---
                    color: "transparent", // 枠線を透明にする（または "rgba(0,0,0,0)"）
                    weight: 20,           // 枠線の太さを20pxにする。これが「クリック判定」の広さになります
                    stroke: true,         // 枠線自体は有効にする
                })
                .addTo(targetMap)
                // 吹き出しに stop_id も表示するように変更
                .bindPopup(`<b>${name}</b><br>ID: ${stopId}`)
                // クリックした時にコンソールに ID を出す（デバッグ用）
                .on('click', () => {
                    console.log(`選択されたバス停: ${name} (ID: ${stopId})`);
                    // ここに「時刻表を表示する関数(stopId)」を後で追加すれば連携完了！
            }
        });

        console.log(`成功: ${rows.length - 1}件のバス停を表示しました。`);

    } catch (error) {
        console.error('stops.js:39 CSV読込エラー:', error);
    }
}
