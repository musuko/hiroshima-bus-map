const busMarkers = {};

/**
 * 会社ごとのアイコン生成
 */
function createSquareIcon(companyId) {
    const isHirobus = (companyId === 'hirobus');
    const bgColor = isHirobus ? '#FF0000' : '#ADFF2F'; 
    const borderColor = '#000000';

    return L.divIcon({
        className: 'custom-bus-icon',
        html: `<div style="width: 16px; height: 16px; background-color: ${bgColor}; border: 2px solid ${borderColor}; border-radius: 2px; box-shadow: 1px 1px 3px rgba(0,0,0,0.4);"></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
        popupAnchor: [0, -10]
    });
}

async function updateBusPositions() {
    if (!window.map || !window.routeJpLookup) return;

    const activeCompanies = BUS_COMPANIES.filter(c => c.active);
    const targetMap = window.map;
    const activeIds = new Set();

    for (const company of activeCompanies) {
        const realTimeUrl = `${company.realtimeUrl}&t=${Date.now()}`;

        try {
            const response = await fetch(realTimeUrl);
            if (!response.ok) continue;

            const data = await response.json();
            const entities = data.entity || [];

            // 1. tripUpdate辞書の作成
            const delayMap = {};
            entities.forEach(item => {
                if (item.tripUpdate && item.tripUpdate.trip) {
                    delayMap[item.tripUpdate.trip.tripId] = item.tripUpdate;
                }
            });

            // 2. 各車両の並列処理準備
            const vehiclePromises = entities.map(async (item) => {
                const v = item.vehicle;
                if (!v || !v.position || !v.trip) return;

                const rawTripId = v.trip.tripId;
                const vehicleId = `${company.id}_${v.vehicle ? v.vehicle.id : (item.id || "no-id")}`;
                activeIds.add(vehicleId);

                // 遅延情報の計算
                let delayText = "";
                const myUpdate = delayMap[rawTripId];
                if (myUpdate && myUpdate.stopTimeUpdate) {
                    const foundUpdate = myUpdate.stopTimeUpdate.find(stu => 
                        (stu.departure && stu.departure.delay !== undefined) || 
                        (stu.arrival && stu.arrival.delay !== undefined)
                    );
                    if (foundUpdate) {
                        const event = foundUpdate.departure || foundUpdate.arrival;
                        const delayMin = Math.floor(event.delay / 60);
                        if (delayMin > 0) delayText = `<span style="background:#fff3cd; color:#856404; padding:2px 5px; border-radius:4px; font-size:0.85em; margin-left:5px;">${delayMin}分遅れ</span>`;
                        else if (delayMin < 0) delayText = `<span style="background:#d1ecf1; color:#0c5460; padding:2px 5px; border-radius:4px; font-size:0.85em; margin-left:5px;">早着</span>`;
                        else delayText = `<span style="background:#d4edda; color:#155724; padding:2px 5px; border-radius:4px; font-size:0.85em; margin-left:5px;">定時</span>`;
                    }
                }

                // --- 重要：始発・行先を動的に判定 ---
                let displayTitle = "運行中";
                let displayOrigin = "不明";
                const stops = await window.getFullTimetableForTrip(rawTripId, company.id);

                if (stops && stops.length > 0) {
                    displayOrigin = stops[0].stopName;
                    displayTitle = `${stops[stops.length - 1].stopName} 行`;
                } else {
                    const globalRouteId = `${company.id}_${v.trip.routeId}`;
                    const jpInfo = window.routeJpLookup[globalRouteId];
                    displayTitle = jpInfo ? `${jpInfo.dest} 行` : "運行中";
                    displayOrigin = jpInfo ? jpInfo.origin : "始発不明";
                }

                const finalPopupHtml = `
                    <div id="popup-${vehicleId}" style="min-width:180px;">
                        <div style="font-size:0.8em; color:#666;">${company.name}</div>
                        <b style="color:#e60012; font-size:1.1em;">${displayTitle}</b>${delayText}<br>
                        <hr style="margin:5px 0; border:0; border-top:1px solid #eee;">
                        <small>始発: ${displayOrigin}</small><br>
                        <hr style="margin:5px 0; border:0; border-top:1px solid #eee;">
                        <div class="trip-timetable-container" style="max-height:150px; overflow-y:auto; font-size:11px; color:#555;">
                            <span style="color:#999; cursor:pointer;">▶ クリックで停留所一覧を表示</span>
                        </div>
                    </div>
                `;

                const lat = parseFloat(v.position.latitude);
                const lon = parseFloat(v.position.longitude);

                // マーカーの作成または更新
                if (busMarkers[vehicleId]) {
                    const marker = busMarkers[vehicleId];
                    marker.setLatLng([lat, lon]);
                    if (!marker.getPopup().isOpen()) {
                        marker.setPopupContent(finalPopupHtml);
                    }
                } else {
                    const icon = createSquareIcon(company.id);
                    const marker = L.marker([lat, lon], { icon: icon, zIndexOffset: 1000 })
                        .addTo(targetMap)
                        .bindPopup(finalPopupHtml, { autoClose: false });

                    marker.on('click', async () => {
                        await new Promise(r => setTimeout(r, 150));
                        const container = document.querySelector(`#popup-${vehicleId} .trip-timetable-container`);
                        if (!container || container.innerHTML.includes('table')) return;

                        container.innerHTML = "読み込み中...";
                        const stopsData = await window.getFullTimetableForTrip(rawTripId, company.id);
                        
                        if (!stopsData || stopsData.length === 0) {
                            container.innerHTML = "時刻表データがありません";
                            return;
                        }

                        let tableHtml = `<table style="width:100%; border-collapse:collapse; margin-top:5px;">`;
                        stopsData.forEach(s => {
                            tableHtml += `<tr style="border-bottom:1px solid #eee;">
                                <td style="padding:3px 0;">${s.stopName}</td>
                                <td style="padding:3px 0; text-align:right;">${s.time}</td>
                            </tr>`;
                        });
                        tableHtml += `</table>`;
                        container.innerHTML = tableHtml;
                    });

                    busMarkers[vehicleId] = marker;
                }
            });

            await Promise.all(vehiclePromises);

        } catch (error) {
            console.error(`${company.name} 更新エラー:`, error);
        }
    }

    // 3. 存在しなくなったバスを消去
    Object.keys(busMarkers).forEach(id => {
        if (!activeIds.has(id)) {
            targetMap.removeLayer(busMarkers[id]);
            delete busMarkers[id];
        }
    });

    console.log(`🚌 更新成功: ${activeIds.size} 台のバスを表示中`);
}

window.updateBusPositions = updateBusPositions;
