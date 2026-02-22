// js/buses.js

const busMarkers = {};

async function updateBusPositions() {
    if (!window.map || !window.routeJpLookup) return;

    const activeCompanies = BUS_COMPANIES.filter(c => c.active);
    const targetMap = window.map;
    const activeIds = new Set();

    for (const company of activeCompanies) {
        try {
            const response = await fetch(`${company.realtimeUrl}&t=${Date.now()}`);
            if (!response.ok) continue;

            const data = await response.json();
            const entities = data.entity || [];

            // 1. 各車両の処理（ここでは await を使わない）
            entities.forEach(item => {
                const v = item.vehicle;
                if (!v || !v.position || !v.trip) return;

                const rawTripId = v.trip.tripId;
                const vehicleId = `${company.id}_${v.vehicle.id || item.id}`;
                activeIds.add(vehicleId);

                // --- 軽量化：ここでは静的ファイルを検索しない ---
                // 代わりに routes_jp.txt から基本情報を取る
                const globalRouteId = `${company.id}_${v.trip.routeId}`;
                const jpInfo = window.routeJpLookup[globalRouteId];
                const displayTitle = jpInfo ? `${jpInfo.dest} 行` : "運行中";
                
                // 遅延表示（既存ロジック...省略可）
                let delayText = ""; 

                const finalPopupHtml = `
                    <div id="popup-${vehicleId}" style="min-width:180px;">
                        <div style="font-size:0.8em; color:#666;">${company.name}</div>
                        <b style="color:#e60012; font-size:1.1em;" class="dest-title">${displayTitle}</b>${delayText}<br>
                        <hr style="margin:5px 0; border:0; border-top:1px solid #eee;">
                        <small class="origin-label">始発: 確認中...</small><br>
                        <hr style="margin:5px 0; border:0; border-top:1px solid #eee;">
                        <div class="trip-timetable-container" style="max-height:150px; overflow-y:auto; font-size:11px; color:#555;">
                            <span style="color:#999; cursor:pointer;">▶ クリックで詳細をロード</span>
                        </div>
                    </div>
                `;

                const lat = parseFloat(v.position.latitude);
                const lon = parseFloat(v.position.longitude);

                if (busMarkers[vehicleId]) {
                    busMarkers[vehicleId].setLatLng([lat, lon]);
                } else {
                    const icon = createSquareIcon(company.id);
                    const marker = L.marker([lat, lon], { icon: icon, zIndexOffset: 1000 })
                        .addTo(targetMap)
                        .bindPopup(finalPopupHtml, { autoClose: false });

                    // 【重要】クリックされた時に初めて重いデータを読み込む
                    marker.on('click', async () => {
                        await new Promise(r => setTimeout(r, 200));
                        const popupDiv = document.getElementById(`popup-${vehicleId}`);
                        if (!popupDiv) return;

                        const container = popupDiv.querySelector('.trip-timetable-container');
                        const originLabel = popupDiv.querySelector('.origin-label');
                        const destTitle = popupDiv.querySelector('.dest-title');

                        container.innerHTML = "読み込み中...";
                        
                        // ここで初めて stop_times.txt を検索
                        const stopsData = await window.getFullTimetableForTrip(rawTripId, company.id);
                        
                        if (stopsData && stopsData.length > 0) {
                            // 始発と終点を正しいものに書き換える
                            originLabel.innerHTML = `始発: ${stopsData[0].stopName}`;
                            destTitle.innerHTML = `${stopsData[stopsData.length - 1].stopName} 行`;

                            let tableHtml = `<table style="width:100%; border-collapse:collapse;">`;
                            stopsData.forEach(s => {
                                tableHtml += `<tr style="border-bottom:1px solid #eee;">
                                    <td style="padding:3px 0;">${s.stopName}</td>
                                    <td style="padding:3px 0; text-align:right;">${s.time}</td>
                                </tr>`;
                            });
                            container.innerHTML = tableHtml + `</table>`;
                        } else {
                            container.innerHTML = "詳細データなし";
                        }
                    });

                    busMarkers[vehicleId] = marker;
                }
            });

        } catch (error) {
            console.error(`${company.name} 更新エラー:`, error);
        }
    }

    // 不要なバスを消去
    Object.keys(busMarkers).forEach(id => {
        if (!activeIds.has(id)) {
            targetMap.removeLayer(busMarkers[id]);
            delete busMarkers[id];
        }
    });
}
