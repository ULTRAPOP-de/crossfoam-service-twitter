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
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var cfData = require("@crossfoam/data");
var ui_helpers_1 = require("@crossfoam/ui-helpers");
var config_js_1 = require("../config.js");
exports.config = config_js_1.default;
// Allow content_scripts to include the services module without codebird
var cb;
if (typeof Codebird === "function") {
    cb = new Codebird();
    cb.setUseProxy(false);
    cb.setConsumerKey(config_js_1.default.api_key, config_js_1.default.api_secret);
}
var requestTokenKey = "twitter--request-token";
var authTokenKey = "twitter--auth-token";
var authRequired = function () {
    return cfData.get(authTokenKey)
        .then(function (value) {
        if (value && value !== undefined && ("oauth_token" in value)) {
            return testAuth(value);
        }
        else {
            return true;
        }
    });
};
exports.authRequired = authRequired;
var asyncAuthRequired = function () { return __awaiter(void 0, void 0, void 0, function () {
    var r;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, authRequired()];
            case 1:
                r = _a.sent();
                return [2 /*return*/, r];
        }
    });
}); };
var testAuth = function (data) {
    cb.setToken(data.oauth_token, data.oauth_token_secret);
    return cb.__call("account_verifyCredentials", {}).then(function (result) {
        if ("reply" in result &&
            "httpstatus" in result.reply &&
            result.reply.httpstatus === 200) {
            return false;
        }
        return true;
    });
};
var createOptions = function (htmlContainer) {
    authRequired()
        .then(function (required) {
        if (required) {
            ui_helpers_1.addHTML(htmlContainer, "<p>" + browser.i18n.getMessage("servicesTwitterAuthorizeNote") + "</p><br /><button id='twitter--auth-button'>" + browser.i18n.getMessage("servicesTwitterAuthorize") + "</button>");
            document.getElementById("twitter--auth-button")
                .addEventListener("click", function () {
                auth(htmlContainer);
            });
        }
        else {
            ui_helpers_1.addHTML(htmlContainer, browser.i18n.getMessage("servicesTwitterAuthorized"));
        }
    })
        .catch(function (err) {
        throw err;
    });
};
exports.createOptions = createOptions;
var cbCall = function (endpoint, params) {
    // TODO: Check if authentication is still valid, otherwise throw error
    return cfData.get(authTokenKey)
        .then(function (data) {
        cb.setToken(data.oauth_token, data.oauth_token_secret);
        return cb.__call(endpoint, params);
    });
};
var cbErrorHandling = function (result) {
    if (("errors" in result.reply && result.reply.errors.length >= 1)
        || "error" in result.reply) {
        if (("errors" in result.reply && result.reply.errors[0].message === "Not authorized.")
            || result.reply.httpstatus === 401
            || ("errors" in result.reply && "code" in result.reply.errors[0] && result.reply.errors[0].code === 89)
            || ("error" in result.reply && result.reply.error === "Not authorized.")) {
            var isAuthRequired = asyncAuthRequired();
            if (isAuthRequired) {
                return "auth";
            }
            else {
                return "again";
            }
        }
        else if ("errors" in result.reply && result.reply.errors[0].code === 88) {
            return "again";
        }
        else {
            throw new Error(JSON.stringify(result));
            return "again";
        }
    }
    else if (result.reply.httpstatus === 0) {
        return "again";
    }
    else {
        return "good";
    }
};
/*
 * The auth function handles the authentication, if required
 * If any interaction between the options page the authentication is required
 * the html_container element is a div, allowing the modul to embed interactions
 * The data object gives access to the data storage functionalities
 */
var auth = function (htmlContainer) {
    return cb.__call("oauth_requestToken", { oauth_callback: "oob" })
        .then(function (reply) {
        return cfData.set(requestTokenKey, reply.reply);
    })
        .then(function (requestToken) {
        cb.setToken(requestToken.oauth_token, requestToken.oauth_token_secret);
        return cb.__call("oauth_authorize", {});
    })
        .then(function (authUrl) {
        return browser.tabs.create({ url: authUrl.reply });
    })
        .then(function () {
        // Modify the html add a click listener with connection to new function
        ui_helpers_1.addHTML(htmlContainer, "<p>" + browser.i18n.getMessage("servicesTwitterAuthorizeNote") + "</p><br />              <input                 type='text'                 placeholder='Twitter PIN'                 id='twitter--auth-pin' />              <button                 id='twitter--auth-button'>                " + browser.i18n.getMessage("servicesTwitterAuthorizeFinish") + "              </button>");
        document.getElementById("twitter--auth-button")
            .addEventListener("click", function () {
            var value = document.getElementById("twitter--auth-pin").value;
            if (value && value.length === 7) {
                auth2(htmlContainer, value);
            }
            else {
                alert(browser.i18n.getMessage("servicesTwitterAuthAlert"));
            }
        });
    });
};
exports.auth = auth;
var auth2 = function (htmlContainer, pin) {
    return cb.__call("oauth_accessToken", { oauth_verifier: pin }).then(function (reply) {
        cfData.set(authTokenKey, reply.reply);
        ui_helpers_1.addHTML(htmlContainer, browser.i18n.getMessage("servicesTwitterAuthorized"));
    });
};
var getBiggerPicture = function (url) {
    var search = "normal";
    var replace = "bigger";
    var position = url.lastIndexOf(search);
    if (position > 0) {
        url = url.substr(0, position) +
            replace +
            url.substr(position + search.length);
    }
    return url;
};
var getUser = function (screenName, timestamp, uniqueID, queue) {
    return cbCall("users_show", {
        screen_name: screenName,
    }).then(function (result) {
        var errorAnalysis = cbErrorHandling(result);
        if (errorAnalysis === "again") {
            queue.call(config_js_1.default.service_key + "--getUser", [
                screenName,
            ], timestamp, uniqueID);
            return Promise.resolve();
        }
        else if (errorAnalysis === "auth") {
            // tslint:disable-next-line:no-console
            console.log("AAAAHHHHH auth me!");
        }
        else {
            return cfData.get("s--" + config_js_1.default.service_key + "--nw--" + screenName, {})
                .then(function (networkObject) {
                var nUuid = uniqueID;
                networkObject[nUuid] = {
                    callCount: null,
                    completeCount: 0,
                    date: Date.now(),
                    lastUpdated: Date.now(),
                    screenName: screenName,
                    state: "queuing",
                };
                return cfData.set("s--" + config_js_1.default.service_key + "--nw--" + screenName, networkObject)
                    .then(function () {
                    return cfData.set("s--" + config_js_1.default.service_key + "--a--" + screenName + "-" + nUuid + "--c", {
                        followers_count: result.reply.followers_count,
                        friends_count: result.reply.friends_count,
                        handle: screenName,
                        id: result.reply.id_str,
                        image: getBiggerPicture(result.reply.profile_image_url_https),
                        name: result.reply.name,
                    });
                })
                    .then(function () {
                    queue.call(config_js_1.default.service_key + "--getFriendsIds", [screenName, undefined, screenName, nUuid, -1], timestamp, uniqueID);
                    // queue.call("getFollowersIds", [screenName, true, nUuid, -1]);
                    return Promise.resolve();
                });
            });
        }
    });
};
exports.getUser = getUser;
// The web extension does not support the scraping of protected accounts
// This is implemented on privacy purpose to protect such accounts
var scrapeAble = function (screenName, userId, centralNode, nUuid) {
    return cfData.get("s--" + config_js_1.default.service_key + "--a--" + centralNode + "-" + nUuid + "--n", {})
        .then(function (nodes) {
        if (userId in nodes && !nodes[userId].protected) {
            return true;
        }
        else {
            return false;
        }
    });
};
var getFriendsIds = function (screenName, userId, centralNode, nUuid, cursor, timestamp, uniqueID, queue) {
    return cfData.get("s--" + config_js_1.default.service_key + "--nw--" + centralNode, {})
        .then(function (networkObject) {
        networkObject[nUuid].state = "loading";
        return cfData.set("s--" + config_js_1.default.service_key + "--nw--" + centralNode, networkObject);
    }).then(function () {
        return scrapeAble(screenName, userId, centralNode, nUuid);
    }).then(function (isScrapeAble) {
        if (!isScrapeAble && screenName !== centralNode) {
            return Promise.resolve();
        }
        else {
            var params = {
                count: 5000,
                cursor: cursor,
                stringify_ids: true,
            };
            if (userId === null || userId === undefined || !userId) {
                Object.assign(params, { screen_name: screenName });
            }
            else {
                Object.assign(params, { user_id: userId });
            }
            return cbCall("friends_ids", params).then(function (result) {
                var errorAnalysis = cbErrorHandling(result);
                if (errorAnalysis === "again") {
                    queue.call(config_js_1.default.service_key + "--getFriendsIds", [
                        screenName, userId, centralNode,
                        nUuid, cursor,
                    ], timestamp, uniqueID);
                    return Promise.resolve();
                }
                else if (errorAnalysis === "auth") {
                    // tslint:disable-next-line:no-console
                    console.log("AAAAHHHHH auth me!");
                }
                else {
                    if (result.reply.ids === null) {
                        // So far not able to figure this out
                        queue.call(config_js_1.default.service_key + "--getFriendsIds", [
                            screenName, userId, centralNode,
                            nUuid, cursor,
                        ], timestamp, uniqueID);
                        return Promise.resolve();
                    }
                    else {
                        return cfData.get("s--" + config_js_1.default.service_key + "--a--" + centralNode + "-" + nUuid + "--n", {})
                            .then(function (nodes) {
                            if (screenName === centralNode) {
                                var newNodes_1 = {};
                                result.reply.ids.forEach(function (id) {
                                    newNodes_1[id] = {
                                        followers: [],
                                        followers_count: 0,
                                        friends: [],
                                        friends_count: 0,
                                        handle: null,
                                        image: null,
                                        name: null,
                                    };
                                });
                                Object.assign(nodes, newNodes_1);
                            }
                            else {
                                // make sure we don't have duplicates in here...
                                result.reply.ids.forEach(function (newNode) {
                                    if (nodes[userId].friends.indexOf(newNode) === -1) {
                                        nodes[userId].friends.push(newNode);
                                    }
                                });
                            }
                            return cfData.set("s--" + config_js_1.default.service_key + "--a--" + centralNode + "-" + nUuid + "--n", nodes);
                        })
                            .then(function (savedData) {
                            if (result.reply.next_cursor_str && result.reply.next_cursor_str !== "0"
                                && result.reply.next_cursor_str !== 0
                                // LIMIT the number of friends of friends to 20.000
                                // TODO: move to configs
                                && savedData[userId].friends.length < 20000) {
                                queue.call(config_js_1.default.service_key + "--getFriendsIds", [
                                    screenName, userId, centralNode,
                                    nUuid, result.reply.next_cursor_str,
                                ], timestamp, uniqueID);
                                return Promise.resolve();
                            }
                            else {
                                queue.call("network--estimateCompletion", [config_js_1.default.service_key, centralNode, nUuid], timestamp, uniqueID);
                                if (centralNode === screenName) {
                                    queue.call(config_js_1.default.service_key + "--getFriends", [screenName, userId, centralNode, nUuid, -1], timestamp, uniqueID);
                                    return cfData.get("s--" + config_js_1.default.service_key + "--a--" + centralNode + "-" + nUuid + "--n", {})
                                        .then(function (nodes) {
                                        Object.keys(nodes).forEach(function (id) {
                                            queue.call(config_js_1.default.service_key + "--getFriendsIds", [undefined, id, centralNode, nUuid, -1], timestamp, uniqueID);
                                        });
                                        return Promise.resolve();
                                    });
                                }
                                else {
                                    return Promise.resolve();
                                }
                            }
                        });
                    }
                }
            });
        }
    });
};
exports.getFriendsIds = getFriendsIds;
var getFriends = function (screenName, userId, centralNode, nUuid, cursor, timestamp, uniqueID, queue) {
    // Check if this user is scrape-able
    return scrapeAble(screenName, userId, centralNode, nUuid)
        .then(function (isScrapeAble) {
        if (!isScrapeAble && screenName !== centralNode) {
            return Promise.resolve();
        }
        else {
            var params = {
                count: 200,
                cursor: cursor,
                include_user_entities: false,
                skip_status: true,
            };
            if (userId === null || userId === undefined || !userId) {
                Object.assign(params, { screen_name: screenName });
            }
            else {
                Object.assign(params, { user_id: userId });
            }
            return cbCall("friends_list", params).then(function (result) {
                var errorAnalysis = cbErrorHandling(result);
                if (errorAnalysis === "again") {
                    queue.call(config_js_1.default.service_key + "--getFriends", [
                        screenName, userId, centralNode,
                        nUuid, cursor,
                    ], timestamp, uniqueID);
                    return Promise.resolve();
                }
                else if (errorAnalysis === "auth") {
                    // tslint:disable-next-line:no-console
                    console.log("AAAAHHHHH auth me!");
                }
                else {
                    return cfData.get("s--" + config_js_1.default.service_key + "--a--" + centralNode + "-" + nUuid + "--n", {})
                        .then(function (nodes) {
                        result.reply.users.forEach(function (user) {
                            if (user.id_str in nodes) {
                                nodes[user.id_str].name = user.name;
                                nodes[user.id_str].handle = user.screen_name;
                                nodes[user.id_str].followers_count = user.followers_count;
                                nodes[user.id_str].friends_count = user.friends_count;
                                nodes[user.id_str].handle = user.screen_name;
                                nodes[user.id_str].image = getBiggerPicture(user.profile_image_url_https);
                                nodes[user.id_str].protected = user.protected;
                            }
                        });
                        return cfData.set("s--" + config_js_1.default.service_key + "--a--" + centralNode + "-" + nUuid + "--n", nodes);
                    })
                        .then(function () {
                        if (result.reply.next_cursor_str && result.reply.next_cursor_str !== "0"
                            && result.reply.next_cursor_str !== 0) {
                            queue.call(config_js_1.default.service_key + "--getFriends", [screenName, userId, centralNode, nUuid, result.reply.next_cursor_str], timestamp, uniqueID);
                        }
                        else {
                            queue.call("network--estimateCompletion", [config_js_1.default.service_key, centralNode, nUuid]);
                        }
                        return Promise.resolve();
                    });
                }
            });
        }
    });
};
exports.getFriends = getFriends;
var getUsers = function (centralNode, nUuid, timestamp, uniqueID, queue) {
    return Promise.all([
        cfData.get("s--" + config_js_1.default.service_key + "--a--" + centralNode + "-" + nUuid + "--nw", { proxyKeys: [] }),
        cfData.get("s--" + config_js_1.default.service_key + "--a--" + centralNode + "-" + nUuid + "--n", {}),
    ]).then(function (data) {
        var query = [];
        var limit = 100;
        var more = false;
        // TODO: this should be relative to the overall size of the core-network
        var proxySizeLimit = data[0].nodes.length / 20;
        Object.keys(data[0].proxyKeys).forEach(function (proxy) {
            if (!(proxy in data[1]) && data[0].proxies[data[0].proxyKeys[proxy]][5] > proxySizeLimit) {
                if (query.length < limit) {
                    query.push(proxy);
                }
                else {
                    more = true;
                }
            }
        });
        if (query.length > 0) {
            var params = {
                user_id: query.join(","),
            };
            return cbCall("users_lookup", params).then(function (result) {
                var errorAnalysis = cbErrorHandling(result);
                if (errorAnalysis === "again") {
                    queue.call(config_js_1.default.service_key + "--getUsers", [
                        centralNode, nUuid,
                    ], timestamp, uniqueID);
                    return Promise.resolve();
                }
                else if (errorAnalysis === "auth") {
                    // tslint:disable-next-line:no-console
                    console.log("AAAAHHHHH auth me!");
                }
                else {
                    result.reply.forEach(function (user) {
                        if (!(user.id_str in data[1])) {
                            data[1][user.id_str] = {};
                        }
                        data[1][user.id_str].name = user.name;
                        data[1][user.id_str].followers_count = user.followers_count;
                        data[1][user.id_str].friends_count = user.friends_count;
                        data[1][user.id_str].handle = user.screen_name;
                        data[1][user.id_str].image = getBiggerPicture(user.profile_image_url_https);
                        data[1][user.id_str].protected = user.protected;
                    });
                    // Some IDs will not return any results, because they are protected
                    query.forEach(function (proxyId) {
                        if (!(proxyId in data[1])) {
                            data[1][proxyId] = {};
                        }
                    });
                    return cfData.set("s--" + config_js_1.default.service_key + "--a--" + centralNode + "-" + nUuid + "--n", data[1])
                        .then(function (savedData) {
                        if (more && queue) {
                            queue.call(config_js_1.default.service_key + "--getUsers", [centralNode, nUuid], timestamp, uniqueID);
                        }
                        else {
                            queue.call("network--cleanupNetwork", [config_js_1.default.service_key, centralNode, nUuid], timestamp, uniqueID);
                            Promise.resolve();
                        }
                    });
                }
            });
        }
        else {
            queue.call("network--cleanupNetwork", [config_js_1.default.service_key, centralNode, nUuid], timestamp, uniqueID);
            return Promise.resolve();
        }
    });
};
exports.getUsers = getUsers;
// TODO: Is this still being used??
var removeNetwork = function (centralNode, nUuid) {
    return cfData.get("s--" + config_js_1.default.service_key + "--nw--" + centralNode)
        .then(function (networkData) {
        delete networkData[nUuid];
        return cfData.set("s--" + config_js_1.default.service_key + "--nw--" + centralNode, networkData)
            .then(function () {
            return Promise.all([
                cfData.remove("s--" + config_js_1.default.service_key + "--a--" + centralNode + "-" + nUuid + "--c"),
                cfData.remove("s--" + config_js_1.default.service_key + "--a--" + centralNode + "-" + nUuid + "--n"),
            ]);
        });
    });
};
exports.removeNetwork = removeNetwork;
//# sourceMappingURL=index.js.map