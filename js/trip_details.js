// js/trip_details.js

// stop_times.txtから、時刻表に必要なデータを抽出
async function getFullTimetableForTrip(tripId, companyId) {
    if (!tripId) return[];
    
    const company = window.BUS_COMPANIES.find(c => c.id === companyId);
    if (!company) return[];

    const tripStops =[];
    let tIdx = -1, sIdx = -1, aIdx = -1, sqIdx = -1;

    // 1つの stop_times テキストから、指定された tripId の情報(時刻など)を抽出する関数
    const processText = (text, isFirstFile) => {
        const lines = text.trim().split(/\r?\n/);
        if (lines.length === 0) return;

        let startIndex = 0;
        
        // ヘッダー（1行目）の解析、どの列に何が入っているか記憶する
        const firstLine = lines[0].toLowerCase();
        // 一つ目おファイルなら無条件で成立。二つ目以降は、trip_idを含んでいれば成立
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
                // trip_idが一致する行のみ処理
                if (cols[tIdx] === tripId) {
                    const sId = cols[sIdx];
                    // そのバスの時刻表だけを配列に溜める
                    tripStops.push({
                        stopId: sId,
                        stopName: window.globalStopMap?.get(sId)?.name || `停留所(${sId})`,
                        time: cols[aIdx] ? cols[aIdx].substring(0, 5) : "--:--",
                        sequence: parseInt(cols[sqIdx])
                    });
                }
            }
        }
    };

    try {
        // stop_times.txt、または、stop_times_1. txtstop_times_2.txt ...を全部読み込む
        const texts = await window.loadGtfsTextFiles(company, "stop_times");
        // ファイルの中身(text)と、何番目のファイル(index)か
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
