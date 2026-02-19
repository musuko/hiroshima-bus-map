/**
 * 広電のstops.csvを読み込み、地図上に表示する
 * @param {Object} map - Leaflet等の地図インスタンス
 */
async function loadStopsFromCsv(map) {
    const csvPath = './hiroden/stops.csv';

    try {
        const response = await fetch(csvPath);
        const csvText = await response.text();

        // 1. 改行コードで分割して行ごとの配列にする
        const rows = csvText.trim().split(/\r?\n/);
        
        // 2. ヘッダー行から各項目のインデックスを特定する
        const headers = splitCsvRow(rows[0]);
        const idxLat = headers.indexOf('stop_lat');
        const idxLon = headers.indexOf('stop_lon');
        const idxName = headers.indexOf('stop_name');

        // 3. データ行をループしてマーカーを作成
        for (let i = 1; i < rows.length; i++) {
            const columns = splitCsvRow(rows[i]);
            
            const lat = parseFloat(columns[idxLat]);
            const lon = parseFloat(columns[idxLon]);
            const name = columns[idxName];

            if (!isNaN(lat) && !isNaN(lon)) {
                // ここで地図に描画（例：Leafletの場合）
                L.marker([lat, lon])
                    .addTo(map)
                    .bindPopup(name);
            }
        }
        console.log(`読込完了: ${rows.length - 1}件`);

    } catch (error) {
        console.error('CSV読込エラー:', error);
    }
}

/**
 * CSVの1行をカンマで分割する。
 * ダブルクォーテーション内のカンマを無視する正規表現を使用。
 */
function splitCsvRow(row) {
    // この正規表現は「カンマ」で区切るが、「" "」で囲まれた中のカンマは無視します
    const regex = /(".*?"|[^",\s]+)(?=\s*,|\s*$)/g;
    const matches = row.match(regex);
    
    if (!matches) return row.split(','); // 万が一マッチしない場合のフォールバック
    
    // 前後のダブルクォーテーションを除去して返す
    return matches.map(val => val.replace(/^"|"$/g, ''));
}
