// js/timetable.js
// メモリ上に保持する辞書
let tripLookup = {}; // { trip_id: { routeId, headsign } }
let routeLookup = {}; // { route_id: route_short_name }

// ページ読み込み時に実行する準備関数
async function prepareGtfsData() {
    try {
        // 1. routes.txt から路線番号(short_name)を読み込む
        const rRes = await fetch('./hiroden/routes.txt');
        const rText = await rRes.text();
        rText.split(/\r?\n/).slice(1).forEach(line => {
            const c = line.split(',').map(s => s.trim().replace(/^"|"$/g, ''));
            if (c.length > 2) routeLookup[c[0]] = c[2]; // route_id -> route_short_name
        });

        // 2. trips.txt から便情報を読み込む
        const tRes = await fetch('./hiroden/trips.txt');
        const tText = await tRes.text();
        tText.split(/\r?\n/).slice(1).forEach(line => {
            const c = line.split(',').map(s => s.trim().replace(/^"|"$/g, ''));
            if (c.length > 3) {
                // trip_id(2番目) をキーにする ※列番号は実際のファイルを確認してください
                // 広電の標準的な並び: route_id(0), service_id(1), trip_id(2), trip_headsign(3)
                tripLookup[c[2]] = { routeId: c[0], headsign: c[3] };
            }
        });
        console.log("GTFS辞書の準備が完了しました");
    } catch (e) {
        console.error("辞書作成エラー:", e);
    }
}

// ページ読み込み時に一度だけ実行
prepareGtfsData();

async function getTimetableForStop(stopId) {
    const csvPath = './hiroden/stop_times.csv';
    const now = new Date();
    // 現在時刻を "HH:MM:SS" 形式に（比較用）
    const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    try {
        const response = await fetch(csvPath);
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        
        let partialData = '';
        let timetable = [];

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            partialData += decoder.decode(value, { stream: true });
            const lines = partialData.split(/\r?\n/);
            partialData = lines.pop(); // 途切れた最終行を次回へ

            for (const line of lines) {
                // 高速化のため、行に stopId が含まれている場合のみ詳しく解析
                if (line.includes(stopId)) {
                    const columns = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
                    
                    // stop_id（3番目の列）が完全一致するか確認
                    if (columns[3] === stopId) {
                        const depTime = columns[2]; // departure_time
                        // 今日これからの便だけを抽出（オプション）
                        if (depTime >= currentTimeStr) {
                            timetable.push(depTime);
                        }
                    }
                }
            }
        }

        // 時刻順に並び替えて重複を除去
        return [...new Set(timetable)].sort();

    } catch (error) {
        console.error('時刻表読込エラー:', error);
        return [];
    }
}
