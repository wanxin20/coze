后端规范
Go 规范
Go语言的代码规范可以参考Google规范。建议使用gofmt等格式化工具进行代码格式化。

IDL 规范
类别	笔记
服务定义	* 服务名称遵循 camelCase 命名约定。
* 每个 Thrift 文件只定义一个服务，extends 聚合除外。
方法定义	* API 命名采用 camelCase 命名规范。
* API 只能有一个参数和一个返回值，且参数和返回值都必须为自定义 Struct 类型。
* 输入参数必须命名为 {Method}Request，返回值必须命名为 {Method}Response。
* 每个 Request 类型必须包含一个 Base 字段，类型为 base.Base，字段个数为 255，以及可选的类型。
* 每个 Response 类型必须包含一个 BaseResp 字段，类型为 base.BaseResp，字段个数为 255。
结构体定义	* 结构体名称应使用驼峰命名法
* 字段名称应使用蛇形命名法
* 新的字段应设置为可选，禁止设置为必需
* 现有字段 ID 和类型不得修改
枚举定义	* 建议使用 typedef 定义枚举值
* 枚举值采用驼峰命名法命名，类型和名称用下划线连接
API定义	* 使用 Restful 风格定义 API
* 参考现有模块的 API 定义，并保持风格一致
注释定义	* 您可以参考Hertz支持的注释
单元测试规范
类别	规格说明
UT函数命名
* 普通函数命名为 Test{FunctionName}(t *testing.T)
* 对象方法命名为 Test{ObjectName} {MethodName}(t *testing.T)
* 基准测试函数命名为 Benchmark{FunctionName}(b *testing.B)
* 基准测试对象命名为 Benchmark{ObjectName} {MethodName}(b *testing.B)
文件命名	测试文件与被测试文件同名，后缀为_test.go，位于同一目录中
测试设计	* 建议使用 Table-Driven 的方式定义输入/输出，覆盖各种场景
* 使用 github.com/stretchr/testify 简化断言逻辑
* 使用 github.com/uber-go/mock 生成 Mock 对象，尽量避免使用 patch stubbing 的方式