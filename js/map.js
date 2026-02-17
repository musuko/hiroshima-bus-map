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
