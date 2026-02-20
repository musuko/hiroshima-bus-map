// js/buses.js
const busMarkers = {};

window.updateBusPositions = async function() {
    const realTimeUrl = "https://hiroden-api.vercel.app/api/get-bus";

    try {
        const response = await fetch(realTimeUrl, { cache: "no-store" });
        const data = await response.json();
        
        // 1. entityが存在するか、配列かチェック
        const entities = data.entity || [];
        if (!Array.isArray(entities) || entities.length === 0) {
            console.warn("APIから有効なバスデータが届いていません(0件)。");
            return;
        }

        const targetMap = window.map;
        const activeIds = new Set();
        
        const busIcon = L.icon({
            iconUrl: './busimg/green.png',
            iconSize: [80, 80],
            iconAnchor: [40, 40],
            popupAnchor: [0, -30]
        });

        entities.forEach(item => {
            // 2. vehicleオブジェクトの安全な取得
            const vehicle = item.vehicle;
            if (!vehicle) return;

            // 3. 座標の安全な取得 (文字列を数値に変換)
            const pos = vehicle.position;
            if (!pos || pos.latitude === undefined || pos.longitude === undefined) return;

            const lat = parseFloat(pos.latitude);
            const lon = parseFloat(pos.longitude);

            // 4. 数値として有効かチェック
            if (isNaN(lat) || isNaN(lon)) return;

            // 5. IDの特定
            const id = (vehicle.vehicle && vehicle.vehicle.id) ? vehicle.vehicle.id : (item.id || "no-id");
            activeIds.add(id);

            // 6. 路線情報の紐付け (routeJpLookup)
            const routeId = (vehicle.trip && vehicle.trip.route_id) ? vehicle.trip.route_id : null;
            const jpInfo = window.routeJpLookup ? window.routeJpLookup[routeId] : null;

            let popupContent = "";
            if (jpInfo) {
                popupContent = `
                    <div style="min-width:160px; font-family: sans-serif;">
                        <span style="color:#666; font-size:0.8em;">終点</span><br>
                        <b style="color:#e60012; font-size:1.3em; line-height:1.2;">${jpInfo.dest}</b><br>
                        <div style="margin-top:8px; border-top:1px solid #eee; padding-top:4px;">
                            <small>始発: ${jpInfo.origin}</small>
                            ${jpInfo.via ? `<br><small>経由: ${jpInfo.via}</small>` : ""}
                        </div>
                    </div>
                `;
            } else {
                popupContent = `<div style="padding:5px;">運行中 (路線ID: ${routeId || '不明'})</div>`;
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

        // 7. 存在しなくなったバスを削除
        Object.keys(busMarkers).forEach(id => {
            if (!activeIds.has(id)) {
                targetMap.removeLayer(busMarkers[id]);
                delete busMarkers[id];
            }
        });

        console.log(`🚌 更新成功: ${activeIds.size} 台のバスを表示中`);

    } catch (error) {
        console.error("バス位置の更新中にエラーが発生しました:", error);
    }
}
