// mapをグローバル化（重要）
window.map = L.map('map').setView([34.3976, 132.4754], 12);

// 背景
L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png', {
  attribution: "<a href='https://maps.gsi.go.jp' target='_blank'>地理院タイル</a>"
}).addTo(map);

// スケール
L.control.scale({
  position: "bottomright",
  imperial: false
}).addTo(map);

// ===== 現在地表示 =====
let userMarker = null;

function startGeolocation() {
    if (!navigator.geolocation) {
        console.warn("このブラウザは位置情報非対応");
        return;
    }

    navigator.geolocation.watchPosition(pos => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;

        if (!userMarker) {
            userMarker = L.circleMarker([lat, lon], {
                radius: 8,
                color: "#fff",
                weight: 2,
                fillColor: "#007bff",
                fillOpacity: 1
            }).addTo(map);
        } else {
            userMarker.setLatLng([lat, lon]);
        }
    }, err => {
        console.warn("位置情報エラー:", err.message);
    }, {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 10000
    });
}
🚀 呼び出しを忘れない
