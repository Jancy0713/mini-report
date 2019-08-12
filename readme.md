# 小程序 埋点

## 说明
1. 上报 全点击事件（上报参数中带有 type & target的全部函数），可自定义上传频率(毫秒)
2. 上报 心跳，可自定义心跳频率(毫秒)，自定义onHide心跳过期时间（**onHide超过多长时间重新计时**）
3. 可配置部分小程序配置信息【小程序名称，版本，类型】
4. 自定义配置 host & url(未配置url为测试模式，测试模式至打log不上报)

## 版本
1. 分ts，js两个版本，js文件为ts编译产生。
2. 使用ts版本 需修改 typings/wx/lib.wx.app.d.ts && typings/wx/lib.wx.page.d.ts 文件

将以下部分修改
```ts
declare const App: App.AppConstructor
declare const Page: Page.PageConstructor
```
修改为
```ts
declare let App: App.AppConstructor
declare let Page: Page.PageConstructor
```

## 体验
1. mini-report-test-ts/mini-report-test-js 分别为小程序模板(**ts/js**)的两个demo，可自行下载体验

## 使用
1. 将src下(ts/js二选一即可)文件引入项目
2. 在app.js/app.ts 中引入，并实例化
```ts
import { ReportEvent } from "./utils/report-event"
const reportEvent = new ReportEvent()
```
3. 按需配置用户uid
```ts
const uid = wx.getStorageSync("uid") || 0
```

4. 配置文件，并调用初始化函数
```ts
const reportConfig = {
  /** 必填 */
  appFunction: App,
  /** 必填 */
  pageFunction: Page,
  /** 请求Host */
  statsHost: "https://",
  /** 请求Url，如果为空则为测试模式，可以看log用 */
  reportUrl: null,
  /** 行为记录周期（毫秒） */
  actPeriod: 60 * 1000,
  /** 心跳记录周期（毫秒） */
  hbPeriod: 15 * 1000,
  /** 心跳onHide过期周期（毫秒） */
  onHidePeriod: 60 * 1000,
  /** 小程序相关配置 */
  appName: "jieBro",
  version: "1.0.0",
  clientType: "wxMini"
}
reportEvent.initProcessApp(reportConfig, uid)
```
