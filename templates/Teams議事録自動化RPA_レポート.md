# Teams議事録自動化RPA

<div style="border:1px solid #cccccc;border-radius:8px;overflow:hidden;margin:12px 0 24px 0;">
<div style="background:#757575;color:#ffffff;font-weight:bold;padding:10px 18px;">📋 アプリ概要</div>
<div style="background:#f8f8f8;padding:16px 20px;">
Teams会議の録画からWord形式のトランスクリプトを取得し、M365 Copilot Chatの議事録エージェントに投入、生成された議事録をOneNoteの新規ページに貼り付けるところまでを自動化するツール。ボタン1つでSharePointからダウンロード→Copilotエージェント投入→OneNote記載まで一気に実行される。
</div>
</div>

<div style="border:1px solid #bcd8f2;border-radius:8px;overflow:hidden;margin:12px 0 24px 0;">
<div style="background:#3d85c6;color:#ffffff;font-weight:bold;padding:10px 18px;">🔍 発見したこと</div>
<div style="background:#eaf3fc;padding:16px 20px;">
着手前は「会議の録画からWordのトランスクリプトを取得する」としか認識していなかったが、いきなり実装に入らずAIと壁打ちしながら実際の操作手順を洗い出したところ、想定と違う実態が見えてきた。
<div style="background:#ffffff;border-left:3px solid #3d85c6;border-radius:4px;padding:10px 16px;margin:14px 0;font-style:italic;color:#333333;">
❝ 「単独のWordファイルが存在する」という前提は誤りで、実際は録画を開いた先の文字起こしパネルから、その場でWord形式をダウンロードする仕組みだった。
</div>
この実態を先に具体化できていなければ、存在しないファイルを探すコードを書いて手戻りしていたと思う。
</div>
</div>

<div style="border:1px solid #f0dfa0;border-radius:8px;overflow:hidden;margin:12px 0 24px 0;">
<div style="background:#b8860b;color:#ffffff;font-weight:bold;padding:10px 18px;">💡 気づき</div>
<div style="background:#fff8e1;padding:16px 20px;">
最初から実装コードを書かせるのではなく、まず壁打ちで処理フローをAIと一緒に洗い出し、調査で分かったことを具体化した仕様にしてから実装に入る、という順番が結局は一番の近道だと気づいた。<br><br>
コードを書き始めてしまうと、そのコードの前提を疑う視点が失われがちになる。<strong>書く前にどれだけ実態を具体化できているかが、理想に近いアプリを作れるかどうかを左右する</strong>と感じた。
</div>
</div>

<div style="border:1px solid #b7e0c7;border-radius:8px;overflow:hidden;margin:12px 0 24px 0;">
<div style="background:#3f9d6d;color:#ffffff;font-weight:bold;padding:10px 18px;">📚 理解したこと</div>
<div style="background:#eaf7ee;padding:16px 20px;">
具体化してから進める姿勢は、最初の要件整理だけでなく、実装の途中でも同じように効くと理解した。
<div style="background:#ffffff;border-left:3px solid #4caf7d;border-radius:4px;padding:10px 16px;margin:14px 0;font-style:italic;color:#333333;">
❝ ファイル添付が完了すると出る「アップロードが完了しました」という通知表示について、AIは「一時的な通知だからすぐ消えるはずで、待機条件には使えない」と推測し、別の実装方法を探し始めた。実際に試してみると、通知は画面に残り続けていて、そのまま待機条件として使えた。
</div>
大きな設計判断も、細かい実装判断も、<strong>推測で先に進めず一度具体的に確かめる</strong>、という同じ姿勢が効いていた。
</div>
</div>

---

<div style="font-weight:bold;font-size:16px;color:#444444;border-bottom:2px solid #8e44ad;padding-bottom:6px;margin:8px 0 16px 0;">🧾 プロンプトのレシピ</div>

<div style="border:1px solid #ddc7ec;border-radius:8px;overflow:hidden;margin:12px 0 24px 0;">
<div style="background:#8e44ad;color:#ffffff;font-weight:bold;padding:10px 18px;">📝 レシピ1: 一括で全部作らせず、フェーズごとに1つずつ動作確認してもらう</div>
<div style="background:#f6f0fb;padding:18px 22px;">
<div style="margin-bottom:14px;">
<span style="display:inline-block;background:#8e44ad;color:#ffffff;font-weight:bold;font-size:12px;padding:2px 10px;border-radius:12px;">使ったシーン</span><br><br>
「SharePointから文字起こしを取得→Copilotに投入→OneNoteに貼り付け」という3フェーズ構成のツールを作った際、3フェーズ分をまとめて一気に実装させようとすると、どこで壊れているのか分からなくなりそうだった。
</div>
<div style="margin-bottom:14px;">
<span style="display:inline-block;background:#8e44ad;color:#ffffff;font-weight:bold;font-size:12px;padding:2px 10px;border-radius:12px;">プロンプト</span>
<pre style="background:#2d2d2d;padding:14px 16px;border-radius:6px;overflow-x:auto;margin:8px 0 0 0;"><code style="color:#f5f5f5;background:transparent;">3つのフェーズを一気に全部実装しないこと。
まずSharePointフェーズだけ実装し、動作確認できたら報告すること。
確認が取れたら次のフェーズに進み、以降も1フェーズごとに確認してから次に進むこと。</code></pre>
</div>
<div>
<span style="display:inline-block;background:#8e44ad;color:#ffffff;font-weight:bold;font-size:12px;padding:2px 10px;border-radius:12px;">なぜ使えたか</span><br><br>
複数フェーズをまとめて実装させると、どこで問題が起きているのか切り分けが難しくなる。フェーズを1つずつ区切って、その都度動作確認してから次に進める、という進め方にしたことで、各フェーズごとの不具合(パネルの誤クローズ、添付完了待ちの判定など)をその場で潰しながら進められ、最終的に3フェーズ通しでの成功にたどり着けた。
</div>
</div>
</div>

<div style="border:1px solid #ddc7ec;border-radius:8px;overflow:hidden;margin:12px 0 24px 0;">
<div style="background:#8e44ad;color:#ffffff;font-weight:bold;padding:10px 18px;">📝 レシピ2: コード修正の箇所が特定できている際は「他は一切変更しないこと」と明示する</div>
<div style="background:#f6f0fb;padding:18px 22px;">
<div style="margin-bottom:14px;">
<span style="display:inline-block;background:#8e44ad;color:#ffffff;font-weight:bold;font-size:12px;padding:2px 10px;border-radius:12px;">使ったシーン</span><br><br>
特定の処理だけを直してほしい場面で、AIに修正を頼んだところ、対象箇所以外の周辺コードまで「ついでに」整理・変更されてしまい、意図しない変更が混ざってしまったことがあった。
</div>
<div style="margin-bottom:14px;">
<span style="display:inline-block;background:#8e44ad;color:#ffffff;font-weight:bold;font-size:12px;padding:2px 10px;border-radius:12px;">プロンプト</span>
<pre style="background:#2d2d2d;padding:14px 16px;border-radius:6px;overflow-x:auto;margin:8px 0 0 0;"><code style="color:#f5f5f5;background:transparent;">指定した箇所だけ修正すること。
それ以外の箇所には一切変更を加えないこと。</code></pre>
</div>
<div>
<span style="display:inline-block;background:#8e44ad;color:#ffffff;font-weight:bold;font-size:12px;padding:2px 10px;border-radius:12px;">なぜ使えたか</span><br><br>
「ここを直して」のような曖昧な指示だと、AIは対象箇所だけでなく他の不要な箇所まで巻き込んで修正してしまうことがある。修正範囲を明示的に制御しないと、意図しない差分が混ざりやすい。「他は一切変更しないこと」と範囲を先に区切っておくことで、変更の影響範囲を狙った箇所だけに限定できた。
</div>
</div>
</div>
