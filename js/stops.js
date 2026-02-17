window.loadStopsFromZip = async function() {
    try {
        const response = await fetch('./hiroden/current_data.zip');
        if (!response.ok) throw new Error("ZIPファイルが見つかりません");

        const blob = await response.blob();
        const zip = await JSZip.loadAsync(blob);
        const stopsText = await zip.file("stops.txt").async("string");

        Papa.parse(stopsText, {
            header: true,
            skipEmptyLines: true,
            complete: function(results) {
                const stops = results.data;

                stops.forEach(stop => {
                    if (stop.stop_lat && stop.stop_lon) {
                        L.circleMarker([stop.stop_lat, stop.stop_lon], {
                            radius: 5,
                            fillColor: "#00ff00",
                            color: "#000",
                            weight: 1,
                            opacity: 1,
                            fillOpacity: 0.8
                        })
                        .addTo(map)
                        .bindPopup(`<b>${stop.stop_name}</b>`);
                    }
                });

                console.log(`${stops.length} 件のバス停`);
            }
        });
    } catch (error) {
        console.error("バス停エラー:", error);
    }
}
