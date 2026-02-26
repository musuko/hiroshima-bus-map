// js/buses.js

const busMarkers = {};

/**
 * 会社ごとの色と枠線を持った四角形アイコンを生成する
 */
function createBusIcon(companyId) {
    // 1. 会社の色を取得（設定がなければグレー）
    const companyConfig = window.APP_CONFIG.COMPANIES[companyId];
    const bgColor = companyConfig ? companyConfig.color : '#888888';

    // 2. config.js からHTMLのひな形を取得し、{color} を実際の色に置き換える
    const rawHtml = window.APP_CONFIG.MAP.BUS_ICON_HTML || `<div style="background-color:{color}; width:16px; height:16px;"></div>`;
    const iconHtml = rawHtml.replace(/{color}/g, bgColor);

    // 3. アイコンのサイズも config.js から取得
    const size = window.APP_CONFIG.MAP.BUS_ICON_SIZE || 20;

    return L.divIcon({
        className: 'custom-bus-icon',
        html: iconHtml,
        iconSize:[size, size],
        iconAnchor: [size / 2, size / 2], // サイズの半分を指定して中心を合わせる
        popupAnchor: [0, -(size / 2)]     // ポップアップがアイコンの上に被らないようにする
    });
}

async function updateBusPositions() {
    if (!window.map) return; 

    // active（データ取得対象）かつ visible（表示ON）の会社のみ処理する
    const activeCompanies = BUS_COMPANIES.filter(c => c.active && c.visible !== false);
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
                    // ここで createBusIcon を呼び出します
                    const icon = createBusIcon(company.id);
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
                    
                    // --- デバッグログ追加 ---
                    console.log(`🚌 バスをクリックしました: 車両ID=${vehicleId}, 検索TripID=${rawTripId}`);
                    
                    // ここでデータを取得
                    const stopsData = await window.getFullTimetableForTrip(rawTripId, company.id);
                    
                    // --- 取得結果のログ表示 ---
                    console.log(`📊 stopsDataの結果 (${vehicleId}):`, stopsData);
                    // -----------------------
                
                    if (stopsData && stopsData.length > 0) {
                        // 成功時
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
                        // データがない場合
                        console.warn(`⚠️ TripID: ${rawTripId} に該当する時刻表データが stop_times.txt に見つかりませんでした。`);
                        originLabel.innerHTML = `始発: データなし`;
                        container.innerHTML = `
                            <div style="padding:10px 5px; color:#888; line-height:1.4;">
                                ※時刻表データがありません。<br>
                                <small>(TripID: ${rawTripId})</small>
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
