import os
import zipfile
import urllib.request

# 【設定1】ファイルを配置したいベースフォルダ（infoフォルダの場所）
TARGET_BASE_DIR = r"D:\Users\Downloads\current_data\info"

# 【設定2】ダウンロードしたいURLと、対応するフォルダ名のリスト
# ※ここに会社名とURLをどんどん追加していけます
BUS_DATA_LIST = [
    {"name": "hiroden", "url": "https://example.com"},
    {"name": "hirobus", "url": "https://example.com"},
    {"name": "geiyo",   "url": "https://example.com"},
    {"name": "hiroko",  "url": "https://example.com"},
    # さらに会社を増やす場合は、以下のように後ろにカンマを付けて追加します
    # {"name": "会社名", "url": "URL"},
]

# 一時的にダウンロードするZIPファイル名
TEMP_ZIP_NAME = "current_data.zip"

def main():
    print("🚌 運行データの一括自動処理を開始します...\n")

    # 登録された会社を順番にループ処理する
    for bus in BUS_DATA_LIST:
        name = bus["name"]
        url = bus["url"]
        
        print(f"【{name}】処理中...")
        
        try:
            # 1. 指定されたURLから current_data.zip をダウンロード
            print(f"  → URLからダウンロード中...")
            urllib.request.urlretrieve(url, TEMP_ZIP_NAME)
            
            # 2. 保存先のフォルダ（info/会社名）を自動作成
            dest_folder = os.path.join(TARGET_BASE_DIR, name)
            os.makedirs(dest_folder, exist_ok=True)
            
            # 3. ダウンロードしたZIPをそのフォルダに解凍
            print(f"  → {name} フォルダへ解凍中...")
            with zipfile.ZipFile(TEMP_ZIP_NAME, 'r') as zip_ref:
                zip_ref.extractall(dest_folder)
                
            print(f"  ✨ {name} の配置が完了しました。")
            
        except Exception as e:
            print(f"  ❌ エラーが発生しました（スキップします）: {e}")
            
        finally:
            # 4. 使い終わった一時ZIPファイルを削除（次のループのために綺麗にする）
            if os.path.exists(TEMP_ZIP_NAME):
                os.remove(TEMP_ZIP_NAME)
        
        print("-" * 40)

    print("\n🎉 すべてのバス会社の自動処理が終了しました！")

if __name__ == "__main__":
    main()
