const busMarkers = {};

window.updateBusPositions = async function() {
    const realTimeUrl = "https://hiroden-api.vercel.app/api/get-bus";

    try {
        const response = await fetch(realTimeUrl, { cache: "no-store" });
        const vehicles = await response.json();

        const busIcon = L.icon({
            iconUrl: './busimg/green.png',
            iconSize: [80, 80],
            iconAnchor: [40, 40],
        });

        const activeIds = new Set();

        vehicles.forEach(v => {
            const lat = v.lat;
            const lon = v.lon;
            const id = v.id || v.vehicle_id;

            if (!lat || !lon || !id) return;

            activeIds.add(id);

            if (busMarkers[id]) {
                busMarkers[id].setLatLng([lat, lon]);
            } else {
                busMarkers[id] = L.marker([lat, lon], {
                    icon: busIcon
                }).addTo(map);
            }
        });

        // 消えたバス削除
        Object.keys(busMarkers).forEach(id => {
            if (!activeIds.has(id)) {
                map.removeLayer(busMarkers[id]);
                delete busMarkers[id];
            }
        });

        console.log(`${vehicles.length} 台更新`);
    } catch (error) {
        console.error("バス取得失敗:", error);
    }
}
