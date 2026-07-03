# Power Automateフロー構築手順(フォルダ管理方式・保留中アーカイブ)

作成日: 2026-07-03 / 状態: **保留**(2026-07-03、フォルダ管理の複雑さから添付ファイル方式に切り替え。`wg-submission-portal/app.js`は現在この方式ではなく添付ファイル方式で実装されている)

このファイルは、成果物ごとにSharePointドキュメントライブラリ内へ専用フォルダ(`氏名_ID`)を作成し、その中に`source.zip`/`report.md`/`slides.pptx`を固定名で保存する方式のPower Automateフロー構築手順のアーカイブ。将来、フォルダ単位での管理に戻したくなった場合に参照する。

## 共通準備

| 項目 | 値 |
|---|---|
| サイト | `https://tdcsoft.sharepoint.com/sites/AI-CRAIWG` |
| リスト名 | `成果物リスト_test` |
| ライブラリ名 | `Documents` |
| フォルダ格納先 | `03_GitHubCopilot/成果物提出_test` |

両フローともトリガーの認証は「Anyone」に設定し、URLに埋め込まれた署名(`sig=`)だけで呼び出せる状態にする。

---

## ① 提出用フロー(submitFlowUrl)

`app.js`の`submitToFlow`がPOSTするJSONを受け取り、リストへの作成/更新・フォルダ作成・ファイル保存を行う。

### 1. トリガー「HTTP要求の受信時」を追加
「新しいステップ」ではなくトリガー自体を作成。認証は「Anyone」。要求本文のJSONスキーマは、以下のサンプルを「サンプルのペイロードを使用してスキーマを生成する」に貼り付けて自動生成する。

```json
{
  "action": "create",
  "id": null,
  "shimei": "山田太郎",
  "title": "議事録要約くん",
  "gaiyo": "概要文",
  "recipe": "レシピ本文",
  "folderUrl": "",
  "files": {
    "zip": { "name": "source.zip", "base64": "AAAA" },
    "md": null,
    "pptx": null
  }
}
```

### 2. 条件分岐(Condition)を追加
式: `triggerBody()?['action']` が `create` と等しい

### 3. 「はい」側 ── 新規作成の一式

**a. SharePoint「項目の作成」**
- サイト: AI-CRAIWG / リスト: 成果物リスト_test
- Title = `triggerBody()?['title']`
- Shimei = `triggerBody()?['shimei']`
- Gaiyo = `triggerBody()?['gaiyo']`
- Recipe = `triggerBody()?['recipe']`

**b. 変数を初期化「folderPath」**(文字列)
```
concat('03_GitHubCopilot/成果物提出_test/', triggerBody()?['shimei'], '_', formatNumber(float(outputs('項目の作成')?['body/ID']), '000'))
```

**c. SharePoint「新しいフォルダーの作成」**
- サイト: AI-CRAIWG / ライブラリ名: Documents / フォルダーパス: `variables('folderPath')`

**d. ファイル作成を3セット**(zip / md / pptx それぞれに条件分岐 → ファイル作成)

1セットの例(zip):
- 条件: `triggerBody()?['files']?['zip']` が `null` と等しくない
- はいの場合 → SharePoint「ファイルの作成」: フォルダーパス=`variables('folderPath')` / ファイル名=`source.zip` / ファイルコンテンツ=`base64ToBinary(triggerBody()?['files']?['zip']?['base64'])`

md は `report.md`、pptx は `slides.pptx` に差し替えて同じ構成をもう2セット作る。

**e. SharePoint「項目の更新」**(FolderUrl を書き戻す)
- ID = `outputs('項目の作成')?['body/ID']`
- FolderUrl = `outputs('新しいフォルダーの作成')?['body/Path']`

**f. 「応答」アクション**
```json
{
  "success": true,
  "id": @{outputs('項目の作成')?['body/ID']},
  "folderUrl": "@{outputs('新しいフォルダーの作成')?['body/Path']}"
}
```

### 4. 「いいえ」側 ── 更新の一式

- **a.** SharePoint「項目の更新」: ID=`triggerBody()?['id']`、Title/Gaiyo/Recipeのみ設定(Shimeiは触らない)
- **b.** 変数「folderPath」を初期化:
  ```
  if(
    equals(triggerBody()?['folderUrl'], ''),
    concat('03_GitHubCopilot/成果物提出_test/', triggerBody()?['shimei'], '_', formatNumber(float(triggerBody()?['id']), '000')),
    triggerBody()?['folderUrl']
  )
  ```
  > 簡易実装でよい点: folderUrlが既にある場合、本来はフルURLからサイト相対パスへ変換する処理が必要だが、初回作成時のfolderUrlをそのまま「フォルダーパス」欄に渡しても多くの場合そのまま動く。エラーになった場合だけ変換式を足す、で構わない。
- **c.** SharePoint「新しいフォルダーの作成」を同じ設定で再実行。このアクションの「実行後の構成」で「が失敗した場合」「がスキップされた場合」にもチェックを入れ、フォルダが既に存在してエラーになっても後続に進めるようにする。
- **d.** ファイル作成を3セット(新規作成と同じ構成)。ただし既にファイルが存在すると「ファイルの作成」がエラーになることがある。エラーが出たら、そのアクションの代わりに「ファイル コンテンツの更新」アクションに差し替える。
- **e.** FolderUrlが空だった場合のみ「項目の更新」(初回失敗からの復旧用)
- **f.** 「応答」アクション(新規作成と同じ形式で success/id/folderUrl を返す)

---

## ② 一覧取得用フロー(listFlowUrl)

`app.js`の`fetchListData`が呼ぶ。リストの全アイテムと、各アイテムのファイル有無・レポート本文をまとめて1つのJSONで返す。

### 1. トリガー「HTTP要求の受信時」を追加
認証は「Anyone」。本文は使わないのでスキーマは空のままでよい。

### 2. SharePoint「複数の項目の取得」
サイト: AI-CRAIWG / リスト: 成果物リスト_test

### 3. 変数を初期化「resultItems」
型: 配列(Array) / 初期値: `[]`

### 4. 「Apply to each」を追加
対象: `outputs('複数の項目の取得')?['body/value']`

ループの中で、まず変数 `hasZip` / `hasMd` / `hasPptx`(ブール、既定false)/ `reportText`(文字列、既定空)を「変数の設定」でループ先頭ごとにリセットする。

**a. 条件: 現在の項目の FolderUrl が空でない**
- はいの場合 → SharePointの「フォルダー内のファイルの取得」相当のアクション(コネクタの一覧で「ファイル」「folder」等で検索して探す)。フォルダーパス = `items('Apply_to_each')?['FolderUrl']`
- その結果に対してさらに「Apply to each」(ネスト): ファイル名で条件分岐し、`source.zip`なら`hasZip`をtrueに、`report.md`なら`hasMd`をtrueにしつつ「ファイルのコンテンツを取得」で`reportText`にセット、`slides.pptx`なら`hasPptx`をtrueに設定

**b. 「作成」(Compose)アクションでこのアイテムのJSONを組み立てる**
```json
{
  "id": @{items('Apply_to_each')?['ID']},
  "title": "@{items('Apply_to_each')?['Title']}",
  "shimei": "@{items('Apply_to_each')?['Shimei']}",
  "gaiyo": "@{items('Apply_to_each')?['Gaiyo']}",
  "recipe": "@{items('Apply_to_each')?['Recipe']}",
  "author": "@{items('Apply_to_each')?['Author']?['DisplayName']}",
  "created": "@{items('Apply_to_each')?['Created']}",
  "folderUrl": "@{items('Apply_to_each')?['FolderUrl']}",
  "files": {
    "zip": @{variables('hasZip')},
    "md": @{variables('hasMd')},
    "pptx": @{variables('hasPptx')}
  },
  "reportText": "@{variables('reportText')}"
}
```

**c. 「resultItems」に追加(Append to array variable)**: 値 = `outputs('作成')`(Composeの出力をそのまま参照。JSON文字列を手打ちしない)

### 5. ループの外に出て「応答」アクション
```json
{ "items": @{variables('resultItems')} }
```

---

## つまずきポイント

| 症状 | 対処 |
|---|---|
| 配列への追加でエラーになる | JSON文字列を直接書かず Compose の出力を参照する |
| 2回目の提出でファイル作成が失敗 | 「ファイルの作成」→「ファイル コンテンツの更新」に差し替え |
| フォルダ作成が2回目以降エラーになる | 該当アクションの「実行後の構成」で失敗/スキップ時も続行するよう設定 |
| Apply to each 内の変数が期待通りリセットされない | ループ先頭で必ず「変数の設定」を明示的に置く |

**動作確認のコツ**: いきなりアプリから叩かず、Power Automate側の「テスト」機能で手動実行し、各アクションの出力を1つずつ確認しながら組み立てるとデバッグしやすい。

---

完成したら、それぞれのURL(HTTP要求の受信時トリガーに表示される、`sig=`付きのもの)を`app.js`の`CONFIG.submitFlowUrl` / `CONFIG.listFlowUrl`に貼り付け、`CONFIG.demoMode`を`false`にすれば接続完了。
