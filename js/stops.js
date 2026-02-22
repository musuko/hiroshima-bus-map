// js/stops.js

async function loadAllStops() {
    if (!window.map) return;
    
    const activeCompanies = BUS_COMPANIES.filter(c => c.active);
    const stopMap = {}; // stop_id をキーにして統合する辞書

    for (const company of activeCompanies) {
        try { // tryはループの内側に入れるのが安全です
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
                        companies: [] 
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
        let markerColor = "#3388ff"; 

        const companies = stop.companies;

        if (companies.length > 1) {
            markerColor = "#9400D3"; // 共通：紫
        } else if (companies.includes('hiroden')) {
            markerColor = "#82c91e"; // 広電：黄緑
        } else if (companies.includes('hirobus')) {
            markerColor = "#e60012"; // 広バス：赤
        }

        // 1. 本体のマーカー（見た目用）
        const marker = L.circleMarker([stop.lat, stop.lon], {
            radius: 7,
            fillColor: "#ffffff",
            color: markerColor,
            weight: 3,
            opacity: 1,
            fillOpacity: 0.9,
            className: 'clickable-stop' 
        }).addTo(targetMap);
        
        // 2. 透明な大きな円を重ねてクリック判定を強化（半径20px）
        L.circleMarker([stop.lat, stop.lon], {
            radius: 20, 
            stroke: false,
            fillColor: 'transparent', 
            fillOpacity: 0
        }).addTo(targetMap).on('click', (e) => {
            // 地図の他のイベント（クリックでポップアップが閉じる等）を防止しつつ本体を叩く
            L.DomEvent.stopPropagation(e);
            marker.fire('click'); 
        });

        // 3. クリックした時の処理（ポップアップと時刻表呼び出し）
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
