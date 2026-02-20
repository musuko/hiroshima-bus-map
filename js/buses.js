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
        const v = item.vehicle;
        if (!v || !v.position) return;
    
        const lat = parseFloat(v.position.latitude);
        const lon = parseFloat(v.position.longitude);
        if (isNaN(lat) || isNaN(lon)) return;
    
        const id = (v.vehicle && v.vehicle.id) ? v.vehicle.id : (item.id || "no-id");
        activeIds.add(id);
    
        // --- 探索ルートをさらに具体化 ---
        // 1. v.trip.route_id (GTFS標準)
        // 2. v.route_id (一部の独自拡張)
        let routeId = null;
        if (v.trip && v.trip.route_id) {
            routeId = v.trip.route_id;
        } else if (v.route_id) {
            routeId = v.route_id;
        }
    
        // 辞書引き (型を文字列に強制一致させる)
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
            // IDが取れているのに辞書にないのか、ID自体が取れていないのかを判別
            popupContent = `運行中 (路線ID: ${routeId || '取得失敗'})`;
        }
    
        const busIcon = L.icon({
            iconUrl: './busimg/green.png',
            iconSize: [20, 20],      // 修正後のサイズ
            iconAnchor: [10, 10],    // 修正後のアンカー
            popupAnchor: [0, -10]    // サイズに合わせて調整
        });
    
        if (busMarkers[id]) {
            busMarkers[id].setLatLng([lat, lon]);
            busMarkers[id].setIcon(busIcon);
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
