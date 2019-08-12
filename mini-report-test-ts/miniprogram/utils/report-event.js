"use strict";
exports.__esModule = true;
var APP_PAGE_METHOD = [
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
];
var ReportEvent = /** @class */ (function () {
    function ReportEvent() {
        var _this = this;
        /** 基础属性 */
        this.statsHost = "";
        this.appName = "";
        this.version = "1.0.0";
        this.clientType = "wxMini";
        this.actPeriod = 60 * 1000;
        this.hbPeriod = 15 * 1000;
        this.onHidePeriod = 60 * 1000;
        this.uid = 0;
        /** 行为缓存 */
        this.actCache = [];
        /** 心跳过期计时器名称 */
        this.onHideTimer = 0;
        /** 用于小程序至于后台时存储心跳 */
        this.subtractHeartBeatCount = 0;
        this.isHiddenTimeOut = false;
        /** 计数数据 */
        this.actCount = 0;
        this.heartBeatCount = 0;
        /** 个人信息数据 */
        this.personalInfoData = {
            userInfo: "never",
            location: "never"
        };
        /** 对象拼接为字符串 */
        this.queryString = function (params) {
            var arr = [];
            if (params) {
                for (var _i = 0, _a = Object.entries(params); _i < _a.length; _i++) {
                    var _b = _a[_i], key = _b[0], value = _b[1];
                    if (![null, undefined].includes(value)) {
                        arr.push(key + "=" + value);
                    }
                }
            }
            return arr.join("&");
        };
        this.clearTimer = function () {
            clearInterval(_this.actTimer);
            clearInterval(_this.hbTimer);
            _this.actTimer = undefined;
            _this.hbTimer = undefined;
        };
    }
    /** 初始化，存入设置，修改app&page */
    ReportEvent.prototype.initProcessApp = function (reportConfig, uid) {
        if (!reportConfig.appFunction) {
            throw console.error("必须传入APP对象");
        }
        if (!reportConfig.pageFunction) {
            throw console.error("必须传PAGE对象");
        }
        Object.assign(this, reportConfig);
        this.uid = uid;
        this.processApp();
        this.processPage();
    };
    /////////////   修改app、page   //////////////
    /** 修改page */
    ReportEvent.prototype.processPage = function () {
        var that = this;
        Page = function (page) {
            var oldOnShow = page.onShow;
            var oldOnLoad = page.onLoad;
            var oldOnShareAppMessage = page.onShareAppMessage;
            page.onLoad = function () {
                var args = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    args[_i] = arguments[_i];
                }
                debugger;
                if (!oldOnLoad) {
                    return;
                }
                oldOnLoad.apply(this, args);
            };
            page.onShow = function () {
                var args = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    args[_i] = arguments[_i];
                }
                that.reportAct(this.route, "web");
                if (!oldOnShow) {
                    return;
                }
                oldOnShow.apply(this, args);
            };
            that.traversePageFunction(page);
            if (oldOnShareAppMessage) {
                page.onShareAppMessage = function () {
                    var args = [];
                    for (var _i = 0; _i < arguments.length; _i++) {
                        args[_i] = arguments[_i];
                    }
                    that.reportAct(this.route, "tap", {
                        type: "share",
                        "function": args[0].from
                    });
                    return oldOnShareAppMessage.apply(that, args);
                };
            }
            that.pageFunction(page);
        };
    };
    /** 修改app */
    ReportEvent.prototype.processApp = function () {
        var _this = this;
        App = function (app) {
            var that = _this;
            var oldOnShow = app.onShow;
            var oldOnLaunch = app.onLaunch;
            var oldOnHide = app.onHide;
            var oldOnUnload = app.onUnload;
            app.onLaunch = function () {
                var args = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    args[_i] = arguments[_i];
                }
                oldOnLaunch.apply(app, args);
                that.initInterval();
            };
            app.onShow = function () {
                var args = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    args[_i] = arguments[_i];
                }
                if (oldOnShow) {
                    oldOnShow.apply(this, args);
                }
                if (that.onHideTimer) {
                    clearInterval(that.onHideTimer);
                    that.onHideTimer = null;
                    return;
                }
                that.heartBeatCount = 0;
                that.session = null;
                that.actCount = 0;
                that.isHiddenTimeOut = true;
                that.getInitialData();
            };
            app.onHide = function () {
                var args = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    args[_i] = arguments[_i];
                }
                if (oldOnHide) {
                    oldOnHide.apply(this, args);
                }
                that.onHideTimer = setTimeout(function () {
                    that.onHideTimer = 0;
                }, that.onHidePeriod);
            };
            _this.appFunction(app);
        };
    };
    /////////////   初始化   //////////////
    /** 初始化 计时器 */
    ReportEvent.prototype.initInterval = function () {
        if (this.actTimer) {
            throw new Error("定时器已经开启");
        }
        this.initActTimer(this.actPeriod);
        this.initHbTimer(this.hbPeriod);
    };
    /** 初始化行为计时器 */
    ReportEvent.prototype.initActTimer = function (actPeriod) {
        var _this = this;
        this.actTimer = setInterval(function () {
            if (Object.keys(_this.actCache).length === 0) {
                return;
            }
            _this.postReport("act", _this.actCache);
            _this.actCache = [];
        }, actPeriod);
    };
    /** 初始化心跳计时器 */
    ReportEvent.prototype.initHbTimer = function (hbPeriod) {
        var _this = this;
        this.hbBeatReport();
        this.hbTimer = setInterval(function () {
            if (_this.isHiddenTimeOut) {
                /** 如果隐藏超时 */
                _this.subtractHeartBeatCount = _this.heartBeatCount;
                _this.isHiddenTimeOut = false;
            }
            _this.heartBeatCount = _this.heartBeatCount + 1;
            _this.hbBeatReport();
        }, hbPeriod);
    };
    ReportEvent.prototype.hbBeatReport = function () {
        this.postReport("hb", [{
                ts: Date.now(),
                heartBeatCount: this.heartBeatCount - this.subtractHeartBeatCount
            }]);
    };
    /////////////   上报事件   //////////////
    /** 上报 行为事件 */
    ReportEvent.prototype.reportAct = function (route, type, params) {
        var _this = this;
        /** report 出错了不要影响历史的进程！ */
        setTimeout(function () {
            var paramString = params ? "?" + _this.queryString(params) : "";
            _this.actCount = _this.actCount + 1;
            _this.actCache.push({
                ts: Date.now(),
                actName: "" + route + paramString,
                actType: type,
                actCount: _this.actCount
            });
        });
    };
    /** 上报 用户信息 */
    ReportEvent.prototype.reportUserAllInfo = function () {
        var data = {
            ts: Date.now(),
            infoData: this.personalInfoData
        };
        this.postReport("info", [data]);
    };
    /** 埋点上报函数 */
    ReportEvent.prototype.postReport = function (msgType, cache) {
        var sendTime = Date.now();
        var session = this.session ? this.session : "" + this.uid + this.appName + sendTime;
        this.session = session;
        var params = {
            uid: this.uid,
            product: this.appName,
            clientType: this.clientType,
            msgType: msgType,
            version: this.version,
            sendTime: sendTime,
            session: session,
            contentSize: cache.length,
            content: cache
        };
        /** 测试用 */
        if (!this.reportUrl) {
            return console.log(params);
        }
        wx.request({
            url: "" + this.statsHost + this.reportUrl,
            data: params,
            header: {
                contentType: "application/json"
            },
            success: function (res) { }
        });
    };
    /////////////   获取 用户信息数据   //////////////
    ReportEvent.prototype.getInitialData = function () {
        var _this = this;
        this.getSystemInfo();
        var promiseGetSetting = this.getSetting();
        var promiseGetNetworkType = this.getNetworkType();
        Promise.all([promiseGetSetting, promiseGetNetworkType]).then(function () {
            _this.reportUserAllInfo();
        });
    };
    ReportEvent.prototype.getSetting = function () {
        var _this = this;
        return new Promise(function (resolve) {
            wx.getSetting({
                success: function (res) {
                    _this.authSetting = res.authSetting;
                    var promiseGetUserInfo = _this.getUserInfo();
                    var promiseGetLocation = _this.getLocation();
                    Promise.all([promiseGetUserInfo, promiseGetLocation]).then(function () {
                        resolve();
                    });
                }
            });
        });
    };
    ReportEvent.prototype.getSystemInfo = function () {
        this.personalInfoData.system = wx.getSystemInfoSync();
    };
    ReportEvent.prototype.getNetworkType = function () {
        var _this = this;
        return new Promise(function (resolve) {
            wx.getNetworkType({
                success: function (res) {
                    _this.personalInfoData.networkType = res.networkType;
                    resolve();
                },
                fail: function () {
                    _this.personalInfoData.networkType = "fail";
                    resolve();
                }
            });
        });
    };
    ReportEvent.prototype.getUserInfo = function () {
        var _this = this;
        return new Promise(function (resolve) {
            if (!_this.authSetting["scope.userInfo"]) {
                resolve();
                return;
            }
            wx.getUserInfo({
                withCredentials: true,
                success: function (res) {
                    _this.personalInfoData.userInfo = res.userInfo;
                    resolve();
                },
                fail: function () {
                    _this.personalInfoData.userInfo = "fail";
                    resolve();
                }
            });
        });
    };
    ReportEvent.prototype.getLocation = function () {
        var _this = this;
        return new Promise(function (resolve) {
            if (!_this.authSetting["scope.userLocation"]) {
                resolve();
                return;
            }
            wx.getLocation({
                success: function (res) {
                    _this.personalInfoData.location = res;
                    resolve();
                },
                fail: function () {
                    _this.personalInfoData.location = "fail";
                    resolve();
                }
            });
        });
    };
    /////////////   帮助方法   //////////////
    /** 遍历页面函数 */
    ReportEvent.prototype.traversePageFunction = function (page) {
        var that = this;
        Object.keys(page).forEach(function (i) {
            if (typeof page[i] === "function") {
                if (!page[i]) {
                    return;
                }
                if (APP_PAGE_METHOD.some(function (item) { return item === i; })) {
                    return;
                }
                var oldFunction_1 = page[i];
                page[i] = function () {
                    var args = [];
                    for (var _i = 0; _i < arguments.length; _i++) {
                        args[_i] = arguments[_i];
                    }
                    if (!args.length) {
                        return oldFunction_1.apply(this, args);
                    }
                    /** 只上报事件函数 */
                    if (args[0] && args[0].target && args[0].type) {
                        that.reportAct(this.route, "tap", {
                            type: args[0].type,
                            "function": i
                        });
                    }
                    return oldFunction_1.apply(this, args);
                };
            }
        });
    };
    return ReportEvent;
}());
exports.ReportEvent = ReportEvent;
//# sourceMappingURL=report-event.js.map