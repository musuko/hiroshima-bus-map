// js/buses.js
const busMarkers = {};

window.updateBusPositions = async function() {
    // キャッシュを回避するためにクエリパラメータを付与
    const realTimeUrl = "https://hiroden-api.vercel.app/api/get-bus?t=" + Date.now();

    try {
        const response = await fetch(realTimeUrl);
        const data = await response.json();
        
        // --- デバッグログ: APIの構造をそのまま表示 ---
        console.log("--- API Raw Data ---", data);
        
        const entities = data.entity || [];
        console.log("Entity count:", entities.length);
        
        if (entities.length > 0) {
            console.log("First entity sample:", entities[0]);
        }
        // ------------------------------------------

        const targetMap = window.map;
        const activeIds = new Set();
        const busIcon = L.icon({
            iconUrl: './busimg/green.png',
            iconSize: [80, 80],
            iconAnchor: [40, 40],
            popupAnchor: [0, -30]
        });

        entities.forEach(item => {
            const vehicle = item.vehicle;
            if (!vehicle) return;

            // 座標の取得 (APIの仕様変更に対応できるよう柔軟に)
            const pos = vehicle.position;
            if (!pos) return;

            const lat = parseFloat(pos.latitude);
            const lon = parseFloat(pos.longitude);
            if (isNaN(lat) || isNaN(lon)) return;

            // IDの取得 (複数の候補を試す)
            const id = (vehicle.vehicle && vehicle.vehicle.id) ? vehicle.vehicle.id : 
                       (item.id ? item.id : Math.random().toString());

            activeIds.add(id);

            // 路線情報の取得
            const routeId = (vehicle.trip && vehicle.trip.route_id) ? vehicle.trip.route_id : null;
            const jpInfo = window.routeJpLookup ? window.routeJpLookup[routeId] : null;

            let popupContent = "";
            if (jpInfo) {
                popupContent = `
                    <div style="min-width:160px;">
                        <span style="color:#666; font-size:0.8em;">終点</span><br>
                        <b style="color:#e60012; font-size:1.3em;">${jpInfo.dest}</b><br>
                        <hr style="margin:5px 0; border:0; border-top:1px solid #eee;">
                        <small>始発: ${jpInfo.origin}</small>
                        ${jpInfo.via ? `<br><small>経由: ${jpInfo.via}</small>` : ""}
                    </div>
                `;
            } else {
                popupContent = `運行中 (ID: ${routeId || '不明'})`;
            }

            if (busMarkers[id]) {
                busMarkers[id].setLatLng([lat, lon]);
                busMarkers[id].setIcon(busIcon);
                busMarkers[id].setPopupContent(popupContent);
            } else {
                busMarkers[id] = L.marker([lat, lon], {
                    icon: busIcon,
                    zIndexOffset: 1000
                }).addTo(targetMap).bindPopup(popupContent);
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
