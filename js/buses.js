// js/buses.js
const busMarkers = {};

/**
 * 会社ごとの色と枠線を持った四角形アイコンを生成する
 */
function createSquareIcon(companyId) {
    const isHirobus = (companyId === 'hirobus');
    const bgColor = isHirobus ? '#FF0000' : '#ADFF2F'; // 広島バス: 赤, 広電: 黄緑
    const borderColor = '#000000'; // どちらも黒枠

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
    if (!window.map || !window.routeJpLookup) return;

    const activeCompanies = BUS_COMPANIES.filter(c => c.active);
    const targetMap = window.map;
    const activeIds = new Set();

    // 会社ごとにループしてデータを取得
    for (const company of activeCompanies) {
        // Vercel APIを叩く (各社のIDをパラメータとして渡す)
        const realTimeUrl = `${company.realtimeUrl}&t=${Date.now()}`;

        try {
            const response = await fetch(realTimeUrl);
            if (!response.ok) {
                console.warn(`${company.name} のデータ取得に失敗しました`);
                continue;
            }

            const rawText = await response.text();
            let data;
            try {
                data = JSON.parse(rawText);
            } catch (e) {
                console.error(`${company.name} のJSONパース失敗`);
                continue;
            }

            const entities = data.entity || [];

            // 1. tripUpdate辞書の作成
            const delayMap = {};
            entities.forEach(item => {
                const update = item.tripUpdate;
                if (update && update.trip && update.trip.tripId) {
                    delayMap[update.trip.tripId] = update;
                }
            });

            // 2. 各車両の処理
            entities.forEach(item => {
                const v = item.vehicle;
                if (!v || !v.position) return;

                const rawTripId = v.trip ? v.trip.tripId : null;
                const rawRouteId = (v.trip && v.trip.routeId) ? v.trip.routeId : (v.routeId || null);
                
                // 辞書引き用にプレフィックス付きIDを作成
                const globalTripId = rawTripId ? `${company.id}_${rawTripId}` : null;
                const globalRouteId = rawRouteId ? `${company.id}_${rawRouteId}` : null;

                // 遅延情報の計算
                let delayText = "";
                const myUpdate = rawTripId ? delayMap[rawTripId] : null;
                if (myUpdate && myUpdate.stopTimeUpdate) {
                    const foundUpdate = myUpdate.stopTimeUpdate.find(stu => 
                        (stu.departure && stu.departure.delay !== undefined) || 
                        (stu.arrival && stu.arrival.delay !== undefined)
                    );
                    if (foundUpdate) {
                        const event = foundUpdate.departure || foundUpdate.arrival;
                        const delayMin = Math.floor(event.delay / 60);
                        if (delayMin > 0) {
                            delayText = `<span style="background:#fff3cd; color:#856404; padding:2px 5px; border-radius:4px; font-size:0.85em; margin-left:5px;">${delayMin}分遅れ</span>`;
                        } else if (delayMin < 0) {
                            delayText = `<span style="background:#d1ecf1; color:#0c5460; padding:2px 5px; border-radius:4px; font-size:0.85em; margin-left:5px;">早着</span>`;
                        } else {
                            delayText = `<span style="background:#d4edda; color:#155724; padding:2px 5px; border-radius:4px; font-size:0.85em; margin-left:5px;">定時</span>`;
                        }
                    }
                }

                const lat = parseFloat(v.position.latitude);
                const lon = parseFloat(v.position.longitude);
                if (isNaN(lat) || isNaN(lon)) return;

                // ユニークなID（会社名_車両ID）
                const vehicleId = `${company.id}_${(v.vehicle && v.vehicle.id) ? v.vehicle.id : (item.id || "no-id")}`;
                activeIds.add(vehicleId);

                // 路線情報の取得
                const jpInfo = (window.routeJpLookup && globalRouteId) ? window.routeJpLookup[globalRouteId] : null;
                
                let popupContent = "";
                if (jpInfo) {
                    const origin = (jpInfo.origin || "").trim();
                    const dest = (jpInfo.dest || "").trim();
                    const parentIdName = (jpInfo.jp_parent_route_id || "").trim();

                    let displayDest = dest;
                    let isLoop = false;
                    if (origin === dest && parentIdName !== "") {
                        displayDest = parentIdName;
                        isLoop = true;
                    }

                    const titleText = isLoop ? displayDest : `${displayDest} 行`;
                    const originHtml = isLoop ? "" : `<small>始発: ${origin}</small><br>`;
                    const viaHtml = jpInfo.via ? `<small>経由: ${jpInfo.via}</small>` : "";

                    popupContent = `
                        <div style="min-width:160px;">
                            <div style="font-size:0.8em; color:#666;">${company.name}</div>
                            <b style="color:#e60012; font-size:1.1em;">${titleText}</b>${delayText}<br>
                            <hr style="margin:5px 0; border:0; border-top:1px solid #eee;">
                            ${originHtml}
                            ${viaHtml}
                        </div>
                    `;
                } else {
                    popupContent = `${company.name} 運行中${delayText}`;
                }

                // マーカーの作成または更新
                if (busMarkers[vehicleId]) {
                    busMarkers[vehicleId].setLatLng([lat, lon]);
                    busMarkers[vehicleId].setPopupContent(popupContent);
                } else {
                    // ここで会社に応じた四角形アイコンを指定
                    const icon = createSquareIcon(company.id);
                    busMarkers[vehicleId] = L.marker([lat, lon], { icon: icon, zIndexOffset: 1000 })
                        .addTo(targetMap)
                        .bindPopup(popupContent, { autoClose: false });
                }
            });

        } catch (error) {
            console.error(`${company.name} の更新エラー:`, error);
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
