// mapをグローバル化（重要）
const map = L.map('map').setView([34.3976, 132.4754], 12);
window.map = map;

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
let firstFix = true;   // ← ここ重要

window.startGeolocation = function () {
    if (!navigator.geolocation) {
        console.warn("このブラウザは位置情報非対応");
        return;
    }

    navigator.geolocation.watchPosition(pos => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;

        if (!userMarker) {
            userMarker = L.marker([lat, lon], {
                zIndexOffset: 10000
            }).addTo(map);
        } else {
            userMarker.setLatLng([lat, lon]).bringToFront();
        }
        if (firstFix) {
            map.setView([lat, lon], 16);
            firstFix = false;
        }
    }, err => {
        console.warn("位置情報エラー:", err.message);
    }, {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 10000
    });
}
