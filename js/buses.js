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

                // ポップアップのベースHTML（時刻表を表示する空のdivを追加）
                const finalPopupHtml = `
                    <div id="popup-${vehicleId}" style="min-width:180px;">
                        ${popupContent}
                        <hr style="margin:5px 0; border:0; border-top:1px solid #eee;">
                        <div class="trip-timetable-container" style="max-height:150px; overflow-y:auto; font-size:11px; color:#555;">
                            <span style="color:#999;">クリックで全停留所の時刻表を表示</span>
                        </div>
                    </div>
                `;

                // マーカーの作成または更新
                if (busMarkers[vehicleId]) {
                    busMarkers[vehicleId].setLatLng([lat, lon]);
                    
                    // 【改善】ポップアップが開いている間は、中身を上書きしない
                    // これにより、読み込んだ時刻表が自動更新で消えるのを防ぎます
                    const currentPopup = busMarkers[vehicleId].getPopup();
                    if (!currentPopup.isOpen()) {
                        busMarkers[vehicleId].setPopupContent(finalPopupHtml);
                    }
                } else {
                    const icon = createSquareIcon(company.id);
                    const marker = L.marker([lat, lon], { icon: icon, zIndexOffset: 1000 })
                        .addTo(targetMap)
                        .bindPopup(finalPopupHtml, { autoClose: false });

                    // 【追加】クリックイベントで詳細時刻表をロード
                    marker.on('click', async () => {
                        // 少し待ってからDOMを取得（Leafletのポップアップ描画待ち）
                        await new Promise(r => setTimeout(r, 100));
                        const container = document.querySelector(`#popup-${vehicleId} .trip-timetable-container`);
                        if (!container) return;

                        container.innerHTML = "時刻表を読み込み中...";

                        // timetable.js の関数を呼び出し
                        const stops = await window.getFullTimetableForTrip(rawTripId, company.id);
                        
                        if (stops.length === 0) {
                            container.innerHTML = "時刻表データがありません。";
                            return;
                        }

                        let tableHtml = `
                            <table style="width:100%; border-collapse:collapse; margin-top:5px;">
                                <tr style="background:#f8f9fa; position:sticky; top:0;">
                                    <th style="text-align:left; padding:2px; border-bottom:1px solid #ddd;">停留所</th>
                                    <th style="text-align:right; padding:2px; border-bottom:1px solid #ddd;">時刻</th>
                                </tr>
                        `;
                        stops.forEach(s => {
                            tableHtml += `
                                <tr style="border-bottom:1px solid #f0f0f0;">
                                    <td style="padding:3px 2px;">${s.stopName}</td>
                                    <td style="padding:3px 2px; text-align:right; white-space:nowrap;">${s.time}</td>
                                </tr>`;
                        });
                        tableHtml += `</table>`;
                        container.innerHTML = tableHtml;
                    });

                    busMarkers[vehicleId] = marker;
                }
            // --- ここまで ---
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
