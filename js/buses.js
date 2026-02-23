// js/buses.js

const busMarkers = {};

/**
 * 会社ごとの色と枠線を持った四角形アイコンを生成する
 */
function createSquareIcon(companyId) {
    const isHirobus = (companyId === 'hirobus');
    const bgColor = isHirobus ? '#FF0000' : '#ADFF2F'; // 広島バス: 赤, 広電: 黄緑
    const borderColor = '#000000'; 

    return L.divIcon({
        className: 'custom-bus-icon',
        html: `<div style="
            width: 16px; 
            height: 16px; 
            background-color: ${bgColor}; 
            border: 2px solid ${borderColor};
            border-radius: 2px;
            box-shadow: 1px 1px 3px rgba(0,0,0,0.4);
        "></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
        popupAnchor: [0, -10]
    });
}

async function updateBusPositions() {
    if (!window.map) return; 

    const activeCompanies = BUS_COMPANIES.filter(c => c.active);
    const targetMap = window.map;
    const activeIds = new Set();

    for (const company of activeCompanies) {
        try {
            const response = await fetch(`${company.realtimeUrl}&t=${Date.now()}`);
            if (!response.ok) continue;

            const data = await response.json();
            const entities = data.entity || [];

            entities.forEach(item => {
                const v = item.vehicle;
                if (!v || !v.position || !v.trip) return;

                const rawTripId = v.trip.tripId;
                const vehicleId = `${company.id}_${v.vehicle.id || item.id}`;
                activeIds.add(vehicleId);

                const globalRouteId = `${company.id}_${v.trip.routeId}`;
                const jpInfo = window.routeJpLookup ? window.routeJpLookup[globalRouteId] : null;
                const displayTitle = jpInfo ? `${jpInfo.dest} 行` : "運行中";
                
                let delayText = ""; // 必要に応じて遅延ロジックを追加

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
                    // ここで createSquareIcon を呼び出します
                    const icon = createSquareIcon(company.id);
                    const marker = L.marker([lat, lon], { icon: icon, zIndexOffset: 1000 })
                        .addTo(targetMap)
                        .bindPopup(finalPopupHtml, { autoClose: false });

                    marker.on('click', async () => {
                        await new Promise(r => setTimeout(r, 200));
                        const popupDiv = document.getElementById(`popup-${vehicleId}`);
                        if (!popupDiv) return;

                        const container = popupDiv.querySelector('.trip-timetable-container');
                        const originLabel = popupDiv.querySelector('.origin-label');
                        const destTitle = popupDiv.querySelector('.dest-title');

                        container.innerHTML = "読み込み中...";
                        
                        const stopsData = await window.getFullTimetableForTrip(rawTripId, company.id);
                        
                        if (stopsData && stopsData.length > 0) {
                            // 【成功時】データを表示
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
                            // 【データなし時】ラベルを「データなし」に更新し、メッセージを表示
                            originLabel.innerHTML = `始発: データなし`;
                            // destTitle はそのまま（「運行中」など）にするか、必要なら変更してください
                            container.innerHTML = `
                                <div style="padding:10px 5px; color:#888; line-height:1.4;">
                                    ※時刻表データがありません。<br>
                                    <small>(臨時便または最新のダイヤに未対応の可能性があります)</small>
                                </div>`;
                        }
                    });

                    busMarkers[vehicleId] = marker;
                }
            });

        } catch (error) {
            console.error(`${company.name} 更新エラー:`, error);
        }
    }

    Object.keys(busMarkers).forEach(id => {
        if (!activeIds.has(id)) {
            targetMap.removeLayer(busMarkers[id]);
            delete busMarkers[id];
        }
    });
}
