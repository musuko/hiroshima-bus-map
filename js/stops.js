// js/stops.js

async function loadStopsFromTxt(mapInstance) { // 関数名も実態に合わせて変更
    // 引数がない場合は window.map を、それもなければエラー
    const targetMap = mapInstance || window.map;
    
    if (!targetMap) {
        console.error('地図オブジェクトが見つかりません。');
        return;
    }

    // パスを .txt に変更
    const txtPath = './hiroden/stops.txt';

    try {
        const response = await fetch(txtPath);
        const txtContent = await response.text();
        
        // 行に分割（空行を除去）
        const rows = txtContent.trim().split(/\r?\n/).filter(row => row.length > 0);
        
        // ヘッダー解析（引用符を除去してインデックスを取得）
        const headers = rows[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        const idxLat = headers.indexOf('stop_lat');
        const idxLon = headers.indexOf('stop_lon');
        const idxName = headers.indexOf('stop_name');
        const idxId = headers.indexOf('stop_id');

        console.log("読み込み開始:", txtPath);

        rows.slice(1).forEach((row) => {
            // カンマで分割し、各項目の前後の空白とダブルクォートを除去
            const columns = row.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
            
            const lat = parseFloat(columns[idxLat]);
            const lon = parseFloat(columns[idxLon]);
            const name = columns[idxName];
            const stopId = columns[idxId];

            if (!isNaN(lat) && !isNaN(lon)) {
                // 円形マーカーの設定
                L.circleMarker([lat, lon], {
                    radius: 8,
                    fillColor: "#28a745", // 広電風グリーン
                    fillOpacity: 0.8,
                    color: "transparent", 
                    weight: 20,           // クリック判定エリア
                    stroke: true,
                })
                .addTo(targetMap)
                .bindPopup(`<b>${name}</b><br>ID: ${stopId}`)
                .on('click', async (e) => {
                    const marker = e.target;
                    marker.setPopupContent(`<b>${name}</b><br><div style="text-align:center;">⌛ 時刻表を検索中...</div>`);
                    
                    // 時刻表取得（昨日のロジック）
                    const times = await getTimetableForStop(stopId);
                    
                    if (times.length > 0) {
                        const nextBuses = times.slice(0, 5).map(t => `<li><b>${t.substring(0, 5)}</b></li>`).join('');
                        marker.setPopupContent(`
                            <b>${name}</b><br>
                            <small>ID: ${stopId}</small><hr>
                            これからの出発予定:
                            <ul style="margin:5px 0; padding-left:20px;">${nextBuses}</ul>
                        `);
                    } else {
                        marker.setPopupContent(`<b>${name}</b><br><small>ID: ${stopId}</small><hr>本日の運行は終了、またはデータがありません。`);
                    }
                });
            }
        });

        console.log(`成功: ${rows.length - 1}件のバス停を表示しました。`);

    } catch (error) {
        console.error('stops.js: 読込エラー:', error);
    }
}
