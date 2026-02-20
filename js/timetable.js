// js/timetable.js

let tripLookup = {};   
let routeLookup = {};  
let isGtfsReady = false;

async function prepareGtfsData() {
    try {
        // 1. routes.txt
        const rRes = await fetch('./hiroden/routes.txt');
        const rText = await rRes.text();
        const rRows = rText.trim().split(/\r?\n/).map(row => row.split(',').map(s => s.trim().replace(/^"|"$/g, '')));
        const rHead = rRows[0];
        const rIdIdx = rHead.indexOf('route_id');
        const rShortIdx = rHead.indexOf('route_short_name');
        const rLongIdx = rHead.indexOf('route_long_name');

        rRows.slice(1).forEach(cols => {
            if (cols.length > 1) {
                routeLookup[cols[rIdIdx]] = {
                    number: cols[rShortIdx] || "",
                    name: cols[rLongIdx] || ""
                };
            }
        });

        // 2. trips.txt
        const tRes = await fetch('./hiroden/trips.txt');
        const tText = await tRes.text();
        const tRows = tText.trim().split(/\r?\n/).map(row => row.split(',').map(s => s.trim().replace(/^"|"$/g, '')));
        const tHead = tRows[0];
        const tRouteIdx = tHead.indexOf('route_id');
        const tTripIdx = tHead.indexOf('trip_id');

        tRows.slice(1).forEach(cols => {
            if (cols.length > 1) {
                tripLookup[cols[tTripIdx]] = cols[tRouteIdx];
            }
        });

        isGtfsReady = true;
        console.log("✅ GTFS辞書の準備が完了しました");
    } catch (e) {
        console.error("❌ 辞書作成エラー:", e);
    }
}

prepareGtfsData();

async function getTimetableForStop(stopId) {
    // 辞書の準備ができるまで待機（最大3秒）
    let waitCount = 0;
    while (!isGtfsReady && waitCount < 30) {
        await new Promise(r => setTimeout(r, 100));
        waitCount++;
    }

    const txtPath = './hiroden/stop_times.txt';
    const now = new Date();
    // 比較用に現在の時刻文字列を作成
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
                // stopIdが含まれている行だけ詳しく解析
                if (line.includes(stopId)) {
                    const columns = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
                    
                    // stop_id(4列目/index:3) が一致するか確認
                    if (columns[3] === stopId) {
                        const tripId = columns[0];
                        const depTime = columns[2];
                        
                        if (depTime >= currentTimeStr) {
                            const routeId = tripLookup[tripId];
                            const routeInfo = routeLookup[routeId] || { number: "", name: "不明" };

                            timetable.push({
                                time: depTime,
                                routeNo: routeInfo.number,
                                headsign: routeInfo.name
                            });
                        }
                    }
                }
            }
        }

        // 時刻順に並び替え
        return timetable.sort((a, b) => a.time.localeCompare(b.time));

    } catch (error) {
        console.error('時刻表読込失敗:', error);
        return [];
    }
}
