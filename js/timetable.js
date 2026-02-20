// js/timetable.js

async function getTimetableForStop(stopId) {
    // 1. まず、どのIDで検索しようとしているか表示
    console.log("--- 時刻表検索開始 ---");
    console.log("検索するバス停ID:", `[${stopId}]`); // 空白を含めて確認

    const txtPath = './hiroden/stop_times.txt';

    try {
        const response = await fetch(txtPath);
        if (!response.ok) {
            console.error("ファイルが見つかりません:", txtPath);
            return [];
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let partialData = '';
        let count = 0;

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            partialData += decoder.decode(value, { stream: true });
            const lines = partialData.split(/\r?\n/);
            partialData = lines.pop();

            for (const line of lines) {
                // 2. とにかくその ID が行に含まれているかチェック
                if (line.includes(stopId)) {
                    count++;
                    if (count === 1) {
                        console.log("一致する行を初めて発見しました！");
                        console.log("生データ行:", line);
                        const columns = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
                        console.log("分割後の配列:", columns);
                    }
                }
            }
        }

        console.log(`検索終了。合計 ${count} 行見つかりました。`);
        return []; // テスト中なので空を返す

    } catch (error) {
        console.error('エラー発生:', error);
        return [];
    }
}
