/**
 * js/stops.js
 * 役割: バス停の統合管理と地図描画
 */

async function loadAndDisplayStops() {
    if (!window.map) {
        setTimeout(loadAndDisplayStops, 500);
        return;
    }

    console.log("📍 バス停の統合・描画を開始します...");

    // stop_id をキーにして、マーカーと会社リストを管理する
    const stopMap = new Map();

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

            lines.slice(1).forEach((line) => {
                if (!line.trim()) return;
                const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
                if (cols.length <= Math.max(latIdx, lonIdx)) return;

                const stopId = cols[idIdx];
                const lat = parseFloat(cols[latIdx]);
                const lon = parseFloat(cols[lonIdx]);
                const stopName = cols[nameIdx];

                if (isNaN(lat) || isNaN(lon)) return;

                if (stopMap.has(stopId)) {
                    // すでに同じIDのバス停がある場合（共通バス停）
                    const entry = stopMap.get(stopId);
                    if (!entry.companies.includes(company.id)) {
                        entry.companies.push(company.id);
                        // 色を紫に変更
                        entry.marker.setStyle({
                            fillColor: window.APP_CONFIG.COMPANIES.shared.color
                        });
                    }
                } else {
                    // 新規バス停
                    const markerColor = (company.id === 'hirobus') ? 
                        window.APP_CONFIG.COMPANIES.hirobus.color : 
                        window.APP_CONFIG.COMPANIES.hiroden.color;

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
                        radius: 5, color: '#000', weight: 1, fill: false, interactive: false
                    }).addTo(window.map);

                    const entry = {
                        marker: marker,
                        companies: [company.id],
                        name: stopName
                    };
                    stopMap.set(stopId, entry);

                    // クリックイベント
                    marker.on('click', () => {
                        const safeId = String(stopId).replace(/\s+/g, '_');
                        const popupHtml = `
                            <div style="min-width:220px;">
                                <strong>${entry.name}</strong><br>
                                <small style="color:#999;">ID: ${stopId}</small>
                                <hr style="margin:5px 0; border:0; border-top:1px solid #eee;">
                                <div class="timetable-content-${safeId}" style="max-height: 250px; overflow-y: auto;">
                                    <div class="loading">時刻表を準備中...</div>
                                </div>
                            </div>`;
                        marker.bindPopup(popupHtml).openPopup();
                        
                        // TimetableManager に会社リストを渡して呼び出し
                        window.TimetableManager.showTimetable(stopId, entry.companies);
                    });
                }
            });
        } catch (e) { console.error(e); }
    }
    console.log(`✅ バス停の描画が完了しました。総バス停数: ${stopMap.size}`);
}

loadAndDisplayStops();
