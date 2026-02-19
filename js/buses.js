const busMarkers = {};

window.updateBusPositions = async function() {
    const realTimeUrl = "https://hiroden-api.vercel.app/api/get-bus";

    try {
        const response = await fetch(realTimeUrl, { cache: "no-store" });
        const data = await response.json();

        // Vercelから届くデータは data.entity に配列として入っています
        const entities = data.entity || [];

        const busIcon = L.icon({
            iconUrl: './busimg/green.png',
            iconSize: [80, 80],
            iconAnchor: [40, 40],
        });

        const activeIds = new Set();

        entities.forEach(item => {
            // GTFS-RTの深い構造から値を取り出す
            const vehicle = item.vehicle;
            if (!vehicle || !vehicle.position) return;

            const lat = vehicle.position.latitude;
            const lon = vehicle.position.longitude;
            const id = vehicle.vehicle.id; // 車両ID

            if (!lat || !lon || !id) return;

            activeIds.add(id);

            if (busMarkers[id]) {
                busMarkers[id].setLatLng([lat, lon]);
            } else {
                // 初めて登場したバスにマーカーを作成
                busMarkers[id] = L.marker([lat, lon], {
                    icon: busIcon
                }).addTo(map);
                
                // クリック時に車両IDを表示するポップアップ（デバッグ用）
                busMarkers[id].bindPopup(`車両ID: ${id}`);
            }
        });

        // 画面から消えたバスを地図から削除
        Object.keys(busMarkers).forEach(id => {
            if (!activeIds.has(id)) {
                map.removeLayer(busMarkers[id]);
                delete busMarkers[id];
            }
        });

        console.log(`${entities.length} 台のデータを処理しました`);
    } catch (error) {
        console.error("バス取得失敗:", error);
    }
}
