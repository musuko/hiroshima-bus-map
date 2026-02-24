/**
 * js/stops.js
 * 役割: バス停データを読み込み、地図にマーカーを配置する（軽量版）
 */

async function loadAndDisplayStops() {
    // 地図 (window.map) が準備できていない場合は、少し待ってから再試行
    if (!window.map) {
        setTimeout(loadAndDisplayStops, 500);
        return;
    }

    console.log("📍 バス停の地図描画を開始します...");

    // config.js で定義されている BUS_COMPANIES を使用
    for (const company of BUS_COMPANIES) {
        try {
            const response = await fetch(`${company.staticPath}stops.txt`);
            if (!response.ok) continue;

            const text = await response.text();
            const lines = text.trim().split(/\r?\n/);
            const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));

            const idIdx = headers.indexOf('stop_id');
            const nameIdx = headers.indexOf('stop_name');
            const latIdx = headers.indexOf('stop_lat');
            const lonIdx = headers.indexOf('stop_lon');

            const markerColor = (company.id === 'hirobus') ? '#FF0000' : '#ADFF2F';

            lines.slice(1).forEach(line => {
                const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
                if (cols.length <= latIdx) return;

                const lat = parseFloat(cols[latIdx]);
                const lon = parseFloat(cols[lonIdx]);
                const stopId = cols[idIdx];
                const stopName = cols[nameIdx];

                if (isNaN(lat) || isNaN(lon)) return;

                // 地図に円形マーカーを追加
                const marker = L.circleMarker([stop.lat, stop.lon], {
                    radius: 6,              // 見た目の半径を少しだけ大きく（6〜8くらいがおすすめ）
                    fillColor: markerColor, // 中の色
                    fillOpacity: 1,         // 中の色をくっきりさせる
                    
                    // 【ここがポイント】
                    weight: 15,             // 透明な「縁（ふち）」の太さを15〜20に設定
                    color: 'rgba(0,0,0,0)', // 縁の色を完全に透明にする（当たり判定だけが広がる）
                    
                    interactive: true       // クリックイベントを有効化
                }).addTo(window.map);

                // クリックイベント: ポップアップを表示し、時刻表を呼び出す
                marker.on('click', () => {
                    const safeId = String(stopId).replace(/\s+/g, '_');
                    const popupHtml = `
                        <div style="min-width:200px;">
                            <strong>${stopName}</strong><br>
                            <small style="color:#999;">ID: ${stopId}</small>
                            <hr style="margin:5px 0; border:0; border-top:1px solid #eee;">
                            <div class="timetable-content-${safeId}">
                                <div class="loading" style="font-size:11px; color:#888;">時刻表を取得中...</div>
                            </div>
                        </div>`;
                    
                    marker.bindPopup(popupHtml).openPopup();
                    
                    // TimetableManager (timetable.js) を呼び出し
                    if (window.TimetableManager && window.TimetableManager.showTimetable) {
                        window.TimetableManager.showTimetable(stopId, company.id);
                    }
                });
            });
            console.log(`✅ ${company.name} のバス停を描画しました`);

        } catch (error) {
            console.error(`${company.name} 描画失敗:`, error);
        }
    }
}

// 自動実行
loadAndDisplayStops();
