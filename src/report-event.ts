interface IData {
  [x: string]: any,
}

interface IReportConfig {
  pageFunction: (page: Page.PageConstructor) => void,
  appFunction: (app: App.AppConstructor) => void,
  statsHost?: string,
  reportUrl?: string,
  actPeriod?: number,
  hbPeriod?: number,
  onHidePeriod?: number,

  appName?: string,
  version?: string,
}

/** 个人信息数据 */
interface IPersonalInfoData {
  system?: any,
  networkType?: string

  /** 以下信息需要授权: 未授权(never) 已拒绝授权(fail) 正常(object) */
  userInfo: any,
  location: any,
}

const APP_PAGE_METHOD = [
  "onLoad",
  "onReady",
  "onShow",
  "onHide",
  "onUnload",
  "onPullDownRefresh",
  "onReachBottom",
  "onShareAppMessage",
  "onPageScroll",
  "onResize",
  "onTabItemTap",
]

export class ReportEvent {

  /** 存储page/app */
  private pageFunction?: Page.PageConstructor
  private appFunction?: App.AppConstructor

  /** 基础属性 */
  private statsHost: string = ""
  private appName: string = ""
  private version: string = "1.0.0"
  private clientType: string = "wxMini"
  private actPeriod: number = 60 * 1000
  private hbPeriod: number = 15 * 1000
  private onHidePeriod: number = 60 * 1000
  private uid: number = 0

  /** 行为缓存 */
  private actCache: any[] = []
  /** 行为计时器名称 */
  private actTimer: number
  /** 心跳计时器名称 */
  private hbTimer: number
  /** 心跳过期计时器名称 */
  private onHideTimer: number = 0

  /** 用于小程序至于后台时存储心跳 */
  private subtractHeartBeatCount: number = 0
  private isHiddenTimeOut: boolean = false

  /** 计数数据 */
  private actCount: number = 0
  private heartBeatCount: number = 0

  /** 会话id */
  private session?: string

  /** 上报url */
  private reportUrl?: string

  /** 储存授权信息 */
  private authSetting: any

  /** 个人信息数据 */
  private personalInfoData: IPersonalInfoData = {
    userInfo: "never",
    location: "never",
  }

  constructor() { }

  /** 初始化，存入设置，修改app&page */
  public initProcessApp(reportConfig: IReportConfig, uid: number) {
    if (!reportConfig.appFunction) {
      throw console.error("必须传入APP对象")
    }
    if (!reportConfig.pageFunction) {
      throw console.error("必须传PAGE对象")
    }
    Object.assign(this, reportConfig)
    this.uid = uid
    this.processApp()
    this.processPage()
  }

  /////////////   修改app、page   //////////////
  /** 修改page */
  private processPage() {
    const that = this
    Page = function (page) {
      const oldOnShow = page.onShow
      const oldOnShareAppMessage = page.onShareAppMessage
      page.onShow = function (...args) {
        that.reportAct(this.route, "web")
        if (!oldOnShow) { return }
        oldOnShow.apply(this, args)
      }

      that.traversePageFunction(page)

      if (oldOnShareAppMessage) {
        page.onShareAppMessage = function (...args) {
          that.reportAct(this.route, "tap", {
            type: "share",
            function: args[0].from,
          })
          return oldOnShareAppMessage.apply(that, args)
        }
      }
      that.pageFunction(page)
    }
  }

  /** 修改app */
  private processApp() {
    App = (app) => {
      const that = this
      const oldOnShow = app.onShow
      const oldOnLaunch = app.onLaunch
      const oldOnHide = app.onHide
      const oldOnUnload = app.onUnload
      app.onLaunch = function (...args) {
        oldOnLaunch.apply(app, args)
        that.initInterval()
      }

      app.onShow = function (...args) {
        if (oldOnShow) { oldOnShow.apply(this, args) }
        if (that.onHideTimer) {
          clearInterval(that.onHideTimer)
          that.onHideTimer = null
          return
        }
        that.heartBeatCount = 0
        that.session = null
        that.actCount = 0
        that.isHiddenTimeOut = true
        that.getInitialData()
      }

      app.onHide = function (...args) {
        if (oldOnHide) { oldOnHide.apply(this, args) }
        that.onHideTimer = setTimeout(() => {
          that.onHideTimer = 0
        }, that.onHidePeriod)
      }

      app.onUnload = function (...args) {
        if (oldOnUnload) { oldOnUnload.apply(this, args) }
        this.clearTimer()
      }

      this.appFunction(app)
    }
  }

  /////////////   初始化   //////////////
  /** 初始化 计时器 */
  private initInterval() {
    if (this.actTimer) { throw new Error("定时器已经开启") }
    this.initActTimer(this.actPeriod)
    this.initHbTimer(this.hbPeriod)
  }
  /** 初始化行为计时器 */
  private initActTimer(actPeriod: number) {
    this.actTimer = setInterval(() => {
      if (Object.keys(this.actCache).length === 0) { return }
      this.postReport("act", this.actCache)
      this.actCache = []
    }, actPeriod)
  }

  /** 初始化心跳计时器 */
  private initHbTimer(hbPeriod: number) {
    this.hbBeatReport()
    this.hbTimer = setInterval(() => {
      if (this.isHiddenTimeOut) {
        /** 如果隐藏超时 */
        this.subtractHeartBeatCount = this.heartBeatCount
        this.isHiddenTimeOut = false
      }
      this.heartBeatCount = this.heartBeatCount + 1
      this.hbBeatReport()
    }, hbPeriod)
  }

  private hbBeatReport() {
    this.postReport("hb", [{
      ts: Date.now(),
      heartBeatCount: this.heartBeatCount - this.subtractHeartBeatCount,
    }])
  }

  /////////////   上报事件   //////////////
  /** 上报 行为事件 */
  private reportAct(route: string, type: string, params?: IData) {
    /** report 出错了不要影响历史的进程！ */
    setTimeout(() => {
      const paramString = params ? `?${this.queryString(params)}` : ""
      this.actCount = this.actCount + 1
      this.actCache.push({
        ts: Date.now(),
        actName: `${route}${paramString}`,
        actType: type,
        actCount: this.actCount,
      })
    })
  }

  /** 上报 用户信息 */
  private reportUserAllInfo() {
    const data = {
      ts: Date.now(),
      infoData: this.personalInfoData,
    }
    this.postReport("info", [data])
  }

  /** 埋点上报函数 */
  private postReport(msgType, cache) {
    const sendTime = Date.now()
    const session = this.session ? this.session : `${this.uid}${this.appName}${sendTime}`
    this.session = session
    const params = {
      uid: this.uid,
      product: this.appName,
      clientType: this.clientType,
      msgType,
      version: this.version,
      sendTime,
      session,
      contentSize: cache.length,
      content: cache,
    }
    /** 测试用 */
    if (!this.reportUrl) {
      return console.log(params)
    }
    wx.request({
      url: `${this.statsHost}${this.reportUrl}`,
      data: params,
      header: {
        contentType: "application/json",
      },
      success: (res) => { },
    })
  }

  /////////////   获取 用户信息数据   //////////////
  private getInitialData() {
    this.getSystemInfo()
    const promiseGetSetting = this.getSetting()
    const promiseGetNetworkType = this.getNetworkType()
    Promise.all([promiseGetSetting, promiseGetNetworkType]).then(() => {
      this.reportUserAllInfo()
    })
  }

  private getSetting() {
    return new Promise((resolve) => {
      wx.getSetting({
        success: (res) => {
          this.authSetting = res.authSetting
          const promiseGetUserInfo = this.getUserInfo()
          const promiseGetLocation = this.getLocation()
          Promise.all([promiseGetUserInfo, promiseGetLocation]).then(() => {
            resolve()
          })
        },
      })
    })
  }

  private getSystemInfo() {
    this.personalInfoData.system = wx.getSystemInfoSync()
  }

  private getNetworkType() {
    return new Promise((resolve) => {
      wx.getNetworkType({
        success: (res) => {
          this.personalInfoData.networkType = res.networkType
          resolve()
        },
        fail: () => {
          this.personalInfoData.networkType = "fail"
          resolve()
        },
      })
    })
  }

  private getUserInfo() {
    return new Promise((resolve) => {
      if (!this.authSetting["scope.userInfo"]) {
        resolve()
        return
      }
      wx.getUserInfo({
        withCredentials: true,
        success: (res) => {
          this.personalInfoData.userInfo = res.userInfo
          resolve()
        },
        fail: () => {
          this.personalInfoData.userInfo = "fail"
          resolve()
        },
      })
    })
  }

  private getLocation() {
    return new Promise((resolve) => {
      if (!this.authSetting["scope.userLocation"]) {
        resolve()
        return
      }
      wx.getLocation({
        success: (res) => {
          this.personalInfoData.location = res
          resolve()
        },
        fail: () => {
          this.personalInfoData.location = "fail"
          resolve()
        },
      })
    })
  }

  /////////////   帮助方法   //////////////
  /** 遍历页面函数 */
  private traversePageFunction(page) {
    const that = this
    Object.keys(page).forEach((i) => {
      if (typeof page[i] === "function") {
        if (!page[i]) { return }
        if (APP_PAGE_METHOD.some((item) => item === i)) { return }
        const oldFunction = page[i]
        page[i] = function (...args) {
          if (!args.length) {
            return oldFunction.apply(this, args)
          }
          /** 只上报事件函数 */
          if (args[0] && args[0].target && args[0].type) {
            that.reportAct(this.route, "tap", {
              type: args[0].type,
              function: i,
            })
          }
          return oldFunction.apply(this, args)
        }
      }
    })
  }

  /** 对象拼接为字符串 */
  private queryString = (params: IData) => {
    const arr = []
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (![null, undefined].includes(value)) {
          arr.push(`${key}=${value}`)
        }
      }
    }
    return arr.join("&")
  }

  private clearTimer = () => {
    clearInterval(this.actTimer)
    clearInterval(this.hbTimer)
    this.actTimer = undefined
    this.hbTimer = undefined
  }
}
