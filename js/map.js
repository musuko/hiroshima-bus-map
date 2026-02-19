// mapをグローバル化（重要）、maxZoom を追加
const map = L.map('map',{
  maxZoom: 21 // 地図として許容する最大ズーム
}).setView([34.3976, 132.4754], 12);
window.map = map;

// 背景
L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png', {
  attribution: "<a href='https://maps.gsi.go.jp' target='_blank'>地理院タイル</a>",
  minZoom: 2,
  maxZoom: 21,      // 21段階まで拡大操作を許可する
  maxNativeZoom: 18 // 地理院タイル自体の画像があるのは18までなので、それ以降は引き伸ばして表示
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
                zIndexOffset: 10000 // 最初から高い値に設定
            }).addTo(map);
        } else {
            // .bringToFront() を削除し、setLatLng だけにする
            userMarker.setLatLng([lat, lon]);
            // もし他のマーカーより確実に上にしたいなら、再度オフセットを設定（念のため）
            // userMarker.setZIndexOffset(10000); 
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
