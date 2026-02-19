// js/timetable.js

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
