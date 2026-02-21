// js/buses.js
const busMarkers = {};

window.updateBusPositions = async function() {
    // 必要な準備が整っていなければ何もしない
    if (!window.map || !window.routeJpLookup) return;

    const realTimeUrl = "https://hiroden-api.vercel.app/api/get-bus?t=" + Date.now();

    try {
        const response = await fetch(realTimeUrl);
        const data = await response.json();
        const entities = data.entity || [];
        const targetMap = window.map;
        const activeIds = new Set();

        // 1. 【前処理】tripUpdateだけを集めて辞書を作る
        const delayMap = {};
        entities.forEach(item => {
            const update = item.tripUpdate;
            if (update && update.trip && update.trip.tripId) {
                delayMap[update.trip.tripId] = update;
            }
        });

        const busIcon = L.icon({
            iconUrl: './busimg/green.png',
            iconSize: [20, 20],
            iconAnchor: [10, 10],
            popupAnchor: [0, -10]
        });

        // 2. 【メイン処理】車両位置をループ
        entities.forEach(item => {
            const v = item.vehicle;
            if (!v || !v.position) return;

            const tripId = v.trip ? v.trip.tripId : null;
            const routeId = (v.trip && v.trip.routeId) ? v.trip.routeId : (v.routeId || null);
            
            // 3. 遅延情報の照合
            let delayText = "";
            const myUpdate = tripId ? delayMap[tripId] : null;

            if (myUpdate && myUpdate.stopTimeUpdate) {
                let delaySeconds = 0;
                // 最初に見つかった delay を取得
                const foundUpdate = myUpdate.stopTimeUpdate.find(stu => 
                    (stu.departure && stu.departure.delay !== undefined) || 
                    (stu.arrival && stu.arrival.delay !== undefined)
                );

                if (foundUpdate) {
                    const event = foundUpdate.departure || foundUpdate.arrival;
                    delaySeconds = event.delay;
                }

                const delayMin = Math.floor(delaySeconds / 60);
                if (delayMin > 0) {
                    delayText = `<span style="background:#fff3cd; color:#856404; padding:2px 5px; border-radius:4px; font-size:0.85em; margin-left:5px;">${delayMin}分遅れ</span>`;
                } else if (delayMin < 0) {
                    delayText = `<span style="background:#d1ecf1; color:#0c5460; padding:2px 5px; border-radius:4px; font-size:0.85em; margin-left:5px;">早着</span>`;
                } else {
                    delayText = `<span style="background:#d4edda; color:#155724; padding:2px 5px; border-radius:4px; font-size:0.85em; margin-left:5px;">定時</span>`;
                }
            }

            const lat = parseFloat(v.position.latitude);
            const lon = parseFloat(v.position.longitude);
            if (isNaN(lat) || isNaN(lon)) return;

            const id = (v.vehicle && v.vehicle.id) ? v.vehicle.id : (item.id || "no-id");
            activeIds.add(id);

            const jpInfo = (window.routeJpLookup && routeId) ? window.routeJpLookup[String(routeId)] : null;

            let popupContent = "";
            if (jpInfo) {
                popupContent = `
                    <div style="min-width:160px;">
                        <b style="color:#e60012; font-size:1.1em;">${jpInfo.dest} 行</b>${delayText}<br>
                        <hr style="margin:5px 0; border:0; border-top:1px solid #eee;">
                        <small>始発: ${jpInfo.origin}</small>
                        ${jpInfo.via ? `<br><small>経由: ${jpInfo.via}</small>` : ""}
                    </div>
                `;
            } else {
                popupContent = `運行中 (路線ID: ${routeId || '不明'})${delayText}`;
            }

            if (busMarkers[id]) {
                busMarkers[id].setLatLng([lat, lon]);
                busMarkers[id].setPopupContent(popupContent);
            } else {
                busMarkers[id] = L.marker([lat, lon], { icon: busIcon, zIndexOffset: 1000 })
                    .addTo(targetMap)
                    .bindPopup(popupContent, { autoClose: false });
            }
        });

        // 4. 削除処理
        Object.keys(busMarkers).forEach(id => {
            if (!activeIds.has(id)) {
                targetMap.removeLayer(busMarkers[id]);
                delete busMarkers[id];
            }
        });

        console.log(`🚌 更新成功: ${activeIds.size} 台のバスを表示中`);

    } catch (error) {
        console.error("バス位置の更新エラー:", error);
    }
};

