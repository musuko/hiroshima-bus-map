/**
 * js/stops.js
 */

async function loadAndDisplayStops() {
    if (!window.map) {
        setTimeout(loadAndDisplayStops, 500);
        return;
    }

    console.log("📍 バス停の地図描画を開始します...");

    for (const company of BUS_COMPANIES) {
        try {
            const response = await fetch(`${company.staticPath}stops.txt`);
            if (!response.ok) continue;

            const text = await response.text();
            const lines = text.trim().split(/\r?\n/);
            const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());

            const idIdx = headers.findIndex(h => h.includes('stop_id'));
            const nameIdx = headers.findIndex(h => h.includes('stop_name'));
            const latIdx = headers.findIndex(h => h.includes('stop_lat'));
            const lonIdx = headers.findIndex(h => h.includes('stop_lon'));

            if (latIdx === -1 || lonIdx === -1) continue;

            const markerColor = (company.id === 'hirobus') ? '#FF0000' : '#ADFF2F';

            lines.slice(1).forEach((line) => {
                if (!line.trim()) return;

                const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
                if (cols.length <= Math.max(latIdx, lonIdx)) return;

                const lat = parseFloat(cols[latIdx]);
                const lon = parseFloat(cols[lonIdx]);
                const stopId = cols[idIdx];
                const stopName = cols[nameIdx];

                if (isNaN(lat) || isNaN(lon)) return;

                // 当たり判定用（透明）
                const marker = L.circleMarker([lat, lon], {
                    radius: 6,
                    fillColor: markerColor,
                    color: 'rgba(0,0,0,0)',
                    weight: 15,
                    opacity: 0,
                    fillOpacity: 1
                }).addTo(window.map);

                // 見た目用（中央の丸）
                L.circleMarker([lat, lon], {
                    radius: 5,
                    color: '#000',
                    weight: 1,
                    fill: false,
                    interactive: false
                }).addTo(window.map);

                marker.on('click', () => {
                    const safeId = String(stopId).replace(/\s+/g, '_');
                    const popupHtml = `
                        <div style="min-width:200px;">
                            <strong>${stopName}</strong><br>
                            <small style="color:#999;">ID: ${stopId}</small>
                            <hr style="margin:5px 0; border:0; border-top:1px solid #eee;">
                            <!-- [修正] スクロールバー用のスタイルを追加 -->
                            <div class="timetable-content-${safeId}" style="max-height: 200px; overflow-y: auto;">
                                <div class="loading" style="font-size:11px; color:#888;">時刻表を取得中...</div>
                            </div>
                        </div>`;
                    
                    marker.bindPopup(popupHtml).openPopup();
                    
                    if (window.TimetableManager && window.TimetableManager.showTimetable) {
                        window.TimetableManager.showTimetable(stopId, company.id);
                    }
                });
            });
            console.log(`✅ ${company.name}: バス停描画完了`);

        } catch (error) {
            console.error(`${company.name} 処理エラー:`, error);
        }
    }
}

loadAndDisplayStops();
