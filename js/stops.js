// js/stops.js

async function loadAllStops() {
    if (!window.map) return;
    
    const activeCompanies = BUS_COMPANIES.filter(c => c.active);
    const stopMap = {}; // stop_id をキーにして統合する辞書

    for (const company of activeCompanies) {
        try {
            const filePath = `${company.staticPath}stops.txt`;
            const response = await fetch(filePath);
            if (!response.ok) continue;

            const text = await response.text();
            const lines = text.trim().split(/\r?\n/);
            const head = lines[0].split(',').map(s => s.trim().replace(/^"|"$/g, ''));

            lines.slice(1).forEach(line => {
                const c = line.split(',').map(s => s.trim().replace(/^"|"$/g, ''));
                const id = c[head.indexOf('stop_id')];
                const name = c[head.indexOf('stop_name')];
                const lat = parseFloat(c[head.indexOf('stop_lat')]);
                const lon = parseFloat(c[head.indexOf('stop_lon')]);

                if (!id || !name || isNaN(lat)) return;

                // --- stop_id をキーにする（共通IDによる統合） ---
                if (!stopMap[id]) {
                    stopMap[id] = {
                        stopId: id,
                        name: name,
                        lat: lat,
                        lon: lon,
                        companies: [] // どの会社がこのIDを使っているか
                    };
                }
                
                if (!stopMap[id].companies.includes(company.id)) {
                    stopMap[id].companies.push(company.id);
                }
            });
        } catch (e) {
            console.error(`${company.name} のバス停取得失敗:`, e);
        }
    }

    renderMergedStops(stopMap);
}

function renderMergedStops(stopMap) {
    const targetMap = window.map;
    Object.values(stopMap).forEach(stop => {
        // 複数社共通のバス停はオレンジ、単独は青
        const markerColor = stop.companies.length > 1 ? "#ff8c00" : "#3388ff";

        const marker = L.circleMarker([stop.lat, stop.lon], {
            radius: 7,
            fillColor: "#ffffff",
            color: markerColor,
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
        }).addTo(targetMap);

        marker.on('click', async () => {
            const popupId = `popup-${stop.stopId}`;
            const popupContent = `<div id="${popupId}" style="min-width:200px;">
                <strong>${stop.name}</strong> (ID: ${stop.stopId})<br><hr>
                <div class="loading">時刻表を読み込み中...</div>
            </div>`;
            marker.bindPopup(popupContent).openPopup();
            
            // エラー解消：timetable.js 内に作成する統合表示関数を呼び出す
            if (window.showUnifiedTimetable) {
                window.showUnifiedTimetable(stop.stopId, stop.companies, popupId);
            } else {
                console.error("showUnifiedTimetable が定義されていません。timetable.jsを確認してください。");
            }
        });
    });
    console.log(`✅ ${Object.keys(stopMap).length} 地点のバス停を stop_id で統合表示しました`);
}

loadAllStops();
