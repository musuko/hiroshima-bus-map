// js/buses.js
const busMarkers = {};

window.updateBusPositions = async function() {
    const realTimeUrl = "https://hiroden-api.vercel.app/api/get-bus?t=" + Date.now();

    try {
        const response = await fetch(realTimeUrl);
        const data = await response.json();
        const entities = data.entity || [];
        const targetMap = window.map;
        const activeIds = new Set();

        // アイコン定義はループの外で1回やるのが効率的
        const busIcon = L.icon({
            iconUrl: './busimg/green.png',
            iconSize: [20, 20],
            iconAnchor: [10, 10],
            popupAnchor: [0, -10]
        });

        entities.forEach(item => {
            const v = item.vehicle;
            if (!v || !v.position) return;

            // --- routeId の取得 (大文字・小文字両方に対応) ---
            const routeId = (v.trip && v.trip.routeId) ? v.trip.routeId : 
                            (v.trip && v.trip.route_id) ? v.trip.route_id : 
                            (v.routeId || v.route_id || null);

            const lat = parseFloat(v.position.latitude);
            const lon = parseFloat(v.position.longitude);
            if (isNaN(lat) || isNaN(lon)) return;

            const id = (v.vehicle && v.vehicle.id) ? v.vehicle.id : (item.id || "no-id");
            activeIds.add(id);

            // 辞書引き
            const jpInfo = (window.routeJpLookup && routeId) ? window.routeJpLookup[String(routeId)] : null;

            let popupContent = "";
            if (jpInfo) {
                popupContent = `
                    <div style="min-width:160px;">
                        <b style="color:#e60012; font-size:1.1em;">${jpInfo.dest} 行</b><br>
                        <small>始発: ${jpInfo.origin}</small>
                        ${jpInfo.via ? `<br><small>経由: ${jpInfo.via}</small>` : ""}
                    </div>
                `;
            } else {
                popupContent = `運行中 (路線ID: ${routeId || '取得失敗'})`;
            }

            if (busMarkers[id]) {
                busMarkers[id].setLatLng([lat, lon]);
                busMarkers[id].setIcon(busIcon); // アイコン更新
                busMarkers[id].setPopupContent(popupContent);
            } else {
                busMarkers[id] = L.marker([lat, lon], { icon: busIcon, zIndexOffset: 1000 })
                    .addTo(targetMap).bindPopup(popupContent);
            }
        });

        // 削除処理
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
