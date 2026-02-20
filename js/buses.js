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
            iconSize: [40, 40],
            iconAnchor: [20, 20],
            popupAnchor: [0, -20]
        });

        const activeIds = new Set();
        const targetMap = window.map; // グローバルのmapを確認

        entities.forEach(item => {
            const vehicle = item.vehicle;
            if (!vehicle || !vehicle.position) return;

            const lat = parseFloat(vehicle.position.latitude);
            const lon = parseFloat(vehicle.position.longitude);
            // 階層が深いので注意深く取得
            const id = vehicle.vehicle ? vehicle.vehicle.id : (item.id || "unknown");

            if (!lat || !lon) return;

            activeIds.add(id);

            if (busMarkers[id]) {
                busMarkers[id].setLatLng([lat, lon]);
            } else {
                // console.log(`新規バス追加: ID=${id} at [${lat}, ${lon}]`);
                busMarkers[id] = L.marker([lat, lon], {
                    icon: busIcon,
                    zIndexOffset: 1000 // バス停より上に表示
                }).addTo(targetMap)
                  .bindPopup(`車両ID: ${id}`);
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
