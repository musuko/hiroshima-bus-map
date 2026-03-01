// js/trip_details.js

async function getFullTimetableForTrip(tripId, companyId) {
    if (!tripId) return[];
    
    const company = window.BUS_COMPANIES.find(c => c.id === companyId);
    if (!company) return[];

    const tripStops =[];
    let tIdx = -1, sIdx = -1, aIdx = -1, sqIdx = -1;

    // 1つのテキストデータ（ファイル）から対象のバスの時刻を抽出する関数
    const processText = (text, isFirstFile) => {
        const lines = text.trim().split(/\r?\n/);
        if (lines.length === 0) return;

        let startIndex = 0;
        
        // ヘッダー（1行目）の解析
        // ※分割された2つ目以降のファイルにもヘッダーが付いている場合を考慮
        const firstLine = lines[0].toLowerCase();
        if (isFirstFile || firstLine.includes('trip_id')) {
            const head = lines[0].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
            tIdx = head.indexOf('trip_id');
            sIdx = head.indexOf('stop_id');
            aIdx = head.indexOf('arrival_time');
            sqIdx = head.indexOf('stop_sequence');
            startIndex = 1; // ヘッダー行をスキップ
        }

        // ヘッダーが見つからなければ処理しない（異常なファイル）
        if (tIdx === -1) return;

        for (let i = startIndex; i < lines.length; i++) {
            // 高速化のため、まずその行に tripId の文字列が含まれているかサクッと確認
            if (lines[i].includes(tripId)) {
                const cols = lines[i].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
                if (cols[tIdx] === tripId) {
                    const sId = cols[sIdx];
                    tripStops.push({
                        stopId: sId,
                        // ★前回の修正（名前を正しく表示する）
                        stopName: window.globalStopMap?.get(sId)?.name || `停留所(${sId})`,
                        time: cols[aIdx] ? cols[aIdx].substring(0, 5) : "--:--",
                        sequence: parseInt(cols[sqIdx])
                    });
                }
            }
        }
    };

    try {
        // 【パターン1】まずは分割されていない通常の stop_times.txt を探す
        const texts = await window.loadGtfsTextFiles(company, "stop_times");
        
        texts.forEach((text, index) => {
            processText(text, index === 0);
        });

        // 順番通りに並び替えて返す
        return tripStops.sort((a, b) => a.sequence - b.sequence);

    } catch (e) {
        // 通信エラーなどの場合
        console.error("stop_times processing error:", e);
        return[]; // ← ここで空の配列を返す
    }
}

// 最後にグローバル関数として登録する
window.getFullTimetableForTrip = getFullTimetableForTrip;
