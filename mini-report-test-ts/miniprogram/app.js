"use strict";
//app.ts
exports.__esModule = true;
var report_event_1 = require("./utils/report-event");
console.log(Page);
var reportEvent = new report_event_1.ReportEvent();
var uid = wx.getStorageSync("uid") || 0;
var reportConfig = {
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
};
reportEvent.initProcessApp(reportConfig, uid);
App({
    onLaunch: function (res) {
        var _this = this;
        // 展示本地存储能力
        var logs = wx.getStorageSync('logs') || [];
        logs.unshift(Date.now());
        wx.setStorageSync('logs', logs);
        // 登录
        wx.login({
            success: function (_res) {
                // console.log(_res.code)
                // 发送 _res.code 到后台换取 openId, sessionKey, unionId
            }
        });
        // 获取用户信息
        wx.getSetting({
            success: function (res) {
                if (res.authSetting['scope.userInfo']) {
                    // 已经授权，可以直接调用 getUserInfo 获取头像昵称，不会弹框
                    wx.getUserInfo({
                        success: function (res) {
                            // 可以将 res 发送给后台解码出 unionId
                            _this.globalData.userInfo = res.userInfo;
                            // 由于 getUserInfo 是网络请求，可能会在 Page.onLoad 之后才返回
                            // 所以此处加入 callback 以防止这种情况
                            if (_this.userInfoReadyCallback) {
                                _this.userInfoReadyCallback(res.userInfo);
                            }
                        }
                    });
                }
            }
        });
    },
    globalData: {}
});
//# sourceMappingURL=app.js.map