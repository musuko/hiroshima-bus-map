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

// js/timetable.js (修正版)

async function getTimetableForStop(stopId) {
    const txtPath = './hiroden/stop_times.txt'; // txtに変更
    const now = new Date();
    const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    try {
        const response = await fetch(txtPath);
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        
        let partialData = '';
        let timetable = [];

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            partialData += decoder.decode(value, { stream: true });
            const lines = partialData.split(/\r?\n/);
            partialData = lines.pop();

            for (const line of lines) {
                if (line.includes(stopId)) {
                    const columns = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
                    
                    if (columns[3] === stopId) {
                        const tripId = columns[0]; // trip_id
                        const depTime = columns[2]; // departure_time
                        
                        if (depTime >= currentTimeStr) {
                            // 辞書から情報を引く
                            const tripInfo = tripLookup[tripId] || {};
                            const routeNo = routeLookup[tripInfo.routeId] || "";
                            const headsign = tripInfo.headsign || "不明";

                            timetable.push({
                                time: depTime,
                                routeNo: routeNo,
                                headsign: headsign
                            });
                        }
                    }
                }
            }
        }

        // 時刻順に並び替え（オブジェクトなので sort の書き方が少し変わります）
        return timetable.sort((a, b) => a.time.localeCompare(b.time));

    } catch (error) {
        console.error('時刻表読込エラー:', error);
        return [];
    }
}
