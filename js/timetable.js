// js/timetable.js
let tripLookup = {};   
let routeLookup = {};  
let isGtfsReady = false;

async function prepareGtfsData() {
    try {
        const rRes = await fetch('./hiroden/routes.txt');
        const rText = await rRes.text();
        const rRows = rText.trim().split(/\r?\n/).map(row => row.split(',').map(s => s.trim().replace(/^"|"$/g, '')));
        const rHead = rRows[0];
        
        rRows.slice(1).forEach(cols => {
            if (cols.length > 1) {
                routeLookup[cols[rHead.indexOf('route_id')]] = {
                    number: cols[rHead.indexOf('route_short_name')],
                    name: cols[rHead.indexOf('route_long_name')]
                };
            }
        });

        const tRes = await fetch('./hiroden/trips.txt');
        const tText = await tRes.text();
        const tRows = tText.trim().split(/\r?\n/).map(row => row.split(',').map(s => s.trim().replace(/^"|"$/g, '')));
        const tHead = tRows[0];

        tRows.slice(1).forEach(cols => {
            if (cols.length > 1) {
                // trip_id をキー、route_id を値に
                tripLookup[cols[tHead.indexOf('trip_id')]] = cols[tHead.indexOf('route_id')];
            }
        });

        isGtfsReady = true;
        console.log("✅ 辞書準備完了");
    } catch (e) {
        console.error("❌ 辞書作成失敗:", e);
    }
}

prepareGtfsData();

async function getTimetableForStop(stopId) {
    const txtPath = './hiroden/stop_times.txt';
    const now = new Date();
    // 比較用（11:44現在なら 17:07 は表示されるはず）
    const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`;

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
                        const tripId = columns[0];
                        const depTime = columns[2];
                        
                        // 辞書引きのデバッグ
                        const routeId = tripLookup[tripId];
                        const routeInfo = routeLookup[routeId];

                        if (stopId === "51550 2") {
                            console.log(`--- [51550 2] 照合チェック ---`);
                            console.log(`時刻: ${depTime} (現在時刻: ${currentTimeStr})`);
                            console.log(`tripId: [${tripId}]`);
                            console.log(`routeId: [${routeId}]`);
                            console.log(`routeInfo:`, routeInfo);
                        }

                        // 時刻が未来、かつ辞書に情報がある場合のみ追加
                        if (depTime >= currentTimeStr) {
                            timetable.push({
                                time: depTime,
                                routeNo: routeInfo ? routeInfo.number : "不明",
                                headsign: routeInfo ? routeInfo.name : "不明"
                            });
                        }
                    }
                }
            }
        }
        return timetable.sort((a, b) => a.time.localeCompare(b.time));
    } catch (error) {
        return [];
    }
}
