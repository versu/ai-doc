# コーディングガイドライン

特定のプログラミング言語に依存しない、基本的なコーディングの方針をまとめる。
このドキュメントには今後も項目を少しずつ追加していく。

## 処理の共通化（DRY の正しい解釈）

「見た目（コード／テキスト）が同じ」という理由だけで共通化しない。

- DRY / YAGNI が戒めるのは「コードの見た目（テキスト）の重複」ではなく、
  **「ビジネス上の知識・意図の重複」**である。見た目が同じなだけのものを共通化するのは
  DRY の誤った解釈であり、行わない。
- 共通化したメソッドを修正するたびに影響範囲を確認しないと不安になる――そんな共通化は
  本来好ましくない。正しくビジネス上の知識を共通化して責務に集中できているなら、修正は
  呼び出し元へ速やかに波及してしかるべきだからである。
- 例: Request / Response（DTO）は、フィールド構成が同じに見えても Feature / Usecase ごとに
  定義し、共通化しない。各 Usecase の要求によって容易に変わりうるため、共有すると一方の
  変更が無関係な他方へ波及する。これはあくまで一例であり、Request / Response に限らず
  あらゆるコードに当てはまる原則。

```text
# ❌ 悪い例（偶然フィールドが一致するだけの DTO を共有）
# CreateUserRequest と UpdateProfileRequest は今は同じ形だが、
# 要求が異なるため一方の変更が他方へ波及する
class UserNameRequest { name; email }
function createUser(UserNameRequest req) { ... }
function updateProfile(UserNameRequest req) { ... }

# ✅ 良い例（Usecase ごとに個別定義。偶然の一致を共有しない）
class CreateUserRequest  { name; email }
class UpdateProfileRequest { name; email }
function createUser(CreateUserRequest req) { ... }
function updateProfile(UpdateProfileRequest req) { ... }
```

## 関数分割

「処理が長いから」という理由だけで関数を分離しない。意味のない関数化が増えると、
メソッド間のジャンプが頻発し、コードの読み手に負荷をかける。

インラインで十分に意味が理解できる（関数化しなくてよい）ケース:

- ただのデータの整形。
- メソッドチェーン等で宣言的に書ける場合。
- 三項演算子 1 つ程度で済む条件分岐。

逆にメソッド化を検討してよいケース:

- 複雑な条件分岐など、一定のまとまったビジネスロジックがある場合。

```text
# ❌ 悪い例（宣言的に読めば分かる整形を、わざわざ関数化）
function buildStationAccess(user) {
    return user.stations
        .map(s => s.content)
        .filter(notEmpty)
}

# ✅ 良い例（呼び出し側にインラインで十分）
stations = user.stations
    .map(s => s.content)
    .filter(notEmpty)

# ✅ メソッド化してよい例（複雑なビジネスロジックを意味のある名前で切り出す）
function isEligibleForRenewal(contract) {
    # 更新条件の判定（複数条件の組み合わせ）
    ...
}
```

## 防御的プログラミングと契約による設計

実装フェーズでは、そのクラスが「外部寄り／内部寄り」どのレイヤーに属するかによって、
防御的プログラミングと契約による設計（Design by Contract）のどちらを行うべきかが変わる。

区切りは「外部」と「内部」で分ける。

- **外部**: 3 層アーキテクチャのプレゼンテーション層が該当する。Web API の出入り口や、
  ユーザのフォーム等のリクエスト受け取り・入出力に面したレイヤーであり、**防御的である
  べきレイヤー**。
- **内部**: 防御的レイヤーより内側のレイヤー。

方針:

- 外部に面したレイヤーは**防御的プログラミング**であるべき（不正な入力を前提に検証する）。
- それ以降のレイヤー（ビジネスロジック等）は**契約による設計**でよい。
  - 「検証済みであること」を型で表現できればベスト。そうでなくても、前段のレイヤーで
    検証済みであることを信頼してコーディングしてよい。
  - 前段のレイヤーで行っている検証（null チェック等）を、メソッドを分割するたびに
    繰り返す必要はない。

本リポジトリの層構成への対応:

- 外部（防御的）: Controller / FormRequest
- 内部（契約）: UseCase / Service / Repository / Model

```text
# 入口（外部・防御的）: ここで検証しきる
function handleRequest(input) {
    validate(input)              # 不正な入力はここで弾く
    user = findUser(input.id)
    if (user == null) error()    # 存在チェックもここで
    return processOrder(user)
}

# ❌ 悪い例（内部・契約レイヤーで前段の検証を重複させる）
function processOrder(user) {
    if (user == null) return     # 入口で保証済み。分割のたびに重ねない
    ...
}

# ✅ 良い例（検証済みを信頼する。型で表せればなお良い）
function processOrder(user) {
    # user は検証済みである前提で書く
    ...
}
```
