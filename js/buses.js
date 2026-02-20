// js/buses.js
const busMarkers = {};

window.updateBusPositions = async function() {
    const realTimeUrl = "https://hiroden-api.vercel.app/api/get-bus";

    try {
        const response = await fetch(realTimeUrl, { cache: "no-store" });
        const data = await response.json();
        const entities = data.entity || [];

        // 地図オブジェクトが準備できていない場合はスキップ
        const targetMap = window.map;
        if (!targetMap) return;

        const busIcon = L.icon({
            iconUrl: './busimg/green.png',
            iconSize: [80, 80],
            iconAnchor: [40, 40],
            popupAnchor: [0, -30] // 80pxのアイコンに合わせて少し上に調整
        });

        const activeIds = new Set();

        entities.forEach(item => {
            const vehicle = item.vehicle;
            if (!vehicle || !vehicle.position) return;

            const lat = parseFloat(vehicle.position.latitude);
            const lon = parseFloat(vehicle.position.longitude);
            const id = vehicle.vehicle ? vehicle.vehicle.id : (item.id || "unknown");

            if (!lat || !lon) return;
            activeIds.add(id);

            // 路線情報の取得をトライ
            let routeId = (vehicle.trip && vehicle.trip.route_id) ? vehicle.trip.route_id : null;
            let jpInfo = window.routeJpLookup ? window.routeJpLookup[routeId] : null;

            let popupContent = "";
            if (jpInfo) {
                popupContent = `
                    <div style="min-width:150px;">
                        <b style="color:#e60012; font-size:1.2em;">${jpInfo.dest} 行</b><br>
                        <hr style="margin:5px 0;">
                        <small>始発: ${jpInfo.origin}</small>
                        ${jpInfo.via ? `<br><small>経由: ${jpInfo.via}</small>` : ""}
                    </div>
                `;
            } else {
                popupContent = `運行中 (路線ID: ${routeId || '不明'})`;
            }

            if (busMarkers[id]) {
                busMarkers[id].setLatLng([lat, lon]);
                busMarkers[id].setIcon(busIcon);
                busMarkers[id].setPopupContent(popupContent);
            } else {
                busMarkers[id] = L.marker([lat, lon], {
                    icon: busIcon,
                    zIndexOffset: 1000
                }).addTo(targetMap)
                  .bindPopup(popupContent);
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
        console.error("バス位置の更新に失敗しました:", error);
    }
}
