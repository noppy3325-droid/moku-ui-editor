# 部品と画面サイズの基準

40種類の部品と46種類の論理画面サイズを用意しています。各画面サイズはモックアップを始めるための参考値です。物理ピクセル、ブラウザーのツールバー、OSの文字拡大設定を再現するデバイスエミュレーターではありません。

Appleの機種名付きサイズは、Apple Human Interface Guidelinesのポイント単位のレイアウト表を基準にしています。Android・PC・画面比のプリセットは特定機種の実測値ではなく、設計を比較するための参考ビューポートです。機種名と画面サイズはプロジェクトに保存され、必要に応じてカスタムサイズへ変更できます。

- [Apple Human Interface Guidelines — Layout](https://developer.apple.com/design/human-interface-guidelines/layout)
- [Android Developers — Window size classes](https://developer.android.com/develop/ui/compose/layouts/adaptive/use-window-size-classes)

Androidでは端末名よりアプリに利用できるウィンドウの論理幅が重要です。このため「コンパクト」「標準」「大画面」「折りたたみ」といった代表的な設計サイズを用意しています。

部品は共通の描画エンジンを使用し、編集・プレビュー・HTML・画像出力で同じデータを参照します。表は改行で行、`|`でセルを区切ります。選択肢・タブ・メニューは改行区切りです。数値、選択状態、無効状態、画像の表示方法をプロパティで指定できます。
