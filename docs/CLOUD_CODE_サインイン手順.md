# Cloud Code サインイン手順（詳細版）

## サイドバーの Cloud Code アイコンをクリックした後

### 1. Cloud Code パネルが開く

サイドバーの Cloud Code アイコン（Google Cloud のロゴ）をクリックすると、左側に Cloud Code のパネルが開きます。

表示される内容：
- **Google Cloud プロジェクト**の一覧
- **Sign in to Google Cloud** ボタンまたはリンク
- Cloud Code の各種機能へのアクセス

---

### 2. Google Cloud にサインインする

#### 方法A: パネル内の「Sign in」ボタンから

1. Cloud Code パネルの上部に **「Sign in to Google Cloud」** または **「Sign in」** というボタン/リンクがあるので、それをクリックします。

2. ブラウザが自動的に開きます（開かない場合は、表示された URL をブラウザで開いてください）。

3. Google のログイン画面が表示されるので：
   - **メールアドレス**: `harukahatanaka@colour-monster.com` を入力
   - **次へ** をクリック
   - **パスワード** を入力
   - **次へ** をクリック

4. **権限の許可画面**が表示されます：
   - 「Cloud Code があなたの Google アカウントにアクセスすることを許可しますか？」のようなメッセージ
   - **「許可」** または **「Allow」** をクリック

5. ブラウザに「認証が成功しました」などのメッセージが表示され、自動的に Cursor に戻ります。

6. Cursor の Cloud Code パネルを確認すると、サインイン済みの状態になっているはずです。

---

#### 方法B: コマンドパレットから

1. **`Cmd + Shift + P`**（Mac）または **`Ctrl + Shift + P`**（Windows）でコマンドパレットを開く

2. **「Cloud Code: Sign in to Google Cloud」** と入力して選択

3. 以降は方法Aの手順3〜6と同じです

---

### 3. サインイン後の確認

サインインが成功すると、Cloud Code パネルに以下が表示されます：

- ✅ **サインイン済みのアカウント**: `harukahatanaka@colour-monster.com`
- 📁 **アクティブなプロジェクト**: `western-storm-486708-m5`（または選択したプロジェクト）
- 🔧 **Cloud Code の機能**:
  - Cloud Run
  - GKE クラスター
  - Cloud Functions
  - その他の Google Cloud リソース

---

### 4. まだ 400 エラーが出る場合

もしサインイン時に **400 Bad Request** エラーが出た場合は：

1. **ブラウザの開発者ツールを開く**（F12 キー）
2. **ネットワーク**タブを開く
3. エラーが発生したリクエストをクリック
4. **Headers** または **Payload** タブで `redirect_uri=` の値を確認
5. その URL を Google Cloud Console の「承認済みのリダイレクト URI」に追加して保存
6. 5〜10分待ってから再度サインインを試す

---

### 5. プロジェクトの選択（必要に応じて）

複数の Google Cloud プロジェクトがある場合：

1. Cloud Code パネルの上部で、現在のプロジェクト名をクリック
2. **「Switch Project」** または **「プロジェクトを切り替え」** を選択
3. プロジェクト一覧から **`western-storm-486708-m5`** を選択

---

## よくある質問

### Q: ブラウザが開かない
- Cursor の設定で、外部ブラウザを開く権限が無効になっている可能性があります
- コマンドパレットから **「Cloud Code: Sign in to Google Cloud」** を実行してみてください

### Q: 「認証に失敗しました」と表示される
- Google Cloud Console の設定を確認してください：
  - OAuth 同意画面が「テスト」モードになっているか
  - テストユーザーに `harukahatanaka@colour-monster.com` が追加されているか
  - リダイレクト URI が正しく設定されているか

### Q: サインイン後、何ができるようになるの？
- Google Cloud のリソース（Cloud Run、GKE、Cloud Functions など）を Cursor から直接管理できます
- ローカルで Google Cloud API を使うアプリをデバッグできます
- Cloud Code の各種機能が使えるようになります

---

## 次のステップ

サインインが成功したら：
1. Cloud Code の機能を試してみる
2. 必要に応じて `gcloud auth application-default login` を実行（ローカルデバッグ用）
3. Cloud Run や GKE へのデプロイなどの機能を活用する
