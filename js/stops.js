/**
 * js/stops.js
 * 役割: バス停データを読み込み、地図に表示する
 */

// 1. バス会社の定義（もし config.js などに移動している場合は削除してください）
if (typeof BUS_COMPANIES === 'undefined') {
    window.BUS_COMPANIES = [
        {
            id: 'hiroden',
            name: '広電バス',
            staticPath: './info/hiroden/',
            realtimeUrl: '/api/get-all-realtime?id=8',
            active: true
        },
        {
            id: 'hirobus',
            name: '広島バス',
            staticPath: './info/hirobus/',
            realtimeUrl: '/api/get-all-realtime?id=9',
            active: true
        }
    ];
}

async function loadAndDisplayStops() {
    // 地図 (window.map) が準備できるまで最大5秒待機する（初期化のラグ対策）
    let retryCount = 0;
    while (!window.map && retryCount < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        retryCount++;
    }

    if (!window.map) {
        console.error("❌ エラー: 地図(window.map)が初期化されませんでした。");
        return;
    }

    console.log("📍 バス停の読み込み・描画を開始します...");

    for (const company of BUS_COMPANIES) {
        try {
            const response = await fetch(`${company.staticPath}stops.txt`);
            if (!response.ok) {
                console.warn(`⚠️ ${company.name} の stops.txt が見つかりません`);
                continue;
            }

            const text = await response.text();
            const lines = text.trim().split(/\r?\n/);
            const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));

            const idIdx = headers.indexOf('stop_id');
            const nameIdx = headers.indexOf('stop_name');
            const latIdx = headers.indexOf('stop_lat');
            const lonIdx = headers.indexOf('stop_lon');

            const markerColor = (company.id === 'hirobus') ? '#FF0000' : '#ADFF2F';

            let count = 0;
            for (let i = 1; i < lines.length; i++) {
                const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
                if (cols.length <= latIdx) continue;

                const stop = {
                    stopId: cols[idIdx],
                    name: cols[nameIdx],
                    lat: parseFloat(cols[latIdx]),
                    lon: parseFloat(cols[lonIdx]),
                    companyId: company.id
                };

                if (isNaN(stop.lat) || isNaN(stop.lon)) continue;

                // マーカー作成
                const marker = L.circleMarker([stop.lat, stop.lon], {
                    radius: 5,
                    fillColor: markerColor,
                    color: "#000",
                    weight: 1,
                    opacity: 1,
                    fillOpacity: 0.8
                }).addTo(window.map);

                // クリックイベント
                marker.on('click', () => {
                    const safeId = String(stop.stopId).replace(/\s+/g, '_');
                    const popupHtml = `
                        <div style="min-width:200px; max-height:300px; overflow-y:auto;">
                            <strong>${stop.name}</strong><br>
                            <small style="color:#999;">ID: ${stop.stopId}</small>
                            <hr style="margin:5px 0; border:0; border-top:1px solid #eee;">
                            <div class="timetable-content-${safeId}">
                                <div class="loading">時刻表を取得中...</div>
                            </div>
                        </div>`;
                    
                    marker.bindPopup(popupHtml).openPopup();
                    
                    if (window.TimetableManager && window.TimetableManager.showTimetable) {
                        window.TimetableManager.showTimetable(stop.stopId, stop.companyId);
                    }
                });
                count++;
            }
            console.log(`✅ ${company.name} のバス停を ${count} 件描画しました`);

        } catch (error) {
            console.error(`${company.name} の描画エラー:`, error);
        }
    }
}

// アプリ起動時に実行
loadAndDisplayStops();
