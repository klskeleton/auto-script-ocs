"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const request_1 = __importDefault(require("./request"));
const system_1 = __importDefault(require("./system"));
const puppeteer_core_1 = __importDefault(require("puppeteer-core"));
class BrwoserUtils {
    constructor() {
        this.default_debug_port = 9222;
        this.debug_cmd = '--remote-debugging-port';
    }
    /**
     * 获取本机 chrome 浏览器的二进制文件路径
     *
     * @return {Promise<String>}
     */
    getChromePath() {
        return new Promise((resolve, reject) => {
            let chrome_path = path_1.default.join(process.env.LOCALAPPDATA, "\\Google\\Chrome\\Application\\chrome.exe");
            if (fs_1.default.existsSync(chrome_path)) {
                resolve(chrome_path);
            }
            else {
                reject("unable to find the chrome path !");
            }
        });
    }
    /**
     *
     * 使用调式模式打开指定路径的 chrome
     * --remote-debugging-port=9222
     *
     * @param {any} options
     * - options
     * 	- binary_path  二进制文件路径
     * 	- port 		   指定打开的端口，默认9222 ，每次调用此方法 端口号会自增 1
     * @see https://chromedevtools.github.io/devtools-protocol/
     *
     * @return {Promise<Browser>} 返回一个Browser对象
     */
    launchChromeByDebug(options) {
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            try {
                //获取可用的端口号
                this.default_debug_port = yield system_1.default.portIsOccupied((options && options.port) || this.default_debug_port);
                let debug_options = `   ${this.debug_cmd}=${this.default_debug_port}`;
                //如果指定了路径，则使用指定路径，否则使用系统的 chrome 路径
                if (!options || !options.binary_path) {
                    //获取系统安装的 chrome 路径
                    let chrome_path = yield this.getChromePath();
                    yield system_1.default.exec(chrome_path + debug_options);
                }
                else {
                    yield system_1.default.exec(options.binary_path + debug_options);
                }
                const wsEndpointURL = yield this.checkBrowserOpened(this.default_debug_port);
                const browser = yield this.createBrowserByDebug(wsEndpointURL);
                resolve(browser);
            }
            catch (e) {
                reject(e);
            }
        }));
    }
    /**
     * 创建一个原生的 Puppeteer.Browser  对象 ，如果不指定浏览器路径则用本地的 chrome
     * @param {any} options launch 配置  默认为 {headless:false,defaultViewport:null}
     * @returns {Promise<Browser>}
     */
    launch(options = { headless: false, defaultViewport: null }) {
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            if (options && options.executablePath) {
                resolve(yield puppeteer_core_1.default.launch(options));
            }
            else {
                let path = yield this.getChromePath();
                console.log("running browser from " + path);
                //找不到安装路径
                if (!path)
                    reject("Unable to find the installation path for Chrome browser");
                else {
                    const opt = Object.assign(options, { executablePath: path });
                    resolve(yield puppeteer_core_1.default.launch(opt));
                }
            }
        }));
    }
    /**
     * 使用devtools 协议来创建一个 Browser  对象 ，
     * @param {String} wsEndpointURL devtools 调试的url
     * @see getWsEndpointURL(port)
     * @returns {Promise<Browser>}
     */
    createBrowserByDebug(wsEndpointURL) {
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            try {
                let browser = yield puppeteer_core_1.default.connect({
                    browserWSEndpoint: wsEndpointURL,
                    defaultViewport: null,
                });
                browser.on('disconnected', () => {
                    browser.close();
                });
                resolve(browser);
            }
            catch (e) {
                reject(e);
            }
        }));
    }
    /**
     * 获取本机打开的 debug 浏览器 wsEndpoint 路径 <br/>
     * GET http://localhost:port/json/version
     *
     * @see https://zhaoqize.github.io/puppeteer-api-zh_CN/#?product=Puppeteer&version=v5.5.0&show=api-browserwsendpoint
     * @see https://chromedevtools.github.io/devtools-protocol/
     * @param {number} port 指定的端口号
     * @return  {Promise<String>}
     */
    getWsEndpointURL(port) {
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            request_1.default.get('http://localhost:' + port + '/json/version').then((r) => {
                resolve(r.data.webSocketDebuggerUrl);
            }).catch((e) => {
                reject(e);
            });
        }));
    }
    /**
     * @see getWsEndpointURL(port)
     */
    getDefaultWsEndpointURL() {
        return this.getWsEndpointURL(this.default_debug_port);
    }
    /**
     *
     * @param {number} port 端口
     * 定时检测浏览器启动状态，如果获取到启动状态，则返回一个 wsEndpoint url
     * @return {Promise<String>}
     */
    checkBrowserOpened(port) {
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            try {
                let point = yield this.getWsEndpointURL(port);
                this.sleep(1000);
                console.log(point);
                resolve(point);
            }
            catch (e) {
                console.log("checking the browser...");
                this.sleep(1000);
                resolve(this.checkBrowserOpened(port));
            }
        }));
    }
    sleep(time) {
        var startTime = new Date().getTime() + parseInt(String(time), 10);
        while (new Date().getTime() < startTime) { }
    }
}
exports.default = BrwoserUtils;
