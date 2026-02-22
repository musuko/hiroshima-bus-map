// js/stops.js

async function loadAllStops() {
    if (!window.map) return;
    
    const activeCompanies = BUS_COMPANIES.filter(c => c.active);
    const stopMap = {}; // 「緯度_経度」をキーにして統合する辞書

    for (const company of activeCompanies) {
        try {
            const filePath = `${company.staticPath}stops.txt`;
            console.log(`📍 読み込み開始: ${filePath}`);
            
            const response = await fetch(filePath);
            if (!response.ok) continue;

            const text = await response.text();
            const lines = text.trim().split(/\r?\n/);
            const head = lines[0].split(',').map(s => s.trim().replace(/^"|"$/g, ''));

            lines.slice(1).forEach(line => {
                const c = line.split(',').map(s => s.trim().replace(/^"|"$/g, ''));
                const name = c[head.indexOf('stop_name')];
                const lat = c[head.indexOf('stop_lat')];
                const lon = c[head.indexOf('stop_lon')];
                const id = c[head.indexOf('stop_id')];

                if (!name || !lat || !lon) return;

                // --- 座標をキーにする（文字列として結合） ---
                // 例: "34.397_132.475"
                const geoKey = `${lat}_${lon}`;

                if (!stopMap[geoKey]) {
                    stopMap[geoKey] = {
                        name: name,
                        lat: parseFloat(lat),
                        lon: parseFloat(lon),
                        companyStops: [] 
                    };
                }
                
                // 同じ座標にあるバス停情報を追加
                stopMap[geoKey].companyStops.push({
                    companyId: company.id,
                    stopId: id
                });
            });
        } catch (e) {
            console.error(`${company.name} のバス停取得失敗:`, e);
        }
    }

    renderMergedStops(stopMap);
}

function renderMergedStops(stopMap) {
    const targetMap = window.map;
    const stopsArray = Object.values(stopMap);

    stopsArray.forEach(stop => {
        // 同じ場所にあるバス停が複数の会社にまたがっているかチェック
        const isShared = stop.companyStops.length > 1;

        const marker = L.circleMarker([stop.lat, stop.lon], {
            radius: 7,
            fillColor: "#ffffff",
            // 複数社が共有しているバス停は色を変える（例：オレンジ）なども可能
            color: isShared ? "#ff8c00" : "#3388ff", 
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
        }).addTo(targetMap);

        marker.on('click', async () => {
            const popupContent = `<div style="min-width:200px;"><strong>${stop.name}</strong><br><hr>読込中...</div>`;
            marker.bindPopup(popupContent).openPopup();
            
            // 統合時刻表の表示（この座標にある全stopIdを対象にする）
            showUnifiedTimetable(stop);
        });
    });

    console.log(`✅ ${stopsArray.length} 地点のバス停（座標一致のみ統合）を表示しました`);
}

loadAllStops();
