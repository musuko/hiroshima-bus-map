// buses.js
const busMarkers = {};

window.updateBusPositions = async function() {
    const realTimeUrl = "https://hiroden-api.vercel.app/api/get-bus";

    try {
        const response = await fetch(realTimeUrl, { cache: "no-store" });
        const data = await response.json();
        const entities = data.entity || [];

        if (entities.length === 0) {
            console.warn("バスのデータが空（0件）です。API側を確認してください。");
            return;
        }

        const busIcon = L.icon({
            iconUrl: './busimg/green.png',
            iconSize: [20, 20],
            iconAnchor: [10, 10],
            popupAnchor: [0, -20]
        });

        const activeIds = new Set();
        const targetMap = window.map; // グローバルのmapを確認

        entities.forEach(item => {
            const vehicle = item.vehicle;
            if (!vehicle || !vehicle.position) return;
        
            const lat = parseFloat(vehicle.position.latitude);
            const lon = parseFloat(vehicle.position.longitude);
            const id = vehicle.vehicle ? vehicle.vehicle.id : (item.id || "unknown");
            
            // 路線情報の取得
            const routeId = vehicle.trip ? vehicle.trip.route_id : null;
            const jpInfo = window.routeJpLookup ? window.routeJpLookup[routeId] : null;
        
            let popupContent = "";
            if (jpInfo) {
                // 文字数が多いので、見やすくレイアウト
                popupContent = `
                    <div style="min-width:150px;">
                        <b style="color:#28a745; font-size:1.1em;">${jpInfo.dest} 行</b><br>
                        <small style="color:#666;">始発: ${jpInfo.origin}</small>
                        ${jpInfo.via ? `<br><small style="color:#999;">経由: ${jpInfo.via}</small>` : ""}
                    </div>
                `;
            } else {
                popupContent = `路線情報なし (ID: ${routeId})`;
            }
        
            if (busMarkers[id]) {
                busMarkers[id].setLatLng([lat, lon]);
                // ポップアップ内容も更新
                busMarkers[id].setPopupContent(popupContent);
            } else {
                busMarkers[id] = L.marker([lat, lon], { icon: busIcon, zIndexOffset: 1000 })
                    .addTo(targetMap)
                    .bindPopup(popupContent);
            }
        });

        // 画面外のバスを削除
        Object.keys(busMarkers).forEach(id => {
            if (!activeIds.has(id)) {
                targetMap.removeLayer(busMarkers[id]);
                delete busMarkers[id];
            }
        });

        console.log(`更新成功: ${activeIds.size} 台のバスを表示中`);

    } catch (error) {
        console.error("バス位置の更新に失敗しました:", error);
    }
}
