import datetime
import io
import os
import urllib.request
import zipfile

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TARGET_BASE_DIR = os.path.join(BASE_DIR, "data")

# 【設定】バス会社URLリスト
# ※末尾に .zip がない元のダウンロードURLをそのまま指定して問題ありません
BUS_DATA_LIST = [
    {"name": "hiroden", "url": "https://ajt-mobusta-gtfs.mcapps.jp/static/8/current_data.zip"},
    {"name": "hiroshimabus", "url": "https://ajt-mobusta-gtfs.mcapps.jp/static/9/current_data.zip"},
    {"name": "hirokotsu", "url": "https://ajt-mobusta-gtfs.mcapps.jp/static/10/current_data.zip"},
    {"name": "geiyo", "url": "https://ajt-mobusta-gtfs.mcapps.jp/static/11/current_data.zip"},
    {"name": "bihoku", "url": "https://ajt-mobusta-gtfs.mcapps.jp/static/12/current_data.zip"},
    {"name": "jrbus", "url": "https://ajt-mobusta-gtfs.mcapps.jp/static/15/current_data.zip"},
    {"name": "hdnishihiroshima", "url": "https://ajt-mobusta-gtfs.mcapps.jp/static/13/current_data.zip"},
    {"name": "forble", "url": "https://ajt-mobusta-gtfs.mcapps.jp/static/14/current_data.zip"},
    {"name": "sasaki", "url": "https://ajt-mobusta-gtfs.mcapps.jp/static/17/current_data.zip"},
    {"name": "kurebus", "url": "https://ajt-mobusta-gtfs.mcapps.jp/static/18/current_data.zip"},
    {"name": "hatsukaichi", "url": "https://ajt-mobusta-gtfs.mcapps.jp/static/19/current_data.zip"},
    {"name": "asahi", "url": "https://ajt-mobusta-gtfs.mcapps.jp/static/54/current_data.zip"},
    {"name": "onomichi", "url": "https://ajt-mobusta-gtfs.mcapps.jp/static/53/current_data.zip"},
    
    # 江田島バス: 配布サイトで「リンクのアドレスをコピー」した元のURLを貼り付けてください
    # （※今日の日付生成コードは削除し、固定URLとして指定します）
    {"name": "etajimabus", "url": "https://gtfs-st.busit.jp/api/etajimabus/"}, 
    
    # bus-vision の3社: 末尾の /ファイル名.zip を削除した本来のURL
    {"name": "chugokubus", "url": "https://bus-vision.jp/gtfs_v2/chugokubus/gtfsFeed"}, 
    {"name": "tomotetsu", "url": "https://bus-vision.jp/gtfs_v2/tomotetsubus/gtfsFeed"},
    {"name": "ikasabus", "url": "https://bus-vision.jp/gtfs_v2/ikasabus/gtfsFeed"},
]

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}


def main():
    print("🚌 運行データの一括自動処理を開始します...\n")

    for bus in BUS_DATA_LIST:
        name = bus["name"]
        url = bus["url"]

        print(f"【{name}】処理中...")

        try:
            dest_folder = os.path.join(TARGET_BASE_DIR, name)
            os.makedirs(dest_folder, exist_ok=True)

            print("  → ダウンロード中...")
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=30) as response:
                zip_data = response.read()

            print(f"  → ./idata/{name} フォルダへ解凍中...")
            with zipfile.ZipFile(io.BytesIO(zip_data)) as zip_ref:
                zip_ref.extractall(dest_folder)

            print(f"  ✨ {name} の展開が完了しました。")

        except Exception as e:
            print(f"  ❌ エラーが発生しました（スキップします）: {e}")

        print("-" * 40)

    print("\n🎉 すべてのバス会社の自動処理が終了しました！")


if __name__ == "__main__":
    main()