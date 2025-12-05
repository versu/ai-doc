
# フロントエンド コード自動コメント付与ルール

## コメント付与ルール
- 各プロパティ・関数の直前にJSDoc形式（`/** ... */`）で日本語コメントを記載する。
- コメントは「何を表すか」「何をするか」を簡潔に説明する。
- 引数がある場合は `@param` で各引数の用途・意味を説明する。
- 戻り値がある場合は `@returns` で返り値の意味を説明する（voidの場合も「なし」と明記）。

## コメント付与例

### プロパティの場合
```typescript
/** モーダルが開いているかどうか */
isExportModalOpen: boolean;
```

### 関数の場合
```typescript
/**
 * 出荷予定日を設定します
 * @param date 設定する出荷予定日（未設定の場合はundefined）
 * @returns なし
 */
setExportShippingDate: (date: Date | undefined) => void;
```
