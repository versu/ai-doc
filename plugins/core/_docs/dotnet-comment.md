
# 指示内容

- csharpのドキュメントコメントを以下のルールに従って日本語で付与してください。

# 共通ルール

## class, record に付与するコメントの語尾は体言止め（名詞で終わらせる）で統一し、「です、ます」等の語尾は不要です

OK
```csharp
/// <summary>
/// 受注CSV読込ジョブのレスポンス
/// </summary>
/// <param name="Name">名前</param>
/// <param name="Age">年齢</param>
public record ReadOrderCsvJobResponse(
    string Name,
    int Age
);
```

NG（語尾に「です、ます」は**不要**）
```csharp
/// <summary>
/// 受注CSV読込ジョブのレスポンスを表します。
/// </summary>
/// <param name="Name">名前を表します。</param>
/// <param name="Age">年齢を表します。</param>
public record ReadOrderCsvJobResponse(
    string Name,
    int Age
);
```

## 関数・メソッドに付与するコメントの語尾は「ます」で統一してください

OK
```csharp
/// <summary>
/// サンプルジョブ
/// </summary>
/// <param name="ISampleQueryService">サンプルジョブで使用するクエリサービス</param>
public class SampleJob(
  ISampleQueryService queryService)
{
    /// <summary>
    /// ジョブを実行します
    /// </summary>
    /// <returns>成功時は処理結果を、失敗時はエラー情報を返却します</returns>
    public Result<ReadOrderCsvJobResponse, ReadOrderCsvJobError> Execute()
    {

    }
}
```

NG（関数・メソッドに付与するコメントの語尾が「ます」で統一されていない）
```csharp
/// <summary>
/// サンプルジョブ
/// </summary>
public class SampleJob
{
    /// <summary>
    /// ジョブを実行
    /// </summary>
    public Result<ReadOrderCsvJobResponse, ReadOrderCsvJobError> Execute()
    {

    }
}
```

# record型

record 型には `param` を使用して引数にもコメントを付与してください。

example
```csharp
/// <summary>
/// 受注CSV読込ジョブのレスポンス
/// </summary>
/// <param name="Name">名前</param>
/// <param name="Age">年齢</param>
public record ReadOrderCsvJobResponse(
    string Name,
    int Age
);

## Interfaceの実装クラスには「/// <inheritdoc />」を使用してください

example
```csharp
/// <summary>
/// Hogeリポジトリのインターフェース
/// </summary>
public interface IHogeRepository
{
    /// <summary>
    /// ジョブを実行します
    /// </summary>
    public void Execute()
}

/// <summary>
/// Hogeリポジトリ
/// </summary>
/// <param name="dBContext">DBコンテキスト</param>
public class HogeRepository(HogeDbContext dBContext): IHogeRepository
{
    /// <inheritdoc />
    public void Execute(){}

    
    /// <summary>
    /// 処理を行います（Interface の実装クラス以外には通常通りコメントを付与）
    /// </summary>
    private void SomeProcess()
    {

    }
}
```



