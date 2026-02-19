// js/timetable.js (または stops.js の末尾)

async function getTimetableForStop(stopId) {
    const csvPath = './hiroden/stop_times.txt'; // 拡張子がtxtかcsvか確認してください
    console.log(`${stopId} の時刻表を検索中...`);

    try {
        const response = await fetch(csvPath);
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        
        let result = '';
        let done = false;
        let timetable = [];

        // 巨大ファイル対策：ストリーミング読み込み
        while (!done) {
            const { value, done: doneReading } = await reader.read();
            done = doneReading;
            result += decoder.decode(value, { stream: !done });

            // 改行ごとに分割して処理
            let lines = result.split(/\r?\n/);
            // 最後の行は途切れている可能性があるので、次回のループに回す
            result = lines.pop();

            for (const line of lines) {
                if (line.includes(stopId)) {
                    const columns = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
                    // stop_idが完全一致するか確認 (列番号はGTFS標準で3番目付近)
                    // columns[3] が stop_id であることが多いです。データに合わせて調整。
                    if (columns.some(col => col === stopId)) {
                        timetable.push({
                            arrivalTime: columns[1], // 到着時刻
                            departureTime: columns[2] // 出発時刻
                        });
                    }
                }
            }
        }

        // 時刻順に並び替え
        timetable.sort((a, b) => a.departureTime.localeCompare(b.departureTime));
        
        return timetable;

    } catch (error) {
        console.error('時刻表読込エラー:', error);
        return [];
    }
}
