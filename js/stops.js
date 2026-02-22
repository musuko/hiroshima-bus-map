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

// js/stops.js の renderMergedStops 関数内を修正

function renderMergedStops(stopMap) {
    const targetMap = window.map;
    
    Object.values(stopMap).forEach(stop => {
        let markerColor = "#3388ff"; // デフォルト（青）

        // 会社リストを取得
        const companies = stop.companies;

        if (companies.length > 1) {
            // --- 複数社がミックスしているバス停 ---
            markerColor = "#9400D3"; // 目立つ色：ダークバイオレット（紫）
        } else if (companies.includes('hiroden')) {
            // --- 広電バス単独 ---
            markerColor = "#82c91e"; // 黄緑（buses.jsと統一）
        } else if (companies.includes('hirobus')) {
            // --- 広島バス単独 ---
            markerColor = "#e60012"; // 赤（buses.jsと統一）
        }

        const marker = L.circleMarker([stop.lat, stop.lon], {
            radius: 6,           // 少し小さくしてスッキリさせます
            fillColor: "#ffffff", // 中は白
            color: markerColor,   // 枠線の色
            weight: 3,            // 枠線を少し太くして色を強調
            opacity: 1,
            fillOpacity: 0.9
        }).addTo(targetMap);

        // クリックイベントなどはそのまま維持
        marker.on('click', async () => {
            const popupId = `popup-${stop.stopId}`;
            const popupContent = `<div id="${popupId}" style="min-width:200px;">
                <strong style="color:${markerColor}">${stop.name}</strong> (ID: ${stop.stopId})<br><hr>
                <div class="loading">時刻表を読み込み中...</div>
            </div>`;
            marker.bindPopup(popupContent).openPopup();
            
            if (window.showUnifiedTimetable) {
                window.showUnifiedTimetable(stop.stopId, stop.companies, popupId);
            }
        });
    });
    console.log(`✅ 色分け完了（広電:黄緑 / 広バス:赤 / 共通:紫）`);
}

loadAllStops();
