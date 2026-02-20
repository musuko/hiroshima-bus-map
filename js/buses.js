// js/buses.js
const busMarkers = {};

window.updateBusPositions = async function() {
    if (!window.map || !window.routeJpLookup) return;

    const realTimeUrl = "https://hiroden-api.vercel.app/api/get-bus?t=" + Date.now();

    try {
        const response = await fetch(realTimeUrl);
        const data = await response.json();
        const entities = data.entity || [];
        const targetMap = window.map;
        const activeIds = new Set();

        const busIcon = L.icon({
            iconUrl: './busimg/green.png',
            iconSize: [20, 20],
            iconAnchor: [10, 10],
            popupAnchor: [0, -10]
        });

        entities.forEach(item => {
            const v = item.vehicle;
            if (!v || !v.position) return;

            // 1. routeId の取得
            const routeId = (v.trip && v.trip.routeId) ? v.trip.routeId : 
                            (v.trip && v.trip.route_id) ? v.trip.route_id : 
                            (v.routeId || v.route_id || null);

            // 2. 遅延情報の取得 (tripUpdate階層から)
            const update = item.tripUpdate || item.trip_update;
            let delayText = "";
            if (update && update.delay !== undefined) {
                const delayMin = Math.floor(update.delay / 60);
                if (delayMin > 0) {
                    delayText = `<span style="color:#e67e22; font-weight:bold; margin-left:5px;">(${delayMin}分遅れ)</span>`;
                } else if (delayMin < 0) {
                    delayText = `<span style="color:#3498db; margin-left:5px;">(早着)</span>`;
                } else {
                    delayText = `<span style="color:#27ae60; margin-left:5px;">(定時)</span>`;
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
                busMarkers[id].setIcon(busIcon);
                // ポップアップが開いていても内容だけ更新する
                busMarkers[id].setPopupContent(popupContent);
            } else {
                busMarkers[id] = L.marker([lat, lon], { icon: busIcon, zIndexOffset: 1000 })
                    .addTo(targetMap)
                    .bindPopup(popupContent, { autoClose: false }); // 他を開いても閉じない
            }
        });

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
}
